/**
 * Robustness of the interpreter's error and control-flow paths: the recovery
 * loop must terminate, error paths must restore the tokenizer/module stacks,
 * reset() must fully clear per-run state, and IntentionalStopError must keep its
 * identity through a definition body.
 */
import { StandardInterpreter } from "../../../interpreter";
import { Module } from "../../../module";
import { TooManyAttemptsError, IntentionalStopError } from "../../../errors";

let interp: StandardInterpreter;

beforeEach(() => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

describe("execute_with_recovery termination", () => {
  test("the attempt-budget guard escapes instead of being re-caught and looping forever", async () => {
    // A handler that never rethrows, combined with an exhausted attempt budget,
    // is the exact trigger: before the fix, the TooManyAttemptsError thrown by
    // the guard was caught by this same handler and recovery recursed forever.
    // maxAttempts=0 makes the guard trip on the first attempt, deterministically.
    interp.set_error_handler(async () => {
      /* swallow */
    });
    interp.set_max_attempts(0);

    await expect(interp.run("1 2 +")).rejects.toBeInstanceOf(TooManyAttemptsError);
  }, 5000);
});

describe("error paths restore interpreter state", () => {
  test("a failed run leaves no stale tokenizer on the stack", async () => {
    await expect(interp.run("THIS_IS_NOT_A_WORD")).rejects.toThrow();
    // tokenizer_stack is balanced in a finally, so the top input string is empty.
    expect(interp.get_top_input_string()).toBe("");
    // …and a subsequent run works cleanly.
    await interp.run("1 2 +");
    expect(interp.get_stack().get_items()).toEqual([3]);
  });

  test("a stray } does not brick the interpreter by emptying the module stack", async () => {
    // A bare `}` with no matching module context must not pop the app module —
    // that would leave cur_module() undefined and make every later word lookup
    // fail. It should raise a clear error and leave the interpreter usable.
    await expect(interp.run("}")).rejects.toThrow();
    await interp.run("1 2 +");
    expect(interp.get_stack().get_items()).toEqual([3]);
  });

  test("a module whose code throws does not stay on the module stack", async () => {
    const mod = new Module("boom");
    mod.forthic_code = "THIS_IS_NOT_A_WORD";
    await expect(interp.run_module_code(mod)).rejects.toThrow();
    // module_stack_pop runs in a finally, so the current module is back to app.
    expect(interp.cur_module()).toBe(interp.get_app_module());
  });

  test("reset() clears per-run parsing state after a failure", async () => {
    await expect(interp.run("THIS_IS_NOT_A_WORD")).rejects.toThrow();
    interp.reset();
    expect(interp.get_top_input_string()).toBe("");
    await interp.run("41 1 +");
    expect(interp.get_stack().get_items()).toEqual([42]);
  });
});

describe("control-flow error identity", () => {
  test("IntentionalStopError keeps its identity through a definition body", async () => {
    // STACK! throws IntentionalStopError (a debugging control-flow signal). It
    // must not be wrapped in WordExecutionError when raised inside a word.
    await expect(interp.run(": DEBUG STACK! ; 1 2 DEBUG")).rejects.toBeInstanceOf(
      IntentionalStopError
    );
  });
});
