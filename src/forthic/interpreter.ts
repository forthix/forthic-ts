import { TokenType, Token, Tokenizer, CodeLocation } from "./tokenizer";
import { Module, Word, PushValueWord, DefinitionWord } from "./module";
import { PositionedString } from "./tokenizer";
// Phase 7: Verified error imports - all are used in this file
import {
  UnknownWordError,        // Used in handle_word_token (line ~640)
  UnknownModuleError,      // Used in find_module (line ~353)
  StackUnderflowError,     // Used in stack_pop (line ~373)
  UnknownTokenError,       // Used in handle_token (line ~553)
  MissingSemicolonError,   // Used in handle_start_definition_token & handle_start_memo_token (lines ~599, 611)
  ExtraSemicolonError,     // Used in handle_end_definition_token (line ~622)
  ModuleError,             // Used in run_module_code (line ~460)
  TooManyAttemptsError,    // Used in execute_with_recovery (line ~307)
} from "./errors";
import { Temporal } from "temporal-polyfill";

type Timestamp = {
  label: string;
  time_ms: number;
};

type HandleErrorFunction = (e: Error, interp: Interpreter) => Promise<void>;

class StartModuleWord extends Word {
  async execute(interp: Interpreter): Promise<void> {
    const self = this;

    // The app module is the only module with a blank name
    if (self.name === "") {
      interp.module_stack_push(interp.get_app_module());
      return;
    }

    // If the module is used by the current module, push it onto the stack, otherwise
    // create a new module.
    let module = interp.cur_module().find_module(self.name);
    if (!module) {
      module = new Module(self.name);
      interp.cur_module().register_module(module.name, module.name, module);

      // If we're at the app module, also register with interpreter
      if (interp.cur_module().name === "") {
        interp.register_module(module);
      }
    }
    interp.module_stack_push(module);
  }
}

class EndModuleWord extends Word {
  constructor() {
    super("}");
  }

  async execute(interp: Interpreter): Promise<void> {
    interp.module_stack_pop();
  }
}

class EndArrayWord extends Word {
  constructor() {
    super("]");
  }

  async execute(interp: Interpreter): Promise<void> {
    const items = [];
    let item = interp.stack_pop();
    // NOTE: This won't infinite loop because interp.stack_pop() will eventually fail
    while (true) {
      if (item instanceof Token && item.type == TokenType.START_ARRAY) break;
      items.push(item);
      item = interp.stack_pop();
    }
    items.reverse();
    interp.stack_push(items);
    return;
  }
}

// A wrapper to allow us to set/get the stack
export class Stack {
  private items: any[];

  constructor(items: any[] = []) {
    this.items = items;
  }

  get_items(): any[] {
    return this.items.map((item) => {
      if (item instanceof PositionedString) {
        return item.valueOf();
      }
      return item;
    });
  }

  get_raw_items(): any[] {
    return this.items;
  }

  set_raw_items(items: any[]) {
    this.items = items;
  }

  toJSON() {
    return this.items;
  }

  pop(): any {
    return this.items.pop();
  }

  push(item: any) {
    this.items.push(item);
  }

  // Add length property
  get length() {
    return this.items.length;
  }

  // Phase 3: Duplicate stack with a shallow copy of items
  dup(): Stack {
    return new Stack(this.items.slice());
  }
}

export class Interpreter {
  // Phase 0 & 1: Clean field declarations
  // EXCLUDED: timestamp_id, should_stop, screens, global_module
  private timezone: Temporal.TimeZoneLike;
  private stack: Stack; // Use Stack class directly instead of any[]
  private app_module: Module;
  private module_stack: Module[];
  private registered_modules: { [key: string]: Module };
  private tokenizer_stack: Tokenizer[];
  private previous_token: Token | null;
  private handleError?: HandleErrorFunction;
  private maxAttempts: number;
  private is_compiling: boolean;
  private is_memo_definition: boolean;
  private cur_definition: DefinitionWord | null;
  private default_module_flags: { [key: string]: any };
  private module_flags: { [key: string]: any };
  private string_location?: CodeLocation;
  private word_counts: { [key: string]: number };
  private is_profiling: boolean;
  private start_profile_time: number | null;
  private timestamps: Timestamp[];
  private streaming_token_index: number = 0;
  private stream: boolean = false;
  private previous_delta_length: number = 0;
  private validation_mode: boolean = false;

  constructor(modules: Module[] = [], timezone: Temporal.TimeZoneLike = "UTC") {
    // Phase 0: No timestamp_id, no screens
    // Phase 1: Use Stack class directly
    this.timezone = timezone;
    this.stack = new Stack(); // Use Stack class instead of []

    this.tokenizer_stack = [];
    this.maxAttempts = 3;
    this.handleError = undefined;

    // Phase 0: No global_module hardcoded here
    this.app_module = new Module("", this);
    this.module_stack = [this.app_module];
    this.registered_modules = {};
    this.is_compiling = false;
    // Phase 0: No should_stop
    this.is_memo_definition = false;
    this.cur_definition = null;
    // Phase 0: No screens = {}

    // Module flags
    this.default_module_flags = {};
    this.module_flags = {};

    // Debug support
    this.string_location = undefined;

    // Profiling support
    this.word_counts = {};
    this.is_profiling = false;
    this.start_profile_time = null;
    this.timestamps = [];

    // If modules are provided, import them unprefixed as a convenience
    this.import_modules(modules);
  }

  set_validation_mode(validation_mode: boolean) {
    this.validation_mode = validation_mode;
  }

  get_validation_mode(): boolean {
    return this.validation_mode;
  }

  get_timezone(): Temporal.TimeZoneLike {
    return this.timezone;
  }

  set_timezone(timezone: Temporal.TimeZoneLike) {
    this.timezone = timezone;
  }

  // Phase 0: No halt() method (was for debug stepping)

  get_app_module(): Module {
    return this.app_module;
  }

  get_top_input_string(): string {
    if (this.tokenizer_stack.length == 0) return "";
    return this.tokenizer_stack[0].get_input_string();
  }

  get_tokenizer(): Tokenizer {
    return this.tokenizer_stack[this.tokenizer_stack.length - 1];
  }

  get_string_location(): CodeLocation | undefined {
    return this.string_location;
  }

  set_max_attempts(maxAttempts: number) {
    this.maxAttempts = maxAttempts;
  }

  set_error_handler(handleError: HandleErrorFunction) {
    this.handleError = handleError;
  }

  get_max_attempts(): number {
    return this.maxAttempts;
  }

  get_error_handler(): HandleErrorFunction | undefined {
    return this.handleError;
  }

  // Module flag support
  set_flags(module_id: string, flags: { [key: string]: any }): void {
    if (!this.default_module_flags) {
      this.default_module_flags = {};
    }
    if (!this.module_flags) {
      this.module_flags = {};
    }

    this.default_module_flags[module_id] = flags;
    this.module_flags[module_id] = flags;
  }

  get_flags(module_id: string): { [key: string]: any } {
    const module_flags = this.module_flags[module_id] || {};
    const result = {};
    Object.keys(module_flags).forEach((k) => {
      result[k] = module_flags[k];
    });
    this.module_flags[module_id] = { ...this.default_module_flags[module_id] };
    return result;
  }

  modify_flags(module_id: string, flags: { [key: string]: any }): void {
    const module_flags = this.module_flags[module_id] || {};
    this.module_flags[module_id] = { ...module_flags, ...flags };
  }

  reset() {
    this.stack = new Stack(); // Phase 1: Use Stack class
    this.app_module.variables = {};

    this.module_stack = [this.app_module];
    this.is_compiling = false;
    this.is_memo_definition = false;
    this.cur_definition = null;

    // Debug support
    this.string_location = undefined;
  }

  // Phase 0: No get_screen_forthic() method (screens removed)

  async run(
    string: string,
    reference_location: CodeLocation | null = null,
  ): Promise<boolean | number> {
    this.tokenizer_stack.push(new Tokenizer(string, reference_location));

    if (this.handleError) {
      await this.execute_with_recovery();
    } else {
      await this.run_with_tokenizer(
        this.tokenizer_stack[this.tokenizer_stack.length - 1],
      );
    }

    this.tokenizer_stack.pop();
    return true;
  }

  async execute_with_recovery(numAttempts: number = 0): Promise<number> {
    try {
      numAttempts++;
      if (numAttempts > this.maxAttempts) {
        throw new TooManyAttemptsError(
          this.get_top_input_string(),
          numAttempts,
          this.maxAttempts,
        );
      }
      await this.continue();
      return numAttempts;
    } catch (e) {
      if (!this.handleError) throw e;
      await this.handleError(e, this);
      return await this.execute_with_recovery(numAttempts);
    }
  }

  async continue() {
    await this.run_with_tokenizer(
      this.tokenizer_stack[this.tokenizer_stack.length - 1],
    );
    return;
  }

  async run_with_tokenizer(tokenizer: Tokenizer): Promise<boolean> {
    let token: Token;
    do {
      this.previous_token = token;
      token = tokenizer.next_token();
      await this.handle_token(token);
      if (token.type === TokenType.EOS) {
        break;
      }
      // Phase 0: Removed should_stop check and debug skip logic

      // eslint-disable-next-line no-constant-condition
    } while (true);
    return true; // Done executing
  }

  cur_module(): Module {
    const result = this.module_stack[this.module_stack.length - 1];
    return result;
  }

  find_module(name: string): Module {
    const result = this.registered_modules[name];
    if (result === undefined) {
      throw new UnknownModuleError(
        this.get_top_input_string(),
        name,
        this.string_location,
      );
    }
    return result;
  }

  stack_peek(): any {
    const top = this.stack[this.stack.length - 1];
    let result = top;
    if (top instanceof PositionedString) {
      result = top.valueOf();
    }
    return result;
  }

  stack_push(val: any) {
    this.stack.push(val);
  }

  stack_pop(): any {
    if (this.stack.length == 0) {
      const tokenizer = this.get_tokenizer();
      throw new StackUnderflowError(
        this.get_top_input_string(),
        tokenizer.get_token_location(),
      );
    }
    let result = this.stack.pop();

    // If we have a PositionedString, we need to record the location
    this.string_location = undefined;
    if (result instanceof PositionedString) {
      const positioned_string = result;
      result = positioned_string.valueOf();
      this.string_location = positioned_string.location;
    }
    return result;
  }

  // Phase 3: Accessor methods for Stack (tests use these)
  get_stack(): Stack {
    return this.stack;
  }

  set_stack(stack: Stack) {
    this.stack = stack;
  }

  module_stack_push(module: Module) {
    this.module_stack.push(module);
  }

  module_stack_pop(): Module {
    return this.module_stack.pop();
  }

  register_module(module: Module) {
    this.registered_modules[module.name] = module;
    module.set_interp(this);
  }

  // If names is an array of strings, import each module using the module name as the prefix
  // If names is an array of arrays, import each module using the first element as the
  // module name and the second element as the prefix
  use_modules(names: any[]) {
    for (const name of names) {
      let module_name = name;
      let prefix = name;
      if (name instanceof Array) {
        module_name = name[0];
        prefix = name[1];
      }
      const module = this.find_module(module_name);
      this.get_app_module().import_module(prefix, module, this);
    }
  }

  // A convenience method to register and use a module
  import_module(module: Module, prefix = "") {
    this.register_module(module);
    this.use_modules([[module.name, prefix]]);
  }

  import_modules(modules: Module[]) {
    for (const module of modules) {
      this.import_module(module);
    }
  }

  // Phase 2: Support for IMPORT-MODULES word (unprefixed by default)
  // Transforms simple module names to unprefixed imports: "math" -> ["math", ""]
  // Preserves explicit prefix specifications: ["math", "m"] -> ["math", "m"]
  use_modules_unprefixed(names: any[]) {
    const unprefixed = names.map(name =>
      name instanceof Array ? name : [name, ""]
    );
    this.use_modules(unprefixed);
  }

  async run_module_code(module: Module): Promise<void> {
    this.module_stack_push(module);
    try {
      await this.run(module.forthic_code);
    } catch (e) {
      throw new ModuleError(
        this.get_top_input_string(),
        module.name,
        e,
        this.string_location,
        e,
      );
    }

    this.module_stack_pop();
  }

  find_word(name: string): Word {
    let result = null;
    for (let i = this.module_stack.length - 1; i >= 0; i--) {
      const m = this.module_stack[i];
      result = m.find_word(name);
      if (result) break;
    }
    // Phase 0: No special global_module fallback
    // Words must be in module stack
    return result;
  }

  // ======================
  // Profiling
  start_profiling() {
    this.is_profiling = true;
    this.timestamps = [];
    this.start_profile_time = Date.now();
    this.add_timestamp("START");
    this.word_counts = {};
  }

  count_word(word: Word) {
    if (!this.is_profiling) return;
    const name = word.name;
    if (!this.word_counts[name]) this.word_counts[name] = 0;
    this.word_counts[name] += 1;
  }

  stop_profiling() {
    this.add_timestamp("END");
    this.is_profiling = false;
  }

  add_timestamp(label: string) {
    if (!this.is_profiling) return;
    const timestamp: Timestamp = {
      label: label,
      time_ms: Date.now() - this.start_profile_time,
    };
    this.timestamps.push(timestamp);
  }

  word_histogram(): any[] {
    const items = [];
    Object.keys(this.word_counts).forEach((name) => {
      items.push({ word: name, count: this.word_counts[name] });
    });
    const result = items.sort((l, r) => r["count"] - l["count"]);
    return result;
  }

  profile_timestamps(): Timestamp[] {
    return this.timestamps;
  }

  // ======================
  // Handle tokens

  async handle_token(token: Token) {
    if (token.type == TokenType.STRING) await this.handle_string_token(token);
    else if (token.type == TokenType.COMMENT) this.handle_comment_token(token);
    else if (token.type == TokenType.START_ARRAY)
      await this.handle_start_array_token(token);
    else if (token.type == TokenType.END_ARRAY)
      await this.handle_end_array_token(token);
    else if (token.type == TokenType.START_MODULE)
      await this.handle_start_module_token(token);
    else if (token.type == TokenType.END_MODULE)
      await this.handle_end_module_token(token);
    else if (token.type == TokenType.START_DEF)
      this.handle_start_definition_token(token);
    else if (token.type == TokenType.START_MEMO)
      this.handle_start_memo_token(token);
    else if (token.type == TokenType.END_DEF)
      this.handle_end_definition_token(token);
    else if (token.type == TokenType.DOT_SYMBOL) await this.handle_dot_symbol_token(token);
    else if (token.type == TokenType.WORD) await this.handle_word_token(token);
    else if (token.type == TokenType.EOS) {
      return;
    } else {
      throw new UnknownTokenError(
        this.get_top_input_string(),
        token.string,
        this.string_location,
      );
    }
  }

  async handle_string_token(token: Token) {
    const value = new PositionedString(token.string, token.location);
    await this.handle_word(new PushValueWord("<string>", value));
  }

  async handle_dot_symbol_token(token: Token) {
    const value = new PositionedString(token.string, token.location);
    await this.handle_word(new PushValueWord("<dot-symbol>", value));
  }

  // Start/end module tokens are treated as IMMEDIATE words *and* are also compiled
  async handle_start_module_token(token: Token) {
    const self = this;
    const word = new StartModuleWord(token.string);

    if (self.is_compiling) self.cur_definition.add_word(word);
    self.count_word(word); // For profiling
    await word.execute(self);
  }

  async handle_end_module_token(_token: Token) {
    const self = this;
    const word = new EndModuleWord();

    if (self.is_compiling) self.cur_definition.add_word(word);
    self.count_word(word);
    await word.execute(self);
  }

  async handle_start_array_token(token: Token) {
    await this.handle_word(new PushValueWord("<start_array_token>", token));
  }

  async handle_end_array_token(_token: Token) {
    await this.handle_word(new EndArrayWord());
  }

  handle_comment_token(_token: Token) {
    // console.log("Comment:", token.string);
  }

  handle_start_definition_token(token: Token) {
    if (this.is_compiling) {
      throw new MissingSemicolonError(
        this.get_top_input_string(),
        this.previous_token?.location,
      );
    }
    this.cur_definition = new DefinitionWord(token.string);
    this.is_compiling = true;
    this.is_memo_definition = false;
  }

  handle_start_memo_token(token: Token) {
    if (this.is_compiling) {
      throw new MissingSemicolonError(
        this.get_top_input_string(),
        this.previous_token?.location,
      );
    }
    this.cur_definition = new DefinitionWord(token.string);
    this.is_compiling = true;
    this.is_memo_definition = true;
  }

  handle_end_definition_token(token: Token) {
    if (!this.is_compiling || !this.cur_definition) {
      throw new ExtraSemicolonError(
        this.get_top_input_string(),
        token.location,
      );
    }

    if (this.is_memo_definition) {
      this.cur_module().add_memo_words(this.cur_definition);
    } else {
      this.cur_module().add_word(this.cur_definition);
    }
    this.is_compiling = false;
  }

  async handle_word_token(token: Token) {
    const word = this.find_word(token.string);
    if (!word) {
      throw new UnknownWordError(
        this.get_top_input_string(),
        token.string,
        token.location,
      );
    }
    await this.handle_word(word, token.location);
    return;
  }

  async handle_word(word: Word, location: CodeLocation | null = null) {
    if (this.is_compiling) {
      word.set_location(location);
      this.cur_definition.add_word(word);
    } else {
      if (this.validation_mode) return;
      this.count_word(word);
      await word.execute(this);
    }
  }

  /**
   * Execute streaming Forthic code.
   *
   * @param fullCode - The complete Forthic code from the start up to the current point.
   * @param done - When false, execute tokens up to (but not including) the last one (if more than one token exists).
   *               When true, execute the final token as well.
   */

  async *streamingRun(
    codeStream: string,
    done: boolean,
    reference_location: CodeLocation | null = null,
  ) {
    // Create a new Tokenizer for the full string.
    const tokenizer = new Tokenizer(codeStream, reference_location, done ? false : true);
    const tokens: Token[] = [];
    let eosFound = false;

    this.tokenizer_stack.push(tokenizer);

    // Gather tokens from the beginning.
    while (true) {
      const token = tokenizer.next_token();
      if (!token) {
        break;
      }

      // If we hit an EOS token then push it and break.
      if (token.type === TokenType.EOS) {
        tokens.push(token);
        eosFound = true;
        break;
      }

      tokens.push(token);
    }

    const delta = eosFound ? undefined : tokenizer.get_string_delta();

    let newStop = findLastWordOrEOS(tokens);

    if (eosFound && !done) {
      newStop--;
    }
    if (!eosFound && !done) {
      newStop++;
    }

    // Execute only tokens we have not executed previously.
    for (let i = this.streaming_token_index; i < newStop; i++) {
      const token = tokens[i];
      if (!token) {
        continue;
      }

      await this.handle_token(token);

      if (
        this.stream &&
        (token.type !== TokenType.WORD || token.string !== "START_LOG")
      ) {
        yield token.string;
      }
      this.previous_token = token;
    }

    // Done with this tokenizer
    this.tokenizer_stack.pop();

    if (this.stream && !eosFound) {
      // Yield string delta if we're streaming and tokenizer has a delta
      const newPortion = delta.substring(this.previous_delta_length);

      if (newPortion) {
        yield { stringDelta: newPortion };
      }
      this.previous_delta_length = delta.length;
    }

    if (done) {
      this.endStream();
      return;
    }

    // Update our pointer and reset if done
    this.streaming_token_index = newStop;
  }

  startStream() {
    this.stream = true;
    this.previous_delta_length = 0;
    this.streaming_token_index = 0;
  }

  endStream() {
    this.stream = false;
    this.previous_delta_length = 0;
    this.streaming_token_index = 0;
  }
}

function findLastWordOrEOS(tokens: Token[]): number {
  return tokens.findLastIndex(
    (token) => token.type === TokenType.WORD || token.type === TokenType.EOS,
  );
}

// Phase 8: Type-safe internal interface for dup_interpreter
// This interface exposes private fields needed for duplication
interface InterpreterInternal {
  app_module: Module;
  module_stack: Module[];
  stack: Stack;
  registered_modules: { [key: string]: Module };
  handleError?: HandleErrorFunction;
}

// Phase 4: Improved dup_interpreter - use Module.copy() to preserve module_prefixes
// Phase 8: Uses typed interface instead of 'any' for better type safety
export function dup_interpreter(interp: Interpreter): Interpreter {
  const source = interp as unknown as InterpreterInternal;
  const result_interp = new Interpreter([], interp.get_timezone());
  const target = result_interp as unknown as InterpreterInternal;

  // Use copy() instead of dup() to preserve module_prefixes
  target.app_module = source.app_module.copy(result_interp);
  target.module_stack = [target.app_module];

  // Use Stack.dup() method
  target.stack = source.stack.dup();

  // Share registered modules reference (modules are shared, not copied)
  target.registered_modules = source.registered_modules;

  // Copy error handler if present
  if (source.handleError) {
    target.handleError = source.handleError;
  }

  // Phase 0: No screens copy
  // Phase 0: No parent_interp reference

  return result_interp;
}
