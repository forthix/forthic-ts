/**
 * gRPC module for Node.js multi-runtime execution
 * Enables calling code from other language runtimes (Python, Ruby, etc.)
 *
 * Note: This module requires Node.js and will not work in browsers.
 * For browser-compatible multi-runtime execution, use @forthix/forthic/websocket
 */

export { GrpcClient } from './client.js';
export { serve as startGrpcServer } from './server.js';
export { RemoteModule } from './remote_module.js';
export { RuntimeManager } from './runtime_manager.js';
export { ConfigLoader } from './config_loader.js';
export { RemoteRuntimeError } from './errors.js';

// Type exports
export type { ModuleSummary, WordInfo, GetModuleInfoResponse } from './client.js';
export type { RuntimeConfig, ForthicRuntimesConfig, ConnectionSettings } from './config_loader.js';
