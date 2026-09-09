import { StandardInterpreter } from "../../../interpreter";
import { PositionedString } from "../../../tokenizer";

/**
 * Record literals: `{ .key value }`.
 *
 * The semantics are ported from forthic-odin (`forthic/collection_words.odin`,
 * `builtin_end_record`), and the first six cases mirror its
 * `interpreter_test.odin` coverage one-for-one so the two runtimes can be
 * compared directly.
 */

async function run(code: string) {
  const interp = new StandardInterpreter();
  await interp.run(code);
  return interp;
}

test("builds a record from key/value pairs", async () => {
  const interp = await run(`{ .name "Player One" .score 100 }`);
  expect(interp.get_stack().length).toBe(1);
  expect(interp.stack_pop()).toEqual({ name: "Player One", score: 100 });
});

test("a trailing bare flag takes the value true", async () => {
  const interp = await run(`{ .a 1 .flag }`);
  expect(interp.stack_pop()).toEqual({ a: 1, flag: true });
});

test("consecutive bare flags each take true", async () => {
  const interp = await run(`{ .flag .other }`);
  expect(interp.stack_pop()).toEqual({ flag: true, other: true });
});

test("a record of nothing but bare flags", async () => {
  const interp = await run(`{ .flag }`);
  expect(interp.stack_pop()).toEqual({ flag: true });
});

test("a non-dot-symbol key is an error", async () => {
  await expect(run(`{ "not-a-key" 5 }`)).rejects.toThrow("must be dot symbols");
});

test("records nest, and values are ordinary stack pushes", async () => {
  const interp = await run(`{ .a { .b [ 10 20 30 ] } }`);
  expect(interp.stack_pop()).toEqual({ a: { b: [10, 20, 30] } });
});

// --- Beyond the odin set ---

test("an empty record literal", async () => {
  const interp = await run(`{ }`);
  expect(interp.stack_pop()).toEqual({});
});

test("values can be computed", async () => {
  const interp = await run(`{ .sum 1 2 + .doubled 21 2 * }`);
  expect(interp.stack_pop()).toEqual({ sum: 3, doubled: 42 });
});

test("a record literal compiles into a definition", async () => {
  const interp = await run(`: MAKE-REC   { .a 1 } ;   MAKE-REC MAKE-REC`);
  expect(interp.stack_pop()).toEqual({ a: 1 });
  expect(interp.stack_pop()).toEqual({ a: 1 });
});

test("a later key wins", async () => {
  const interp = await run(`{ .a 1 .a 2 }`);
  expect(interp.stack_pop()).toEqual({ a: 2 });
});

test("keys keep insertion order", async () => {
  const interp = await run(`{ .z 1 .a 2 .m 3 }`);
  expect(Object.keys(interp.stack_pop())).toEqual(["z", "a", "m"]);
});

test("a closing brace with no open record is a clear error", async () => {
  await expect(run(`1 2 }`)).rejects.toThrow("no open record literal");
});

test("a record literal survives a string containing a brace", async () => {
  const interp = await run(`{ .sql "jsonb_set(data, '{status}', '1')" }`);
  expect(interp.stack_pop()).toEqual({
    sql: "jsonb_set(data, '{status}', '1')",
  });
});

test("a dot symbol is still an ordinary string outside a record", async () => {
  const interp = await run(`.symbol .test-123`);
  expect(interp.get_stack().get_items()).toEqual(["symbol", "test-123"]);
});

test("a dot symbol reaching data lands as a plain string", async () => {
  // DotSymbol is a PositionedString subclass, so it must not leak into data.
  // Inside a record literal a dot symbol is always a key, so reach it through
  // an array, where it is an ordinary value.
  const interp = await run(`{ .key [ .a .b ] }`);
  const record = interp.get_stack().get_raw_items()[0] as Record<string, any>;
  expect(record).toEqual({ key: ["a", "b"] });
  for (const value of record.key) {
    expect(value).not.toBeInstanceOf(PositionedString);
  }
});

test("REC still builds records from entry pairs", async () => {
  const interp = await run(`[ [ .name "Rino" ] [ .city "San Jose" ] ] REC`);
  expect(interp.stack_pop()).toEqual({ name: "Rino", city: "San Jose" });
});

test("REC still builds records from a computed array", async () => {
  // The `MAP … REC` shape is the reason REC has to survive: the entries are
  // produced at run time, so a literal cannot express it.
  const interp = await run(`[ [ .a 1 ] [ .b 2 ] ] "DUP" MAP REC`);
  expect(interp.stack_pop()).toEqual({ a: 1, b: 2 });
});
