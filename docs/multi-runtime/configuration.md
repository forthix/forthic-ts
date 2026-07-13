# Multi-Runtime Configuration

Manage connections to multiple Forthic runtimes using YAML configuration files and the `ConfigLoader`.

## Overview

For deployments with several runtimes, use a configuration file to centralize hosts, ports, and the modules each runtime exposes.

`ConfigLoader` parses and validates the file. It does **not** open connections: you construct the clients and hand them to `RuntimeManager`. That keeps the config layer transport-agnostic and free of network side effects.

## Configuration File Format

### Basic YAML Structure

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
    modules:
      - rails_models
      - redis_cache
settings:
  connection_timeout: 5000
  health_check: true
```

### Configuration Schema

This is the whole schema — anything else is ignored:

```yaml
runtimes:
  <runtime_name>:            # Unique name for this runtime
    host: <string>           # Required. Hostname or IP address
    port: <number>           # Required. Port (1–65535)
    modules:                 # Required. Module names this runtime exposes
      - <module_name>
    transport: jsonrpc       # Optional. Only "jsonrpc" is valid; it is also the default

settings:                    # Optional
  connection_timeout: <ms>   # Optional. Positive number
  health_check: <boolean>    # Optional
```

Validation is strict about what it does check: a runtime missing `host`, `port`, or `modules` throws, as does a port outside 1–65535, a non-array `modules`, a non-string module name, or a `transport` other than `jsonrpc`.

> **Removed in v0.16.0**: `transport: grpc`. The gRPC transport is gone; a config still naming it fails with a message pointing at `jsonrpc`.

## Loading Configuration

The loaders are synchronous and static — there is no `ConfigLoader.load()`.

```typescript
import { ConfigLoader } from '@forthix/forthic/jsonrpc';

// From a file
const config = ConfigLoader.loadFromFile('./forthic-runtimes.yaml');

// From a string
const config2 = ConfigLoader.loadFromString(yamlText);

// Find ./forthic-runtimes.{yaml,yml} in the working directory; null if absent
const defaultPath = ConfigLoader.getDefaultConfigPath();

console.log('Configured runtimes:', Object.keys(config.runtimes));
// ['python', 'ruby']
```

### Configuration Types

```typescript
interface ForthicRuntimesConfig {
  runtimes: Record<string, RuntimeConfig>;
  settings?: ConnectionSettings;
}

interface RuntimeConfig {
  host: string;
  port: number;
  modules: string[];
  transport?: 'jsonrpc';
}

interface ConnectionSettings {
  connection_timeout?: number;
  health_check?: boolean;
}
```

## Using with RuntimeManager

### Register a Client per Runtime

`RuntimeManager` is a singleton registry of clients. You build each client; it stores them by name.

```typescript
import { ConfigLoader, RuntimeManager, JsonRpcClient } from '@forthix/forthic/jsonrpc';

const config = ConfigLoader.loadFromFile('./forthic-runtimes.yaml');
const manager = RuntimeManager.getInstance();

for (const [name, runtime] of Object.entries(config.runtimes)) {
  const address = `${runtime.host}:${runtime.port}`;
  manager.registerClient(name, new JsonRpcClient(address));
  console.log(`Registered ${name} at ${address}`);
}

const pythonClient = manager.getClient('python');   // undefined if not registered
manager.hasClient('python');                        // true
manager.getRegisteredRuntimes();                    // ['python', 'ruby']
```

### Loading the Configured Modules

```typescript
import { RemoteModule } from '@forthix/forthic/jsonrpc';

const pythonClient = manager.getClient('python')!;

for (const moduleName of config.runtimes.python.modules) {
  const remoteModule = new RemoteModule(moduleName, pythonClient, 'python');
  await remoteModule.initialize();
  interp.register_module(remoteModule);
  console.log(`Registered ${moduleName} from Python`);
}
```

## Environment-Specific Configs

Keep one file per environment and pick at startup:

`forthic-runtimes.development.yaml`:
```yaml
runtimes:
  python:
    host: localhost
    port: 8765
    modules: [pandas, numpy]
```

`forthic-runtimes.production.yaml`:
```yaml
runtimes:
  python:
    host: python-service.prod.internal
    port: 8765
    modules: [pandas, numpy, scipy]
settings:
  connection_timeout: 10000
```

```typescript
const env = process.env.NODE_ENV || 'development';
const config = ConfigLoader.loadFromFile(`./forthic-runtimes.${env}.yaml`);
```

## Health Checks

`settings.health_check` is a flag your application acts on — the loader does not probe anything. A check is just a `listModules()` round trip:

```typescript
async function healthCheck(manager: RuntimeManager, runtimeName: string): Promise<boolean> {
  const client = manager.getClient(runtimeName);
  if (!client) return false;

  try {
    const modules = await client.listModules();
    console.log(`✅ ${runtimeName}: OK (${modules.length} modules)`);
    return true;
  } catch (error) {
    console.error(`❌ ${runtimeName}: FAILED — ${(error as Error).message}`);
    return false;
  }
}

const results = await Promise.all(
  Object.keys(config.runtimes).map((name) => healthCheck(manager, name))
);

console.log(results.every(Boolean) ? 'All runtimes healthy!' : 'Some runtimes unavailable');
```

## Module Filtering

`modules` lists what you intend to load; nothing enforces it for you. Intersect it with what the runtime actually reports:

```typescript
const allowed = new Set(config.runtimes.python.modules);

for (const summary of await pythonClient.listModules()) {
  if (!allowed.has(summary.name)) continue;

  const module = new RemoteModule(summary.name, pythonClient, 'python');
  await module.initialize();
  interp.register_module(module);
}
```

## Security Considerations

A Forthic runtime server executes arbitrary words sent to it. Treat every endpoint as privileged.

The config file carries no credentials — authentication is set on the server and the client, not in YAML:

- **Server**: pass a `token` to `startJsonRpcServer` (or set `FORTHIC_JSONRPC_TOKEN`). It binds `127.0.0.1` by default; only bind a public interface together with a token.
- **Client**: send `Authorization: Bearer <token>` via a custom `fetchImpl`.
- **TLS**: terminate it at a reverse proxy and give `JsonRpcClient` the resulting `https://` URL. The server speaks plain HTTP.

See the [JSON-RPC Guide](jsonrpc.md#server-options) for details.

Keep secrets in environment variables and read them in code — `ConfigLoader` does **not** expand `${VAR}` in YAML.

## Example: Complete Setup

`config/forthic-runtimes.yaml`:
```yaml
runtimes:
  python_ml:
    host: ml-server.internal
    port: 8765
    modules:
      - pandas
      - sklearn

  ruby_api:
    host: api-server.internal
    port: 8766
    modules:
      - users
      - orders

settings:
  connection_timeout: 10000
```

```typescript
import { Interpreter } from '@forthix/forthic';
import { ConfigLoader, RuntimeManager, RemoteModule, JsonRpcClient } from '@forthix/forthic/jsonrpc';

async function setupMultiRuntime() {
  const config = ConfigLoader.loadFromFile('./config/forthic-runtimes.yaml');
  const manager = RuntimeManager.getInstance();
  const interp = new Interpreter();

  for (const [name, runtime] of Object.entries(config.runtimes)) {
    console.log(`Connecting to ${name}...`);
    const client = new JsonRpcClient(`${runtime.host}:${runtime.port}`);
    manager.registerClient(name, client);

    for (const moduleName of runtime.modules) {
      const module = new RemoteModule(moduleName, client, name);
      await module.initialize();
      interp.register_module(module);
      console.log(`  ✅ Loaded ${moduleName}`);
    }
  }

  console.log('Multi-runtime setup complete!');
  return interp;
}

const interp = await setupMultiRuntime();

await interp.run(`
  ["pandas" "users"] USE-MODULES

  # Use pandas from Python
  data-records DF-FROM-RECORDS

  # Use users from Ruby
  "alice@example.com" FIND-USER
`);
```

## Best Practices

1. **Environment-specific configs**: separate files for dev/staging/prod
2. **Module filtering**: only load the modules you need
3. **Health checks**: verify connections at startup
4. **Security**: token-authenticate every non-loopback endpoint
5. **Documentation**: comment your YAML with each module's purpose

## Troubleshooting

### Config File Not Found

```
Error: Configuration file not found: /abs/path/forthic-runtimes.yaml
```

Paths resolve against the working directory. Use an absolute path when that's ambiguous:

```typescript
import path from 'path';

const config = ConfigLoader.loadFromFile(path.join(__dirname, '../config/forthic-runtimes.yaml'));
```

### Invalid YAML Syntax

```
Error: Failed to parse YAML: bad indentation
```

Use 2-space indentation, no tabs.

### Transport Must Be "jsonrpc"

```
Error: Runtime "python" "transport" must be "jsonrpc". The gRPC transport was removed in v0.16.0; use "jsonrpc".
```

Delete the `transport: grpc` line or change it to `jsonrpc`.

## Next Steps

- **[JSON-RPC Guide](jsonrpc.md)** - Using the configured connections
- **[WebSocket Guide](websocket.md)** - WebSocket configuration
- **[Overview](README.md)** - Multi-runtime introduction
- **[Examples](../../examples/)** - Working code samples
