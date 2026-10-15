import { StandardInterpreter } from "../../../interpreter";

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
});
