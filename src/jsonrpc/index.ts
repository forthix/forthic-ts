/**
 * JSON-RPC module for Node.js multi-runtime execution.
 * Server uses Node's built-in http; client uses global fetch (Node ≥18).
 *
 * Mirrors @forthix/forthic/grpc surface so RuntimeManager / RemoteModule /
 * RemoteWord work transparently against either transport.
 */

export { JsonRpcClient } from './client.js';
export { serve as startJsonRpcServer } from './server.js';
export type { ServeOptions } from './server.js';
export { JsonRpcErrorCode } from './errors.js';
export { RemoteRuntimeError } from '../common/errors.js';

// Reuse existing pieces: they already accept any RuntimeClient implementation.
export { RemoteModule } from '../common/remote_module.js';
export { RuntimeManager } from '../common/runtime_manager.js';
export { ConfigLoader } from '../common/config_loader.js';

export type {
  ModuleSummary,
  WordInfo,
  GetModuleInfoResponse,
  RuntimeClient,
} from '../common/runtime_client.js';
export type {
  RuntimeConfig,
  ForthicRuntimesConfig,
  ConnectionSettings,
  RuntimeTransport,
} from '../common/config_loader.js';
