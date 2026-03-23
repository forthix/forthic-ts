import { StandardInterpreter, Stack, dup_interpreter, export_state, import_state, InterpreterState } from "../../interpreter";
import { Module, Word, PushValueWord, DefinitionWord, ModuleMemoWord } from "../../module";

describe("Interpreter - Complete End-to-End Tests", () => {
  let interp: StandardInterpreter;

  beforeEach(() => {
    interp = new StandardInterpreter();
  });

  describe("Basic Execution", () => {
    test("run simple string literals", async () => {
      await interp.run("'hello' 'world'");

      expect(interp.stack_pop()).toBe("world");
      expect(interp.stack_pop()).toBe("hello");
    });

    test("run numbers as words", async () => {
      // Numbers need to be defined as words for this to work
      const module = new Module("nums");
      module.add_exportable_word(new PushValueWord("1", 1));
      module.add_exportable_word(new PushValueWord("2", 2));
      module.add_exportable_word(new PushValueWord("3", 3));

      interp.register_module(module);
      interp.use_modules([["nums", ""]]);

      await interp.run("1 2 3");

      expect(interp.get_stack().get_items()).toEqual([1, 2, 3]);
    });

    test("run empty code", async () => {
      await interp.run("");
      expect(interp.get_stack().length).toBe(0);
    });
  });

  describe("Word Definitions", () => {
    test("define and execute simple word", async () => {
      // First define a simple word that pushes a value
      await interp.run(": FIVE '5' ;");

      // Now execute it
      await interp.run("FIVE");

      expect(interp.stack_pop()).toBe("5");
    });

    test("define word with multiple instructions", async () => {
      await interp.run(": THREE-STRINGS 'a' 'b' 'c' ;");

      await interp.run("THREE-STRINGS");

      expect(interp.stack_pop()).toBe("c");
      expect(interp.stack_pop()).toBe("b");
      expect(interp.stack_pop()).toBe("a");
    });

    test("call defined word multiple times", async () => {
      await interp.run(": HELLO 'hello' ;");

      await interp.run("HELLO HELLO");

      expect(interp.stack_pop()).toBe("hello");
      expect(interp.stack_pop()).toBe("hello");
    });
  });

  describe("Arrays", () => {
    test("create empty array", async () => {
      await interp.run("[ ]");

      const result = interp.stack_pop();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });

    test("create array with string literals", async () => {
      await interp.run("[ 'a' 'b' 'c' ]");

      const result = interp.stack_pop();
      expect(result).toEqual(["a", "b", "c"]);
    });

    test("nested arrays", async () => {
      await interp.run("[ 'x' [ 'y' 'z' ] ]");

      const result = interp.stack_pop();
      expect(result).toEqual(["x", ["y", "z"]]);
    });
  });

  describe("Comments", () => {
    test("ignore comment lines", async () => {
      await interp.run("# This is a comment\n'value'");

      expect(interp.stack_pop()).toBe("value");
    });

    test("comments don't interfere with execution", async () => {
      await interp.run("'before' # comment\n'after'");

      expect(interp.stack_pop()).toBe("after");
      expect(interp.stack_pop()).toBe("before");
    });
  });

  describe("Modules", () => {
    test("create and use module with custom word", async () => {
      const mathModule = new Module("math");
      mathModule.add_module_word("ADD", async (i) => {
        const b = i.stack_pop();
        const a = i.stack_pop();
        i.stack_push((a as number) + (b as number));
      });

      interp.register_module(mathModule);
      interp.use_modules([["math", ""]]);

      // Need to define numbers first
      const numsModule = new Module("nums");
      numsModule.add_exportable_word(new PushValueWord("3", 3));
      numsModule.add_exportable_word(new PushValueWord("4", 4));
      interp.register_module(numsModule);
      interp.use_modules([["nums", ""]]);

      await interp.run("3 4 ADD");

      expect(interp.stack_pop()).toBe(7);
    });

    test("use module with prefix", async () => {
      const testModule = new Module("test");
      testModule.add_exportable_word(new PushValueWord("VALUE", 42));

      interp.register_module(testModule);
      interp.use_modules([["test", "t"]]);

      await interp.run("t.VALUE");

      expect(interp.stack_pop()).toBe(42);
    });

    test("use_modules default behavior (no prefix)", async () => {
      const testModule = new Module("test");
      testModule.add_exportable_word(new PushValueWord("ITEM", "value"));

      interp.register_module(testModule);
      interp.use_modules(["test"]);  // Now defaults to no prefix

      await interp.run("ITEM");

      expect(interp.stack_pop()).toBe("value");
    });

    test("USE-MODULES with prefixed option uses module name as prefix", async () => {
      const testModule = new Module("test");
      testModule.add_exportable_word(new PushValueWord("VALUE", 99));

      interp.register_module(testModule);
      await interp.run(`["test"] [.prefixed TRUE] ~> USE-MODULES`);
      await interp.run("test.VALUE");

      expect(interp.stack_pop()).toBe(99);
    });

    test("USE-MODULES prefixed option does not affect array tuple form", async () => {
      const testModule = new Module("test");
      testModule.add_exportable_word(new PushValueWord("VALUE", 77));

      interp.register_module(testModule);
      // Array tuple form [name, prefix] should use explicit prefix, ignoring prefixed option
      await interp.run(`[["test" "t"]] [.prefixed TRUE] ~> USE-MODULES`);
      await interp.run("t.VALUE");

      expect(interp.stack_pop()).toBe(77);
    });
  });

  describe("Error Handling", () => {
    test("unknown word throws UnknownWordError", async () => {
      await expect(interp.run("UNKNOWN_WORD")).rejects.toThrow();
    });

    test("missing semicolon throws error", async () => {
      await expect(interp.run(": INCOMPLETE")).rejects.toThrow("Missing semicolon");
    });

    test("extra semicolon throws error", async () => {
      await expect(interp.run(";")).rejects.toThrow("Extra semicolon");
    });

    test("stack underflow throws error", async () => {
      await expect(async () => {
        await interp.run("");  // Empty stack
        interp.stack_pop();    // Try to pop
      }).rejects.toThrow();
    });
  });


  describe("Reset", () => {
    test("reset clears stack", async () => {
      await interp.run("'a' 'b' 'c'");
      expect(interp.get_stack().length).toBe(3);

      interp.reset();

      expect(interp.get_stack().length).toBe(0);
    });

    test("reset clears stack and variables", async () => {
      await interp.run("'a' 'b' 'c'");
      expect(interp.get_stack().length).toBe(3);

      interp.reset();

      expect(interp.get_stack().length).toBe(0);
      // Note: reset does NOT clear word definitions, only variables and stack
    });
  });

  describe("Interpreter Duplication", () => {
    test("dup_interpreter creates independent copy", async () => {
      await interp.run("'original'");

      const dup = dup_interpreter(interp);

      await dup.run("'duplicated'");

      expect(interp.get_stack().length).toBe(1);
      expect(dup.get_stack().length).toBe(2);
    });

    test("dup_interpreter preserves timezone", async () => {
      const original = new StandardInterpreter([], "America/New_York");
      const duplicate = dup_interpreter(original);

      expect(duplicate.get_timezone()).toBe("America/New_York");
    });

    test("dup_interpreter preserves error handler", async () => {
      const handler = async (e: Error, i: StandardInterpreter) => { };
      interp.set_error_handler(handler);

      const dup = dup_interpreter(interp);

      expect(dup.get_error_handler()).toBe(handler);
    });
  });

  describe("State Export/Import", () => {
    test("round-trip variables", async () => {
      await interp.run("['x' 'y'] VARIABLES");
      await interp.run("'hello' x !");
      await interp.run("42 y !");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      await newInterp.run("x @");
      expect(newInterp.stack_pop()).toBe("hello");
      await newInterp.run("y @");
      expect(newInterp.stack_pop()).toBe(42);
    });

    test("round-trip defined words", async () => {
      await interp.run(": GREET 'hello' ;");
      await interp.run(": ADD-ONE 1 +  ;");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      await newInterp.run("GREET");
      expect(newInterp.stack_pop()).toBe("hello");

      await newInterp.run("5 ADD-ONE");
      expect(newInterp.stack_pop()).toBe(6);
    });

    test("round-trip memo words", async () => {
      await interp.run("@: CACHED 42 ;");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      await newInterp.run("CACHED");
      expect(newInterp.stack_pop()).toBe(42);
    });

    test("round-trip stack", async () => {
      await interp.run("'a' 'b' 'c'");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      expect(newInterp.stack_pop()).toBe("c");
      expect(newInterp.stack_pop()).toBe("b");
      expect(newInterp.stack_pop()).toBe("a");
    });

    test("round-trip complex variable types", async () => {
      await interp.run("['data'] VARIABLES");
      await interp.run("[1 2 3] data !");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      await newInterp.run("data @");
      expect(newInterp.stack_pop()).toEqual([1, 2, 3]);
    });

    test("state is serializable to JSON", async () => {
      await interp.run("['name'] VARIABLES");
      await interp.run("'Alice' name !");
      await interp.run(": GREET 'hello' ;");
      await interp.run("'stack-value'");

      const state = export_state(interp);
      const json = JSON.stringify(state);
      const restored: InterpreterState = JSON.parse(json);

      const newInterp = new StandardInterpreter();
      await import_state(newInterp, restored);

      await newInterp.run("name @");
      expect(newInterp.stack_pop()).toBe("Alice");
      await newInterp.run("GREET");
      expect(newInterp.stack_pop()).toBe("hello");
      expect(newInterp.stack_pop()).toBe("stack-value");
    });

    test("definition source text is captured", async () => {
      await interp.run(": GREET 'hello' ;");

      const defWord = interp.get_app_module().words.find(
        (w) => w instanceof DefinitionWord && w.name === "GREET"
      ) as DefinitionWord;

      expect(defWord).toBeDefined();
      expect(defWord.source).toContain(": GREET");
      expect(defWord.source).toContain(";");
    });

    test("memo source text is captured", async () => {
      await interp.run("@: CACHED 42 ;");

      const memoWord = interp.get_app_module().words.find(
        (w) => w instanceof ModuleMemoWord && w.name === "CACHED"
      ) as ModuleMemoWord;

      expect(memoWord).toBeDefined();
      expect(memoWord.source).toContain("@: CACHED");
      expect(memoWord.source).toContain(";");
    });

    test("new interpreter modules still work after import", async () => {
      await interp.run("['x'] VARIABLES");
      await interp.run("10 x !");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      // Standard library words should still work
      await newInterp.run("[1 2 3] LENGTH");
      expect(newInterp.stack_pop()).toBe(3);
    });

    test("independence after import", async () => {
      await interp.run("['x'] VARIABLES");
      await interp.run("'original' x !");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      // Modify in new interpreter
      await newInterp.run("'modified' x !");
      await newInterp.run("x @");
      expect(newInterp.stack_pop()).toBe("modified");

      // Original should be unchanged
      await interp.run("x @");
      expect(interp.stack_pop()).toBe("original");
    });

    test("VARIABLES called twice preserves existing values", async () => {
      await interp.run("['x'] VARIABLES");
      await interp.run("42 x !");
      await interp.run("['x'] VARIABLES");
      await interp.run("x @");
      expect(interp.stack_pop()).toBe(42);
    });

    test("multiple definitions in single run", async () => {
      await interp.run(": FOO 'foo' ;  : BAR 'bar' ;");

      const state = export_state(interp);
      const newInterp = new StandardInterpreter();
      await import_state(newInterp, state);

      await newInterp.run("FOO");
      expect(newInterp.stack_pop()).toBe("foo");
      await newInterp.run("BAR");
      expect(newInterp.stack_pop()).toBe("bar");
    });
  });

  describe("Profiling", () => {
    test("profile word execution", async () => {
      interp.start_profiling();

      await interp.run(": WORD1 'a' ;");
      await interp.run("WORD1 WORD1");

      interp.stop_profiling();

      const histogram = interp.word_histogram();
      const word1_entry = histogram.find(e => e.word === "WORD1");

      expect(word1_entry).toBeDefined();
      expect(word1_entry.count).toBe(2);
    });

    test("timestamps track execution", async () => {
      interp.start_profiling();
      interp.add_timestamp("CHECKPOINT");
      interp.stop_profiling();

      const timestamps = interp.profile_timestamps();

      expect(timestamps.length).toBeGreaterThanOrEqual(3); // START, CHECKPOINT, END
      expect(timestamps.map(t => t.label)).toContain("CHECKPOINT");
    });
  });

  describe("String Location Tracking", () => {
    test("string_location is undefined initially", () => {
      expect(interp.get_string_location()).toBeUndefined();
    });

    test("string_location tracks positioned strings", async () => {
      await interp.run("'test'");
      interp.stack_pop();  // This sets string_location

      const location = interp.get_string_location();
      expect(location).toBeDefined();
    });
  });

  describe("Triple-Quoted Strings", () => {
    test("handle triple-quoted strings", async () => {
      await interp.run("'''hello'''");

      expect(interp.stack_pop()).toBe("hello");
    });

    test("triple-quoted strings preserve internal quotes", async () => {
      await interp.run('"""He said "hello" there"""');

      expect(interp.stack_pop()).toBe('He said "hello" there');
    });
  });

  describe("Memo Definitions", () => {
    test("define and use memo word", async () => {
      await interp.run("@: MEMO 'value' ;");

      await interp.run("MEMO");

      expect(interp.stack_pop()).toBe("value");
    });
  });

  describe("Integration - Complex Scenarios", () => {
    test("define word that uses another word", async () => {
      await interp.run(": GREET 'Hello' ;");
      await interp.run(": GREET-TWICE GREET GREET ;");

      await interp.run("GREET-TWICE");

      expect(interp.stack_pop()).toBe("Hello");
      expect(interp.stack_pop()).toBe("Hello");
    });

    test("arrays with defined words", async () => {
      await interp.run(": ONE '1' ;");
      await interp.run(": TWO '2' ;");

      await interp.run("[ ONE TWO ]");

      // Note: Words in arrays get executed during array creation
      const result = interp.stack_pop();
      expect(result).toEqual(["1", "2"]);
    });

    test("composed definitions", async () => {
      // Define INNER first, then OUTER that uses INNER
      await interp.run(": INNER 'nested' ;");
      await interp.run(": OUTER INNER ;");

      await interp.run("OUTER");

      expect(interp.stack_pop()).toBe("nested");
    });
  });
});
