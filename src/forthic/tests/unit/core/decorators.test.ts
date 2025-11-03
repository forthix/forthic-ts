import { StandardInterpreter } from "../../../interpreter";
import { DecoratedModule, ForthicWord } from "../../../decorators/word";

class TestModule extends DecoratedModule {
  constructor() {
    super("test");
  }

  @ForthicWord("( a:number b:number -- sum:number )", "Adds two numbers")
  async ADD(a: number, b: number) {
    return a + b;
  }

  @ForthicWord("( a:any -- a:any a:any )", "Duplicates value")
  async DUP(a: any) {
    this.interp.stack_push(a);
    this.interp.stack_push(a);
  }

  @ForthicWord("( a:any -- )", "Pops value (no output)")
  async POP(a: any) {
    // No return = push nothing
  }

  @ForthicWord("( -- arr:number[] )", "Returns array (single value)")
  async ARRAY() {
    return [1, 2, 3];
  }

  @ForthicWord("( -- )", "Returns nothing")
  async NOOP() {
    // No return = push nothing
  }

  @ForthicWord("( a:number b:number c:number -- result:number )", "Multiplies three numbers")
  async ["MULT-3"](a: number, b: number, c: number) {
    return a * b * c;
  }
}

describe("@Word Decorator", () => {
  let interp: StandardInterpreter;
  let module: TestModule;

  beforeEach(() => {
    module = new TestModule();
    interp = new StandardInterpreter([module]);
  });

  test("auto-registers words", () => {
    expect(module.find_word("ADD")).not.toBeNull();
    expect(module.find_word("DUP")).not.toBeNull();
    expect(module.find_word("POP")).not.toBeNull();
    expect(module.find_word("ARRAY")).not.toBeNull();
  });

  test("auto-registers words with special characters", () => {
    expect(module.find_word("MULT-3")).not.toBeNull();
  });

  test("single return value pushes to stack", async () => {
    interp.stack_push(2);
    interp.stack_push(3);
    const word = module.find_word("ADD");
    await word!.execute(interp);
    expect(interp.stack_pop()).toBe(5);
  });

  test("undefined return pushes nothing", async () => {
    interp.stack_push(42);
    const word = module.find_word("POP");
    await word!.execute(interp);
    expect(interp.get_stack().get_items().length).toBe(0);
  });

  test("multiple outputs use explicit push", async () => {
    interp.stack_push(42);
    const word = module.find_word("DUP");
    await word!.execute(interp);
    expect(interp.stack_pop()).toBe(42);
    expect(interp.stack_pop()).toBe(42);
  });

  test("array return is single value", async () => {
    const word = module.find_word("ARRAY");
    await word!.execute(interp);
    const result = interp.stack_pop();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([1, 2, 3]);
  });

  test("handles three inputs correctly", async () => {
    interp.stack_push(2);
    interp.stack_push(3);
    interp.stack_push(4);
    const word = module.find_word("MULT-3");
    await word!.execute(interp);
    expect(interp.stack_pop()).toBe(24);
  });

  test("generates documentation", () => {
    const docs = module.getWordDocs();
    expect(docs.length).toBe(6);

    const addDoc = docs.find(d => d.name === "ADD");
    expect(addDoc).toEqual({
      name: "ADD",
      stackEffect: "( a:number b:number -- sum:number )",
      description: "Adds two numbers",
    });

    const dupDoc = docs.find(d => d.name === "DUP");
    expect(dupDoc).toEqual({
      name: "DUP",
      stackEffect: "( a:any -- a:any a:any )",
      description: "Duplicates value",
    });
  });

  test("throws error for invalid stack notation (missing parentheses)", () => {
    expect(() => {
      class BadModule extends DecoratedModule {
        constructor() {
          super("bad");
        }

        // @ts-ignore - intentionally bad for testing
        @ForthicWord("a:any -- b:any", "Missing parentheses")
        async BAD(a: any) {
          return a;
        }
      }
      const bad = new BadModule();
      new StandardInterpreter([bad]);
    }).toThrow("Stack effect must be wrapped in parentheses");
  });

  test("throws error for invalid stack notation (missing --)", () => {
    expect(() => {
      class BadModule extends DecoratedModule {
        constructor() {
          super("bad");
        }

        // @ts-ignore - intentionally bad for testing
        @ForthicWord("( a:any b:any )", "Missing --")
        async BAD(a: any, b: any) {
          return a;
        }
      }
      const bad = new BadModule();
      new StandardInterpreter([bad]);
    }).toThrow("Invalid stack notation");
  });
});
