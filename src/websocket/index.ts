/**
 * WebSocket module for browser-compatible Forthic runtime communication
 *
 * Structure:
 * - Generic utilities: serializer, errors (protocol-agnostic)
 * - ActionCable-specific: action_cable/ subdirectory
 */

// Generic WebSocket utilities
export { serializeValue, deserializeValue, serializeStack, deserializeStack, type StackValue } from './serializer.js';
export { RemoteRuntimeError, type RemoteErrorInfo } from './errors.js';

// ActionCable-specific exports
export { ActionCableClient, type ActionCableClientConfig, type ModuleInfo, type ModuleSummary, type WordInfo, type ProgressUpdate } from './action_cable/index.js';
export { WebSocketRuntimeManager } from './action_cable/index.js';
export { WebSocketRemoteModule } from './action_cable/index.js';
export { WebSocketRemoteWord } from './action_cable/index.js';
