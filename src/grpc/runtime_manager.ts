/**
 * RuntimeManager - Singleton for managing gRPC connections to remote runtimes
 *
 * Provides centralized access to gRPC clients for different runtimes (python, ruby, etc.)
 * Used by DefinitionWord for batched remote execution.
 */
import { GrpcClient } from './client.js';

/**
 * RuntimeManager - Manages connections to remote Forthic runtimes
 */
export class RuntimeManager {
  private static instance: RuntimeManager | null = null;
  private clients: Map<string, GrpcClient>;

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
   * Connect to a runtime and register the client
   * Phase 5: Convenience method for CONNECT-RUNTIME word
   *
   * @param runtimeName - Name of the runtime (e.g., "python", "ruby")
   * @param address - Address of the runtime (e.g., "localhost:50051")
   * @returns GrpcClient instance
   */
  connectRuntime(runtimeName: string, address: string): GrpcClient {
    // Create a new client for the runtime
    const client = new GrpcClient(address);

    // Register it
    this.clients.set(runtimeName, client);

    return client;
  }

  /**
   * Register a gRPC client for a specific runtime
   *
   * @param runtimeName - Name of the runtime (e.g., "python", "ruby")
   * @param client - GrpcClient instance connected to that runtime
   */
  registerClient(runtimeName: string, client: GrpcClient): void {
    this.clients.set(runtimeName, client);
  }

  /**
   * Get the gRPC client for a specific runtime
   *
   * @param runtimeName - Name of the runtime
   * @returns GrpcClient instance or undefined if not registered
   */
  getClient(runtimeName: string): GrpcClient | undefined {
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
