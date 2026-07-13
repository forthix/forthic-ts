/**
 * RuntimeManager - Singleton for managing connections to remote runtimes
 *
 * Provides centralized access to remote runtime clients (python, ruby, etc.)
 * Used by DefinitionWord for batched remote execution.
 */
import type { RuntimeClient } from './runtime_client.js';

/**
 * RuntimeManager - Manages connections to remote Forthic runtimes
 */
export class RuntimeManager {
  private static instance: RuntimeManager | null = null;
  private clients: Map<string, RuntimeClient>;

  private constructor() {
    this.clients = new Map();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): RuntimeManager {
    if (!RuntimeManager.instance) {
      RuntimeManager.instance = new RuntimeManager();
    }
    return RuntimeManager.instance;
  }

  /**
   * Register a client for a specific runtime
   *
   * @param runtimeName - Name of the runtime (e.g., "python", "ruby")
   * @param client - RuntimeClient instance connected to that runtime
   */
  registerClient(runtimeName: string, client: RuntimeClient): void {
    this.clients.set(runtimeName, client);
  }

  /**
   * Get the runtime client for a specific runtime
   *
   * @param runtimeName - Name of the runtime
   * @returns RuntimeClient instance or undefined if not registered
   */
  getClient(runtimeName: string): RuntimeClient | undefined {
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
    if (RuntimeManager.instance) {
      RuntimeManager.instance.clearAll();
      RuntimeManager.instance = null;
    }
  }
}
