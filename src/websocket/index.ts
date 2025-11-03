/**
 * WebSocket module for browser-compatible Forthic runtime communication
 * Exports all WebSocket-related components
 */

export { WebSocketClient, type WebSocketClientConfig, type ModuleInfo, type ModuleSummary, type WordInfo, type ProgressUpdate } from './client.js';
export { WebSocketRuntimeManager } from './runtime_manager.js';
export { WebSocketRemoteModule } from './remote_module.js';
export { WebSocketRemoteWord } from './remote_word.js';
export { serializeValue, deserializeValue, serializeStack, deserializeStack, type StackValue } from './serializer.js';
export { RemoteRuntimeError, type RemoteErrorInfo } from './errors.js';
