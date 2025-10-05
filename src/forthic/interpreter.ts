import { Module } from "./module";
import { PositionedString } from "./tokenizer";

export class Stack extends Array<any> {
  constructor(items: any[] = []) {
    super(...items);
  }

  get_raw_items(): any[] {
    return [...this];
  }

  get_items(): any[] {
    return this.map(item => {
      if (item instanceof PositionedString) {
        return item.value;
      }
      return item;
    });
  }
}

export class Interpreter {
  app_module: Module;
  module_stack: Module[];

  constructor(modules: Module[] = [], timezone?: string) {
    throw new Error("Not implemented");
  }

  async run(code: string): Promise<void> {
    throw new Error("Not implemented");
  }

  stack_push(value: any): void {
    throw new Error("Not implemented");
  }

  stack_pop(): any {
    throw new Error("Not implemented");
  }

  cur_module(): Module {
    throw new Error("Not implemented");
  }

  register_module(module: Module): void {
    throw new Error("Not implemented");
  }

  use_modules(modules: (string | [string, string])[]): void {
    throw new Error("Not implemented");
  }

  import_module(module: Module, prefix?: string): void {
    throw new Error("Not implemented");
  }
}
