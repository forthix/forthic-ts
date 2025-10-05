import { Module } from "./module";
import { Interpreter } from "./interpreter";

export class GlobalModule extends Module {
  constructor(interp: Interpreter) {
    super("global", interp);
  }
}
