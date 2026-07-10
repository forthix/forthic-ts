/**
 * TypeScript JSON-RPC 2.0 Server for Forthic
 *
 * Mirrors the four methods of the gRPC server:
 *   executeWord, executeSequence, listModules, getModuleInfo
 *
 * Transport: HTTP POST /rpc with JSON-RPC 2.0 envelopes.
 * Uses Node's built-in `http` module — zero new dependencies.
 *
 * `executeSequence` is a single JSON-RPC call with an array of words; it is
 * NOT a JSON-RPC batch. Batch envelopes are rejected with code -32600.
 */
import * as http from 'http';
import { StandardInterpreter } from '../forthic/interpreter.js';
import { serializeValue, deserializeValue } from '../grpc/serializer.js';
import { FsModule } from '../forthic/modules/typescript/fs_module.js';
import { JsonRpcErrorCode } from './errors.js';

interface ErrorInfo {
  message: string;
  runtime: string;
  stack_trace?: string[];
  error_type?: string;
  word_location?: string;
  module_name?: string;
  context?: { [key: string]: string };
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: any;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number | string | null;
  result: any;
}

interface JsonRpcError {
  jsonrpc: '2.0';
  id: number | string | null;
  error: { code: number; message: string; data?: any };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

class ForthicJsonRpcServicer {
  private runtimeModules: { [key: string]: any };

  constructor() {
    this.runtimeModules = {
      fs: new FsModule(),
    };
  }

  async executeWord(params: any): Promise<{ result_stack: any[] }> {
    const wordName = params?.word_name;
    if (typeof wordName !== 'string') {
      throw makeInvalidParams('executeWord requires string "word_name"');
    }
    const stackParam = params?.stack;
    if (!Array.isArray(stackParam)) {
      throw makeInvalidParams('executeWord requires array "stack"');
    }
    const stack = stackParam.map((sv: any) => deserializeValue(sv));
    const resultStack = await this._executeWithStack(wordName, stack);
    return { result_stack: resultStack.map((v) => serializeValue(v)) };
  }

  async executeSequence(params: any): Promise<{ result_stack: any[] }> {
    const wordNames = params?.word_names;
    if (!Array.isArray(wordNames) || !wordNames.every((w) => typeof w === 'string')) {
      throw makeInvalidParams('executeSequence requires string[] "word_names"');
    }
    const stackParam = params?.stack;
    if (!Array.isArray(stackParam)) {
      throw makeInvalidParams('executeSequence requires array "stack"');
    }
    const stack = stackParam.map((sv: any) => deserializeValue(sv));
    const resultStack = await this._executeSequenceWithStack(wordNames, stack);
    return { result_stack: resultStack.map((v) => serializeValue(v)) };
  }

  async listModules(_params: any): Promise<{ modules: any[] }> {
    const modules: any[] = [];
    for (const [name, mod] of Object.entries(this.runtimeModules)) {
      modules.push({
        name,
        description: `TypeScript-specific ${name} module`,
        word_count: this._getModuleWordCount(mod),
        runtime_specific: true,
      });
    }
    return { modules };
  }

  async getModuleInfo(params: any): Promise<{ name: string; description: string; words: any[] }> {
    const moduleName = params?.module_name;
    if (typeof moduleName !== 'string') {
      throw makeInvalidParams('getModuleInfo requires string "module_name"');
    }
    if (!(moduleName in this.runtimeModules)) {
      throw new JsonRpcMethodError(
        JsonRpcErrorCode.ModuleNotFound,
        `Module '${moduleName}' not found`
      );
    }
    const mod = this.runtimeModules[moduleName];
    const words: any[] = [];
    if (typeof mod.getWordDocs === 'function') {
      for (const doc of mod.getWordDocs()) {
        words.push({
          name: doc.name,
          stack_effect: doc.stackEffect,
          description: doc.description,
        });
      }
    } else {
      const exportedWords = mod.exportable || {};
      for (const [name, _word] of Object.entries(exportedWords)) {
        words.push({
          name,
          stack_effect: '( -- )',
          description: `${name} word from ${moduleName} module`,
        });
      }
    }
    return {
      name: moduleName,
      description: `TypeScript-specific ${moduleName} module`,
      words,
    };
  }

  buildRuntimeError(
    exception: any,
    wordName: string | null = null,
    context: { [key: string]: string } = {}
  ): ErrorInfo {
    const stackTrace = exception?.stack ? String(exception.stack).split('\n') : [];
    const errorType = exception?.constructor?.name || 'Error';
    const errorContext: { [key: string]: string } = {};
    if (wordName) errorContext['word_name'] = wordName;
    Object.assign(errorContext, context);

    const errorInfo: ErrorInfo = {
      message: exception?.message ?? String(exception),
      runtime: 'typescript',
      stack_trace: stackTrace,
      error_type: errorType,
      context: errorContext,
    };
    if (stackTrace.length > 0) {
      const m = stackTrace[0].match(/\((.*):(\d+):\d+\)/);
      if (m) errorInfo.word_location = `${m[1]}:${m[2]}`;
    }
    return errorInfo;
  }

  getRegisteredModuleNames(): string[] {
    return Object.keys(this.runtimeModules);
  }

  private async _executeWithStack(wordName: string, stack: any[]): Promise<any[]> {
    const interp = new StandardInterpreter();
    for (const [_n, m] of Object.entries(this.runtimeModules)) {
      interp.register_module(m);
    }
    if (Object.keys(this.runtimeModules).length > 0) {
      interp.use_modules(Object.keys(this.runtimeModules));
    }
    for (const item of stack) interp.stack_push(item);
    await interp.run(wordName);
    return interp.get_stack().get_items();
  }

  private async _executeSequenceWithStack(wordNames: string[], stack: any[]): Promise<any[]> {
    const interp = new StandardInterpreter();
    for (const [_n, m] of Object.entries(this.runtimeModules)) {
      interp.register_module(m);
    }
    if (Object.keys(this.runtimeModules).length > 0) {
      interp.use_modules(Object.keys(this.runtimeModules));
    }
    for (const item of stack) interp.stack_push(item);
    for (const wordName of wordNames) {
      await interp.run(wordName);
    }
    return interp.get_stack().get_items();
  }

  private _getModuleWordCount(mod: any): number {
    if (typeof mod.getWordDocs === 'function') return mod.getWordDocs().length;
    if (mod.exportable) return Object.keys(mod.exportable).length;
    return 0;
  }
}

class JsonRpcMethodError extends Error {
  constructor(public code: number, message: string, public data?: any) {
    super(message);
    this.name = 'JsonRpcMethodError';
  }
}

function makeInvalidParams(message: string): JsonRpcMethodError {
  return new JsonRpcMethodError(JsonRpcErrorCode.InvalidParams, message);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function writeJsonRpc(
  res: http.ServerResponse,
  status: number,
  payload: JsonRpcResponse | { error: { code: number; message: string } }
): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function dispatch(
  servicer: ForthicJsonRpcServicer,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  const id = request.id ?? null;
  const method = request.method;
  const params = request.params ?? {};

  try {
    let result: any;
    switch (method) {
      case 'executeWord':
        try {
          result = await servicer.executeWord(params);
        } catch (err: any) {
          if (err instanceof JsonRpcMethodError) throw err;
          // Treat as Forthic runtime error with rich data
          const data = servicer.buildRuntimeError(err, params?.word_name ?? null);
          throw new JsonRpcMethodError(
            JsonRpcErrorCode.RuntimeError,
            data.message,
            data
          );
        }
        break;
      case 'executeSequence':
        try {
          result = await servicer.executeSequence(params);
        } catch (err: any) {
          if (err instanceof JsonRpcMethodError) throw err;
          const seqContext: { [key: string]: string } = Array.isArray(params?.word_names)
            ? { word_sequence: params.word_names.join(', ') }
            : {};
          const data = servicer.buildRuntimeError(err, null, seqContext);
          throw new JsonRpcMethodError(
            JsonRpcErrorCode.RuntimeError,
            data.message,
            data
          );
        }
        break;
      case 'listModules':
        result = await servicer.listModules(params);
        break;
      case 'getModuleInfo':
        result = await servicer.getModuleInfo(params);
        break;
      default:
        throw new JsonRpcMethodError(
          JsonRpcErrorCode.MethodNotFound,
          `Method not found: ${method}`
        );
    }
    return { jsonrpc: '2.0', id, result };
  } catch (err: any) {
    if (err instanceof JsonRpcMethodError) {
      const error: JsonRpcError['error'] = { code: err.code, message: err.message };
      if (err.data !== undefined) error.data = err.data;
      return { jsonrpc: '2.0', id, error };
    }
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: JsonRpcErrorCode.InternalError,
        message: err?.message ?? String(err),
      },
    };
  }
}

export async function serve(port: number = 8765): Promise<http.Server> {
  const servicer = new ForthicJsonRpcServicer();

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'POST' });
      res.end('Method Not Allowed');
      return;
    }
    if (req.url !== '/rpc' && req.url !== '/') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ctype = (req.headers['content-type'] || '').toString().toLowerCase();
    if (!ctype.includes('application/json')) {
      res.writeHead(415, { 'Content-Type': 'text/plain' });
      res.end('Unsupported Media Type');
      return;
    }

    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      writeJsonRpc(res, 200, {
        jsonrpc: '2.0',
        id: null,
        error: { code: JsonRpcErrorCode.ParseError, message: 'Failed to read request body' },
      });
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err: any) {
      writeJsonRpc(res, 200, {
        jsonrpc: '2.0',
        id: null,
        error: { code: JsonRpcErrorCode.ParseError, message: `Parse error: ${err.message}` },
      });
      return;
    }

    if (Array.isArray(parsed)) {
      writeJsonRpc(res, 200, {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: JsonRpcErrorCode.InvalidRequest,
          message: 'Batch requests are not supported',
        },
      });
      return;
    }

    if (
      !parsed ||
      parsed.jsonrpc !== '2.0' ||
      typeof parsed.method !== 'string' ||
      !('id' in parsed)
    ) {
      writeJsonRpc(res, 200, {
        jsonrpc: '2.0',
        id: parsed?.id ?? null,
        error: {
          code: JsonRpcErrorCode.InvalidRequest,
          message: 'Invalid JSON-RPC 2.0 request',
        },
      });
      return;
    }

    const response = await dispatch(servicer, parsed as JsonRpcRequest);
    writeJsonRpc(res, 200, response);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      const loaded = servicer.getRegisteredModuleNames();
      if (loaded.length > 0) {
        console.log(`  - Available runtime modules: ${loaded.join(', ')}`);
      } else {
        console.log('  - No runtime-specific modules loaded');
      }
      resolve(server);
    });
  });
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let port = 8765;
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }
  await serve(port);
  console.log(`Forthic JSON-RPC server listening on port ${port}`);
}

// Run as a CLI entry only under CommonJS. In an ES module `require` is not
// defined, and referencing it at top level throws on import; the typeof guard
// keeps `import "@forthix/forthic/jsonrpc"` working in ESM consumers.
if (typeof require !== "undefined" && require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
