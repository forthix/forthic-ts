import { StandardInterpreter } from "../../../interpreter";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

// ========================================
// Basic Arithmetic
// ========================================

test("arithmetic", async () => {
  await interp.run(`
            2 4 +
            2 4 -
            2 4 *
            2 4 /
            5 3 MOD
            2.51 ROUND
            [1 2 3] +
            [2 3 4] *
          `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(6);
  expect(stack[1]).toBe(-2);
  expect(stack[2]).toBe(8);
  expect(stack[3]).toBe(0.5);
  expect(stack[4]).toBe(2);
  expect(stack[5]).toBe(3);
  expect(stack[6]).toBe(6);
  expect(stack[7]).toBe(24);
});

test("DIVIDE", async () => {
  interp.stack_push(10);
  interp.stack_push(2);
  await interp.run("DIVIDE");
  expect(interp.stack_pop()).toEqual(5);
});

// ========================================
// Aggregate Functions
// ========================================

test("MEAN", async () => {
  await interp.run("[1 2 3 4 5] MEAN");
  let stack = (interp as any).stack;
  expect(stack[stack.length - 1]).toBe(3);

  await interp.run("[4] MEAN");
  stack = (interp as any).stack;
  expect(stack[stack.length - 1]).toBe(4);

  await interp.run("[] MEAN");
  stack = (interp as any).stack;
  expect(stack[stack.length - 1]).toBe(0);

  await interp.run("NULL MEAN");
  stack = (interp as any).stack;
  expect(stack[stack.length - 1]).toBe(0);
});

test("MAX of two numbers", async () => {
  interp.stack_push(4);
  interp.stack_push(18);
  await interp.run("MAX");
  expect(interp.stack_pop()).toEqual(18);
});

test("MAX of an array of numbers", async () => {
  interp.stack_push([14, 8, 55, 4, 5]);
  await interp.run("MAX");
  expect(interp.stack_pop()).toEqual(55);
});

test("MIN of two numbers", async () => {
  interp.stack_push(4);
  interp.stack_push(18);
  await interp.run("MIN");
  expect(interp.stack_pop()).toEqual(4);
});

test("MIN of an array of numbers", async () => {
  interp.stack_push([14, 8, 55, 4, 5]);
  await interp.run("MIN");
  expect(interp.stack_pop()).toEqual(4);
});

test("MEAN of an array of numbers", async () => {
  interp.stack_push([1, 2, 3, 4, 5]);
  await interp.run("MEAN");
  expect(interp.stack_pop()).toEqual(3);
});

test("MEAN of an array of letters", async () => {
  interp.stack_push(["a", "a", "b", "c"]);
  await interp.run("MEAN");
  expect(interp.stack_pop()).toEqual({ a: 0.5, b: 0.25, c: 0.25 });
});

test("MEAN of an array of numbers with null values", async () => {
  interp.stack_push([1, 2, 3, null, 4, undefined, 5]);
  await interp.run("MEAN");
  expect(interp.stack_pop()).toEqual(3);
});

test("MEAN of an array of letters with null values", async () => {
  // Ignore null values
  interp.stack_push(["a", "a", undefined, "b", null, "c"]);
  await interp.run("MEAN");
  expect(interp.stack_pop()).toEqual({ a: 0.5, b: 0.25, c: 0.25 });
});

test("MEAN of an array of objects", async () => {
  interp.stack_push([
    { a: 1, b: 0 },
    { a: 2, b: 0 },
    { a: 3, b: 0 },
  ]);
  await interp.run("MEAN");
  expect(interp.stack_pop()).toEqual({ a: 2, b: 0 });
});

test("MEAN of an array of objects with some numbers and some strings", async () => {
  interp.stack_push([
    { a: 0 },
    { a: 1, b: "To Do" },
    { a: 2, b: "To Do" },
    { a: 3, b: "In Progress" },
    { a: 4, b: "Done" },
  ]);
  await interp.run("MEAN");
  expect(interp.stack_pop()).toEqual({
    a: 2,
    b: { "To Do": 0.5, "In Progress": 0.25, Done: 0.25 },
  });
});

// ========================================
// Type Conversion
// ========================================

test("MATH CONVERTERS", async () => {
  await interp.run(`
        "3" >INT
        4 >INT
        4.6 >INT
        "1.2" >FLOAT
        2 >FLOAT
      `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(3);
  expect(stack[1]).toBe(4);
  expect(stack[2]).toBe(4);
  expect(stack[3]).toBe(1.2);
  expect(stack[4]).toBe(2.0);
});

test("TO-FIXED", async () => {
  await interp.run(`
        22 7 / 2 >FIXED
      `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe("3.14");
});

// ========================================
// Special Values
// ========================================

test("INFINITY", async () => {
  await interp.run("INFINITY");
  expect(interp.stack_pop()).toBe(Infinity);
});

// RANGE-INDEX is not a math function - it's in the global/core module
// This test has been moved to the appropriate module test file

// ========================================
// New Math Functions
// ========================================

test("ABS", async () => {
  await interp.run("5 ABS");
  expect(interp.stack_pop()).toBe(5);

  await interp.run("-10 ABS");
  expect(interp.stack_pop()).toBe(10);

  await interp.run("0 ABS");
  expect(interp.stack_pop()).toBe(0);

  await interp.run("NULL ABS");
  expect(interp.stack_pop()).toBeNull();
});

test("SQRT", async () => {
  await interp.run("16 SQRT");
  expect(interp.stack_pop()).toBe(4);

  await interp.run("25 SQRT");
  expect(interp.stack_pop()).toBe(5);

  await interp.run("2 SQRT");
  expect(interp.stack_pop()).toBeCloseTo(1.414, 3);

  await interp.run("NULL SQRT");
  expect(interp.stack_pop()).toBeNull();
});

test("FLOOR", async () => {
  await interp.run("3.7 FLOOR");
  expect(interp.stack_pop()).toBe(3);

  await interp.run("-2.3 FLOOR");
  expect(interp.stack_pop()).toBe(-3);

  await interp.run("5 FLOOR");
  expect(interp.stack_pop()).toBe(5);

  await interp.run("NULL FLOOR");
  expect(interp.stack_pop()).toBeNull();
});

test("CEIL", async () => {
  await interp.run("3.1 CEIL");
  expect(interp.stack_pop()).toBe(4);

  await interp.run("-2.9 CEIL");
  expect(interp.stack_pop()).toBe(-2);

  await interp.run("5 CEIL");
  expect(interp.stack_pop()).toBe(5);

  await interp.run("NULL CEIL");
  expect(interp.stack_pop()).toBeNull();
});

test("CLAMP", async () => {
  await interp.run("5 0 10 CLAMP");
  expect(interp.stack_pop()).toBe(5);

  await interp.run("-5 0 10 CLAMP");
  expect(interp.stack_pop()).toBe(0);

  await interp.run("15 0 10 CLAMP");
  expect(interp.stack_pop()).toBe(10);

  await interp.run("0 0 10 CLAMP");
  expect(interp.stack_pop()).toBe(0);

  await interp.run("10 0 10 CLAMP");
  expect(interp.stack_pop()).toBe(10);

  await interp.run("NULL 0 10 CLAMP");
  expect(interp.stack_pop()).toBeNull();
});

test("SUM", async () => {
  await interp.run("[1 2 3 4 5] SUM");
  expect(interp.stack_pop()).toBe(15);

  await interp.run("[] SUM");
  expect(interp.stack_pop()).toBe(0);

  await interp.run("[10] SUM");
  expect(interp.stack_pop()).toBe(10);

  await interp.run("[1 2 NULL 3 4] SUM");
  expect(interp.stack_pop()).toBe(10);
});
