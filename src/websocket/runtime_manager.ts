/**
 * WebSocketRuntimeManager - Singleton for managing WebSocket connections to remote runtimes
 *
 * Provides centralized access to WebSocket clients for different runtimes
 * Mirrors the gRPC RuntimeManager API for compatibility
 */
import { WebSocketClient, WebSocketClientConfig } from './client.js';

/**
 * WebSocketRuntimeManager - Manages WebSocket connections to remote Forthic runtimes
 */
export class WebSocketRuntimeManager {
  private static instance: WebSocketRuntimeManager | null = null;
  private clients: Map<string, WebSocketClient>;

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
   * @param url - WebSocket URL (e.g., "ws://localhost:3000/cable")
   * @param config - Optional additional configuration
   * @returns WebSocketClient instance
   */
  connectRuntime(
    runtimeName: string,
    url: string,
    config?: Partial<WebSocketClientConfig>
  ): WebSocketClient {
    // Create a new client for the runtime
    const client = new WebSocketClient({ url, ...config });

    // Register it
    this.clients.set(runtimeName, client);

    return client;
  }

  /**
   * Register a WebSocket client for a specific runtime
   *
   * @param runtimeName - Name of the runtime (e.g., "rails", "ruby")
   * @param client - WebSocketClient instance connected to that runtime
   */
  registerClient(runtimeName: string, client: WebSocketClient): void {
    this.clients.set(runtimeName, client);
  }

  /**
   * Get the WebSocket client for a specific runtime
   *
   * @param runtimeName - Name of the runtime
   * @returns WebSocketClient instance or undefined if not registered
   */
  getClient(runtimeName: string): WebSocketClient | undefined {
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
