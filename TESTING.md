# Testing Guide

## Running Tests

```bash
npm test          # the whole suite
npm run test:watch
npm test -- array.test.ts               # a single file
npm test -- --testNamePattern="MAP"     # a single test
```

Every test runs by default. Nothing is skipped, and no test needs an external server: the tests that once required a live remote runtime were removed or rewritten against a stub client in v0.16.0, when the gRPC transport was dropped.

```bash
npm run smoke     # verifies the built package's export paths (run after npm run build)
```

## Test Organization

- **Unit tests**: `src/forthic/tests/unit/**/*.test.ts`
  - Core: tokenizer, literals, interpreter, decorators
  - Modules: array, boolean, core, datetime, json, math, record, string
  - Common: wire serializer, `RuntimeManager`, `ConfigLoader`
  - Transports: JSON-RPC server, WebSocket components

- **Integration tests**: `src/forthic/tests/integration/**/*.test.ts`
  - Self-contained: dot_symbol, interpreter_complete, streaming, standard_interpreter, string escapes/redirects
  - `jsonrpc_client.test.ts` starts a JSON-RPC server in-process on a loopback port — no external setup

## Writing Tests for Remote Runtimes

Do not reach for a live server. `RuntimeClient` is a small interface, so a stub implementation covers `RemoteModule`, `RemoteWord`, and `RuntimeManager`. See `src/forthic/tests/unit/common/runtime_manager.test.ts` for the pattern.
