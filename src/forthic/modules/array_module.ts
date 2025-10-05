import { Interpreter } from "../interpreter";
import { DecoratedModule, Word } from "../decorators/word";
import { MapWord } from "../global_module/map_word";

/**
 * ArrayModule - Array and collection operations
 *
 * Categories:
 * - Creation: <REPEAT
 * - Access: NTH, LAST, SLICE, TAKE, DROP, LENGTH, INDEX, KEY-OF
 * - Transform: MAP, FOREACH, REDUCE, FLATTEN, UNPACK, REVERSE
 * - Combine: APPEND, ZIP, ZIP-WITH, CONCAT
 * - Filter: SELECT, UNIQUE, DIFFERENCE, INTERSECTION, UNION
 * - Sort: SORT, SHUFFLE
 * - Group: BY-FIELD, GROUP-BY-FIELD, GROUP-BY, GROUPS-OF
 * - Flags: !WITH-KEY, !PUSH-ERROR, !DEPTH, !COMPARATOR, !PUSH-REST
 */
export class ArrayModule extends DecoratedModule {
  module_id: string;

  constructor() {
    super("array");
    this.module_id = "array";
  }

  set_interp(interp: Interpreter): void {
    super.set_interp(interp);

    // Initialize flags for this module
    this.interp.set_flags(this.module_id, {
      with_key: null,
      push_error: null,
      comparator: null,
      push_rest: null,
      depth: null,
    });
  }

  // ========================================
  // Simple Array Operations
  // ========================================

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

  // ========================================
  // Access Operations
  // ========================================

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

  @Word("( array:any[] n:number -- result:any[] )", "Take first n elements")
  async TAKE(array: any[], n: number) {
    if (!array) return [];
    if (n <= 0) return [];

    return array.slice(0, n);
  }

  @Word("( array:any[] n:number -- result:any[] )", "Drop first n elements")
  async DROP(array: any[], n: number) {
    if (!array) return [];
    if (n <= 0) return array;

    return array.slice(n);
  }

  // ========================================
  // Set Operations
  // ========================================

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
    let _lcontainer = lcontainer || [];
    let _rcontainer = rcontainer || [];

    if (_rcontainer instanceof Array) {
      const result = [..._lcontainer];
      _rcontainer.forEach((item) => {
        if (_lcontainer.indexOf(item) < 0) {
          result.push(item);
        }
      });
      return result;
    } else {
      const result: any = { ..._lcontainer };
      Object.keys(_rcontainer).forEach((k) => {
        result[k] = _rcontainer[k];
      });
      return result;
    }
  }

  // ========================================
  // Sort Operations
  // ========================================

  @Word("( array:any[] -- array:any[] )", "Sort array (supports !COMPARATOR flag)")
  async SORT(array: any[]) {
    if (!array) return array;

    const flags = this.interp.get_flags(this.module_id);
    let result = [...array];

    if (flags.comparator) {
      const comparator = flags.comparator;
      if (typeof comparator === "string") {
        // Forthic comparator - needs special handling
        const string_location = this.interp.get_string_location();
        result.sort((a, b) => {
          this.interp.stack_push(a);
          this.interp.stack_push(b);
          this.interp.run(comparator, string_location);
          return this.interp.stack_pop();
        });
      } else {
        // JavaScript function comparator
        result.sort(comparator);
      }
    } else {
      result.sort();
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

  // ========================================
  // Transform Operations
  // ========================================

  @Word("( array:any[] -- elements:any )", "Unpack array elements onto stack")
  async UNPACK(array: any[]) {
    let _array = array;
    if (!_array) _array = [];

    // Push each element onto stack
    for (const item of _array) {
      this.interp.stack_push(item);
    }
    // Return undefined so nothing gets auto-pushed
    return undefined;
  }

  @Word("( array:any[] -- flat:any[] )", "Flatten nested arrays recursively")
  async FLATTEN(array: any[]) {
    if (!array) return [];

    const flags = this.interp.get_flags(this.module_id);
    const depth = flags.depth;

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

    const result = flatten_array(array, depth);
    return result;
  }

  @Word("( array:any[] initial:any forthic:string -- result:any )", "Reduce array with accumulator")
  async REDUCE(array: any[], initial: any, forthic: string) {
    let _array = array;
    if (!_array) _array = [];

    const string_location = this.interp.get_string_location();
    let accumulator = initial;

    for (const item of _array) {
      this.interp.stack_push(accumulator);
      this.interp.stack_push(item);
      await this.interp.run(forthic, string_location);
      accumulator = this.interp.stack_pop();
    }

    return accumulator;
  }

  // ========================================
  // Combine Operations
  // ========================================

  @Word("( array1:any[] array2:any[] -- result:any[] )", "Zip two arrays into array of pairs")
  async ZIP(array1: any[], array2: any[]) {
    let _array1 = array1 || [];
    let _array2 = array2 || [];

    const result: any[] = [];
    const min_length = Math.min(_array1.length, _array2.length);

    for (let i = 0; i < min_length; i++) {
      result.push([_array1[i], _array2[i]]);
    }

    return result;
  }

  @Word("( array1:any[] array2:any[] forthic:string -- result:any[] )", "Zip two arrays with combining function")
  async ZIP_WITH(array1: any[], array2: any[], forthic: string) {
    let _array1 = array1 || [];
    let _array2 = array2 || [];

    const string_location = this.interp.get_string_location();
    const result: any[] = [];
    const min_length = Math.min(_array1.length, _array2.length);

    for (let i = 0; i < min_length; i++) {
      this.interp.stack_push(_array1[i]);
      this.interp.stack_push(_array2[i]);
      await this.interp.run(forthic, string_location);
      result.push(this.interp.stack_pop());
    }

    return result;
  }

  @Word("( array:any[] -- indexed:any )", "Create index mapping from array indices to values")
  async INDEX(array: any[]) {
    if (!array) return {};

    const result: any = {};
    array.forEach((item, i) => {
      result[i] = item;
    });

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

  // ========================================
  // Filter Operations
  // ========================================

  @Word("( items:any forthic:string -- filtered:any )", "Filter items with predicate")
  async SELECT(items: any, forthic: string) {
    let _items = items;
    if (!_items) _items = [];

    const string_location = this.interp.get_string_location();

    if (_items instanceof Array) {
      const result: any[] = [];
      for (const item of _items) {
        this.interp.stack_push(item);
        await this.interp.run(forthic, string_location);
        const should_select = this.interp.stack_pop();
        if (should_select) result.push(item);
      }
      return result;
    } else {
      const result: any = {};
      const keys = Object.keys(_items);
      for (const key of keys) {
        const item = _items[key];
        this.interp.stack_push(item);
        await this.interp.run(forthic, string_location);
        const should_select = this.interp.stack_pop();
        if (should_select) result[key] = item;
      }
      return result;
    }
  }

  // ========================================
  // Group Operations
  // ========================================

  @Word("( records:any[] field:string -- indexed:any )", "Index records by field value")
  async BY_FIELD(records: any[], field: string) {
    if (!records) return {};

    const result: any = {};
    records.forEach((record) => {
      const key = record[field];
      result[key] = record;
    });

    return result;
  }

  @Word("( records:any[] field:string -- grouped:any )", "Group records by field value")
  async GROUP_BY_FIELD(records: any[], field: string) {
    if (!records) return {};

    const result: any = {};
    records.forEach((record) => {
      const key = record[field];
      if (!result[key]) result[key] = [];
      result[key].push(record);
    });

    return result;
  }

  @Word("( items:any forthic:string -- grouped:any )", "Group items by function result")
  async GROUP_BY(items: any, forthic: string) {
    let _items = items;
    if (!_items) _items = [];

    const string_location = this.interp.get_string_location();
    const result: any = {};

    const process_item = async (item: any) => {
      this.interp.stack_push(item);
      await this.interp.run(forthic, string_location);
      const key = this.interp.stack_pop();
      if (!result[key]) result[key] = [];
      result[key].push(item);
    };

    if (_items instanceof Array) {
      for (const item of _items) {
        await process_item(item);
      }
    } else {
      const keys = Object.keys(_items);
      for (const key of keys) {
        await process_item(_items[key]);
      }
    }

    return result;
  }

  @Word("( array:any[] n:number -- groups:any[] )", "Split array into groups of size n")
  async GROUPS_OF(array: any[], n: number) {
    if (!array) return [];

    const result: any[] = [];
    for (let i = 0; i < array.length; i += n) {
      result.push(array.slice(i, i + n));
    }

    return result;
  }

  // ========================================
  // Advanced Operations
  // ========================================

  @Word("( items:any forthic:string -- ? )", "Execute forthic for each item (supports flags)")
  async FOREACH(items: any, forthic: string) {
    let _items = items;
    if (!_items) _items = [];

    const string_location = this.interp.get_string_location();
    const flags = this.interp.get_flags(this.module_id);

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

  @Word("( items:any forthic:string -- mapped:any )", "Map function over items (supports flags)")
  async MAP(items: any, forthic: string) {
    const string_location = this.interp.get_string_location();
    const flags = this.interp.get_flags(this.module_id);

    const map_word = new MapWord(items, forthic, string_location, flags);
    await map_word.execute(this.interp);

    return undefined; // MapWord pushes result directly
  }

  @Word("( item:any forthic:string num_times:number -- )", "Repeat execution of forthic num_times")
  async l_REPEAT(item: any, forthic: string, num_times: number) {
    const string_location = this.interp.get_string_location();

    for (let i = 0; i < num_times; i++) {
      this.interp.stack_push(item);
      await this.interp.run(forthic, string_location);
    }

    return undefined;
  }

  // ========================================
  // Flag Words
  // ========================================

  @Word("( -- )", "Set push_error flag for next operation")
  async bang_PUSH_ERROR() {
    this.interp.modify_flags(this.module_id, { push_error: true });
  }

  @Word("( -- )", "Set with_key flag for next operation")
  async bang_WITH_KEY() {
    this.interp.modify_flags(this.module_id, { with_key: true });
  }

  @Word("( comparator:any -- )", "Set comparator for SORT")
  async bang_COMPARATOR(comparator: any) {
    this.interp.modify_flags(this.module_id, { comparator });
  }

  @Word("( -- )", "Set push_rest flag for next operation")
  async bang_PUSH_REST() {
    this.interp.modify_flags(this.module_id, { push_rest: true });
  }

  @Word("( depth:number -- )", "Set depth for MAP operations")
  async bang_DEPTH(depth: number) {
    this.interp.modify_flags(this.module_id, { depth });
  }
}
