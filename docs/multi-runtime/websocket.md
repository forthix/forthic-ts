# WebSocket Multi-Runtime Setup

Use WebSocket/ActionCable for browser-compatible communication with Forthic runtimes, particularly Rails applications.

## Overview

WebSocket provides browser-compatible, client-server communication for multi-runtime Forthic execution. Use it when you need:

- **Browser support** - Works in all modern browsers
- **Rails integration** - Built for ActionCable protocol
- **Real-time updates** - Progress notifications for long operations
- **Auto-reconnection** - Handles connection drops gracefully

**Note**: For server-to-server communication with better performance, see [gRPC Guide](grpc.md).

## Installation

WebSocket support is built into forthic-ts with no additional dependencies:

```bash
npm install @forthix/forthic
# WebSocket support included (uses browser's native WebSocket API)
```

## Client Setup

### 1. Create ActionCable Client

```typescript
import { ActionCableClient } from '@forthix/forthic/websocket';

const client = new ActionCableClient({
  url: 'ws://localhost:3000/cable',           // WebSocket URL
  channel: 'ForthicRuntimeChannel',           // Rails channel name
  reconnect: true,                            // Auto-reconnect on disconnect
  reconnectDelay: 1000                        // Delay between reconnect attempts (ms)
});
```

### 2. Wait for Connection

```typescript
// Wait for connection to establish
await new Promise(resolve => {
  client.on('connected', resolve);
});

console.log('Connected to Rails runtime!');
```

### 3. Create Remote Module

```typescript
import { WebSocketRemoteModule } from '@forthix/forthic/websocket';

const railsModule = new WebSocketRemoteModule(
  'my_module',      // Module name in Rails
  client,           // ActionCable client
  'rails'           // Runtime name (for debugging)
);

await railsModule.initialize();  // Discovers words from Rails

console.log(`Discovered ${railsModule.getWordCount()} words`);
```

### 4. Use in Interpreter

```typescript
import { Interpreter } from '@forthix/forthic';

const interp = new Interpreter();
interp.register_module(railsModule);

// Call Rails code from browser!
await interp.run(`
  ["my_module"] USE-MODULES

  user-data VALIDATE SAVE
`);
```

## Browser Example

Complete browser example using WebSocket:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Forthic WebSocket Example</title>
</head>
<body>
  <h1>Forthic Multi-Runtime (Browser → Rails)</h1>
  <div id="output"></div>

  <script type="module">
    import {
      Interpreter,
      ActionCableClient,
      WebSocketRemoteModule
    } from 'https://unpkg.com/@forthix/forthic/dist/esm/index.js';

    async function main() {
      // Connect to Rails
      const client = new ActionCableClient({
        url: 'ws://localhost:3000/cable',
        channel: 'ForthicRuntimeChannel'
      });

      await new Promise(resolve => {
        client.on('connected', resolve);
      });

      // Create remote module
      const railsModule = new WebSocketRemoteModule('users', client, 'rails');
      await railsModule.initialize();

      // Use in interpreter
      const interp = new Interpreter();
      interp.register_module(railsModule);

      await interp.run(`
        ["users"] USE-MODULES

        "alice@example.com" FIND-BY-EMAIL
        [ [.status "active"] ] REC UPDATE
      `);

      const user = interp.stack_pop();
      document.getElementById('output').textContent = JSON.stringify(user, null, 2);
    }

    main().catch(console.error);
  </script>
</body>
</html>
```

## Streaming Execution with Progress

WebSocket supports streaming execution with progress updates for long-running operations:

```typescript
// Execute with progress callback
await client.streamingExecute(
  'PROCESS-LARGE-DATASET',
  [largeDataset],
  (progress) => {
    console.log(`Step ${progress.step}/${progress.total_steps}`);
    console.log(`Current word: ${progress.current_word}`);
    console.log(`Progress: ${Math.round(progress.step / progress.total_steps * 100)}%`);

    // Update UI
    updateProgressBar(progress.step / progress.total_steps);
  }
);
```

Progress update format:
```typescript
interface ProgressUpdate {
  step: number;              // Current step number
  total_steps: number;       // Total steps
  current_word: string;      // Word being executed
  message?: string;          // Optional status message
}
```

## Rails Server Setup

On the Rails side, create an ActionCable channel:

### 1. Create Channel

`app/channels/forthic_runtime_channel.rb`:

```ruby
class ForthicRuntimeChannel < ApplicationCable::Channel
  def subscribed
    stream_from "forthic_runtime_#{current_user.id}"
  end

  def execute_word(data)
    word_name = data['word_name']
    stack = deserialize_stack(data['stack'])

    # Execute in Rails Forthic interpreter
    result_stack = RailsInterpreter.execute_word(word_name, stack)

    # Send response
    transmit({
      type: 'result',
      id: data['id'],
      stack: serialize_stack(result_stack)
    })
  rescue => e
    transmit({
      type: 'error',
      id: data['id'],
      error: {
        message: e.message,
        error_type: e.class.name,
        stack_trace: e.backtrace
      }
    })
  end

  def list_modules(data)
    modules = RailsInterpreter.list_modules
    transmit({
      type: 'result',
      id: data['id'],
      modules: modules
    })
  end

  def get_module_info(data)
    module_info = RailsInterpreter.get_module_info(data['module_name'])
    transmit({
      type: 'result',
      id: data['id'],
      module_info: module_info
    })
  end
end
```

### 2. Register Module

Make your Rails module available:

```ruby
class UsersModule < Forthic::DecoratedModule
  def initialize
    super("users")
  end

  forthic_word :FIND_BY_EMAIL, "( email -- user )", "Find user by email"
  def FIND_BY_EMAIL(email)
    User.find_by(email: email)
  end

  forthic_word :UPDATE, "( user data -- user )", "Update user"
  def UPDATE(user, data)
    user.update(data)
    user
  end
end

# Register with Rails interpreter
RailsInterpreter.register_module(UsersModule.new)
```

## Event Handling

ActionCableClient emits events for connection lifecycle:

```typescript
client.on('connected', () => {
  console.log('Connected to Rails!');
});

client.on('disconnected', () => {
  console.log('Disconnected from Rails');
});

client.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});

client.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Direct Word Execution

Execute words without the interpreter:

```typescript
// Execute single word
const result = await client.executeWord('UPPERCASE', ['hello']);
// result: ['HELLO']

// Execute sequence
const result2 = await client.executeSequence(
  ['DUP', '+'],
  [5]
);
// result2: [10]
```

## Module Discovery

Discover available modules from Rails:

```typescript
// List all modules
const modules = await client.listModules();
console.log('Available modules:', modules.map(m => m.name));

// Get module details
const moduleInfo = await client.getModuleInfo('users');
console.log(`Module: ${moduleInfo.name}`);
console.log(`Description: ${moduleInfo.description}`);

// List words
moduleInfo.words.forEach(word => {
  console.log(`  ${word.name} ${word.stack_effect}`);
  console.log(`    ${word.description}`);
});
```

## Error Handling

WebSocket provides rich error information:

```typescript
import { RemoteRuntimeError } from '@forthix/forthic/websocket';

try {
  await client.executeWord('UNKNOWN_WORD', []);
} catch (error) {
  if (error instanceof RemoteRuntimeError) {
    console.error('Error type:', error.errorType);
    console.error('Message:', error.message);
    console.error('Module:', error.moduleName);
    console.error('Context:', error.context);
    console.error('Stack trace:', error.remoteStackTrace);

    // Get formatted report
    console.error(error.getErrorReport());
  }
}
```

## Connection Management

### Close Connection

```typescript
client.close();
```

### Reconnection Settings

```typescript
const client = new ActionCableClient({
  url: 'ws://localhost:3000/cable',
  reconnect: true,              // Enable auto-reconnect
  reconnectDelay: 1000,         // Wait 1s between attempts
  maxReconnectAttempts: 10      // Give up after 10 attempts
});
```

### Runtime Manager (Multiple Connections)

```typescript
import { WebSocketRuntimeManager } from '@forthix/forthic/websocket';

const manager = WebSocketRuntimeManager.getInstance();

// Connect to multiple runtimes
manager.connectRuntime('rails-prod', 'wss://prod.example.com/cable');
manager.connectRuntime('rails-dev', 'ws://localhost:3000/cable');

// Get specific client
const prodClient = manager.getClient('rails-prod');

// Disconnect all
manager.disconnectAll();
```

## Type Serialization

All Forthic types are automatically serialized via JSON:

| Forthic Type | JSON Format | Example |
|--------------|-------------|---------|
| `null` | `{type: 'null', value: null}` | `null` |
| `boolean` | `{type: 'bool', value: true}` | `true` |
| `integer` | `{type: 'int', value: 42}` | `42` |
| `float` | `{type: 'float', value: 3.14}` | `3.14` |
| `string` | `{type: 'string', value: "hi"}` | `"hello"` |
| `array` | `{type: 'array', value: [...]}` | `[1, 2, 3]` |
| `record` | `{type: 'record', value: {...}}` | `{name: "Alice"}` |
| `Instant` | `{type: 'instant', value: "..."}` | ISO 8601 string |
| `PlainDate` | `{type: 'plain_date', value: "..."}` | ISO 8601 date |
| `ZonedDateTime` | `{type: 'zoned_datetime', value: "..."}` | ISO 8601 + timezone |

## Troubleshooting

### Connection Refused

```
WebSocket connection failed
```

**Solutions:**
1. Verify Rails server is running
2. Check WebSocket URL (ws:// or wss://)
3. Verify ActionCable is mounted in Rails routes
4. Check CORS settings if cross-origin

### Module Not Found

```
Error: Module 'users' not found
```

**Solutions:**
1. Verify module is registered in Rails interpreter
2. Check module name spelling
3. Ensure Rails channel is properly configured

### CORS Issues (Cross-Origin)

If connecting from different domain:

```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'https://app.example.com'
    resource '/cable', headers: :any, methods: [:get, :post, :options]
  end
end
```

### Reconnection Not Working

```typescript
// Enable reconnection explicitly
const client = new ActionCableClient({
  url: 'ws://localhost:3000/cable',
  reconnect: true,  // Must be true
  reconnectDelay: 1000
});

// Listen for reconnection events
client.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});
```

## Comparison with gRPC

| Feature | WebSocket | gRPC |
|---------|-----------|------|
| **Browser Support** | ✅ Yes | ❌ No |
| **Performance** | Good | Excellent |
| **Protocol** | JSON | Protocol Buffers |
| **Streaming** | Server → Client | Bidirectional |
| **Reconnection** | Built-in | Manual |
| **Use Case** | Browser ↔ Server | Server ↔ Server |

**When to use WebSocket:**
- Running in browser
- Need real-time updates
- Using Rails/ActionCable
- Want auto-reconnection

**When to use gRPC:**
- Server-to-server only
- Need best performance
- Want bidirectional streaming
- See [gRPC Guide](grpc.md)

## Next Steps

- **[gRPC Guide](grpc.md)** - Server-to-server alternative
- **[Configuration Guide](configuration.md)** - Connection management
- **[Examples](../../examples/)** - More code samples
- **[Main README](../../README.md)** - Package overview
