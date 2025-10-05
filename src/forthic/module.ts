import { Interpreter } from "./interpreter";

export type Word = (interp: Interpreter) => Promise<void>;

export class Module {
  name: string;
  modules: Record<string, Module>;

  constructor(name: string, interp?: Interpreter) {
    this.name = name;
    this.modules = {};
  }

  get_name(): string {
    return this.name;
  }

  add_module_word(name: string, word: Word): void {
    throw new Error("Not implemented");
  }

  find_word(name: string): Word | null {
    throw new Error("Not implemented");
  }

  get_interp(): Interpreter {
    throw new Error("Not implemented");
  }
}
