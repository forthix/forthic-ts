import { Variable } from "../module.js";
import { Interpreter } from "../interpreter.js";
import { InvalidVariableNameError, IntentionalStopError } from "../errors.js";
import { DecoratedModule, Word, registerModuleDoc } from "../decorators/word.js";
import { WordOptions } from "../word_options.js";

export class CoreModule extends DecoratedModule {
  static {
    registerModuleDoc(CoreModule, `
Essential interpreter operations for stack manipulation, variables, control flow, and module system.

## Categories
- Stack: POP, DUP, SWAP
- Variables: VARIABLES, !, @, !@
- Module: EXPORT, USE_MODULES
- Execution: INTERPRET
- Control: IDENTITY, NOP, DEFAULT, *DEFAULT, NULL, ARRAY?
- Options: ~> (converts array to WordOptions)
- Profiling: PROFILE-START, PROFILE-TIMESTAMP, PROFILE-END, PROFILE-DATA
- Logging: START-LOG, END-LOG
- String: INTERPOLATE, PRINT
- Debug: PEEK!, STACK!

## Options
INTERPOLATE and PRINT support options via the ~> operator using syntax: [.option_name value ...] ~> WORD
- separator: String to use when joining array values (default: ", ")
- null_text: Text to display for null/undefined values (default: "null")
- json: Use JSON.stringify for all values (default: false)

## Examples
5 .count ! "Count: .count" PRINT
"Items: .items" [.separator " | "] ~> PRINT
[1 2 3] PRINT                           # Direct printing: 1, 2, 3
[1 2 3] [.separator " | "] ~> PRINT    # With options: 1 | 2 | 3
{"name" "Alice"} [.json TRUE] ~> PRINT  # JSON format: {"name":"Alice"}
"Hello .name" INTERPOLATE .greeting !
[1 2 3] DUP SWAP
`);
  }

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
  async ["PEEK!"]() {
    const stack = this.interp.get_stack().get_items();
    if (stack.length > 0) {
      console.log(stack[stack.length - 1]);
    } else {
      console.log("<STACK EMPTY>");
    }
    throw new IntentionalStopError("PEEK!");
  }

  @Word("( -- )", "Prints entire stack (reversed) and stops execution")
  async ["STACK!"]() {
    const stack = this.interp.get_stack().get_items().slice().reverse();
    console.log(JSON.stringify(stack, null, 2));
    throw new IntentionalStopError("STACK!");
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
  async USE_MODULES(names: string[]) {
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


  @Word("( -- )", "Starts logging interpreter stream", "START-LOG")
  async START_LOG() {
    this.interp.startStream();
  }

  @Word("( -- )", "Ends logging interpreter stream", "END-LOG")
  async END_LOG() {
    this.interp.endStream();
  }


  @Word("( string:string [options:WordOptions] -- result:string )", "Interpolate variables (.name) and return result string. Use \\. to escape literal dots.")
  async INTERPOLATE(string: string, options: Record<string, any>) {
    const separator = options.separator ?? ", ";
    const null_text = options.null_text ?? "null";
    const use_json = options.json ?? false;

    return this.interpolateString(string, separator, null_text, use_json);
  }

  @Word("( value:any [options:WordOptions] -- )", "Print value to stdout. Strings interpolate variables (.name). Non-strings formatted with options. Use \\. to escape literal dots in strings.")
  async PRINT(value: any, options: Record<string, any>) {
    const separator = options.separator ?? ", ";
    const null_text = options.null_text ?? "null";
    const use_json = options.json ?? false;

    let result: string;
    if (typeof value === 'string') {
      // String: interpolate variables
      result = this.interpolateString(value, separator, null_text, use_json);
    } else {
      // Non-string: format directly
      result = this.valueToString(value, separator, null_text, use_json);
    }
    console.log(result);
  }

  private interpolateString(string: string, separator: string, null_text: string, use_json: boolean): string {
    if (!string) string = "";

    // First, handle escape sequences by replacing \. with a temporary placeholder
    const escaped = string.replace(/\\\./g, '\x00ESCAPED_DOT\x00');

    // Replace whitespace-preceded or start-of-string .variable patterns
    const interpolated = escaped.replace(
      /(?:^|(?<=\s))\.([a-zA-Z_][a-zA-Z0-9_-]*)/g,
      (match, varName) => {
        const variable = CoreModule.get_or_create_variable(this.interp, varName);
        const value = variable.get_value();
        return this.valueToString(value, separator, null_text, use_json);
      }
    );

    // Restore escaped dots
    return interpolated.replace(/\x00ESCAPED_DOT\x00/g, '.');
  }

  private valueToString(value: any, separator: string, null_text: string, use_json: boolean): string {
    if (value === null || value === undefined) return null_text;
    if (use_json) return JSON.stringify(value);
    if (Array.isArray(value)) return value.join(separator);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
