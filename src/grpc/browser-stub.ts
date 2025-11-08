/**
 * Browser stub for gRPC module
 * Provides helpful error messages when gRPC is imported in browser environments
 */

const BROWSER_ERROR =
  'gRPC is only available in Node.js environments. ' +
  'For browser-compatible multi-runtime execution, use @forthix/forthic/websocket instead. ' +
  'Example: import { ActionCableClient } from "@forthix/forthic/websocket"';

export class GrpcClient {
  constructor() {
    throw new Error(BROWSER_ERROR);
  }
}

export class RemoteModule {
  constructor() {
    throw new Error(BROWSER_ERROR);
  }
}

export class RuntimeManager {
  static getInstance() {
    throw new Error(BROWSER_ERROR);
  }
}

export class RemoteRuntimeError extends Error {
  constructor() {
    super(BROWSER_ERROR);
  }
}

export function startGrpcServer() {
  throw new Error(BROWSER_ERROR);
}

export class ConfigLoader {
  static async load() {
    throw new Error(BROWSER_ERROR);
  }
}

// Type exports (empty for browser)
export type ModuleSummary = never;
export type WordInfo = never;
export type GetModuleInfoResponse = never;
export type RuntimeConfig = never;
export type ForthicRuntimesConfig = never;
export type ConnectionSettings = never;
