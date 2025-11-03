/**
 * Phase 11.1 & 11.2: TypeScript gRPC Server Tests
 * Tests server foundation and stack execution
 */
import { serve } from '../../../../grpc/server.js';
import { serializeValue, deserializeValue } from '../../../../grpc/serializer.js';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

describe('TypeScript gRPC Server', () => {
  let server: grpc.Server | null = null;
  let client: any = null;
  const TEST_PORT = 50053; // Use different port to avoid conflicts

  // Helper to load proto and create client
  const createClient = () => {
    const possiblePaths = [
      path.join(__dirname, '../../../../forthic/protos/forthic_runtime.proto'),
      path.join(__dirname, '../../../forthic/protos/forthic_runtime.proto'),
      path.join(process.cwd(), '../forthic/protos/forthic_runtime.proto'),
    ];

    let PROTO_PATH = possiblePaths[0];
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

    return new forthicProto.ForthicRuntime(
      `localhost:${TEST_PORT}`,
      grpc.credentials.createInsecure()
    );
  };

  beforeEach(async () => {
    // Start server before each test
    server = await serve(TEST_PORT);
    client = createClient();
  });

  afterEach(async () => {
    // Clean up client and server
    if (client) {
      grpc.closeClient(client);
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

  describe('Phase 11.1: Server Foundation', () => {
    test('server starts and listens on specified port', async () => {
      // Test that we can connect by calling ListModules
      const response = await new Promise<any>((resolve, reject) => {
        client.ListModules({}, (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });

      // Should succeed with empty module list (no TS-specific modules yet)
      expect(response).toBeDefined();
      expect(response.modules).toBeDefined();
      expect(Array.isArray(response.modules)).toBe(true);
    });
  });

  describe('Phase 11.2: Stack Execution - Basic stdlib words', () => {
    test('DUP - duplicates top stack item', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'DUP',
            stack: [serializeValue(42)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      expect(resultStack).toEqual([42, 42]);
    });

    test('SWAP - swaps top two items', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'SWAP',
            stack: [serializeValue(1), serializeValue(2)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      expect(resultStack).toEqual([2, 1]);
    });

    test('+ - adds two numbers', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: '+',
            stack: [serializeValue(10), serializeValue(32)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      expect(resultStack).toEqual([42]);
    });

    test('REVERSE - reverses an array', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'REVERSE',
            stack: [serializeValue([1, 2, 3])],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      expect(resultStack).toEqual([[3, 2, 1]]);
    });
  });

  describe('Phase 11.2: executeSequenceWithStack - Multiple words', () => {
    test('Execute DUP then + in sequence', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteSequence(
          {
            word_names: ['DUP', '+'],
            stack: [serializeValue(21)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      // 21 DUP gives [21, 21], then + gives [42]
      expect(resultStack).toEqual([42]);
    });

    test('Execute complex sequence with array operations', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteSequence(
          {
            word_names: ['REVERSE', 'DUP'],
            stack: [serializeValue([1, 2, 3])],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      // REVERSE gives [[3,2,1]], DUP duplicates it
      expect(resultStack).toEqual([[3, 2, 1], [3, 2, 1]]);
    });
  });

  describe('Phase 11.2: Error handling with ErrorInfo', () => {
    test('Captures error when word not found', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'NONEXISTENT_WORD',
            stack: [],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('NONEXISTENT_WORD');
      expect(response.error.runtime).toBe('typescript');
      expect(response.error.error_type).toBeDefined();
      expect(response.error.stack_trace).toBeDefined();
      expect(response.error.stack_trace.length).toBeGreaterThan(0);
    });

    test('Captures error when stack underflow', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: '+',
            stack: [serializeValue(1)], // Need 2 items for +
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeDefined();
      expect(response.error.runtime).toBe('typescript');
      expect(response.error.stack_trace).toBeDefined();
    });

    test('Preserves error context with word name', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'BAD_WORD',
            stack: [],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeDefined();
      expect(response.error.context).toBeDefined();
      expect(response.error.context.word_name).toBe('BAD_WORD');
    });

    test('Captures error in sequence execution', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteSequence(
          {
            word_names: ['DUP', 'INVALID_WORD', '+'],
            stack: [serializeValue(42)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeDefined();
      expect(response.error.runtime).toBe('typescript');
      expect(response.error.context).toBeDefined();
      expect(response.error.context.word_sequence).toContain('INVALID_WORD');
    });
  });

  describe('Phase 11.2: Stack state transfer', () => {
    test('Complex types serialize/deserialize correctly', async () => {
      const complexStack = [
        serializeValue({ name: 'Alice', age: 30 }),
        serializeValue([1, 2, 3]),
        serializeValue('hello'),
        serializeValue(42),
      ];

      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'DUP',
            stack: complexStack,
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      // DUP duplicates the top item (42)
      expect(resultStack).toEqual([
        { name: 'Alice', age: 30 },
        [1, 2, 3],
        'hello',
        42,
        42,
      ]);
    });

    test('Empty stack execution', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'NULL',
            stack: [],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response.error).toBeUndefined();
      const resultStack = response.result_stack.map((v: any) => deserializeValue(v));
      expect(resultStack).toEqual([null]);
    });
  });

  describe('Phase 11.2: Isolation between requests', () => {
    test('Multiple requests do not share state', async () => {
      // First request
      const response1 = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'DUP',
            stack: [serializeValue(100)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      // Second request - should not see state from first
      const response2 = await new Promise<any>((resolve, reject) => {
        client.ExecuteWord(
          {
            word_name: 'DUP',
            stack: [serializeValue(200)],
          },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      const result1 = response1.result_stack.map((v: any) => deserializeValue(v));
      const result2 = response2.result_stack.map((v: any) => deserializeValue(v));

      expect(result1).toEqual([100, 100]);
      expect(result2).toEqual([200, 200]);
    });
  });

  describe('Phase 11.3: Module Discovery', () => {
    test('ListModules returns TS-specific modules only', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.ListModules({}, (error: grpc.ServiceError | null, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });

      expect(response).toBeDefined();
      expect(response.modules).toBeDefined();
      expect(Array.isArray(response.modules)).toBe(true);

      // Should have the fs module
      expect(response.modules.length).toBeGreaterThan(0);

      const fsModule = response.modules.find((m: any) => m.name === 'fs');
      expect(fsModule).toBeDefined();
      expect(fsModule.description).toContain('TypeScript-specific');
      expect(fsModule.runtime_specific).toBe(true);
      expect(fsModule.word_count).toBeGreaterThan(0);

      // Should NOT include standard library modules
      const stdlibModules = ['array', 'record', 'string', 'math', 'datetime', 'json', 'boolean', 'core'];
      for (const stdModule of stdlibModules) {
        const found = response.modules.find((m: any) => m.name === stdModule);
        expect(found).toBeUndefined();
      }
    });

    test('GetModuleInfo returns detailed word metadata for fs module', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.GetModuleInfo(
          { module_name: 'fs' },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(response).toBeDefined();
      expect(response.name).toBe('fs');
      expect(response.description).toContain('TypeScript-specific');
      expect(response.words).toBeDefined();
      expect(Array.isArray(response.words)).toBe(true);
      expect(response.words.length).toBeGreaterThan(0);

      // Check for specific words
      const fileExists = response.words.find((w: any) => w.name === 'FILE-EXISTS?');
      expect(fileExists).toBeDefined();
      expect(fileExists.stack_effect).toBe('( path:string -- exists:boolean )');
      expect(fileExists.description).toContain('file exists');

      const readFile = response.words.find((w: any) => w.name === 'READ-FILE');
      expect(readFile).toBeDefined();
      expect(readFile.stack_effect).toBe('( path:string -- content:string )');
      expect(readFile.description).toContain('Read file');

      const writeFile = response.words.find((w: any) => w.name === 'WRITE-FILE');
      expect(writeFile).toBeDefined();
      expect(writeFile.stack_effect).toBe('( path:string content:string -- )');
      expect(writeFile.description).toContain('Write');

      // Verify all words have required metadata
      for (const word of response.words) {
        expect(word.name).toBeDefined();
        expect(word.stack_effect).toBeDefined();
        expect(word.description).toBeDefined();
        expect(word.stack_effect).toMatch(/\(/);  // Stack effect should have parentheses
      }
    });

    test('GetModuleInfo returns error for non-existent module', async () => {
      const response = await new Promise<any>((resolve, reject) => {
        client.GetModuleInfo(
          { module_name: 'nonexistent_module' },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              resolve({ error });
            } else {
              reject(new Error('Should have returned error'));
            }
          }
        );
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(grpc.status.NOT_FOUND);
      expect(response.error.message).toContain('not found');
    });

    test('GetModuleInfo returns error for standard library module', async () => {
      // Standard library modules should not be in runtimeModules
      const response = await new Promise<any>((resolve, reject) => {
        client.GetModuleInfo(
          { module_name: 'array' },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              resolve({ error });
            } else {
              reject(new Error('Should have returned error for stdlib module'));
            }
          }
        );
      });

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(grpc.status.NOT_FOUND);
    });

    test('Word count in ModuleSummary matches actual words', async () => {
      const listResponse = await new Promise<any>((resolve, reject) => {
        client.ListModules({}, (error: grpc.ServiceError | null, response: any) => {
          if (error) reject(error);
          else resolve(response);
        });
      });

      const fsModule = listResponse.modules.find((m: any) => m.name === 'fs');
      expect(fsModule).toBeDefined();
      const wordCount = fsModule.word_count;

      const infoResponse = await new Promise<any>((resolve, reject) => {
        client.GetModuleInfo(
          { module_name: 'fs' },
          (error: grpc.ServiceError | null, response: any) => {
            if (error) reject(error);
            else resolve(response);
          }
        );
      });

      expect(infoResponse.words.length).toBe(wordCount);
    });
  });
});
