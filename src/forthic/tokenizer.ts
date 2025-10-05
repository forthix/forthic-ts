import { CodeLocationData, InvalidWordNameError, UnterminatedStringError } from "./errors";

export enum TokenType {
  WORD = "WORD",
  STRING = "STRING",
  COMMENT = "COMMENT",
  START_ARRAY = "START_ARRAY",
  END_ARRAY = "END_ARRAY",
  START_DEF = "START_DEF",
  END_DEF = "END_DEF",
  START_MODULE = "START_MODULE",
  END_MODULE = "END_MODULE",
  START_MEMO = "START_MEMO",
  DOT_SYMBOL = "DOT_SYMBOL",
  EOS = "EOS"
}

export class CodeLocation {
  screen_name: string;
  line: number;
  column: number;
  start_pos: number;
  end_pos?: number;

  constructor(data: CodeLocationData) {
    this.screen_name = data.screen_name;
    this.line = data.line;
    this.column = data.column;
    this.start_pos = data.start_pos;
    this.end_pos = data.end_pos;
  }
}

export interface Token {
  type: TokenType;
  string: string;
  location: CodeLocationData;
}

export class PositionedString {
  value: string;
  location: CodeLocationData;

  constructor(value: string, location: CodeLocationData) {
    this.value = value;
    this.location = location;
  }

  toString(): string {
    return this.value;
  }
}

export class Tokenizer {
  constructor(code: string, reference?: CodeLocation) {
    throw new Error("Not implemented");
  }

  next_token(): Token {
    throw new Error("Not implemented");
  }
}

export { InvalidWordNameError, UnterminatedStringError };
