import { Interpreter } from "../interpreter";
import { DecoratedModule, Word } from "../decorators/word";

export class StringModule extends DecoratedModule {
  constructor() {
    super("string");

    // CONCAT needs manual registration due to variable arity
    this.add_module_word("CONCAT", this.CONCAT.bind(this));
  }

  // ( str1 str2 -- str ) OR ( array_of_str -- str )
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

  // ( item -- string )
  @Word("( item:any -- string:string )", "Convert item to string", ">STR")
  async to_STR(item: any) {
    return item.toString();
  }

  // ( string sep -- items )
  @Word("( string:string sep:string -- items:any[] )", "Split string by separator")
  async SPLIT(string: string, sep: string) {
    if (!string) string = "";
    return string.split(sep);
  }

  // ( strings sep -- string )
  @Word("( strings:string[] sep:string -- result:string )", "Join strings with separator")
  async JOIN(strings: string[], sep: string) {
    if (!strings) strings = [];
    return strings.join(sep);
  }

  // ( -- char )
  @Word("( -- char:string )", "Newline character", "/N")
  async slash_N() {
    return "\n";
  }

  // ( -- char )
  @Word("( -- char:string )", "Carriage return character", "/R")
  async slash_R() {
    return "\r";
  }

  // ( -- char )
  @Word("( -- char:string )", "Tab character", "/T")
  async slash_T() {
    return "\t";
  }

  // ( A -- a )
  @Word("( string:string -- result:string )", "Convert string to lowercase")
  async LOWERCASE(string: string) {
    let result = "";
    if (string) result = string.toLowerCase();
    return result;
  }

  // ( a -- A )
  @Word("( string:string -- result:string )", "Convert string to uppercase")
  async UPPERCASE(string: string) {
    let result = "";
    if (string) result = string.toUpperCase();
    return result;
  }

  // ( string -- string )
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

  // ( str -- str )
  @Word("( string:string -- result:string )", "Trim whitespace from string")
  async STRIP(string: string) {
    let result = string;
    if (result) result = result.trim();
    return result;
  }

  // ( string text replace -- string )
  @Word("( string:string text:string replace:string -- result:string )", "Replace all occurrences of text with replace")
  async REPLACE(string: string, text: string, replace: string) {
    let result = string;
    if (string) {
      const pattern = new RegExp(text, "g");
      result = string.replace(pattern, replace);
    }
    return result;
  }

  // ( string pattern -- match )
  @Word("( string:string pattern:string -- match:any )", "Match string against regex pattern")
  async RE_MATCH(string: string, pattern: string) {
    const re_pattern = new RegExp(pattern);
    let result: any = false;
    if (string !== null) result = string.match(re_pattern);
    return result;
  }

  // ( string pattern -- matches )
  @Word("( string:string pattern:string -- matches:any[] )", "Find all regex matches in string")
  async RE_MATCH_ALL(string: string, pattern: string) {
    const re_pattern = new RegExp(pattern, "g");
    let matches: IterableIterator<RegExpMatchArray> = [][Symbol.iterator]();
    if (string !== null) matches = string.matchAll(re_pattern);
    const result = Array.from(matches).map((v) => v[1]);
    return result;
  }

  // ( match num -- string )
  @Word("( match:any num:number -- result:any )", "Get capture group from regex match")
  async RE_MATCH_GROUP(match: any, num: number) {
    let result = null;
    if (match) result = match[num];
    return result;
  }

  // ( str -- urlencoded )
  @Word("( str:string -- encoded:string )", "URL encode string")
  async URL_ENCODE(str: string) {
    let result = "";
    if (str) result = encodeURIComponent(str);
    return result;
  }

  // ( urlencoded -- decoded )
  @Word("( urlencoded:string -- decoded:string )", "URL decode string")
  async URL_DECODE(urlencoded: string) {
    let result = "";
    if (urlencoded) result = decodeURIComponent(urlencoded);
    return result;
  }
}
