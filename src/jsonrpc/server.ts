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
import * as crypto from 'crypto';
import { StandardInterpreter } from '../forthic/interpreter.js';
import { serializeValue, deserializeValue } from '../common/serializer.js';
import { FsModule } from '../forthic/modules/typescript/fs_module.js';
import { JsonRpcErrorCode } from './errors.js';

/** Default cap on request body size (1 MiB). */
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/**
 * Options controlling how the JSON-RPC server is exposed. The server executes
 * Forthic code supplied by callers, so the defaults are deliberately
 * conservative: loopback-only, no remote reach, and no server internals in
 * error responses.
 */
export interface ServeOptions {
  /**
   * Interface to bind. Defaults to `127.0.0.1` (loopback only). Set to
   * `0.0.0.0` to accept remote connections — do so only together with `token`.
   * Env: `FORTHIC_JSONRPC_HOST`.
   */
  host?: string;
  /**
   * Shared secret. When set, every request must send
   * `Authorization: Bearer <token>`; others get 401. Env: `FORTHIC_JSONRPC_TOKEN`.
   */
  token?: string;
  /** Maximum request body in bytes. Env: `FORTHIC_JSONRPC_MAX_BODY_BYTES`. */
  maxBodyBytes?: number;
  /**
   * Include JS stack traces and file-path-derived locations in error
   * responses. Off by default (they leak absolute server paths). For local
   * debugging only.
   */
  exposeStackTraces?: boolean;
}

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
    context: { [key: string]: string } = {},
    includeStack = false
  ): ErrorInfo {
    const errorType = exception?.constructor?.name || 'Error';
    const errorContext: { [key: string]: string } = {};
    if (wordName) errorContext['word_name'] = wordName;
    Object.assign(errorContext, context);

    const errorInfo: ErrorInfo = {
      message: exception?.message ?? String(exception),
      runtime: 'typescript',
      error_type: errorType,
      context: errorContext,
    };

    // Stack traces and the file-path-derived location are omitted by default:
    // they leak absolute server paths and internal module structure to any
    // caller. Opt in via ServeOptions.exposeStackTraces for local debugging.
    if (includeStack) {
      const stackTrace = exception?.stack ? String(exception.stack).split('\n') : [];
      errorInfo.stack_trace = stackTrace;
      if (stackTrace.length > 0) {
        const m = stackTrace[0].match(/\((.*):(\d+):\d+\)/);
        if (m) errorInfo.word_location = `${m[1]}:${m[2]}`;
      }
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

class PayloadTooLargeError extends Error {
  constructor() {
    super('Payload too large');
    this.name = 'PayloadTooLargeError';
  }
}

async function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > maxBytes) {
        // Stop reading and drop the connection so a large or slow body can't
        // exhaust memory.
        reject(new PayloadTooLargeError());
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

/** Constant-time string comparison to avoid leaking the token via timing. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** True when no token is configured, or the request carries the matching Bearer token. */
function isAuthorized(req: http.IncomingMessage, token: string | undefined): boolean {
  if (!token) return true;
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return false;
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqualStr(header.slice(prefix.length), token);
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
  request: JsonRpcRequest,
  exposeStackTraces = false
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
          const data = servicer.buildRuntimeError(err, params?.word_name ?? null, {}, exposeStackTraces);
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
          const data = servicer.buildRuntimeError(err, null, seqContext, exposeStackTraces);
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

export async function serve(port: number = 8765, options: ServeOptions = {}): Promise<http.Server> {
  const servicer = new ForthicJsonRpcServicer();

  const host = options.host ?? process.env.FORTHIC_JSONRPC_HOST ?? '127.0.0.1';
  const token = options.token ?? process.env.FORTHIC_JSONRPC_TOKEN;
  const maxBodyBytes =
    options.maxBodyBytes ??
    (process.env.FORTHIC_JSONRPC_MAX_BODY_BYTES
      ? Number(process.env.FORTHIC_JSONRPC_MAX_BODY_BYTES)
      : DEFAULT_MAX_BODY_BYTES);
  const exposeStackTraces = options.exposeStackTraces ?? false;

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
    // Authenticate before reading the body, so unauthorized callers can't
    // execute code or push a large payload.
    if (!isAuthorized(req, token)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: JsonRpcErrorCode.InvalidRequest, message: 'Unauthorized' } }));
      return;
    }
    const ctype = (req.headers['content-type'] || '').toString().toLowerCase();
    if (!ctype.includes('application/json')) {
      res.writeHead(415, { 'Content-Type': 'text/plain' });
      res.end('Unsupported Media Type');
      return;
    }
    // Reject an oversized body up front via Content-Length, before reading.
    const declaredLen = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLen) && declaredLen > maxBodyBytes) {
      writeJsonRpc(res, 413, {
        jsonrpc: '2.0',
        id: null,
        error: { code: JsonRpcErrorCode.InvalidRequest, message: 'Payload too large' },
      });
      return;
    }

    let raw: string;
    try {
      raw = await readBody(req, maxBodyBytes);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        // readBody destroys the request stream to halt the upload, which can
        // tear down the socket before this response is written (e.g. a chunked
        // body with no Content-Length). Best-effort 413; ignore if the socket
        // is already gone.
        if (!res.headersSent && !res.writableEnded) {
          try {
            writeJsonRpc(res, 413, {
              jsonrpc: '2.0',
              id: null,
              error: { code: JsonRpcErrorCode.InvalidRequest, message: 'Payload too large' },
            });
          } catch {
            /* socket already destroyed */
          }
        }
        return;
      }
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

    const response = await dispatch(servicer, parsed as JsonRpcRequest, exposeStackTraces);
    writeJsonRpc(res, 200, response);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      if (!isLoopbackHost(host) && !token) {
        console.warn(
          `  ⚠ SECURITY: JSON-RPC server bound to non-loopback host '${host}' without an auth token. ` +
            `It executes Forthic code from any client that can reach it. ` +
            `Set options.token / FORTHIC_JSONRPC_TOKEN, or bind to 127.0.0.1.`
        );
      }
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

/**
 * Install Temporal for the standalone server process.
 *
 * The library deliberately does NOT install a global polyfill at import time —
 * temporal-polyfill is an OPTIONAL peer dependency so consumers can bring
 * their own Temporal (or a native one) without a second instance being
 * loaded. But this CLI entry is a first-party executable: without a Temporal
 * global, every date/time value on the wire fails to deserialize with
 * "ReferenceError: Temporal is not defined". Install it here, for this
 * process only.
 */
async function ensureTemporal(): Promise<void> {
  if (typeof (globalThis as { Temporal?: unknown }).Temporal !== 'undefined') return;
  try {
    // Non-literal specifier on purpose: a literal would make TypeScript pull
    // in temporal-spec's global declarations, which collide with this repo's
    // own src/temporal.d.ts (TS6200). This is a runtime-only import.
    const globalPolyfill = 'temporal-polyfill/global';
    await import(globalPolyfill);
  } catch {
    console.error(
      'Forthic JSON-RPC server needs a Temporal implementation: install the ' +
        'optional peer dependency (npm install temporal-polyfill) or run on a ' +
        'runtime with native Temporal.',
    );
    process.exit(1);
  }
}

export async function main(): Promise<void> {
  await ensureTemporal();
  const args = process.argv.slice(2);
  let port = 8765;
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }
  const options: ServeOptions = {};
  const hostIndex = args.indexOf('--host');
  if (hostIndex !== -1 && args[hostIndex + 1]) options.host = args[hostIndex + 1];
  const tokenIndex = args.indexOf('--token');
  if (tokenIndex !== -1 && args[tokenIndex + 1]) options.token = args[tokenIndex + 1];

  await serve(port, options);
  const boundHost = options.host ?? process.env.FORTHIC_JSONRPC_HOST ?? '127.0.0.1';
  console.log(`Forthic JSON-RPC server listening on ${boundHost}:${port}`);
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
