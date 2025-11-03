/**
 * Phase 11.1: TypeScript gRPC Server for Forthic
 * Implements stack-based execution and module discovery
 * Mirrors the Python server implementation (forthic-py/forthic/grpc/server.py)
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { StandardInterpreter } from '../forthic/interpreter.js';
import { serializeValue, deserializeValue } from './serializer.js';
import { Stack } from '../forthic/interpreter.js';
import { FsModule } from '../forthic/modules/typescript/fs_module.js';

// Type definitions for our gRPC service
interface StackValue {
  int_value?: number;
  string_value?: string;
  bool_value?: boolean;
  float_value?: number;
  null_value?: Record<string, never>;
  array_value?: ArrayValue;
  record_value?: RecordValue;
}

interface ArrayValue {
  items: StackValue[];
}

interface RecordValue {
  fields: { [key: string]: StackValue };
}

interface ExecuteWordRequest {
  word_name: string;
  stack: StackValue[];
}

interface ExecuteWordResponse {
  result_stack: StackValue[];
  error?: ErrorInfo;
}

interface ExecuteSequenceRequest {
  word_names: string[];
  stack: StackValue[];
}

interface ExecuteSequenceResponse {
  result_stack: StackValue[];
  error?: ErrorInfo;
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

interface ListModulesRequest {}

interface ListModulesResponse {
  modules: ModuleSummary[];
}

interface ModuleSummary {
  name: string;
  description: string;
  word_count: number;
  runtime_specific: boolean;
}

interface GetModuleInfoRequest {
  module_name: string;
}

interface GetModuleInfoResponse {
  name: string;
  description: string;
  words: WordInfo[];
}

interface WordInfo {
  name: string;
  stack_effect: string;
  description: string;
}

// Standard library modules (available in all runtimes)
const STANDARD_MODULES = new Set([
  'array',
  'record',
  'string',
  'math',
  'datetime',
  'json',
  'boolean',
  'core',
]);

/**
 * ForthicRuntimeServicer - Implements the gRPC service for TypeScript runtime
 * Mirrors Python's ForthicRuntimeServicer
 */
class ForthicRuntimeServicer {
  private interpreter: any; // StandardInterpreter
  private runtimeModules: { [key: string]: any };

  constructor() {
    // Create a StandardInterpreter instance with all stdlib modules
    this.interpreter = new StandardInterpreter();

    // Track TypeScript-specific modules (non-stdlib)
    // Register runtime-specific modules (like FsModule for Node.js)
    this.runtimeModules = {
      'fs': new FsModule(),
    };
  }

  /**
   * ExecuteWord RPC - Execute a single word with stack state
   */
  async ExecuteWord(
    call: grpc.ServerUnaryCall<ExecuteWordRequest, ExecuteWordResponse>,
    callback: grpc.sendUnaryData<ExecuteWordResponse>
  ): Promise<void> {
    try {
      const request = call.request;
      const wordName = request.word_name;
      console.log(`[EXECUTE_WORD] word='${wordName}' stack_size=${request.stack.length}`);

      // Deserialize the entire stack
      const stack = request.stack.map((sv) => deserializeValue(sv));
      console.log(`[EXECUTE_WORD] Deserialized stack: ${stack.map((x) => typeof x)}`);

      // Execute word with stack-based execution
      const resultStack = await this._executeWithStack(wordName, stack);
      console.log(`[EXECUTE_WORD] Result stack: ${resultStack.map((x) => typeof x)}`);

      // Serialize result stack
      const responseStack = resultStack.map((v) => serializeValue(v));
      console.log(`[EXECUTE_WORD] Success`);

      callback(null, { result_stack: responseStack });
    } catch (error) {
      console.log(`[EXECUTE_WORD] ERROR: ${error}`);
      console.log(`[EXECUTE_WORD] Stack trace:`, error.stack);

      // Build rich error context
      const errorInfo = this._buildErrorInfo(error, call.request.word_name);
      callback(null, { result_stack: [], error: errorInfo });
    }
  }

  /**
   * ExecuteSequence RPC - Execute multiple words in one batch
   */
  async ExecuteSequence(
    call: grpc.ServerUnaryCall<ExecuteSequenceRequest, ExecuteSequenceResponse>,
    callback: grpc.sendUnaryData<ExecuteSequenceResponse>
  ): Promise<void> {
    const request = call.request;
    try {
      const wordNames = request.word_names;
      console.log(`[EXECUTE_SEQUENCE] words=${wordNames} stack_size=${request.stack.length}`);

      // Deserialize the initial stack
      const stack = request.stack.map((sv) => deserializeValue(sv));
      console.log(`[EXECUTE_SEQUENCE] Deserialized stack: ${stack.map((x) => typeof x)}`);

      // Execute the word sequence
      const resultStack = await this._executeSequenceWithStack(wordNames, stack);
      console.log(`[EXECUTE_SEQUENCE] Result stack: ${resultStack.map((x) => typeof x)}`);

      // Serialize result stack
      const responseStack = resultStack.map((v) => serializeValue(v));
      console.log(`[EXECUTE_SEQUENCE] Success`);

      callback(null, { result_stack: responseStack });
    } catch (error) {
      console.log(`[EXECUTE_SEQUENCE] ERROR: ${error}`);
      console.log(`[EXECUTE_SEQUENCE] Stack trace:`, error.stack);

      // Build rich error context
      const errorInfo = this._buildErrorInfo(error, null, {
        word_sequence: request.word_names.join(', '),
      });
      callback(null, { result_stack: [], error: errorInfo });
    }
  }

  /**
   * ListModules RPC - List available TypeScript-specific modules
   */
  async ListModules(
    call: grpc.ServerUnaryCall<ListModulesRequest, ListModulesResponse>,
    callback: grpc.sendUnaryData<ListModulesResponse>
  ): Promise<void> {
    try {
      const modules: ModuleSummary[] = [];

      // Only return runtime-specific modules (not standard library)
      for (const [name, mod] of Object.entries(this.runtimeModules)) {
        // Get module metadata
        const wordCount = this._getModuleWordCount(mod);

        const summary: ModuleSummary = {
          name: name,
          description: `TypeScript-specific ${name} module`,
          word_count: wordCount,
          runtime_specific: true,
        };
        modules.push(summary);
      }

      callback(null, { modules });
    } catch (error) {
      console.error('Error listing modules:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error listing modules: ${error.message}`,
      } as grpc.ServiceError, null);
    }
  }

  /**
   * GetModuleInfo RPC - Get detailed information about a specific module
   */
  async GetModuleInfo(
    call: grpc.ServerUnaryCall<GetModuleInfoRequest, GetModuleInfoResponse>,
    callback: grpc.sendUnaryData<GetModuleInfoResponse>
  ): Promise<void> {
    try {
      const moduleName = call.request.module_name;

      if (!(moduleName in this.runtimeModules)) {
        callback({
          code: grpc.status.NOT_FOUND,
          message: `Module '${moduleName}' not found`,
        } as grpc.ServiceError, null);
        return;
      }

      const mod = this.runtimeModules[moduleName];
      const words: WordInfo[] = [];

      // Use getWordDocs() if available (DecoratedModule)
      if (typeof mod.getWordDocs === 'function') {
        const wordDocs = mod.getWordDocs();
        for (const doc of wordDocs) {
          words.push({
            name: doc.name,
            stack_effect: doc.stackEffect,
            description: doc.description,
          });
        }
      } else {
        // Fallback: Extract word information using reflection
        const exportedWords = mod.exportable || {};
        for (const [name, word] of Object.entries(exportedWords)) {
          words.push({
            name: name,
            stack_effect: '( -- )',
            description: `${name} word from ${moduleName} module`,
          });
        }
      }

      callback(null, {
        name: moduleName,
        description: `TypeScript-specific ${moduleName} module`,
        words: words,
      });
    } catch (error) {
      console.error('Error getting module info:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: `Error getting module info: ${error.message}`,
      } as grpc.ServiceError, null);
    }
  }

  /**
   * Execute a word with given stack state
   * Returns the resulting stack
   */
  private async _executeWithStack(wordName: string, stack: any[]): Promise<any[]> {
    // Create a fresh interpreter for this execution
    // (to avoid state pollution between requests)
    const interp = new StandardInterpreter();

    // Register runtime-specific modules in fresh interpreter
    for (const [moduleName, module] of Object.entries(this.runtimeModules)) {
      interp.register_module(module);
    }

    // Import all runtime-specific modules so their words are available
    if (Object.keys(this.runtimeModules).length > 0) {
      const moduleNames = Object.keys(this.runtimeModules);
      interp.use_modules(moduleNames);
    }

    // Push all stack items onto interpreter stack
    for (const item of stack) {
      interp.stack_push(item);
    }

    // Execute the word
    await interp.run(wordName);

    // Get resulting stack as array
    const result = interp.get_stack();
    return result.get_items();
  }

  /**
   * Execute a sequence of words in one go (batched execution)
   */
  private async _executeSequenceWithStack(wordNames: string[], stack: any[]): Promise<any[]> {
    // Create a fresh interpreter for this execution
    const interp = new StandardInterpreter();

    // Register runtime-specific modules
    for (const [moduleName, module] of Object.entries(this.runtimeModules)) {
      interp.register_module(module);
    }

    // Import all runtime-specific modules
    if (Object.keys(this.runtimeModules).length > 0) {
      const moduleNames = Object.keys(this.runtimeModules);
      interp.use_modules(moduleNames);
    }

    // Push all stack items onto interpreter stack
    for (const item of stack) {
      interp.stack_push(item);
    }

    // Execute each word in sequence
    for (const wordName of wordNames) {
      await interp.run(wordName);
    }

    // Get resulting stack as array
    const result = interp.get_stack();
    return result.get_items();
  }

  /**
   * Build rich error information from an exception
   */
  private _buildErrorInfo(
    exception: any,
    wordName: string | null = null,
    context: { [key: string]: string } = {}
  ): ErrorInfo {
    // Extract stack trace
    const stackTrace = exception.stack ? exception.stack.split('\n') : [];

    // Get error type name
    const errorType = exception.constructor?.name || 'Error';

    console.log(`[_buildErrorInfo] error_type=${errorType}, stack_trace_lines=${stackTrace.length}`);
    console.log(`[_buildErrorInfo] word_name=${wordName}, context=${JSON.stringify(context)}`);

    // Build context dictionary
    const errorContext: { [key: string]: string } = {};
    if (wordName) {
      errorContext['word_name'] = wordName;
    }
    Object.assign(errorContext, context);

    // Build ErrorInfo message
    const errorInfo: ErrorInfo = {
      message: exception.message || String(exception),
      runtime: 'typescript',
      stack_trace: stackTrace,
      error_type: errorType,
      context: errorContext,
    };

    // Try to extract module/word location from stack trace
    // (This is basic - could be enhanced)
    if (stackTrace.length > 0) {
      const firstLine = stackTrace[0];
      // Try to extract file:line from stack trace
      const match = firstLine.match(/\((.*):(\d+):\d+\)/);
      if (match) {
        errorInfo.word_location = `${match[1]}:${match[2]}`;
      }
    }

    console.log(`[_buildErrorInfo] Created ErrorInfo: message=${errorInfo.message}, error_type=${errorInfo.error_type}`);
    console.log(`[_buildErrorInfo] Stack trace count: ${errorInfo.stack_trace?.length || 0}`);
    console.log(`[_buildErrorInfo] Final context: ${JSON.stringify(errorInfo.context)}`);

    return errorInfo;
  }

  /**
   * Get word count for a module
   */
  private _getModuleWordCount(mod: any): number {
    if (typeof mod.getWordDocs === 'function') {
      return mod.getWordDocs().length;
    } else if (mod.exportable) {
      return Object.keys(mod.exportable).length;
    }
    return 0;
  }
}

/**
 * Start the gRPC server
 */
export async function serve(port: number = 50052): Promise<grpc.Server> {
  const server = new grpc.Server();

  // Load the proto file
  const possiblePaths = [
    path.join(__dirname, '../../../../forthic/protos/forthic_runtime.proto'), // From dist/cjs/grpc
    path.join(__dirname, '../../../forthic/protos/forthic_runtime.proto'),    // Alternative
    path.join(process.cwd(), '../forthic/protos/forthic_runtime.proto'),       // From project root
  ];

  let PROTO_PATH = possiblePaths[0];
  // Use the first path that exists
  const fs = require('fs');
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      PROTO_PATH = tryPath;
      break;
    }
  }

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
  const forthicProto = protoDescriptor.forthic;

  // Create servicer
  const servicer = new ForthicRuntimeServicer();

  // Add service to server
  server.addService(forthicProto.ForthicRuntime.service, {
    ExecuteWord: servicer.ExecuteWord.bind(servicer),
    ExecuteSequence: servicer.ExecuteSequence.bind(servicer),
    ListModules: servicer.ListModules.bind(servicer),
    GetModuleInfo: servicer.GetModuleInfo.bind(servicer),
  });

  // Start server
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, actualPort) => {
        if (err) {
          console.error('Failed to start server:', err);
          reject(err);
          return;
        }

        console.log(`Forthic TypeScript gRPC server listening on port ${actualPort}`);
        console.log('Phase 11.1: TypeScript gRPC Server Foundation');
        console.log('Features:');
        console.log('  - Full StandardInterpreter with all stdlib words');
        console.log('  - Runtime-specific module discovery (ListModules, GetModuleInfo)');
        console.log('  - Stack-based word execution (ExecuteWord, ExecuteSequence)');

        const loaded = Object.keys(servicer['runtimeModules']);
        if (loaded.length > 0) {
          console.log(`  - Available runtime modules: ${loaded.join(', ')}`);
        } else {
          console.log('  - No runtime-specific modules loaded');
        }

        resolve(server);
      }
    );
  });
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let port = 50052;

  // Parse --port argument
  const portIndex = args.indexOf('--port');
  if (portIndex !== -1 && args[portIndex + 1]) {
    port = parseInt(args[portIndex + 1], 10);
  }

  await serve(port);
}

// If running directly (not imported)
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
