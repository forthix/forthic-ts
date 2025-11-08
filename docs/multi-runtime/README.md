# Multi-Runtime Execution

Call code from other language runtimes transparently - use Python's pandas from TypeScript, or TypeScript's fs module from Ruby.

## Overview

Forthic enables **cross-runtime execution** where code in one language can seamlessly call modules and functions from another language runtime. This allows you to:

- Use Python's data science libraries (pandas, numpy) from TypeScript
- Call TypeScript's Node.js file operations from Python workflows
- Access Ruby Rails business logic from browser JavaScript
- Compose operations across multiple language services

## Quick Start

### Example: Calling Python from TypeScript

```typescript
import { Interpreter } from '@forthix/forthic';
import { GrpcClient, RemoteModule } from '@forthix/forthic/grpc';

const interp = new Interpreter();

// Connect to Python runtime
const client = new GrpcClient('localhost:50051');
const pandas = new RemoteModule('pandas', client, 'python');
await pandas.initialize();

interp.register_module(pandas);

// Now use Python pandas from TypeScript!
await interp.run(`
  ["pandas"] USE-MODULES

  # Create data in TypeScript, process in Python
  [
    [["name" "Alice"] ["age" 30]] REC
    [["name" "Bob"] ["age" 25]] REC
  ]
  DF-FROM-RECORDS  # Runs in Python!
`);

const df = interp.stack_pop();  // pandas DataFrame
```

## When to Use Multi-Runtime

**Perfect for:**
- Using specialized libraries not available in your primary language
- Gradual migration between languages
- Microservices that need to share logic
- Browser apps calling server-side operations
- Data pipelines spanning multiple technologies

**Use cases:**
- **Data Science**: Call Python pandas/numpy from TypeScript web app
- **Web Apps**: Call Rails business logic from browser Forthic code
- **Microservices**: Compose operations across Java, Python, Ruby services

## Approaches

### gRPC (Server-to-Server)

**Best for:** Node.js ↔ Python ↔ Ruby ↔ Rust communication

**Advantages:**
- Fast, production-ready
- High performance
- Supports bidirectional streaming
- Works between backend services

**Requirements:**
- Node.js environment (not browser)
- `@grpc/grpc-js` dependency

**See:** [gRPC Guide](grpc.md)

### WebSocket/ActionCable (Client-Server)

**Best for:** Browser ↔ Rails communication

**Advantages:**
- Browser-compatible
- Built-in reconnection
- Progress updates for long operations
- Works with Rails ActionCable

**Requirements:**
- WebSocket support (built into browsers)
- ActionCable server (Rails)

**See:** [WebSocket Guide](websocket.md)

## Choosing an Approach

| Feature | gRPC | WebSocket |
|---------|------|-----------|
| **Environment** | Node.js only | Node.js + Browser |
| **Performance** | Very fast | Fast |
| **Use case** | Server ↔ Server | Browser ↔ Server |
| **Streaming** | Bidirectional | Server → Client |
| **Setup** | Medium | Easy |

**Decision guide:**
- Running in browser? → Use **WebSocket**
- Server-to-server? → Use **gRPC**
- Need highest performance? → Use **gRPC**
- Using Rails backend? → Use **WebSocket** (ActionCable)

## Runtime Status

| Runtime | Status | gRPC | WebSocket | Notes |
|---------|--------|------|-----------|-------|
| **TypeScript** | ✅ Available | Client + Server | Client + Server | Full support |
| **Python** | ✅ Available | Client + Server | - | gRPC only |
| **Ruby** | ✅ Available | Client + Server | Server (ActionCable) | Rails integration |
| **Rust** | 🚧 In Development | In progress | - | Coming soon |
| **Java** | 📋 Planned | - | - | Future |
| **.NET** | 📋 Planned | - | - | Future |

## Getting Started

### 1. Choose Your Approach

- **For server-to-server**: [gRPC Setup](grpc.md)
- **For browser-to-server**: [WebSocket Setup](websocket.md)

### 2. Configuration

See [Configuration Guide](configuration.md) for:
- YAML configuration files
- Runtime connection settings
- Module specifications
- Environment-specific configs

### 3. Run Examples

Check out working examples:
- [examples/05-grpc-server.ts](../../examples/05-grpc-server.ts) - Expose TypeScript via gRPC
- [examples/06-grpc-client.ts](../../examples/06-grpc-client.ts) - Call Python from TypeScript

## Architecture

### How It Works

```
┌─────────────┐                    ┌─────────────┐
│ TypeScript  │                    │   Python    │
│  Runtime    │                    │   Runtime   │
│             │                    │             │
│  ┌───────┐  │   gRPC/WebSocket  │  ┌───────┐  │
│  │pandas │◄─┼────────────────────┼──│pandas │  │
│  │remote │  │                    │  │module │  │
│  └───────┘  │                    │  └───────┘  │
│             │                    │             │
│ Interpreter │                    │ Interpreter │
└─────────────┘                    └─────────────┘
```

**Process:**
1. TypeScript client discovers available modules from remote runtime
2. Creates local proxy module with same words
3. When word is called, request sent to remote runtime
4. Remote runtime executes word and returns result
5. Result automatically deserialized back to TypeScript

### Type Serialization

All Forthic types are automatically serialized across runtimes:
- Primitives: `null`, `boolean`, `integer`, `float`, `string`
- Collections: `array`, `record` (nested supported)
- Temporal: `Instant`, `PlainDate`, `ZonedDateTime`

Type conversion is automatic and transparent.

## Documentation

- **[gRPC Guide](grpc.md)** - Server and client setup for Node.js
- **[WebSocket Guide](websocket.md)** - Browser-compatible communication
- **[Configuration](configuration.md)** - YAML config and connection management
- **[Examples](../../examples/)** - Working code samples

## Protocol

Multi-runtime communication uses versioned protocols:
- **v1 Protocol**: Current stable version
- Protocol buffers (gRPC) and JSON (WebSocket)
- See `protos/v1/forthic_runtime.proto` for gRPC schema

## Community

- **Issues**: [Report problems](https://github.com/forthix/forthic-ts/issues)
- **Discussions**: [Ask questions](https://github.com/forthix/forthic/discussions)
- **Main Docs**: [Forthic repository](https://github.com/forthix/forthic)
