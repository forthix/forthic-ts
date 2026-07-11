/**
 * Value semantics: words that transform a container must not mutate the input.
 * Each test stores an array/record in a variable, applies the word to the
 * value fetched from it, then re-fetches the variable and asserts it's
 * unchanged (or, for VALUES, that the result is not the input's own reference).
 */
import { StandardInterpreter } from "../../../../interpreter";

let interp: StandardInterpreter;

beforeEach(() => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

test("REVERSE does not mutate its input array", async () => {
  await interp.run(`[ 1 2 3 ] .xs ! .xs @ REVERSE .xs @`);
  const [result, xs] = interp.get_stack().get_items();
  expect(result).toEqual([3, 2, 1]);
  expect(xs).toEqual([1, 2, 3]);
});

test("SORT does not mutate its input array", async () => {
  await interp.run(`[ 3 1 2 ] .xs ! .xs @ SORT .xs @`);
  const [result, xs] = interp.get_stack().get_items();
  expect(result).toEqual([1, 2, 3]);
  expect(xs).toEqual([3, 1, 2]);
});

test("SORT with a comparator does not mutate its input array", async () => {
  await interp.run(`[ 3 1 2 ] .xs ! .xs @ [.comparator "-1 *"] ~> SORT .xs @`);
  const [, xs] = interp.get_stack().get_items();
  expect(xs).toEqual([3, 1, 2]);
});

test("APPEND does not mutate its input array", async () => {
  await interp.run(`[ 1 2 ] .xs ! .xs @ 3 APPEND .xs @`);
  const [result, xs] = interp.get_stack().get_items();
  expect(result).toEqual([1, 2, 3]);
  expect(xs).toEqual([1, 2]);
});

test("DELETE does not mutate its input array", async () => {
  await interp.run(`[ 1 2 3 ] .xs ! .xs @ 1 DELETE .xs @`);
  const [result, xs] = interp.get_stack().get_items();
  expect(result).toEqual([1, 3]);
  expect(xs).toEqual([1, 2, 3]);
});

test("DELETE does not mutate its input record", async () => {
  await interp.run(`[["a" 1] ["b" 2]] REC .r ! .r @ "a" DELETE .r @`);
  const [result, r] = interp.get_stack().get_items();
  expect(result).toEqual({ b: 2 });
  expect(r).toEqual({ a: 1, b: 2 });
});

test("VALUES returns a copy, not the input array's own reference", async () => {
  await interp.run(`[ 1 2 3 ] .xs ! .xs @ VALUES .xs @`);
  const [result, xs] = interp.get_stack().get_items();
  expect(result).toEqual([1, 2, 3]);
  expect(result).not.toBe(xs);
});
