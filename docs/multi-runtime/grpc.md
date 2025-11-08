# gRPC Multi-Runtime Setup

Use gRPC to enable fast, production-ready communication between Forthic runtimes (TypeScript ↔ Python ↔ Ruby ↔ Rust).

## Overview

gRPC provides high-performance, server-to-server communication for multi-runtime Forthic execution. Use it when you need:

- **Fast performance** between backend services
- **Bidirectional communication**
- **Production-ready** reliability
- **Type-safe** cross-runtime calls

**Note**: gRPC requires Node.js and does not work in browsers. For browser support, see [WebSocket Guide](websocket.md).

## Installation

gRPC dependencies are optional in forthic-ts:

```bash
npm install @forthix/forthic
# gRPC dependencies are installed automatically as optionalDependencies
```

If you need to install them explicitly:

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

## Server Setup: Exposing TypeScript

Make your TypeScript runtime available to other runtimes by starting a gRPC server.

### Basic Server

```typescript
import { startGrpcServer } from '@forthix/forthic/grpc';

// Start server on port 50052
const server = await startGrpcServer(50052);

console.log('TypeScript runtime available on port 50052');
```

### What Gets Exposed

The gRPC server automatically exposes:
- **Runtime-specific modules**: `fs` (file system operations)
- **All registered modules**: Any custom modules you've registered
- **Standard library**: array, record, string, math, etc.

### Example: Running the Server

See [examples/05-grpc-server.ts](../../examples/05-grpc-server.ts):

```bash
# Run the example
npx tsx examples/05-grpc-server.ts

# Or use the built-in script
npm run grpc:server
```

### Server Features

The TypeScript gRPC server provides:
- **Module discovery**: `ListModules()` - Get all available modules
- **Module introspection**: `GetModuleInfo(name)` - Get word signatures
- **Word execution**: `ExecuteWord(name, stack)` - Execute single word
- **Batch execution**: `ExecuteSequence(words, stack)` - Execute multiple words

## Client Setup: Calling Other Runtimes

Connect to other Forthic runtimes and call their modules from TypeScript.

### 1. Connect to Remote Runtime

```typescript
import { GrpcClient } from '@forthix/forthic/grpc';

// Connect to Python runtime
const pythonClient = new GrpcClient('localhost:50051');

// Connect to Ruby runtime
const rubyClient = new GrpcClient('localhost:50053');
```

### 2. Discover Available Modules

```typescript
// List all modules
const modules = await pythonClient.listModules();
console.log('Available modules:', modules.map(m => m.name));

// Get module details
const moduleInfo = await pythonClient.getModuleInfo('pandas');
console.log(`Module: ${moduleInfo.name}`);
console.log(`Description: ${moduleInfo.description}`);
console.log(`Words: ${moduleInfo.words.length}`);

// Inspect word signatures
moduleInfo.words.forEach(word => {
  console.log(`  ${word.name} ${word.stack_effect}`);
  console.log(`    ${word.description}`);
});
```

### 3. Create Remote Module

```typescript
import { RemoteModule } from '@forthix/forthic/grpc';

// Create proxy module for Python's pandas
const pandas = new RemoteModule('pandas', pythonClient, 'python');
await pandas.initialize();  // Discovers all words

console.log(`Discovered ${pandas.getWordCount()} pandas words`);
```

### 4. Use in Interpreter

```typescript
import { Interpreter } from '@forthix/forthic';

const interp = new Interpreter();
interp.register_module(pandas);

// Now use Python pandas from TypeScript!
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

You can also execute words directly without the interpreter:

```typescript
// Execute single word
const stack = [[1, 2, 3], '2 *'];
const result = await pythonClient.executeWord('MAP', stack);
// result: [[2, 4, 6]]

// Execute sequence of words (batched)
const words = ['DUP', '+'];
const stack2 = [5];
const result2 = await pythonClient.executeSequence(words, stack2);
// result2: [10]
```

## Complete Example

See [examples/06-grpc-client.ts](../../examples/06-grpc-client.ts) for a complete working example:

```bash
# Prerequisites: Start Python server first
# (in Python forthic runtime)
forthic-server --port 50051 --modules pandas

# Run the client example
npx tsx examples/06-grpc-client.ts
```

## Configuration

For production setups, use configuration files. See [Configuration Guide](configuration.md).

### YAML Configuration

`forthic-runtimes.yaml`:
```yaml
runtimes:
  python:
    host: localhost
    port: 50051
    modules:
      - pandas
      - numpy
  ruby:
    host: localhost
    port: 50053
    modules:
      - rails_models
```

### Load Configuration

```typescript
import { ConfigLoader, RuntimeManager } from '@forthix/forthic/grpc';

const config = await ConfigLoader.load('./forthic-runtimes.yaml');
const manager = RuntimeManager.getInstance();

// Connect to all configured runtimes
for (const [name, runtimeConfig] of Object.entries(config.runtimes)) {
  manager.connectRuntime(name, `${runtimeConfig.host}:${runtimeConfig.port}`);
}

// Get client for specific runtime
const pythonClient = manager.getClient('python');
```

## Error Handling

gRPC provides rich error information:

```typescript
try {
  await client.executeWord('UNKNOWN_WORD', []);
} catch (error) {
  if (error instanceof RemoteRuntimeError) {
    console.error('Runtime:', error.runtime);
    console.error('Message:', error.message);
    console.error('Stack trace:', error.remoteStackTrace);
    console.error('Full report:', error.getErrorReport());
  }
}
```

## Type Serialization

All Forthic types are automatically serialized via Protocol Buffers:

| Forthic Type | Protobuf Field | Example |
|--------------|----------------|---------|
| `null` | `null_value` | `null` |
| `boolean` | `bool_value` | `true` |
| `integer` | `int_value` | `42` |
| `float` | `float_value` | `3.14` |
| `string` | `string_value` | `"hello"` |
| `array` | `array_value` | `[1, 2, 3]` |
| `record` | `record_value` | `{name: "Alice"}` |
| `Instant` | `instant_value` | `Temporal.Instant` |
| `PlainDate` | `plain_date_value` | `Temporal.PlainDate` |
| `ZonedDateTime` | `zoned_datetime_value` | `Temporal.ZonedDateTime` |

Nested structures are fully supported.

## Performance Tips

1. **Use executeSequence for batching**: Send multiple words in one call
   ```typescript
   // Instead of multiple calls
   await client.executeWord('WORD1', stack);
   await client.executeWord('WORD2', stack);

   // Use sequence
   await client.executeSequence(['WORD1', 'WORD2'], stack);
   ```

2. **Reuse connections**: Create clients once and reuse them
   ```typescript
   // Good: create once
   const client = new GrpcClient('localhost:50051');

   // Bad: create per request
   for (let i = 0; i < 100; i++) {
     const client = new GrpcClient('localhost:50051');  // Wasteful!
   }
   ```

3. **Initialize modules once**: Call `initialize()` at startup
   ```typescript
   const pandas = new RemoteModule('pandas', client, 'python');
   await pandas.initialize();  // Do once at startup
   ```

## Connection Management

### Close Connections

```typescript
// Close specific client
client.close();

// Close all managed connections
const manager = RuntimeManager.getInstance();
manager.disconnectAll();
```

### Health Checks

```typescript
try {
  // Test connection
  const modules = await client.listModules();
  console.log('Connection healthy');
} catch (error) {
  console.error('Connection failed:', error);
}
```

## Troubleshooting

### Port Already in Use

```
Error: bind EADDRINUSE
```

**Solution**: Change the port or kill the process using it:
```bash
lsof -ti:50052 | xargs kill -9
```

### Connection Refused

```
Error: 14 UNAVAILABLE: Connection refused
```

**Solutions:**
1. Check if server is running: `lsof -i:50051`
2. Verify correct host/port
3. Check firewall settings

### Module Not Found

```
Error: Module 'pandas' not found
```

**Solutions:**
1. Verify module is registered in remote runtime
2. Check module name spelling
3. Ensure remote runtime has module loaded

### gRPC Not Available in Browser

```
Error: gRPC is only available in Node.js environments
```

**Solution**: Use WebSocket instead. See [WebSocket Guide](websocket.md).

## Protocol Details

- **Protocol Version**: v1
- **Proto File**: `protos/v1/forthic_runtime.proto`
- **Service**: `ForthicRuntime`
- **Operations**:
  - `ExecuteWord(word_name, stack) → result_stack`
  - `ExecuteSequence(word_names, stack) → result_stack`
  - `ListModules() → modules[]`
  - `GetModuleInfo(module_name) → module_info`

## Next Steps

- **[Configuration Guide](configuration.md)** - Set up YAML configs
- **[WebSocket Guide](websocket.md)** - Browser alternative
- **[Examples](../../examples/)** - More working code
- **[Main README](../../README.md)** - Package overview
