import { StandardInterpreter, export_state, import_state } from "../../interpreter";
import { MissingSemicolonError } from "../../errors";

// Regression coverage for three streamingRun definition defects:
//   1. Compile state (is_compiling / cur_definition / is_memo_definition) leaks
//      across turns, permanently wedging the shared interpreter after any throw
//      inside a definition body.
//   2. A chunk boundary that lands right after a bare `:` / `@:` throws instead
//      of holding the incomplete token back.
//   3. The serialized `source` of a streaming-defined word is sliced from a live
//      `input_pos` that has already run to the end of the chunk, so export_state
//      records the wrong body and the word can't round-trip through import_state.
describe("streamingRun definition integrity", () => {
  // --- Bug 1: compile state must not survive a failed turn ---
  describe("compile state does not leak across turns", () => {
    test("is_compiling is cleared after a turn throws with a definition still open", async () => {
      const interp = new StandardInterpreter();
      await expect(interp.streamingRun(": FOO 1", true)).rejects.toBeInstanceOf(MissingSemicolonError);
      // The failed turn left a definition open; the interpreter must not stay in
      // compile mode.
      expect((interp as unknown as { is_compiling: boolean }).is_compiling).toBe(false);
    });

    test("a later, independent turn runs normally after a failed definition turn", async () => {
      const interp = new StandardInterpreter();
      await expect(interp.streamingRun(": FOO 1", true)).rejects.toBeInstanceOf(MissingSemicolonError);
      // Completely unrelated program — must execute, not get swallowed into the
      // orphaned FOO definition or re-throw MissingSemicolonError.
      await interp.streamingRun("10 20 +", true);
      expect(interp.get_stack().get_items()).toEqual([30]);
    });
  });

  // --- Bug 2: a delta boundary right after ':' / '@:' must not throw ---
  describe("a chunk boundary right after a bare ':' is held back (done=false)", () => {
    test("bare ':' does not throw", async () => {
      const interp = new StandardInterpreter();
      await expect(interp.streamingRun(":", false)).resolves.toBeUndefined();
    });

    test("':' followed by whitespace does not throw", async () => {
      const interp = new StandardInterpreter();
      await expect(interp.streamingRun(": ", false)).resolves.toBeUndefined();
    });

    test("bare '@:' does not throw", async () => {
      const interp = new StandardInterpreter();
      await expect(interp.streamingRun("@:", false)).resolves.toBeUndefined();
    });

    test("a definition fed char-by-char (boundary lands after ':') still defines the word", async () => {
      const interp = new StandardInterpreter();
      const code = ": DOUBLE 2 * ;";
      for (let i = 1; i <= code.length; i++) {
        await interp.streamingRun(code.slice(0, i), false);
      }
      await interp.streamingRun(code, true);
      await interp.run("5 DOUBLE");
      expect(interp.get_stack().get_items()).toEqual([10]);
    });
  });

  // --- Bug 3: serialized source must match the executed program ---
  describe("serialized definition source matches a single run() of the program", () => {
    test("whole definition in one delta serializes the full body", async () => {
      const streamed = new StandardInterpreter();
      await streamed.streamingRun(": DOUBLE 2 DUP ;", true);

      const reference = new StandardInterpreter();
      await reference.run(": DOUBLE 2 DUP ;");

      expect(export_state(streamed).word_definitions).toEqual(export_state(reference).word_definitions);
    });

    test("definition spread across deltas serializes the full body", async () => {
      const streamed = new StandardInterpreter();
      await streamed.streamingRun(": DOUBLE 2", false);
      await streamed.streamingRun(": DOUBLE 2 3", false);
      await streamed.streamingRun(": DOUBLE 2 3 ;", true);

      const reference = new StandardInterpreter();
      await reference.run(": DOUBLE 2 3 ;");

      expect(export_state(streamed).word_definitions).toEqual(export_state(reference).word_definitions);
    });

    test("a streaming-defined word round-trips through export_state/import_state", async () => {
      const streamed = new StandardInterpreter();
      await streamed.streamingRun(": DOUBLE 2 * ;", true);

      const restored = new StandardInterpreter();
      await import_state(restored, export_state(streamed));
      await restored.run("5 DOUBLE");
      expect(restored.get_stack().get_items()).toEqual([10]);
    });
  });
});
