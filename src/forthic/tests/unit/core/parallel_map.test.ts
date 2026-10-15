import { StandardInterpreter, dup_interpreter } from "../../../interpreter";
import { Module } from "../../../module";

// A module whose X word replaces the top of the stack with 100.
class HundredModule extends Module {
  constructor() {
    super("hundred");
    this.add_module_word("X", async (interp: StandardInterpreter) => {
      interp.stack_pop();
      interp.stack_push(100);
    });
  }
}

// Parallel MAP runs each group on a duplicate interpreter. A user word that was
// defined before the MAP must run against the duplicate, as serial MAP runs it
// against the interpreter it was called on.

async function serialAndParallel(setup: string, items: string, word: string) {
  const serial = new StandardInterpreter();
  await serial.run(`${setup} ${items} "${word}" MAP`);
  const parallel = new StandardInterpreter();
  await parallel.run(`${setup} ${items} "${word}" { .interps 2 } ~> MAP`);
  return { serial, parallel };
}

describe("parallel MAP with user words defined before it", () => {
  test("runs a user word that calls DUP the same as serial MAP", async () => {
    const { serial, parallel } = await serialAndParallel(": DOUBLE DUP + ;", "[1 2 3 4]", "DOUBLE");
    expect(parallel.get_stack().get_items()).toEqual(serial.get_stack().get_items());
    expect(parallel.get_stack().get_items()).toEqual([[2, 4, 6, 8]]);
  });

  test("runs a user word that calls SWAP the same as serial MAP", async () => {
    const { serial, parallel } = await serialAndParallel(": NEG 0 SWAP - ;", "[1 2 3 4]", "NEG");
    expect(parallel.get_stack().get_items()).toEqual(serial.get_stack().get_items());
  });

  test("a user word that sets a module variable sets the duplicate's copy, not the parent's", async () => {
    const parallel = new StandardInterpreter();
    await parallel.run('["x"] VARIABLES 0 x ! : KEEP DUP x ! ; [1 2 3 4] "KEEP" { .interps 2 } ~> MAP x @');
    expect(parallel.get_stack().get_items()).toEqual([[1, 2, 3, 4], 0]);
  });

  test("a user word that binds an old version of a redefined word keeps that binding", async () => {
    const { serial, parallel } = await serialAndParallel(": A 1 ; : B A + ; : A 10 ;", "[1 2 3 4]", "B");
    expect(parallel.get_stack().get_items()).toEqual(serial.get_stack().get_items());
    expect(parallel.get_stack().get_items()).toEqual([[2, 3, 4, 5]]);
  });

  test("a memo computed before the MAP keeps its value in each group", async () => {
    const setup = '["n"] VARIABLES 0 n ! @: M n @ 1 + DUP n ! ; M POP : ADD-M M + ;';
    const { serial, parallel } = await serialAndParallel(setup, "[10 20 30 40]", "ADD-M");
    expect(parallel.get_stack().get_items()).toEqual(serial.get_stack().get_items());
    expect(parallel.get_stack().get_items()).toEqual([[11, 21, 31, 41]]);
  });

  test("a failing group leaves the parent's stack as it was", async () => {
    const parallel = new StandardInterpreter();
    await parallel.run(': BAD DUP POP POP ; "before"');
    await expect(parallel.run('[1 2 3 4] "BAD" { .interps 2 } ~> MAP')).rejects.toThrow();
    expect(parallel.get_stack().get_items()).toEqual(["before"]);
  });

  test("an import after a user word of the same name shadows it, as in serial MAP", async () => {
    // Z keeps the user X in the export list, so the duplicate compiles it.
    const program = ': X 1 + ; : Z X ; ["hundred"] USE-MODULES [1 2 3 4] "X" ';
    const serial = new StandardInterpreter([new HundredModule()]);
    await serial.run(program + "MAP");
    const parallel = new StandardInterpreter([new HundredModule()]);
    await parallel.run(program + "{ .interps 2 } ~> MAP");
    expect(serial.get_stack().get_items()).toEqual([[100, 100, 100, 100]]);
    expect(parallel.get_stack().get_items()).toEqual(serial.get_stack().get_items());
  });

  test("a user word after an import of the same name shadows it, as in serial MAP", async () => {
    const program = '["hundred"] USE-MODULES : X 1 + ; [1 2 3 4] "X" ';
    const serial = new StandardInterpreter([new HundredModule()]);
    await serial.run(program + "MAP");
    const parallel = new StandardInterpreter([new HundredModule()]);
    await parallel.run(program + "{ .interps 2 } ~> MAP");
    expect(serial.get_stack().get_items()).toEqual([[2, 3, 4, 5]]);
    expect(parallel.get_stack().get_items()).toEqual(serial.get_stack().get_items());
  });

  test("a user word that uses a custom literal runs in each group", async () => {
    const parallel = new StandardInterpreter();
    parallel.register_literal_handler((s: string) => (s === "SEVEN" ? 7 : null));
    await parallel.run(': ADD7 SEVEN + ; [1 2 3 4] "ADD7" { .interps 2 } ~> MAP');
    expect(parallel.get_stack().get_items()).toEqual([[8, 9, 10, 11]]);
  });
});

describe("dup_interpreter", () => {
  test("keeps the literal handlers and the recovery budget", async () => {
    const source = new StandardInterpreter();
    source.register_literal_handler((s: string) => (s === "SEVEN" ? 7 : null));
    source.set_max_attempts(9);
    const dup = dup_interpreter(source);
    await dup.run("SEVEN");
    expect(dup.get_stack().get_items()).toEqual([7]);
    expect(dup.get_max_attempts()).toBe(9);
  });

  test("keeps a user word that shadows an imported word of the same name", async () => {
    const source = new StandardInterpreter([new HundredModule()]);
    await source.run('["hundred"] USE-MODULES : X 1 + ;');
    const dup = dup_interpreter(source);
    await dup.run("5 X");
    expect(dup.get_stack().get_items()).toEqual([6]);
  });
});
