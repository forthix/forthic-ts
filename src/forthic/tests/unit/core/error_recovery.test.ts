import { StandardInterpreter } from "../../../interpreter";
import { IntentionalStopError } from "../../../errors";

// With an error handler, run() recovers from an error and resumes with the
// token after the word that failed.

describe("run() error recovery", () => {
  test("resumes with the word after the one that failed", async () => {
    const interp = new StandardInterpreter();
    interp.set_error_handler(async () => {});
    await interp.run("1 NO-SUCH-WORD 2 3 +");
    expect(interp.get_stack().get_items()).toEqual([1, 5]);
  });

  test("the handler runs where the failed word was", async () => {
    const interp = new StandardInterpreter();
    interp.set_error_handler(async (_e, i) => {
      i.stack_push("RECOVERED");
    });
    await interp.run("1 NO-SUCH-WORD 2 3 +");
    expect(interp.get_stack().get_items()).toEqual([1, "RECOVERED", 5]);
  });

  test("keeps the string after the words that follow the failed word", async () => {
    const interp = new StandardInterpreter();
    interp.set_error_handler(async () => {});
    await interp.run('1 NO-SUCH-WORD 2 3 "s"');
    expect(interp.get_stack().get_items()).toEqual([1, 2, 3, "s"]);
  });

  test("keeps the array literal after the words that follow the failed word", async () => {
    const interp = new StandardInterpreter();
    interp.set_error_handler(async () => {});
    await interp.run("1 NO-SUCH-WORD 2 3 [ 4 ]");
    expect(interp.get_stack().get_items()).toEqual([1, 2, 3, [4]]);
  });

  test("resumes after a PEEK! debugging stop", async () => {
    const interp = new StandardInterpreter();
    interp.set_error_handler(async (e) => {
      if (!(e instanceof IntentionalStopError)) throw e;
    });
    const log = console.log;
    console.log = () => {};
    try {
      await interp.run("1 PEEK! 2 3 +");
    } finally {
      console.log = log;
    }
    expect(interp.get_stack().get_items()).toEqual([1, 5]);
  });
});
