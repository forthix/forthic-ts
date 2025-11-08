/**
 * WebSocketRemoteModule - Module that wraps runtime-specific words from a remote runtime
 * Mirrors RemoteModule from gRPC implementation
 */
import { Module } from '../../forthic/module.js';
import { Interpreter } from '../../forthic/interpreter.js';
import { ActionCableClient, type ModuleInfo } from './client.js';
import { WebSocketRemoteWord } from './remote_word.js';

/**
 * WebSocketRemoteModule - Module containing proxy words that execute in a remote runtime
 *
 * This module discovers words from a remote runtime (e.g., pandas module in Ruby)
 * and creates WebSocketRemoteWord proxies for each discovered word. When used in TypeScript
 * Forthic code, these words execute in the remote runtime via ActionCable.
 *
 * Example usage:
 * ```typescript
 * const client = new ActionCableClient({ url: 'ws://localhost:3000/cable' });
 * const pandasModule = new WebSocketRemoteModule('pandas', client, 'rails');
 * await pandasModule.initialize();
 * interp.register_module(pandasModule);
 * interp.use_modules(['pandas']);
 *
 * // Now pandas words execute in Rails runtime
 * await interp.run(`
 *   [ [[.name "Alice"]  [.age 30]] REC]
 *   DF-FROM-RECORDS  # Executes in Rails!
 * `);
 * ```
 */
export class WebSocketRemoteModule extends Module {
  private client: ActionCableClient;
  private runtimeName: string;
  private initialized: boolean = false;
  private moduleInfo: ModuleInfo | null = null;

  /**
   * @param moduleName - Name of the module in the remote runtime (e.g., "pandas")
   * @param client - ActionCable client connected to the remote runtime
   * @param runtimeName - Name of the runtime (e.g., "rails") for debugging
   */
  constructor(moduleName: string, client: ActionCableClient, runtimeName: string = 'remote') {
    super(moduleName);
    this.client = client;
    this.runtimeName = runtimeName;
  }

  /**
   * Initialize the module by discovering words from the remote runtime
   *
   * This must be called before the module is registered with an interpreter.
   * It fetches the module metadata and creates WebSocketRemoteWord proxies for each word.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Discover module info from remote runtime
      this.moduleInfo = await this.client.getModuleInfo(this.name);

      // Create WebSocketRemoteWord for each discovered word
      for (const wordInfo of this.moduleInfo.words) {
        const remoteWord = new WebSocketRemoteWord(
          wordInfo.name,
          this.client,
          this.runtimeName,
          this.name,
          wordInfo.stack_effect,
          wordInfo.description
        );

        // Add as exportable word (visible when module is imported)
        this.add_exportable_word(remoteWord);
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize remote module '${this.name}' from ${this.runtimeName} runtime: ${(error as Error).message}`
      );
    }
  }

  /**
   * Override set_interp to ensure module is initialized
   */
  set_interp(interp: Interpreter): void {
    if (!this.initialized) {
      throw new Error(
        `WebSocketRemoteModule '${this.name}' must be initialized before being registered with an interpreter. Call await module.initialize() first.`
      );
    }
    super.set_interp(interp);
  }

  /**
   * Get the module metadata from the remote runtime
   */
  getModuleInfo(): ModuleInfo | null {
    return this.moduleInfo;
  }

  /**
   * Get runtime name for debugging
   */
  getRuntimeName(): string {
    return this.runtimeName;
  }

  /**
   * Check if module is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get count of discovered words
   */
  getWordCount(): number {
    return this.moduleInfo?.words?.length || 0;
  }
}
