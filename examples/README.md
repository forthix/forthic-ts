# Forthic TypeScript Examples

This directory contains working examples demonstrating how to use Forthic in TypeScript/JavaScript applications.

---

## Quick Start

### Running Examples

```bash
# Run an example as a script
npm run forthic examples/01-hello.forthic

# Load an example into the REPL
npm run repl examples/01-hello.forthic

# Start blank REPL
npm run repl
```

### Available Examples

**Single-Runtime Examples** (.forthic files):
1. **01-hello.forthic** - Simple "Hello World"
2. **02-arrays.forthic** - Array operations (MAP, SELECT, REDUCE)
3. **03-records.forthic** - Record manipulation (REC@, KEYS, VALUES)
4. **04-composition.forthic** - Defining and composing words

**Multi-Runtime Examples** (.ts files):
5. **05-grpc-server.ts** - Expose TypeScript runtime via gRPC
6. **06-grpc-client.ts** - Call Python/Ruby from TypeScript via gRPC

---

## Examples Overview

### Basic Usage

#### Hello World
```typescript
import { Interpreter } from '@forthix/forthic-ts';

const interp = new Interpreter();
await interp.run('"Hello, World!" PRINTLN');
```

#### Stack Operations
```typescript
const interp = new Interpreter();

// Push values, perform operations
await interp.run('2 3 +');
console.log(interp.stack_pop()); // 5

// Array operations
await interp.run('[1 2 3 4 5] "2 *" MAP');
console.log(interp.stack_pop()); // [2, 4, 6, 8, 10]
```

---

## Creating Modules

### Simple Module

```typescript
import { DecoratedModule, Word } from '@forthix/forthic-ts';

export class MathModule extends DecoratedModule {
  constructor() {
    super("math");
  }

  @Word("( a:number b:number -- result:number )", "Add two numbers")
  async ADD(a: number, b: number) {
    return a + b;
  }

  @Word("( n:number -- result:number )", "Square a number")
  async SQUARE(n: number) {
    return n * n;
  }
}

// Use it
const interp = new Interpreter();
interp.register_module(new MathModule());

await interp.run(`
  ["math"] USE-MODULES
  5 3 ADD      # 8
  SQUARE       # 64
`);
```

---

## Data Transformation Patterns

### Filtering and Mapping

```typescript
await interp.run(`
  # Filter and transform data
  [1 2 3 4 5 6 7 8 9 10]
    'DUP 2 % 0 ==' SELECT    # Keep even numbers
    '"2 *"' MAP              # Double each
    # Result: [4, 8, 12, 16, 20]
`);
```

### Working with Records

```typescript
await interp.run(`
  # Create record
  [ [.name "Alice"] [.age 30] [.score 95] ] REC

  # Extract field
  DUP "name" REC@     # "Alice"

  # Update field
  [ [.score 100] ] REC MERGE # {"name" "Alice" "age" 30 "score" 100}
`);
```

### Pipeline Composition

```typescript
await interp.run(`
  : CLEAN-DATA
      'DUP "score" REC@ NULL? NOT' SELECT    # Remove nulls
      'DUP "score" REC@ 0 >' SELECT         # Keep positive scores
  ;

  : EXTRACT-NAMES
      '"name" REC@' MAP
  ;

  : FORMAT-OUTPUT
      ', ' JOIN
  ;

  # Compose into pipeline
  data-records CLEAN-DATA EXTRACT-NAMES FORMAT-OUTPUT
`);
```

---

## Wrapping Existing Code

### Wrapping a Class

```typescript
export class UserService {
  async findUser(id: string) {
    // Your existing logic
    return await db.users.findById(id);
  }

  async updateUser(id: string, data: any) {
    // Your existing logic
    return await db.users.update(id, data);
  }
}

export class UserModule extends DecoratedModule {
  constructor(private userService: UserService) {
    super("users");
  }

  @Word("( id:string -- user:object )", "Find user by ID")
  async FIND(id: string) {
    return this.userService.findUser(id);
  }

  @Word("( id:string data:object -- user:object )", "Update user")
  async UPDATE(id: string, data: any) {
    return this.userService.updateUser(id, data);
  }
}

// Use it
const userService = new UserService();
const interp = new Interpreter();
interp.register_module(new UserModule(userService));

await interp.run(`
  ["users"] USE-MODULES
  "user-123" FIND
  [ [.email "newemail@example.com"] ] REC UPDATE
`);
```

---

## Advanced Patterns

### Building Higher-Level Abstractions

```typescript
export class ReportingModule extends DecoratedModule {
  constructor() {
    super("reporting");
  }

  @Word("( data:any[] -- stats:object )", "Calculate statistics")
  async STATS(data: number[]) {
    return {
      mean: data.reduce((a, b) => a + b, 0) / data.length,
      min: Math.min(...data),
      max: Math.max(...data),
    };
  }

  @Word("( stats:object -- formatted:string )", "Format stats")
  async FORMAT_STATS(stats: any) {
    return `Mean: ${stats.mean}, Min: ${stats.min}, Max: ${stats.max}`;
  }
}

// Compose into high-level concepts
await interp.run(`
  ["reporting"] USE-MODULES

  : ANALYZE-AND-REPORT   STATS FORMAT-STATS;
  [1 2 3 4 5] ANALYZE-AND-REPORT
  # "Mean: 3, Min: 1, Max: 5"
`);
```

### Categorical Patterns: Inverses

```typescript
await interp.run(`
  # Serialize and deserialize (inverse operations)
  : RECORD>JSON   >JSON ;
  : JSON>RECORD   JSON> ;

  # Round trip
  [ [.name "Alice"] [.age 30] ] REC
    RECORD>JSON     # JSON string
    JSON>RECORD     # Back to record
`);
```

---

## Common Patterns

### 1. Filter-Map-Reduce

```typescript
await interp.run(`
  # Get sum of even numbers
  [1 2 3 4 5 6 7 8 9 10]
    'DUP 2 % 0 ==' SELECT    # Filter: keep evens
    '"2 *"' MAP              # Map: double each
    0 '+' REDUCE             # Reduce: sum
  # Result: 60
`);
```

### 2. Group and Aggregate

```typescript
await interp.run(`
  # Group records by category
  records "category" GROUP-BY

  # Process each group
  '"items" REC@' MAP
  '"score" REC@' MAP
  'AVERAGE' MAP
`);
```

### 3. Conditional Processing

```typescript
await interp.run(`
  : PROCESS-HIGH-SCORE
      DUP "score" REC@ 80 > IF
          "HIGH" <REC
      ELSE
          "NORMAL" <REC
      ENDIF
  ;

  records 'PROCESS-HIGH-SCORE' MAP
`);
```

---

## Real-World Example: Data Processing Pipeline

```typescript
export class DataPipelineModule extends DecoratedModule {
  constructor(private dataSource: DataSource) {
    super("pipeline");
  }

  @Word("( source:string -- data:any[] )", "Fetch raw data")
  async FETCH(source: string) {
    return this.dataSource.fetch(source);
  }

  @Word("( data:any[] -- cleaned:any[] )", "Clean data")
  async CLEAN(data: any[]) {
    return data.filter(item => item != null && item.value > 0);
  }

  @Word("( data:any[] -- enriched:any[] )", "Enrich data")
  async ENRICH(data: any[]) {
    return data.map(item => ({
      ...item,
      timestamp: new Date().toISOString(),
    }));
  }

  @Word("( data:any[] -- result:object )", "Aggregate data")
  async AGGREGATE(data: any[]) {
    return {
      count: data.length,
      sum: data.reduce((acc, item) => acc + item.value, 0),
    };
  }
}

// Build a complete pipeline
await interp.run(`
  ["pipeline"] USE-MODULES

  : RUN-PIPELINE   FETCH CLEAN ENRICH AGGREGATE;
  "data-source-1" RUN-PIPELINE
`);
```

---

## Testing Modules

```typescript
import { Interpreter } from '@forthix/forthic-ts';
import { MyModule } from './my-module';

describe('MyModule', () => {
  let interp: Interpreter;

  beforeEach(() => {
    interp = new Interpreter();
    interp.register_module(new MyModule());
  });

  it('should process data correctly', async () => {
    await interp.run(`
      ["mymodule"] USE-MODULES
      [1 2 3] PROCESS
    `);

    const result = interp.stack_pop();
    expect(result).toEqual([2, 4, 6]);
  });
});
```

---

## Multi-Runtime Execution

📖 **For complete multi-runtime documentation, see [docs/multi-runtime/](../docs/multi-runtime/)**

Call code from other language runtimes transparently - use Python's pandas from TypeScript, or TypeScript's fs module from Ruby.

### Running the Examples

#### Example 5: gRPC Server (Expose TypeScript)

Start TypeScript as a gRPC server to expose runtime-specific modules (like `fs`) to other runtimes:

```bash
# Run the server example
npx tsx examples/05-grpc-server.ts

# Or use the built-in script
npm run grpc:server
```

The server exposes:
- **fs module**: File operations (READ-FILE, WRITE-FILE, FILE-EXISTS?, etc.)

Other runtimes can now connect and use these TypeScript-specific modules!

#### Example 6: gRPC Client (Call Remote Runtimes)

Connect to a Python or Ruby runtime and call their modules from TypeScript:

```bash
# Prerequisites: Start Python gRPC server first
# (In Python forthic runtime)
# forthic-server --port 50051 --modules pandas

# Then run the client example
npx tsx examples/06-grpc-client.ts
```

This example shows:
- Connecting to remote runtime
- Discovering available modules
- Calling Python pandas from TypeScript
- Type-safe cross-runtime execution

### When to Use Multi-Runtime

**Use gRPC when:**
- Running in Node.js (not browser)
- Need high performance
- Calling between server processes (TypeScript ↔ Python ↔ Ruby)
- Using runtime-specific libraries (pandas, Rails models, Node.js fs)

**Use WebSocket when:**
- Running in browser
- Need to call backend runtime from frontend
- Using Rails with ActionCable

**Example use cases:**
- **Data Science**: Call Python pandas/numpy from TypeScript web app
- **File Operations**: Use Node.js fs module from Python workflow
- **Web Apps**: Call Rails business logic from browser Forthic code
- **Microservices**: Compose operations across multiple language services

### Configuration

Create `forthic-runtimes.yaml` in your project root:

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

Load configuration in your code:

```typescript
import { ConfigLoader, RuntimeManager } from '@forthix/forthic/grpc';

const config = await ConfigLoader.load('./forthic-runtimes.yaml');
const manager = RuntimeManager.getInstance();

// Connect to all configured runtimes
for (const [name, runtimeConfig] of Object.entries(config.runtimes)) {
  manager.connectRuntime(name, `${runtimeConfig.host}:${runtimeConfig.port}`);
}
```

### Browser Compatibility

**Important**: gRPC only works in Node.js environments. For browser-compatible multi-runtime execution, use WebSocket:

```typescript
// In browser
import { ActionCableClient, WebSocketRemoteModule } from '@forthix/forthic/websocket';

const client = new ActionCableClient({
  url: 'ws://localhost:3000/cable'
});

const railsModule = new WebSocketRemoteModule('my_module', client, 'rails');
await railsModule.initialize();
```

---

## Additional Resources

- **[Main Forthic Docs](https://github.com/forthix/forthic)** - Core concepts and philosophy
- **[Module Documentation](../docs/modules/)** - Standard library reference
- **[Main README](../README.md)** - Package overview and installation
- **[Contributing](../CONTRIBUTING.md)** - How to contribute

---

## Need Help?

- **Issues:** [Report issues](https://github.com/forthix/forthic-ts/issues)
- **Discussions:** [Ask questions](https://github.com/forthix/forthic/discussions)
- **Examples:** More at [main Forthic repo](https://github.com/forthix/forthic/tree/main/examples)

---

**Start composing transformations today!**
