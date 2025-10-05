import { Interpreter } from "../interpreter";
import { DecoratedModule, Word } from "../decorators/word";

/**
 * BooleanModule - Comparison, logic, and membership operations
 *
 * Categories:
 * - Comparison: ==, !=, <, <=, >, >=
 * - Logic: OR, AND, NOT, XOR, NAND
 * - Membership: IN, ANY, ALL
 * - Conversion: >BOOL
 */
export class BooleanModule extends DecoratedModule {
  constructor() {
    super("boolean");

    // Manual registrations for variable arity words
    this.add_module_word("OR", this.OR.bind(this));
    this.add_module_word("AND", this.AND.bind(this));
  }

  // ========================================
  // Comparison Operations
  // ========================================

  // ( a b -- bool )
  @Word("( a:any b:any -- equal:boolean )", "Test equality", "==")
  async equals(a: any, b: any) {
    return a === b;
  }

  // ( a b -- bool )
  @Word("( a:any b:any -- not_equal:boolean )", "Test inequality", "!=")
  async not_equals(a: any, b: any) {
    return a !== b;
  }

  // ( a b -- bool )
  @Word("( a:any b:any -- less_than:boolean )", "Less than", "<")
  async less_than(a: any, b: any) {
    return a < b;
  }

  // ( a b -- bool )
  @Word("( a:any b:any -- less_equal:boolean )", "Less than or equal", "<=")
  async less_than_or_equal(a: any, b: any) {
    return a <= b;
  }

  // ( a b -- bool )
  @Word("( a:any b:any -- greater_than:boolean )", "Greater than", ">")
  async greater_than(a: any, b: any) {
    return a > b;
  }

  // ( a b -- bool )
  @Word("( a:any b:any -- greater_equal:boolean )", "Greater than or equal", ">=")
  async greater_than_or_equal(a: any, b: any) {
    return a >= b;
  }

  // ========================================
  // Logic Operations
  // ========================================

  // ( a b -- bool ) OR ( [bools] -- bool )
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

  // ( a b -- bool ) OR ( [bools] -- bool )
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

  // ( bool -- !bool )
  @Word("( bool:boolean -- result:boolean )", "Logical NOT")
  async NOT(bool: boolean) {
    return !bool;
  }

  // ( a b -- bool )
  @Word("( a:boolean b:boolean -- result:boolean )", "Logical XOR (exclusive or)")
  async XOR(a: boolean, b: boolean) {
    return (a || b) && !(a && b);
  }

  // ( a b -- bool )
  @Word("( a:boolean b:boolean -- result:boolean )", "Logical NAND (not and)")
  async NAND(a: boolean, b: boolean) {
    return !(a && b);
  }

  // ========================================
  // Membership Operations
  // ========================================

  // ( item array -- bool )
  @Word("( item:any array:any[] -- in:boolean )", "Check if item is in array")
  async IN(item: any, array: any[]) {
    if (!Array.isArray(array)) {
      return false;
    }
    return array.includes(item);
  }

  // ( items1 items2 -- bool )
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

  // ( items1 items2 -- bool )
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

  // ========================================
  // Type Conversion
  // ========================================

  // ( a -- bool )
  @Word("( a:any -- bool:boolean )", "Convert to boolean (JavaScript truthiness)")
  async [">BOOL"](a: any) {
    return !!a;
  }
}
