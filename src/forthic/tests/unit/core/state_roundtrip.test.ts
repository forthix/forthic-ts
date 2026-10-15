import { StandardInterpreter, export_state, import_state } from "../../../interpreter";

// A body binds its words when it is compiled, so a live word can hold an older
// version of another word. A snapshot must restore those bindings exactly.

async function liveAndRestored(turns: string[]) {
  const live = new StandardInterpreter();
  for (const t of turns) await live.run(t);
  const restored = new StandardInterpreter();
  // Through JSON, as a host persists it.
  await import_state(restored, JSON.parse(JSON.stringify(export_state(live))));
  return { live, restored };
}

// Runs `code` on an empty stack and returns the result, or the error's name.
async function outcome(interp: StandardInterpreter, code: string): Promise<unknown> {
  interp.get_stack().set_raw_items([]);
  try {
    await interp.run(code);
    return interp.get_stack().get_items();
  } catch (e) {
    return `error: ${(e as Error).name}`;
  }
}

async function expectSameOutcome(turns: string[], probe: string) {
  const { live, restored } = await liveAndRestored(turns);
  const expected = await outcome(live, probe);
  if (typeof expected === "string") throw new Error(`the live probe failed: ${expected}`);
  expect(await outcome(restored, probe)).toEqual(expected);
}

describe("export_state / import_state round trip", () => {
  test("a helper redefined after a word that uses it", async () => {
    await expectSameOutcome([": A 1 ; : B A 2 + ;", ": A 10 ;"], "B A");
  });

  test("a definition that reads a module variable by name", async () => {
    await expectSameOutcome(['["x"] VARIABLES 5 x ! : B x @ ;'], "B");
  });

  test("a variable with the name of a word defined later keeps its binding", async () => {
    await expectSameOutcome(['["x"] VARIABLES 5 x ! : B x @ ;', ": x 7 ;"], "B x");
  });

  test("a word defined before a variable of the same name keeps its binding", async () => {
    await expectSameOutcome([': x 7 ; ["x"] VARIABLES : B x ;'], "B");
  });

  test("a memo redefined as a plain word, with a dependent on its bang variant", async () => {
    await expectSameOutcome(["@: M 1 ; : U M! ;", ": M 2 ;"], "U M");
  });

  test("a dependent on a memo's bang-at variant", async () => {
    await expectSameOutcome(["@: M 1 ; : U M!@ ;", ": M 2 ;"], "U M");
  });

  test("a memo whose body uses a helper that is redefined later", async () => {
    await expectSameOutcome([": H 1 ; @: M H ;", ": H 2 ;"], "M H");
  });

  test("a redefinition that uses a word bound to the old version (no order restores it)", async () => {
    await expectSameOutcome([": A 1 ; : B A ;", ": A B 1 + ;"], "A B");
  });

  test("a user word shadowing a stdlib word, then redefined (silent rebinding, no error)", async () => {
    await expectSameOutcome([": LENGTH 99 ; : B LENGTH ;", ": LENGTH 7 ;"], "[1 2] B");
  });

  test("a chain of old versions", async () => {
    await expectSameOutcome([": C 1 ; : A C ; : B A ;", ": C 2 ; : A 5 ;"], "B A C");
  });

  test("a restored snapshot exports the same snapshot again", async () => {
    const { live, restored } = await liveAndRestored([": A 1 ; : B A ;", ": A B 1 + ;", ": C 3 ;", ": C 4 ;"]);
    expect(export_state(restored)).toEqual(export_state(live));
  });
});

describe("export_state keeps only the definition versions that a live word uses", () => {
  test("drops old versions that no word uses", async () => {
    const live = new StandardInterpreter();
    await live.run(": A 1 ; : A 2 ; : A 3 ;");
    expect(export_state(live).word_definitions).toEqual([": A 3 ;"]);
  });

  test("keeps an old version that a live word uses, in definition order", async () => {
    const live = new StandardInterpreter();
    await live.run(": A 1 ; : A 2 ; : B A ; : A 3 ;");
    expect(export_state(live).word_definitions).toEqual([": A 2 ;", ": B A ;", ": A 3 ;"]);
  });

  test("keeps the versions that a kept old version uses", async () => {
    const live = new StandardInterpreter();
    await live.run(": C 1 ; : A C ; : B A ; : C 2 ; : A 5 ;");
    expect(export_state(live).word_definitions).toEqual([": C 1 ;", ": A C ;", ": B A ;", ": C 2 ;", ": A 5 ;"]);
  });

  test("drops an old version once no live word uses it", async () => {
    const live = new StandardInterpreter();
    await live.run(": A 1 ; : B A ; : A 2 ; : B 3 ;");
    expect(export_state(live).word_definitions).toEqual([": A 2 ;", ": B 3 ;"]);
  });

  test("keeps a memo that a live word uses through its bang variant", async () => {
    const live = new StandardInterpreter();
    await live.run("@: M 1 ; : U M! ; : M 2 ;");
    expect(export_state(live).word_definitions).toEqual(["@: M 1 ;", ": U M! ;", ": M 2 ;"]);
  });
});

// Every history of up to three definitions from a small set that runs live must
// restore to the same behavior. The set has redefinitions, a cycle through an old
// version, memos and their bang variants, a module variable, and a stdlib name.
describe("export_state / import_state over short histories", () => {
  const events = [
    ": A 1 ;",
    ": A 2 ;",
    ": B A ;",
    ": A B 1 + ;",
    "@: M A ;",
    ": U M! A ;",
    '["x"] VARIABLES 5 x ! : V x @ ;',
    ": LENGTH 99 ;",
    ": L [1 2] LENGTH ;",
  ];
  const probes = ["A", "B", "M", "U", "V", "L", "[1 2 3] LENGTH"];

  function histories(maxLength: number): string[][] {
    const result: string[][] = [[]];
    let frontier: string[][] = [[]];
    for (let n = 0; n < maxLength; n++) {
      frontier = frontier.flatMap((h) => events.map((e) => [...h, e]));
      result.push(...frontier);
    }
    return result;
  }

  test("every history that runs live restores to the same behavior", async () => {
    const unfaithful: string[] = [];
    let checked = 0;
    for (const turns of histories(3)) {
      const live = new StandardInterpreter();
      try {
        for (const t of turns) await live.run(t);
      } catch {
        continue; // Not a valid live history.
      }
      checked++;
      const restored = new StandardInterpreter();
      try {
        await import_state(restored, JSON.parse(JSON.stringify(export_state(live))));
      } catch (e) {
        unfaithful.push(`${JSON.stringify(turns)} → import throws ${(e as Error).message}`);
        continue;
      }
      for (const probe of probes) {
        const expected = await outcome(live, probe);
        const actual = await outcome(restored, probe);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          unfaithful.push(`${JSON.stringify(turns)} ${probe}: live ${JSON.stringify(expected)}, restored ${JSON.stringify(actual)}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(unfaithful).toEqual([]);
  });
});
