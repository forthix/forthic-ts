/**
 * Phase 3 gRPC Client for Forthic
 * Connects to Python runtime and executes remote words
 * Supports all basic Forthic types and module discovery
 * Phase 9: Enhanced error handling with rich context
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { serializeValue, deserializeValue } from './serializer';
import { RemoteRuntimeError, parseErrorInfo } from './errors';

// Type definitions for our gRPC service
interface StackValue {
  int_value?: number;
  string_value?: string;
  bool_value?: boolean;
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
  context?: Record<string, string>;
}

interface ListModulesRequest {}

interface ListModulesResponse {
  modules: ModuleSummary[];
}

export interface ModuleSummary {
  name: string;
  description: string;
  word_count: number;
  runtime_specific: boolean;
}

interface GetModuleInfoRequest {
  module_name: string;
}

export interface GetModuleInfoResponse {
  name: string;
  description: string;
  words: WordInfo[];
}

export interface WordInfo {
  name: string;
  stack_effect: string;
  description: string;
}

interface ForthicRuntimeClient {
  ExecuteWord(
    request: ExecuteWordRequest,
    callback: (error: grpc.ServiceError | null, response: ExecuteWordResponse) => void
  ): void;

  ExecuteSequence(
    request: ExecuteSequenceRequest,
    callback: (error: grpc.ServiceError | null, response: ExecuteSequenceResponse) => void
  ): void;

  ListModules(
    request: ListModulesRequest,
    callback: (error: grpc.ServiceError | null, response: ListModulesResponse) => void
  ): void;

  GetModuleInfo(
    request: GetModuleInfoRequest,
    callback: (error: grpc.ServiceError | null, response: GetModuleInfoResponse) => void
  ): void;
}

/**
 * gRPC client for executing words in remote Forthic runtimes
 */
export class GrpcClient {
  private client: ForthicRuntimeClient;
  private address: string;

  constructor(address: string = 'localhost:50051') {
    this.address = address;

    // Load the proto file
    // Try multiple paths to handle different execution contexts (source vs compiled)
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

    // Create the client
    this.client = new forthicProto.ForthicRuntime(address, grpc.credentials.createInsecure());
  }

  /**
   * Execute a word in the remote runtime
   * @param wordName Name of the word to execute
   * @param stack Current stack values
   * @returns Promise with the result stack
   */
  async executeWord(wordName: string, stack: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Serialize the stack using Phase 2 serializer
      const serializedStack = stack.map((value) => serializeValue(value));

      const request: ExecuteWordRequest = {
        word_name: wordName,
        stack: serializedStack,
      };

      this.client.ExecuteWord(request, (error, response) => {
        if (error) {
          reject(new Error(`gRPC error: ${error.message}`));
          return;
        }

        if (response.error) {
          // Phase 9: Create rich error with full context
          console.log('[DEBUG] Raw error from server:', JSON.stringify(response.error, null, 2));
          const errorInfo = parseErrorInfo(response.error);
          console.log('[DEBUG] Parsed error info:', errorInfo);
          reject(new RemoteRuntimeError(errorInfo));
          return;
        }

        // Deserialize the result stack using Phase 2 deserializer
        const resultStack = response.result_stack.map((value) => deserializeValue(value));
        resolve(resultStack);
      });
    });
  }

  /**
   * Execute a sequence of words in one remote call (batched execution)
   * @param wordNames Array of word names to execute in order
   * @param stack Current stack values
   * @returns Promise with the result stack
   */
  async executeSequence(wordNames: string[], stack: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Serialize the stack using Phase 2 serializer
      const serializedStack = stack.map((value) => serializeValue(value));

      const request: ExecuteSequenceRequest = {
        word_names: wordNames,
        stack: serializedStack,
      };

      this.client.ExecuteSequence(request, (error, response) => {
        if (error) {
          reject(new Error(`gRPC error: ${error.message}`));
          return;
        }

        if (response.error) {
          // Phase 9: Create rich error with full context
          const errorInfo = parseErrorInfo(response.error);
          reject(new RemoteRuntimeError(errorInfo));
          return;
        }

        // Deserialize the result stack using Phase 2 deserializer
        const resultStack = response.result_stack.map((value) => deserializeValue(value));
        resolve(resultStack);
      });
    });
  }

  /**
   * Phase 3: List available runtime-specific modules
   * @returns Promise with array of module summaries
   */
  async listModules(): Promise<ModuleSummary[]> {
    return new Promise((resolve, reject) => {
      const request: ListModulesRequest = {};

      this.client.ListModules(request, (error, response) => {
        if (error) {
          reject(new Error(`gRPC error: ${error.message}`));
          return;
        }

        resolve(response.modules || []);
      });
    });
  }

  /**
   * Phase 3: Get detailed information about a specific module
   * @param moduleName Name of the module
   * @returns Promise with module details including word list
   */
  async getModuleInfo(moduleName: string): Promise<GetModuleInfoResponse> {
    return new Promise((resolve, reject) => {
      const request: GetModuleInfoRequest = {
        module_name: moduleName,
      };

      this.client.GetModuleInfo(request, (error, response) => {
        if (error) {
          reject(new Error(`gRPC error: ${error.message}`));
          return;
        }

        resolve(response);
      });
    });
  }

  /**
   * Close the client connection
   */
  close(): void {
    grpc.closeClient(this.client as any);
  }
}
