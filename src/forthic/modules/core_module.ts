import { Variable } from "../module";
import { Interpreter } from "../interpreter";
import { InvalidVariableNameError, IntentionalStopError } from "../errors";
import { DecoratedModule, Word } from "../decorators/word";
import { WordOptions } from "../word_options";

/**
 * CoreModule - Essential interpreter operations
 *
 * Categories:
 * - Stack operations: POP, DUP, SWAP
 * - Variables: VARIABLES, !, @, !@
 * - Module system: EXPORT, USE-MODULES
 * - Execution: INTERPRET
 * - Control: IDENTITY, NOP, DEFAULT, *DEFAULT, NULL
 * - Options: ~> (converts array to WordOptions)
 * - Profiling: PROFILE-START, PROFILE-TIMESTAMP, PROFILE-END, PROFILE-DATA
 * - Logging: START_LOG, END_LOG, CONSOLE.LOG
 * - Utility: .s, .S
 */
export class CoreModule extends DecoratedModule {
  constructor() {
    super("core");
  }


  private static get_or_create_variable(interp: Interpreter, name: string): Variable {
    // Validate variable name - no __ prefix allowed
    if (name.match(/__.*/)) {
      throw new InvalidVariableNameError(
        interp.get_top_input_string(),
        name,
        interp.get_string_location(),
      );
    }

    const cur_module = interp.cur_module();

    // Check if variable already exists
    let variable = cur_module.variables[name];

    // Create it if it doesn't exist
    if (!variable) {
      cur_module.add_variable(name);
      variable = cur_module.variables[name];
    }

    return variable;
  }


  @Word("( a:any -- )", "Removes top item from stack")
  async POP(a: any) {
    // No return = push nothing
  }

  @Word("( a:any -- a:any a:any )", "Duplicates top stack item")
  async DUP(a: any) {
    this.interp.stack_push(a);
    this.interp.stack_push(a);
  }

  @Word("( a:any b:any -- b:any a:any )", "Swaps top two stack items")
  async SWAP(a: any, b: any) {
    this.interp.stack_push(b);
    this.interp.stack_push(a);
  }

  @Word("( -- )", "Prints top of stack and stops execution")
  async [".s"]() {
    const stack = this.interp.get_stack().get_items();
    if (stack.length > 0) {
      console.log(stack[stack.length - 1]);
    } else {
      console.log("<STACK EMPTY>");
    }
    throw new IntentionalStopError(".s");
  }

  @Word("( -- )", "Prints entire stack (reversed) and stops execution")
  async [".S"]() {
    const stack = this.interp.get_stack().get_items().slice().reverse();
    console.log(JSON.stringify(stack, null, 2));
    throw new IntentionalStopError(".S");
  }


  @Word("( varnames:string[] -- )", "Creates variables in current module")
  async VARIABLES(varnames: string[]) {
    const module = this.interp.cur_module();
    varnames.forEach((v: string) => {
      if (v.match(/__.*/)) {
        throw new InvalidVariableNameError(
          this.interp.get_top_input_string(),
          v,
          this.interp.get_string_location(),
        );
      }
      module.add_variable(v);
    });
  }

  @Word("( value:any variable:any -- )", "Sets variable value (auto-creates if string name)")
  async ["!"](value: any, variable: any) {
    let var_obj: Variable;
    if (typeof variable === 'string') {
      var_obj = CoreModule.get_or_create_variable(this.interp, variable);
    } else {
      var_obj = variable;
    }
    var_obj.set_value(value);
  }

  @Word("( variable:any -- value:any )", "Gets variable value (auto-creates if string name)")
  async ["@"](variable: any) {
    let var_obj: Variable;
    if (typeof variable === 'string') {
      var_obj = CoreModule.get_or_create_variable(this.interp, variable);
    } else {
      var_obj = variable;
    }
    return var_obj.get_value();
  }

  @Word("( value:any variable:any -- value:any )", "Sets variable and returns value")
  async ["!@"](value: any, variable: any) {
    let var_obj: Variable;
    if (typeof variable === 'string') {
      var_obj = CoreModule.get_or_create_variable(this.interp, variable);
    } else {
      var_obj = variable;
    }
    var_obj.set_value(value);
    return var_obj.get_value();
  }


  @Word("( string:string -- )", "Interprets Forthic string in current context")
  async INTERPRET(string: string) {
    const string_location = this.interp.get_string_location();
    if (string) await this.interp.run(string, string_location);
  }

  @Word("( names:string[] -- )", "Exports words from current module")
  async EXPORT(names: string[]) {
    this.interp.cur_module().add_exportable(names);
  }

  @Word("( names:string[] -- )", "Imports modules by name")
  async ["USE-MODULES"](names: string[]) {
    if (!names) return;
    this.interp.use_modules(names);
  }


  @Word("( -- )", "Does nothing (identity operation)")
  async IDENTITY() {
    // No-op
  }

  @Word("( -- )", "Does nothing (no operation)")
  async NOP() {
    // No-op
  }

  @Word("( -- null:null )", "Pushes null onto stack")
  async NULL() {
    return null;
  }

  @Word("( value:any -- boolean:boolean )", "Returns true if value is an array")
  async ["ARRAY?"](value: any) {
    return value instanceof Array;
  }

  @Word("( value:any default_value:any -- result:any )", "Returns value or default if value is null/undefined/empty string")
  async DEFAULT(value: any, default_value: any) {
    if (value === undefined || value === null || value === "") {
      return default_value;
    }
    return value;
  }

  @Word("( value:any default_forthic:string -- result:any )", "Returns value or executes Forthic if value is null/undefined/empty string")
  async ["*DEFAULT"](value: any, default_forthic: string) {
    if (value === undefined || value === null || value === "") {
      const string_location = this.interp.get_string_location();
      await this.interp.run(default_forthic, string_location);
      return this.interp.stack_pop();
    }
    return value;
  }


  @Word("( array:any[] -- options:WordOptions )", "Convert options array to WordOptions. Format: [.key1 val1 .key2 val2]")
  async ["~>"](array: any[]) {
    return new WordOptions(array);
  }


  @Word("( -- )", "Starts profiling word execution")
  async ["PROFILE-START"]() {
    this.interp.start_profiling();
  }

  @Word("( -- )", "Stops profiling word execution")
  async ["PROFILE-END"]() {
    this.interp.stop_profiling();
  }

  @Word("( label:string -- )", "Records profiling timestamp with label")
  async ["PROFILE-TIMESTAMP"](label: string) {
    this.interp.add_timestamp(label);
  }

  @Word("( -- profile_data:object )", "Returns profiling data (word counts and timestamps)")
  async ["PROFILE-DATA"]() {
    const histogram = this.interp.word_histogram();
    const timestamps = this.interp.profile_timestamps();

    const result: { word_counts: any[]; timestamps: any[] } = {
      word_counts: [],
      timestamps: [],
    };

    histogram.forEach((val) => {
      const rec = { word: val["word"], count: val["count"] };
      result["word_counts"].push(rec);
    });

    let prev_time = 0.0;
    timestamps.forEach((t) => {
      const rec = {
        label: t["label"],
        time_ms: t["time_ms"],
        delta: t["time_ms"] - prev_time,
      };
      prev_time = t["time_ms"];
      result["timestamps"].push(rec);
    });

    return result;
  }


  @Word("( -- )", "Starts logging interpreter stream")
  async START_LOG() {
    this.interp.startStream();
  }

  @Word("( -- )", "Ends logging interpreter stream")
  async END_LOG() {
    this.interp.endStream();
  }

  @Word("( object:any -- object:any )", "Logs object to console and returns it")
  async ["CONSOLE.LOG"](object: any) {
    console.log(object);
    return object;
  }
}
