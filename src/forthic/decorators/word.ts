import { Module } from "../module";
import { Interpreter } from "../interpreter";
import { WordOptions } from "../options";

// Metadata storage (per class)
const wordMetadata = new WeakMap<any, Map<string, WordMetadata>>();

interface WordMetadata {
  stackEffect: string;
  description: string;
  wordName: string;
  methodName: string;
  inputCount: number;
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
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
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

    // Replace method with wrapper that handles stack marshalling
    descriptor.value = async function(this: Module, interp: Interpreter) {
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

    return descriptor;
  };
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
    const classMetadata = wordMetadata.get(this.constructor);
    if (!classMetadata) return;

    for (const [methodName, metadata] of classMetadata.entries()) {
      // Get the wrapped method (already modified by decorator)
      const method = (this as any)[methodName];

      // Register as exportable word
      this.add_module_word(metadata.wordName, method.bind(this));
    }
  }

  /**
   * Get documentation for all words in this module
   *
   * @returns Array of {name, stackEffect, description} objects
   */
  getWordDocs(): Array<{ name: string, stackEffect: string, description: string }> {
    const classMetadata = wordMetadata.get(this.constructor);
    if (!classMetadata) return [];

    return Array.from(classMetadata.values()).map(meta => ({
      name: meta.wordName,
      stackEffect: meta.stackEffect,
      description: meta.description,
    }));
  }
}
