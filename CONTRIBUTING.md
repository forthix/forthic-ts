# Contributing to Forthic TypeScript Runtime

Thank you for your interest in contributing to the Forthic TypeScript runtime! Whether you're fixing bugs, adding features, writing documentation, or creating modules, your contributions help make categorical coding accessible to everyone.

---

## Quick Links

- **[Main Forthic Contributing Guide](https://github.com/forthix/forthic/blob/main/CONTRIBUTING.md)** - Philosophy, values, community guidelines
- **[Main Forthic Repo](https://github.com/forthix/forthic)** - Core documentation
- **[Issues](https://github.com/forthix/forthic-ts/issues)** - Bug reports and feature requests
- **[Discussions](https://github.com/forthix/forthic-ts/discussions)** - Questions and ideas

---

## Ways to Contribute

### 1. Report Bugs

[Open an issue](https://github.com/forthix/forthic-ts/issues) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- TypeScript version and environment (Node.js version, browser, etc.)
- Code sample if possible

### 2. Suggest Features

[Start a discussion](https://github.com/forthix/forthic-ts/discussions) about:
- What problem it solves
- How it fits with Forthic's philosophy
- Example usage
- Whether it belongs in core vs. a module

### 3. Improve Documentation

- Fix typos or clarify confusing sections
- Add examples to existing docs
- Write tutorials for common patterns
- Improve inline code documentation

### 4. Write Code

Contribute to:
- TypeScript runtime implementation
- Standard library modules (array, record, string, etc.)
- Developer tools
- Example applications

### 5. Create Modules

Share reusable modules:
- Wrap popular npm packages
- Create domain-specific vocabularies
- Build integrations (APIs, databases, etc.)

---

## Development Setup

### Prerequisites

- **Node.js** 18+ (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- **npm** 9+ (comes with Node.js)
- **TypeScript** 5.7+ (installed via npm)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/forthix/forthic-ts
cd forthic-ts

# Install dependencies
npm install

# Run tests
npm test

# Build (both CJS and ESM)
npm run build

# Watch tests during development
npm run test:watch

# Generate documentation
npm run docs:build
```

### Project Structure

```
forthic-ts/
├── src/
│   ├── forthic/           # Core interpreter
│   │   ├── interpreter.ts # Main interpreter
│   │   ├── tokenizer.ts   # Lexical analysis
│   │   └── ...
│   ├── modules/           # Standard library modules
│   │   ├── array.ts       # Array operations
│   │   ├── record.ts      # Record operations
│   │   └── ...
│   ├── decorators/        # @Word decorator and helpers
│   └── index.ts           # Public API exports
├── dist/
│   ├── cjs/               # CommonJS build
│   └── esm/               # ES modules build
├── docs/                  # Generated documentation
├── examples/              # Example code
└── tests/                 # Test files (co-located with source)
```

---

## Development Workflow

### Making Changes

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/my-feature`
3. **Make your changes** (see coding standards below)
4. **Write tests** for new functionality
5. **Run tests:** `npm test` - ensure all tests pass
6. **Run linter:** `npm run lint` (if available)
7. **Build:** `npm run build` - ensure it builds successfully
8. **Commit:** Use clear, descriptive commit messages
9. **Push:** `git push origin feature/my-feature`
10. **Open a Pull Request** with description of changes

### Pull Request Guidelines

**Good PR:**
- Focused on a single feature/fix
- Includes tests
- Updates relevant documentation
- Has clear commit messages
- Passes all CI checks

**PR description should include:**
- What problem does this solve?
- How does it solve it?
- Any breaking changes?
- Examples of usage (if applicable)

---

## Coding Standards

### TypeScript Standards

#### Module Structure

```typescript
import { DecoratedModule, Word, registerModuleDoc } from '../decorators/word';

export class MyModule extends DecoratedModule {
  static {
    registerModuleDoc(MyModule, `
Module description here.

## Examples

\`\`\`forthic
["mymodule"] USE_MODULES
example usage here
\`\`\`
    `);
  }

  constructor() {
    super("mymodule");
  }

  @Word("( input:type -- output:type )", "Word description")
  async MY_WORD(input: any) {
    // Implementation
    return result;
  }
}
```

#### Naming Conventions

- **Module names:** lowercase (e.g., `array`, `record`)
- **Word names:** UPPERCASE with underscores (e.g., `MAP`, `FILTER_OUTLIERS`)
- **TypeScript classes:** PascalCase (e.g., `ArrayModule`, `RecordModule`)
- **TypeScript constants:** UPPER_SNAKE_CASE (e.g., `DEFAULT_PORT`)

#### Documentation

Every word should have:
- **Stack effect:** `( input:type -- output:type )`
- **Description:** Clear, concise explanation
- **Examples:** In module-level documentation

```typescript
@Word("( array:any[] fn:string -- result:any[] )", "Apply function to each element")
async MAP(array: any[], fn: string) {
  // Implementation
}
```

#### Type Safety

- Use TypeScript types where appropriate
- Prefer `unknown` over `any` when type is truly unknown
- Document type conversions
- Handle type errors gracefully

```typescript
// Good
async MY_WORD(input: unknown): Promise<number> {
  if (typeof input !== 'number') {
    throw new Error('Expected number');
  }
  return input * 2;
}

// Avoid
async MY_WORD(input: any): Promise<any> {
  return input * 2;
}
```

#### Error Handling

- Use descriptive error messages
- Include context (stack trace, input values)
- Create custom error types when appropriate

```typescript
if (array.length === 0) {
  throw new Error('AVERAGE requires non-empty array');
}
```

#### Async/Await

- All word implementations should be `async`
- Use `await` for asynchronous operations
- Handle promise rejections

```typescript
@Word("( url:string -- data:any )", "Fetch data from URL")
async FETCH(url: string) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}
```

---

## Testing Guidelines

### Writing Tests

We use **Jest** for testing.

#### Test Structure

```typescript
import { Interpreter } from '../forthic/interpreter';

describe('ArrayModule', () => {
  let interp: Interpreter;

  beforeEach(() => {
    interp = new Interpreter();
  });

  describe('MAP', () => {
    it('should double each element', async () => {
      await interp.run('[1 2 3] "2 *" MAP');
      expect(interp.stack_pop()).toEqual([2, 4, 6]);
    });

    it('should handle empty arrays', async () => {
      await interp.run('[] "2 *" MAP');
      expect(interp.stack_pop()).toEqual([]);
    });

    it('should throw on invalid function', async () => {
      await expect(
        interp.run('[1 2 3] "INVALID" MAP')
      ).rejects.toThrow();
    });
  });
});
```

#### What to Test

- **Happy path:** Normal, expected usage
- **Edge cases:** Empty arrays, zero, negative numbers, etc.
- **Error conditions:** Invalid inputs, type errors
- **Composition:** Words working together

#### Running Tests

```bash
# Run all tests
npm test

# Watch mode (runs tests on file changes)
npm run test:watch

# Run specific test file
npm test -- array.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="MAP"
```

---

## Code Style

### Formatting

We use **Prettier** for code formatting:

```bash
# Format all files
npm run pretty
```

Configuration in `.prettierrc`:
- Print width: 120
- 2 spaces for indentation
- Single quotes for strings

### Linting

We use **ESLint** for code quality:

```bash
# Run linter (if configured)
npm run lint
```

---

## Documentation

### Writing Good Documentation

1. **Start with "why"** - Explain the purpose
2. **Show examples** - Code speaks louder than words
3. **Be concise** - Get to the point
4. **Use headers** - Make it scannable
5. **Link to related docs** - Help users discover more

### Module Documentation

Generated automatically from code:

```typescript
static {
  registerModuleDoc(MyModule, `
# MyModule

Brief description of what this module does.

## Examples

\`\`\`forthic
["mymodule"] USE_MODULES

# Example 1: Basic usage
input MY-WORD

# Example 2: Composition
data TRANSFORM mymodule.PROCESS
\`\`\`
  `);
}
```

Generate docs:

```bash
npm run docs:build
```

---

## Philosophy Alignment

Contributions should align with these values:

### Good Fit

- Makes categorical coding more accessible
- Improves composition and abstraction
- Helps wrap existing code
- Enhances documentation
- Shares knowledge openly
- Focuses on practical value

### Not a Good Fit

- Adds unnecessary complexity
- Breaks backward compatibility without good reason
- Goes against categorical principles

See [main Forthic contributing guide](https://github.com/forthix/forthic/blob/main/CONTRIBUTING.md) for complete philosophy.

---

## Getting Help

Need guidance?

- **Questions:** [GitHub Discussions](https://github.com/forthix/forthic/discussions)
- **Bugs:** [GitHub Issues](https://github.com/forthix/forthic-ts/issues)
- **Concepts:** [Main Forthic Docs](https://github.com/forthix/forthic)

---

## Release Process

(For maintainers)

1. Update version in `package.json`
2. Update documentation if needed
3. Run full test suite: `npm test`
4. Build: `npm run build`
5. Tag release: `git tag v0.x.x`
6. Push: `git push --tags`
7. Publish: `npm publish`
8. Create GitHub release with notes

---

## License

By contributing, you agree that your contributions will be licensed under the BSD-2-Clause License.

---

**Thank you for contributing to Forthic!**

