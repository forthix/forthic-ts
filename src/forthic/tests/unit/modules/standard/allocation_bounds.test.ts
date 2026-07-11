/**
 * RANGE and SLICE materialize an array whose size comes from caller-supplied
 * numbers. Guard against an LLM emitting something pathological (e.g.
 * `1 2000000000 RANGE`) by rejecting over-limit sizes BEFORE allocating.
 *
 * The over-limit assertions rely on the check happening before the loop — the
 * word must throw without trying to build the giant array, so these are safe to
 * run.
 */
import { StandardInterpreter } from "../../../../interpreter";

let interp: StandardInterpreter;

beforeEach(() => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

test("RANGE rejects an over-limit size instead of OOMing", async () => {
  await expect(interp.run("1 2000000000 RANGE")).rejects.toThrow(/too large|exceed|limit/i);
});

test("RANGE still produces normal ranges", async () => {
  await interp.run("1 5 RANGE");
  expect(interp.stack_pop()).toEqual([1, 2, 3, 4, 5]);
});

test("RANGE with end < start is empty (and not bounded)", async () => {
  await interp.run("5 1 RANGE");
  expect(interp.stack_pop()).toEqual([]);
});

test("SLICE rejects an over-limit span instead of OOMing", async () => {
  await expect(interp.run("[ 1 ] 0 2000000000 SLICE")).rejects.toThrow(/too large|exceed|limit/i);
});

test("SLICE still slices normally", async () => {
  await interp.run("[ 10 20 30 40 ] 1 2 SLICE");
  expect(interp.stack_pop()).toEqual([20, 30]);
});
