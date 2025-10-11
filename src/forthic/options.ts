import type { Interpreter } from "./interpreter";

/**
 * WordOptions - Type-safe options container
 *
 * Created from flat array: [.key1 val1 .key2 val2]
 * Accessed by words that support options
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
