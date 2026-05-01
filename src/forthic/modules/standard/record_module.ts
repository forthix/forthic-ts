import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";

export class RecordModule extends DecoratedModule {
  static {
    registerModuleDoc(RecordModule, `
Record (object/dictionary) manipulation operations for working with key-value data structures.

## Categories
- Core: REC, REC@, |REC@, <REC!
- Transform: REC-DEFAULTS, <DEL
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


  @ForthicWord("( record:any key_vals:any[] -- record:any )", "Set default values for missing/empty fields", "REC-DEFAULTS")
  async REC_DEFAULTS(record: any, key_vals: any[]) {
    key_vals.forEach((key_val) => {
      const key = key_val[0];
      const value = record[key];
      if (value === undefined || value === null || value === "") {
        record[key] = key_val[1];
      }
    });

    return record;
  }

  @ForthicWord("( container:any key:any -- container:any )", "Delete key from record or index from array", "<DEL")
  async l_DEL(container: any, key: any) {
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
