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

1. **01-hello.forthic** - Simple "Hello World"
2. **02-arrays.forthic** - Array operations (MAP, SELECT, REDUCE)
3. **03-records.forthic** - Record manipulation (REC@, KEYS, VALUES)
4. **04-composition.forthic** - Defining and composing words

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
  ["math"] USE_MODULES
  5 3 math.ADD      # 8
  math.SQUARE       # 64
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
  {"name" "Alice" "age" 30 "score" 95}

  # Extract field
  DUP "name" REC@     # "Alice"

  # Update field
  {"score" 100} MERGE # {"name" "Alice" "age" 30 "score" 100}
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
  ["users"] USE_MODULES
  "user-123" users.FIND
  {"email" "newemail@example.com"} users.UPDATE
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
  ["reporting"] USE_MODULES

  : ANALYZE-AND-REPORT
      reporting.STATS
      reporting.FORMAT-STATS
  ;

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
  {"name" "Alice" "age" 30}
    RECORD>JSON     # JSON string
    JSON>RECORD     # Back to record
`);
```

### Error Handling

```typescript
export class ValidationModule extends DecoratedModule {
  constructor() {
    super("validation");
  }

  @Word("( data:any -- validData:any )", "Validate data")
  async VALIDATE(data: any) {
    if (!data.email || !data.email.includes('@')) {
      throw new Error('Invalid email address');
    }
    return data;
  }
}

// Use with error handling in Forthic
await interp.run(`
  ["validation"] USE_MODULES

  TRY
    user-data validation.VALIDATE
  CATCH
    "Validation failed: " SWAP + PRINTLN
  END-TRY
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
  ["pipeline"] USE_MODULES

  : RUN-PIPELINE
      pipeline.FETCH
      pipeline.CLEAN
      pipeline.ENRICH
      pipeline.AGGREGATE
  ;

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
      ["mymodule"] USE_MODULES
      [1 2 3] mymodule.PROCESS
    `);

    const result = interp.stack_pop();
    expect(result).toEqual([2, 4, 6]);
  });
});
```

---

## Additional Resources

- **[Main Forthic Docs](https://github.com/forthix/forthic)** - Core concepts and philosophy
- **[Module Documentation](../docs/modules/)** - Standard library reference
- **[Getting Started](../docs/getting-started.md)** - Detailed tutorial
- **[Contributing](../CONTRIBUTING.md)** - How to contribute

---

## Need Help?

- **Issues:** [Report issues](https://github.com/forthix/forthic-ts/issues)
- **Discussions:** [Ask questions](https://github.com/forthix/forthic/discussions)
- **Examples:** More at [main Forthic repo](https://github.com/forthix/forthic/tree/main/examples)

---

**Start composing transformations today!**
