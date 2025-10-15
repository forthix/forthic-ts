import { Interpreter, dup_interpreter } from "../interpreter.js";
import { DecoratedModule, Word, DirectWord, registerModuleDoc } from "../decorators/word.js";

export class ArrayModule extends DecoratedModule {
  static {
    registerModuleDoc(ArrayModule, `
Array and collection operations for manipulating arrays and records.

## Categories
- Access: NTH, LAST, SLICE, TAKE, DROP, LENGTH, INDEX, KEY-OF
- Transform: MAP, REVERSE
- Combine: APPEND, ZIP, ZIP_WITH, CONCAT
- Filter: SELECT, UNIQUE, DIFFERENCE, INTERSECTION, UNION
- Sort: SORT, SHUFFLE, ROTATE
- Group: BY_FIELD, GROUP_BY_FIELD, GROUP_BY, GROUPS_OF
- Utility: <REPEAT, FOREACH, REDUCE, UNPACK, FLATTEN

## Options
Several words support options via the ~> operator using syntax: [.option_name value ...] ~> WORD
- with_key: Push index/key before value (MAP, FOREACH, GROUP-BY, SELECT)
- push_error: Push error array after execution (MAP, FOREACH)
- depth: Recursion depth for nested operations (MAP, FLATTEN)
- push_rest: Push remaining items after operation (MAP, TAKE)
- comparator: Custom comparison function as Forthic string (SORT)

## Examples
[10 20 30] '2 *' MAP
[10 20 30] '+ 2 *' [.with_key TRUE] ~> MAP
[[[1 2]] [[3 4]]] [.depth 1] ~> FLATTEN
[3 1 4 1 5] [.comparator "SWAP -"] ~> SORT
[.with_key TRUE .push_error TRUE] ~> MAP
`);
  }

  constructor() {
    super("array");
  }

  @Word("( container:any item:any -- container:any )", "Append item to array or add key-value to record")
  async APPEND(container: any, item: any) {
    let result = container;
    if (!result) result = [];

    if (result instanceof Array) {
      result.push(item);
    } else {
      // If not a list, treat as record - item should be [key, value]
      result[item[0]] = item[1];
    }

    return result;
  }

  @Word("( container:any -- container:any )", "Reverse array")
  async REVERSE(container: any) {
    if (!container) return container;

    let result = container;
    if (result instanceof Array) {
      result = result.reverse();
    }

    return result;
  }

  @Word("( array:any[] -- array:any[] )", "Remove duplicates from array")
  async UNIQUE(array: any[]) {
    if (!array) return array;

    let result = array;
    if (array instanceof Array) {
      result = [...new Set(array)];
    }

    return result;
  }

  @Word("( container:any -- length:number )", "Get length of array or record")
  async LENGTH(container: any) {
    if (!container) return 0;

    if (container instanceof Array) {
      return container.length;
    } else {
      return Object.keys(container).length;
    }
  }

  @Word("( container:any n:number -- item:any )", "Get nth element from array or record")
  async NTH(container: any, n: number) {
    if (n === null || !container) return null;

    if (container instanceof Array) {
      if (n < 0 || n >= container.length) return null;
      return container[n];
    } else {
      const keys = Object.keys(container).sort();
      if (n < 0 || n >= keys.length) return null;
      const key = keys[n];
      return container[key];
    }
  }

  @Word("( container:any -- item:any )", "Get last element from array or record")
  async LAST(container: any) {
    if (!container) return null;

    if (container instanceof Array) {
      if (container.length === 0) return null;
      return container[container.length - 1];
    } else {
      const keys = Object.keys(container).sort();
      if (keys.length === 0) return null;
      return container[keys[keys.length - 1]];
    }
  }

  @Word("( container:any start:number end:number -- result:any )", "Extract slice from array or record")
  async SLICE(container: any, start: number, end: number) {
    let _container = container;
    if (!_container) _container = [];

    start = Math.trunc(start);
    end = Math.trunc(end);

    let length: number;
    if (_container instanceof Array) {
      length = _container.length;
    } else {
      length = Object.keys(_container).length;
    }

    const normalize_index = (index: number) => {
      if (index < 0) return index + length;
      return index;
    };

    start = normalize_index(start);
    end = normalize_index(end);

    const step = start > end ? -1 : 1;
    const indexes: (number | null)[] = [start];

    if (start < 0 || start >= length) {
      // Return empty result
      return _container instanceof Array ? [] : {};
    }

    while (start !== end) {
      start = start + step;
      if (start < 0 || start >= length) {
        indexes.push(null);
      } else {
        indexes.push(start);
      }
    }

    if (_container instanceof Array) {
      const result: any[] = [];
      indexes.forEach((i) => {
        if (i === null) result.push(null);
        else result.push(_container[i]);
      });
      return result;
    } else {
      const keys = Object.keys(_container).sort();
      const result: any = {};
      indexes.forEach((i) => {
        if (i !== null) {
          const k = keys[i];
          result[k] = _container[k];
        }
      });
      return result;
    }
  }

  @Word("( container:any[] n:number [options:WordOptions] -- result:any[] )", "Take first n elements")
  async TAKE(container: any[], n: number, options: Record<string, any>) {
    const interp = this.interp

    const flags = {
      with_key: options.with_key ?? null,
      push_rest: options.push_rest ?? null,
    };

    if (!container) container = [];

    let rest, taken;
    if (container instanceof Array) {
      taken = container.slice(0, n);
      rest = container.slice(n);
    } else {
      const keys = Object.keys(container).sort();
      const taken_keys = keys.slice(0, n);
      const rest_keys = keys.slice(n);
      taken = taken_keys.map((k) => container[k]);
      rest = rest_keys.map((k) => container[k]);
    }

    if (flags.push_rest) {
      interp.stack_push(taken)
      return rest
    }

    return taken
  }

  @Word("( container:any n:number -- result:any )", "Drop first n elements from array or record")
  async DROP(container: any, n: number) {
    if (!container) return [];
    if (n <= 0) return container;

    if (container instanceof Array) {
      return container.slice(n);
    } else {
      const keys = Object.keys(container).sort();
      const rest_keys = keys.slice(n);
      return rest_keys.map((k) => container[k]);
    }
  }

  @Word("( lcontainer:any rcontainer:any -- result:any )", "Set difference between two containers")
  async DIFFERENCE(lcontainer: any, rcontainer: any) {
    let _lcontainer = lcontainer || [];
    let _rcontainer = rcontainer || [];

    const difference = (l: any[], r: any[]) => {
      const res: any[] = [];
      l.forEach((item) => {
        if (r.indexOf(item) < 0) res.push(item);
      });
      return res;
    };

    if (_rcontainer instanceof Array) {
      return difference(_lcontainer, _rcontainer);
    } else {
      const lkeys = Object.keys(_lcontainer);
      const rkeys = Object.keys(_rcontainer);
      const diff = difference(lkeys, rkeys);
      const result: any = {};
      diff.forEach((k) => (result[k] = _lcontainer[k]));
      return result;
    }
  }

  @Word("( lcontainer:any rcontainer:any -- result:any )", "Set intersection between two containers")
  async INTERSECTION(lcontainer: any, rcontainer: any) {
    let _lcontainer = lcontainer || [];
    let _rcontainer = rcontainer || [];

    const intersection = (l: any[], r: any[]) => {
      const res: any[] = [];
      l.forEach((item) => {
        if (r.indexOf(item) >= 0) res.push(item);
      });
      return res;
    };

    if (_rcontainer instanceof Array) {
      return intersection(_lcontainer, _rcontainer);
    } else {
      const lkeys = Object.keys(_lcontainer);
      const rkeys = Object.keys(_rcontainer);
      const inter = intersection(lkeys, rkeys);
      const result: any = {};
      inter.forEach((k) => (result[k] = _lcontainer[k]));
      return result;
    }
  }

  @Word("( lcontainer:any rcontainer:any -- result:any )", "Set union between two containers")
  async UNION(lcontainer: any, rcontainer: any) {
    if (!lcontainer) lcontainer = [];
    if (!rcontainer) rcontainer = [];

    function union(l, r) {
      const keyset = {};
      l.forEach((item) => {
        keyset[item] = true;
      });
      r.forEach((item) => {
        keyset[item] = true;
      });
      const res = Object.keys(keyset);
      return res;
    }

    let result;
    if (rcontainer instanceof Array) {
      result = union(lcontainer, rcontainer);
    } else {
      const lkeys = Object.keys(lcontainer);
      const rkeys = Object.keys(rcontainer);

      const keys = union(lkeys, rkeys);
      result = {};
      keys.forEach((k) => {
        let val = lcontainer[k];
        if (val === undefined) val = rcontainer[k];
        result[k] = val;
      });
    }

    return result
  }


  @Word(
    "( container:any[] [options:WordOptions] -- array:any[] )",
    "Sort container. Options: comparator (string or function). Example: [3 1 4] [.comparator \"-1 *\"] ~> SORT"
  )
  async SORT(container: any[], options: Record<string, any>) {
    if (!container) return container;
    if (!(container instanceof Array)) return container;

    const interp = this.interp
    const comparator = options.comparator ?? undefined;

    const flag_string_position = interp.get_string_location(); // NOTE: If the user specified a comparator flag, we want to get the string position of it


    // -----
    // Default sort
    function sort_without_comparator() {
      return container.sort();
    }

    // -----
    // Sort using a forthic string as a key function (augmented array approach)
    // The forthic receives one item and returns a sort key
    async function sort_with_key_forthic(forthic) {
      async function make_aug_array(vals) {
        const res = [];
        for (let i = 0; i < vals.length; i++) {
          const val = vals[i];
          interp.stack_push(val);
          await interp.run(forthic, flag_string_position);
          const aug_val = interp.stack_pop();
          res.push([val, aug_val]);
        }
        return res;
      }

      function cmp_items(l, r) {
        const l_val = l[1];
        const r_val = r[1];

        if (l_val < r_val) return -1;
        else if (l_val > r_val) return 1;
        else return 0;
      }

      function de_aug_array(aug_vals) {
        const res = aug_vals.map((aug_val) => aug_val[0]);
        return res;
      }

      // Create an augmented array, sort it and then return the underlying values
      // NOTE: We're doing it this way because sort is synchronous
      const aug_array = await make_aug_array(container);
      aug_array.sort(cmp_items);
      return de_aug_array(aug_array);
    }

    // -----
    // Sort with key func
    function sort_with_key_func(key_func) {
      function cmp_items(l, r) {
        const l_val = key_func(l);
        const r_val = key_func(r);
        if (l_val < r_val) return -1;
        else if (l_val > r_val) return 1;
        else return 0;
      }

      return container.sort(cmp_items);
    }

    // Figure out what to do
    let result;
    if (typeof comparator == "string") {
      result = await sort_with_key_forthic(comparator);
    } else if (comparator === undefined || comparator === null) {
      result = sort_without_comparator();
    } else {
      result = sort_with_key_func(comparator);
    }

    return result;
  }


  @Word("( array:any[] -- array:any[] )", "Shuffle array randomly")
  async SHUFFLE(array: any[]) {
    if (!array) return array;

    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  @Word("( container:any -- container:any )", "Rotate container by moving last element to front")
  async ROTATE(container: any) {
    if (!container) return container;

    let result = container;
    if (container instanceof Array) {
      if (container.length > 0) {
        result = [...container];
        const val = result.pop();
        result.unshift(val);
      }
    }

    return result;
  }

  @Word("( container:any -- elements:any )", "Unpack array or record elements onto stack")
  async UNPACK(container: any) {
    let _container = container;
    if (!_container) _container = [];

    if (_container instanceof Array) {
      for (const item of _container) {
        this.interp.stack_push(item);
      }
    } else {
      const keys = Object.keys(_container).sort();
      for (const k of keys) {
        this.interp.stack_push(_container[k]);
      }
    }

    // Return undefined so nothing gets auto-pushed
    return undefined;
  }

  @Word(
    "( container:any [options:WordOptions] -- flat:any )",
    "Flatten nested arrays or records. Options: depth (number). Example: [[[1 2]]] [.depth 1] ~> FLATTEN"
  )
  async FLATTEN(container: any, options: Record<string, any>) {
    if (!container) return [];

    const depth = options.depth ?? null;

    const fully_flatten_array = (items: any[], accum: any[]): any[] => {
      for (const item of items) {
        if (item instanceof Array) {
          fully_flatten_array(item, accum);
        } else {
          accum.push(item);
        }
      }
      return accum;
    };

    const flatten_array = (items: any[], depth: number | undefined | null, accum: any[] = []): any[] => {
      if (depth === undefined || depth === null) return fully_flatten_array(items, accum);

      for (const item of items) {
        if (depth > 0 && item instanceof Array) {
          flatten_array(item, depth - 1, accum);
        } else {
          accum.push(item);
        }
      }
      return accum;
    };

    const is_record = (obj: any) => {
      const keys = Object.keys(obj);
      return keys.length > 0;
    };

    const add_to_record_result = (item: any, key: string, keys: string[], result: any) => {
      const new_key = keys.concat([key]).join("\t");
      result[new_key] = item;
    };

    const fully_flatten_record = (record: any, res: any, keys: string[]): any => {
      const record_keys = Object.keys(record);
      for (const k of record_keys) {
        const item = record[k];
        if (is_record(item)) {
          fully_flatten_record(item, res, keys.concat([k]));
        } else {
          add_to_record_result(item, k, keys, res);
        }
      }
      return res;
    };

    const flatten_record = (record: any, depth: number | undefined | null, res: any, keys: string[]): any => {
      if (depth === undefined || depth === null) {
        return fully_flatten_record(record, res, keys);
      }

      const record_keys = Object.keys(record);
      for (const k of record_keys) {
        const item = record[k];
        if (depth > 0 && is_record(item)) {
          flatten_record(item, depth - 1, res, keys.concat([k]));
        } else {
          add_to_record_result(item, k, keys, res);
        }
      }
      return res;
    };

    let result;
    if (container instanceof Array) {
      result = flatten_array(container, depth);
    } else {
      result = flatten_record(container, depth, {}, []);
    }

    return result;
  }

  @Word("( container:any initial:any forthic:string -- result:any )", "Reduce array or record with accumulator")
  async REDUCE(container: any, initial: any, forthic: string) {
    let _container = container;
    if (!_container) _container = [];

    const string_location = this.interp.get_string_location();

    this.interp.stack_push(initial);

    if (_container instanceof Array) {
      for (const item of _container) {
        this.interp.stack_push(item);
        await this.interp.run(forthic, string_location);
      }
    } else {
      for (const k of Object.keys(_container)) {
        const v = _container[k];
        this.interp.stack_push(v);
        await this.interp.run(forthic, string_location);
      }
    }

    const result = this.interp.stack_pop();
    return result;
  }


  @Word("( container1:any[] container2:any[] -- result:any[] )", "Zip two arrays into array of pairs")
  async ZIP(container1: any[], container2: any[]) {
    if (!container1) container1 = [];
    if (!container2) container2 = [];

    let result;
    if (container2 instanceof Array) {
      result = [];
      for (let i = 0; i < container1.length; i++) {
        let value2 = null;
        if (i < container2.length) value2 = container2[i];
        result.push([container1[i], value2]);
      }
    } else {
      result = {};
      Object.keys(container1).forEach((k) => {
        const v = container1[k];
        result[k] = [v, container2[k]];
      });
    }

    return result;
  }

  @Word("( container1:any[] container2:any[] forthic:string -- result:any[] )", "Zip two arrays with combining function")
  async ZIP_WITH(container1: any[], container2: any[], forthic: string) {
    const interp = this.interp
    const string_location = interp.get_string_location();


    if (!container1) container1 = [];
    if (!container2) container2 = [];

    let result;
    if (container2 instanceof Array) {
      result = [];
      for (let i = 0; i < container1.length; i++) {
        let value2 = null;
        if (i < container2.length) value2 = container2[i];
        interp.stack_push(container1[i]);
        interp.stack_push(value2);
        await interp.run(forthic, string_location);
        const res = interp.stack_pop();
        result.push(res);
      }
    } else {
      result = {};
      const keys = Object.keys(container1);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        interp.stack_push(container1[k]);
        interp.stack_push(container2[k]);
        await interp.run(forthic, string_location);
        const res = interp.stack_pop();
        result[k] = res;
      }
    }

    return result;
  }

  @Word("( items:any[] forthic:string -- indexed:any )", "Create index mapping from array indices to values")
  async INDEX(items: any[], forthic: string) {
    const interp = this.interp
    const string_location = interp.get_string_location();

    if (!items) {
      interp.stack_push(items);
      return;
    }

    const result = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      interp.stack_push(item);
      await interp.run(forthic, string_location);
      const keys = interp.stack_pop();
      keys.forEach((k) => {
        const lowercased_key = k.toLowerCase();
        if (result[lowercased_key]) result[lowercased_key].push(item);
        else result[lowercased_key] = [item];
      });
    }

    return result;
  }

  @Word("( container:any value:any -- key:any )", "Find key of value in container")
  async KEY_OF(container: any, value: any) {
    if (!container) return null;

    if (container instanceof Array) {
      const index = container.indexOf(value);
      return index >= 0 ? index : null;
    } else {
      const keys = Object.keys(container);
      for (const key of keys) {
        if (container[key] === value) return key;
      }
      return null;
    }
  }


  @Word("( container:any forthic:string [options:WordOptions] -- filtered:any )", "Filter items with predicate. Options: with_key (bool)")
  async SELECT(container: any, forthic: string, options: Record<string, any>) {
    const interp = this.interp
    const string_location = interp.get_string_location();

    const flags = {
      with_key: options.with_key ?? null,
    };

    if (!container) {
      interp.stack_push(container);
      return;
    }

    let result;
    if (container instanceof Array) {
      result = [];
      for (let i = 0; i < container.length; i++) {
        const item = container[i];
        if (flags.with_key) interp.stack_push(i);
        interp.stack_push(item);
        await interp.run(forthic, string_location);
        const should_select = interp.stack_pop();
        if (should_select) result.push(item);
      }
    } else {
      result = {};
      const keys = Object.keys(container);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = container[k];
        if (flags.with_key) interp.stack_push(k);
        interp.stack_push(v);
        await interp.run(forthic, string_location);
        const should_select = interp.stack_pop();
        if (should_select) result[k] = v;
      }
    }

    return result
  }


  @Word("( container:any[] field:string -- indexed:any )", "Index records by field value")
  async BY_FIELD(container: any[], field: string) {
    if (!container) container = [];

    let values = null;
    if (container instanceof Array) {
      values = container;
    } else {
      values = [];
      Object.keys(container).forEach((k) => {
        values.push(container[k]);
      });
    }

    const result = {};
    values.forEach((v) => {
      if (v) result[v[field]] = v;
    });

    return result;
  }

  @Word("( container:any[] field:string -- grouped:any )", "Group records by field value")
  async GROUP_BY_FIELD(container: any[], field: string) {

    if (!container) container = [];

    let values = [];
    if (container instanceof Array) values = container;
    else values = Object.keys(container).map((k) => container[k]);

    const result = {};
    values.forEach((v) => {
      const field_val = v[field];
      if (field_val instanceof Array) {
        for (const fv of field_val) {
          if (!result[fv]) result[fv] = [];
          result[fv].push(v);
        }
      } else {
        if (!result[field_val]) result[field_val] = [];
        result[field_val].push(v);
      }
    });

    return result
  }

  @Word(
    "( items:any forthic:string [options:WordOptions] -- grouped:any )",
    "Group items by function result. Options: with_key (bool). Example: [5 15 25] '10 /' [.with_key TRUE] ~> GROUP_BY"
  )
  async GROUP_BY(items: any, forthic: string, options: Record<string, any>) {
    let _items = items;
    if (!_items) _items = [];

    const string_location = this.interp.get_string_location();

    const with_key = options.with_key ?? null;

    const result: any = {};

    const process_item = async (item: any, key?: any) => {
      if (with_key) this.interp.stack_push(key);
      this.interp.stack_push(item);
      await this.interp.run(forthic, string_location);
      const groupKey = this.interp.stack_pop();
      if (!result[groupKey]) result[groupKey] = [];
      result[groupKey].push(item);
    };

    if (_items instanceof Array) {
      for (let i = 0; i < _items.length; i++) {
        await process_item(_items[i], i);
      }
    } else {
      const keys = Object.keys(_items);
      for (const key of keys) {
        await process_item(_items[key], key);
      }
    }

    return result;
  }

  @Word("( container:any[] n:number -- groups:any[] )", "Split array into groups of size n")
  async GROUPS_OF(container: any[], n: number) {
    if (n <= 0) throw "GROUPS-OF requires group size > 0";

    if (!container) container = [];

    function group_items(items, group_size) {
      const num_groups = Math.ceil(items.length / group_size);
      const res = [];
      let remaining = items.slice();
      for (let i = 0; i < num_groups; i++) {
        res.push(remaining.slice(0, group_size));
        remaining = remaining.slice(group_size);
      }

      return res;
    }

    function extract_rec(record, keys) {
      const res = {};
      keys.forEach((k) => (res[k] = record[k]));
      return res;
    }

    let result;
    if (container instanceof Array) {
      result = group_items(container, n);
    } else {
      const keys = Object.keys(container);
      const key_groups = group_items(keys, n);
      result = key_groups.map((ks) => extract_rec(container, ks));
    }

    return result;
  }


  @Word(
    "( items:any forthic:string [options:WordOptions] -- ? )",
    "Execute forthic for each item. Options: with_key (bool), push_error (bool). Example: ['a' 'b'] 'PROCESS' [.with_key TRUE] ~> FOREACH"
  )
  async FOREACH(items: any, forthic: string, options: Record<string, any>) {
    let _items = items;
    if (!_items) _items = [];

    const string_location = this.interp.get_string_location();

    const flags = {
      with_key: options.with_key ?? null,
      push_error: options.push_error ?? null,
    };

    const errors: any[] = [];

    const execute_with_error = async (forthic: string, location: any) => {
      try {
        await this.interp.run(forthic, location);
        return null;
      } catch (error) {
        return error;
      }
    };

    if (_items instanceof Array) {
      for (let i = 0; i < _items.length; i++) {
        const item = _items[i];
        if (flags.with_key) this.interp.stack_push(i);
        this.interp.stack_push(item);

        if (flags.push_error) {
          const error = await execute_with_error(forthic, string_location);
          errors.push(error);
        } else {
          await this.interp.run(forthic, string_location);
        }
      }
    } else {
      const keys = Object.keys(_items);
      for (const k of keys) {
        const item = _items[k];
        if (flags.with_key) this.interp.stack_push(k);
        this.interp.stack_push(item);

        if (flags.push_error) {
          const error = await execute_with_error(forthic, string_location);
          errors.push(error);
        } else {
          await this.interp.run(forthic, string_location);
        }
      }
    }

    if (flags.push_error) {
      this.interp.stack_push(errors);
    }

    return undefined;
  }

  @Word(
    "( items:any forthic:string [options:WordOptions] -- mapped:any )",
    "Map function over items. Options: with_key (bool), push_error (bool), depth (num), push_rest (bool). Example: [1 2 3] '2 *' [.with_key TRUE] ~> MAP"
  )
  async MAP(items: any, forthic: string, options: Record<string, any>) {
    const string_location = this.interp.get_string_location();

    const flags = {
      with_key: options.with_key ?? null,
      push_error: options.push_error ?? null,
      depth: options.depth ?? null,
      push_rest: options.push_rest ?? null,
    };

    const map_word = new MapWord(items, forthic, string_location, flags);
    await map_word.execute(this.interp);

    return undefined; // MapWord pushes result directly
  }

  @DirectWord("( item:any forthic:string num_times:number -- )", "Repeat execution of forthic num_times", "<REPEAT")
  async l_REPEAT(interp: Interpreter) {
    const num_times = interp.stack_pop();
    const forthic = interp.stack_pop();
    const string_location = interp.get_string_location();

    for (let i = 0; i < num_times; i++) {
      // Store item so we can push it back later
      const item = interp.stack_pop();
      interp.stack_push(item);

      await interp.run(forthic, string_location);
      const res = interp.stack_pop();

      // Push original item and result
      interp.stack_push(item);
      interp.stack_push(res);
    }
  }
}


// Support

type MapWordFlags = {
  depth?: number;
  interps?: number;
  push_error?: boolean;
  with_key?: boolean;
};

// ( items forthic -- [ ? ] )
class MapWord {
  forthic: any;
  forthic_location: any;
  items: any[];
  flags: MapWordFlags;
  depth: number;
  num_interps: number;
  push_error?: boolean;
  with_key?: boolean;
  cur_index: number;
  result: any[] | { [key: string]: any };
  errors: any[];
  is_debugging: boolean;
  processing_item: boolean;
  is_done: boolean;

  constructor(
    items: any[],
    forthic: any,
    forthic_location: any,
    flags: MapWordFlags,
  ) {
    this.forthic = forthic;
    this.forthic_location = forthic_location;
    this.items = items;
    this.flags = flags;

    // MAP flags
    this.depth = flags.depth || 0;
    this.num_interps = flags.interps || 1;
    this.push_error = flags.push_error;
    this.with_key = flags.with_key;

    this.cur_index = 0;
    this.result = [];
    this.errors = [];
    this.is_debugging = false;
    this.processing_item = false;
    this.is_done = false;
  }
  async execute(interp: Interpreter) {
    await this.normal_execute(interp);
  }

  async normal_execute(interp: Interpreter) {
    this.is_debugging = false;
    const items = this.items;
    if (!items || items.length === 0) {
      interp.stack_push(items);
      return;
    }

    this.result = [];
    this.errors = [];
    if (this.num_interps > 1) {
      interp.stack_push(items)
      await interp.run("LENGTH");
      const num_items = interp.stack_pop();
      const group_size = Math.ceil(num_items / this.num_interps);
      interp.stack_push(items);
      interp.stack_push(group_size);
      await interp.run("GROUPS-OF");
      const groups = interp.stack_pop();

      // Clone and load up interpreters
      const interp_runs = [];

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const new_interp = dup_interpreter(interp);
        const interp_run = this.map(new_interp, group);
        interp_runs.push(interp_run);
      }
      const run_results = await Promise.all(interp_runs);

      // Gather results
      const is_array = items instanceof Array;
      let array_result = []
      let object_result = {}
      let errors = [];
      for (const res of run_results) {
        if (is_array) {
          array_result = [...array_result, ...res[0]]
        }
        else {
          object_result = { ...object_result, ...res[0] };
        }

        errors = [...errors, ...res[1]];
      }
      this.result = is_array ? array_result : object_result;
      this.errors = errors;
    } else {
      await this.map(interp, items);
    }

    // Return results
    interp.stack_push(this.result);

    if (this.push_error) interp.stack_push(this.errors);
  }

  async map(interp: Interpreter, items: any[]) {
    const forthic = this.forthic;
    const forthic_location = this.forthic_location;
    const self = this;

    if (!items) {
      interp.stack_push(items);
      return;
    }

    // This maps the forthic over an item, storing errors if needed
    async function map_value(key: string | number, value: any, errors: any[]) {
      if (self.with_key) interp.stack_push(key);
      interp.stack_push(value);

      if (self.push_error) {
        let error = null;
        try {
          // If this runs successfully, it would have pushed the result onto the stack
          await interp.run(forthic, forthic_location);
        } catch (e) {
          // Since this didn't run successfully, push null onto the stack
          interp.stack_push(null);
          error = e;
        }
        errors.push(error);
      } else {
        await interp.run(forthic, forthic_location);
      }
      return interp.stack_pop();
    }

    // This recursively descends a record structure
    async function descend_record(
      record: { [key: string]: any },
      depth: number,
      accum: { [key: string]: any },
      errors: any[],
    ) {
      const keys = Object.keys(record);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const item = record[k];
        if (depth > 0) {
          if (item instanceof Array) {
            accum[k] = [];
            await descend_list(item, depth - 1, accum[k], errors);
          } else {
            accum[k] = {};
            await descend_record(item, depth - 1, accum[k], errors);
          }
        } else {
          accum[k] = await map_value(k, item, errors);
        }
      }

      return accum;
    }

    // This recursively descends a list
    async function descend_list(
      items: any[],
      depth: number,
      accum: any[],
      errors: any[],
    ) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (depth > 0) {
          if (item instanceof Array) {
            accum.push([]);
            await descend_list(
              item,
              depth - 1,
              accum[accum.length - 1],
              errors,
            );
          } else {
            accum.push({});
            await descend_record(
              item,
              depth - 1,
              accum[accum.length - 1],
              errors,
            );
          }
        } else {
          accum.push(await map_value(i, item, errors));
        }
      }
      return accum;
    }

    const errors = [];
    let result: any;
    const depth = this.depth;
    if (items instanceof Array) {
      result = await descend_list(items, depth, [], errors);
    } else {
      result = await descend_record(items, depth, {}, errors);
    }
    this.result = result;
    this.errors = errors;
    return [result, errors];
  }
}

