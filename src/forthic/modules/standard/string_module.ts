import { Interpreter } from "../../interpreter.js";
import { DecoratedModule, ForthicWord, ForthicDirectWord, registerModuleDoc } from "../../decorators/word.js";

export class StringModule extends DecoratedModule {
  static {
    registerModuleDoc(StringModule, `
String manipulation and processing operations with regex and URL encoding support.

## Categories
- Conversion: >STR, URL-ENCODE, URL-DECODE
- Transform: LOWERCASE, UPPERCASE, STRIP, ASCII
- Split/Join: SPLIT, JOIN, CONCAT
- Pattern: REPLACE, RE-MATCH, RE-MATCH-ALL, RE-MATCH-GROUP
- Constants: /N, /R, /T

## Examples
"hello" "world" CONCAT
["a" "b" "c"] CONCAT
"hello world" " " SPLIT
["hello" "world"] " " JOIN
"Hello" LOWERCASE
"test@example.com" "(@.+)" RE-MATCH 1 RE-MATCH-GROUP
`);
  }

  constructor() {
    super("string");
  }

  @ForthicDirectWord("( str1:string str2:string -- result:string ) OR ( strings:string[] -- result:string )", "Concatenate two strings or array of strings", "CONCAT")
  async CONCAT(interp: Interpreter) {
    const str2 = interp.stack_pop();
    let array: string[];
    if (str2 instanceof Array) {
      array = str2;
    } else {
      const str1 = interp.stack_pop();
      array = [str1, str2];
    }
    const result = array.join("");
    interp.stack_push(result);
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

  @ForthicWord("( -- char:string )", "Carriage return character", "/R")
  async slash_R() {
    return "\r";
  }

  @ForthicWord("( -- char:string )", "Tab character", "/T")
  async slash_T() {
    return "\t";
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
}
