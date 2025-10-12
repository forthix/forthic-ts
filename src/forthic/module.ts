import { Interpreter } from "./interpreter";
import { CodeLocation } from "./tokenizer";
import { WordExecutionError } from "./errors";

export type WordHandler =
  | ((interp: Interpreter) => Promise<void>)
  | ((interp: Interpreter) => void);

// -------------------------------------
// Variable
/**
 * Variable - Named mutable value container
 *
 * Represents a variable that can store and retrieve values within a module scope.
 * Variables are accessed by name and can be set to any value type.
 */
export class Variable {
  name: string;
  value: any;

  constructor(name: string, value: any = null) {
    this.name = name;
    this.value = value;
  }

  get_name(): string {
    return this.name;
  }

  set_value(val: any): void {
    this.value = val;
  }

  get_value(): any {
    return this.value;
  }

  dup(): Variable {
    return new Variable(this.name, this.value);
  }
}

// -------------------------------------
// Words

/**
 * Word - Base class for all executable words in Forthic
 *
 * A word is the fundamental unit of execution in Forthic. When interpreted,
 * it performs an action (typically manipulating the stack or control flow).
 * All concrete word types must override the execute method.
 */
export class Word {
  name: string;
  string: string;
  location: CodeLocation | null;

  constructor(name: string) {
    this.name = name;
    this.string = name;
    this.location = null;
  }

  set_location(location: CodeLocation | null): void {
    this.location = location;
  }

  get_location(): CodeLocation | null {
    return this.location;
  }

  async execute(_interp: Interpreter): Promise<void> {
    throw new Error("Must override Word.execute");
  }
}

/**
 * PushValueWord - Word that pushes a value onto the stack
 *
 * Executes by pushing its stored value onto the interpreter's stack.
 * Used for literals, variables, and constants.
 */
export class PushValueWord extends Word {
  value: any;

  constructor(name: string, value: any) {
    super(name);
    this.value = value;
  }

  async execute(interp: Interpreter): Promise<void> {
    interp.stack_push(this.value);
  }
}

/**
 * DefinitionWord - User-defined word composed of other words
 *
 * Represents a word defined in Forthic code using `:`
 * Contains a sequence of words that are executed in order.
 * Provides error context by tracking both call site and definition location.
 */
export class DefinitionWord extends Word {
  words: Word[];

  constructor(name: string) {
    super(name);
    this.words = [];
  }

  add_word(word: Word): void {
    this.words.push(word);
  }

  async execute(interp: Interpreter): Promise<void> {
    for (let i = 0; i < this.words.length; i++) {
      const word = this.words[i];
      try {
        await word.execute(interp);
      } catch (e) {
        const tokenizer = interp.get_tokenizer();
        throw new WordExecutionError(
          `Error executing ${this.name}`,
          e as Error,
          tokenizer.get_token_location(),  // Where the word was called
          word.get_location() || undefined,  // Where the word was defined
        );
      }
    }
  }
}

/**
 * ModuleMemoWord - Memoized word that caches its result
 *
 * Executes the wrapped word once and caches the result on the stack.
 * Subsequent calls return the cached value without re-executing.
 * Defined in Forthic using `@:`. Can be refreshed using the `!` and `!@` variants.
 */
export class ModuleMemoWord extends Word {
  word: Word;
  has_value: boolean;
  value: any;

  constructor(word: Word) {
    super(word.name);
    this.word = word;
    this.has_value = false;
    this.value = null;
  }

  async refresh(interp: Interpreter): Promise<void> {
    await this.word.execute(interp);
    this.value = interp.stack_pop();
    this.has_value = true;
  }

  async execute(interp: Interpreter): Promise<void> {
    if (!this.has_value) await this.refresh(interp);
    interp.stack_push(this.value);
  }
}

/**
 * ModuleMemoBangWord - Forces refresh of a memoized word
 *
 * Re-executes the memoized word and updates its cached value.
 * Named with a `!` suffix (e.g., `WORD!` for a memo word named `WORD`).
 * Does not push the new value onto the stack.
 */
export class ModuleMemoBangWord extends Word {
  memo_word: ModuleMemoWord;

  constructor(memo_word: ModuleMemoWord) {
    super(`${memo_word.name}!`);
    this.memo_word = memo_word;
  }

  async execute(interp: Interpreter): Promise<void> {
    await this.memo_word.refresh(interp);
  }
}

/**
 * ModuleMemoBangAtWord - Refreshes a memoized word and returns its value
 *
 * Re-executes the memoized word, updates its cached value, and pushes the new value onto the stack.
 * Named with a `!@` suffix (e.g., `WORD!@` for a memo word named `WORD`).
 * Combines the refresh and retrieval operations.
 */
export class ModuleMemoBangAtWord extends Word {
  memo_word: ModuleMemoWord;

  constructor(memo_word: ModuleMemoWord) {
    super(`${memo_word.name}!@`);
    this.memo_word = memo_word;
  }

  async execute(interp: Interpreter): Promise<void> {
    await this.memo_word.refresh(interp);
    interp.stack_push(this.memo_word.value);
  }
}

/**
 * ExecuteWord - Wrapper word that executes another word
 *
 * Delegates execution to a target word. Used for prefixed module imports
 * to create words like `prefix.word` that execute the original word from the imported module.
 */
export class ExecuteWord extends Word {
  target_word: Word;

  constructor(name: string, target_word: Word) {
    super(name);
    this.target_word = target_word;
  }

  async execute(interp: Interpreter): Promise<void> {
    await this.target_word.execute(interp);
  }
}

// -------------------------------------
// Module

/**
 * Module - Container for words, variables, and imported modules
 *
 * Modules provide namespacing and code organization in Forthic.
 * Each module maintains its own dictionary of words, variables, and imported modules.
 *
 * Features:
 * - Word and variable management
 * - Module importing with optional prefixes
 * - Exportable word lists for controlled visibility
 * - Module duplication and copying for isolated execution contexts
 *
 * Modules can be defined inline with `{module_name ... }` syntax or
 * loaded from external sources.
 */
export class Module {
  words: Word[];
  exportable: string[];
  variables: { [key: string]: Variable };
  modules: { [key: string]: Module };
  module_prefixes: { [key: string]: Set<string> };
  name: string;
  forthic_code: string;
  interp: Interpreter | null;

  constructor(name: string, forthic_code: string = "") {
    this.words = [];
    this.exportable = [];
    this.variables = {};
    this.modules = {};
    this.module_prefixes = {};
    this.name = name;
    this.forthic_code = forthic_code;
    this.interp = null;
  }

  get_name(): string {
    return this.name;
  }

  set_interp(interp: Interpreter): void {
    this.interp = interp;
  }

  get_interp(): Interpreter {
    if (!this.interp) {
      throw new Error(`Module ${this.name} has no interpreter`);
    }
    return this.interp;
  }

  // Duplication methods
  dup(): Module {
    const result = new Module(this.name);
    result.words = this.words.slice();
    result.exportable = this.exportable.slice();
    Object.keys(this.variables).forEach(
      (key) => (result.variables[key] = this.variables[key].dup()),
    );
    Object.keys(this.modules).forEach(
      (key) => (result.modules[key] = this.modules[key]),
    );
    result.forthic_code = this.forthic_code;
    return result;
  }

  copy(interp: Interpreter): Module {
    const result = new Module(this.name);
    result.words = this.words.slice();
    result.exportable = this.exportable.slice();
    Object.keys(this.variables).forEach(
      (key) => (result.variables[key] = this.variables[key].dup()),
    );
    Object.keys(this.modules).forEach(
      (key) => (result.modules[key] = this.modules[key]),
    );

    // Restore module_prefixes
    Object.entries(this.module_prefixes).forEach(([module_name, prefixes]) => {
      prefixes.forEach((prefix) => {
        result.import_module(prefix, this.modules[module_name], interp);
      });
    });

    result.forthic_code = this.forthic_code;
    return result;
  }

  // Module management
  find_module(name: string): Module | undefined {
    return this.modules[name];
  }

  register_module(module_name: string, prefix: string, module: Module): void {
    this.modules[module_name] = module;

    if (!this.module_prefixes[module_name]) {
      this.module_prefixes[module_name] = new Set();
    }
    this.module_prefixes[module_name].add(prefix);
  }

  import_module(prefix: string, module: Module, _interp: Interpreter): void {
    const new_module = module.dup();

    const words = new_module.exportable_words();
    words.forEach((word) => {
      // For unprefixed imports, add word directly
      if (prefix === "") {
        this.add_word(word);
      } else {
        // For prefixed imports, create word that executes the target word
        const prefixed_word = new ExecuteWord(`${prefix}.${word.name}`, word);
        this.add_word(prefixed_word);
      }
    });
    this.register_module(module.name, prefix, new_module);
  }

  // Word management
  add_word(word: Word): void {
    this.words.push(word);
  }

  add_memo_words(word: Word): ModuleMemoWord {
    const memo_word = new ModuleMemoWord(word);
    this.words.push(memo_word);
    this.words.push(new ModuleMemoBangWord(memo_word));
    this.words.push(new ModuleMemoBangAtWord(memo_word));
    return memo_word;
  }

  add_exportable(names: string[]): void {
    this.exportable = this.exportable.concat(names);
  }

  add_exportable_word(word: Word): void {
    this.words.push(word);
    this.exportable.push(word.name);
  }

  add_module_word(word_name: string, word_func: (interp: Interpreter) => Promise<void>): void {
    const word = new Word(word_name);
    word.execute = word_func;
    this.add_exportable_word(word);
  }

  exportable_words(): Word[] {
    const result: Word[] = [];
    this.words.forEach((word) => {
      if (this.exportable.indexOf(word.name) >= 0) {
        result.push(word);
      }
    });
    return result;
  }

  find_word(name: string): Word | null {
    let result = this.find_dictionary_word(name);
    if (!result) {
      result = this.find_variable(name);
    }
    return result;
  }

  find_dictionary_word(word_name: string): Word | null {
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      if (w.name === word_name) {
        return w;
      }
    }
    return null;
  }

  find_variable(varname: string): PushValueWord | null {
    const var_result = this.variables[varname];
    if (var_result) {
      return new PushValueWord(varname, var_result);
    }
    return null;
  }

  // Variable management
  add_variable(name: string, value: any = null): void {
    if (!this.variables[name]) {
      this.variables[name] = new Variable(name, value);
    }
  }
}
