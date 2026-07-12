import { StandardInterpreter } from "../../../../interpreter";

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

test("REC - throws when a pair has too few elements", async () => {
  await expect(interp.run(`[["alpha"]] REC`)).rejects.toThrow();
});

test("REC - throws when a pair has too many elements", async () => {
  await expect(interp.run(`[["alpha" 1 2]] REC`)).rejects.toThrow();
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

test("INVERT-KEYS", async () => {
  await interp.run(`
    [
      ["x" [["a" 1] ["b" 2]] REC]
      ["y" [["a" 10] ["b" 20]] REC]
    ] REC
    INVERT-KEYS
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
    [["b" 100] ["c" 200] ["d" 300]] REC-DEFAULTS
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

// |REC@ was removed in favor of the JQ `[]` iterate path, which does the same
// thing as a strict superset and parses the field as data (no source-string
// injection). "[].field" JQ@ replaces "field" |REC@.
test("[].field JQ@ maps a field over an array of records (replaces |REC@)", async () => {
  await interp.run(`
    [
      [["key" 101] ["value" "alpha"]] REC
      [["key" 102] ["value" "beta"]] REC
      [["key" 103] ["value" "gamma"]] REC
    ]
    "[].key" JQ@
  `);
  expect(interp.stack_pop()).toEqual([101, 102, 103]);
});

test("[].a.b JQ@ maps a nested path over an array (something |REC@ could not do cleanly)", async () => {
  await interp.run(`
    [
      [["a" [["b" 1]] REC]] REC
      [["a" [["b" 2]] REC]] REC
    ]
    "[].a.b" JQ@
  `);
  expect(interp.stack_pop()).toEqual([1, 2]);
});

// ========================================
// JQ-style path access
// ========================================

test("JQ@ - simple field path", async () => {
  await interp.run(`
    [["name" "Ada"] ["age" 30]] REC
    ".name" JQ@
  `);
  expect(interp.stack_pop()).toBe("Ada");
});

test("JQ@ - nested field path", async () => {
  await interp.run(`
    [["user" [["profile" [["name" "Ada"]] REC]] REC]] REC
    ".user.profile.name" JQ@
  `);
  expect(interp.stack_pop()).toBe("Ada");
});

test("JQ@ - array index", async () => {
  await interp.run(`
    [10 20 30 40] ".[2]" JQ@
  `);
  expect(interp.stack_pop()).toBe(30);
});

test("JQ@ - negative index", async () => {
  await interp.run(`
    [10 20 30 40] ".[-1]" JQ@
  `);
  expect(interp.stack_pop()).toBe(40);
});

test("JQ@ - field then index", async () => {
  await interp.run(`
    [["users" [10 20 30]]] REC
    ".users[1]" JQ@
  `);
  expect(interp.stack_pop()).toBe(20);
});

test("JQ@ - missing key returns null", async () => {
  await interp.run(`
    [["a" 1]] REC ".missing.deeper" JQ@
  `);
  expect(interp.stack_pop()).toBeNull();
});

test("JQ@ - iterate flat", async () => {
  await interp.run(`
    [["users" [
      [["name" "Ada"]] REC
      [["name" "Bob"]] REC
      [["name" "Cleo"]] REC
    ]]] REC
    ".users[].name" JQ@
  `);
  expect(interp.stack_pop()).toEqual(["Ada", "Bob", "Cleo"]);
});

test("JQ@ - nested iterate flattens", async () => {
  await interp.run(`
    [["users" [
      [["posts" [
        [["title" "A"]] REC
        [["title" "B"]] REC
      ]]] REC
      [["posts" [
        [["title" "C"]] REC
      ]]] REC
    ]]] REC
    ".users[].posts[].title" JQ@
  `);
  expect(interp.stack_pop()).toEqual(["A", "B", "C"]);
});

test("JQ@ - path array form", async () => {
  await interp.run(`
    [["users" [10 20 30]]] REC
    ["users" 1] JQ@
  `);
  expect(interp.stack_pop()).toBe(20);
});

test("JQ@ - empty path returns container", async () => {
  await interp.run(`
    [["a" 1]] REC "" JQ@
  `);
  expect(interp.stack_pop()).toEqual({ a: 1 });
});

test("JQ! - set existing field", async () => {
  await interp.run(`
    [["name" "Ada"] ["age" 30]] REC
    99 ".age" JQ!
  `);
  const result = interp.stack_pop();
  expect(result).toEqual({ name: "Ada", age: 99 });
});

test("JQ! - auto-create nested record path", async () => {
  await interp.run(`
    [] REC 42 ".a.b.c" JQ!
  `);
  expect(interp.stack_pop()).toEqual({ a: { b: { c: 42 } } });
});

test("JQ! - auto-create with index creates array", async () => {
  await interp.run(`
    [] REC 42 ".a.b[0].c" JQ!
  `);
  expect(interp.stack_pop()).toEqual({ a: { b: [{ c: 42 }] } });
});

test("JQ! - path array form", async () => {
  await interp.run(`
    [["a" [["b" 1]] REC]] REC
    99 ["a" "b"] JQ!
  `);
  expect(interp.stack_pop()).toEqual({ a: { b: 99 } });
});

test("JQ! - rejects iterate", async () => {
  await expect(
    interp.run(`[] REC 1 ".items[].x" JQ!`),
  ).rejects.toThrow();
});

test("JQ-DEL - delete existing field", async () => {
  await interp.run(`
    [["a" 1] ["b" 2]] REC ".a" JQ-DEL
  `);
  expect(interp.stack_pop()).toEqual({ b: 2 });
});

test("JQ-DEL - delete nested field", async () => {
  await interp.run(`
    [["a" [["b" 1] ["c" 2]] REC]] REC
    ".a.b" JQ-DEL
  `);
  expect(interp.stack_pop()).toEqual({ a: { c: 2 } });
});

test("JQ-DEL - delete array index", async () => {
  await interp.run(`
    [["items" [10 20 30]]] REC
    ".items[1]" JQ-DEL
  `);
  expect(interp.stack_pop()).toEqual({ items: [10, 30] });
});

test("JQ-DEL - missing path is no-op", async () => {
  await interp.run(`
    [["a" 1]] REC ".nonexistent.deep" JQ-DEL
  `);
  expect(interp.stack_pop()).toEqual({ a: 1 });
});

test("JQ@ composes as FILTER predicate (truthy field)", async () => {
  await interp.run(`
    [
      [["name" "Ada"] ["age" 30]] REC
      [["name" "Bob"]] REC
      [["name" "Cleo"] ["age" 45]] REC
    ]
    '".age" JQ@' FILTER
  `);
  const result = interp.stack_pop();
  expect(result).toHaveLength(2);
  expect(result.map((r: any) => r.name).sort()).toEqual(["Ada", "Cleo"]);
});

test("JQ@ composes as FILTER predicate (deep path + comparison)", async () => {
  await interp.run(`
    [
      [["name" "Ada"] ["profile" [["age" 30]] REC]] REC
      [["name" "Bob"] ["profile" [["age" 25]] REC]] REC
      [["name" "Cleo"] ["profile" [["age" 45]] REC]] REC
    ]
    '".profile.age" JQ@ 30 >=' FILTER
  `);
  const result = interp.stack_pop();
  expect(result.map((r: any) => r.name).sort()).toEqual(["Ada", "Cleo"]);
});

// ========================================
// Prototype-pollution guard
// ========================================

describe("prototype-pollution guard", () => {
  afterEach(() => {
    // Ensure no test here leaked a polluted prototype for subsequent tests.
    delete (Object.prototype as any).polluted;
  });

  test("JQ! rejects a __proto__ path and does not pollute Object.prototype", async () => {
    await expect(interp.run(`[ ] REC TRUE ".__proto__.polluted" JQ!`)).rejects.toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });

  test("JQ-DEL rejects a __proto__ path", async () => {
    await expect(interp.run(`[ ] REC ".__proto__.toString" JQ-DEL`)).rejects.toThrow();
    expect(typeof ({} as any).toString).toBe("function");
  });

  test("<REC! rejects a __proto__ field and does not pollute Object.prototype", async () => {
    await expect(interp.run(`[ ] REC TRUE [ "__proto__" "polluted" ] <REC!`)).rejects.toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });

  test("<REC! rejects constructor.prototype traversal", async () => {
    await expect(interp.run(`[ ] REC TRUE [ "constructor" "prototype" "polluted" ] <REC!`)).rejects.toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });

  test("REC rejects a __proto__ key", async () => {
    await expect(interp.run(`[[ "__proto__" [["polluted" TRUE]] REC ]] REC`)).rejects.toThrow();
    expect(({} as any).polluted).toBeUndefined();
  });

  test("a normal field named similarly is still allowed", async () => {
    await interp.run(`[ ] REC 42 ".config.__proto_ok" JQ!`);
    const rec = interp.stack_pop();
    expect(rec.config.__proto_ok).toBe(42);
  });
});

// ===== JQ/record alignment to the cross-runtime contract (forthic-rs) =====

test("JQ path rejects malformed indexes strictly", async () => {
  await expect(interp.run(`[ 1 2 ] '[1x]' JQ@`)).rejects.toThrow(/invalid index/);
});

test("JQ@ record index and iterate use raw key order, not sorted", async () => {
  await interp.run(`[ [ 'z' 1 ] [ 'a' 2 ] ] REC '[0]' JQ@`);
  expect(interp.stack_pop()).toBe(1); // z first (insertion), not a
  await interp.run(`[ [ 'z' 1 ] [ 'a' 2 ] ] REC '[]' JQ@`);
  expect(interp.stack_pop()).toEqual([1, 2]);
});

test("JQ! pads out-of-range array sets with null, no holes", async () => {
  await interp.run(`[ 1 ] 9 '[3]' JQ!`);
  const result = interp.stack_pop();
  expect(result).toEqual([1, null, null, 9]);
  expect(1 in result).toBe(true); // a real null, not a hole
});

test("JQ! rejects negative indexes and field-into-array", async () => {
  await expect(interp.run(`[ 1 2 ] 5 '[-1]' JQ!`)).rejects.toThrow(/negative set index/);
  await expect(interp.run(`[ 1 2 ] 5 'field' JQ!`)).rejects.toThrow(/cannot set field/);
});

test("OMIT stringifies drop keys so numeric keys match", async () => {
  await interp.run(`[ [ '1' 'x' ] [ 'b' 2 ] ] REC [ 1 ] OMIT`);
  expect(Object.keys(interp.stack_pop())).toEqual(["b"]);
});

test("DELETE requires integer array keys; negative wraps; OOB is a no-op", async () => {
  await expect(interp.run(`[ 1 2 ] 'x' DELETE`)).rejects.toThrow(/integer index/);
  await interp.run(`[ 1 2 3 ] -1 DELETE`);
  expect(interp.stack_pop()).toEqual([1, 2]);
  await interp.run(`[ 1 2 ] 9 DELETE`);
  expect(interp.stack_pop()).toEqual([1, 2]);
});

test("REC>ENTRIES uses raw key order and round-trips through ENTRIES>REC", async () => {
  await interp.run(`[ [ 'z' 1 ] [ 'a' 2 ] ] REC REC>ENTRIES`);
  expect(interp.stack_pop()).toEqual([["z", 1], ["a", 2]]);
  await interp.run(`[ [ 'z' 1 ] [ 'a' 2 ] ] REC REC>ENTRIES ENTRIES>REC`);
  expect(Object.keys(interp.stack_pop())).toEqual(["z", "a"]);
});
