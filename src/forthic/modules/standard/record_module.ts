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
          const n = parseInt(num, 10);
          if (isNaN(n)) {
            throw new Error(`JQ path: invalid index "${num}" in "${path}"`);
          }
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

  private static jq_get(container: any, segments: PathSegment[]): any {
    if (segments.length === 0) return container ?? null;
    if (container == null) return null;

    const [first, ...rest] = segments;

    if (first.kind === "iterate") {
      let items: any[];
      if (Array.isArray(container)) {
        items = container;
      } else if (typeof container === "object") {
        items = Object.keys(container)
          .sort()
          .map((k) => container[k]);
      } else {
        return [];
      }

      const rest_iterates = rest.some((s) => s.kind === "iterate");
      const result: any[] = [];
      for (const item of items) {
        if (rest.length === 0) {
          result.push(item);
        } else {
          const r = RecordModule.jq_get(item, rest);
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
      const next = container[first.name];
      return RecordModule.jq_get(next, rest);
    }

    // index
    if (Array.isArray(container)) {
      const n = first.n < 0 ? container.length + first.n : first.n;
      if (n < 0 || n >= container.length) return null;
      return RecordModule.jq_get(container[n], rest);
    }
    if (typeof container === "object") {
      const keys = Object.keys(container).sort();
      const n = first.n < 0 ? keys.length + first.n : first.n;
      if (n < 0 || n >= keys.length) return null;
      return RecordModule.jq_get(container[keys[n]], rest);
    }
    return null;
  }

  private static seg_key(seg: PathSegment): string | number {
    if (seg.kind === "field") return seg.name;
    if (seg.kind === "index") return seg.n;
    throw new Error("JQ: [] iteration not supported here");
  }

  private static jq_set(container: any, segments: PathSegment[], value: any): any {
    let cur = container;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const next = segments[i + 1];
      const key = RecordModule.seg_key(seg);
      RecordModule.assert_safe_key(key);

      let child = cur[key];
      if (child == null || typeof child !== "object") {
        child = next.kind === "index" ? [] : {};
        cur[key] = child;
      }
      cur = child;
    }

    const last_key = RecordModule.seg_key(segments[segments.length - 1]);
    RecordModule.assert_safe_key(last_key);
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
    "Get value at jq-style path (e.g., .users[].name). Returns null on miss; [] iterates and flattens. Path arrays accepted for dynamic keys.",
    "JQ@",
  )
  async JQ_at(container: any, path: any) {
    const segments = RecordModule.parse_jq_path(path);
    return RecordModule.jq_get(container, segments);
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
    "Convert a record to an array of [key, value] pairs (sorted by key for stability). Inverse of ENTRIES>REC / REC.",
    "REC>ENTRIES",
  )
  async REC_to_ENTRIES(rec: any) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return [];
    const keys = Object.keys(rec).sort();
    return keys.map((k) => [k, rec[k]]);
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
    const drop = new Set(Array.isArray(keys) ? keys : []);
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

    if (container instanceof Array) {
      container.splice(key, 1);
    } else {
      delete container[key];
    }

    return container;
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
      result = _container;
    } else {
      result = [];
      Object.keys(_container).forEach((k) => result.push(_container[k]));
    }

    return result;
  }
}
