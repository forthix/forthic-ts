/**
 * RuntimeClient - Transport-agnostic interface for remote Forthic runtime clients.
 *
 * Implemented by both GrpcClient (src/grpc/client.ts) and JsonRpcClient
 * (src/jsonrpc/client.ts) so RemoteModule, RemoteWord, and RuntimeManager
 * work the same way regardless of underlying transport.
 */

export interface ModuleSummary {
  name: string;
  description: string;
  word_count: number;
  runtime_specific: boolean;
}

export interface WordInfo {
  name: string;
  stack_effect: string;
  description: string;
}

export interface GetModuleInfoResponse {
  name: string;
  description: string;
  words: WordInfo[];
}

export interface RuntimeClient {
  executeWord(wordName: string, stack: any[]): Promise<any[]>;
  executeSequence(wordNames: string[], stack: any[]): Promise<any[]>;
  listModules(): Promise<ModuleSummary[]>;
  getModuleInfo(moduleName: string): Promise<GetModuleInfoResponse>;
  close(): void;
}
