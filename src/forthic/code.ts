import { Token, Tokenizer, TokenType, CollectionMark } from "./tokenizer.js";
import {
  to_int,
  to_float,
  to_time,
  to_literal_date,
  to_zoned_datetime,
} from "./literals.js";
import { Closure } from "./closure.js";
import { WordOptions } from "./word_options.js";
import {
  isInstant,
  isPlainDate,
  isPlainTime,
  isZonedDateTime,
} from "../common/temporal_utils.js";

/**
 * Code as data.
 *
 * `>LITERAL` writes a value as Forthic source that pushes that value.
 * `CODE>` reads source into a quotation — an array of tokens — without running
 * it, and `>CODE` writes a quotation back as source. Both directions go
 * through the real tokenizer, so the laws hold by construction:
 *
 *   value >LITERAL RUN            ≡ value
 *   code CODE> >CODE CODE>        ≡ code CODE>
 *
 * A quotation is plain JSON, so it crosses the wire and every array word works
 * on it. Its items are:
 *
 *   "DUP"                 a word (also "[", "]", "{", "}", ";")
 *   { "str": "text" }     a string literal
 *   { "dot": "name" }     a dot symbol, `.name`
 *   { "def": "NAME" }     `: NAME` — a definition start
 *   { "memo": "NAME" }    `@: NAME` — a memo definition start
 *
 * Any other item is a value, written with `>LITERAL`. That is what makes a
 * quotation a template: a number, record, or array can be spliced in as-is,
 * and a string value goes in as `{ .str value }`, because a bare string is a
 * word.
 *
 * `INTERPOLATE-CODE` is the readable front end — Forthic's quasiquote. The
 * template is written as Forthic with `$name` holes, and each filled token is
 * checked by the same tokenizer tests.
 */

// ---------------------------------------------------------------------------
// Tokenizer checks

function tokenize(code: string): Token[] {
  const tokenizer = new Tokenizer(code);
  const tokens: Token[] = [];
  for (;;) {
    const token = tokenizer.next_token();
    if (token.type === TokenType.EOS) return tokens;
    tokens.push(token);
  }
}

// True when `code` reads back as exactly the given tokens. Anything the
// tokenizer rejects — or reads differently — is false, which is how every
// quirk of the syntax is covered without restating it here.
function reads_as(
  code: string,
  expected: { type: TokenType; string: string }[],
): boolean {
  try {
    const tokens = tokenize(code);
    return (
      tokens.length === expected.length &&
      tokens.every(
        (t, i) =>
          t.type === expected[i].type && t.string === expected[i].string,
      )
    );
  } catch {
    return false;
  }
}

function is_word(s: string): boolean {
  return reads_as(s, [{ type: TokenType.WORD, string: s }]);
}

export function is_dot_name(name: string): boolean {
  return reads_as(`.${name}`, [{ type: TokenType.DOT_SYMBOL, string: name }]);
}

function is_definition_name(name: string, prefix: ":" | "@:"): boolean {
  const start = prefix === ":" ? TokenType.START_DEF : TokenType.START_MEMO;
  return reads_as(`${prefix} ${name} ;`, [
    { type: start, string: name },
    { type: TokenType.END_DEF, string: ";" },
  ]);
}

// ---------------------------------------------------------------------------
// >LITERAL

const STRING_ESCAPES: Record<string, string> = {
  "\\": "\\\\",
  "'": "\\'",
  "\n": "\\n",
  "\t": "\\t",
  "\r": "\\r",
  "\0": "\\0",
};

/**
 * A single-quoted string literal whose content reads back exactly. Every
 * backslash is doubled, so no other backslash pair can be misread as an escape.
 */
export function string_literal(s: string): string {
  let body = "";
  for (const c of s) body += STRING_ESCAPES[c] ?? c;
  return `'${body}'`;
}

function number_literal(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`${n} has no Forthic literal`);
  }
  let s = String(n);
  if (Number.isInteger(n) && !s.includes("e") && to_int(s) === n) return s;

  // A float literal needs a decimal point, and JS writes large and small
  // numbers in exponent form without one (1e+21, 1e-7).
  if (!s.includes(".")) s = s.includes("e") ? s.replace("e", ".0e") : `${s}.0`;
  if (to_float(s) === n) return s;
  throw new Error(`${n} has no Forthic literal`);
}

function time_literal(time: Temporal.PlainTime): string {
  const whole_minute =
    time.second === 0 &&
    time.millisecond === 0 &&
    time.microsecond === 0 &&
    time.nanosecond === 0;
  if (whole_minute) {
    const s = `${time.hour}:${String(time.minute).padStart(2, "0")}`;
    if (to_time(s)?.equals(time)) return s;
  }
  // The bare time literal is HH:MM only; >TIME parses the full ISO form.
  return `${string_literal(time.toString())} >TIME`;
}

function is_plain_record(value: any): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function describe(value: any): string {
  if (value instanceof Closure) return "a closure";
  if (value instanceof CollectionMark) return `a collection mark (${value})`;
  if (value instanceof WordOptions) return "word options";
  if (isInstant(value)) return "an instant";
  return typeof value === "object"
    ? (value?.constructor?.name ?? "an object")
    : typeof value;
}

/**
 * Forthic source that pushes `value`. Throws for a value that has none.
 */
export function to_literal(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return number_literal(value);
  if (typeof value === "string") return string_literal(value);

  if (Array.isArray(value)) {
    return value.length === 0
      ? "[ ]"
      : `[ ${value.map(to_literal).join(" ")} ]`;
  }

  // Temporal types are objects, so they are checked before records.
  if (isZonedDateTime(value)) {
    const s = value.toString();
    const read = is_word(s) ? to_zoned_datetime("UTC")(s) : null;
    if (read?.equals(value)) return s;
    throw new Error(`The datetime ${s} has no Forthic literal`);
  }
  if (isPlainDate(value)) {
    const s = value.toString();
    if (to_literal_date("UTC")(s)?.equals(value)) return s;
    throw new Error(`The date ${s} has no Forthic literal`);
  }
  if (isPlainTime(value)) return time_literal(value);

  if (is_plain_record(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{ }";
    // A record literal needs every key to read back as a dot symbol. A key
    // with a space, bracket, `#`, or the like cannot, so the whole record is
    // written as REC entries instead.
    if (entries.every(([k]) => is_dot_name(k))) {
      const body = entries.map(([k, v]) => `.${k} ${to_literal(v)}`).join(" ");
      return `{ ${body} }`;
    }
    const pairs = entries.map(
      ([k, v]) => `[ ${string_literal(k)} ${to_literal(v)} ]`,
    );
    return `[ ${pairs.join(" ")} ] REC`;
  }

  // A closure's frame is live state that source text cannot carry.
  throw new Error(`${describe(value)} has no Forthic literal`);
}

// ---------------------------------------------------------------------------
// CODE> and >CODE

const STRUCTURAL = new Set(["[", "]", "{", "}", ";"]);
const TAGS = ["str", "dot", "def", "memo"] as const;
type Tag = (typeof TAGS)[number];

/**
 * Read Forthic source into a quotation without running it. Comments are
 * dropped: they are not code.
 */
export function code_to_quotation(code: string): any[] {
  const result: any[] = [];
  for (const token of tokenize(code)) {
    switch (token.type) {
      case TokenType.COMMENT:
        break;
      case TokenType.WORD:
      case TokenType.START_ARRAY:
      case TokenType.END_ARRAY:
      case TokenType.START_RECORD:
      case TokenType.END_RECORD:
      case TokenType.END_DEF:
        result.push(token.string);
        break;
      case TokenType.STRING:
        if (token.is_string_redirect) {
          throw new Error(
            "CODE> does not support redirect strings (<<'''…''')",
          );
        }
        result.push({ str: token.string });
        break;
      case TokenType.DOT_SYMBOL:
        result.push({ dot: token.string });
        break;
      case TokenType.START_DEF:
        result.push({ def: token.string });
        break;
      case TokenType.START_MEMO:
        result.push({ memo: token.string });
        break;
      default:
        throw new Error(`CODE> cannot represent token '${token.string}'`);
    }
  }
  return result;
}

function tag_of(item: any): [Tag, string] | null {
  if (!is_plain_record(item)) return null;
  const keys = Object.keys(item);
  if (keys.length !== 1) return null;
  const tag = keys[0] as Tag;
  if (!TAGS.includes(tag) || typeof item[tag] !== "string") return null;
  return [tag, item[tag]];
}

function item_to_code(item: any, index: number): string {
  if (typeof item === "string") {
    if (STRUCTURAL.has(item) || is_word(item)) return item;
    throw new Error(
      `Quotation item ${index} (${JSON.stringify(item)}) is not a single word. ` +
        "Write a string value as { .str ... }",
    );
  }

  const tag = tag_of(item);
  if (!tag) return to_literal(item);

  const [kind, text] = tag;
  switch (kind) {
    case "str":
      return string_literal(text);
    case "dot":
      if (is_dot_name(text)) return `.${text}`;
      break;
    case "def":
      if (is_definition_name(text, ":")) return `: ${text}`;
      break;
    case "memo":
      if (is_definition_name(text, "@:")) return `@: ${text}`;
      break;
  }
  throw new Error(
    `Quotation item ${index}: ${JSON.stringify(text)} is not a valid ${kind} name`,
  );
}

/**
 * Write a quotation back as Forthic source.
 */
export function quotation_to_code(quotation: any[]): string {
  if (!Array.isArray(quotation)) {
    throw new Error(">CODE requires a quotation (an array)");
  }
  return quotation.map(item_to_code).join(" ");
}

// ---------------------------------------------------------------------------
// INTERPOLATE-CODE

export type VariableLookup = (name: string) => { found: boolean; value: any };

// A hole starts at the first `$` in a token and runs to the end of the token:
// `$limit`, `GET-$f`, `.$f`. Braces cannot delimit it, because `{` and `}` end
// a token.
function split_hole(text: string): { prefix: string; name: string } | null {
  const i = text.indexOf("$");
  if (i < 0 || i === text.length - 1) return null;
  return { prefix: text.slice(0, i), name: text.slice(i + 1) };
}

const BRACE_HINT =
  "Use $name, not ${name}, in a code template: braces end a token, so they cannot delimit a hole";

/**
 * Fill `$name` holes in a Forthic template from variables, working on tokens.
 *
 * - A whole-token hole (`$v`) is replaced by the variable's value as a
 *   literal: "push this value here". A string stays one string, so a value
 *   can never add code.
 * - A hole named in `word_holes` inserts its value as a word instead. The
 *   value must be a string that reads as exactly one word.
 * - A hole inside a name (`GET-$f`, `.$f`, `: $f`) splices the value into the
 *   name, and the result must still read as that kind of name.
 * - String literals are data: holes inside them are not filled.
 *
 * An unknown variable is an error, not an empty string: a missing value would
 * make wrong code.
 */
export function interpolate_code(
  template: string,
  lookup: VariableLookup,
  word_holes: Set<string>,
): string {
  let tokens: Token[];
  try {
    tokens = tokenize(template);
  } catch (e) {
    // `: GET-${f}` fails in the tokenizer itself: definition names reject `{`.
    if (template.includes("${")) {
      throw new Error(
        `${BRACE_HINT}. (${(e as Error).message.split("\n")[0]})`,
      );
    }
    throw e;
  }

  function value_of(name: string): any {
    const { found, value } = lookup(name);
    if (!found) throw new Error(`Unknown variable in code template: $${name}`);
    return value;
  }

  function name_piece(name: string): string {
    const value = value_of(name);
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isInteger(value))
      return String(value);
    throw new Error(
      `Template hole $${name} is inside a name, so its value must be a string or an integer`,
    );
  }

  function fill_word(text: string): string {
    const hole = split_hole(text);
    if (!hole) return text;

    if (hole.prefix === "") {
      const value = value_of(hole.name);
      if (!word_holes.has(hole.name)) return to_literal(value);
      if (typeof value !== "string" || !is_word(value)) {
        throw new Error(
          `Template hole $${hole.name} is a word hole, so its value must be a single word; got ${JSON.stringify(value)}`,
        );
      }
      return value;
    }

    const word = hole.prefix + name_piece(hole.name);
    if (!is_word(word)) {
      throw new Error(
        `Template hole $${hole.name} makes ${JSON.stringify(word)}, which is not a single word`,
      );
    }
    return word;
  }

  function fill_name(text: string, kind: "dot" | ":" | "@:"): string {
    const hole = split_hole(text);
    const name = hole ? hole.prefix + name_piece(hole.name) : text;
    const valid =
      kind === "dot" ? is_dot_name(name) : is_definition_name(name, kind);
    if (!valid) {
      const what = kind === "dot" ? "dot symbol" : "definition name";
      throw new Error(
        `Template makes ${JSON.stringify(name)}, which is not a valid ${what}`,
      );
    }
    return name;
  }

  const out: string[] = [];
  tokens.forEach((token, i) => {
    // `${f}` in a word or dot symbol reads as a token ending in `$`, then a `{`
    // with no space between them.
    const next = tokens[i + 1];
    if (
      token.string.endsWith("$") &&
      next?.type === TokenType.START_RECORD &&
      next.location.start_pos === token.location.end_pos
    ) {
      throw new Error(BRACE_HINT);
    }

    switch (token.type) {
      case TokenType.COMMENT:
        return;
      case TokenType.STRING:
        if (token.is_string_redirect) {
          throw new Error(
            "INTERPOLATE-CODE does not support redirect strings (<<'''…''')",
          );
        }
        out.push(string_literal(token.string));
        return;
      case TokenType.WORD:
        out.push(fill_word(token.string));
        return;
      case TokenType.DOT_SYMBOL:
        out.push(`.${fill_name(token.string, "dot")}`);
        return;
      case TokenType.START_DEF:
        out.push(`: ${fill_name(token.string, ":")}`);
        return;
      case TokenType.START_MEMO:
        out.push(`@: ${fill_name(token.string, "@:")}`);
        return;
      default:
        out.push(token.string);
    }
  });
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// GENSYM

let gensym_counter = 0;

/**
 * A variable name that no program text can collide with by accident: the
 * prefix, then `~` and a process-wide counter. It is always a valid dot
 * symbol, so it works with `{ .dot ... }`, `!`, and `@`.
 */
export function gensym(prefix: string): string {
  gensym_counter += 1;
  const name = `${prefix || "g"}~${gensym_counter}`;
  if (!is_dot_name(name) || name.startsWith("__")) {
    throw new Error(
      `GENSYM prefix ${JSON.stringify(prefix)} does not make a valid name`,
    );
  }
  return name;
}
