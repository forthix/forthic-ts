import { WordOptions } from "../../../word_options";

describe("WordOptions", () => {
  test("creates from flat array", () => {
    const opts = new WordOptions(["depth", 2, "with_key", true]);
    expect(opts.get("depth")).toBe(2);
    expect(opts.get("with_key")).toBe(true);
  });

  test("requires array input", () => {
    expect(() => new WordOptions("not an array" as any)).toThrow("must be an array");
  });

  test("requires even number of elements", () => {
    expect(() => new WordOptions(["depth", 2, "with_key"])).toThrow("even length");
  });

  test("requires string keys", () => {
    expect(() => new WordOptions([123, "value"] as any)).toThrow("must be a string");
  });

  test("returns default for missing key", () => {
    const opts = new WordOptions(["depth", 2]);
    expect(opts.get("missing")).toBeUndefined();
    expect(opts.get("missing", "default")).toBe("default");
  });

  test("has() checks key existence", () => {
    const opts = new WordOptions(["depth", 2]);
    expect(opts.has("depth")).toBe(true);
    expect(opts.has("missing")).toBe(false);
  });

  test("toRecord() converts to plain object", () => {
    const opts = new WordOptions(["depth", 2, "with_key", true]);
    expect(opts.toRecord()).toEqual({ depth: 2, with_key: true });
  });

  test("keys() returns all option keys", () => {
    const opts = new WordOptions(["depth", 2, "with_key", true]);
    expect(opts.keys().sort()).toEqual(["depth", "with_key"]);
  });

  test("later values override earlier ones", () => {
    const opts = new WordOptions(["depth", 2, "depth", 3]);
    expect(opts.get("depth")).toBe(3);
  });

  test("handles null and undefined values", () => {
    const opts = new WordOptions(["key1", null, "key2", undefined]);
    expect(opts.get("key1")).toBeNull();
    expect(opts.get("key2")).toBeUndefined();
    expect(opts.has("key1")).toBe(true);
    expect(opts.has("key2")).toBe(true);
  });

  test("handles complex values", () => {
    const complexValue = { nested: { data: [1, 2, 3] } };
    const opts = new WordOptions(["config", complexValue]);
    expect(opts.get("config")).toEqual(complexValue);
  });

  test("toString() formats nicely", () => {
    const opts = new WordOptions(["depth", 2, "with_key", true]);
    const str = opts.toString();
    expect(str).toContain("WordOptions");
    expect(str).toContain(".depth");
    expect(str).toContain(".with_key");
  });

  test("empty options array", () => {
    const opts = new WordOptions([]);
    expect(opts.keys()).toEqual([]);
    expect(opts.toRecord()).toEqual({});
    expect(opts.has("anything")).toBe(false);
  });
});
