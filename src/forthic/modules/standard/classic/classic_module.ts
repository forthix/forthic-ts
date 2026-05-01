import { Interpreter } from "../../../interpreter.js";
import { DecoratedModule, ForthicWord, ForthicDirectWord, registerModuleDoc } from "../../../decorators/word.js";

/**
 * ClassicModule - holds legacy/classic Forthic words that remain live
 * for back-compat but are not surfaced in the LLM-targeted documentation.
 *
 * Words living here continue to parse and execute identically to before.
 * The split is purely a documentation / prompt-generation concern: the doc
 * generator targets `modules/standard/*.ts` (top level only) and excludes
 * this directory, so classic words don't appear in small-LLM system prompts.
 *
 * Word migrations into this module are landed incrementally. Implementations
 * are inlined here rather than delegated cross-module so the file is
 * self-contained.
 */
export class ClassicModule extends DecoratedModule {
  static {
    registerModuleDoc(
      ClassicModule,
      `
Legacy/classic Forthic words retained for back-compat.

These words remain fully functional at runtime. They are intentionally
omitted from LLM-targeted documentation in favor of canonical siblings
in the sibling standard modules (e.g. ADD/SUBTRACT/MULTIPLY/DIVIDE are
word-form aliases of +/-/*/; IDENTITY is a synonym of NOP).
`,
    );
  }

  constructor() {
    super("classic");
  }

  // ========================================
  // Word-form arithmetic aliases (canonical siblings: + - * / live in math_module)
  // ========================================

  @ForthicDirectWord("( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )", "Add two numbers or sum array", "ADD")
  async ADD(interp: Interpreter) {
    const b = interp.stack_pop();

    if (Array.isArray(b)) {
      let result = 0;
      for (const num of b) {
        if (num !== null && num !== undefined) {
          result += num;
        }
      }
      interp.stack_push(result);
      return;
    }

    const a = interp.stack_pop();
    const num_a = a === null || a === undefined ? 0 : a;
    const num_b = b === null || b === undefined ? 0 : b;
    interp.stack_push(num_a + num_b);
  }

  @ForthicWord("( a:number b:number -- difference:number )", "Subtract b from a", "SUBTRACT")
  async SUBTRACT(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    return a - b;
  }

  @ForthicDirectWord("( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )", "Multiply two numbers or product of array", "MULTIPLY")
  async MULTIPLY(interp: Interpreter) {
    const b = interp.stack_pop();

    if (Array.isArray(b)) {
      let result = 1;
      for (const num of b) {
        if (num === null || num === undefined) {
          interp.stack_push(null);
          return;
        }
        result *= num;
      }
      interp.stack_push(result);
      return;
    }

    const a = interp.stack_pop();
    if (a === null || a === undefined || b === null || b === undefined) {
      interp.stack_push(null);
      return;
    }
    interp.stack_push(a * b);
  }

  @ForthicWord("( a:number b:number -- quotient:number )", "Divide a by b", "DIVIDE")
  async DIVIDE(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    if (b === 0) {
      return null;
    }
    return a / b;
  }

  // ========================================
  // Synonyms (canonical sibling: NOP lives in core_module)
  // ========================================

  @ForthicWord("( -- )", "Does nothing (identity operation)")
  async IDENTITY() {
    // No-op
  }
}
