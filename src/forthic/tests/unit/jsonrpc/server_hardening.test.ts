/**
 * JSON-RPC server hardening tests: auth, body-size limits, error-info
 * sanitization, and the loopback-by-default bind.
 */
import * as http from 'http';
import { serve, ServeOptions } from '../../../../jsonrpc/server.js';
import { JsonRpcErrorCode } from '../../../../jsonrpc/errors.js';

describe('JSON-RPC server hardening', () => {
  let server: http.Server | null = null;
  let endpoint = '';

  async function start(options: ServeOptions = {}): Promise<void> {
    server = await serve(0, options);
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('No server address');
    endpoint = `http://127.0.0.1:${addr.port}/rpc`;
  }

  async function post(body: string, headers: Record<string, string> = {}): Promise<{ status: number; json: any }> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close', ...headers },
      body,
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : undefined };
  }

  function rpcBody(method: string, params: any): string {
    return JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  }

  afterEach(async () => {
    if (server) {
      const s = server;
      server = null;
      (s as any).closeAllConnections?.();
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  describe('bind address', () => {
    test('defaults to loopback (127.0.0.1)', async () => {
      await start();
      const addr = server!.address();
      expect(addr && typeof addr !== 'string' ? addr.address : '').toBe('127.0.0.1');
    });
  });

  describe('authentication', () => {
    test('rejects requests with no token when one is configured', async () => {
      await start({ token: 'secret' });
      const r = await post(rpcBody('listModules', {}));
      expect(r.status).toBe(401);
    });

    test('rejects a wrong token', async () => {
      await start({ token: 'secret' });
      const r = await post(rpcBody('listModules', {}), { Authorization: 'Bearer nope' });
      expect(r.status).toBe(401);
    });

    test('accepts the correct Bearer token', async () => {
      await start({ token: 'secret' });
      const r = await post(rpcBody('listModules', {}), { Authorization: 'Bearer secret' });
      expect(r.status).toBe(200);
      expect(r.json.result.modules).toBeDefined();
    });

    test('no token configured means no auth required', async () => {
      await start();
      const r = await post(rpcBody('listModules', {}));
      expect(r.status).toBe(200);
    });
  });

  describe('body-size limit', () => {
    test('rejects a body larger than maxBodyBytes with 413', async () => {
      await start({ maxBodyBytes: 64 });
      const big = rpcBody('executeWord', { word_name: 'NOOP', stack: [{ string_value: 'x'.repeat(500) }] });
      expect(big.length).toBeGreaterThan(64);
      const r = await post(big);
      expect(r.status).toBe(413);
    });

    test('accepts a body within the limit', async () => {
      await start({ maxBodyBytes: 1024 });
      const r = await post(rpcBody('listModules', {}));
      expect(r.status).toBe(200);
    });

    test('rejects an oversized chunked body with no Content-Length', async () => {
      await start({ maxBodyBytes: 64 });
      const url = new URL(endpoint);
      const result = await new Promise<{ status?: number; errored: boolean }>((resolve) => {
        const req = http.request(
          { host: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve({ status: res.statusCode, errored: false }));
          }
        );
        req.on('error', () => resolve({ errored: true }));
        // No Content-Length -> chunked transfer, so the limit is enforced while
        // streaming. 500 bytes > the 64-byte cap.
        for (let i = 0; i < 10; i++) req.write('x'.repeat(50));
        req.end();
      });
      // Best-effort: a clean 413, or the socket was dropped. Never a success.
      expect(result.status === 413 || result.errored).toBe(true);
      expect(result.status).not.toBe(200);
    });
  });

  describe('error-info sanitization', () => {
    test('runtime errors omit stack_trace and word_location by default', async () => {
      await start();
      const r = await post(rpcBody('executeWord', { word_name: 'NONEXISTENT_WORD', stack: [] }));
      expect(r.json.error.code).toBe(JsonRpcErrorCode.RuntimeError);
      // Message + type + context still present…
      expect(r.json.error.data.runtime).toBe('typescript');
      expect(r.json.error.data.error_type).toBeDefined();
      // …but no server internals leak.
      expect(r.json.error.data.stack_trace).toBeUndefined();
      expect(r.json.error.data.word_location).toBeUndefined();
    });

    test('exposeStackTraces re-enables stack_trace for local debugging', async () => {
      await start({ exposeStackTraces: true });
      const r = await post(rpcBody('executeWord', { word_name: 'NONEXISTENT_WORD', stack: [] }));
      expect(Array.isArray(r.json.error.data.stack_trace)).toBe(true);
      expect(r.json.error.data.stack_trace.length).toBeGreaterThan(0);
    });
  });
});
