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
