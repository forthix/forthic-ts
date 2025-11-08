# Multi-Runtime Configuration

Manage connections to multiple Forthic runtimes using YAML configuration files and the ConfigLoader.

## Overview

For production deployments with multiple runtimes, use configuration files to centralize connection settings, module specifications, and environment-specific configs.

## Configuration File Format

### Basic YAML Structure

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
      - redis_cache
  rust:
    host: localhost
    port: 50054
    modules:
      - crypto
      - compression
```

### Configuration Schema

```yaml
runtimes:
  <runtime_name>:              # Unique name for this runtime
    host: <string>             # Hostname or IP address
    port: <number>             # gRPC port number
    modules:                   # List of available modules (optional)
      - <module_name>
      - <module_name>
    connection_timeout: <ms>   # Connection timeout (optional, default: 5000)
    max_retries: <number>      # Max connection retries (optional, default: 3)
```

## Loading Configuration

### Basic Usage

```typescript
import { ConfigLoader } from '@forthix/forthic/grpc';

// Load from file
const config = await ConfigLoader.load('./forthic-runtimes.yaml');

console.log('Configured runtimes:', Object.keys(config.runtimes));
// ['python', 'ruby', 'rust']
```

### Configuration Structure

```typescript
interface ForthicRuntimesConfig {
  runtimes: {
    [runtimeName: string]: RuntimeConfig;
  };
}

interface RuntimeConfig {
  host: string;
  port: number;
  modules?: string[];
  connection_timeout?: number;
  max_retries?: number;
}
```

## Using with RuntimeManager

### Connect to All Configured Runtimes

```typescript
import { ConfigLoader, RuntimeManager } from '@forthix/forthic/grpc';

const config = await ConfigLoader.load('./forthic-runtimes.yaml');
const manager = RuntimeManager.getInstance();

// Connect to all runtimes
for (const [name, runtimeConfig] of Object.entries(config.runtimes)) {
  const address = `${runtimeConfig.host}:${runtimeConfig.port}`;
  manager.connectRuntime(name, address);
  console.log(`Connected to ${name} at ${address}`);
}

// Get client for specific runtime
const pythonClient = manager.getClient('python');
const rubyClient = manager.getClient('ruby');
```

### Using Configured Modules

```typescript
import { RemoteModule } from '@forthix/forthic/grpc';

// Get configured modules for Python
const pythonConfig = config.runtimes.python;
const pythonClient = manager.getClient('python');

// Create remote modules for all configured modules
for (const moduleName of pythonConfig.modules || []) {
  const remoteModule = new RemoteModule(moduleName, pythonClient, 'python');
  await remoteModule.initialize();
  interp.register_module(remoteModule);
  console.log(`Registered ${moduleName} from Python`);
}
```

## Environment-Specific Configs

### Development vs Production

`forthic-runtimes.dev.yaml`:
```yaml
runtimes:
  python:
    host: localhost
    port: 50051
    modules: [pandas, numpy]
  ruby:
    host: localhost
    port: 50053
    modules: [rails_models]
```

`forthic-runtimes.prod.yaml`:
```yaml
runtimes:
  python:
    host: python-service.prod.internal
    port: 50051
    modules: [pandas, numpy, scipy]
    connection_timeout: 10000
    max_retries: 5
  ruby:
    host: ruby-service.prod.internal
    port: 50053
    modules: [rails_models, redis_cache]
    connection_timeout: 10000
    max_retries: 5
```

### Load Based on Environment

```typescript
const env = process.env.NODE_ENV || 'development';
const configFile = `./forthic-runtimes.${env}.yaml`;

const config = await ConfigLoader.load(configFile);
console.log(`Loaded ${env} configuration`);
```

## Connection Settings

### Timeout Configuration

```yaml
runtimes:
  python:
    host: remote-server.example.com
    port: 50051
    connection_timeout: 10000  # 10 seconds
    max_retries: 5
```

### Retry Logic

```typescript
// ConfigLoader handles retries automatically
try {
  const config = await ConfigLoader.load('./forthic-runtimes.yaml');
  // Connection successful
} catch (error) {
  console.error('Failed to connect after retries:', error);
}
```

## Health Checks

### Verify Connections

```typescript
async function healthCheck(manager: RuntimeManager, runtimeName: string) {
  try {
    const client = manager.getClient(runtimeName);
    const modules = await client.listModules();
    console.log(`✅ ${runtimeName}: OK (${modules.length} modules)`);
    return true;
  } catch (error) {
    console.error(`❌ ${runtimeName}: FAILED - ${error.message}`);
    return false;
  }
}

// Check all runtimes
const results = await Promise.all(
  Object.keys(config.runtimes).map(name => healthCheck(manager, name))
);

if (results.every(r => r)) {
  console.log('All runtimes healthy!');
} else {
  console.error('Some runtimes unavailable');
}
```

## Dynamic Configuration

### Runtime Discovery

```typescript
import { RuntimeManager } from '@forthix/forthic/grpc';

const manager = RuntimeManager.getInstance();

// Discover what's available
const addresses = [
  'localhost:50051',
  'localhost:50052',
  'localhost:50053'
];

for (const address of addresses) {
  try {
    const client = new GrpcClient(address);
    const modules = await client.listModules();

    if (modules.length > 0) {
      console.log(`Found runtime at ${address}`);
      console.log(`  Modules: ${modules.map(m => m.name).join(', ')}`);

      // Add to manager
      manager.connectRuntime(`runtime-${address}`, address);
    }
  } catch (error) {
    console.log(`No runtime at ${address}`);
  }
}
```

## Module Filtering

### Selective Module Loading

```yaml
runtimes:
  python:
    host: localhost
    port: 50051
    modules:
      # Only load these modules (others ignored)
      - pandas
      - numpy
```

```typescript
// Load only configured modules
const pythonConfig = config.runtimes.python;
const pythonClient = manager.getClient('python');

const allowedModules = new Set(pythonConfig.modules || []);

const availableModules = await pythonClient.listModules();

for (const moduleSummary of availableModules) {
  if (allowedModules.has(moduleSummary.name)) {
    const module = new RemoteModule(moduleSummary.name, pythonClient, 'python');
    await module.initialize();
    interp.register_module(module);
  }
}
```

## Security Considerations

### Secure Connections

For production, use TLS:

```yaml
runtimes:
  python:
    host: python-service.example.com
    port: 443
    use_tls: true  # Enable TLS
    cert_path: /path/to/cert.pem
    key_path: /path/to/key.pem
```

### Authentication

```yaml
runtimes:
  python:
    host: secure-service.example.com
    port: 50051
    auth_token: ${PYTHON_AUTH_TOKEN}  # From environment variable
```

```typescript
// Load with environment variable substitution
const config = await ConfigLoader.load('./forthic-runtimes.yaml', {
  expandEnvVars: true  // Expand ${VAR} syntax
});
```

## Example: Complete Setup

### Configuration File

`config/forthic-runtimes.yaml`:
```yaml
runtimes:
  python_ml:
    host: ml-server.internal
    port: 50051
    modules:
      - pandas
      - sklearn
      - tensorflow
    connection_timeout: 15000
    max_retries: 3

  ruby_api:
    host: api-server.internal
    port: 50053
    modules:
      - users
      - orders
      - payments
    connection_timeout: 5000
    max_retries: 5

  rust_crypto:
    host: crypto-server.internal
    port: 50054
    modules:
      - encryption
      - hashing
    connection_timeout: 3000
```

### Application Code

```typescript
import { Interpreter } from '@forthix/forthic';
import { ConfigLoader, RuntimeManager, RemoteModule } from '@forthix/forthic/grpc';

async function setupMultiRuntime() {
  // Load configuration
  const config = await ConfigLoader.load('./config/forthic-runtimes.yaml');
  const manager = RuntimeManager.getInstance();
  const interp = new Interpreter();

  // Connect to all runtimes
  for (const [name, runtimeConfig] of Object.entries(config.runtimes)) {
    const address = `${runtimeConfig.host}:${runtimeConfig.port}`;

    console.log(`Connecting to ${name}...`);
    const client = manager.connectRuntime(name, address);

    // Load configured modules
    for (const moduleName of runtimeConfig.modules || []) {
      const module = new RemoteModule(moduleName, client, name);
      await module.initialize();
      interp.register_module(module);
      console.log(`  ✅ Loaded ${moduleName}`);
    }
  }

  console.log('Multi-runtime setup complete!');
  return interp;
}

// Use it
const interp = await setupMultiRuntime();

// Now you can use modules from all runtimes!
await interp.run(`
  ["pandas" "users" "encryption"] USE-MODULES

  # Use pandas from Python
  data-records DF-FROM-RECORDS

  # Use users from Ruby
  "alice@example.com" FIND-USER

  # Use encryption from Rust
  sensitive-data ENCRYPT
`);
```

## Best Practices

1. **Environment-specific configs**: Use separate files for dev/staging/prod
2. **Module filtering**: Only load modules you need
3. **Health checks**: Verify connections at startup
4. **Timeout tuning**: Adjust based on network latency
5. **Retry logic**: Configure retries for flaky connections
6. **Security**: Use TLS and authentication in production
7. **Documentation**: Comment your YAML files with module purposes

## Troubleshooting

### Config File Not Found

```
Error: ENOENT: no such file or directory
```

**Solution**: Use absolute path or verify relative path:
```typescript
import path from 'path';

const configPath = path.join(__dirname, '../config/forthic-runtimes.yaml');
const config = await ConfigLoader.load(configPath);
```

### Invalid YAML Syntax

```
Error: bad indentation
```

**Solution**: Validate YAML syntax (use 2-space indentation, no tabs)

### Module Not Available

```
Error: Module 'pandas' not found
```

**Solutions:**
1. Check module name spelling
2. Verify module is loaded in remote runtime
3. Remove from config if not needed

## Next Steps

- **[gRPC Guide](grpc.md)** - Using the configured connections
- **[WebSocket Guide](websocket.md)** - WebSocket configuration
- **[Overview](README.md)** - Multi-runtime introduction
- **[Examples](../../examples/)** - Working code samples
