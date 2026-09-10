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

test("a key with no value is an error", async () => {
  await expect(run(`{ .a 1 .flag }`)).rejects.toThrow("has no value");
});

test("a lone key is an error", async () => {
  await expect(run(`{ .flag }`)).rejects.toThrow("has no value");
});

test("the error names the dangling key", async () => {
  await expect(run(`{ .a 1 .flag }`)).rejects.toThrow(/\.flag/);
});

// A dot symbol is an ordinary string once it reaches a value position, so this
// is a well-formed pair — and means exactly what `[ [ .flag .other ] ] REC`
// always meant. Only an odd number of items is an error.
test("a dot symbol is usable as a value", async () => {
  const interp = await run(`{ .flag .other }`);
  expect(interp.stack_pop()).toEqual({ flag: "other" });
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

/**
 * A close word recognizes only its own opening marker, so the other one used to
 * be collected as an ordinary item: `{ .a [ .b 1 }` produced a record whose `a`
 * was the array's own open mark, at an even item count so the key/value check saw
 * nothing wrong either. The failure mode was a wrong value rather than an
 * exception, which is why both directions are pinned.
 */
test("a `}` reaching an unclosed `[` is an error, not a Token in the record", async () => {
  await expect(run(`{ .a [ .b 1 }`)).rejects.toThrow("Mismatched '}'");
});

test("a `]` reaching an unclosed `{` is an error, not a Token in the array", async () => {
  await expect(run(`[ .a { 1 2 ]`)).rejects.toThrow("Mismatched ']'");
});

test("the mismatch error names the delimiter that is missing", async () => {
  await expect(run(`{ .a [ .b 1 }`)).rejects.toThrow(`Add the ']' it needs`);
  await expect(run(`[ .a { 1 2 ]`)).rejects.toThrow(`Add the '}' it needs`);
});

test("a closing bracket with no open array is a clear error", async () => {
  // Previously a bare StackUnderflowError, which describes the symptom from
  // inside the fold rather than what the author got wrong.
  await expect(run(`1 2 ]`)).rejects.toThrow(`Unmatched ']'`);
});

test("well-formed nesting of both kinds still builds", async () => {
  const interp = await run(`{ .a [ 1 { .b 2 } ] }`);
  expect(interp.stack_pop()).toEqual({ a: [1, { b: 2 }] });
});
