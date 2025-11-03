/**
 * WebSocket Client for Forthic
 * Browser-compatible client that mirrors GrpcClient API
 * Connects to Rails ActionCable server and executes remote words
 */

import { serializeStack, deserializeStack, StackValue } from './serializer.js';
import { RemoteRuntimeError } from './errors.js';

// Message types matching the WebSocket protocol
interface BaseMessage {
  type: string;
  id: string;
}

interface ExecuteWordRequest extends BaseMessage {
  type: 'execute_word';
  params: {
    word: string;
    stack: StackValue[];
  };
}

interface ExecuteSequenceRequest extends BaseMessage {
  type: 'execute_sequence';
  params: {
    words: string[];
    stack: StackValue[];
  };
}

interface ListModulesRequest extends BaseMessage {
  type: 'list_modules';
}

interface GetModuleInfoRequest extends BaseMessage {
  type: 'get_module_info';
  params: {
    module_name: string;
  };
}

interface StreamingExecuteRequest extends BaseMessage {
  type: 'streaming_execute';
  params: {
    code: string;
    stack: StackValue[];
  };
}

interface BaseResponse {
  type: string;
  id: string;
  error?: {
    message: string;
    error_type?: string;
    stack_trace?: string[];
    module_name?: string;
    context?: Record<string, string>;
  };
}

interface ExecuteWordResponse extends BaseResponse {
  type: 'execute_word_response';
  result?: {
    stack: StackValue[];
  };
}

interface ExecuteSequenceResponse extends BaseResponse {
  type: 'execute_sequence_response';
  result?: {
    stack: StackValue[];
  };
}

export interface ModuleSummary {
  name: string;
  description: string;
  word_count: number;
}

interface ListModulesResponse extends BaseResponse {
  type: 'list_modules_response';
  result?: {
    modules: ModuleSummary[];
  };
}

export interface WordInfo {
  name: string;
  stack_effect: string;
  description: string;
}

export interface ModuleInfo {
  module_name: string;
  words: WordInfo[];
}

interface GetModuleInfoResponse extends BaseResponse {
  type: 'get_module_info_response';
  result?: ModuleInfo;
}

export interface ProgressUpdate {
  step: number;
  total_steps: number;
  current_word: string;
  message?: string;
  partial_stack?: StackValue[];
}

interface StreamingProgressResponse extends BaseResponse {
  type: 'streaming_progress';
  progress: ProgressUpdate;
}

interface StreamingExecuteResponse extends BaseResponse {
  type: 'streaming_execute_response';
  result?: {
    stack: StackValue[];
  };
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: ProgressUpdate) => void;
}

export interface WebSocketClientConfig {
  url: string;              // ws://localhost:3000/cable
  timezone?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  channel?: string;         // ActionCable channel name
}

/**
 * WebSocket client for executing words in remote Forthic runtimes
 * Mirrors the GrpcClient API for compatibility
 */
export class WebSocketClient {
  private ws?: WebSocket;
  private config: Required<WebSocketClientConfig>;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageId: number = 0;
  private connected: boolean = false;
  private connectionPromise?: Promise<void>;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      timezone: config.timezone || 'UTC',
      reconnect: config.reconnect ?? true,
      reconnectDelay: config.reconnectDelay || 3000,
      channel: config.channel || 'ForthicRuntimeChannel',
    };

    this.connect();
  }

  /**
   * Connect to the WebSocket server
   */
  private connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          this.connected = true;

          // Subscribe to ActionCable channel
          const subscribeMessage = {
            command: 'subscribe',
            identifier: JSON.stringify({
              channel: this.config.channel,
              timezone: this.config.timezone,
            }),
          };
          this.ws!.send(JSON.stringify(subscribeMessage));

          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error: Event) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection error'));
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.connectionPromise = undefined;

          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests.entries()) {
            pending.reject(new Error('WebSocket connection closed'));
          }
          this.pendingRequests.clear();

          // Attempt reconnect if enabled
          if (this.config.reconnect) {
            setTimeout(() => this.connect(), this.config.reconnectDelay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // Handle ActionCable control messages
      if (data.type === 'welcome' || data.type === 'ping' || data.type === 'confirm_subscription') {
        return;
      }

      // Extract the actual message from ActionCable envelope
      const message = data.message || data;

      if (!message.id) {
        console.warn('Received message without ID:', message);
        return;
      }

      // Handle streaming progress updates
      if (message.type === 'streaming_progress') {
        const pending = this.pendingRequests.get(message.id);
        if (pending?.onProgress) {
          pending.onProgress(message.progress);
        }
        return;
      }

      // Handle final responses
      const pending = this.pendingRequests.get(message.id);
      if (!pending) {
        console.warn('Received response for unknown request:', message.id);
        return;
      }

      if (message.error) {
        pending.reject(new RemoteRuntimeError(message.error));
      } else {
        pending.resolve(message.result);
      }

      this.pendingRequests.delete(message.id);
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Generate next message ID
   */
  private nextMessageId(): string {
    return `msg-${++this.messageId}-${Date.now()}`;
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest(message: any): Promise<any> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });

      // Wrap message in ActionCable format
      const actionCableMessage = {
        command: 'message',
        identifier: JSON.stringify({
          channel: this.config.channel,
        }),
        data: JSON.stringify(message),
      };

      this.ws!.send(JSON.stringify(actionCableMessage));
    });
  }

  /**
   * Send a streaming request with progress callbacks
   */
  private async sendStreamingRequest(
    message: any,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<any> {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject, onProgress });

      // Wrap message in ActionCable format
      const actionCableMessage = {
        command: 'message',
        identifier: JSON.stringify({
          channel: this.config.channel,
        }),
        data: JSON.stringify(message),
      };

      this.ws!.send(JSON.stringify(actionCableMessage));
    });
  }

  /**
   * Ensure WebSocket is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  /**
   * Execute a word in the remote runtime
   * Mirrors GrpcClient.executeWord
   */
  async executeWord(word: string, stack: any[]): Promise<any[]> {
    const message: ExecuteWordRequest = {
      type: 'execute_word',
      id: this.nextMessageId(),
      params: {
        word,
        stack: serializeStack(stack),
      },
    };

    const result = await this.sendRequest(message);
    return deserializeStack(result.stack);
  }

  /**
   * Execute a sequence of words (batched execution)
   * Mirrors GrpcClient.executeSequence
   */
  async executeSequence(words: string[], stack: any[]): Promise<any[]> {
    const message: ExecuteSequenceRequest = {
      type: 'execute_sequence',
      id: this.nextMessageId(),
      params: {
        words,
        stack: serializeStack(stack),
      },
    };

    const result = await this.sendRequest(message);
    return deserializeStack(result.stack);
  }

  /**
   * List available runtime-specific modules
   * Mirrors GrpcClient.listModules
   */
  async listModules(): Promise<ModuleSummary[]> {
    const message: ListModulesRequest = {
      type: 'list_modules',
      id: this.nextMessageId(),
    };

    const result = await this.sendRequest(message);
    return result.modules || [];
  }

  /**
   * Get detailed information about a specific module
   * Mirrors GrpcClient.getModuleInfo
   */
  async getModuleInfo(moduleName: string): Promise<ModuleInfo> {
    const message: GetModuleInfoRequest = {
      type: 'get_module_info',
      id: this.nextMessageId(),
      params: {
        module_name: moduleName,
      },
    };

    return await this.sendRequest(message);
  }

  /**
   * Execute code with streaming progress updates (NEW capability)
   */
  async streamingExecute(
    code: string,
    stack: any[],
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<any[]> {
    const message: StreamingExecuteRequest = {
      type: 'streaming_execute',
      id: this.nextMessageId(),
      params: {
        code,
        stack: serializeStack(stack),
      },
    };

    const result = await this.sendStreamingRequest(message, onProgress);
    return deserializeStack(result.stack);
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.config.reconnect = false; // Disable auto-reconnect
      this.ws.close();
      this.ws = undefined;
      this.connected = false;
    }
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
