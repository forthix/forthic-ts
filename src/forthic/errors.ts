// Error classes for Forthic interpreter

export interface CodeLocationData {
  screen_name: string;
  line: number;
  column: number;
  start_pos: number;
  end_pos?: number;
}

export class ForthicError extends Error {
  private forthic: string;
  private note: string;
  location?: CodeLocationData;
  cause?: Error;

  constructor(forthic: string, note: string, location?: CodeLocationData, cause?: Error) {
    super(note);
    this.name = this.constructor.name;
    this.forthic = forthic;
    this.note = note;
    this.location = location;
    if (cause) {
      this.cause = cause;
    }
  }

  getDescription(): string {
    throw new Error("Not implemented");
  }

  getError(): Error {
    return this;
  }

  getForthic(): string {
    return this.forthic;
  }

  getNote(): string {
    return this.note;
  }
}

export class UnknownWordError extends ForthicError {
  private word: string;

  constructor(forthic: string, word: string, location?: CodeLocationData, cause?: Error) {
    const note = `Unknown word: ${word}`;
    super(forthic, note, location, cause);
    this.word = word;
    this.name = "UnknownWordError";
  }

  getWord(): string {
    return this.word;
  }
}

export class WordExecutionError extends ForthicError {
  private innerError: Error;

  constructor(message: string, error: Error, location?: CodeLocationData) {
    super("", message, location);
    this.innerError = error;
  }

  getError(): Error {
    return this.innerError;
  }
}

export class MissingSemicolonError extends ForthicError {
  constructor(forthic: string, location?: CodeLocationData, cause?: Error) {
    const note = "Missing semicolon";
    super(forthic, note, location, cause);
    this.name = "MissingSemicolonError";
  }
}

export class ExtraSemicolonError extends ForthicError {
  constructor(forthic: string, location?: CodeLocationData, cause?: Error) {
    const note = "Extra semicolon";
    super(forthic, note, location, cause);
    this.name = "ExtraSemicolonError";
  }
}

export class StackUnderflowError extends ForthicError {
  constructor(forthic: string, location?: CodeLocationData, cause?: Error) {
    const note = "Stack underflow";
    super(forthic, note, location, cause);
    this.name = "StackUnderflowError";
  }
}

export class InvalidVariableNameError extends ForthicError {
  private varname: string;

  constructor(forthic: string, varname: string, location?: CodeLocationData, cause?: Error) {
    const note = `Invalid variable name: ${varname}`;
    super(forthic, note, location, cause);
    this.varname = varname;
    this.name = "InvalidVariableNameError";
  }

  getVarname(): string {
    return this.varname;
  }
}

// Phase 5: UnknownScreenError removed (screens infrastructure removed in Phase 0)
export class UnknownModuleError extends ForthicError {
  private module_name: string;

  constructor(forthic: string, module_name: string, location?: CodeLocationData, cause?: Error) {
    const note = `Unknown module: ${module_name}`;
    super(forthic, note, location, cause);
    this.module_name = module_name;
    this.name = "UnknownModuleError";
  }

  getModuleName(): string {
    return this.module_name;
  }
}
export class InvalidInputPositionError extends ForthicError {
  constructor(forthic: string, location?: CodeLocationData, cause?: Error) {
    const note = "Invalid input position";
    super(forthic, note, location, cause);
    this.name = "InvalidInputPositionError";
  }
}

export class InvalidWordNameError extends ForthicError {
  constructor(forthic: string, location?: CodeLocationData, note?: string, cause?: Error) {
    const error_note = note || "Invalid word name";
    super(forthic, error_note, location, cause);
    this.name = "InvalidWordNameError";
  }
}

export class UnterminatedStringError extends ForthicError {
  constructor(forthic: string, location?: CodeLocationData, cause?: Error) {
    const note = "Unterminated string";
    super(forthic, note, location, cause);
    this.name = "UnterminatedStringError";
  }
}

// Phase 6: Additional error classes needed by Interpreter
export class UnknownTokenError extends ForthicError {
  private token: string;

  constructor(forthic: string, token: string, location?: CodeLocationData, cause?: Error) {
    const note = `Unknown type of token: ${token}`;
    super(forthic, note, location, cause);
    this.token = token;
    this.name = "UnknownTokenError";
  }

  getToken(): string {
    return this.token;
  }
}

export class ModuleError extends ForthicError {
  private module_name: string;
  private error: Error;

  constructor(forthic: string, module_name: string, error: Error, location?: CodeLocationData, cause?: Error) {
    const note = `Error in module ${module_name}: ${error.message}`;
    super(forthic, note, location, cause);
    this.module_name = module_name;
    this.error = error;
    this.name = "ModuleError";
  }

  getModuleName(): string {
    return this.module_name;
  }

  getError(): Error {
    return this.error;
  }
}

export class TooManyAttemptsError extends ForthicError {
  private num_attempts: number;
  private max_attempts: number;

  constructor(forthic: string, num_attempts: number, max_attempts: number, location?: CodeLocationData, cause?: Error) {
    const note = `Too many recovery attempts: ${num_attempts} of ${max_attempts}`;
    super(forthic, note, location, cause);
    this.num_attempts = num_attempts;
    this.max_attempts = max_attempts;
    this.name = "TooManyAttemptsError";
  }

  getNumAttempts(): number {
    return this.num_attempts;
  }

  getMaxAttempts(): number {
    return this.max_attempts;
  }
}

export class IntentionalStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentionalStopError";
  }
}

export function get_error_description(code: string, error: Error): string {
  throw new Error("Not implemented");
}
