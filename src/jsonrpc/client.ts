/**
 * JSON-RPC 2.0 client for Forthic — speaks the same surface as GrpcClient
 * (executeWord / executeSequence / listModules / getModuleInfo) so it can
 * be used interchangeably via the RuntimeClient interface.
 *
 * Uses the global `fetch` (Node ≥18). For older Node, inject your own
 * fetch via the constructor's `fetchImpl` option.
 */
import { serializeValue, deserializeValue } from '../common/serializer.js';
import { RemoteRuntimeError, parseErrorInfo } from '../common/errors.js';
import type {
  RuntimeClient,
  ModuleSummary,
  GetModuleInfoResponse,
} from '../common/runtime_client.js';
import { JsonRpcErrorCode } from './errors.js';

export type { ModuleSummary, GetModuleInfoResponse, WordInfo } from '../common/runtime_client.js';

type FetchLike = (url: string, init?: any) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

interface JsonRpcResponseEnvelope {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface JsonRpcClientOptions {
  /** Custom fetch implementation; defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Optional path; defaults to /rpc. */
  path?: string;
}

export class JsonRpcClient implements RuntimeClient {
  private endpoint: string;
  private fetchImpl: FetchLike;
  private nextId: number = 1;

  /**
   * @param address - "host:port" or full URL. "host:port" is rewritten as
   *                  `http://host:port<path>`. A full URL is used as-is and
   *                  the `path` option is ignored.
   */
  constructor(address: string = 'localhost:8765', options: JsonRpcClientOptions = {}) {
    const path = options.path ?? '/rpc';
    if (/^https?:\/\//i.test(address)) {
      this.endpoint = address;
    } else {
      this.endpoint = `http://${address}${path}`;
    }

    const fetchImpl = options.fetchImpl ?? (globalThis as any).fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error(
        'JsonRpcClient requires a fetch implementation. Use Node ≥18 or pass options.fetchImpl.'
      );
    }
    this.fetchImpl = fetchImpl;
  }

  async executeWord(wordName: string, stack: any[]): Promise<any[]> {
    const result = await this.call('executeWord', {
      word_name: wordName,
      stack: stack.map((v) => serializeValue(v)),
    });
    return (result.result_stack ?? []).map((v: any) => deserializeValue(v));
  }

  async executeSequence(wordNames: string[], stack: any[]): Promise<any[]> {
    const result = await this.call('executeSequence', {
      word_names: wordNames,
      stack: stack.map((v) => serializeValue(v)),
    });
    return (result.result_stack ?? []).map((v: any) => deserializeValue(v));
  }

  async listModules(): Promise<ModuleSummary[]> {
    const result = await this.call('listModules', {});
    return result.modules ?? [];
  }

  async getModuleInfo(moduleName: string): Promise<GetModuleInfoResponse> {
    return await this.call('getModuleInfo', { module_name: moduleName });
  }

  close(): void {
    // Stateless over HTTP — nothing to close.
  }

  private async call(method: string, params: any): Promise<any> {
    const id = this.nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err: any) {
      throw new Error(`JSON-RPC transport error: ${err?.message ?? String(err)}`);
    }

    const text = await response.text();
    if (!response.ok && !text) {
      throw new Error(`JSON-RPC HTTP ${response.status}: ${response.statusText}`);
    }

    let envelope: JsonRpcResponseEnvelope;
    try {
      envelope = JSON.parse(text);
    } catch (err: any) {
      throw new Error(
        `JSON-RPC parse error (HTTP ${response.status}): ${err?.message ?? String(err)}`
      );
    }

    if (envelope.error) {
      const { code, message, data } = envelope.error;
      if (code === JsonRpcErrorCode.RuntimeError && data && typeof data === 'object') {
        throw new RemoteRuntimeError(parseErrorInfo(data));
      }
      throw new Error(`JSON-RPC error ${code}: ${message}`);
    }

    return envelope.result;
  }
}
