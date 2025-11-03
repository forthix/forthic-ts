# Testing Guide

This project separates unit tests from integration tests that require external servers.

## Running Tests

### Unit Tests (Default)
```bash
npm test
# or
npm run test:unit
```

Runs all tests **except** those requiring external gRPC servers:
- ✅ All unit tests for core, modules, interpreter
- ✅ Integration tests that don't need servers (dot_symbol, interpreter_complete, streaming, etc.)
- ❌ Skips: phase5_runtime_manager, phase6_config_loader (need Python gRPC server)

### Integration Tests (Full Suite)
```bash
npm run test:integration
```

Runs **all tests** including those requiring external servers. 

**Prerequisites:**
- Python gRPC server must be running on `localhost:50051`
- Required for: `phase5_runtime_manager.test.ts`, `phase6_config_loader.test.ts`

## Test Organization

- **Unit tests**: `src/forthic/tests/unit/**/*.test.ts`
  - Core: tokenizer, literals, interpreter, decorators
  - Modules: array, boolean, core, datetime, json, math, record, string
  - gRPC: server, websocket components

- **Integration tests**: `src/forthic/tests/integration/**/*.test.ts`
  - Self-contained: dot_symbol, interpreter_complete, streaming, standard_interpreter
  - **Requires server**: phase5_runtime_manager, phase6_config_loader

## Configuration

The `jest.config.js` file excludes server-dependent tests by default:

```javascript
testPathIgnorePatterns: [
  "/node_modules/",
  "tests/integration/phase5_runtime_manager.test.ts",
  "tests/integration/phase6_config_loader.test.ts"
]
```

To run the full suite, use `npm run test:integration` which overrides this setting.
