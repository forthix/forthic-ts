import type { Interpreter } from "./interpreter";

/**
 * WordOptions - Type-safe options container for module words
 *
 * Overview:
 * WordOptions provides a structured way for Forthic words to accept optional
 * configuration parameters without requiring fixed parameter positions. This
 * enables flexible, extensible APIs similar to keyword arguments in other languages.
 *
 * Usage in Forthic:
 *   [.option_name value ...] ~> WORD
 *
 * The ~> operator takes an options array and a word, passing the options as
 * an additional parameter to words that support them.
 *
 * Example in Forthic code:
 *   [1 2 3] '2 *' [.with_key TRUE] ~> MAP
 *   [10 20 30] [.comparator "-1 *"] ~> SORT
 *   [[[1 2]]] [.depth 1] ~> FLATTEN
 *
 * Implementation in Module Words:
 * Words declare options support by adding an options parameter with type Record<string, any>:
 *
 *   @Word("( items:any[] forthic:string [options:WordOptions] -- result:any )")
 *   async MAP(items: any[], forthic: string, options: Record<string, any>) {
 *     const with_key = options.with_key ?? null;
 *     const push_error = options.push_error ?? null;
 *     // ... use options to modify behavior
 *   }
 *
 * The @Word decorator automatically:
 * 1. Checks if the top stack item is a WordOptions instance
 * 2. Converts it to a plain Record<string, any> if present
 * 3. Passes an empty {} if no options provided
 *
 * Common Patterns:
 * - Boolean flags: options.with_key ?? null
 * - Numeric values: options.depth ?? null
 * - String values: options.comparator ?? undefined
 * - Multiple options: All accessed from same options object
 *
 * Internal Representation:
 * Created from flat array: [.key1 val1 .key2 val2]
 * Stored as Map internally for efficient lookup
 * Converted to Record<string, any> when passed to words
 *
 * Note: Dot-symbols in Forthic have the leading '.' already stripped,
 * so keys come in as "key1", "key2", etc.
 */
export class WordOptions {
  private options: Map<string, any>;

  constructor(flatArray: any[]) {
    if (!Array.isArray(flatArray)) {
      throw new Error("Options must be an array");
    }

    if (flatArray.length % 2 !== 0) {
      throw new Error(
        `Options must be key-value pairs (even length). Got ${flatArray.length} elements`
      );
    }

    this.options = new Map();

    for (let i = 0; i < flatArray.length; i += 2) {
      const key = flatArray[i];
      const value = flatArray[i + 1];

      // Key should be a string (dot-symbol with . already stripped)
      if (typeof key !== "string") {
        throw new Error(
          `Option key must be a string (dot-symbol). Got: ${typeof key}`
        );
      }

      this.options.set(key, value);
    }
  }

  /**
   * Get option value with optional default
   */
  get(key: string, defaultValue?: any): any {
    return this.options.has(key) ? this.options.get(key) : defaultValue;
  }

  /**
   * Check if option exists
   */
  has(key: string): boolean {
    return this.options.has(key);
  }

  /**
   * Get all options as plain object
   */
  toRecord(): Record<string, any> {
    return Object.fromEntries(this.options);
  }

  /**
   * Get all option keys
   */
  keys(): string[] {
    return Array.from(this.options.keys());
  }

  /**
   * For debugging/display
   */
  toString(): string {
    const pairs = Array.from(this.options.entries())
      .map(([k, v]) => `.${k} ${JSON.stringify(v)}`)
      .join(" ");
    return `<WordOptions: ${pairs}>`;
  }
}

/**
 * Helper for words to check if top of stack is WordOptions
 * and pop it if present. Returns empty object if not present.
 */
export function popOptionsIfPresent(interp: Interpreter): Record<string, any> {
  if (interp.get_stack().length === 0) {
    return {};
  }

  const top = interp.stack_peek();
  if (top instanceof WordOptions) {
    const opts = interp.stack_pop() as WordOptions;
    return opts.toRecord();
  }

  return {};
}
