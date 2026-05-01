import { Interpreter } from "../../interpreter.js";
import { DecoratedModule, ForthicWord, ForthicDirectWord, registerModuleDoc } from "../../decorators/word.js";

export class StringModule extends DecoratedModule {
  static {
    registerModuleDoc(StringModule, `
String manipulation and processing operations with regex and URL encoding support.

## Categories
- Conversion: >STR
- Transform: LOWERCASE, UPPERCASE, STRIP, ASCII, TRIM-PREFIX, TRIM-SUFFIX
- Split/Join: SPLIT, JOIN, CONCAT
- Pattern: REPLACE, RE-MATCH, RE-MATCH-ALL, RE-MATCH?
- Predicates: STARTS-WITH?, ENDS-WITH?, RE-MATCH?
- Constants: /N, /T

## Examples
"hello" "world" CONCAT
["a" "b" "c"] CONCAT
"hello world" " " SPLIT
["hello" "world"] " " JOIN
"Hello" LOWERCASE
`);
  }

  constructor() {
    super("string");
  }

  @ForthicDirectWord(
    "( str1:string str2:string -- result:string ) OR ( arr1:any[] arr2:any[] -- result:any[] ) OR ( strings:string[] -- result:string )",
    "Concatenate two strings, two arrays, or an array of strings. Dispatches on top-of-stack type.",
    "CONCAT",
  )
  async CONCAT(interp: Interpreter) {
    const top = interp.stack_pop();

    // Case 1: Top is an array. Could be either:
    //   (a) [arr1, arr2] form — join all arrays into one
    //   (b) [str1, str2, ...] strings form — join into a single string
    // Disambiguate: if there's another array immediately below, treat as the
    // (arr1 arr2 -- result) two-array form. Otherwise treat as the array-of-things form.
    if (top instanceof Array) {
      // Check whether the value below is also an array → two-array concat
      if (interp.stack_peek() instanceof Array) {
        const below = interp.stack_pop();
        interp.stack_push([...below, ...top]);
        return;
      }

      // Else: array-of-things. If it's all strings, join into a string;
      // if it's an array of arrays, flatten one level.
      if (top.length > 0 && top.every((x: any) => Array.isArray(x))) {
        const result: any[] = [];
        for (const sub of top) result.push(...sub);
        interp.stack_push(result);
        return;
      }

      const result = top.join("");
      interp.stack_push(result);
      return;
    }

    // Case 2: Two strings on the stack.
    const str1 = interp.stack_pop();
    interp.stack_push(`${str1 ?? ""}${top ?? ""}`);
  }

  @ForthicWord("( item:any -- string:string )", "Convert item to string", ">STR")
  async to_STR(item: any) {
    return item.toString();
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

  @ForthicWord("( string:string text:string replace:string -- result:string )", "Replace all occurrences of text with replace")
  async REPLACE(string: string, text: string, replace: string) {
    let result = string;
    if (string) {
      const pattern = new RegExp(text, "g");
      result = string.replace(pattern, replace);
    }
    return result;
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
    const result = Array.from(matches).map((v) => v[1]);
    return result;
  }

}
