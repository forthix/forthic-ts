import { StandardInterpreter } from "../interpreter";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

// ========================================
// Simple Array Operations
// ========================================

test("APPEND", async () => {
  await interp.run(`[ 1 2 3 ] 4 APPEND`);
  expect(interp.stack_pop()).toEqual([1, 2, 3, 4]);
});

test("REVERSE", async () => {
  await interp.run(`[ 1 2 3 ] REVERSE`);
  expect(interp.stack_pop()).toEqual([3, 2, 1]);
});

test("UNIQUE", async () => {
  await interp.run(`[ 1 2 3 3 2 ] UNIQUE`);
  expect(interp.stack_pop()).toEqual([1, 2, 3]);
});

test("LENGTH", async () => {
  await interp.run(`['a' 'b' 'c'] LENGTH`);
  expect(interp.stack_pop()).toBe(3);
});

// ========================================
// Access Operations
// ========================================

test("NTH", async () => {
  await interp.run(`[0 1 2 3 4 5 6] 0 NTH`);
  expect(interp.stack_pop()).toBe(0);

  await interp.run(`[0 1 2 3 4 5 6] 5 NTH`);
  expect(interp.stack_pop()).toBe(5);

  await interp.run(`[0 1 2 3 4 5 6] 55 NTH`);
  expect(interp.stack_pop()).toBeNull();
});

test("LAST", async () => {
  await interp.run(`[0 1 2 3 4 5 6] LAST`);
  expect(interp.stack_pop()).toBe(6);
});

test("SLICE", async () => {
  await interp.run(`['a' 'b' 'c' 'd' 'e' 'f' 'g'] 0 2 SLICE`);
  expect(interp.stack_pop()).toEqual(["a", "b", "c"]);

  await interp.run(`['a' 'b' 'c' 'd' 'e' 'f' 'g'] 1 3 SLICE`);
  expect(interp.stack_pop()).toEqual(["b", "c", "d"]);

  await interp.run(`['a' 'b' 'c' 'd' 'e' 'f' 'g'] 5 3 SLICE`);
  expect(interp.stack_pop()).toEqual(["f", "e", "d"]);
});

test("TAKE", async () => {
  await interp.run(`[0 1 2 3 4 5 6] 3 TAKE`);
  expect(interp.stack_pop()).toEqual([0, 1, 2]);
});

test("DROP", async () => {
  await interp.run(`[0 1 2 3 4 5 6] 4 DROP`);
  expect(interp.stack_pop()).toEqual([4, 5, 6]);
});

// ========================================
// Set Operations
// ========================================

test("DIFFERENCE", async () => {
  await interp.run(`['a' 'b' 'c'] ['a' 'c' 'd'] DIFFERENCE`);
  expect(interp.stack_pop()).toEqual(["b"]);

  await interp.run(`['a' 'c' 'd'] ['a' 'b' 'c'] DIFFERENCE`);
  expect(interp.stack_pop()).toEqual(["d"]);
});

test("INTERSECTION", async () => {
  await interp.run(`['a' 'b' 'c'] ['a' 'c' 'd'] INTERSECTION`);
  const result = interp.stack_pop();
  expect(result.sort()).toEqual(["a", "c"]);
});

test("UNION", async () => {
  await interp.run(`['a' 'b' 'c'] ['a' 'c' 'd'] UNION`);
  const result = interp.stack_pop();
  expect(result.sort()).toEqual(["a", "b", "c", "d"]);
});

// ========================================
// Sort Operations
// ========================================

test("SHUFFLE", async () => {
  await interp.run(`[0 1 2 3 4 5 6] SHUFFLE`);
  const result = interp.stack_pop();
  expect(result.length).toBe(7);
});

test("SORT", async () => {
  await interp.run(`[2 8 1 4 7 3] SORT`);
  expect(interp.stack_pop()).toEqual([1, 2, 3, 4, 7, 8]);
});

test("SORT with null", async () => {
  await interp.run(`[2 8 1 NULL 4 7 NULL 3] SORT`);
  expect(interp.stack_pop()).toEqual([1, 2, 3, 4, 7, 8, null, null]);
});

// ========================================
// Transform Operations
// ========================================

test("UNPACK", async () => {
  await interp.run(`[0 1 2] UNPACK`);
  const stack = (interp as any).stack.get_items();
  expect(stack[0]).toBe(0);
  expect(stack[1]).toBe(1);
  expect(stack[2]).toBe(2);
});

test("FLATTEN", async () => {
  await interp.run(`[0 [1 2 [3 [4]]]] FLATTEN`);
  expect(interp.stack_pop()).toEqual([0, 1, 2, 3, 4]);
});

test.skip("REDUCE", async () => {
  // TODO: Needs MathModule for ADD
  await interp.run(`[1 2 3 4 5] 10 "ADD" REDUCE`);
  expect(interp.stack_pop()).toBe(25);
});

// ========================================
// Combine Operations
// ========================================

test("ZIP", async () => {
  await interp.run(`['a' 'b'] [1 2] ZIP`);
  const array = interp.stack_pop();
  expect(array[0]).toEqual(["a", 1]);
  expect(array[1]).toEqual(["b", 2]);
});

test.skip("ZIP_WITH", async () => {
  // TODO: Needs MathModule for ADD
  await interp.run(`[10 20] [1 2] "ADD" ZIP_WITH`);
  const array = interp.stack_pop();
  expect(array[0]).toBe(11);
  expect(array[1]).toBe(22);
});

test("INDEX", async () => {
  await interp.run(`['a' 'b' 'c'] INDEX`);
  const result = interp.stack_pop();
  expect(result[0]).toBe('a');
  expect(result[1]).toBe('b');
  expect(result[2]).toBe('c');
});

test("KEY_OF", async () => {
  await interp.run(`['a' 'b' 'c' 'd'] 'c' KEY_OF`);
  expect(interp.stack_pop()).toBe(2);

  await interp.run(`['a' 'b' 'c' 'd'] 'z' KEY_OF`);
  expect(interp.stack_pop()).toBeNull();
});

// ========================================
// Filter Operations
// ========================================

test.skip("SELECT", async () => {
  // TODO: Needs MathModule for MOD
  await interp.run(`[0 1 2 3 4 5 6] "2 MOD 1 ==" SELECT`);
  expect(interp.stack_pop()).toEqual([1, 3, 5]);
});

// ========================================
// Group Operations
// ========================================

test("GROUPS_OF", async () => {
  await interp.run(`[1 2 3 4 5 6 7 8] 3 GROUPS_OF`);
  const groups = interp.stack_pop();
  expect(groups[0]).toEqual([1, 2, 3]);
  expect(groups[1]).toEqual([4, 5, 6]);
  expect(groups[2]).toEqual([7, 8]);
});

// ========================================
// Advanced Operations
// ========================================

test.skip("FOREACH", async () => {
  // TODO: Needs MathModule for +
  await interp.run(`0 [1 2 3 4 5] '+' FOREACH`);
  expect(interp.stack_pop()).toBe(15);
});

test.skip("MAP", async () => {
  // TODO: Needs MathModule for *
  await interp.run(`[1 2 3 4 5] '2 *' MAP`);
  expect(interp.stack_pop()).toEqual([2, 4, 6, 8, 10]);
});

test.skip("<REPEAT", async () => {
  // TODO: Needs MathModule for +
  await interp.run(`[0 "1 +" 6 l_REPEAT]`);
  expect(interp.stack_pop()).toEqual([0, 1, 2, 3, 4, 5, 6]);
});
