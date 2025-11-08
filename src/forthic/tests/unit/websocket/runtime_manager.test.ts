/**
 * Unit tests for WebSocket RuntimeManager
 */
import { WebSocketRuntimeManager } from '../../../../websocket/action_cable/runtime_manager.js';
import { ActionCableClient } from '../../../../websocket/action_cable/client.js';

// Mock ActionCableClient
jest.mock('../../../../websocket/action_cable/client.js');

describe('WebSocketRuntimeManager', () => {
  let manager: WebSocketRuntimeManager;

  beforeEach(() => {
    // Reset the singleton before each test
    WebSocketRuntimeManager.reset();
    manager = WebSocketRuntimeManager.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    WebSocketRuntimeManager.reset();
  });

  test('getInstance returns singleton', () => {
    const instance1 = WebSocketRuntimeManager.getInstance();
    const instance2 = WebSocketRuntimeManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('connectRuntime creates and registers client', () => {
    const client = manager.connectRuntime('rails', 'ws://localhost:3000/cable');

    expect(ActionCableClient).toHaveBeenCalledWith({ url: 'ws://localhost:3000/cable' });
    expect(manager.hasClient('rails')).toBe(true);
    expect(manager.getClient('rails')).toBe(client);
  });

  test('connectRuntime with config options', () => {
    const config = { timezone: 'America/New_York', reconnect: false };
    const client = manager.connectRuntime('rails', 'ws://localhost:3000/cable', config);

    expect(ActionCableClient).toHaveBeenCalledWith({
      url: 'ws://localhost:3000/cable',
      timezone: 'America/New_York',
      reconnect: false,
    });
    expect(manager.getClient('rails')).toBe(client);
  });

  test('registerClient manually registers a client', () => {
    const mockClient = new ActionCableClient({ url: 'ws://test:3000/cable' });
    manager.registerClient('custom', mockClient);

    expect(manager.hasClient('custom')).toBe(true);
    expect(manager.getClient('custom')).toBe(mockClient);
  });

  test('getClient returns undefined for non-existent runtime', () => {
    expect(manager.getClient('nonexistent')).toBeUndefined();
  });

  test('hasClient returns false for non-existent runtime', () => {
    expect(manager.hasClient('nonexistent')).toBe(false);
  });

  test('getRegisteredRuntimes returns all runtime names', () => {
    manager.connectRuntime('rails1', 'ws://localhost:3000/cable');
    manager.connectRuntime('rails2', 'ws://localhost:3001/cable');

    const runtimes = manager.getRegisteredRuntimes();
    expect(runtimes).toHaveLength(2);
    expect(runtimes).toContain('rails1');
    expect(runtimes).toContain('rails2');
  });

  test('disconnectRuntime closes and removes client', () => {
    const mockClient = new ActionCableClient({ url: 'ws://test:3000/cable' });
    const closeSpy = jest.spyOn(mockClient, 'close');

    manager.registerClient('test', mockClient);
    expect(manager.hasClient('test')).toBe(true);

    manager.disconnectRuntime('test');
    expect(closeSpy).toHaveBeenCalled();
    expect(manager.hasClient('test')).toBe(false);
  });

  test('disconnectRuntime handles non-existent runtime gracefully', () => {
    expect(() => manager.disconnectRuntime('nonexistent')).not.toThrow();
  });

  test('clearAll closes all clients', () => {
    const mockClient1 = new ActionCableClient({ url: 'ws://test1:3000/cable' });
    const mockClient2 = new ActionCableClient({ url: 'ws://test2:3000/cable' });
    const closeSpy1 = jest.spyOn(mockClient1, 'close');
    const closeSpy2 = jest.spyOn(mockClient2, 'close');

    manager.registerClient('runtime1', mockClient1);
    manager.registerClient('runtime2', mockClient2);

    manager.clearAll();

    expect(closeSpy1).toHaveBeenCalled();
    expect(closeSpy2).toHaveBeenCalled();
    expect(manager.getRegisteredRuntimes()).toHaveLength(0);
  });

  test('reset clears singleton instance', () => {
    const instance1 = WebSocketRuntimeManager.getInstance();
    instance1.connectRuntime('rails', 'ws://localhost:3000/cable');

    WebSocketRuntimeManager.reset();

    const instance2 = WebSocketRuntimeManager.getInstance();
    expect(instance2).not.toBe(instance1);
    expect(instance2.getRegisteredRuntimes()).toHaveLength(0);
  });
});
