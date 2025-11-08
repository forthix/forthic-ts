/**
 * WebSocketRuntimeManager - Singleton for managing ActionCable connections to remote runtimes
 *
 * Provides centralized access to ActionCable clients for different runtimes
 * Mirrors the gRPC RuntimeManager API for compatibility
 */
import { ActionCableClient, ActionCableClientConfig } from './client.js';

/**
 * WebSocketRuntimeManager - Manages ActionCable connections to remote Forthic runtimes
 */
export class WebSocketRuntimeManager {
  private static instance: WebSocketRuntimeManager | null = null;
  private clients: Map<string, ActionCableClient>;

  private constructor() {
    this.clients = new Map();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): WebSocketRuntimeManager {
    if (!WebSocketRuntimeManager.instance) {
      WebSocketRuntimeManager.instance = new WebSocketRuntimeManager();
    }
    return WebSocketRuntimeManager.instance;
  }

  /**
   * Connect to a runtime and register the client
   *
   * @param runtimeName - Name of the runtime (e.g., "rails", "ruby")
   * @param url - ActionCable URL (e.g., "ws://localhost:3000/cable")
   * @param config - Optional additional configuration
   * @returns ActionCableClient instance
   */
  connectRuntime(
    runtimeName: string,
    url: string,
    config?: Partial<ActionCableClientConfig>
  ): ActionCableClient {
    // Create a new client for the runtime
    const client = new ActionCableClient({ url, ...config });

    // Register it
    this.clients.set(runtimeName, client);

    return client;
  }

  /**
   * Register an ActionCable client for a specific runtime
   *
   * @param runtimeName - Name of the runtime (e.g., "rails", "ruby")
   * @param client - ActionCableClient instance connected to that runtime
   */
  registerClient(runtimeName: string, client: ActionCableClient): void {
    this.clients.set(runtimeName, client);
  }

  /**
   * Get the ActionCable client for a specific runtime
   *
   * @param runtimeName - Name of the runtime
   * @returns ActionCableClient instance or undefined if not registered
   */
  getClient(runtimeName: string): ActionCableClient | undefined {
    return this.clients.get(runtimeName);
  }

  /**
   * Check if a runtime has a registered client
   *
   * @param runtimeName - Name of the runtime
   * @returns True if client is registered
   */
  hasClient(runtimeName: string): boolean {
    return this.clients.has(runtimeName);
  }

  /**
   * Get all registered runtime names
   *
   * @returns Array of runtime names
   */
  getRegisteredRuntimes(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Disconnect a specific runtime
   *
   * @param runtimeName - Name of the runtime to disconnect
   */
  disconnectRuntime(runtimeName: string): void {
    const client = this.clients.get(runtimeName);
    if (client) {
      client.close();
      this.clients.delete(runtimeName);
    }
  }

  /**
   * Clear all registered clients (useful for testing)
   */
  clearAll(): void {
    // Close all clients
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    if (WebSocketRuntimeManager.instance) {
      WebSocketRuntimeManager.instance.clearAll();
      WebSocketRuntimeManager.instance = null;
    }
  }
}
