/**
 * JSON-RPC Server unit tests
 *
 * Mirrors src/forthic/tests/unit/grpc/server.test.ts. Uses raw HTTP +
 * JSON-RPC envelopes (no client wrapper) so the wire format is exercised.
 */
import * as http from 'http';
import { serve } from '../../../../jsonrpc/server.js';
import { serializeValue, deserializeValue } from '../../../../common/serializer.js';
import { JsonRpcErrorCode } from '../../../../jsonrpc/errors.js';

describe('JSON-RPC Server', () => {
  let server: http.Server | null = null;
  let ENDPOINT = '';

  let nextId = 1;
  async function rpc(method: string, params: any, opts: { contentType?: string; method?: string; raw?: string } = {}): Promise<any> {
    const id = nextId++;
    const body = opts.raw ?? JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const res = await fetch(ENDPOINT, {
      method: opts.method ?? 'POST',
      headers: {
        'Content-Type': opts.contentType ?? 'application/json',
        Connection: 'close',
      },
      body,
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? safeJson(text) : undefined };
  }

  function safeJson(t: string): any {
    try { return JSON.parse(t); } catch { return undefined; }
  }

  beforeEach(async () => {
    server = await serve(0);
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('No server address');
    // Use 127.0.0.1 to avoid IPv6 resolution issues with `localhost`.
    ENDPOINT = `http://127.0.0.1:${addr.port}/rpc`;
  });

  afterEach(async () => {
    if (server) {
      const s = server;
      server = null;
      // Force-close any kept-alive sockets so close() resolves promptly.
      (s as any).closeAllConnections?.();
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  describe('Server Foundation', () => {
    test('listModules returns array with fs module', async () => {
      const r = await rpc('listModules', {});
      expect(r.status).toBe(200);
      expect(r.json.result.modules).toBeDefined();
      const fsModule = r.json.result.modules.find((m: any) => m.name === 'fs');
      expect(fsModule).toBeDefined();
      expect(fsModule.runtime_specific).toBe(true);
    });

    test('non-POST returns 405', async () => {
      const res = await fetch(ENDPOINT, { method: 'GET', headers: { Connection: 'close' } });
      expect(res.status).toBe(405);
    });

    test('non-JSON content-type returns 415', async () => {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Connection: 'close' },
        body: 'hello',
      });
      expect(res.status).toBe(415);
    });

    test('parse error returns -32700', async () => {
      const r = await rpc('', {}, { raw: '{not json' });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.ParseError);
    });

    test('batch envelope rejected with -32600', async () => {
      const r = await rpc('', {}, { raw: '[{"jsonrpc":"2.0","id":1,"method":"listModules"}]' });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.InvalidRequest);
    });

    test('unknown method returns -32601', async () => {
      const r = await rpc('bogus', {});
      expect(r.json.error.code).toBe(JsonRpcErrorCode.MethodNotFound);
    });

    test('invalid params returns -32602', async () => {
      const r = await rpc('executeWord', { word_name: 42, stack: [] });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.InvalidParams);
    });
  });

  describe('Stack Execution - Basic stdlib words', () => {
    test('DUP duplicates top stack item', async () => {
      const r = await rpc('executeWord', { word_name: 'DUP', stack: [serializeValue(42)] });
      expect(r.json.error).toBeUndefined();
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([42, 42]);
    });

    test('SWAP swaps top two items', async () => {
      const r = await rpc('executeWord', {
        word_name: 'SWAP',
        stack: [serializeValue(1), serializeValue(2)],
      });
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([2, 1]);
    });

    test('+ adds two numbers', async () => {
      const r = await rpc('executeWord', {
        word_name: '+',
        stack: [serializeValue(10), serializeValue(32)],
      });
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([42]);
    });

    test('REVERSE reverses an array', async () => {
      const r = await rpc('executeWord', { word_name: 'REVERSE', stack: [serializeValue([1, 2, 3])] });
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([[3, 2, 1]]);
    });
  });

  describe('executeSequence - Multiple words', () => {
    test('Execute DUP then + in sequence', async () => {
      const r = await rpc('executeSequence', { word_names: ['DUP', '+'], stack: [serializeValue(21)] });
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([42]);
    });
  });

  describe('Error handling', () => {
    test('Unknown word returns runtime error -32000 with ErrorInfo data', async () => {
      const r = await rpc('executeWord', { word_name: 'NONEXISTENT_WORD', stack: [] });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.RuntimeError);
      expect(r.json.error.data.runtime).toBe('typescript');
      expect(r.json.error.data.error_type).toBeDefined();
      expect(r.json.error.data.context.word_name).toBe('NONEXISTENT_WORD');
    });

    test('Stack underflow returns -32000', async () => {
      const r = await rpc('executeWord', { word_name: '+', stack: [serializeValue(1)] });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.RuntimeError);
      expect(r.json.error.data.runtime).toBe('typescript');
    });

    test('Sequence error includes word_sequence in context', async () => {
      const r = await rpc('executeSequence', {
        word_names: ['DUP', 'INVALID_WORD', '+'],
        stack: [serializeValue(42)],
      });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.RuntimeError);
      expect(r.json.error.data.context.word_sequence).toContain('INVALID_WORD');
    });

    test('Unknown module returns -32001', async () => {
      const r = await rpc('getModuleInfo', { module_name: 'nonexistent_module' });
      expect(r.json.error.code).toBe(JsonRpcErrorCode.ModuleNotFound);
    });
  });

  describe('Module discovery', () => {
    test('getModuleInfo returns word metadata for fs module', async () => {
      const r = await rpc('getModuleInfo', { module_name: 'fs' });
      expect(r.json.error).toBeUndefined();
      expect(r.json.result.name).toBe('fs');
      expect(r.json.result.words.length).toBeGreaterThan(0);
      const fileExists = r.json.result.words.find((w: any) => w.name === 'FILE-EXISTS?');
      expect(fileExists).toBeDefined();
    });
  });

  describe('Isolation between requests', () => {
    test('Multiple requests do not share state', async () => {
      const r1 = await rpc('executeWord', { word_name: 'DUP', stack: [serializeValue(100)] });
      const r2 = await rpc('executeWord', { word_name: 'DUP', stack: [serializeValue(200)] });
      const s1 = r1.json.result.result_stack.map((v: any) => deserializeValue(v));
      const s2 = r2.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(s1).toEqual([100, 100]);
      expect(s2).toEqual([200, 200]);
    });
  });

  describe('Complex types', () => {
    test('Records, arrays, strings, ints round-trip', async () => {
      const complexStack = [
        serializeValue({ name: 'Alice', age: 30 }),
        serializeValue([1, 2, 3]),
        serializeValue('hello'),
        serializeValue(42),
      ];
      const r = await rpc('executeWord', { word_name: 'DUP', stack: complexStack });
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([{ name: 'Alice', age: 30 }, [1, 2, 3], 'hello', 42, 42]);
    });

    test('NULL with empty stack', async () => {
      const r = await rpc('executeWord', { word_name: 'NULL', stack: [] });
      const stack = r.json.result.result_stack.map((v: any) => deserializeValue(v));
      expect(stack).toEqual([null]);
    });
  });
});
