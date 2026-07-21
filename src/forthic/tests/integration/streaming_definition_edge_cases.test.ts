import { StandardInterpreter, export_state, import_state } from "../../interpreter";
import { Module } from "../../module";

// Exploratory edge cases for streamingRun beyond the three definition bugs.
// Each probes a corner of the "re-tokenize the whole chunk, execute only new
// tokens" model. Any RED here is a candidate additional defect.
describe("streamingRun edge cases (exploratory)", () => {
  // Feed `code` one character at a time (done=false), then a final done=true.
  async function driveCharByChar(interp: StandardInterpreter, code: string): Promise<void> {
    for (let i = 1; i <= code.length; i++) {
      await interp.streamingRun(code.slice(0, i), false);
    }
    await interp.streamingRun(code, true);
  }

  // --- Char-by-char source fidelity ---
  test("a definition fed char-by-char serializes the same source as a single run()", async () => {
    const streamed = new StandardInterpreter();
    await driveCharByChar(streamed, ": DOUBLE 2 3 ; 5");

    const reference = new StandardInterpreter();
    await reference.run(": DOUBLE 2 3 ; 5");

    expect(export_state(streamed).word_definitions).toEqual(export_state(reference).word_definitions);
  });

  test("a multi-word body fed char-by-char is neither dropped nor duplicated", async () => {
    // If any body token were dropped or double-added across a chunk boundary,
    // the arithmetic result would differ from 3.
    const interp = new StandardInterpreter();
    await driveCharByChar(interp, ": ADD3 1 + 1 + 1 + ;");
    await interp.run("0 ADD3");
    expect(interp.get_stack().get_items()).toEqual([3]);
  });

  // --- Define and use within the same streamed turn ---
  test("define-then-use in one streamed turn", async () => {
    const interp = new StandardInterpreter();
    await driveCharByChar(interp, ": DOUBLE 2 * ; 5 DOUBLE");
    expect(interp.get_stack().get_items()).toEqual([10]);
  });

  // --- Two definitions in one streamed turn ---
  test("two definitions in one streamed turn both work and serialize correctly", async () => {
    const streamed = new StandardInterpreter();
    await driveCharByChar(streamed, ": A 1 ; : B 2 ;");
    await streamed.run("A B +");
    expect(streamed.get_stack().get_items()).toEqual([3]);

    const reference = new StandardInterpreter();
    await reference.run(": A 1 ; : B 2 ;");
    expect(export_state(streamed).word_definitions).toEqual(export_state(reference).word_definitions);
  });

  // --- Memo (@:) parity with the `:` fixes ---
  test("a memo defined char-by-char round-trips through export/import", async () => {
    const streamed = new StandardInterpreter();
    await driveCharByChar(streamed, "@: ANSWER 42 ;");

    const restored = new StandardInterpreter();
    await import_state(restored, export_state(streamed));
    await restored.run("ANSWER");
    expect(restored.get_stack().get_items()).toEqual([42]);
  });

  test("a memo serializes the same source as a single run()", async () => {
    const streamed = new StandardInterpreter();
    await streamed.streamingRun("@: ANSWER 42 ;", true);

    const reference = new StandardInterpreter();
    await reference.run("@: ANSWER 42 ;");

    expect(export_state(streamed).word_definitions).toEqual(export_state(reference).word_definitions);
  });

  // --- Redefinition persistence: the snapshot must round-trip the LIVE word ---
  test("export_state keeps the latest definition of a word redefined across turns", async () => {
    const interp = new StandardInterpreter();
    await interp.streamingRun(": FOO 1 ;", true);
    await interp.streamingRun(": FOO 2 ;", true); // redefine in a later turn
    await interp.run("FOO");
    // Live behavior resolves to the latest definition (find_word scans backward).
    expect(interp.get_stack().get_items()).toEqual([2]);

    // The snapshot must serialize the word that is actually live, or a
    // snapshot/restore across a queue-loop pass silently reverts the redefinition.
    const fooDefs = export_state(interp).word_definitions.filter((d) => d.includes("FOO"));
    expect(fooDefs).toEqual([": FOO 2 ;"]);
  });

  test("a redefinition that references a later-defined helper round-trips (replay order)", async () => {
    // Body words resolve at define time, so import_state must replay MAIN's
    // redefinition AFTER HELPER exists. If export_state emitted MAIN at its
    // original (earlier) position, restore would throw UnknownWordError; if it
    // kept the first source, restored MAIN would be 1 instead of 10.
    const interp = new StandardInterpreter();
    await interp.run(": MAIN 1 ;");
    await interp.run(": HELPER 10 ;");
    await interp.run(": MAIN HELPER ;"); // redefine MAIN to use the newer helper

    const restored = new StandardInterpreter();
    await import_state(restored, export_state(interp));
    await restored.run("MAIN");
    expect(restored.get_stack().get_items()).toEqual([10]);
  });

  // --- Mid-turn error must not double-execute side effects if the turn continues ---
  // KNOWN HAZARD, deferred: a done=false throw resets the resume
  // pointer to 0 (see resetStreamingSession, called from streamingRun's error
  // finally), so continuing the SAME turn with further done=false chunks re-executes
  // already-run tokens, including side-effecting words. A caller that instead calls
  // abortStreamingRun() (or stops feeding) after a throw avoids it, so this is a
  // latent contract hazard rather than a guaranteed live bug. Marked `failing` so
  // the suite stays green while documenting it; if streamingRun is changed so
  // continuation no longer re-executes, this flips red — delete the annotation and
  // make it a normal test then.
  test.failing(
    "a side-effect word does not run twice when a mid-turn chunk errors and the turn continues",
    async () => {
      const interp = new StandardInterpreter([new CountingModule()]);

      // Chunk executes TICK (side effect) then hits an unknown word before the
      // trailing token. TICK has run once; the chunk throws.
      await expect(interp.streamingRun("TICK NOPE 5", false)).rejects.toThrow();

      // The turn continues with more content (same prefix + more). TICK must not
      // be re-executed from the top.
      await expect(interp.streamingRun("TICK NOPE 5 6", false)).rejects.toThrow();

      expect(CountingModule.ticks).toBe(1);
    },
  );
});

class CountingModule extends Module {
  static ticks = 0;
  constructor() {
    super("counting");
    CountingModule.ticks = 0;
    this.add_module_word("TICK", this.word_TICK.bind(this));
  }
  // ( -- )
  async word_TICK(_interp: StandardInterpreter) {
    CountingModule.ticks += 1;
  }
}
