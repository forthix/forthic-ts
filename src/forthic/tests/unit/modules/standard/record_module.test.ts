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

describe("JQ@ field read on a list", () => {
  async function jq(container: unknown, path: unknown): Promise<unknown> {
    interp.stack_push(container);
    interp.stack_push(path);
    await interp.run("JQ@");
    return interp.stack_pop();
  }

  test("throws, naming the list and both fixes", async () => {
    await expect(jq([{ u: 1 }, { u: 2 }], ".u")).rejects.toThrow(
      "JQ@ '.u': the value is a list of 2 items, so it has no field 'u'. " +
        "Read it from every item with '.[].u', or from one with '.[0].u'.",
    );
  });

  test("names where a nested list sits in the path", async () => {
    await expect(jq({ data: { items: [{ number: 8483 }] } }, ".data.items.number")).rejects.toThrow(
      "JQ@ '.data.items.number': '.data.items' is a list of 1 item, so it has no field 'number'. " +
        "Read it from every item with '.data.items[].number', or from one with '.data.items[0].number'.",
    );
  });

  test("names a list reached through []", async () => {
    await expect(jq({ a: [{ b: [{ c: 1 }] }] }, ".a[].b.c")).rejects.toThrow(
      "JQ@ '.a[].b.c': an item at '.a[].b' is a list of 1 item, so it has no field 'c'. " +
        "Read it from every item with '.a[].b[].c', or from one with '.a[].b[0].c'.",
    );
    await expect(jq([[{ n: 1 }, { n: 2 }], [{ n: 3 }]], ".[].n")).rejects.toThrow(
      "an item at '.[]' is a list of 2 items, so it has no field 'n'. " +
        "Read it from every item with '.[][].n', or from one with '.[][0].n'.",
    );
  });

  test("throws for a path array and an empty list", async () => {
    await expect(jq({ rows: [{ u: 1 }] }, ["rows", "u"])).rejects.toThrow(
      "JQ@ '.rows.u': '.rows' is a list of 1 item, so it has no field 'u'. " +
        "Read it from every item with '.rows[].u', or from one with '.rows[0].u'.",
    );
    await expect(jq([], ".u")).rejects.toThrow("the value is a list of 0 items");
  });

  // Each Forthic literal an error suggests (after "with" or "use"), run as
  // source in front of JQ@ on the same container.
  async function run_suggestions(container: unknown, path: unknown): Promise<unknown[]> {
    const message = await jq(container, path).then(
      () => "",
      (e: Error) => e.message,
    );
    const shown = [...message.matchAll(/(?:with|use) ('(?:[^'\\]|\\.)*')/g)].map((m) => m[1]);
    expect(shown.length).toBeGreaterThan(0);
    const results: unknown[] = [];
    for (const literal of shown) {
      interp.stack_push(container);
      await interp.run(`${literal} JQ@`);
      results.push(interp.stack_pop());
    }
    return results;
  }

  test("the suggested paths are Forthic literals that read back", async () => {
    await expect(jq({ "a.b": [{ x: 5 }] }, ["a.b", "x"])).rejects.toThrow(
      `'.["a.b"]' is a list of 1 item, so it has no field 'x'. ` +
        `Read it from every item with '.["a.b"][].x', or from one with '.["a.b"][0].x'.`,
    );
    // Quotes and backslashes in a key are escaped for the tokenizer
    await expect(jq({ "a.b'c": [{ x: 5 }] }, ["a.b'c", "x"])).rejects.toThrow(
      `Read it from every item with '.["a.b\\'c"][].x', or from one with '.["a.b\\'c"][0].x'.`,
    );
    const keys = ["a.b", "a'b", "a.b'c", 'a"b', 'a.b"c', "a\\nb", "a\\b", "a\\u0041", "a b", "a]b", "a[b", ""];
    for (const key of keys) {
      expect(await run_suggestions({ [key]: [{ x: 5 }, { x: 6 }] }, [key, "x"])).toEqual([[5, 6], 5]);
      expect(await run_suggestions({ [key]: [5, 6] }, [key, "1"])).toEqual([6]);
    }
  });

  test("a key with '.' and both quotes gets a suggestion that fails loudly", async () => {
    // The path grammar has no escapes, so no string path can name this key
    const key = `a.b'"c`;
    interp.stack_push({ [key]: [{ x: 5 }] });
    await expect(interp.run(`'.["a.b\\'"c"][].x' JQ@`)).rejects.toThrow("expected ']' after quoted key");
    await expect(jq({ [key]: [{ x: 5 }] }, [key, "x"])).rejects.toThrow(
      `Read it from every item with '.["a.b\\'"c"][].x'`,
    );
    expect(await jq({ [key]: [{ x: 5 }] }, [key, 0, "x"])).toBe(5);
  });

  test("'.length' throws and points at LENGTH", async () => {
    await expect(jq([1, 2, 3], ".length")).rejects.toThrow(
      "JQ@ '.length': the value is a list of 3 items, so it has no field 'length'. " +
        "Read it from every item with '.[].length', or from one with '.[0].length'. To count its items, use LENGTH.",
    );
  });

  test("a digit string used as a key points at the index", async () => {
    await expect(jq({ a: [1, 2] }, ["a", "0"])).rejects.toThrow(
      "JQ@ '.a.0': '.a' is a list of 2 items, so it has no field '0'. " +
        "To index it, use '.a[0]': an index is a number, not a string.",
    );
    await expect(jq({ a: [1, 2] }, '.a["1"]')).rejects.toThrow("To index it, use '.a[1]'");
    expect(await jq({ a: [1, 2] }, ["a", 1])).toBe(2);
  });

  test("every other read is unchanged", async () => {
    const list = [{ u: 1 }, { u: 2 }];
    expect(await jq(list, ".[].u")).toEqual([1, 2]);
    expect(await jq(list, ".[0].u")).toBe(1);
    expect(await jq(list, ".[-1].u")).toBe(2);
    expect(await jq(list, ".[9].u")).toBeNull(); // out-of-range index
    expect(await jq([null, { u: 1 }], ".[].u")).toEqual([null, 1]);
    expect(await jq({ a: {} }, ".a.missing")).toBeNull(); // missing key
    expect(await jq({ a: null }, ".a.b")).toBeNull();
    expect(await jq({ x: 1, y: 2 }, ".[1]")).toBe(2); // positional index on a record
    expect(await jq(5, ".[]")).toEqual([]);
    expect(await jq("abc", ".length")).toBe(3); // field read on a primitive
    expect(await jq({ a: [{ b: [1, 2] }, { b: [3] }] }, ".a[].b[]")).toEqual([1, 2, 3]);
  });
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
