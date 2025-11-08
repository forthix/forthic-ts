/**
 * WebSocketRemoteWord - Word that executes in a remote runtime via ActionCable
 * Mirrors RemoteWord from gRPC implementation
 */
import { Word, RuntimeInfo } from '../../forthic/module.js';
import { Interpreter } from '../../forthic/interpreter.js';
import { ActionCableClient } from './client.js';

/**
 * WebSocketRemoteWord - Proxy word that delegates execution to a remote runtime
 *
 * When executed:
 * 1. Captures current interpreter stack
 * 2. Sends word name + stack to remote runtime via ActionCable
 * 3. Replaces local stack with result stack from remote execution
 *
 * This allows seamless integration of remote runtime words
 * into the local TypeScript interpreter.
 */
export class WebSocketRemoteWord extends Word {
  private client: ActionCableClient;
  private runtimeName: string;
  private moduleName: string;
  public stackEffect: string;
  public description: string;

  /**
   * @param name - Word name (e.g., "DF_FROM_RECORDS")
   * @param client - ActionCable client connected to remote runtime
   * @param runtimeName - Name of remote runtime (e.g., "rails", "ruby")
   * @param moduleName - Module name (e.g., "pandas")
   * @param stackEffect - Stack notation (e.g., "( records:array -- df:DataFrame )")
   * @param description - Human-readable description
   */
  constructor(
    name: string,
    client: ActionCableClient,
    runtimeName: string,
    moduleName: string,
    stackEffect: string = '( -- )',
    description: string = ''
  ) {
    super(name);
    this.client = client;
    this.runtimeName = runtimeName;
    this.moduleName = moduleName;
    this.stackEffect = stackEffect;
    this.description = description;
  }

  /**
   * Execute word in remote runtime
   *
   * Captures entire stack, sends to remote runtime, and replaces stack with result.
   */
  async execute(interp: Interpreter): Promise<void> {
    try {
      // Capture current stack state
      const stack = interp.get_stack();
      const stackItems = stack.get_items();

      // Execute word in remote runtime
      const resultStack = await this.client.executeWord(this.name, stackItems);

      // Clear local stack and replace with result
      while (interp.get_stack().length > 0) {
        interp.stack_pop();
      }

      // Push all result items
      for (const item of resultStack) {
        interp.stack_push(item);
      }
    } catch (error) {
      throw new Error(
        `Error executing remote word ${this.moduleName}.${this.name} in ${this.runtimeName} runtime: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get runtime name for debugging/introspection
   */
  getRuntimeName(): string {
    return this.runtimeName;
  }

  /**
   * Get module name for debugging/introspection
   */
  getModuleName(): string {
    return this.moduleName;
  }

  /**
   * Get runtime execution information
   * RemoteWords are runtime-specific and can only execute in their designated runtime
   */
  getRuntimeInfo(): RuntimeInfo {
    return {
      runtime: this.runtimeName,
      isRemote: true,
      isStandard: false,
      availableIn: [this.runtimeName]
    };
  }
}
