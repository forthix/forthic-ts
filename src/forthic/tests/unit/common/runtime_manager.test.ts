/**
 * RuntimeManager - singleton registry of remote runtime clients.
 *
 * Uses a stub RuntimeClient so these run without a live remote runtime.
 */

import { RuntimeManager } from '../../../../common/runtime_manager';
import type { RuntimeClient, ModuleSummary, GetModuleInfoResponse } from '../../../../common/runtime_client';

class StubClient implements RuntimeClient {
  closed = false;

  async executeWord(_wordName: string, stack: any[]): Promise<any[]> {
    return stack;
  }

  async executeSequence(_wordNames: string[], stack: any[]): Promise<any[]> {
    return stack;
  }

  async listModules(): Promise<ModuleSummary[]> {
    return [];
  }

  async getModuleInfo(moduleName: string): Promise<GetModuleInfoResponse> {
    return { name: moduleName, description: '', words: [] };
  }

  close(): void {
    this.closed = true;
  }
}

beforeEach(() => {
  RuntimeManager.reset();
});

afterEach(() => {
  RuntimeManager.reset();
});

describe('RuntimeManager', () => {
  test('is a singleton', () => {
    expect(RuntimeManager.getInstance()).toBe(RuntimeManager.getInstance());
  });

  test('registerClient makes the client retrievable', () => {
    const manager = RuntimeManager.getInstance();
    const client = new StubClient();

    expect(manager.hasClient('python')).toBe(false);

    manager.registerClient('python', client);

    expect(manager.hasClient('python')).toBe(true);
    expect(manager.getClient('python')).toBe(client);
  });

  test('getClient returns undefined for an unregistered runtime', () => {
    expect(RuntimeManager.getInstance().getClient('nobody')).toBeUndefined();
  });

  test('getRegisteredRuntimes returns all runtime names', () => {
    const manager = RuntimeManager.getInstance();
    manager.registerClient('python', new StubClient());
    manager.registerClient('ruby', new StubClient());

    expect(manager.getRegisteredRuntimes().sort()).toEqual(['python', 'ruby']);
  });

  test('clearAll closes every registered client', () => {
    const manager = RuntimeManager.getInstance();
    const python = new StubClient();
    const ruby = new StubClient();
    manager.registerClient('python', python);
    manager.registerClient('ruby', ruby);

    manager.clearAll();

    expect(python.closed).toBe(true);
    expect(ruby.closed).toBe(true);
    expect(manager.getRegisteredRuntimes()).toEqual([]);
  });

  test('reset drops the registry and the clients in it', () => {
    const manager = RuntimeManager.getInstance();
    const client = new StubClient();
    manager.registerClient('python', client);

    RuntimeManager.reset();

    expect(client.closed).toBe(true);
    expect(RuntimeManager.getInstance().hasClient('python')).toBe(false);
  });
});
