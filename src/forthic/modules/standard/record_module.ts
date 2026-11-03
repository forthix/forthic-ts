import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";

type PathSegment =
  | { kind: "field"; name: string }
  | { kind: "index"; n: number }
  | { kind: "iterate" };

export class RecordModule extends DecoratedModule {
  static {
    registerModuleDoc(RecordModule, `
Record (object/dictionary) manipulation operations for working with key-value data structures.

## Categories
- Core: REC, REC@, <REC!
- Path access (jq-style): JQ@, JQ!, JQ-DEL (use "[].field" JQ@ to map a field over an array of records)
- Construct: ENTRIES>REC
- Disassemble: REC>ENTRIES
- Combine: MERGE
- Subset: PICK, OMIT
- Predicate: HAS-KEY?
- Transform: DELETE
- Access: KEYS, VALUES
`);
  }

  module_id: string;

  constructor() {
    super("record");
    this.module_id = "record";
  }

  /**
   * Keys that must never be used as record keys: writing them would mutate the
   * JavaScript object prototype chain (prototype pollution) rather than the
   * record itself.
   */
  private static readonly UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  /**
   * Guard against prototype-pollution keys on any path segment that is written
   * to (or traversed through) while mutating a record. Throws with a clear
   * message so a Forthic program gets a real error instead of silently
   * corrupting Object.prototype.
   */
  private static assert_safe_key(key: string | number): void {
    if (typeof key === "string" && RecordModule.UNSAFE_KEYS.has(key)) {
      throw new Error(`Unsafe record key '${key}' is not allowed (prototype pollution guard)`);
    }
  }

  /**
   * Helper function to drill down into nested record structure
   * @param record - The record to drill into
   * @param fields - Array of field names to traverse
   * @returns The value at the end of the field path, or null if not found
   */
  private static drill_for_value(record: any, fields: string[]): any {
    let result = record;
    for (const field of fields) {
      if (result == null) return null;
      result = result[field];
    }
    return result === undefined ? null : result;
  }


  /**
   * Build a record from an array of [key, value] pairs.
   * Each pair must be an array of exactly 2 elements; otherwise a descriptive
   * error is thrown that identifies the offending pair.
   * @param key_vals - Array of [key, value] pairs (null/undefined treated as empty)
   * @param wordName - Name of the calling word, used in error messages
   */
  private static build_record(key_vals: any[], wordName: string): any {
    const _key_vals = key_vals || [];

    const result: any = {};
    _key_vals.forEach((pair, index) => {
      if (!Array.isArray(pair)) {
        throw new Error(
          `${wordName} requires each pair to be a [key, value] array with exactly 2 elements; ` +
            `pair at index ${index} is not an array (got ${typeof pair}).`,
        );
      }
      if (pair.length !== 2) {
        const key = pair.length >= 1 ? JSON.stringify(pair[0]) : "(none)";
        throw new Error(
          `${wordName} requires each pair to be a [key, value] array with exactly 2 elements; ` +
            `pair at index ${index} has ${pair.length} element(s) (key: ${key}).`,
        );
      }
      const [key, val] = pair;
      RecordModule.assert_safe_key(key);
      result[key] = val;
    });

    return result;
  }


  @ForthicWord("( key_vals:any[] -- rec:any )", "Create record from [[key, val], ...] pairs")
  async REC(key_vals: any[]) {
    return RecordModule.build_record(key_vals, "REC");
  }

  @ForthicWord("( rec:any field:any -- value:any )", "Get value from record by field or array of fields", "REC@")
  async REC_at(rec: any, field: any) {
    if (!rec) return null;

    let fields = [field];
    if (field instanceof Array) fields = field;

    const result = RecordModule.drill_for_value(rec, fields);
    return result;
  }

  @ForthicWord("( rec:any value:any field:any -- rec:any )", "Set value in record at field path", "<REC!")
  async l_REC_bang(rec: any, value: any, field: any) {
    let _rec = rec;
    if (!_rec) _rec = {};

    let fields: string[] = [];
    if (field instanceof Array) fields = field;
    else fields = [field];

    function ensure_field(rec: any, field: string): any {
      RecordModule.assert_safe_key(field);
      let res = rec[field];
      if (res === undefined) {
        res = {};
        rec[field] = res;
      }
      return res;
    }

    let cur_rec = _rec;
    // Drill down up until the last value
    for (let i = 0; i < fields.length - 1; i++) {
      cur_rec = ensure_field(cur_rec, fields[i]);
    }

    // Set the value at the right depth within rec
    const last_field = fields[fields.length - 1];
    RecordModule.assert_safe_key(last_field);
    cur_rec[last_field] = value;

    return _rec;
  }

  // ========================================
  // JQ-style path access
  // ========================================

  private static parse_jq_path(path: any): PathSegment[] {
    if (Array.isArray(path)) {
      return path.map((p) => {
        if (typeof p === "number") return { kind: "index", n: p } as PathSegment;
        return { kind: "field", name: String(p) } as PathSegment;
      });
    }

    let s = String(path ?? "");
    if (s === "" || s === ".") return [];

    if (s.startsWith(".")) s = s.slice(1);

    const segments: PathSegment[] = [];
    let i = 0;

    while (i < s.length) {
      const ch = s[i];
      if (ch === ".") {
        i++;
        continue;
      }
      if (ch === "[") {
        i++;
        if (i >= s.length) {
          throw new Error(`JQ path: unclosed '[' in "${path}"`);
        }
        if (s[i] === "]") {
          segments.push({ kind: "iterate" });
          i++;
        } else if (s[i] === '"' || s[i] === "'") {
          const quote = s[i];
          i++;
          let name = "";
          while (i < s.length && s[i] !== quote) {
            name += s[i];
            i++;
          }
          if (i >= s.length) {
            throw new Error(`JQ path: unclosed quote in "${path}"`);
          }
          i++;
          if (s[i] !== "]") {
            throw new Error(`JQ path: expected ']' after quoted key in "${path}"`);
          }
          i++;
          segments.push({ kind: "field", name });
        } else {
          let num = "";
          while (i < s.length && s[i] !== "]") {
            num += s[i];
            i++;
          }
          if (i >= s.length) {
            throw new Error(`JQ path: unclosed '[' in "${path}"`);
          }
          i++;
          // Strict integer match: parseInt("1x") === 1 would silently
          // accept a malformed path (cross-runtime contract with forthic-rs)
          if (!/^-?\d+$/.test(num)) {
            throw new Error(`JQ path: invalid index "${num}" in "${path}"`);
          }
          const n = parseInt(num, 10);
          segments.push({ kind: "index", n });
        }
      } else {
        let name = "";
        while (i < s.length && s[i] !== "." && s[i] !== "[") {
          name += s[i];
          i++;
        }
        if (name) segments.push({ kind: "field", name });
      }
    }

    return segments;
  }

  // `at` is the index of the segment to apply next.
  private static jq_get(container: any, segments: PathSegment[], at: number): any {
    if (at === segments.length) return container ?? null;
    if (container == null) return null;

    const first = segments[at];

    if (first.kind === "iterate") {
      let items: any[];
      if (Array.isArray(container)) {
        items = container;
      } else if (typeof container === "object") {
        // Raw key order (no sort): consistent with the #33 words
        // (KEYS/NTH/FIRST) and with forthic-rs insertion order. Residual
        // host quirk: JS hoists integer-like keys numerically first.
        items = Object.keys(container).map((k) => container[k]);
      } else {
        return [];
      }

      const is_last = at + 1 === segments.length;
      const rest_iterates = segments.slice(at + 1).some((s) => s.kind === "iterate");
      const result: any[] = [];
      for (const item of items) {
        if (is_last) {
          result.push(item);
        } else {
          const r = RecordModule.jq_get(item, segments, at + 1);
          if (rest_iterates && Array.isArray(r)) {
            result.push(...r);
          } else {
            result.push(r);
          }
        }
      }
      return result;
    }

    if (first.kind === "field") {
      // jq errors here (`Cannot index array with "u"`). A null would hide a
      // list where the caller expected a record, and reading the field would
      // leak JS array properties such as `length`. forthic-rs returns null
      // here today and must follow (cross-runtime contract).
      if (Array.isArray(container)) {
        throw RecordModule.field_on_list_error(segments, at, container.length);
      }
      // Primitives keep their JS behavior: `'abc' '.length' JQ@` is 3.
      const next = container[first.name];
      return RecordModule.jq_get(next, segments, at + 1);
    }

    // index
    if (Array.isArray(container)) {
      const n = first.n < 0 ? container.length + first.n : first.n;
      if (n < 0 || n >= container.length) return null;
      return RecordModule.jq_get(container[n], segments, at + 1);
    }
    if (typeof container === "object") {
      // Raw key order (no sort) — see the iterate branch above
      const keys = Object.keys(container);
      const n = first.n < 0 ? keys.length + first.n : first.n;
      if (n < 0 || n >= keys.length) return null;
      return RecordModule.jq_get(container[keys[n]], segments, at + 1);
    }
    return null;
  }

  // Names where the list sits in the path and how long it is, and gives the
  // path that reads the field from every item or from the first. JQ@ adds the
  // whole path in front.
  private static field_on_list_error(segments: PathSegment[], at: number, length: number): Error {
    const field = segments[at] as { kind: "field"; name: string };
    const prefix = segments.slice(0, at);
    const list_path = RecordModule.show_jq_path(prefix);
    const where =
      prefix.length === 0
        ? "the value"
        : prefix.some((s) => s.kind === "iterate")
          ? `an item at ${list_path}`
          : list_path;
    const items = `${length} ${length === 1 ? "item" : "items"}`;
    const head = `${where} is a list of ${items}, so it has no field '${field.name}'.`;

    // A digit string ("0" from a path array, or .a["0"]) meant an index.
    if (/^-?\d+$/.test(field.name)) {
      const n = parseInt(field.name, 10);
      const indexed = RecordModule.show_jq_path([...prefix, { kind: "index", n }, ...segments.slice(at + 1)]);
      return new Error(`${head} To index it, use ${indexed}: an index is a number, not a string.`);
    }

    const tail = segments.slice(at);
    const every = RecordModule.show_jq_path([...prefix, { kind: "iterate" }, ...tail]);
    const one = RecordModule.show_jq_path([...prefix, { kind: "index", n: 0 }, ...tail]);
    // '.length' read the JS array length before this was an error.
    const count = field.name === "length" ? " To count its items, use LENGTH." : "";
    return new Error(`${head} Read it from every item with ${every}, or from one with ${one}.${count}`);
  }

  // Render segments as a string path that parse_jq_path reads back the same.
  // The path grammar has no escapes, so a key that needs quoting (empty, or
  // holding '.' or '[') and holds both quote characters cannot be written:
  // only a path array makes one, and its suggestion fails to parse, loudly.
  private static render_jq_path(segments: PathSegment[]): string {
    if (segments.length === 0) return ".";
    let path = "";
    for (const s of segments) {
      if (s.kind === "iterate") path += "[]";
      else if (s.kind === "index") path += `[${s.n}]`;
      else if (s.name !== "" && !/[.[]/.test(s.name)) path += `.${s.name}`;
      else if (s.name.includes('"') && !s.name.includes("'")) path += `['${s.name}']`;
      else path += `["${s.name}"]`;
    }
    return path.startsWith("[") ? `.${path}` : path;
  }

  // A path as an error shows it: the Forthic literal to paste in front of JQ@.
  private static show_jq_path(segments: PathSegment[]): string {
    return RecordModule.forthic_string(RecordModule.render_jq_path(segments));
  }

  // `s` as a single-quoted Forthic literal: the tokenizer decodes \\ and \',
  // and escaping every backslash keeps \n or A in a key as text.
  private static forthic_string(s: string): string {
    return `'${s.replace(/[\\']/g, "\\$&")}'`;
  }

  private static seg_key(seg: PathSegment): string | number {
    if (seg.kind === "field") return seg.name;
    if (seg.kind === "index") return seg.n;
    throw new Error("JQ: [] iteration not supported here");
  }

  // Guard a single set step: arrays take non-negative integer indexes only
  // (a negative or field key would silently set a stray JS property), and
  // out-of-range indexes pad with null — JS holes read back as undefined,
  // which is not a Forthic value (cross-runtime contract with forthic-rs).
  private static checked_set_key(cur: any, seg: PathSegment, key: string | number): void {
    if (Array.isArray(cur)) {
      if (seg.kind !== "index") {
        throw new Error(`JQ!: cannot set field '${key}' on an array`);
      }
      if ((key as number) < 0) {
        throw new Error(`JQ!: negative set index ${key}`);
      }
      for (let j = cur.length; j < (key as number); j++) {
        cur[j] = null;
      }
    }
  }

  private static jq_set(container: any, segments: PathSegment[], value: any): any {
    let cur = container;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const next = segments[i + 1];
      const key = RecordModule.seg_key(seg);
      RecordModule.assert_safe_key(key);
      RecordModule.checked_set_key(cur, seg, key);

      let child = cur[key];
      if (child == null || typeof child !== "object") {
        child = next.kind === "index" ? [] : {};
        cur[key] = child;
      }
      cur = child;
    }

    const last_seg = segments[segments.length - 1];
    const last_key = RecordModule.seg_key(last_seg);
    RecordModule.assert_safe_key(last_key);
    RecordModule.checked_set_key(cur, last_seg, last_key);
    cur[last_key] = value;

    return container;
  }

  private static jq_del(container: any, segments: PathSegment[]): any {
    let cur = container;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = RecordModule.seg_key(segments[i]);
      RecordModule.assert_safe_key(key);
      if (cur == null || typeof cur !== "object") return container;
      cur = cur[key];
    }
    if (cur == null || typeof cur !== "object") return container;

    const last = segments[segments.length - 1];
    if (last.kind === "field") {
      RecordModule.assert_safe_key(last.name);
      delete cur[last.name];
    } else if (last.kind === "index") {
      if (Array.isArray(cur)) {
        const n = last.n < 0 ? cur.length + last.n : last.n;
        if (n >= 0 && n < cur.length) cur.splice(n, 1);
      } else {
        delete cur[last.n];
      }
    }

    return container;
  }

  @ForthicWord(
    "( container:any path:any -- value:any )",
    "Get value at jq-style path (e.g., .users[].name). Returns null on miss; [] iterates and flattens. Reading a field from a list is an error: use [].field for every item or [0].field for the first. Path arrays accepted for dynamic keys.",
    "JQ@",
  )
  async JQ_at(container: any, path: any) {
    const segments = RecordModule.parse_jq_path(path);
    try {
      return RecordModule.jq_get(container, segments, 0);
    } catch (e) {
      // jq_get throws only for a field read on a list; name the whole path here.
      const shown = typeof path === "string" ? RecordModule.forthic_string(path) : RecordModule.show_jq_path(segments);
      throw new Error(`JQ@ ${shown}: ${(e as Error).message}`);
    }
  }

  @ForthicWord(
    "( container:any value:any path:any -- container:any )",
    "Set value at jq-style path. Auto-creates missing intermediates (record for field, array for index). [] iteration not supported.",
    "JQ!",
  )
  async JQ_bang(container: any, value: any, path: any) {
    const segments = RecordModule.parse_jq_path(path);
    if (segments.some((s) => s.kind === "iterate")) {
      throw new Error("JQ!: [] iteration not supported in set paths");
    }
    if (segments.length === 0) return value;

    let _container = container;
    if (_container == null || typeof _container !== "object") {
      _container = segments[0].kind === "index" ? [] : {};
    }

    return RecordModule.jq_set(_container, segments, value);
  }

  @ForthicWord(
    "( container:any path:any -- container:any )",
    "Delete value at jq-style path. No-op if path doesn't exist. [] iteration not supported.",
    "JQ-DEL",
  )
  async ["JQ-DEL"](container: any, path: any) {
    const segments = RecordModule.parse_jq_path(path);
    if (segments.some((s) => s.kind === "iterate")) {
      throw new Error("JQ-DEL: [] iteration not supported in delete paths");
    }
    if (segments.length === 0 || container == null) return container;

    return RecordModule.jq_del(container, segments);
  }


  @ForthicWord(
    "( pairs:any[] -- rec:any )",
    "Build a record from an array of [key, value] pairs. Alias of REC, surfaced for symmetry with REC>ENTRIES.",
    "ENTRIES>REC",
  )
  async ENTRIES_to_REC(pairs: any[]) {
    return RecordModule.build_record(pairs, "ENTRIES>REC");
  }

  @ForthicWord(
    "( rec:any -- pairs:any[] )",
    "Convert a record to an array of [key, value] pairs in insertion order, making the ENTRIES>REC round trip an identity. Inverse of ENTRIES>REC / REC.",
    "REC>ENTRIES",
  )
  async REC_to_ENTRIES(rec: any) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return [];
    // Raw key order (no sort): consistent with KEYS/NTH (#33) and with
    // forthic-rs insertion order; makes the ENTRIES>REC round trip an
    // identity. (The old sorted contract was a JS-object-order workaround.)
    return Object.keys(rec).map((k) => [k, rec[k]]);
  }

  @ForthicWord(
    "( rec1:any rec2:any -- merged:any )",
    "Shallow merge two records. Keys present in rec2 override rec1.",
    "MERGE",
  )
  async MERGE(rec1: any, rec2: any) {
    const a = rec1 && typeof rec1 === "object" && !Array.isArray(rec1) ? rec1 : {};
    const b = rec2 && typeof rec2 === "object" && !Array.isArray(rec2) ? rec2 : {};
    return { ...a, ...b };
  }

  @ForthicWord(
    "( rec:any keys:any[] -- rec:any )",
    "Return a new record containing only the listed keys (missing keys are skipped).",
    "PICK",
  )
  async PICK(rec: any, keys: any[]) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return {};
    const ks = Array.isArray(keys) ? keys : [];
    const result: Record<string, any> = {};
    for (const k of ks) {
      if (Object.prototype.hasOwnProperty.call(rec, k)) {
        result[k] = rec[k];
      }
    }
    return result;
  }

  @ForthicWord(
    "( rec:any keys:any[] -- rec:any )",
    "Return a new record without the listed keys.",
    "OMIT",
  )
  async OMIT(rec: any, keys: any[]) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return {};
    // Stringify drop keys: record keys are strings, so a numeric key in the
    // drop list (e.g. [ 1 ] OMIT) must match key "1" — a === Set would
    // silently miss it (cross-runtime contract with forthic-rs)
    const drop = new Set((Array.isArray(keys) ? keys : []).map((k) => String(k)));
    const result: Record<string, any> = {};
    for (const k of Object.keys(rec)) {
      if (!drop.has(k)) result[k] = rec[k];
    }
    return result;
  }

  @ForthicWord(
    "( rec:any key:any -- bool:boolean )",
    "Returns true if rec has the given key (own property). Distinct from REC@ NULL == — handles intentional null values correctly.",
    "HAS-KEY?",
  )
  async HAS_KEY(rec: any, key: any) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return false;
    return Object.prototype.hasOwnProperty.call(rec, key);
  }

  @ForthicWord("( container:any key:any -- container:any )", "Delete key from record or index from array", "DELETE")
  async DELETE(container: any, key: any) {
    if (!container) return container;

    // Copy first: splice()/delete mutate in place, which would alias the input.
    if (container instanceof Array) {
      // Integer keys only: splice coerces non-numeric keys via NaN -> 0 and
      // would silently delete element 0 (cross-runtime contract with
      // forthic-rs). Negative wraps once; out-of-range is a no-op.
      if (typeof key !== "number" || !Number.isInteger(key)) {
        throw new Error(`DELETE on an array requires an integer index, got ${JSON.stringify(key)}`);
      }
      const copy = [...container];
      const idx = key < 0 ? copy.length + key : key;
      if (idx >= 0 && idx < copy.length) copy.splice(idx, 1);
      return copy;
    }
    const copy = { ...container };
    delete copy[key];
    return copy;
  }


  @ForthicWord("( container:any -- keys:any[] )", "Get keys from record or indices from array")
  async KEYS(container: any) {
    let _container = container;
    if (!_container) _container = [];

    let result: any;
    if (_container instanceof Array) {
      result = [];
      for (let i = 0; i < _container.length; i++) {
        result.push(i);
      }
    } else {
      result = Object.keys(_container);
    }

    return result;
  }

  @ForthicWord("( container:any -- values:any[] )", "Get values from record or elements from array")
  async VALUES(container: any) {
    let _container = container;
    if (!_container) _container = [];

    let result: any;
    if (_container instanceof Array) {
      // Copy: returning the input's own array lets a caller mutate it in place.
      result = [..._container];
    } else {
      result = [];
      Object.keys(_container).forEach((k) => result.push(_container[k]));
    }

    return result;
  }
}
