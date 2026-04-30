import { StandardInterpreter } from "../../../interpreter";
import {
  UnknownWordError,
  UnknownVariableError,
  UnknownModuleError,
  StackUnderflowError,
  WordExecutionError,
} from "../../../errors";

describe("error context: source location", () => {
  test("UnknownWordError carries token location", async () => {
    const forthic = "1 2 GARBAGE";
    let captured: UnknownWordError | undefined;
    try {
      await new StandardInterpreter().run(forthic);
    } catch (e) {
      captured = e as UnknownWordError;
    }
    expect(captured).toBeInstanceOf(UnknownWordError);
    expect(captured!.location).toBeDefined();
    expect(captured!.location!.line).toBe(1);
    // GARBAGE starts at column 5 (1-indexed) in "1 2 GARBAGE"
    expect(captured!.location!.column).toBe(5);
    // Span must cover the whole token, not collapse to start_pos.
    expect(captured!.location!.start_pos).toBe(4);
    expect(captured!.location!.end_pos).toBe(4 + "GARBAGE".length);
  });

  test("UnknownModuleError carries token location", async () => {
    const interp = new StandardInterpreter();
    const forthic = `["nope"] USE-MODULES`;
    let captured: UnknownModuleError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as UnknownModuleError;
    }
    expect(captured).toBeInstanceOf(UnknownModuleError);
    expect(captured!.location).toBeDefined();
    expect(captured!.location!.line).toBe(1);
  });

  test("UnknownVariableError carries token location (regression for fc5925d)", async () => {
    const interp = new StandardInterpreter();
    const forthic = `'undeclared-var' @`;
    let captured: UnknownVariableError | undefined;
    try {
      await interp.run(forthic);
    } catch (e) {
      captured = e as UnknownVariableError;
    }
    expect(captured).toBeInstanceOf(UnknownVariableError);
    expect(captured!.location).toBeDefined();
    expect(captured!.location!.line).toBe(1);
    expect(captured!.location!.column).toBe(18);
    expect(captured!.location!.start_pos).toBe(17);
    expect(captured!.location!.end_pos).toBe(18);
  });

  test("StackUnderflowError from stack_pop produces clean call-site span (no stale-tokenizer collapse)", async () => {
    // Regression for the host-project bug: stack_pop used to read
    // tokenizer.get_token_location() at throw time, which by then reflected
    // the EOS token, producing a CodeLocation with end_pos === start_pos.
    // The fix is twofold:
    //   1. stack_pop no longer stamps a location at all (cheap option).
    //   2. The interpreter's dispatch catch site fills in token.location.
    //
    // We assert both halves of the contract by examining a wrapped failure:
    //   - the outer WordExecutionError (the user-visible error) has the
    //     dispatching token's full span — start_pos and end_pos covering "BAD"
    //   - the inner StackUnderflowError (preserved as `cause`) has no location,
    //     proving stack_pop did not stamp a stale one.
    const forthic = `: BAD POP ;\nBAD`;
    let captured: WordExecutionError | undefined;
    try {
      await new StandardInterpreter().run(forthic);
    } catch (e) {
      captured = e as WordExecutionError;
    }
    expect(captured).toBeInstanceOf(WordExecutionError);

    // (1) Outer error: dispatching call site, full span, definition kept.
    const callLoc = captured!.location;
    expect(callLoc).toBeDefined();
    expect(callLoc!.line).toBe(2);
    expect(callLoc!.column).toBe(1);
    expect(callLoc!.start_pos).toBe(12); // "BAD" begins at index 12 in `: BAD POP ;\nBAD`
    expect(callLoc!.end_pos).toBe(12 + "BAD".length);
    expect(captured!.getDefinitionLocation()).toBeDefined();
    expect(captured!.getDefinitionLocation()!.line).toBe(1);

    // (2) Inner cause: the throw site contract — no location.
    const cause = captured!.cause as StackUnderflowError;
    expect(cause).toBeInstanceOf(StackUnderflowError);
    expect(cause.location).toBeUndefined();
  });
});
