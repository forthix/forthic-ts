/**
 * Phase 5: Runtime Manager Integration Tests
 *
 * Tests for CONNECT-RUNTIME, USE-PY-MODULES, and USE-PY-MODULES-AS words
 *
 * Note: These tests verify that the words exist and work correctly,
 * but they will fail if no Python gRPC server is running. In a real
 * test environment, you would either:
 * 1. Mock the GrpcClient
 * 2. Start a test Python server
 * 3. Skip these tests in CI unless Python server is available
 */

import { StandardInterpreter } from '../../interpreter';
import { RuntimeManager } from '../../../grpc/runtime_manager';

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter();
  // Clean up runtime manager between tests
  RuntimeManager.reset();
});

afterEach(() => {
  // Clean up runtime manager after each test
  RuntimeManager.reset();
});

describe('Phase 5: Runtime Manager Module', () => {
  test('RemoteRuntimeModule is registered with StandardInterpreter', () => {
    // The RemoteRuntimeModule should be auto-registered
    const registeredModules = (interp as any).registered_modules;
    expect(registeredModules['remote_runtime']).toBeDefined();
  });

  test('CONNECT-RUNTIME word exists', async () => {
    // Should not throw an error when finding the word
    expect(() => {
      (interp as any).find_word('CONNECT-RUNTIME');
    }).not.toThrow();
  });

  test('USE-PY-MODULES word exists', async () => {
    // Should not throw an error when finding the word
    expect(() => {
      (interp as any).find_word('USE-PY-MODULES');
    }).not.toThrow();
  });

  test('USE-PY-MODULES-AS word exists', async () => {
    // Should not throw an error when finding the word
    expect(() => {
      (interp as any).find_word('USE-PY-MODULES-AS');
    }).not.toThrow();
  });

  test('CONNECT-RUNTIME registers client in RuntimeManager', async () => {
    const runtimeManager = RuntimeManager.getInstance();

    // Before connection, runtime should not be registered
    expect(runtimeManager.hasClient('python')).toBe(false);

    // Connect to a runtime
    await interp.run(`
      "python" "localhost:50051" CONNECT-RUNTIME
    `);

    // After CONNECT-RUNTIME, the client should be registered
    expect(runtimeManager.hasClient('python')).toBe(true);
  });

  test('CONNECT-RUNTIME prevents duplicate connections', async () => {
    await interp.run(`
      "python" "localhost:50051" CONNECT-RUNTIME
    `);

    // Attempting to connect to the same runtime name should throw an error
    await expect(async () => {
      await interp.run(`
        "python" "localhost:50052" CONNECT-RUNTIME
      `);
    }).rejects.toThrow(/already connected/);
  });

  test('USE-PY-MODULES fails if runtime not connected', async () => {
    // Attempting to use modules without connecting first should throw an error
    await expect(async () => {
      await interp.run(`
        ["math"] USE-PY-MODULES
      `);
    }).rejects.toThrow(/not connected/);
  });

  test('USE-PY-MODULES-AS fails if runtime not connected', async () => {
    // Attempting to use modules without connecting first should throw an error
    await expect(async () => {
      await interp.run(`
        ["math"] "m" USE-PY-MODULES-AS
      `);
    }).rejects.toThrow(/not connected/);
  });

  // Note: Full end-to-end tests that actually load Python modules
  // would require a running Python gRPC server. Those tests should
  // be in a separate integration test suite that conditionally runs
  // only when the server is available.
});

describe('Phase 5: RuntimeManager', () => {
  test('RuntimeManager is a singleton', () => {
    const instance1 = RuntimeManager.getInstance();
    const instance2 = RuntimeManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('RuntimeManager.connectRuntime creates and registers client', () => {
    const runtimeManager = RuntimeManager.getInstance();

    const client = runtimeManager.connectRuntime('test-runtime', 'localhost:50051');

    expect(client).toBeDefined();
    expect(runtimeManager.hasClient('test-runtime')).toBe(true);
    expect(runtimeManager.getClient('test-runtime')).toBe(client);
  });

  test('RuntimeManager.getRegisteredRuntimes returns all runtime names', () => {
    const runtimeManager = RuntimeManager.getInstance();

    runtimeManager.connectRuntime('python', 'localhost:50051');
    runtimeManager.connectRuntime('ruby', 'localhost:50052');

    const runtimes = runtimeManager.getRegisteredRuntimes();
    expect(runtimes).toContain('python');
    expect(runtimes).toContain('ruby');
    expect(runtimes.length).toBe(2);
  });

  test('RuntimeManager.reset clears all clients', () => {
    const runtimeManager = RuntimeManager.getInstance();

    runtimeManager.connectRuntime('python', 'localhost:50051');
    expect(runtimeManager.hasClient('python')).toBe(true);

    RuntimeManager.reset();

    // After reset, need to get new instance
    const newManager = RuntimeManager.getInstance();
    expect(newManager.hasClient('python')).toBe(false);
  });
});
