import { Interpreter } from "../interpreter";
import { DecoratedModule, Word, DirectWord } from "../decorators/word";

/**
 * StringModule - String manipulation and processing operations
 *
 * Categories:
 * - Conversion: >STR, URL_ENCODE, URL_DECODE
 * - Transform: LOWERCASE, UPPERCASE, STRIP, ASCII
 * - Split/Join: SPLIT, JOIN, CONCAT
 * - Pattern: REPLACE, RE_MATCH, RE_MATCH_ALL, RE_MATCH_GROUP
 * - Constants: /N, /R, /T
 *
 * Special Features:
 * - CONCAT: Variable arity - accepts either two strings or an array of strings
 * - Pattern matching: Full regex support with capture groups
 * - URL encoding: Handles URI component encoding/decoding
 * - ASCII filtering: Removes non-ASCII characters (>= 256)
 *
 * Examples:
 *   "hello" "world" CONCAT           # => "helloworld"
 *   ["a" "b" "c"] CONCAT             # => "abc"
 *   "hello world" " " SPLIT          # => ["hello", "world"]
 *   ["hello" "world"] " " JOIN       # => "hello world"
 *   "Hello" LOWERCASE                # => "hello"
 *   "test@example.com" "(@.+)" RE-MATCH 1 RE-MATCH-GROUP  # => "@example.com"
 */
export class StringModule extends DecoratedModule {
  constructor() {
    super("string");
  }

  @DirectWord("( str1:string str2:string -- result:string ) OR ( strings:string[] -- result:string )", "Concatenate two strings or array of strings", "CONCAT")
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

  @Word("( item:any -- string:string )", "Convert item to string", ">STR")
  async to_STR(item: any) {
    return item.toString();
  }

  @Word("( string:string sep:string -- items:any[] )", "Split string by separator")
  async SPLIT(string: string, sep: string) {
    if (!string) string = "";
    return string.split(sep);
  }

  @Word("( strings:string[] sep:string -- result:string )", "Join strings with separator")
  async JOIN(strings: string[], sep: string) {
    if (!strings) strings = [];
    return strings.join(sep);
  }

  @Word("( -- char:string )", "Newline character", "/N")
  async slash_N() {
    return "\n";
  }

  @Word("( -- char:string )", "Carriage return character", "/R")
  async slash_R() {
    return "\r";
  }

  @Word("( -- char:string )", "Tab character", "/T")
  async slash_T() {
    return "\t";
  }

  @Word("( string:string -- result:string )", "Convert string to lowercase")
  async LOWERCASE(string: string) {
    let result = "";
    if (string) result = string.toLowerCase();
    return result;
  }

  @Word("( string:string -- result:string )", "Convert string to uppercase")
  async UPPERCASE(string: string) {
    let result = "";
    if (string) result = string.toUpperCase();
    return result;
  }

  @Word("( string:string -- result:string )", "Keep only ASCII characters (< 256)")
  async ASCII(string: string) {
    if (!string) string = "";

    let result = "";
    for (let i = 0; i < string.length; i++) {
      const ch = string[i];
      if (ch.charCodeAt(0) < 256) result += ch;
    }
    return result;
  }

  @Word("( string:string -- result:string )", "Trim whitespace from string")
  async STRIP(string: string) {
    let result = string;
    if (result) result = result.trim();
    return result;
  }

  @Word("( string:string text:string replace:string -- result:string )", "Replace all occurrences of text with replace")
  async REPLACE(string: string, text: string, replace: string) {
    let result = string;
    if (string) {
      const pattern = new RegExp(text, "g");
      result = string.replace(pattern, replace);
    }
    return result;
  }

  @Word("( string:string pattern:string -- match:any )", "Match string against regex pattern")
  async RE_MATCH(string: string, pattern: string) {
    const re_pattern = new RegExp(pattern);
    let result: any = false;
    if (string !== null) result = string.match(re_pattern);
    return result;
  }

  @Word("( string:string pattern:string -- matches:any[] )", "Find all regex matches in string")
  async RE_MATCH_ALL(string: string, pattern: string) {
    const re_pattern = new RegExp(pattern, "g");
    let matches: IterableIterator<RegExpMatchArray> = [][Symbol.iterator]();
    if (string !== null) matches = string.matchAll(re_pattern);
    const result = Array.from(matches).map((v) => v[1]);
    return result;
  }

  @Word("( match:any num:number -- result:any )", "Get capture group from regex match")
  async RE_MATCH_GROUP(match: any, num: number) {
    let result = null;
    if (match) result = match[num];
    return result;
  }

  @Word("( str:string -- encoded:string )", "URL encode string")
  async URL_ENCODE(str: string) {
    let result = "";
    if (str) result = encodeURIComponent(str);
    return result;
  }

  @Word("( urlencoded:string -- decoded:string )", "URL decode string")
  async URL_DECODE(urlencoded: string) {
    let result = "";
    if (urlencoded) result = decodeURIComponent(urlencoded);
    return result;
  }
}
