import { Interpreter } from "../../interpreter.js";
import { DecoratedModule, ForthicWord, ForthicDirectWord, registerModuleDoc } from "../../decorators/word.js";

export class MathModule extends DecoratedModule {
  static {
    registerModuleDoc(MathModule, `
Mathematical operations and utilities including arithmetic, aggregation, and conversions.

## Categories
- Arithmetic: +, -, *, /, ADD, SUBTRACT, MULTIPLY, DIVIDE, MOD
- Aggregates: MEAN, MAX, MIN, SUM
- Type conversion: >INT, >FLOAT, >FIXED, ROUND
- Special values: INFINITY, UNIFORM-RANDOM
- Math functions: ABS, SQRT, FLOOR, CEIL, CLAMP

## Examples
5 3 +
[1 2 3 4] SUM
[10 20 30] MEAN
3.7 ROUND
0 100 UNIFORM-RANDOM
`);
  }

  constructor() {
    super("math");
  }

  // ========================================
  // Arithmetic Operations
  // ========================================

  @ForthicDirectWord("( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )", "Add two numbers or sum array", "+")
  async plus(interp: Interpreter) {
    const b = interp.stack_pop();

    // Case 1: Array on top of stack
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

    // Case 2: Two numbers
    const a = interp.stack_pop();
    const num_a = a === null || a === undefined ? 0 : a;
    const num_b = b === null || b === undefined ? 0 : b;
    interp.stack_push(num_a + num_b);
  }

  @ForthicDirectWord("( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )", "Add two numbers or sum array", "ADD")
  async plus_ADD(interp: Interpreter) {
    return this.plus(interp);
  }

  @ForthicWord("( a:number b:number -- difference:number )", "Subtract b from a", "-")
  async minus(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    return a - b;
  }

  @ForthicWord("( a:number b:number -- difference:number )", "Subtract b from a", "SUBTRACT")
  async minus_SUBTRACT(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    return a - b;
  }

  @ForthicDirectWord("( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )", "Multiply two numbers or product of array", "*")
  async times(interp: Interpreter) {
    const b = interp.stack_pop();

    // Case 1: Array on top of stack
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

    // Case 2: Two numbers
    const a = interp.stack_pop();
    if (a === null || a === undefined || b === null || b === undefined) {
      interp.stack_push(null);
      return;
    }
    interp.stack_push(a * b);
  }

  @ForthicDirectWord("( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )", "Multiply two numbers or product of array", "MULTIPLY")
  async times_MULTIPLY(interp: Interpreter) {
    return this.times(interp);
  }

  @ForthicWord("( a:number b:number -- quotient:number )", "Divide a by b", "/")
  async divide_by(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    if (b === 0) {
      return null;
    }
    return a / b;
  }

  @ForthicWord("( a:number b:number -- quotient:number )", "Divide a by b", "DIVIDE")
  async divide_by_DIVIDE(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    if (b === 0) {
      return null;
    }
    return a / b;
  }

  // ( m n -- remainder )
  @ForthicWord("( m:number n:number -- remainder:number )", "Modulo operation (m % n)")
  async MOD(m: number, n: number) {
    if (m === null || m === undefined || n === null || n === undefined) {
      return null;
    }
    return m % n;
  }


  @ForthicWord("( items:any[] -- mean:any )", "Calculate mean of array (handles numbers, strings, objects)")
  async MEAN(items: any) {
    if (!items || (Array.isArray(items) && items.length === 0)) {
      return 0;
    }

    if (!Array.isArray(items)) {
      return items;
    }

    if (items.length === 1) {
      return items[0];
    }

    // Filter out null/undefined values
    const filtered = items.filter((x) => x !== null && x !== undefined);

    if (filtered.length === 0) {
      return 0;
    }

    // Check type of first non-null item
    const first = filtered[0];

    // Case 1: Numbers
    if (typeof first === "number") {
      const sum = filtered.reduce((acc, val) => acc + val, 0);
      return sum / filtered.length;
    }

    // Case 2: Strings - return frequency distribution
    if (typeof first === "string") {
      const counts: Record<string, number> = {};
      for (const item of filtered) {
        counts[item] = (counts[item] || 0) + 1;
      }
      const result: Record<string, number> = {};
      for (const key in counts) {
        result[key] = counts[key] / filtered.length;
      }
      return result;
    }

    // Case 3: Objects - field-wise mean
    if (typeof first === "object" && !Array.isArray(first)) {
      const result: Record<string, any> = {};
      const allKeys = new Set<string>();

      // Collect all keys
      for (const obj of filtered) {
        for (const key in obj) {
          allKeys.add(key);
        }
      }

      // Compute mean for each key
      for (const key of allKeys) {
        const values = filtered.map((obj) => obj[key]).filter((v) => v !== null && v !== undefined);

        if (values.length === 0) {
          continue;
        }

        const firstVal = values[0];

        if (typeof firstVal === "number") {
          const sum = values.reduce((acc, val) => acc + val, 0);
          result[key] = sum / values.length;
        } else if (typeof firstVal === "string") {
          const counts: Record<string, number> = {};
          for (const val of values) {
            counts[val] = (counts[val] || 0) + 1;
          }
          const freqs: Record<string, number> = {};
          for (const k in counts) {
            freqs[k] = counts[k] / values.length;
          }
          result[key] = freqs;
        }
      }

      return result;
    }

    return 0;
  }

  @ForthicDirectWord("( a:number b:number -- max:number ) OR ( items:number[] -- max:number )", "Maximum of two numbers or array", "MAX")
  async MAX(interp: Interpreter) {
    const b = interp.stack_pop();

    // Case 1: Array on top of stack
    if (Array.isArray(b)) {
      if (b.length === 0) {
        interp.stack_push(null);
        return;
      }
      interp.stack_push(Math.max(...b));
      return;
    }

    // Case 2: Two values
    const a = interp.stack_pop();
    interp.stack_push(Math.max(a, b));
  }

  @ForthicDirectWord("( a:number b:number -- min:number ) OR ( items:number[] -- min:number )", "Minimum of two numbers or array", "MIN")
  async MIN(interp: Interpreter) {
    const b = interp.stack_pop();

    // Case 1: Array on top of stack
    if (Array.isArray(b)) {
      if (b.length === 0) {
        interp.stack_push(null);
        return;
      }
      interp.stack_push(Math.min(...b));
      return;
    }

    // Case 2: Two values
    const a = interp.stack_pop();
    interp.stack_push(Math.min(a, b));
  }

  @ForthicWord("( numbers:number[] -- sum:number )", "Sum of array (explicit)")
  async SUM(numbers: number[]) {
    if (!numbers || !Array.isArray(numbers)) {
      return 0;
    }

    let result = 0;
    for (const num of numbers) {
      if (num !== null && num !== undefined) {
        result += num;
      }
    }
    return result;
  }


  @ForthicWord("( a:any -- int:number )", "Convert to integer (returns length for arrays/objects, 0 for null)")
  async [">INT"](a: any) {
    if (a === null || a === undefined) {
      return 0;
    }

    if (Array.isArray(a) || typeof a === "object") {
      return Array.isArray(a) ? a.length : Object.keys(a).length;
    }

    try {
      return Math.trunc(parseFloat(a));
    } catch {
      return null;
    }
  }

  @ForthicWord("( a:any -- float:number )", "Convert to float")
  async [">FLOAT"](a: any) {
    if (a === null || a === undefined) {
      return 0.0;
    }

    try {
      return parseFloat(a);
    } catch {
      return null;
    }
  }

  @ForthicWord("( num:number digits:number -- result:string )", "Format number with fixed decimal places")
  async [">FIXED"](num: number, digits: number) {
    if (num === null || num === undefined) {
      return null;
    }

    return num.toFixed(digits);
  }

  @ForthicWord("( num:number -- int:number )", "Round to nearest integer")
  async ROUND(num: number) {
    if (num === null || num === undefined) {
      return null;
    }

    return Math.round(num);
  }


  @ForthicWord("( -- infinity:number )", "Push Infinity value")
  async INFINITY() {
    return Infinity;
  }

  @ForthicWord("( low:number high:number -- random:number )", "Generate random number in range [low, high)")
  async ["UNIFORM-RANDOM"](low: number, high: number) {
    return Math.random() * (high - low) + low;
  }


  @ForthicWord("( n:number -- abs:number )", "Absolute value")
  async ABS(n: number) {
    if (n === null || n === undefined) {
      return null;
    }
    return Math.abs(n);
  }

  @ForthicWord("( n:number -- sqrt:number )", "Square root")
  async SQRT(n: number) {
    if (n === null || n === undefined) {
      return null;
    }
    return Math.sqrt(n);
  }

  @ForthicWord("( n:number -- floor:number )", "Round down to integer")
  async FLOOR(n: number) {
    if (n === null || n === undefined) {
      return null;
    }
    return Math.floor(n);
  }

  @ForthicWord("( n:number -- ceil:number )", "Round up to integer")
  async CEIL(n: number) {
    if (n === null || n === undefined) {
      return null;
    }
    return Math.ceil(n);
  }

  @ForthicWord("( value:number min:number max:number -- clamped:number )", "Constrain value to range [min, max]")
  async CLAMP(value: number, min: number, max: number) {
    if (value === null || value === undefined || min === null || min === undefined || max === null || max === undefined) {
      return null;
    }
    return Math.max(min, Math.min(max, value));
  }
}
