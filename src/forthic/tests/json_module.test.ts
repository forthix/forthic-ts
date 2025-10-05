import { StandardInterpreter } from "../interpreter";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

// ========================================
// >JSON - Object to JSON string
// ========================================

test(">JSON with simple object", async () => {
  await interp.run(`
    [["a" 1] ["b" 2]] REC >JSON
  `);
  expect(interp.stack_pop()).toBe('{"a":1,"b":2}');
});

test(">JSON with nested object", async () => {
  await interp.run(`
    [["name" "Alice"] ["data" [["age" 30] ["city" "NYC"]] REC]] REC >JSON
  `);
  const result = interp.stack_pop();
  const parsed = JSON.parse(result);
  expect(parsed.name).toBe("Alice");
  expect(parsed.data.age).toBe(30);
  expect(parsed.data.city).toBe("NYC");
});

test(">JSON with array", async () => {
  await interp.run(`
    [1 2 3 4 5] >JSON
  `);
  expect(interp.stack_pop()).toBe("[1,2,3,4,5]");
});

test(">JSON with string", async () => {
  await interp.run(`
    "hello world" >JSON
  `);
  expect(interp.stack_pop()).toBe('"hello world"');
});

test(">JSON with number", async () => {
  await interp.run(`
    42 >JSON
  `);
  expect(interp.stack_pop()).toBe("42");
});

test(">JSON with boolean", async () => {
  await interp.run(`
    TRUE >JSON
  `);
  expect(interp.stack_pop()).toBe("true");
});

test(">JSON with null", async () => {
  await interp.run(`
    NULL >JSON
  `);
  expect(interp.stack_pop()).toBe("null");
});

test(">JSON with array of objects", async () => {
  await interp.run(`
    [
      [["name" "Alice"] ["age" 30]] REC
      [["name" "Bob"] ["age" 25]] REC
    ] >JSON
  `);
  const result = interp.stack_pop();
  const parsed = JSON.parse(result);
  expect(parsed.length).toBe(2);
  expect(parsed[0].name).toBe("Alice");
  expect(parsed[1].name).toBe("Bob");
});

// ========================================
// JSON> - JSON string to Object
// ========================================

test("JSON> with simple object", async () => {
  await interp.run(`
    '{"a": 1, "b": 2}' JSON>
  `);
  const result = interp.stack_pop();
  expect(Object.keys(result).sort()).toEqual(["a", "b"]);
  expect(result.a).toBe(1);
  expect(result.b).toBe(2);
});

test("JSON> with nested object", async () => {
  await interp.run(`
    '{"name":"Alice","data":{"age":30,"city":"NYC"}}' JSON>
  `);
  const result = interp.stack_pop();
  expect(result.name).toBe("Alice");
  expect(result.data.age).toBe(30);
  expect(result.data.city).toBe("NYC");
});

test("JSON> with array", async () => {
  await interp.run(`
    '[1,2,3,4,5]' JSON>
  `);
  const result = interp.stack_pop();
  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test("JSON> with string", async () => {
  await interp.run(`
    '"hello world"' JSON>
  `);
  expect(interp.stack_pop()).toBe("hello world");
});

test("JSON> with number", async () => {
  await interp.run(`
    '42' JSON>
  `);
  expect(interp.stack_pop()).toBe(42);
});

test("JSON> with boolean", async () => {
  await interp.run(`
    'true' JSON>
  `);
  expect(interp.stack_pop()).toBe(true);
});

test("JSON> with null", async () => {
  await interp.run(`
    'null' JSON>
  `);
  expect(interp.stack_pop()).toBeNull();
});

test("JSON> with array of objects", async () => {
  await interp.run(`
    '[{"name":"Alice","age":30},{"name":"Bob","age":25}]' JSON>
  `);
  const result = interp.stack_pop();
  expect(result.length).toBe(2);
  expect(result[0].name).toBe("Alice");
  expect(result[1].name).toBe("Bob");
});

test("JSON> with empty string returns null", async () => {
  await interp.run(`
    '' JSON>
  `);
  expect(interp.stack_pop()).toBeNull();
});

// ========================================
// JSON-PRETTIFY - Format JSON
// ========================================

test("JSON-PRETTIFY formats compact JSON", async () => {
  await interp.run(`
    '{"a":1,"b":2,"c":3}' JSON-PRETTIFY
  `);
  const result = interp.stack_pop();
  expect(result).toBe('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}');
});

test("JSON-PRETTIFY with nested object", async () => {
  await interp.run(`
    '{"name":"Alice","data":{"age":30,"city":"NYC"}}' JSON-PRETTIFY
  `);
  const result = interp.stack_pop();
  const lines = result.split("\n");
  expect(lines.length).toBeGreaterThan(3); // Should be multi-line
  expect(result).toContain("  "); // Should have indentation
});

test("JSON-PRETTIFY with array", async () => {
  await interp.run(`
    '[1,2,3,4,5]' JSON-PRETTIFY
  `);
  const result = interp.stack_pop();
  expect(result).toContain("\n"); // Should be multi-line
});

test("JSON-PRETTIFY with empty string", async () => {
  await interp.run(`
    '' JSON-PRETTIFY
  `);
  expect(interp.stack_pop()).toBe("");
});

// ========================================
// Round-trip tests
// ========================================

test("Round-trip: object -> JSON -> object", async () => {
  await interp.run(`
    [["x" 10] ["y" 20] ["z" 30]] REC
    >JSON
    JSON>
  `);
  const result = interp.stack_pop();
  expect(result.x).toBe(10);
  expect(result.y).toBe(20);
  expect(result.z).toBe(30);
});

test("Round-trip: array -> JSON -> array", async () => {
  await interp.run(`
    [1 2 3 4 5]
    >JSON
    JSON>
  `);
  const result = interp.stack_pop();
  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test("Round-trip with PRETTIFY", async () => {
  await interp.run(`
    [["a" 1] ["b" 2]] REC
    >JSON
    JSON-PRETTIFY
    JSON>
  `);
  const result = interp.stack_pop();
  expect(result.a).toBe(1);
  expect(result.b).toBe(2);
});
