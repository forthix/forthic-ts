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
export { RemoteRuntimeError } from '../grpc/errors.js';

// Reuse existing pieces: they already accept any RuntimeClient implementation.
export { RemoteModule } from '../grpc/remote_module.js';
export { RuntimeManager } from '../grpc/runtime_manager.js';
export { ConfigLoader } from '../grpc/config_loader.js';

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
} from '../grpc/config_loader.js';
