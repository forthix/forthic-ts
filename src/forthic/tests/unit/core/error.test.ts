import { StandardInterpreter } from "../../../interpreter";
import { Module } from "../../../module";
import { ForthicError, UnknownWordError, WordExecutionError, MissingSemicolonError, ExtraSemicolonError, get_error_description, StackUnderflowError } from "../../../errors";

const PRINT_ERRORS = false;

function printError(e: Error, forthic?: string) {
  if (!PRINT_ERRORS) return;

  if (e instanceof ForthicError && forthic) {
    console.log(get_error_description(forthic, e))
  }
  else {
    console.log(e.message);
  }
}

test("Unknown word error", async () => {
  const interp = new StandardInterpreter();
  const forthic = "1 2 3 GARBAGE +"
  try {

    await interp.run(forthic);
  } catch (e) {
    if (e instanceof UnknownWordError) {
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
});

test("Stack underflow error", async () => {
  const interp = new StandardInterpreter();
  const forthic = "1 + 3 2 *"
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof StackUnderflowError) {
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
});

test("Word execution error", async () => {
  const interp = new StandardInterpreter();
  const forthic = `: ADD   +;
  1 ADD 2 *`
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof WordExecutionError) {
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
});

test("Missing semicolon error", async () => {
  const interp = new StandardInterpreter();
  const forthic = `: ADD   +
  : MUL   *;`
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof MissingSemicolonError) {
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
});

test("Extra semicolon error", async () => {
  const interp = new StandardInterpreter();
  const forthic = `: ADD   +;
[1 2 3];`
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof ExtraSemicolonError) {
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
});


test("Errors in MAP", async () => {
  const interp = new StandardInterpreter();
  const forthic = `: ADD   +;
  [1 2 3] "ADD" MAP`
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof ForthicError) {
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
})

test("WordExecutionError tracks both call and definition locations", async () => {
  const interp = new StandardInterpreter();
  const forthic = `: ADD   +;
  1 ADD 2 *`
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof WordExecutionError) {
      // Call location should be where ADD was called (line 2)
      expect(e.location).toBeDefined();
      expect(e.location?.line).toBe(2);

      // Definition location should be where + was in the definition (line 1)
      const defLoc = e.getDefinitionLocation();
      expect(defLoc).toBeDefined();
      expect(defLoc?.line).toBe(1);

      // Both should have no source (not in a module)
      expect(e.location?.source).toBeUndefined();
      expect(defLoc?.source).toBeUndefined();
    }
    else {
      throw e;
    }
  }
})

test("WordExecutionError shows dual-location error formatting", async () => {
  const interp = new StandardInterpreter();
  const forthic = `: ADD   +;
  1 ADD 2 *`
  try {
    await interp.run(forthic);
  } catch (e) {
    if (e instanceof WordExecutionError) {
      const description = get_error_description(forthic, e);

      // Should contain both "at line" (definition) and "Called from" (call site)
      expect(description).toContain("at line 1");
      expect(description).toContain("Called from line 2");

      // Should contain caret highlighting (^^^)
      expect(description).toContain("^");

      // Print for visual inspection if PRINT_ERRORS is true
      printError(e, forthic);
    }
    else {
      throw e;
    }
  }
})

