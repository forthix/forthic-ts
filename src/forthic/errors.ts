// Error classes for Forthic interpreter

export interface CodeLocationData {
  screen_name: string;
  line: number;
  column: number;
  start_pos: number;
  end_pos?: number;
}

export class ForthicError extends Error {
  location?: CodeLocationData;

  constructor(message: string, location?: CodeLocationData) {
    super(message);
    this.name = this.constructor.name;
    this.location = location;
  }

  getDescription(): string {
    throw new Error("Not implemented");
  }

  getError(): Error {
    return this;
  }
}

export class UnknownWordError extends ForthicError {}
export class WordExecutionError extends ForthicError {
  private innerError: Error;

  constructor(message: string, error: Error, location?: CodeLocationData) {
    super(message, location);
    this.innerError = error;
  }

  getError(): Error {
    return this.innerError;
  }
}
export class MissingSemicolonError extends ForthicError {}
export class ExtraSemicolonError extends ForthicError {}
export class StackUnderflowError extends ForthicError {}
export class InvalidVariableNameError extends ForthicError {}
export class UnknownScreenError extends ForthicError {}
export class UnknownModuleError extends ForthicError {}
export class InvalidWordNameError extends ForthicError {}
export class UnterminatedStringError extends ForthicError {}

export function get_error_description(code: string, error: Error): string {
  throw new Error("Not implemented");
}
