/**
 * Integration tests for JsonRpcClient — clones grpc_client.test.ts with
 * imports swapped for the JSON-RPC transport.
 */
import * as http from 'http';
import { serve } from '../../../jsonrpc/server.js';
import { JsonRpcClient } from '../../../jsonrpc/client.js';

describe('JsonRpcClient Integration Tests', () => {
  let server: http.Server | null = null;
  let client: JsonRpcClient | null = null;
  const TEST_PORT = 8767;

  beforeEach(async () => {
    server = await serve(TEST_PORT);
    client = new JsonRpcClient(`localhost:${TEST_PORT}`);
  });

  afterEach(async () => {
    if (client) { client.close(); client = null; }
    if (server) {
      const s = server;
      server = null;
      (s as any).closeAllConnections?.();
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  describe('Module Discovery', () => {
    test('listModules returns runtime-specific modules', async () => {
      const modules = await client!.listModules();
      expect(Array.isArray(modules)).toBe(true);
      const fsModule = modules.find((m) => m.name === 'fs');
      expect(fsModule).toBeDefined();
      expect(fsModule?.runtime_specific).toBe(true);
      expect(fsModule?.word_count).toBeGreaterThan(0);
    });

    test('getModuleInfo returns detailed module information', async () => {
      const info = await client!.getModuleInfo('fs');
      expect(info.name).toBe('fs');
      expect(Array.isArray(info.words)).toBe(true);
      expect(info.words.length).toBeGreaterThan(0);
      const w0 = info.words[0];
      expect(w0).toHaveProperty('name');
      expect(w0).toHaveProperty('stack_effect');
      expect(w0).toHaveProperty('description');
    });

    test('getModuleInfo throws for non-existent module', async () => {
      await expect(client!.getModuleInfo('nonexistent_module')).rejects.toThrow();
    });
  });

  describe('Word Execution', () => {
    test('executeWord +', async () => {
      const result = await client!.executeWord('+', [1, 2]);
      expect(result).toEqual([3]);
    });

    test('executeWord MAP', async () => {
      const result = await client!.executeWord('MAP', [[1, 2, 3], '2 *']);
      expect(result).toEqual([[2, 4, 6]]);
    });

    test('executeWord REC@', async () => {
      const result = await client!.executeWord('REC@', [{ name: 'Alice', age: 30 }, 'name']);
      expect(result).toEqual(['Alice']);
    });

    test('executeWord throws for unknown word', async () => {
      await expect(client!.executeWord('UNKNOWN_WORD', [])).rejects.toThrow();
    });

    test('executeWord throws on stack underflow', async () => {
      await expect(client!.executeWord('+', [])).rejects.toThrow();
    });
  });

  describe('Sequence Execution', () => {
    test('executeSequence runs multiple words in order', async () => {
      const result = await client!.executeSequence(['-', '/'], [10, 5, 2]);
      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(3.333, 2);
    });

    test('executeSequence with empty word list returns original stack', async () => {
      const result = await client!.executeSequence([], [1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    test('executeSequence stops on error', async () => {
      await expect(client!.executeSequence(['+', 'UNKNOWN_WORD'], [1, 2])).rejects.toThrow();
    });
  });

  describe('Type Serialization', () => {
    test('null values', async () => {
      const result = await client!.executeWord('==', [null, null]);
      expect(result).toEqual([true]);
    });

    test('boolean values', async () => {
      const result = await client!.executeWord('OR', [true, false]);
      expect(result).toEqual([true]);
    });

    test('nested arrays', async () => {
      const result = await client!.executeWord('FLATTEN', [[[1, 2], [3, 4]]]);
      expect(result).toEqual([[1, 2, 3, 4]]);
    });

    test('nested records', async () => {
      const result = await client!.executeWord('REC@', [
        { user: { name: 'Alice', address: { city: 'NYC' } } },
        'user',
      ]);
      expect(result).toEqual([{ name: 'Alice', address: { city: 'NYC' } }]);
    });
  });

  describe('Error Handling', () => {
    test('remote error includes runtime info', async () => {
      try {
        await client!.executeWord('UNKNOWN_WORD', []);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('UNKNOWN_WORD');
        expect(error.toString()).toContain('typescript');
      }
    });

    test('stack underflow message mentions stack', async () => {
      try {
        await client!.executeWord('+', [1]);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message.toLowerCase()).toContain('stack');
      }
    });
  });
});
