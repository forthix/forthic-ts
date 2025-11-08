# Forthic TypeScript Runtime

**A TypeScript/JavaScript runtime for [Forthic](https://github.com/forthix/forthic)** - *the* stack-based, concatenative language for composable transformations.

Use Forthic to wrap your TypeScript/JavaScript code within composable words, leveraging categorical principles for clean, powerful abstractions.

**[Forthic Parent Documentation](https://github.com/forthix/forthic)** | **[Getting Started with forthic-ts](#getting-started)** | **[Examples](examples/)** | **[API Docs](docs/)**

---

## What is Forthic?

Forthic enables **categorical coding** - a way to solve problems by viewing them in terms of trasnformation rather than copmutation. This TypeScript runtime lets you:

1. **Wrap existing code** with simple decorators
2. **Compose transformations** cleanly using stack-based operations
3. **Build powerful abstractions** from simple primitives

See the [Forthic repository](https://github.com/forthix/forthic) for philosophy, core concepts, and why categorical coding matters.

---

## Quick Example

### Create a Module

```typescript
import { DecoratedModule, Word } from '@forthix/forthic';

export class AnalyticsModule extends DecoratedModule {
  constructor() {
    super("analytics");
  }

  @Word("( numbers:number[] -- avg:number )", "Calculate average")
  async AVERAGE(numbers: number[]) {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  @Word("( numbers:number[] stdDevs:number -- filtered:number[] )", "Filter outliers")
  async FILTER_OUTLIERS(numbers: number[], stdDevs: number) {
    // Your existing logic here
    return filteredNumbers;
  }
}
```

### Use It

```typescript
import { Interpreter } from '@forthix/forthic';
import { AnalyticsModule } from './analytics-module';

const interp = new Interpreter();
interp.register_module(new AnalyticsModule());

await interp.run(`
  ["analytics"] USE-MODULES

  [1 2 3 100 4 5] 2 FILTER-OUTLIERS AVERAGE
`);

const result = interp.stack_pop(); // Clean average without outliers
```

---

## Installation

### npm

```bash
npm install @forthix/forthic
```

### yarn

```bash
yarn add @forthix/forthic
```

---

## Getting Started

### Node.js Usage

```typescript
import { Interpreter } from '@forthix/forthic';

const interp = new Interpreter();

// Execute Forthic code
await interp.run(`
  [1 2 3 4 5] "2 *" MAP  # Double each element
`);

const result = interp.stack_pop(); // [2, 4, 6, 8, 10]
```

### Browser Usage

```html
<script type="module">
  import { Interpreter } from 'https://unpkg.com/@forthix/forthic';

  const interp = new Interpreter();
  await interp.run('[1 2 3] "2 *" MAP');
  console.log(interp.stack_pop()); // [2, 4, 6]
</script>
```

### Creating Your First Module

```typescript
import { DecoratedModule, Word } from '@forthix/forthic';

export class MyModule extends DecoratedModule {
  constructor() {
    super("mymodule");
  }

  @Word("( data:any[] -- result:any )", "Process data your way")
  async PROCESS(data: any[]) {
    // Wrap your existing code
    return myExistingFunction(data);
  }
}

// Register and use
const interp = new Interpreter();
interp.register_module(new MyModule());

await interp.run(`
  ["mymodule"] USE-MODULES
  SOME-DATA PROCESS
`);
```

See [examples/README.md](examples/README.md) for detailed tutorials and examples.

---

## Features

### Standard Library

The TypeScript runtime includes comprehensive standard modules:

- **array** - MAP, SELECT, SORT, GROUP-BY, ZIP, REDUCE, FLATTEN (30+ operations)
- **record** - REC@, <REC, MERGE, KEYS, VALUES, INVERT-KEYS
- **string** - SPLIT, JOIN, UPPERCASE, LOWERCASE, TRIM, REPLACE
- **math** - +, -, *, /, ROUND, ABS, MIN, MAX, AVERAGE
- **datetime** - >DATE, >DATETIME, ADD-DAYS, FORMAT, DIFF-DAYS (Temporal API)
- **json** - >JSON, JSON>, JSON-PRETTIFY
- **boolean** - ==, <, >, AND, OR, NOT, IN

See [docs/modules/](docs/modules/) for complete reference.

### Easy Module Creation

The `@Word` decorator makes wrapping code trivial:

```typescript
@Word("( input:type -- output:type )", "Description", "MY-WORD")
async MY_WORD(input: any) {
  return yourLogic(input);
}
```

### TypeScript & JavaScript Support

- Full TypeScript type definitions
- Works with ES modules and CommonJS
- Browser and Node.js compatible
- Supports async/await


### Package Exports

forthic-ts provides multiple import paths for different use cases:

```typescript
// Main package - Core interpreter and standard library (works everywhere)
import { Interpreter, DecoratedModule, Word } from '@forthix/forthic';

// WebSocket support - Browser-compatible multi-runtime execution
import { ActionCableClient, WebSocketRemoteModule } from '@forthix/forthic/websocket';

// gRPC support - Node.js-only multi-runtime execution
import { GrpcClient, RemoteModule, startGrpcServer } from '@forthix/forthic/grpc';
```

**Environment Compatibility**:
- **Main package** (`@forthix/forthic`): Works in both Node.js and browsers
- **WebSocket** (`@forthix/forthic/websocket`): Works in both Node.js and browsers
- **gRPC** (`@forthix/forthic/grpc`): Node.js only (requires `@grpc/grpc-js`)

---

## Documentation

### This Runtime
- **[Getting Started](docs/getting-started.md)** - TypeScript-specific setup
- **[Module API Reference](docs/modules/)** - Standard library documentation
- **[Examples](examples/)** - Working code samples

### Core Forthic Concepts
- **[Main Forthic Docs](https://github.com/forthix/forthic)** - Philosophy, language guide
- **[Why Forthic?](https://github.com/forthix/forthic/blob/main/docs/why-forthic.md)** - Motivation and core principles
- **[Category Theory](https://github.com/forthix/forthic/blob/main/docs/language/category-theory.md)** - Mathematical foundations
- **[Building Modules](https://github.com/forthix/forthic/blob/main/docs/tutorials/building-modules.md)** - Module creation patterns

---

## Examples

See examples in the [examples](examples/) directory.

---

## Building

```bash
# Install dependencies
npm install

# Build both CJS and ESM
npm run build

# Run tests
npm test

# Generate documentation
npm run docs:build
```

---

## Multi-Runtime Execution

Call code from other language runtimes seamlessly - use Python's pandas from TypeScript, or TypeScript's fs module from Ruby.

### Quick Example

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
await interp.run(`["pandas"] USE-MODULES  [records] DF-FROM-RECORDS`);
```

### Approaches

- **gRPC** - Node.js ↔ Python ↔ Ruby (fast, server-to-server)
- **WebSocket** - Browser ↔ Rails (ActionCable, client-server)

### Learn More

📖 **[Complete Multi-Runtime Documentation](docs/multi-runtime/)**

- **[Overview](docs/multi-runtime/)** - When and how to use multi-runtime
- **[gRPC Setup](docs/multi-runtime/grpc.md)** - Server and client configuration
- **[WebSocket Setup](docs/multi-runtime/websocket.md)** - Browser-compatible communication
- **[Configuration](docs/multi-runtime/configuration.md)** - YAML config and connection management
- **[Examples](examples/)** - Working code samples (05-grpc-server.ts, 06-grpc-client.ts)

**Runtime Status:** ✅ TypeScript, Python, Ruby | 🚧 Rust | 📋 Java, .NET

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- TypeScript coding standards
- Testing guidelines
- PR process

Also see the [main Forthic contributing guide](https://github.com/forthix/forthic/blob/main/CONTRIBUTING.md) for philosophy and community guidelines.

---

## Community

- **Main Repository:** [forthix/forthic](https://github.com/forthix/forthic)
- **Issues:** [Report issues](https://github.com/forthix/forthic-ts/issues)
- **Discussions:** [GitHub Discussions](https://github.com/forthix/forthic-ts/discussions)
- **Examples:** [Real-world applications](https://github.com/forthix/forthic-ts#examples)

---

## License

[BSD-2-Clause License](LICENSE) - Copyright 2024 LinkedIn Corporation. Copyright 2025 Forthix LLC.

---

## Related

- **[Forthic (main repo)](https://github.com/forthix/forthic)** - Core documentation and concepts

---

**Forthic**: Wrap. Compose. Abstract.
