import { StandardInterpreter } from "../../../interpreter";
import {
  UnknownWordError,
  UnknownVariableError,
  UnknownModuleError,
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
    // (Regression: tokenizer state had moved on by the time of the throw.)
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
    // UnknownVariableError is thrown from the `@` module word during dispatch.
    // tokenizer.get_token_location() at throw time returns stale state; the
    // catch site stamps the dispatch token's location instead.
    // `@` is at column 18 (1-indexed), start_pos 17, length 1.
    expect(captured!.location!.column).toBe(18);
    expect(captured!.location!.start_pos).toBe(17);
    expect(captured!.location!.end_pos).toBe(18);
  });
});
