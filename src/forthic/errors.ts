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
// Phase 5: UnknownScreenError removed (screens infrastructure removed in Phase 0)
export class UnknownModuleError extends ForthicError {}
export class InvalidInputPositionError extends ForthicError {}
export class InvalidWordNameError extends ForthicError {}
export class UnterminatedStringError extends ForthicError {}

// Phase 6: Additional error classes needed by Interpreter
export class UnknownTokenError extends ForthicError {
  private token: string;

  constructor(forthic: string, token: string, location?: CodeLocationData, cause?: Error) {
    super(`Unknown type of token: ${token}`, location);
    this.token = token;
  }

  getToken(): string {
    return this.token;
  }
}

export class ModuleError extends ForthicError {
  private module_name: string;
  private error: Error;

  constructor(forthic: string, module_name: string, error: Error, location?: CodeLocationData, cause?: Error) {
    super(`Error in module ${module_name}: ${error.message}`, location);
    this.module_name = module_name;
    this.error = error;
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

  constructor(forthic: string, num_attempts: number, max_attempts: number) {
    super(`Too many recovery attempts: ${num_attempts} of ${max_attempts}`);
    this.num_attempts = num_attempts;
    this.max_attempts = max_attempts;
  }

  getNumAttempts(): number {
    return this.num_attempts;
  }

  getMaxAttempts(): number {
    return this.max_attempts;
  }
}

export function get_error_description(code: string, error: Error): string {
  throw new Error("Not implemented");
}
