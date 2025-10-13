# Forthic TypeScript Runtime

**A TypeScript/JavaScript runtime for [Forthic](https://github.com/forthix/forthic)** - the stack-based, concatenative language for composable transformations.

Use Forthic to wrap your TypeScript/JavaScript code in composable transformations, leveraging categorical principles for clean, powerful abstractions.

**[Main Forthic Documentation](https://github.com/forthix/forthic)** | **[Getting Started](#getting-started)** | **[Examples](examples/)** | **[API Docs](docs/)**

---

## What is Forthic?

Forthic enables **categorical coding** - using Category Theory principles to build composable transformations. This TypeScript runtime lets you:

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
  ["analytics"] USE_MODULES

  [1 2 3 100 4 5] 2 FILTER-OUTLIERS analytics.AVERAGE
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
  ["mymodule"] USE_MODULES
  SOME-DATA PROCESS
`);
```

See [docs/getting-started.md](docs/getting-started.md) for detailed tutorial.

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
@Word("( input:type -- output:type )", "Description")
async MY_WORD(input: any) {
  return yourLogic(input);
}
```

### TypeScript & JavaScript Support

- Full TypeScript type definitions
- Works with ES modules and CommonJS
- Browser and Node.js compatible
- Supports async/await

### Composition-First Design

```typescript
// Build higher-level abstractions through composition
await interp.run(`
  : CLEAN-AVERAGE   2 analytics.FILTER-OUTLIERS analytics.AVERAGE ;

  dataset-1 CLEAN-AVERAGE
  dataset-2 CLEAN-AVERAGE
  dataset-3 CLEAN-AVERAGE
`);
```

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

### Data Transformation Pipeline

```typescript
await interp.run(`
  data-records
    'DUP "score" REC@ 80 >' SELECT    # Filter records with score > 80
    '"name" REC@' MAP                  # Extract names
    'UPPERCASE' MAP                    # Convert to uppercase
    ', ' JOIN                          # Join into comma-separated string
`);
```

### Wrapping Business Logic

```typescript
export class OrderModule extends DecoratedModule {
  constructor(private orderService: OrderService) {
    super("orders");
  }

  @Word("( order:object -- validatedOrder:object )", "Validate order")
  async VALIDATE(order: any) {
    return this.orderService.validate(order);
  }

  @Word("( order:object -- orderWithTax:object )", "Calculate tax")
  async CALCULATE_TAX(order: any) {
    return this.orderService.calculateTax(order);
  }

  @Word("( order:object -- submittedOrder:object )", "Submit order")
  async SUBMIT(order: any) {
    return this.orderService.submit(order);
  }
}

// Compose into high-level workflow
await interp.run(`
  ["orders"] USE_MODULES

  : PROCESS-ORDER
      VALIDATE
      CALCULATE-TAX
      SUBMIT
  ;

  new-order PROCESS-ORDER
`);
```

More examples in [examples/](examples/) directory.

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

## Multi-Runtime Vision

Forthic is designed to work **seamlessly across multiple runtimes** (TypeScript, Java, Python, Ruby, .NET). Call Java modules from TypeScript, Python ML models from .NET - all transparently.

See [Multi-Runtime Architecture](https://github.com/forthix/forthic/tree/main/docs/multi-runtime) for the vision.

**Status:** TypeScript runtime is active. Java in progress. Python, Ruby, .NET planned.

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

**Forthic TypeScript: Wrap your code. Compose transformations. Build powerful abstractions.**
