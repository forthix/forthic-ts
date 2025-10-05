import { StandardInterpreter } from "../interpreter";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

// ========================================
// Comparison Operations
// ========================================

test("comparison", async () => {
  await interp.run(`
            2 4 ==
            2 4 !=
            2 4 <
            2 4 <=
            2 4 >
            2 4 >=
          `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(false);
  expect(stack[1]).toBe(true);
  expect(stack[2]).toBe(true);
  expect(stack[3]).toBe(true);
  expect(stack[4]).toBe(false);
  expect(stack[5]).toBe(false);
});

test("equality with different types", async () => {
  await interp.run(`2 2 ==`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`"hello" "hello" ==`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`TRUE TRUE ==`);
  expect(interp.stack_pop()).toBe(true);
});

// ========================================
// Logic Operations
// ========================================

test("logic", async () => {
  await interp.run(`
            FALSE FALSE OR
            [FALSE FALSE TRUE FALSE] OR
            FALSE TRUE AND
            [FALSE FALSE TRUE FALSE] AND
            FALSE NOT
          `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(false);
  expect(stack[1]).toBe(true);
  expect(stack[2]).toBe(false);
  expect(stack[3]).toBe(false);
  expect(stack[4]).toBe(true);
});

test("OR with two values", async () => {
  await interp.run(`TRUE FALSE OR`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`FALSE FALSE OR`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`TRUE TRUE OR`);
  expect(interp.stack_pop()).toBe(true);
});

test("OR with array", async () => {
  await interp.run(`[FALSE FALSE FALSE] OR`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`[TRUE FALSE FALSE] OR`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`[FALSE TRUE FALSE] OR`);
  expect(interp.stack_pop()).toBe(true);
});

test("AND with two values", async () => {
  await interp.run(`TRUE TRUE AND`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`TRUE FALSE AND`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`FALSE FALSE AND`);
  expect(interp.stack_pop()).toBe(false);
});

test("AND with array", async () => {
  await interp.run(`[TRUE TRUE TRUE] AND`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`[TRUE FALSE TRUE] AND`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`[FALSE FALSE FALSE] AND`);
  expect(interp.stack_pop()).toBe(false);
});

test("NOT", async () => {
  await interp.run(`TRUE NOT`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`FALSE NOT`);
  expect(interp.stack_pop()).toBe(true);
});

test("XOR", async () => {
  await interp.run(`TRUE TRUE XOR`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`TRUE FALSE XOR`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`FALSE TRUE XOR`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`FALSE FALSE XOR`);
  expect(interp.stack_pop()).toBe(false);
});

test("NAND", async () => {
  await interp.run(`TRUE TRUE NAND`);
  expect(interp.stack_pop()).toBe(false);

  await interp.run(`TRUE FALSE NAND`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`FALSE TRUE NAND`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`FALSE FALSE NAND`);
  expect(interp.stack_pop()).toBe(true);
});

// ========================================
// Membership Operations
// ========================================

test("IN", async () => {
  await interp.run(`
            "alpha" ["beta" "gamma"] IN
            "alpha" ["beta" "gamma" "alpha"] IN
          `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(false);
  expect(stack[1]).toBe(true);
});

test("IN with numbers", async () => {
  await interp.run(`5 [1 2 3 4 5] IN`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`10 [1 2 3 4 5] IN`);
  expect(interp.stack_pop()).toBe(false);
});

test("IN with empty array", async () => {
  await interp.run(`"test" [] IN`);
  expect(interp.stack_pop()).toBe(false);
});

test("ANY", async () => {
  await interp.run(`
            ["alpha" "beta"] ["beta" "gamma"] ANY
            ["delta" "beta"] ["gamma" "alpha"] ANY
            ["alpha" "beta"] [] ANY
          `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(true);
  expect(stack[1]).toBe(false);
  expect(stack[2]).toBe(true);
});

test("ANY with numbers", async () => {
  await interp.run(`[1 2 3] [3 4 5] ANY`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`[1 2 3] [4 5 6] ANY`);
  expect(interp.stack_pop()).toBe(false);
});

test("ALL", async () => {
  await interp.run(`
            ["alpha" "beta"] ["beta" "gamma"] ALL
            ["delta" "beta"] ["beta"] ALL
            ["alpha" "beta"] [] ALL
          `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(false);
  expect(stack[1]).toBe(true);
  expect(stack[2]).toBe(true);
});

test("ALL with numbers", async () => {
  await interp.run(`[1 2 3 4 5] [2 3 4] ALL`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`[1 2 3] [2 3 4] ALL`);
  expect(interp.stack_pop()).toBe(false);
});

// ========================================
// Type Conversion
// ========================================

test(">BOOL", async () => {
  await interp.run(`
        NULL >BOOL
        0 >BOOL
        1 >BOOL
        "" >BOOL
        "Hi" >BOOL
      `);
  const stack = (interp as any).stack;
  expect(stack[0]).toBe(false);
  expect(stack[1]).toBe(false);
  expect(stack[2]).toBe(true);
  expect(stack[3]).toBe(false);
  expect(stack[4]).toBe(true);
});

test(">BOOL with arrays", async () => {
  // Note: In JavaScript, empty arrays are truthy: !![] === true
  // This is standard JavaScript behavior
  await interp.run(`[] >BOOL`);
  expect(interp.stack_pop()).toBe(true);

  await interp.run(`[1] >BOOL`);
  expect(interp.stack_pop()).toBe(true);
});

test(">BOOL with objects", async () => {
  await interp.run(`[["a" 1]] REC >BOOL`);
  expect(interp.stack_pop()).toBe(true);
});
