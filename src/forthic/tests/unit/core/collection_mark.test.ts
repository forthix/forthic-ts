import { StandardInterpreter } from "../../../interpreter";
import { CollectionMark } from "../../../tokenizer";
import { getForthicType } from "../../../../common/type_utils";

/**
 * `[` and `{` leave a `CollectionMark` on the stack, and `]` and `}` fold back
 * to it. The mark is an ordinary Forthic value, so words can move it — that is
 * what makes `[` a word rather than syntax. It is deliberately not serializable
 * and deliberately not a `PositionedString`.
 */

async function run(code: string) {
  const interp = new StandardInterpreter();
  await interp.run(code);
  return interp;
}

test("a mark is a CollectionMark carrying its kind and location", async () => {
  // DUP copies the mark; the first `]` closes the copy, leaving the original.
  const interp = await run(`[ DUP 1 ]`);
  const [mark, array] = interp.get_stack().get_items();
  expect(mark).toBeInstanceOf(CollectionMark);
  expect((mark as CollectionMark).kind).toBe("array");
  expect((mark as CollectionMark).open).toBe("[");
  expect((mark as CollectionMark).location.line).toBe(1);
  expect((mark as CollectionMark).location.column).toBe(1);
  expect(array).toEqual([1]);
});

test("a mark carries no tokenizer bookkeeping", async () => {
  const interp = await run(`[ DUP 1 ]`);
  const mark = interp.get_stack().get_items()[0] as CollectionMark;
  expect(Object.keys(mark).sort()).toEqual(["kind", "location"]);
});

/**
 * A mark that escaped a fold used to be the tokenizer's own `Token`. Because
 * `getForthicType` classifies any object as a record, it serialized onto the
 * wire as a record of parser internals — `type`, `string`, `start_pos` — which
 * the receiving runtime could not tell from data the program meant to send.
 */
test("a mark cannot be serialized", async () => {
  const interp = await run(`[ DUP 1 ]`);
  const mark = interp.get_stack().get_items()[0];
  expect(() => getForthicType(mark)).toThrow("cannot be serialized");
});

test("an array of ordinary values still serializes", async () => {
  const interp = await run(`[ 1 2 3 ]`);
  expect(getForthicType(interp.stack_pop())).toBe("array");
});

// `stack_pop` unwraps a PositionedString to its primitive. If the mark were one,
// `]` would see the bare string "[" and never recognize its own opener.
test("a dot symbol in an array is still an ordinary string", async () => {
  const interp = await run(`[ .a .b ]`);
  expect(interp.stack_pop()).toEqual(["a", "b"]);
});

/**
 * The payoff of the mark being a value: words compose with it. Moving the mark
 * changes what the literal captures, and `[` factors into a definition.
 */
test("SWAP moves the mark, pulling an outer value into the array", async () => {
  const interp = await run(`1 [ SWAP ]`);
  expect(interp.stack_pop()).toEqual([1]);
});

test("`[` can be factored into a definition", async () => {
  const interp = await run(`: MARK   [ ;   MARK 1 2 ]`);
  expect(interp.stack_pop()).toEqual([1, 2]);
});

test("dropping the mark leaves nothing for `]` to close", async () => {
  await expect(run(`1 2 [ DROP 3 ]`)).rejects.toThrow(`Unmatched ']'`);
});

test("a mismatch reports the location of the unclosed opener", async () => {
  await expect(run(`{ .a [ .b 1 }`)).rejects.toThrow(`Add the ']' it needs`);
  const interp = new StandardInterpreter();
  const err = await interp.run(`{ .a [ .b 1 }`).catch((e) => e);
  // The `[` is at column 6, not the `}` that tripped over it.
  expect(err.location?.column).toBe(6);
});
