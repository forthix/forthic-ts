/**
 * Integration tests for GrpcClient
 * Tests the high-level client wrapper that communicates with gRPC servers
 */
import { serve } from '../../../grpc/server.js';
import { GrpcClient } from '../../../grpc/client.js';
import * as grpc from '@grpc/grpc-js';

describe('GrpcClient Integration Tests', () => {
  let server: grpc.Server | null = null;
  let client: GrpcClient | null = null;
  const TEST_PORT = 50054; // Use unique port

  beforeEach(async () => {
    // Start TypeScript gRPC server
    server = await serve(TEST_PORT);

    // Create client pointing to test server
    client = new GrpcClient(`localhost:${TEST_PORT}`);
  });

  afterEach(async () => {
    // Clean up
    if (client) {
      client.close();
      client = null;
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server!.tryShutdown(() => {
          resolve();
        });
      });
      server = null;
    }
  });

  describe('Module Discovery', () => {
    test('listModules returns available runtime-specific modules', async () => {
      const modules = await client!.listModules();

      expect(Array.isArray(modules)).toBe(true);
      // TypeScript server should have the 'fs' module
      expect(modules.length).toBeGreaterThan(0);

      const fsModule = modules.find(m => m.name === 'fs');
      expect(fsModule).toBeDefined();
      expect(fsModule?.runtime_specific).toBe(true);
      expect(fsModule?.word_count).toBeGreaterThan(0);
    });

    test('getModuleInfo returns detailed module information', async () => {
      const moduleInfo = await client!.getModuleInfo('fs');

      expect(moduleInfo.name).toBe('fs');
      expect(moduleInfo.description).toContain('fs');
      expect(Array.isArray(moduleInfo.words)).toBe(true);
      expect(moduleInfo.words.length).toBeGreaterThan(0);

      // Check that words have required fields
      const firstWord = moduleInfo.words[0];
      expect(firstWord).toHaveProperty('name');
      expect(firstWord).toHaveProperty('stack_effect');
      expect(firstWord).toHaveProperty('description');
    });

    test('getModuleInfo throws error for non-existent module', async () => {
      await expect(client!.getModuleInfo('nonexistent_module'))
        .rejects.toThrow();
    });
  });

  describe('Word Execution', () => {
    test('executeWord with standard library word', async () => {
      // Test: 1 2 +
      const stack = [1, 2];
      const result = await client!.executeWord('+', stack);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(3);
    });

    test('executeWord with array operations', async () => {
      // Test: [1 2 3] "2 *" MAP
      const stack = [[1, 2, 3], '2 *'];
      const result = await client!.executeWord('MAP', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual([2, 4, 6]);
    });

    test('executeWord with record operations', async () => {
      // Test: {"name": "Alice", "age": 30} "name" REC@
      const stack = [{ name: 'Alice', age: 30 }, 'name'];
      const result = await client!.executeWord('REC@', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toBe('Alice');
    });

    test('executeWord throws error for unknown word', async () => {
      await expect(client!.executeWord('UNKNOWN_WORD', []))
        .rejects.toThrow();
    });

    test('executeWord throws error for stack underflow', async () => {
      // Try to add with empty stack
      await expect(client!.executeWord('+', []))
        .rejects.toThrow();
    });
  });

  describe('Sequence Execution', () => {
    test('executeSequence runs multiple words in order', async () => {
      // Test sequence execution: First '-' then '/'
      // Stack starts: [10, 5, 2]
      // After '-': pops 2, pops 5, pushes (5-2)=3 => [10, 3]
      // After '/': pops 3, pops 10, pushes (10/3)=3.333... => [3.333...]
      const words = ['-', '/'];
      const stack = [10, 5, 2];
      const result = await client!.executeSequence(words, stack);

      expect(result.length).toBe(1);
      expect(result[0]).toBeCloseTo(3.333, 2); // Use toBeCloseTo for floats
    });

    test('executeSequence with array transformations', async () => {
      // Test: [1 2 3] "2 *" MAP => [2, 4, 6]
      const words = ['MAP'];
      const stack = [[1, 2, 3], '2 *'];
      const result = await client!.executeSequence(words, stack);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual([2, 4, 6]);
    });

    test('executeSequence with empty word list returns original stack', async () => {
      const words: string[] = [];
      const stack = [1, 2, 3];
      const result = await client!.executeSequence(words, stack);

      expect(result).toEqual(stack);
    });

    test('executeSequence stops on error', async () => {
      // Second word will fail
      const words = ['+', 'UNKNOWN_WORD'];
      const stack = [1, 2];

      await expect(client!.executeSequence(words, stack))
        .rejects.toThrow();
    });
  });

  describe('Type Serialization', () => {
    test('handles null values', async () => {
      const stack = [null, null];
      const result = await client!.executeWord('==', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(true);
    });

    test('handles boolean values', async () => {
      const stack = [true, false];
      const result = await client!.executeWord('OR', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(true);
    });

    test('handles nested arrays', async () => {
      const stack = [[[1, 2], [3, 4]]];
      const result = await client!.executeWord('FLATTEN', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual([1, 2, 3, 4]);
    });

    test('handles nested records', async () => {
      const stack = [
        {
          user: {
            name: 'Alice',
            address: { city: 'NYC' }
          }
        },
        'user'
      ];
      const result = await client!.executeWord('REC@', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ name: 'Alice', address: { city: 'NYC' } });
    });

    test('handles mixed type arrays', async () => {
      const stack = [[1, 'two', true, null, { key: 'value' }]];
      const result = await client!.executeWord('LENGTH', stack);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('remote error includes runtime information', async () => {
      try {
        await client!.executeWord('UNKNOWN_WORD', []);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('UNKNOWN_WORD');
        // The error should come from the TypeScript runtime
        expect(error.toString()).toContain('typescript');
      }
    });

    test('stack underflow error is descriptive', async () => {
      try {
        await client!.executeWord('+', [1]); // Need 2 values for +
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message.toLowerCase()).toContain('stack');
      }
    });
  });

  describe('Connection Management', () => {
    test('client can be closed and reopened', async () => {
      // Execute a word
      const result1 = await client!.executeWord('+', [1, 2]);
      expect(result1[0]).toBe(3);

      // Close client
      client!.close();

      // Create new client
      client = new GrpcClient(`localhost:${TEST_PORT}`);

      // Should still work
      const result2 = await client!.executeWord('+', [3, 4]);
      expect(result2[0]).toBe(7);
    });
  });
});
