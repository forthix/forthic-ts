import { TokenType, Token, Tokenizer, CodeLocation } from "./tokenizer.js";
import { Module, Variable, Word, PushValueWord, DefinitionWord, ModuleMemoWord } from "./module.js";
import { PositionedString } from "./tokenizer.js";
import {
  UnknownWordError,
  UnknownModuleError,
  StackUnderflowError,
  ModuleStackUnderflowError,
  UnknownTokenError,
  MissingSemicolonError,
  ExtraSemicolonError,
  ModuleError,
  TooManyAttemptsError,
  WordExecutionError,
  ForthicError,
  IntentionalStopError,
  StringRedirectError,
} from "./errors.js";
import { StringRedirectRouter } from "./string_redirect_router.js";
import { LiteralHandler, to_bool, to_float, to_int, to_time, to_literal_date, to_zoned_datetime } from "./literals.js";
import { CoreModule } from "./modules/standard/core_module.js";
import { ArrayModule } from "./modules/standard/array_module.js";
import { RecordModule } from "./modules/standard/record_module.js";
import { StringModule } from "./modules/standard/string_module.js";
import { MathModule } from "./modules/standard/math_module.js";
import { BooleanModule } from "./modules/standard/boolean_module.js";
import { JsonModule } from "./modules/standard/json_module.js";
import { DateTimeModule } from "./modules/standard/datetime_module.js";
import { ClassicModule } from "./modules/standard/classic/classic_module.js";
import { serializeValue, deserializeValue, serializeStack, deserializeStack, StackValue } from "../websocket/serializer.js";
import { pathSegmentForKey } from "../common/type_utils.js";

type Timestamp = {
  label: string;
  time_ms: number;
};

type HandleErrorFunction = (e: Error, interp: Interpreter) => Promise<void>;

/**
 * StartModuleWord - Handles module creation and switching
 *
 * Pushes a module onto the module stack, creating it if necessary.
 * An empty name refers to the app module.
 */
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

/**
 * EndModuleWord - Pops the current module from the module stack
 *
 * Completes module context and returns to the previous module.
 */
class EndModuleWord extends Word {
  constructor() {
    super("}");
  }

  async execute(interp: Interpreter): Promise<void> {
    interp.module_stack_pop();
  }
}

/**
 * EndArrayWord - Collects items from stack into an array
 *
 * Pops items from the stack until a START_ARRAY token is found,
 * then pushes them as a single array in the correct order.
 */
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

/**
 * Stack - Wrapper for the interpreter's data stack
 *
 * Provides stack operations with support for array indexing via Proxy.
 * Handles PositionedString unwrapping and provides JSON serialization.
 * Items can be accessed with bracket notation (e.g., stack[0]).
 */
export class Stack {
  private items: any[];

  constructor(items: any[] = []) {
    this.items = items;

    // Return a Proxy to support array indexing
    return new Proxy(this, {
      get(target, prop) {
        // If it's a number or string that looks like a number, treat as array index
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const index = parseInt(prop, 10);
          return target.items[index];
        }
        // Otherwise return the property from the target object
        return target[prop as keyof Stack];
      },
      set(target, prop, value) {
        // If it's a number or string that looks like a number, set array index
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          const index = parseInt(prop, 10);
          target.items[index] = value;
          return true;
        }
        // Don't allow setting readonly properties like 'length'
        if (prop === 'length') {
          return false;
        }
        // Otherwise set the property on the target object (using any to bypass type checking)
        (target as any)[prop] = value;
        return true;
      }
    });
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

  // Duplicate stack with a shallow copy of items
  dup(): Stack {
    return new Stack(this.items.slice());
  }
}

/**
 * Interpreter - Base Forthic interpreter
 *
 * Core interpreter that tokenizes and executes Forthic code.
 * Manages the data stack, module stack, and execution context.
 *
 * Features:
 * - Stack-based execution model
 * - Module system with imports and namespacing
 * - Literal handlers for parsing values (numbers, dates, booleans, etc.)
 * - Error handling with recovery attempts
 * - Profiling and performance tracking
 * - Streaming execution support
 *
 * Note: This is the base interpreter without standard library modules.
 * Use StandardInterpreter for a full-featured interpreter with stdlib.
 */
export class Interpreter {
  private timezone: Temporal.TimeZoneLike;
  private stack: Stack;
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
  private definition_start_input_pos: number;
  private string_location?: CodeLocation;
  private word_counts: { [key: string]: number };
  private is_profiling: boolean;
  private start_profile_time: number | null;
  private timestamps: Timestamp[];
  /**
   * Per-turn incremental-execution state for streamingRun, reset in one place when
   * a turn ends (done, abort, or thrown error). `tokenIndex` is the resume point in
   * the token stream so a later chunk of the same turn re-tokenizes from the start
   * but only executes tokens it hasn't run yet.
   */
  private streamingSession = { tokenIndex: 0 };
  /**
   * Redirects a designated string's text into a caller-supplied StringRedirectSink
   * as it is generated. This is the streaming output path.
   */
  private stringRedirectRouter: StringRedirectRouter;
  private literal_handlers: LiteralHandler[];
  // Word-local variable frames. A new frame is pushed when a user-defined word
  // (DefinitionWord) executes and popped when it returns, so dot-vars assigned
  // inside a word are private to that call and don't clobber callees/callers.
  private local_frames: { [name: string]: Variable }[] = [];
  on_word_defined?: (name: string) => void;

  constructor(modules: Module[] = [], timezone: Temporal.TimeZoneLike = "UTC") {
    this.timezone = timezone;
    this.stack = new Stack(); // Use Stack class instead of []
    this.stringRedirectRouter = new StringRedirectRouter(this);

    this.tokenizer_stack = [];
    this.maxAttempts = 3;
    this.handleError = undefined;

    this.app_module = new Module("");
    this.app_module.set_interp(this);
    this.module_stack = [this.app_module];
    // Prototype-less: keyed by module names from program text, so `constructor`
    // must not resolve to inherited Object and `__proto__` must not swap the map.
    this.registered_modules = Object.create(null);
    this.is_compiling = false;
    this.is_memo_definition = false;
    this.cur_definition = null;
    this.definition_start_input_pos = 0;

    // Debug support
    this.string_location = undefined;

    // Profiling support
    this.word_counts = Object.create(null);
    this.is_profiling = false;
    this.start_profile_time = null;
    this.timestamps = [];

    // Literal handlers
    this.literal_handlers = [];
    this.register_standard_literals();

    // If modules are provided, import them unprefixed as a convenience
    this.import_modules(modules);
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

  // Returns names of words defined via `:` or `@:` in the app module.
  // Does NOT include words imported via USE-MODULES.
  get_app_defined_word_names(): string[] {
    return this.app_module.words
      .filter((w: Word) => w instanceof DefinitionWord || w instanceof ModuleMemoWord)
      .map((w: Word) => w.name);
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

  reset() {
    this.stack = new Stack(); // Phase 1: Use Stack class
    this.app_module.variables = Object.create(null);

    this.module_stack = [this.app_module];
    this.is_compiling = false;
    this.is_memo_definition = false;
    this.cur_definition = null;

    // Clear per-run parsing state too, so reset() after a failed run fully
    // restores the interpreter rather than leaving a stale tokenizer, a
    // dangling previous_token, or a mid-turn streaming resume pointer.
    this.tokenizer_stack = [];
    this.previous_token = null;
    this.resetStreamingSession();

    // Debug support
    this.string_location = undefined;
  }


  async run(
    string: string,
    reference_location: CodeLocation | null = null,
  ): Promise<boolean | number> {
    this.tokenizer_stack.push(new Tokenizer(string, reference_location));

    try {
      if (this.handleError) {
        await this.execute_with_recovery();
      } else {
        await this.run_with_tokenizer(
          this.tokenizer_stack[this.tokenizer_stack.length - 1],
        );
      }
    } finally {
      // Always balance the push, even when execution throws — otherwise a
      // failed run leaves a stale tokenizer on the stack and every later run
      // reports the wrong input string / nesting depth.
      this.tokenizer_stack.pop();
    }
    return true;
  }

  async execute_with_recovery(numAttempts: number = 0): Promise<number> {
    numAttempts++;
    // Check the attempt budget OUTSIDE the try. If this throws it must escape,
    // not be caught by our own handler and "recovered" — that would recurse
    // forever, because numAttempts only grows and the guard would re-trip on
    // every attempt.
    if (numAttempts > this.maxAttempts) {
      throw new TooManyAttemptsError(
        this.get_top_input_string(),
        numAttempts,
        this.maxAttempts,
      );
    }
    try {
      await this.continue();
      return numAttempts;
    } catch (e) {
      if (!this.handleError) throw e;
      // Never try to recover from the attempt-budget guard itself.
      if (e instanceof TooManyAttemptsError) throw e;
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
    // Collect word tokens first for batching optimization
    // We store tokens (not resolved Words) to defer word lookup until execution time.
    // This allows dynamically defined words (e.g., from LOAD) to be found.
    const wordTokens: Token[] = [];
    let token: Token;

    do {
      this.previous_token = token;
      token = tokenizer.next_token();

      // For word tokens, collect the token (defer word lookup until execution)
      if (token.type === TokenType.WORD && !this.is_compiling) {
        wordTokens.push(token);
      } else {
        // For non-word tokens, execute any collected words first, then handle the token
        if (wordTokens.length > 0) {
          await this.executeBatchedWordTokens(wordTokens);
          wordTokens.length = 0; // Clear the array
        }

        await this.handle_token(token);
      }

      if (token.type === TokenType.EOS) {
        // Execute any remaining words
        if (wordTokens.length > 0) {
          await this.executeBatchedWordTokens(wordTokens);
        }
        break;
      }
      // eslint-disable-next-line no-constant-condition
    } while (true);
    return true; // Done executing
  }

  /**
   * Execute a sequence of word tokens with deferred word lookup.
   * This resolves words at execution time (not parse time) to support
   * dynamically defined words (e.g., words defined by LOAD).
   *
   * Words are looked up and executed ONE AT A TIME to ensure that
   * words defined during execution (e.g., by LOAD) are available
   * for subsequent words in the same batch.
   */
  private async executeBatchedWordTokens(tokens: Token[]): Promise<void> {
    // Look up and execute each word one at a time
    // This ensures words defined during execution are available for later words
    for (const token of tokens) {
      const word = this.find_word(token.string, token.location);
      word.set_location(token.location);
      this.count_word(word);
      try {
        await word.execute(this);
      } catch (e) {
        // Don't wrap IntentionalStopError - it's a control-flow mechanism for debugging
        if (e instanceof IntentionalStopError) {
          throw e;
        }
        // Preserve subclass identity; fill in missing location/word from dispatch context.
        if (e instanceof ForthicError) {
          if (!e.location) e.location = token.location;
          if (!e.word) e.word = word.name;
          throw e;
        }
        // Wrap generic errors in WordExecutionError to add location context
        if (e instanceof Error) {
          throw new WordExecutionError(
            e.message,
            e,
            word.name,
            token.location,
            word.get_location() || undefined
          );
        }
        throw e;
      }
    }
  }

  cur_module(): Module {
    const result = this.module_stack[this.module_stack.length - 1];
    return result;
  }

  // --- Word-local variable frames ---
  push_local_frame(): void {
    // Prototype-less: word-local variable names come from program text.
    this.local_frames.push(Object.create(null));
  }

  pop_local_frame(): void {
    this.local_frames.pop();
  }

  cur_local_frame(): { [name: string]: Variable } | null {
    return this.local_frames.length > 0
      ? this.local_frames[this.local_frames.length - 1]
      : null;
  }

  // Module-scope lookup only (walks the module stack); used to decide whether a
  // write targets an existing module variable before falling back to a local.
  find_module_variable(name: string): Variable | null {
    for (let i = this.module_stack.length - 1; i >= 0; i--) {
      const m = this.module_stack[i];
      if (m.variables[name]) return m.variables[name];
    }
    return null;
  }

  // Read resolution: current word-local frame first, then module scope.
  find_variable(name: string): Variable | null {
    const frame = this.cur_local_frame();
    if (frame && frame[name]) return frame[name];
    return this.find_module_variable(name);
  }

  find_module(name: string): Module {
    const result = this.registered_modules[name];
    if (result === undefined) {
      // Location is filled in by the executeBatchedWordTokens catch site,
      // which has the correct dispatching token in scope.
      throw new UnknownModuleError(this.get_top_input_string(), name);
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
      // Location is filled in by the dispatch catch site, which has the
      // dispatching token in scope. Reading the tokenizer here would return
      // a stale token whose end_pos has collapsed to start_pos.
      throw new StackUnderflowError(this.get_top_input_string());
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
    // The app module is the floor of the module stack. Popping it (e.g. a bare
    // `}` with no matching open module) would empty the stack and leave
    // cur_module() undefined, breaking every subsequent word lookup. Refuse and
    // raise a clear error instead of silently corrupting the interpreter.
    if (this.module_stack.length <= 1) {
      throw new ModuleStackUnderflowError(
        this.get_top_input_string(),
        this.string_location,
      );
    }
    return this.module_stack.pop();
  }

  // Depth of the module stack (the app module is depth 1). Used by TRY to
  // unwind modules left open by failed code.
  module_stack_depth(): number {
    return this.module_stack.length;
  }

  register_module(module: Module) {
    this.registered_modules[module.name] = module;
    module.set_interp(this);
  }

  // If names is an array of strings, import each module without a prefix (empty string)
  // If names is an array of arrays, import each module using the first element as the
  // module name and the second element as the prefix
  use_modules(names: any[], options: Record<string, any> = {}) {
    const prefixed = options.prefixed ?? false;
    for (const name of names) {
      let module_name = name;
      let prefix = "";  // Default to empty prefix (no prefix)
      if (name instanceof Array) {
        module_name = name[0];
        prefix = name[1];  // Allow explicit prefix specification
      } else if (prefixed) {
        prefix = name;  // Use module name as its own prefix
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
      // Set source to module name when running module code
      const module_location = new CodeLocation({ source: module.name });
      await this.run(module.forthic_code, module_location);
    } catch (e) {
      throw new ModuleError(
        this.get_top_input_string(),
        module.name,
        e,
        this.string_location,
        e,
      );
    } finally {
      // Balance the push even on error, so a module whose code throws does not
      // stay on the module stack and shadow later word lookups.
      this.module_stack_pop();
    }
  }

  // ======================
  // Literal Handlers

  /**
   * Register standard literal handlers
   * Order matters: more specific handlers first
   */
  private register_standard_literals(): void {
    this.literal_handlers = [
      to_bool,                              // TRUE, FALSE
      to_float,                             // 3.14
      to_zoned_datetime(this.timezone),     // 2020-06-05T10:15:00Z
      to_literal_date(this.timezone),       // 2020-06-05, YYYY-MM-DD
      to_time,                              // 9:00, 11:30 PM
      to_int,                               // 42
    ];
  }

  /**
   * Register a custom literal handler
   * New handlers are added first so they can override existing ones
   */
  register_literal_handler(handler: LiteralHandler): void {
    this.literal_handlers.unshift(handler);
  }

  /**
   * Unregister a literal handler
   */
  unregister_literal_handler(handler: LiteralHandler): void {
    const index = this.literal_handlers.indexOf(handler);
    if (index > -1) {
      this.literal_handlers.splice(index, 1);
    }
  }

  /**
   * Try to parse string as a literal value
   * Returns PushValueWord if successful, null otherwise
   */
  find_literal_word(name: string): Word | null {
    for (const handler of this.literal_handlers) {
      const value = handler(name);
      if (value !== null) {
        return new PushValueWord(name, value);
      }
    }
    return null;
  }

  // ======================
  // Find Word

  find_word(name: string, location?: CodeLocation): Word {
    // 1. Check module stack (dictionary words + variables)
    let result = null;
    for (let i = this.module_stack.length - 1; i >= 0; i--) {
      const m = this.module_stack[i];
      result = m.find_word(name);
      if (result) break;
    }

    // 2. Check literal handlers as fallback
    if (!result) {
      result = this.find_literal_word(name);
    }

    // 3. Throw error if still not found
    if (!result) {
      throw new UnknownWordError(
        this.get_top_input_string(),
        name,
        location ?? this.get_tokenizer()?.get_token_location(),
      );
    }

    return result;
  }

  // ======================
  // Profiling
  start_profiling() {
    this.is_profiling = true;
    this.timestamps = [];
    this.start_profile_time = Date.now();
    this.add_timestamp("START");
    this.word_counts = Object.create(null);
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
      if (this.is_compiling) {
        throw new MissingSemicolonError(
          this.get_top_input_string(),
          this.previous_token?.location,
        );
      }
      return;
    } else {
      throw new UnknownTokenError(
        this.get_top_input_string(),
        token.string,
        token.location,
      );
    }
  }

  async handle_string_token(token: Token) {
    // A marked redirect string (`<<'''…'''`) routes its text into the StringRedirectSink
    // on top of the stack — stack effect ( sink -- sink string ). This is the single
    // chokepoint for completed string tokens, so it also covers the non-streaming
    // run() path: a marked string with no sink on top throws via
    // finish()->start()'s isStringRedirectSink check.
    if (token.is_string_redirect) {
      this.assertCanStringRedirect(token.location);
      await this.stringRedirectRouter.finish(token);
      return;
    }
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

    if (self.is_compiling) self.cur_definition.add_word(word, token.location);
    self.count_word(word); // For profiling
    await word.execute(self);
  }

  async handle_end_module_token(_token: Token) {
    const self = this;
    const word = new EndModuleWord();

    if (self.is_compiling) self.cur_definition.add_word(word, _token.location);
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
    // Record the position right after the definition name for source capture
    this.definition_start_input_pos = this.get_tokenizer().input_pos;
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
    // Record the position right after the memo name for source capture
    this.definition_start_input_pos = this.get_tokenizer().input_pos;
  }

  handle_end_definition_token(token: Token) {
    if (!this.is_compiling || !this.cur_definition) {
      throw new ExtraSemicolonError(
        this.get_top_input_string(),
        token.location,
      );
    }

    // Construct the source text for serialization
    const tokenizer = this.get_tokenizer();
    const body = tokenizer.input_string.substring(
      this.definition_start_input_pos,
      tokenizer.input_pos,
    );
    const prefix = this.is_memo_definition ? "@:" : ":";
    const source = `${prefix} ${this.cur_definition.name} ${body}`;
    this.cur_definition.source = source;

    if (this.is_memo_definition) {
      const memoWord = this.cur_module().add_memo_words(this.cur_definition);
      memoWord.source = source;
    } else {
      this.cur_module().add_word(this.cur_definition);
    }
    this.is_compiling = false;
    if (this.on_word_defined) this.on_word_defined(this.cur_definition.name);
  }

  async handle_word_token(token: Token) {
    const word = this.find_word(token.string); // Throws UnknownWordError if not found
    await this.handle_word(word, token.location);
  }

  async handle_word(word: Word, location: CodeLocation | null = null) {
    if (this.is_compiling) {
      // Record the call-site location on the definition, not on the shared word
      // object (which is reused across definitions and would race).
      this.cur_definition.add_word(word, location);
    } else {
      this.count_word(word);
      await word.execute(this);
    }
  }

  /**
   * Execute streaming Forthic code.
   *
   * Returns when the available tokens have been executed; it does not yield. A
   * marked redirect string (`<<'''…'''`) streams its generated text out through
   * its StringRedirectSink as it arrives — the caller drives that transport, not
   * a pulled generator. Callers therefore just `await` this; there is nothing to
   * drain to push execution forward.
   *
   * @param codeStream - The complete Forthic code from the start up to the current point.
   * @param done - When false, execute tokens up to (but not including) the last one (if more than one token exists).
   *               When true, execute the final token as well.
   */
  async streamingRun(
    codeStream: string,
    done: boolean,
    reference_location: CodeLocation | null = null,
  ): Promise<void> {
    // Create a new Tokenizer for the full string.
    const tokenizer = new Tokenizer(codeStream, reference_location, done ? false : true);
    const tokens: Token[] = [];
    let eosFound = false;
    let completedNormally = false;

    this.tokenizer_stack.push(tokenizer);

    try {
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

      // Cumulative content-so-far of the trailing open string (canonical,
      // escape-processed). The sink receives this value so the bytes it streams
      // match the completed string that finish() leaves on the stack; feed()
      // turns it into a delta by writing only the not-yet-sent suffix.
      const openStringContent = eosFound ? undefined : tokenizer.get_string_value();
      // Best-effort location for the trailing open string (informational only).
      const openStringLocation = tokenizer.get_token_location();

      let newStop = findLastWordOrEOS(tokens);

      if (eosFound && !done) {
        newStop--;
      }
      if (!eosFound && !done) {
        newStop++;
      }

      // Keep the resume pointer monotonic. findLastWordOrEOS only recognizes
      // WORD/EOS tokens, so a tail of array brackets + an open string (e.g.
      // `[ [ "…`) yields -1 and the nudge above collapses newStop toward 0 —
      // rewinding below tokens we already executed. Clamping to the high-water
      // mark means already-run tokens (e.g. START_ARRAY markers) are never
      // re-executed on the next pump.
      newStop = Math.max(newStop, this.streamingSession.tokenIndex);

      // Execute only tokens we have not executed previously. A completed marked
      // streaming string is routed into its sink inside handle_token (via
      // handle_string_token), so it needs no special case here.
      for (let i = this.streamingSession.tokenIndex; i < newStop; i++) {
        const token = tokens[i];
        if (!token) {
          continue;
        }

        await this.handle_token(token);
        this.previous_token = token;
      }

      // Feed the trailing open (still-generating) string into its sink when that
      // string is a marked redirect string (`<<'''…`). The tokenizer flag, not
      // stack state, decides this. Only one open string can exist at the tail.
      // feed() opens the sink stream lazily on the first delta.
      if (!eosFound && openStringContent && tokenizer.is_string_redirect()) {
        this.assertCanStringRedirect(openStringLocation);
        await this.stringRedirectRouter.feed(openStringContent, openStringLocation);
      }

      if (done) {
        // Turn complete. The execution loop stops before the EOS token (newStop
        // is the resume pointer, which lands on EOS on the final chunk), so
        // dispatch it now to run the same end-of-turn validation as
        // run_with_tokenizer — e.g. MissingSemicolonError for a definition left
        // open at end of input. Dispatch the token rather than re-checking
        // is_compiling here, so both paths share one source of truth. When the
        // turn is well-formed this is a no-op. If it throws, completedNormally
        // stays false and the finally below aborts any redirect and resets the
        // session before the error propagates.
        if (eosFound) {
          await this.handle_token(tokens[tokens.length - 1]);
        }
        // Turn complete: reset so the next turn starts fresh.
        this.resetStreamingSession();
      } else {
        // Advance the resume point for the next chunk of this turn.
        this.streamingSession.tokenIndex = newStop;
      }
      completedNormally = true;
    } finally {
      if (!completedNormally) {
        // A thrown error mid-turn: abandon any in-progress redirect and reset the
        // session so reusing this interpreter for a fresh streaming turn starts
        // from the top, not a stale resume point. The error then propagates out
        // of finally unchanged — no catch needed.
        await this.stringRedirectRouter.abort();
        this.resetStreamingSession();
      }
      // Done with this tokenizer
      this.tokenizer_stack.pop();
    }
  }

  /** Reset streamingRun's per-turn state so the next turn starts from the top. */
  private resetStreamingSession() {
    this.streamingSession = { tokenIndex: 0 };
  }

  /**
   * Guard against redirecting a marked string literal (`<<'''…'''`) inside a word
   * definition. v1 does not support this: a redirected string is fed and consumed
   * at execution time, which has no meaning while compiling a definition body.
   * Called before a marked string is routed to its sink (both the completed-token
   * path in handle_string_token and the open-string feed in streamingRun).
   */
  private assertCanStringRedirect(location: CodeLocation | null = null): void {
    if (this.is_compiling) {
      throw new StringRedirectError(
        this.get_top_input_string(),
        "Cannot redirect a string literal inside a definition",
        location ?? undefined,
      );
    }
  }

  /**
   * Abandon any in-progress redirect and end the streaming turn. Safe to call at
   * any time (a no-op when nothing is active). A caller invokes this if its
   * upstream source ends mid-string; resetting the session ensures the next
   * streamingRun turn starts from the top rather than a stale resume point.
   */
  async abortStreamingRun(_reason?: unknown) {
    await this.stringRedirectRouter.abort();
    this.resetStreamingSession();
  }
}

function findLastWordOrEOS(tokens: Token[]): number {
  return tokens.findLastIndex(
    (token) => token.type === TokenType.WORD || token.type === TokenType.EOS,
  );
}

// This interface exposes private fields needed for duplication
interface InterpreterInternal {
  app_module: Module;
  module_stack: Module[];
  stack: Stack;
  registered_modules: { [key: string]: Module };
  handleError?: HandleErrorFunction;
}

/**
 * Rebuild a target app_module so that its imported words are bound to the
 * TARGET-bound module clones, not the source. Replays the source app_module's
 * imports against `cloned`, then re-attaches the source's own top-level words
 * (user definitions) and variables.
 *
 * Known limitation: a pre-existing user definition whose BODY calls a stateful
 * decorated word (VARIABLES/!/@/RUN/...) keeps its source-bound internal word
 * references (they were resolved at definition time). Code that re-defines such
 * words on the dup (e.g. re-running a bootstrap) is unaffected, since the fresh
 * definition resolves against the dup. Re-resolving copied definition bodies is
 * a deeper follow-up.
 */
function rebuild_app_module(
  srcApp: Module,
  cloned: { [name: string]: Module },
  interp: Interpreter,
): Module {
  const app = new Module(srcApp.name);

  // Replay imports against the target-bound clones so app_module.words resolve
  // to clone-bound (target-bound) words.
  Object.entries(srcApp.module_prefixes).forEach(([module_name, prefixes]) => {
    const target_mod = cloned[module_name];
    if (!target_mod) return;
    prefixes.forEach((prefix) => {
      app.import_module(prefix, target_mod, interp);
    });
  });

  // Re-attach the app_module's own top-level words (user definitions) — those
  // whose names weren't contributed by the import replay. Appended last so they
  // shadow imports (find_dictionary_word scans backwards). Definition words are
  // safe to share by reference (they execute against the passed interp).
  const imported = new Set(app.words.map((w) => w.name));
  srcApp.words.forEach((w) => {
    if (!imported.has(w.name)) app.words.push(w);
  });

  Object.keys(srcApp.variables).forEach(
    (key) => (app.variables[key] = srcApp.variables[key].dup()),
  );
  app.forthic_code = srcApp.forthic_code;
  app.set_interp(interp);
  return app;
}

export function dup_interpreter(interp: Interpreter): Interpreter {
  const source = interp as unknown as InterpreterInternal;
  // Create new interpreter of the same type as the source
  const constructor = Object.getPrototypeOf(interp).constructor;
  const result_interp = new constructor([], interp.get_timezone());
  const target = result_interp as unknown as InterpreterInternal;

  // Clone every registered module, bound to the target interpreter. Cloning
  // (not sharing) is what makes the dup independent: a clone's stateful words
  // operate on the target, and the source is never mutated.
  const cloned: { [name: string]: Module } = Object.create(null);
  Object.entries(source.registered_modules).forEach(([name, mod]) => {
    cloned[name] = mod.clone(result_interp);
  });
  target.registered_modules = cloned;

  // Rebuild the app_module so its imported words come from the target-bound
  // clones rather than the source-bound originals.
  target.app_module = rebuild_app_module(
    source.app_module,
    cloned,
    result_interp,
  );
  target.module_stack = [target.app_module];

  // Use Stack.dup() method
  target.stack = source.stack.dup();

  // Copy error handler if present
  if (source.handleError) {
    target.handleError = source.handleError;
  }

  return result_interp;
}

/**
 * Serializable interpreter state for preserving variables, words, and stack
 * across interpreter instantiations (e.g., multiturn chat sessions).
 */
export interface InterpreterState {
  stack: StackValue[];
  variables: Record<string, StackValue>;
  word_definitions: string[];
}

/**
 * Export the app module state and stack from an interpreter as a serializable object.
 * The caller is responsible for persisting the returned state.
 */
export function export_state(interp: Interpreter): InterpreterState {
  const internal = interp as unknown as InterpreterInternal;

  // Serialize the stack (annotate path so errors point at the offending stack entry)
  const stack = serializeStack(internal.stack.get_items(), 'stack:');

  // Serialize variables
  const variables: Record<string, StackValue> = {};
  const appModule = internal.app_module;
  for (const [name, variable] of Object.entries(appModule.variables)) {
    variables[name] = serializeValue(variable.get_value(), `var:${pathSegmentForKey(name)}`);
  }

  // Collect source text from user-defined words
  const word_definitions: string[] = [];
  const seen = new Set<string>();
  for (const word of appModule.words) {
    if (word instanceof DefinitionWord && word.source) {
      // For DefinitionWords, use the source directly (avoids duplicates from memo bang variants)
      if (!seen.has(word.name)) {
        seen.add(word.name);
        word_definitions.push(word.source);
      }
    } else if (word instanceof ModuleMemoWord && word.source) {
      if (!seen.has(word.name)) {
        seen.add(word.name);
        word_definitions.push(word.source);
      }
    }
  }

  return { stack, variables, word_definitions };
}

/**
 * Import previously exported state into an interpreter.
 * Replays word definitions, restores variable values, and sets the stack.
 */
export async function import_state(interp: Interpreter, state: InterpreterState): Promise<void> {
  const internal = interp as unknown as InterpreterInternal;

  // 1. Replay word definitions (this may also create variables via VARIABLES word)
  for (const def of state.word_definitions) {
    await interp.run(def);
  }

  // 2. Restore variable values (overwriting any defaults from definitions)
  const appModule = internal.app_module;
  for (const [name, serializedValue] of Object.entries(state.variables)) {
    const value = deserializeValue(serializedValue);
    if (appModule.variables[name]) {
      appModule.variables[name].set_value(value);
    } else {
      appModule.add_variable(name, value);
    }
  }

  // 3. Restore the stack
  const stackItems = deserializeStack(state.stack);
  internal.stack.set_raw_items(stackItems);
}

/**
 * Interpreter - Full-featured interpreter with standard library
 *
 * Extends Interpreter and automatically imports standard modules:
 * - CoreModule: Stack operations, variables, module system, control flow
 * - ArrayModule: Array/collection operations
 * - RecordModule: Record/object operations
 * - StringModule: String operations
 * - MathModule: Mathematical operations
 * - BooleanModule: Boolean/comparison operations
 * - JsonModule: JSON parsing/serialization
 * - DateTimeModule: Date and time operations
 *
 * For most use cases, use this class. Use Interpreter if you need
 * full control over which modules are loaded.
 */
export class StandardInterpreter extends Interpreter {
  constructor(modules: Module[] = [], timezone: Temporal.TimeZoneLike = "UTC") {
    // Don't pass modules to super - we'll import them after stdlib
    super([], timezone);

    // Import standard library synchronously
    this.import_standard_library();

    // Import additional modules
    this.import_modules(modules);
  }

  private import_standard_library() {
    // Load standard library modules synchronously
    const stdlib = [
      new CoreModule(),
      new ArrayModule(),
      new RecordModule(),
      new StringModule(),
      new MathModule(),
      new BooleanModule(),
      new JsonModule(),
      new DateTimeModule(),
      new ClassicModule(),
    ];

    // Import unprefixed at the BOTTOM of module stack
    // This ensures they're checked LAST during find_word()
    for (const module of stdlib) {
      this.import_module(module, "");
    }
  }
}
