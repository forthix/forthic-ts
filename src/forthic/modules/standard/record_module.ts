import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";

export class RecordModule extends DecoratedModule {
  static {
    registerModuleDoc(RecordModule, `
Record (object/dictionary) manipulation operations for working with key-value data structures.

## Categories
- Core: REC, REC@, |REC@, <REC!
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


  @ForthicWord("( key_vals:any[] -- rec:any )", "Create record from [[key, val], ...] pairs")
  async REC(key_vals: any[]) {
    let _key_vals = key_vals;
    if (!_key_vals) _key_vals = [];

    const result: any = {};
    _key_vals.forEach((pair) => {
      let key = null;
      let val = null;
      if (pair) {
        if (pair.length >= 1) key = pair[0];
        if (pair.length >= 2) val = pair[1];
      }
      result[key] = val;
    });

    return result;
  }

  @ForthicWord("( rec:any field:any -- value:any )", "Get value from record by field or array of fields", "REC@")
  async REC_at(rec: any, field: any) {
    if (!rec) return null;

    let fields = [field];
    if (field instanceof Array) fields = field;

    const result = RecordModule.drill_for_value(rec, fields);
    return result;
  }

  @ForthicWord("( records:any field:any -- values:any )", "Map REC@ over array of records", "|REC@")
  async pipe_REC_at(records: any, field: any) {
    // Push records back and field, then use MAP with REC@
    this.interp.stack_push(records);
    await this.interp.run(`'${JSON.stringify(field)} REC@' MAP`);
    return undefined; // Result already on stack from MAP
  }

  @ForthicWord("( rec:any value:any field:any -- rec:any )", "Set value in record at field path", "<REC!")
  async l_REC_bang(rec: any, value: any, field: any) {
    let _rec = rec;
    if (!_rec) _rec = {};

    let fields: string[] = [];
    if (field instanceof Array) fields = field;
    else fields = [field];

    function ensure_field(rec: any, field: string): any {
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
    cur_rec[fields[fields.length - 1]] = value;

    return _rec;
  }


  @ForthicWord(
    "( pairs:any[] -- rec:any )",
    "Build a record from an array of [key, value] pairs. Alias of REC, surfaced for symmetry with REC>ENTRIES.",
    "ENTRIES>REC",
  )
  async ENTRIES_to_REC(pairs: any[]) {
    let _key_vals = pairs;
    if (!_key_vals) _key_vals = [];

    const result: any = {};
    _key_vals.forEach((pair) => {
      let key = null;
      let val = null;
      if (pair) {
        if (pair.length >= 1) key = pair[0];
        if (pair.length >= 2) val = pair[1];
      }
      result[key] = val;
    });

    return result;
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
