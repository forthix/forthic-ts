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
  });
});
