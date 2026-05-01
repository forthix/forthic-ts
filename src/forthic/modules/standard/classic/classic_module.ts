import { Interpreter } from "../../../interpreter.js";
import { DecoratedModule, ForthicWord, ForthicDirectWord, registerModuleDoc } from "../../../decorators/word.js";

/**
 * ClassicModule - holds legacy/classic Forthic words that remain live
 * for back-compat but are not surfaced in the LLM-targeted documentation.
 *
 * Words living here continue to parse and execute identically to before.
 * The split is purely a documentation / prompt-generation concern: the doc
 * generator targets `modules/standard/*.ts` (top level only) and excludes
 * this directory, so classic words don't appear in small-LLM system prompts.
 *
 * Implementations are inlined here rather than delegated cross-module so
 * the file is self-contained.
 */
export class ClassicModule extends DecoratedModule {
  static {
    registerModuleDoc(
      ClassicModule,
      `
Legacy/classic Forthic words retained for back-compat.

These words remain fully functional at runtime. They are intentionally
omitted from LLM-targeted documentation in favor of canonical siblings
in the sibling standard modules.
`,
    );
  }

  constructor() {
    super("classic");
  }

  // ========================================
  // Word-form arithmetic aliases
  // (Canonical siblings: + - * / live in math_module.)
  // ========================================

  @ForthicDirectWord("( a:number b:number -- sum:number ) OR ( numbers:number[] -- sum:number )", "Add two numbers or sum array", "ADD")
  async ADD(interp: Interpreter) {
    const b = interp.stack_pop();

    if (Array.isArray(b)) {
      let result = 0;
      for (const num of b) {
        if (num !== null && num !== undefined) {
          result += num;
        }
      }
      interp.stack_push(result);
      return;
    }

    const a = interp.stack_pop();
    const num_a = a === null || a === undefined ? 0 : a;
    const num_b = b === null || b === undefined ? 0 : b;
    interp.stack_push(num_a + num_b);
  }

  @ForthicWord("( a:number b:number -- difference:number )", "Subtract b from a", "SUBTRACT")
  async SUBTRACT(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    return a - b;
  }

  @ForthicDirectWord("( a:number b:number -- product:number ) OR ( numbers:number[] -- product:number )", "Multiply two numbers or product of array", "MULTIPLY")
  async MULTIPLY(interp: Interpreter) {
    const b = interp.stack_pop();

    if (Array.isArray(b)) {
      let result = 1;
      for (const num of b) {
        if (num === null || num === undefined) {
          interp.stack_push(null);
          return;
        }
        result *= num;
      }
      interp.stack_push(result);
      return;
    }

    const a = interp.stack_pop();
    if (a === null || a === undefined || b === null || b === undefined) {
      interp.stack_push(null);
      return;
    }
    interp.stack_push(a * b);
  }

  @ForthicWord("( a:number b:number -- quotient:number )", "Divide a by b", "DIVIDE")
  async DIVIDE(a: number, b: number) {
    if (a === null || a === undefined || b === null || b === undefined) {
      return null;
    }
    if (b === 0) {
      return null;
    }
    return a / b;
  }

  // ========================================
  // Synonyms (canonical sibling: NOP lives in core_module.)
  // ========================================

  @ForthicWord("( -- )", "Does nothing (identity operation)")
  async IDENTITY() {
    // No-op
  }

  // ========================================
  // Module / control niche
  // ========================================

  @ForthicWord("( string:string -- )", "Interprets Forthic string in current context. Surfaced as RUN in core.")
  async INTERPRET(string: string) {
    const string_location = this.interp.get_string_location();
    if (string) await this.interp.run(string, string_location);
  }

  @ForthicWord("( names:string[] -- )", "Exports words from current module")
  async EXPORT(names: string[]) {
    this.interp.cur_module().add_exportable(names);
  }

  @ForthicWord("( value:any default_forthic:string -- result:any )", "Returns value or executes Forthic if value is null/undefined/empty string")
  async ["*DEFAULT"](value: any, default_forthic: string) {
    if (value === undefined || value === null || value === "") {
      const string_location = this.interp.get_string_location();
      await this.interp.run(default_forthic, string_location);
      return this.interp.stack_pop();
    }
    return value;
  }

  // ========================================
  // Profiling / logging diagnostics
  // ========================================

  @ForthicWord("( -- )", "Starts profiling word execution")
  async ["PROFILE-START"]() {
    this.interp.start_profiling();
  }

  @ForthicWord("( -- )", "Stops profiling word execution")
  async ["PROFILE-END"]() {
    this.interp.stop_profiling();
  }

  @ForthicWord("( label:string -- )", "Records profiling timestamp with label")
  async ["PROFILE-TIMESTAMP"](label: string) {
    this.interp.add_timestamp(label);
  }

  @ForthicWord("( -- profile_data:object )", "Returns profiling data (word counts and timestamps)")
  async ["PROFILE-DATA"]() {
    const histogram = this.interp.word_histogram();
    const timestamps = this.interp.profile_timestamps();

    const result: { word_counts: any[]; timestamps: any[] } = {
      word_counts: [],
      timestamps: [],
    };

    histogram.forEach((val) => {
      const rec = { word: val["word"], count: val["count"] };
      result["word_counts"].push(rec);
    });

    let prev_time = 0.0;
    timestamps.forEach((t) => {
      const rec = {
        label: t["label"],
        time_ms: t["time_ms"],
        delta: t["time_ms"] - prev_time,
      };
      prev_time = t["time_ms"];
      result["timestamps"].push(rec);
    });

    return result;
  }

  @ForthicWord("( -- )", "Starts logging interpreter stream", "START-LOG")
  async START_LOG() {
    this.interp.startStream();
  }

  @ForthicWord("( -- )", "Ends logging interpreter stream", "END-LOG")
  async END_LOG() {
    this.interp.endStream();
  }

  // ========================================
  // Niche logic
  // ========================================

  @ForthicWord("( a:boolean b:boolean -- result:boolean )", "Logical XOR (exclusive or)")
  async XOR(a: boolean, b: boolean) {
    return (a || b) && !(a && b);
  }

  @ForthicWord("( a:boolean b:boolean -- result:boolean )", "Logical NAND (not and)")
  async NAND(a: boolean, b: boolean) {
    return !(a && b);
  }

  // ========================================
  // Niche array operations
  // ========================================

  @ForthicWord("( array:any[] -- array:any[] )", "Shuffle array randomly")
  async SHUFFLE(array: any[]) {
    if (!array) return array;

    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  @ForthicWord("( container:any -- container:any )", "Rotate container by moving last element to front")
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

  // ========================================
  // Niche record operations
  // ========================================

  @ForthicWord("( container:any old_keys:any[] new_keys:any[] -- container:any )", "Rename record keys")
  async RELABEL(container: any, old_keys: any[], new_keys: any[]) {
    if (!container) return container;

    if (old_keys.length !== new_keys.length) {
      throw new Error("RELABEL: old_keys and new_keys must be same length");
    }

    const new_to_old: any = {};
    for (let i = 0; i < old_keys.length; i++) {
      new_to_old[new_keys[i]] = old_keys[i];
    }

    let result: any;
    if (container instanceof Array) {
      result = [];
      Object.keys(new_to_old)
        .sort()
        .forEach((k) => result.push(container[new_to_old[k]]));
    } else {
      result = {};
      Object.keys(new_to_old).forEach((k) => (result[k] = container[new_to_old[k]]));
    }

    return result;
  }

  @ForthicWord("( record:any -- inverted:any )", "Invert two-level nested record structure", "INVERT-KEYS")
  async INVERT_KEYS(record: any) {
    const result: any = {};
    Object.keys(record).forEach((first_key) => {
      const sub_record = record[first_key];
      Object.keys(sub_record).forEach((second_key) => {
        const value = sub_record[second_key];
        if (!result[second_key]) result[second_key] = {};
        result[second_key][first_key] = value;
      });
    });

    return result;
  }

  // ========================================
  // Niche math
  // ========================================

  @ForthicWord("( -- infinity:number )", "Push Infinity value")
  async INFINITY() {
    return Infinity;
  }

  @ForthicWord("( low:number high:number -- random:number )", "Generate random number in range [low, high)")
  async ["UNIFORM-RANDOM"](low: number, high: number) {
    return Math.random() * (high - low) + low;
  }

  // ========================================
  // Niche json
  // ========================================

  @ForthicWord("( json:string -- pretty:string )", "Format JSON with 2-space indentation", "JSON-PRETTIFY")
  async JSON_PRETTIFY(json: string) {
    if (!json || json.trim() === "") {
      return "";
    }
    const obj = JSON.parse(json);
    return JSON.stringify(obj, null, 2);
  }

  // ========================================
  // Niche string
  // ========================================

  @ForthicWord("( -- char:string )", "Carriage return character", "/R")
  async slash_R() {
    return "\r";
  }

  @ForthicWord("( match:any num:number -- result:any )", "Get capture group from regex match", "RE-MATCH-GROUP")
  async RE_MATCH_GROUP(match: any, num: number) {
    let result = null;
    if (match) result = match[num];
    return result;
  }

  @ForthicWord("( str:string -- encoded:string )", "URL encode string", "URL-ENCODE")
  async URL_ENCODE(str: string) {
    let result = "";
    if (str) result = encodeURIComponent(str);
    return result;
  }

  @ForthicWord("( urlencoded:string -- decoded:string )", "URL decode string", "URL-DECODE")
  async URL_DECODE(urlencoded: string) {
    let result = "";
    if (urlencoded) result = decodeURIComponent(urlencoded);
    return result;
  }

  // ========================================
  // Niche datetime
  // ========================================

  @ForthicWord("( date:Temporal.PlainDate -- int:number )", "Convert date to integer (YYYYMMDD)", "DATE>INT")
  async DATE_to_INT(date: any) {
    if (!date || typeof date.year !== "number") {
      return null;
    }

    const year = date.year;
    const month = String(date.month).padStart(2, "0");
    const day = String(date.day).padStart(2, "0");
    return parseInt(`${year}${month}${day}`, 10);
  }

  // ========================================
  // Superseded by modern variants (PR 4)
  // SELECT  -> FILTER (array_module)
  // IN      -> CONTAINS? (boolean_module, container-first arg order)
  // <REPEAT -> TIMES-RUN (array_module, simpler semantics)
  // <DEL    -> DELETE (record_module)
  // >FIXED  -> FORMAT-FIXED (math_module)
  // SUBTRACT-DATES -> DAYS-BETWEEN (datetime_module)
  // ========================================

  @ForthicWord(
    "( container:any forthic:string [options:WordOptions] -- filtered:any )",
    "Filter items with predicate. Surfaced as FILTER in array_module.",
    "SELECT",
  )
  async SELECT(container: any, forthic: string, options: Record<string, any>) {
    const interp = this.interp;
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

    return result;
  }

  @ForthicWord(
    "( item:any array:any[] -- in:boolean )",
    "Check if item is in array. Surfaced as CONTAINS? in boolean_module (with reversed args: haystack-first).",
  )
  async IN(item: any, array: any[]) {
    if (!Array.isArray(array)) {
      return false;
    }
    return array.includes(item);
  }

  @ForthicDirectWord(
    "( item:any forthic:string num_times:number -- )",
    "Repeat execution of forthic num_times. Surfaced as TIMES-RUN in array_module (simpler ( num forthic -- ) semantics).",
    "<REPEAT",
  )
  async l_REPEAT(interp: Interpreter) {
    const num_times = interp.stack_pop();
    const forthic = interp.stack_pop();
    const string_location = interp.get_string_location();

    for (let i = 0; i < num_times; i++) {
      const item = interp.stack_pop();
      interp.stack_push(item);

      await interp.run(forthic, string_location);
      const res = interp.stack_pop();

      interp.stack_push(item);
      interp.stack_push(res);
    }
  }

  @ForthicWord(
    "( container:any key:any -- container:any )",
    "Delete key from record or index from array. Surfaced as DELETE in record_module.",
    "<DEL",
  )
  async l_DEL(container: any, key: any) {
    if (!container) return container;

    if (container instanceof Array) {
      container.splice(key, 1);
    } else {
      delete container[key];
    }

    return container;
  }

  @ForthicWord(
    "( num:number digits:number -- result:string )",
    "Format number with fixed decimal places. Surfaced as FORMAT-FIXED in math_module.",
    ">FIXED",
  )
  async to_FIXED(num: number, digits: number) {
    if (num === null || num === undefined) {
      return null;
    }
    return num.toFixed(digits);
  }

  @ForthicWord(
    "( date1:Temporal.PlainDate date2:Temporal.PlainDate -- num_days:number )",
    "Get difference in days between dates (date1 - date2). Surfaced as DAYS-BETWEEN in datetime_module.",
    "SUBTRACT-DATES",
  )
  async SUBTRACT_DATES(date1: any, date2: any) {
    if (!date1 || !date2 || typeof date1.year !== "number" || typeof date2.year !== "number") {
      return null;
    }
    const duration = date2.until(date1, { largestUnit: "days" });
    return duration.days;
  }
}
