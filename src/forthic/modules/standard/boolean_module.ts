import { Interpreter } from "../../interpreter.js";
import { DecoratedModule, Word, DirectWord, registerModuleDoc } from "../../decorators/word.js";

export class BooleanModule extends DecoratedModule {
  static {
    registerModuleDoc(BooleanModule, `
Comparison, logic, and membership operations for boolean values and conditions.

## Categories
- Comparison: ==, !=, <, <=, >, >=
- Logic: OR, AND, NOT, XOR, NAND
- Membership: IN, ANY, ALL
- Conversion: >BOOL

## Examples
5 3 >
"hello" "hello" ==
[1 2 3] [4 5 6] OR
2 [1 2 3] IN
`);
  }

  constructor() {
    super("boolean");
  }


  @Word("( a:any b:any -- equal:boolean )", "Test equality", "==")
  async equals(a: any, b: any) {
    return a === b;
  }

  @Word("( a:any b:any -- not_equal:boolean )", "Test inequality", "!=")
  async not_equals(a: any, b: any) {
    return a !== b;
  }

  @Word("( a:any b:any -- less_than:boolean )", "Less than", "<")
  async less_than(a: any, b: any) {
    return a < b;
  }

  @Word("( a:any b:any -- less_equal:boolean )", "Less than or equal", "<=")
  async less_than_or_equal(a: any, b: any) {
    return a <= b;
  }

  @Word("( a:any b:any -- greater_than:boolean )", "Greater than", ">")
  async greater_than(a: any, b: any) {
    return a > b;
  }

  @Word("( a:any b:any -- greater_equal:boolean )", "Greater than or equal", ">=")
  async greater_than_or_equal(a: any, b: any) {
    return a >= b;
  }


  @DirectWord("( a:boolean b:boolean -- result:boolean ) OR ( bools:boolean[] -- result:boolean )", "Logical OR of two values or array", "OR")
  async OR(interp: Interpreter) {
    const b = interp.stack_pop();

    // Case 1: Array on top of stack
    if (Array.isArray(b)) {
      for (const val of b) {
        if (val) {
          interp.stack_push(true);
          return;
        }
      }
      interp.stack_push(false);
      return;
    }

    // Case 2: Two values
    const a = interp.stack_pop();
    interp.stack_push(a || b);
  }

  @DirectWord("( a:boolean b:boolean -- result:boolean ) OR ( bools:boolean[] -- result:boolean )", "Logical AND of two values or array", "AND")
  async AND(interp: Interpreter) {
    const b = interp.stack_pop();

    // Case 1: Array on top of stack
    if (Array.isArray(b)) {
      for (const val of b) {
        if (!val) {
          interp.stack_push(false);
          return;
        }
      }
      interp.stack_push(true);
      return;
    }

    // Case 2: Two values
    const a = interp.stack_pop();
    interp.stack_push(a && b);
  }

  @Word("( bool:boolean -- result:boolean )", "Logical NOT")
  async NOT(bool: boolean) {
    return !bool;
  }

  @Word("( a:boolean b:boolean -- result:boolean )", "Logical XOR (exclusive or)")
  async XOR(a: boolean, b: boolean) {
    return (a || b) && !(a && b);
  }

  @Word("( a:boolean b:boolean -- result:boolean )", "Logical NAND (not and)")
  async NAND(a: boolean, b: boolean) {
    return !(a && b);
  }


  @Word("( item:any array:any[] -- in:boolean )", "Check if item is in array")
  async IN(item: any, array: any[]) {
    if (!Array.isArray(array)) {
      return false;
    }
    return array.includes(item);
  }

  @Word("( items1:any[] items2:any[] -- any:boolean )", "Check if any item from items1 is in items2")
  async ANY(items1: any[], items2: any[]) {
    if (!Array.isArray(items1) || !Array.isArray(items2)) {
      return false;
    }

    // If items2 is empty, return true (any items from items1 satisfy empty constraint)
    if (items2.length === 0) {
      return true;
    }

    // Check if any item from items1 is in items2
    for (const item of items1) {
      if (items2.includes(item)) {
        return true;
      }
    }
    return false;
  }

  @Word("( items1:any[] items2:any[] -- all:boolean )", "Check if all items from items2 are in items1")
  async ALL(items1: any[], items2: any[]) {
    if (!Array.isArray(items1) || !Array.isArray(items2)) {
      return false;
    }

    // If items2 is empty, return true (all zero items are in items1)
    if (items2.length === 0) {
      return true;
    }

    // Check if all items from items2 are in items1
    for (const item of items2) {
      if (!items1.includes(item)) {
        return false;
      }
    }
    return true;
  }

  @Word("( a:any -- bool:boolean )", "Convert to boolean (JavaScript truthiness)")
  async [">BOOL"](a: any) {
    return !!a;
  }
}
