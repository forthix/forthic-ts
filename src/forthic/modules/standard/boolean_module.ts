import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";

export class BooleanModule extends DecoratedModule {
  static {
    registerModuleDoc(BooleanModule, `
Comparison, logic, and membership operations for boolean values and conditions.

## Categories
- Comparison: ==, !=, <, <=, >, >=
- Logic: OR, AND, NOT, ANY?, ALL?
- Membership: CONTAINS?
- Conversion: >BOOL

## Examples
5 3 >
"hello" "hello" ==
[TRUE FALSE TRUE] ANY?
2 [1 2 3] IN
`);
  }

  constructor() {
    super("boolean");
  }


  @ForthicWord("( a:any b:any -- equal:boolean )", "Test equality", "==")
  async equals(a: any, b: any) {
    return a === b;
  }

  @ForthicWord("( a:any b:any -- not_equal:boolean )", "Test inequality", "!=")
  async not_equals(a: any, b: any) {
    return a !== b;
  }

  @ForthicWord("( a:any b:any -- less_than:boolean )", "Less than", "<")
  async less_than(a: any, b: any) {
    return a < b;
  }

  @ForthicWord("( a:any b:any -- less_equal:boolean )", "Less than or equal", "<=")
  async less_than_or_equal(a: any, b: any) {
    return a <= b;
  }

  @ForthicWord("( a:any b:any -- greater_than:boolean )", "Greater than", ">")
  async greater_than(a: any, b: any) {
    return a > b;
  }

  @ForthicWord("( a:any b:any -- greater_equal:boolean )", "Greater than or equal", ">=")
  async greater_than_or_equal(a: any, b: any) {
    return a >= b;
  }


  @ForthicWord("( a:boolean b:boolean -- result:boolean )", "Logical OR of two values. For arrays use ANY?.", "OR")
  async OR(a: any, b: any) {
    if (Array.isArray(a) || Array.isArray(b)) {
      throw new Error("OR takes two values. For an array of booleans, use ANY?.");
    }
    return a || b;
  }

  @ForthicWord("( a:boolean b:boolean -- result:boolean )", "Logical AND of two values. For arrays use ALL?.", "AND")
  async AND(a: any, b: any) {
    if (Array.isArray(a) || Array.isArray(b)) {
      throw new Error("AND takes two values. For an array of booleans, use ALL?.");
    }
    return a && b;
  }

  @ForthicWord(
    "( bools:boolean[] -- result:boolean )",
    "Returns true if any element of the array is truthy. False for empty array.",
    "ANY?",
  )
  async ANY_Q(bools: any) {
    if (!Array.isArray(bools)) {
      throw new Error("ANY? requires an array of booleans.");
    }
    return bools.some((v) => !!v);
  }

  @ForthicWord(
    "( bools:boolean[] -- result:boolean )",
    "Returns true if all elements of the array are truthy. True for empty array.",
    "ALL?",
  )
  async ALL_Q(bools: any) {
    if (!Array.isArray(bools)) {
      throw new Error("ALL? requires an array of booleans.");
    }
    return bools.every((v) => !!v);
  }

  @ForthicWord("( bool:boolean -- result:boolean )", "Logical NOT")
  async NOT(bool: boolean) {
    return !bool;
  }

  @ForthicWord(
    "( haystack:any[] needle:any -- bool:boolean )",
    "Check if haystack array contains needle. Container-first arg order.",
    "CONTAINS?",
  )
  async CONTAINS(haystack: any[], needle: any) {
    if (!Array.isArray(haystack)) {
      return false;
    }
    return haystack.includes(needle);
  }

  @ForthicWord("( items1:any[] items2:any[] -- any:boolean )", "Check if any item from items1 is in items2")
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

  @ForthicWord("( items1:any[] items2:any[] -- all:boolean )", "Check if all items from items2 are in items1")
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

  @ForthicWord("( a:any -- bool:boolean )", "Convert to boolean (JavaScript truthiness)")
  async [">BOOL"](a: any) {
    return !!a;
  }
}
