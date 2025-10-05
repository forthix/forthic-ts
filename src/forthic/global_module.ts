import { Module } from "./module";
import { StandardInterpreter } from "./interpreter";

export class GlobalModule extends Module {
  constructor(interp: StandardInterpreter) {
    super("global", interp);
  }
}
