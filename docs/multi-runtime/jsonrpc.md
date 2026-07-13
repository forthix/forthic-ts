# JSON-RPC Multi-Runtime Setup

Use JSON-RPC to connect Forthic runtimes (TypeScript ↔ Python ↔ Ruby) over HTTP.

## Overview

JSON-RPC 2.0 over HTTP is the server-to-server transport for multi-runtime Forthic execution. It has no native dependencies: the server uses Node's built-in `http`, and the client uses the global `fetch` (Node ≥ 18).

**Note**: The JSON-RPC server requires Node.js and does not run in browsers. For browser support, see the [WebSocket Guide](websocket.md).

## Installation

No extra packages are needed — JSON-RPC ships with the runtime:

```bash
npm install @forthix/forthic
```

## Server Setup: Exposing TypeScript

Make your TypeScript runtime callable from other Forthic runtimes.

### Basic Server

```typescript
import { startJsonRpcServer } from '@forthix/forthic/jsonrpc';

// Binds 127.0.0.1:8765 by default — loopback only
const server = await startJsonRpcServer(8765);

console.log('TypeScript runtime available on 127.0.0.1:8765');
```

### Server Options

```typescript
const server = await startJsonRpcServer(8765, {
  host: '127.0.0.1',        // Interface to bind. Env: FORTHIC_JSONRPC_HOST
  token: process.env.SECRET, // Require `Authorization: Bearer <token>`. Env: FORTHIC_JSONRPC_TOKEN
  maxBodyBytes: 1_000_000,   // Max request body. Env: FORTHIC_JSONRPC_MAX_BODY_BYTES
  exposeStackTraces: false,  // Include JS stack traces in errors (local debugging only)
});
```

**Security defaults**: the server binds loopback (`127.0.0.1`) and returns sanitized errors. To accept remote connections, set `host` to `0.0.0.0` **and** set a `token` — otherwise you are exposing an arbitrary-code-execution endpoint to the network.

### What Gets Exposed

- **Runtime-specific modules**: `fs` (file system operations)
- **All registered modules**: any custom modules you register
- **Standard library**: array, record, string, math, etc.

### Running the Server

```bash
# Via the example
npx tsx examples/05-jsonrpc-server.ts

# Or the standalone CLI from the built package
npm run jsonrpc:server
node dist/cjs/jsonrpc/server.js --port 8765 --host 127.0.0.1 --token my-secret
```

### Server Methods

- **Module discovery**: `listModules()` — all available modules
- **Module introspection**: `getModuleInfo(name)` — word signatures
- **Word execution**: `executeWord(name, stack)` — execute a single word
- **Batch execution**: `executeSequence(words, stack)` — execute several words in one round trip

## Client Setup: Calling Other Runtimes

### 1. Connect to a Remote Runtime

```typescript
import { JsonRpcClient } from '@forthix/forthic/jsonrpc';

// "host:port" becomes http://host:port/rpc
const pythonClient = new JsonRpcClient('localhost:8765');

// A full URL is used as-is
const rubyClient = new JsonRpcClient('https://ruby.internal/rpc');

// With a bearer token, custom path, or your own fetch
const authed = new JsonRpcClient('localhost:8765', { path: '/rpc' });
```

### 2. Discover Available Modules

```typescript
const modules = await pythonClient.listModules();
console.log('Available modules:', modules.map(m => m.name));

const moduleInfo = await pythonClient.getModuleInfo('pandas');
console.log(`Module: ${moduleInfo.name} — ${moduleInfo.description}`);

moduleInfo.words.forEach(word => {
  console.log(`  ${word.name} ${word.stack_effect}`);
});
```

### 3. Create a Remote Module

```typescript
import { RemoteModule } from '@forthix/forthic/jsonrpc';

const pandas = new RemoteModule('pandas', pythonClient, 'python');
await pandas.initialize();  // Discovers all words

console.log(`Discovered ${pandas.getWordCount()} pandas words`);
```

### 4. Use It in the Interpreter

```typescript
import { Interpreter } from '@forthix/forthic';

const interp = new Interpreter();
interp.register_module(pandas);

await interp.run(`
  ["pandas"] USE-MODULES

  [
    [["name" "Alice"] ["age" 30] ["city" "NYC"]] REC
    [["name" "Bob"] ["age" 25] ["city" "LA"]] REC
  ]
  DF-FROM-RECORDS  # Executes in Python!
`);

const dataframe = interp.stack_pop();
```

### 5. Direct Word Execution

You can also call the client without an interpreter:

```typescript
// Single word
const result = await pythonClient.executeWord('MAP', [[1, 2, 3], '2 *']);
// result: [[2, 4, 6]]

// Batched sequence
const result2 = await pythonClient.executeSequence(['DUP', '+'], [5]);
// result2: [10]
```

## Complete Example

See [examples/06-jsonrpc-client.ts](../../examples/06-jsonrpc-client.ts):

```bash
# Prerequisites: start a Python JSON-RPC server exposing pandas
# (in the Python forthic runtime)
forthic-server --port 8765 --modules pandas

npx tsx examples/06-jsonrpc-client.ts
```

## Configuration

For multi-runtime setups, use a config file. See the [Configuration Guide](configuration.md).

`forthic-runtimes.yaml`:
```yaml
runtimes:
  python:
    host: localhost
    port: 8765
    transport: jsonrpc
    modules:
      - pandas
      - numpy
  ruby:
    host: localhost
    port: 8766
    transport: jsonrpc
    modules:
      - rails_models
```

`transport` is optional and defaults to `jsonrpc`, the only transport this runtime ships.

```typescript
import { ConfigLoader, RuntimeManager, JsonRpcClient, RemoteModule } from '@forthix/forthic/jsonrpc';

const config = ConfigLoader.loadFromFile('./forthic-runtimes.yaml');
const manager = RuntimeManager.getInstance();

// You construct the client; RuntimeManager just holds it
for (const [name, runtime] of Object.entries(config.runtimes)) {
  manager.registerClient(name, new JsonRpcClient(`${runtime.host}:${runtime.port}`));
}

const pythonClient = manager.getClient('python');
```

## Error Handling

Remote failures arrive as `RemoteRuntimeError`:

```typescript
import { RemoteRuntimeError } from '@forthix/forthic/jsonrpc';

try {
  await client.executeWord('UNKNOWN_WORD', []);
} catch (error) {
  if (error instanceof RemoteRuntimeError) {
    console.error('Runtime:', error.runtime);
    console.error('Message:', error.message);
    console.error('Full report:', error.getErrorReport());
  }
}
```

Stack traces from the remote runtime are omitted unless the server sets `exposeStackTraces` — they leak absolute server paths.

## Type Serialization

Forthic values cross the wire as JSON:

| Forthic Type | Example |
|--------------|---------|
| `null` | `null` |
| `boolean` | `true` |
| `integer` | `42` |
| `float` | `3.14` |
| `string` | `"hello"` |
| `array` | `[1, 2, 3]` |
| `record` | `{name: "Alice"}` |
| `Instant` | `Temporal.Instant` |
| `PlainDate` | `Temporal.PlainDate` |
| `PlainTime` | `Temporal.PlainTime` |
| `ZonedDateTime` | `Temporal.ZonedDateTime` |

Nested structures are fully supported.

## Performance Tips

1. **Batch with executeSequence** — one round trip instead of several:
   ```typescript
   await client.executeSequence(['WORD1', 'WORD2'], stack);
   ```

2. **Reuse clients** — create once, not per request:
   ```typescript
   const client = new JsonRpcClient('localhost:8765');  // once, at startup
   ```

3. **Initialize modules once** — call `initialize()` at startup, not per call.

## Connection Management

```typescript
client.close();

const manager = RuntimeManager.getInstance();
manager.clearAll();   // closes every registered client
```

### Health Check

```typescript
try {
  await client.listModules();
  console.log('Connection healthy');
} catch (error) {
  console.error('Connection failed:', error);
}
```

## Troubleshooting

### Port Already in Use

```
Error: listen EADDRINUSE
```

Change the port, or free it: `lsof -ti:8765 | xargs kill -9`

### Connection Refused

1. Is the server running? `lsof -i:8765`
2. Right host and port?
3. Remember the server binds `127.0.0.1` by default — a remote client cannot reach it unless you set `host` and a `token`.

### 401 Unauthorized

The server was started with a `token`. Send it:

```typescript
new JsonRpcClient('localhost:8765', {
  fetchImpl: (url, init) =>
    fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } }),
});
```

### Module Not Found

1. Is the module registered in the remote runtime?
2. Check the spelling of the module name.

## Protocol Details

- **Protocol**: JSON-RPC 2.0 over HTTP `POST`
- **Default endpoint**: `http://127.0.0.1:8765/rpc`
- **Methods**:
  - `executeWord(word_name, stack) → result_stack`
  - `executeSequence(word_names, stack) → result_stack`
  - `listModules() → modules[]`
  - `getModuleInfo(module_name) → module_info`

## Next Steps

- **[Configuration Guide](configuration.md)** — YAML configs
- **[WebSocket Guide](websocket.md)** — browser alternative
- **[Examples](../../examples/)** — working code
- **[Main README](../../README.md)** — package overview
