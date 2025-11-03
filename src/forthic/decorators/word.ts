import { Module, Word as WordClass, RuntimeInfo } from "../module.js";
import { Interpreter } from "../interpreter.js";
import { WordOptions } from "../word_options.js";

// Metadata storage (per class)
const wordMetadata = new WeakMap<any, Map<string, WordMetadata>>();
const directWordMetadata = new WeakMap<any, Map<string, DirectWordMetadata>>();
const moduleMetadata = new WeakMap<any, ModuleMetadata>();

interface WordMetadata {
  stackEffect: string;
  description: string;
  wordName: string;
  methodName: string;
  inputCount: number;
}

interface DirectWordMetadata {
  stackEffect: string;
  description: string;
  wordName: string;
  methodName: string;
}

export interface ModuleMetadata {
  description: string;
  categories: Array<{ name: string; words: string }>;
  optionsInfo?: string;
  examples: string[];
}

/**
 * Parse markdown-formatted module documentation string
 *
 * Expected format:
 * ```
 * Brief description
 *
 * ## Categories
 * - Category Name: WORD1, WORD2, WORD3
 * - Another Category: WORD4, WORD5
 *
 * ## Options
 * Multi-line text describing the options system
 *
 * ## Examples
 * example code line 1
 * example code line 2
 * ```
 */
function parseModuleDocString(docString: string): ModuleMetadata {
  const lines = docString.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const result: ModuleMetadata = {
    description: '',
    categories: [],
    optionsInfo: undefined,
    examples: []
  };

  let currentSection: 'description' | 'categories' | 'options' | 'examples' = 'description';
  let optionsLines: string[] = [];

  for (const line of lines) {
    // Check for section headers
    if (line.startsWith('## Categories')) {
      currentSection = 'categories';
      continue;
    } else if (line.startsWith('## Options')) {
      currentSection = 'options';
      continue;
    } else if (line.startsWith('## Examples')) {
      currentSection = 'examples';
      continue;
    }

    // Process content based on current section
    if (currentSection === 'description') {
      if (result.description) {
        result.description += ' ' + line;
      } else {
        result.description = line;
      }
    } else if (currentSection === 'categories') {
      // Parse "- Category Name: WORD1, WORD2, WORD3"
      const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
      if (match) {
        result.categories.push({
          name: match[1].trim(),
          words: match[2].trim()
        });
      }
    } else if (currentSection === 'options') {
      optionsLines.push(line);
    } else if (currentSection === 'examples') {
      result.examples.push(line);
    }
  }

  // Join options lines into a single string
  if (optionsLines.length > 0) {
    result.optionsInfo = optionsLines.join('\n');
  }

  return result;
}

/**
 * Parse Forthic stack notation to extract input count and optional WordOptions
 * Examples:
 *   "( a:any b:any -- sum:number )" → { inputCount: 2, hasOptions: false }
 *   "( -- value:any )" → { inputCount: 0, hasOptions: false }
 *   "( items:any[] -- first:any )" → { inputCount: 1, hasOptions: false }
 *   "( array:any[] [options:WordOptions] -- flat:any[] )" → { inputCount: 1, hasOptions: true }
 */
function parseStackNotation(stackEffect: string): { inputCount: number; hasOptions: boolean } {
  // Remove parentheses and trim
  const trimmed = stackEffect.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    throw new Error(`Stack effect must be wrapped in parentheses: ${stackEffect}`);
  }

  const content = trimmed.slice(1, -1).trim();
  const parts = content.split("--").map(s => s.trim());
  if (parts.length !== 2) {
    throw new Error(`Invalid stack notation: ${stackEffect}`);
  }

  const inputPart = parts[0];
  if (inputPart === "") {
    return { inputCount: 0, hasOptions: false };
  }

  // Check for optional [options:WordOptions] parameter
  const hasOptions = /\[options:WordOptions\]/.test(inputPart);

  // Remove optional parameter from counting
  const withoutOptional = inputPart.replace(/\[options:WordOptions\]/g, '').trim();

  // Split by whitespace, count non-empty tokens
  const inputs = withoutOptional.split(/\s+/).filter(s => s.length > 0);

  return {
    inputCount: inputs.length,
    hasOptions: hasOptions
  };
}

/**
 * @DirectWord Decorator
 *
 * Auto-registers word but does NOT handle stack marshalling.
 * Use this for words that need direct interpreter access to manually manipulate the stack.
 * Word name defaults to method name, but can be overridden.
 *
 * @param stackEffect - Forthic stack notation (e.g., "( item:any forthic:string n:number -- )")
 * @param description - Human-readable description for docs
 * @param customWordName - Optional custom word name (defaults to method name)
 *
 * @example
 * @DirectWord("( item:any forthic:string num:number -- )", "Repeat execution num_times", "<REPEAT")
 * async l_REPEAT(interp: Interpreter) {
 *   const num = interp.stack_pop();
 *   const forthic = interp.stack_pop();
 *   // ... manual stack manipulation
 * }
 */
export function DirectWord(stackEffect: string, description: string = "", customWordName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const wordName = customWordName || propertyKey;

    // Store metadata for registration and documentation
    if (!directWordMetadata.has(target.constructor)) {
      directWordMetadata.set(target.constructor, new Map());
    }
    const classMetadata = directWordMetadata.get(target.constructor)!;
    classMetadata.set(propertyKey, {
      stackEffect,
      description,
      wordName: wordName,
      methodName: propertyKey,
    });

    // Method is NOT wrapped - it's used as-is
    return descriptor;
  };
}

/**
 * @Word Decorator
 *
 * Auto-registers word and handles stack marshalling.
 * Word name defaults to method name, but can be overridden.
 *
 * @param stackEffect - Forthic stack notation (e.g., "( a:any b:any -- sum:number )")
 * @param description - Human-readable description for docs
 * @param customWordName - Optional custom word name (defaults to method name)
 *
 * @example
 * @Word("( a:number b:number -- sum:number )", "Adds two numbers")
 * async ADD(a: number, b: number) {
 *   return a + b;
 * }
 *
 * @example
 * @Word("( rec:any field:any -- value:any )", "Get value from record", "REC@")
 * async REC_at(rec: any, field: any) {
 *   // Word name will be "REC@" instead of "REC_at"
 * }
 */
export function Word(stackEffect: string, description: string = "", customWordName?: string) {
  return function(target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
    // Get the original method from the descriptor if available, otherwise from target
    const originalMethod = descriptor?.value || target[propertyKey];

    if (!originalMethod) {
      throw new Error(`@Word decorator: No method found for ${propertyKey}`);
    }

    const parsed = parseStackNotation(stackEffect);
    const wordName = customWordName || propertyKey;

    // Store metadata for registration and documentation
    if (!wordMetadata.has(target.constructor)) {
      wordMetadata.set(target.constructor, new Map());
    }
    const classMetadata = wordMetadata.get(target.constructor)!;
    classMetadata.set(propertyKey, {
      stackEffect,
      description,
      wordName: wordName,
      methodName: propertyKey,
      inputCount: parsed.inputCount,
    });

    // Create wrapper function that handles stack marshalling
    const wrappedMethod = async function(this: Module, interp: Interpreter) {
      const inputs: any[] = [];

      // Check for optional WordOptions FIRST (before popping regular args)
      let options: Record<string, any> | null = null;
      if (parsed.hasOptions && interp.get_stack().length > 0) {
        const top = interp.stack_peek();
        if (top instanceof WordOptions) {
          const opts = interp.stack_pop() as WordOptions;
          options = opts.toRecord();
        }
      }

      // Pop required inputs in reverse order (stack is LIFO)
      for (let i = 0; i < parsed.inputCount; i++) {
        inputs.unshift(interp.stack_pop());
      }

      // Add options as last parameter if method expects it
      if (parsed.hasOptions) {
        inputs.push(options || {});
      }

      // Call original method with popped inputs (+ options if present)
      const result = await originalMethod.apply(this, inputs);

      // Push result if not undefined (user requirement)
      if (result !== undefined) {
        interp.stack_push(result);
      }
    };

    // Return modified descriptor if one was provided, otherwise modify target directly
    if (descriptor) {
      descriptor.value = wrappedMethod;
      return descriptor;
    } else {
      // For environments without descriptor (like experimental decorators)
      target[propertyKey] = wrappedMethod;
    }
  };
}

/**
 * Helper function to register module documentation
 *
 * Call this in your module class as a static initializer:
 * ```typescript
 * export class ArrayModule extends DecoratedModule {
 *   static {
 *     registerModuleDoc(ArrayModule, `
 *       Array and collection operations
 *       ## Categories
 *       - Access: NTH, LAST, SLICE
 *     `);
 *   }
 * }
 * ```
 */
export function registerModuleDoc(constructor: any, docString: string): void {
  const parsed = parseModuleDocString(docString);
  moduleMetadata.set(constructor, parsed);
}

/**
 * DecoratedModule - Base class for modules using @Word decorator
 *
 * Automatically registers all @Word decorated methods when interpreter is set.
 */
export class DecoratedModule extends Module {
  constructor(name: string) {
    super(name);
  }

  set_interp(interp: Interpreter): void {
    super.set_interp(interp);
    this.registerDecoratedWords();
  }

  private registerDecoratedWords() {
    // Register @Word decorated methods
    const classMetadata = wordMetadata.get(this.constructor);
    if (classMetadata) {
      for (const [methodName, metadata] of classMetadata.entries()) {
        // Get the wrapped method (already modified by decorator)
        const method = (this as any)[methodName];

        // Register as exportable word with standard library flag
        this.add_standard_word(metadata.wordName, method.bind(this));
      }
    }

    // Register @DirectWord decorated methods
    const directClassMetadata = directWordMetadata.get(this.constructor);
    if (directClassMetadata) {
      for (const [methodName, metadata] of directClassMetadata.entries()) {
        // Get the original method (NOT wrapped by decorator)
        const method = (this as any)[methodName];

        // Register as exportable word with standard library flag
        this.add_standard_word(metadata.wordName, method.bind(this));
      }
    }
  }

  /**
   * Add a standard library word that can execute in any runtime
   *
   * This creates a word marked with isStandard=true, allowing it to be
   * included in batched remote execution (e.g., +, MAP, REVERSE can execute
   * in Python runtime along with Python-specific words).
   */
  private add_standard_word(word_name: string, word_func: (interp: Interpreter) => Promise<void>): void {
    const word = new WordClass(word_name);
    word.execute = word_func;

    // Override getRuntimeInfo to mark as standard library word
    word.getRuntimeInfo = (): RuntimeInfo => ({
      runtime: "local",
      isRemote: false,
      isStandard: true,
      availableIn: ["typescript", "python", "ruby", "rust", "swift", "java"]
    });

    this.add_exportable_word(word);
  }

  /**
   * Get documentation for all words in this module
   *
   * @returns Array of {name, stackEffect, description} objects
   */
  getWordDocs(): Array<{ name: string, stackEffect: string, description: string }> {
    const docs: Array<{ name: string, stackEffect: string, description: string }> = [];

    // Get @Word decorated methods
    const classMetadata = wordMetadata.get(this.constructor);
    if (classMetadata) {
      docs.push(...Array.from(classMetadata.values()).map(meta => ({
        name: meta.wordName,
        stackEffect: meta.stackEffect,
        description: meta.description,
      })));
    }

    // Get @DirectWord decorated methods
    const directClassMetadata = directWordMetadata.get(this.constructor);
    if (directClassMetadata) {
      docs.push(...Array.from(directClassMetadata.values()).map(meta => ({
        name: meta.wordName,
        stackEffect: meta.stackEffect,
        description: meta.description,
      })));
    }

    return docs;
  }

  /**
   * Get module-level documentation from @Module decorator
   *
   * @returns ModuleMetadata with name, description, categories, options, and examples
   */
  getModuleMetadata(): (ModuleMetadata & { name: string }) | null {
    const parsed = moduleMetadata.get(this.constructor);
    if (!parsed) {
      return null;
    }

    // Combine parsed metadata with the module name from the instance
    return {
      name: this.get_name(),
      ...parsed
    };
  }
}
