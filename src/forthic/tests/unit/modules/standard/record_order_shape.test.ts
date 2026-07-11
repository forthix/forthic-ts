/**
 * Record access words should (a) iterate in INSERTION order (matching
 * FILTER/REDUCE/GROUP-BY), not sorted-key order, and (b) preserve the record
 * shape — TAKE/SKIP on a record return a record, not an array of values.
 *
 * The fixture record is built with keys in the order c, a, b so insertion
 * order (c, a, b) is observably different from sorted order (a, b, c).
 */
import { StandardInterpreter } from "../../../../interpreter";

let interp: StandardInterpreter;
const REC = `[["c" 3] ["a" 1] ["b" 2]] REC`;

beforeEach(() => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

test("FIRST on a record uses insertion order", async () => {
  await interp.run(`${REC} FIRST`);
  expect(interp.stack_pop()).toBe(3); // c, the first inserted (not a)
});

test("LAST on a record uses insertion order", async () => {
  await interp.run(`${REC} LAST`);
  expect(interp.stack_pop()).toBe(2); // b, the last inserted (not c)
});

test("NTH on a record uses insertion order", async () => {
  await interp.run(`${REC} 0 NTH`);
  expect(interp.stack_pop()).toBe(3); // index 0 = c
});

test("UNPACK on a record pushes values in insertion order", async () => {
  await interp.run(`${REC} UNPACK`);
  expect(interp.get_stack().get_items()).toEqual([3, 1, 2]);
});

test("TAKE on a record returns a record in insertion order", async () => {
  await interp.run(`${REC} 2 TAKE`);
  expect(interp.stack_pop()).toEqual({ c: 3, a: 1 });
});

test("SKIP on a record returns a record in insertion order", async () => {
  await interp.run(`${REC} 1 SKIP`);
  expect(interp.stack_pop()).toEqual({ a: 1, b: 2 });
});

test("SLICE on a record keeps record shape and insertion order", async () => {
  // SLICE is inclusive of both ends; 0..1 -> the first two entries.
  await interp.run(`${REC} 0 1 SLICE`);
  expect(interp.stack_pop()).toEqual({ c: 3, a: 1 });
});

test("TAKE-LAST on a record uses insertion order", async () => {
  await interp.run(`${REC} 2 TAKE-LAST`);
  expect(interp.stack_pop()).toEqual({ a: 1, b: 2 });
});

test("arrays are unaffected", async () => {
  await interp.run(`[ 10 20 30 ] 2 TAKE`);
  expect(interp.stack_pop()).toEqual([10, 20]);
  await interp.run(`[ 10 20 30 ] 1 SKIP`);
  expect(interp.stack_pop()).toEqual([20, 30]);
});
