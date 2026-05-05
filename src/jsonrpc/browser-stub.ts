/**
 * Browser stub for the JSON-RPC server. The JsonRpcClient itself is
 * fetch-based and works in browsers, but the server depends on Node's
 * `http` module and is unavailable in browser bundles.
 */

const BROWSER_SERVER_ERROR =
  'startJsonRpcServer is only available in Node.js environments.';

export function startJsonRpcServer(): never {
  throw new Error(BROWSER_SERVER_ERROR);
}

export { JsonRpcClient } from './client.js';
export { JsonRpcErrorCode } from './errors.js';
