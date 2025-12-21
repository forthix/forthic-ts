// Error classes for Forthic interpreter

export interface CodeLocationData {
  source?: string;  // Source of the code (e.g., module name, file path)
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
    return this.note;
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

  getMessage(): string {
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
  private definition_location?: CodeLocationData;

  constructor(
    message: string,
    error: Error,
    call_location?: CodeLocationData,
    definition_location?: CodeLocationData
  ) {
    // Pass the error as cause to maintain compatibility with code that checks .cause
    super("", message, call_location, error);
    this.innerError = error;
    this.definition_location = definition_location;
  }

  getError(): Error {
    return this.innerError;
  }

  getRootError(): Error {
    let current = this.innerError;
    while (current.cause instanceof Error) {
      current = current.cause;
    }
    return current;
  }

  getDefinitionLocation(): CodeLocationData | undefined {
    return this.definition_location;
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

export function get_error_description(forthic: string, forthicError: ForthicError): string {
  // If don't have any extra info, just return the note
  if (!forthic || forthic === "" || forthicError.location === undefined) {
    return forthicError.getNote();
  }

  // Otherwise, return the note and indicate where the error occurred
  const location = forthicError.location;

  // For WordExecutionError, show both definition and call locations
  if (forthicError instanceof WordExecutionError) {
    const def_loc = forthicError.getDefinitionLocation();
    if (def_loc) {
      // Show definition location with highlighting
      const def_line_num = def_loc.line;
      const def_lines = forthic.split("\n").slice(0, def_line_num);
      const def_error_line = " ".repeat(def_loc.column - 1) + "^".repeat((def_loc.end_pos || def_loc.start_pos + 1) - def_loc.start_pos);

      let def_location_info = `at line ${def_line_num}`;
      if (def_loc.source) {
        def_location_info += ` in ${def_loc.source}`;
      }

      // Show call location with highlighting
      const call_line_num = location.line;
      const call_lines = forthic.split("\n").slice(0, call_line_num);
      const call_error_line = " ".repeat(location.column - 1) + "^".repeat((location.end_pos || location.start_pos + 1) - location.start_pos);

      let call_location_info = `line ${call_line_num}`;
      if (location.source) {
        call_location_info += ` in ${location.source}`;
      }

      return `${forthicError.getNote()} ${def_location_info}:\n\`\`\`\n${def_lines.map((line) => `${line}`).join("\n")}\n${def_error_line}\n\`\`\`\nCalled from ${call_location_info}:\n\`\`\`\n${call_lines.map((line) => `${line}`).join("\n")}\n${call_error_line}\n\`\`\``;
    }
  }

  // Standard error format for other errors
  const line_num = location.line;
  const lines = forthic.split("\n").slice(0, line_num);
  const error_line = " ".repeat(location.column - 1) + "^".repeat((location.end_pos || location.start_pos + 1) - location.start_pos);

  let location_info = `at line ${line_num}`;
  if (location.source) {
    location_info += ` in ${location.source}`;
  }

  const error_message = `${forthicError.getNote()} ${location_info}:\n\`\`\`\n${lines.map((line) => `${line}`).join("\n")}\n${error_line}\n\`\`\``;
  return error_message;
}

