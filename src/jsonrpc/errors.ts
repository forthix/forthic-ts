/**
 * JSON-RPC error types — reuses gRPC's RemoteRuntimeError + parseErrorInfo
 * for the structured `data` payload of code -32000 responses.
 */
export {
  RemoteRuntimeError,
  parseErrorInfo,
  type RemoteErrorInfo,
} from '../common/errors.js';

/** JSON-RPC standard error codes plus our custom server-defined codes. */
export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  /** Forthic runtime error — `data` carries the full ErrorInfo. */
  RuntimeError: -32000,
  /** Unknown module name passed to getModuleInfo. */
  ModuleNotFound: -32001,
} as const;

export type JsonRpcErrorCodeValue =
  (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode];
