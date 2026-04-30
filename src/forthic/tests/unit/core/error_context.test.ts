import { StandardInterpreter } from "../../../interpreter";
import { DecoratedModule, ForthicWord } from "../../../decorators/word";
import {
  ForthicError,
  StackUnderflowError,
  InvalidVariableNameError,
  WordExecutionError,
  get_error_description,
} from "../../../errors";

class ThrowingModule extends DecoratedModule {
  constructor() {
    super("throwing");
  }

  // Throws a ForthicError subclass with NO location set — exercises annotate-don't-wrap.
  @ForthicWord("( -- )", "Throws InvalidVariableNameError without a location")
  async ["BARE-THROW"]() {
    throw new InvalidVariableNameError(
      this.interp.get_top_input_string(),
      "x",
    );
  }

  // Throws a generic JS Error — exercises WordExecutionError wrapping path.
  @ForthicWord("( -- )", "Throws a plain Error")
  async ["GENERIC-THROW"]() {
    throw new Error("boom");
  }
}

describe("error context: word name annotation", () => {
  test("StackUnderflowError from primitive carries word name", async () => {
    const interp = new StandardInterpreter();
    const forthic = "1 +";
    let captured: StackUnderflowError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as StackUnderflowError;
    }
    expect(captured).toBeInstanceOf(StackUnderflowError);
    expect(captured!.word).toBe("+");
    expect(captured!.location).toBeDefined();
  });

  test("ForthicError thrown without location gets one and a word name", async () => {
    const mod = new ThrowingModule();
    const interp = new StandardInterpreter([mod]);
    const forthic = "BARE-THROW";
    let captured: InvalidVariableNameError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as InvalidVariableNameError;
    }
    expect(captured).toBeInstanceOf(InvalidVariableNameError);
    // location was missing on throw; catch site annotates it
    expect(captured!.location).toBeDefined();
    expect(captured!.location!.line).toBe(1);
    expect(captured!.word).toBe("BARE-THROW");
  });

  test("WordExecutionError from generic Error carries word name", async () => {
    const mod = new ThrowingModule();
    const interp = new StandardInterpreter([mod]);
    const forthic = "GENERIC-THROW";
    let captured: WordExecutionError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as WordExecutionError;
    }
    expect(captured).toBeInstanceOf(WordExecutionError);
    expect(captured!.word).toBe("GENERIC-THROW");
    expect(captured!.location).toBeDefined();
  });

  test("error inside DefinitionWord body still wraps to WordExecutionError (regression guard)", async () => {
    // DefinitionWord.execute already wraps. Our changes shouldn't affect this.
    const interp = new StandardInterpreter();
    const forthic = `: BAD-WORD POP ;\nBAD-WORD`;
    let captured: WordExecutionError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as WordExecutionError;
    }
    expect(captured).toBeInstanceOf(WordExecutionError);
    expect(captured!.location).toBeDefined();
    expect(captured!.location!.line).toBe(2); // call site
    expect(captured!.getDefinitionLocation()).toBeDefined();
    expect(captured!.getDefinitionLocation()!.line).toBe(1); // POP in body
  });

  test("instanceof of original ForthicError subclass is preserved (annotate-don't-wrap)", async () => {
    const mod = new ThrowingModule();
    const interp = new StandardInterpreter([mod]);
    try {
      await interp.run("BARE-THROW");
      throw new Error("should have thrown");
    } catch (e) {
      // Must remain InvalidVariableNameError, NOT silently wrapped to WordExecutionError.
      expect(e).toBeInstanceOf(InvalidVariableNameError);
      expect(e).toBeInstanceOf(ForthicError);
    }
  });
});

describe("error context: rendering", () => {
  test("get_error_description includes the word name when present", async () => {
    const interp = new StandardInterpreter();
    const forthic = "1 +";
    let captured: StackUnderflowError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as StackUnderflowError;
    }
    const description = get_error_description(forthic, captured!);
    expect(description).toContain("+");
    // We expect the renderer to mark the offending word, e.g. `at \`+\``
    expect(description).toMatch(/at\s+`\+`/);
  });
});
