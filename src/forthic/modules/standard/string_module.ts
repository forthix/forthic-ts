import { DecoratedModule, ForthicWord, registerModuleDoc } from "../../decorators/word.js";
import { isTemporal } from "../../../common/temporal_utils.js";

/**
 * >STR stringification. null -> ""; records render as insertion-ordered
 * JSON rather than "[object Object]"; arrays comma-join their recursively
 * stringified elements (JS Array.toString semantics, so arrays of scalars
 * are unchanged — but an array of records now renders each as JSON);
 * everything else keeps toString() (Temporal values: their ISO forms).
 *
 * Mirrored byte-for-byte in forthic-rs (string.rs stringify) so Forthic
 * programs stringify identically across runtimes.
 */
function stringifyValue(item: any): string {
  if (item === null || item === undefined) return "";
  if (Array.isArray(item)) return item.map(stringifyValue).join(",");
  if (typeof item === "object" && !isTemporal(item)) return JSON.stringify(item);
  return item.toString();
}

export class StringModule extends DecoratedModule {
  static {
    registerModuleDoc(StringModule, `
String manipulation and processing operations with regex and URL encoding support.

## Categories
- Conversion: >STR
- Transform: LOWERCASE, UPPERCASE, STRIP, ASCII, TRIM-PREFIX, TRIM-SUFFIX
- Split/Join: SPLIT, JOIN, CONCAT, LINES, UNLINES
- Pattern: REPLACE, RE-REPLACE, RE-MATCH, RE-MATCH-ALL, RE-MATCH?
- Predicates: STARTS-WITH?, ENDS-WITH?, RE-MATCH?
- Bash-flavored: GREP, GREP-V, SED, CUT
- Constants: /N, /T

## Note
Regex patterns (RE-*, GREP, SED) are compiled and run as-is. A pathological
pattern can backtrack catastrophically (ReDoS) and block execution, so patterns
must come from a trusted source, not untrusted input.

## Examples
["hello" " " "world"] CONCAT
"hello world" STR-LENGTH
"hello world" " " SPLIT
["hello" "world"] " " JOIN
"Hello" LOWERCASE
`);
  }

  constructor() {
    super("string");
  }

  @ForthicWord(
    "( strings:string[] -- result:string )",
    "Concatenate an array of strings into one string. For two strings: write [s1 s2] CONCAT. For arrays of arrays, use FLATTEN.",
    "CONCAT",
  )
  async CONCAT(strings: any[]) {
    if (!Array.isArray(strings)) {
      throw new Error("CONCAT requires an array of strings. Wrap two strings as [s1 s2] CONCAT.");
    }
    return strings.map((s) => (s === null || s === undefined ? "" : String(s))).join("");
  }

  @ForthicWord(
    "( str:string -- length:number )",
    "Length of a string in characters (0 if null/undefined).",
    "STR-LENGTH",
  )
  async STR_LENGTH(str: any) {
    if (str === null || str === undefined) return 0;
    if (typeof str !== "string") {
      throw new Error("STR-LENGTH requires a string. For arrays/records, use LENGTH.");
    }
    return str.length;
  }

  @ForthicWord(
    "( item:any -- string:string )",
    "Convert item to string. Records render as JSON; arrays comma-join their stringified elements.",
    ">STR",
  )
  async to_STR(item: any) {
    return stringifyValue(item);
  }

  @ForthicWord("( string:string sep:string -- items:any[] )", "Split string by separator")
  async SPLIT(string: string, sep: string) {
    if (!string) string = "";
    return string.split(sep);
  }

  @ForthicWord("( strings:string[] sep:string -- result:string )", "Join strings with separator")
  async JOIN(strings: string[], sep: string) {
    if (!strings) strings = [];
    return strings.join(sep);
  }

  @ForthicWord(
    "( str:string start:number end:number -- substring:string )",
    "Substring of str from start (inclusive) to end (exclusive), by character index. Indices clamp like String.slice (negatives count from the end).",
    "SUBSTR",
  )
  async SUBSTR(str: any, start: number, end: number) {
    if (str === null || str === undefined) return "";
    if (typeof str !== "string") {
      throw new Error("SUBSTR requires a string. For arrays/records, use SLICE.");
    }
    return str.slice(start, end);
  }

  @ForthicWord(
    "( str:string start:number end:number newval:string -- result:string )",
    "Replace the substring [start, end) of str with newval and return the result (a splice).",
    "SPLICE",
  )
  async SPLICE(str: any, start: number, end: number, newval: any) {
    if (str === null || str === undefined) str = "";
    if (typeof str !== "string") {
      throw new Error("SPLICE requires a string.");
    }
    const ins = newval === null || newval === undefined ? "" : String(newval);
    return str.slice(0, start) + ins + str.slice(end);
  }

  @ForthicWord("( -- char:string )", "Newline character", "/N")
  async slash_N() {
    return "\n";
  }

  @ForthicWord("( -- char:string )", "Tab character", "/T")
  async slash_T() {
    return "\t";
  }

  @ForthicWord(
    "( str:string prefix:string -- bool:boolean )",
    "Returns true if str begins with prefix.",
    "STARTS-WITH?",
  )
  async STARTS_WITH(str: any, prefix: any) {
    if (typeof str !== "string" || typeof prefix !== "string") return false;
    return str.startsWith(prefix);
  }

  @ForthicWord(
    "( str:string suffix:string -- bool:boolean )",
    "Returns true if str ends with suffix.",
    "ENDS-WITH?",
  )
  async ENDS_WITH(str: any, suffix: any) {
    if (typeof str !== "string" || typeof suffix !== "string") return false;
    return str.endsWith(suffix);
  }

  @ForthicWord(
    "( str:string prefix:string -- result:string )",
    "Strip prefix from start of str if present (otherwise return str unchanged).",
    "TRIM-PREFIX",
  )
  async TRIM_PREFIX(str: any, prefix: any) {
    if (typeof str !== "string") return str;
    if (typeof prefix !== "string" || prefix.length === 0) return str;
    return str.startsWith(prefix) ? str.slice(prefix.length) : str;
  }

  @ForthicWord(
    "( str:string suffix:string -- result:string )",
    "Strip suffix from end of str if present (otherwise return str unchanged).",
    "TRIM-SUFFIX",
  )
  async TRIM_SUFFIX(str: any, suffix: any) {
    if (typeof str !== "string") return str;
    if (typeof suffix !== "string" || suffix.length === 0) return str;
    return str.endsWith(suffix) ? str.slice(0, str.length - suffix.length) : str;
  }

  @ForthicWord(
    "( str:string pattern:string -- bool:boolean )",
    "Returns true if str matches the regex pattern. Predicate-only — does not return the match. (jq's `test`.)",
    "RE-MATCH?",
  )
  async RE_MATCH_TEST(str: any, pattern: any) {
    if (typeof str !== "string" || typeof pattern !== "string") return false;
    return new RegExp(pattern).test(str);
  }


  @ForthicWord("( string:string -- result:string )", "Convert string to lowercase")
  async LOWERCASE(string: string) {
    let result = "";
    if (string) result = string.toLowerCase();
    return result;
  }

  @ForthicWord("( string:string -- result:string )", "Convert string to uppercase")
  async UPPERCASE(string: string) {
    let result = "";
    if (string) result = string.toUpperCase();
    return result;
  }

  @ForthicWord("( string:string -- result:string )", "Keep only ASCII characters (< 256)")
  async ASCII(string: string) {
    if (!string) string = "";

    let result = "";
    for (let i = 0; i < string.length; i++) {
      const ch = string[i];
      if (ch.charCodeAt(0) < 256) result += ch;
    }
    return result;
  }

  @ForthicWord("( string:string -- result:string )", "Trim whitespace from string")
  async STRIP(string: string) {
    let result = string;
    if (result) result = result.trim();
    return result;
  }

  @ForthicWord(
    "( string:string text:string replace:string -- result:string )",
    "Replace all literal occurrences of text with replace. For regex matching use RE-REPLACE.",
    "REPLACE",
  )
  async REPLACE(string: string, text: string, replace: string) {
    if (string === null || string === undefined) return string;
    if (text === null || text === undefined || text === "") return string;
    return string.split(text).join(replace ?? "");
  }

  @ForthicWord(
    "( template:string -- result:string )",
    "Interpolate {.var}@ holes with variable values from the current scope. {...} marks off a raw " +
      "block and the postfix @ fetches it as a variable (a leading dot is optional, so {.x}@ and {x}@ " +
      "are equivalent). Only a } immediately followed by @ is a hole, so bare braces in the text pass " +
      'through untouched. null/undefined render as ""; records/arrays render as JSON.',
    "INTERPOLATE",
  )
  async INTERPOLATE(template: string) {
    if (template === null || template === undefined) return template;
    return String(template).replace(/\{([^{}]*)\}@/g, (_match, raw) => {
      let name = String(raw).trim();
      if (name.startsWith(".")) name = name.slice(1);
      const variable = this.get_interp().find_variable(name);
      const value = variable ? variable.get_value() : null;
      return render_interpolation_value(value);
    });
  }

  @ForthicWord(
    "( string:string pattern:string replace:string -- result:string )",
    "Replace all regex matches of pattern with replace. Same as classic REPLACE behavior.",
    "RE-REPLACE",
  )
  async RE_REPLACE(string: string, pattern: string, replace: string) {
    if (string === null || string === undefined) return string;
    if (pattern === null || pattern === undefined) return string;
    return string.replace(new RegExp(pattern, "g"), replace ?? "");
  }

  @ForthicWord("( string:string pattern:string -- match:any )", "Match string against regex pattern", "RE-MATCH")
  async RE_MATCH(string: string, pattern: string) {
    const re_pattern = new RegExp(pattern);
    let result: any = false;
    if (string !== null) result = string.match(re_pattern);
    return result;
  }

  @ForthicWord("( string:string pattern:string -- matches:any[] )", "Find all regex matches in string", "RE-MATCH-ALL")
  async RE_MATCH_ALL(string: string, pattern: string) {
    const re_pattern = new RegExp(pattern, "g");
    let matches: IterableIterator<RegExpMatchArray> = [][Symbol.iterator]();
    if (string !== null) matches = string.matchAll(re_pattern);
    // Return capture group 1 when the pattern has one, otherwise the full
    // match. Previously always returned v[1], yielding undefined for every
    // match when the pattern had no capture group.
    const result = Array.from(matches).map((v) => v[1] ?? v[0]);
    return result;
  }

  // ========================================
  // Bash/shell-flavored additions (PR 7)
  // ========================================

  @ForthicWord(
    "( str:string -- lines:string[] )",
    "Split string on newline. Equivalent to /N SPLIT.",
    "LINES",
  )
  async LINES(str: any) {
    if (str === null || str === undefined) return [];
    if (typeof str !== "string") return [];
    return str.split("\n");
  }

  @ForthicWord(
    "( lines:string[] -- str:string )",
    "Join an array of lines with newlines. Equivalent to /N JOIN.",
    "UNLINES",
  )
  async UNLINES(lines: any) {
    if (!Array.isArray(lines)) return "";
    return lines.join("\n");
  }

  @ForthicWord(
    "( strings:string[] pattern:string -- matches:string[] )",
    "Keep only strings matching the regex pattern (bash grep).",
    "GREP",
  )
  async GREP(strings: any, pattern: any) {
    if (!Array.isArray(strings)) return [];
    if (typeof pattern !== "string") return [];
    const re = new RegExp(pattern);
    return strings.filter((s: any) => typeof s === "string" && re.test(s));
  }

  @ForthicWord(
    "( strings:string[] pattern:string -- non_matches:string[] )",
    "Keep only strings NOT matching the regex pattern (bash grep -v).",
    "GREP-V",
  )
  async GREP_V(strings: any, pattern: any) {
    if (!Array.isArray(strings)) return [];
    if (typeof pattern !== "string") return strings;
    const re = new RegExp(pattern);
    return strings.filter((s: any) => typeof s !== "string" || !re.test(s));
  }

  @ForthicWord(
    "( strings:string[] pattern:string repl:string -- strings:string[] )",
    "Apply RE-REPLACE to each string in the array (bash sed s/pattern/repl/g).",
    "SED",
  )
  async SED(strings: any, pattern: any, repl: any) {
    if (!Array.isArray(strings)) return [];
    if (typeof pattern !== "string") return strings;
    const re = new RegExp(pattern, "g");
    return strings.map((s: any) =>
      typeof s === "string" ? s.replace(re, repl ?? "") : s,
    );
  }

  @ForthicWord(
    "( strings:string[] sep:string field:number -- field_values:any[] )",
    "Split each string on sep and pick the field-th column (bash cut). Out-of-range yields null.",
    "CUT",
  )
  async CUT(strings: any, sep: any, field: any) {
    if (!Array.isArray(strings)) return [];
    if (typeof sep !== "string") return [];
    const idx = typeof field === "number" ? field : Number(field);
    if (!Number.isInteger(idx)) return [];
    return strings.map((s: any) => {
      if (typeof s !== "string") return null;
      const parts = s.split(sep);
      return idx >= 0 && idx < parts.length ? parts[idx] : null;
    });
  }

}

// Render a variable's value into an INTERPOLATE hole: strings pass through, null/
// undefined become empty, primitives stringify, and records/arrays become JSON.
function render_interpolation_value(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
