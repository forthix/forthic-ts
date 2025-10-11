import { StandardInterpreter } from "../../../interpreter";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

// ========================================
// Create Operations
// ========================================

test("REC", async () => {
  await interp.run(`[["alpha" 2] ["beta" 3] ["gamma" 4]] REC`);
  const rec = interp.stack_pop();
  expect(rec.alpha).toBe(2);
  expect(rec.beta).toBe(3);
  expect(rec.gamma).toBe(4);
});

test("REC@ simple", async () => {
  await interp.run(`
    [["alpha" 2] ["beta" 3] ["gamma" 4]] REC
    'beta' REC@
  `);
  expect(interp.stack_pop()).toBe(3);
});

test("REC@ with array index", async () => {
  await interp.run(`[10 20 30 40 50] 3 REC@`);
  expect(interp.stack_pop()).toBe(40);
});

test("REC@ nested", async () => {
  await interp.run(`
    [["alpha" [["alpha1" 20]] REC]
     ["beta" [["beta1"  30]] REC]
    ] REC
    ["beta" "beta1"] REC@
  `);
  expect(interp.stack_pop()).toBe(30);

  await interp.run(`
    [["alpha" [["alpha1" 20]] REC]
     ["beta" [["beta1"  [10 20 30]]] REC]
    ] REC
    ["beta" "beta1" 1] REC@
  `);
  expect(interp.stack_pop()).toBe(20);
});

test("<REC! simple", async () => {
  await interp.run(`
    [["alpha" 2] ["beta" 3] ["gamma" 4]] REC
    700 'beta' <REC! 'beta' REC@
  `);
  expect(interp.stack_pop()).toBe(700);
});

test("<REC! nested creation", async () => {
  await interp.run(`
    NULL 42 ["a" "b" "c"] <REC!
    ["a" "b" "c"] REC@
  `);
  expect(interp.stack_pop()).toBe(42);
});

// ========================================
// Transform Operations
// ========================================

test("RELABEL record", async () => {
  await interp.run(`
    [["a" 1] ["b" 2] ["c" 3]] REC
    ["a" "b" "c"] ["alpha" "beta" "gamma"] RELABEL
  `);
  const rec = interp.stack_pop();
  expect(rec.alpha).toBe(1);
  expect(rec.beta).toBe(2);
  expect(rec.gamma).toBe(3);
});

test("INVERT_KEYS", async () => {
  await interp.run(`
    [
      ["x" [["a" 1] ["b" 2]] REC]
      ["y" [["a" 10] ["b" 20]] REC]
    ] REC
    INVERT_KEYS
  `);
  const result = interp.stack_pop();
  expect(result.a.x).toBe(1);
  expect(result.a.y).toBe(10);
  expect(result.b.x).toBe(2);
  expect(result.b.y).toBe(20);
});

test("REC_DEFAULTS", async () => {
  await interp.run(`
    [["a" 1] ["b" NULL] ["c" ""]] REC
    [["b" 100] ["c" 200] ["d" 300]] REC_DEFAULTS
  `);
  const rec = interp.stack_pop();
  expect(rec.a).toBe(1);
  expect(rec.b).toBe(100); // NULL replaced
  expect(rec.c).toBe(200); // "" replaced
  expect(rec.d).toBe(300); // Added
});

test("<DEL from record", async () => {
  await interp.run(`
    [["a" 1] ["b" 2] ["c" 3]] REC
    'b' <DEL
  `);
  const rec = interp.stack_pop();
  expect(rec.a).toBe(1);
  expect(rec.b).toBeUndefined();
  expect(rec.c).toBe(3);
});

test("<DEL from array", async () => {
  await interp.run(`
    [10 20 30 40]
    1 <DEL
  `);
  const arr = interp.stack_pop();
  expect(arr).toEqual([10, 30, 40]);
});

// ========================================
// Access Operations
// ========================================

test("KEYS from array", async () => {
  await interp.run(`['a' 'b' 'c'] KEYS`);
  expect(interp.stack_pop()).toEqual([0, 1, 2]);
});

test("KEYS from record", async () => {
  await interp.run(`[['a' 1] ['b' 2]] REC KEYS`);
  const keys = interp.stack_pop();
  expect(keys.sort()).toEqual(["a", "b"]);
});

test("VALUES from array", async () => {
  await interp.run(`['a' 'b' 'c'] VALUES`);
  expect(interp.stack_pop()).toEqual(["a", "b", "c"]);
});

test("VALUES from record", async () => {
  await interp.run(`[['a' 1] ['b' 2]] REC VALUES`);
  const values = interp.stack_pop();
  expect(values.sort()).toEqual([1, 2]);
});

// ========================================
// Advanced Operations
// ========================================

test("|REC@ - needs MAP to work", async () => {
  await interp.run(`
    [
      [["key" 101] ["value" "alpha"]] REC
      [["key" 102] ["value" "beta"]] REC
      [["key" 103] ["value" "gamma"]] REC
    ]
    "key" |REC@
  `);
  const keys = interp.stack_pop();
  expect(keys).toEqual([101, 102, 103]);
});
