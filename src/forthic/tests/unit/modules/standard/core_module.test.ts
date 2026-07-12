import { StandardInterpreter } from "../../../../interpreter";
import {
  InvalidVariableNameError,
  UnknownVariableError,
  WordExecutionError,
} from "../../../../errors";
import { CoreModule } from "../../../../modules/standard/core_module";
import { WordOptions } from "../../../../word_options";

let interp: StandardInterpreter;
let interp_any: any;

beforeEach(async () => {
  const core = new CoreModule();
  interp = new StandardInterpreter([core], "America/Los_Angeles");
  interp_any = interp as any;
});

// ========================================
// Variables
// ========================================

test("Variables", async () => {
  await interp.run("['x' 'y']  VARIABLES");
  const variables = (interp as any).app_module.variables;
  expect(variables["x"]).not.toBeNull();
  expect(variables["y"]).not.toBeNull();
});

test("Invalid variable name", async () => {
  await expect(interp.run("['__test'] VARIABLES")).rejects.toThrow(InvalidVariableNameError);
});

test("Set and get variables", async () => {
  await interp.run("['x']  VARIABLES");
  await interp.run("24 x !");
  const x_var = (interp as any).app_module.variables["x"];
  expect(x_var.get_value()).toBe(24);
  await interp.run("x @");
  expect(interp.stack_pop()).toBe(24);
});

test("Bang at (!@)", async () => {
  await interp.run("['x']  VARIABLES");
  await interp.run("24 x !@");
  const x_var = (interp as any).app_module.variables["x"];
  expect(x_var.get_value()).toBe(24);
  expect(interp.stack_pop()).toBe(24);
});

test("String-name ! auto-creates variable", async () => {
  // ! with string variable name auto-creates the variable
  await interp.run('"hello" "autovar1" !');
  await interp.run("autovar1 @");
  expect(interp.stack_pop()).toBe("hello");

  // Verify variable was created in app module
  const autovar1 = (interp as any).app_module.variables["autovar1"];
  expect(autovar1).toBeDefined();
  expect(autovar1.get_value()).toBe("hello");

  // Test !@ with string variable name (auto-creates and returns value)
  await interp.run('"world" "autovar3" !@');
  expect(interp.stack_pop()).toBe("world");

  // Verify variable was created with correct value
  const autovar3 = (interp as any).app_module.variables["autovar3"];
  expect(autovar3).toBeDefined();
  expect(autovar3.get_value()).toBe("world");

  // Test that existing variables still work with strings
  await interp.run('"updated" "autovar1" !');
  await interp.run('"autovar1" @');
  expect(interp.stack_pop()).toBe("updated");
});

test("@ on undeclared variable (string name) throws UnknownVariableError", async () => {
  let caught: any = null;
  try {
    await interp.run('"never_declared" @');
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(UnknownVariableError);
  expect(caught.getVarname()).toBe("never_declared");

  // The variable should NOT have been auto-created as a side effect.
  expect(
    (interp as any).app_module.variables["never_declared"],
  ).toBeUndefined();
});

test("@ on undeclared dot-symbol throws UnknownVariableError", async () => {
  // Real-world repro: .extracted_content @ pushes the string "extracted_content"
  // via the dot-symbol path, then @ should throw.
  let caught: any = null;
  try {
    await interp.run(".extracted_content @");
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(UnknownVariableError);
  expect(caught.getVarname()).toBe("extracted_content");
});

test("@ on declared-but-unset variable returns null (does not throw)", async () => {
  // Declared via VARIABLES but never set: reading is allowed, value is null.
  // Only *undeclared* access throws; uninitialized is fine.
  await interp.run("['declared_unset'] VARIABLES");
  await interp.run('"declared_unset" @');
  expect(interp.stack_pop()).toBe(null);
});

test("Auto-create variables validation", async () => {
  // Test that __ prefix variables are rejected
  expect(async () => {
    await interp.run('"value" "__invalid" !');
  }).rejects.toThrow();

  // Test that validation works for @ as well
  expect(async () => {
    await interp.run('"__invalid2" @');
  }).rejects.toThrow();

  // Test that validation works for !@ as well
  expect(async () => {
    await interp.run('"value" "__invalid3" !@');
  }).rejects.toThrow();
});

// ========================================
// Module System
// ========================================

test("Interpret", async () => {
  await interp.run("'24' INTERPRET");
  expect(interp.stack_pop()).toBe(24);

  await interp.run(`'{module-A  : MESSAGE   "Hi" ;}' INTERPRET`);
  await interp.run("{module-A MESSAGE}");
  expect(interp.stack_pop()).toBe("Hi");
});

// ========================================
// Stack Operations
// ========================================

test("DROP", async () => {
  await interp.run(`
    1 2 3 4 5 DROP
  `);
  const stack = interp.get_stack().get_items();
  expect(stack.length).toBe(4);
  expect(stack[stack.length - 1]).toBe(4);
});

test("DUP", async () => {
  await interp.run(`
    5 DUP
  `);
  const stack = interp.get_stack().get_items();
  expect(stack.length).toBe(2);
  expect(stack[0]).toBe(5);
  expect(stack[1]).toBe(5);
});

test("SWAP", async () => {
  await interp.run(`
    6 8 SWAP
  `);
  const stack = interp.get_stack().get_items();
  expect(stack.length).toBe(2);
  expect(stack[0]).toBe(8);
  expect(stack[1]).toBe(6);
});

// ========================================
// Control
// ========================================

test("DEFAULT", async () => {
  await interp.run(`
    NULL 22.4 DEFAULT
    0 22.4 DEFAULT
    "" "Howdy" DEFAULT
  `);
  const stack = interp.get_stack().get_items();
  expect(stack[0]).toBe(22.4);
  expect(stack[1]).toBe(0);
  expect(stack[2]).toBe("Howdy");
});

// TODO: Re-enable when math module is implemented
// test("*DEFAULT", async () => {
//   await interp.run(`
//     NULL "3.1 5 +" *DEFAULT
//     0 "22.4" *DEFAULT
//     "" "['Howdy, ' 'Everyone!'] CONCAT" *DEFAULT
//   `);
//   const stack = interp.get_stack().get_items();
//   expect(stack[0]).toBeCloseTo(8.1);
//   expect(stack[1]).toBe(0);
//   expect(stack[2]).toBe("Howdy, Everyone!");
// });

test("NULL", async () => {
  await interp.run(`NULL`);
  expect(interp.stack_pop()).toBeNull();
});

test("UNDEFINED", async () => {
  await interp.run(`UNDEFINED`);
  expect(interp.stack_pop()).toBeUndefined();
});

test("IDENTITY", async () => {
  await interp.run(`42 IDENTITY`);
  expect(interp.stack_pop()).toBe(42);
});

test("NOP", async () => {
  await interp.run(`42 NOP`);
  expect(interp.stack_pop()).toBe(42);
});

// ========================================
// Profiling
// ========================================

// TODO: Re-enable when control module is implemented
// test("PROFILING", async () => {
//   await interp.run(`
//     PROFILE-START
//     [1 "1 +" 6 <REPEAT]
//     PROFILE-END POP
//     PROFILE-DATA
//   `);
//   const stack = interp.get_stack().get_items();
//   const profile_data = stack[stack.length - 1];
//   expect(profile_data["word_counts"][0]["word"]).toBe("1");
//   expect(profile_data["word_counts"][0]["count"]).toBe(7);
// });


// ========================================
// Options
// ========================================

test("~> creates WordOptions from array", async () => {
  await interp.run(`[.depth 2 .with_key TRUE] ~>`);
  const opts = interp.stack_pop();
  expect(opts).toBeInstanceOf(WordOptions);
  expect(opts.get("depth")).toBe(2);
  expect(opts.get("with_key")).toBe(true);
});

test("~> validates even number of elements", async () => {
  await expect(interp.run(`[.depth 2 .with_key] ~>`)).rejects.toThrow("even length");
});

test("~> validates string keys", async () => {
  await expect(interp.run(`[123 2] ~>`)).rejects.toThrow("must be a string");
});

test("~> handles empty array", async () => {
  await interp.run(`[] ~>`);
  const opts = interp.stack_pop();
  expect(opts).toBeInstanceOf(WordOptions);
  expect(opts.keys()).toEqual([]);
});

test("~> handles multiple options", async () => {
  await interp.run(`[.depth 3 .with_key TRUE .reverse FALSE] ~>`);
  const opts = interp.stack_pop();
  expect(opts.get("depth")).toBe(3);
  expect(opts.get("with_key")).toBe(true);
  expect(opts.get("reverse")).toBe(false);
});

// ========================================
// INTERPOLATE (${name} holes — names only, never expressions)
// ========================================

test("INTERPOLATE - basic interpolation", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"Count: \${count}" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Count: 5");
});

test("INTERPOLATE - dot-symbol spelling and body whitespace", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"\${.count} = \${ count }" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("5 = 5");
});

test("INTERPOLATE - returns string without printing", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`3 .number !`);
  await interp.run(`"Number: \${number}" INTERPOLATE`);

  // Should not have printed
  expect(consoleSpy).not.toHaveBeenCalled();

  // Should have returned string
  const result = interp.stack_pop();
  expect(result).toBe("Number: 3");

  consoleSpy.mockRestore();
});

test("INTERPOLATE - multiple variables in one string", async () => {
  await interp.run(`3 .number !`);
  await interp.run(`["apple" "banana"] .queue !`);
  await interp.run(`"There are \${number} items: \${queue}" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("There are 3 items: apple, banana");
});

test("INTERPOLATE - lookup is read-only; miss renders as null_text default ''", async () => {
  await interp.run(`"[\${nope}]" INTERPOLATE`);
  expect(interp.stack_pop()).toBe("[]");

  // ...and the miss created NOTHING (unlike @'s get-or-create)
  expect(interp.find_variable("nope")).toBeNull();
});

test("INTERPOLATE - custom null_text option", async () => {
  await interp.run(`"Missing: \${missing}" [.null_text "N/A"] ~> INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Missing: N/A");
});

test("INTERPOLATE - holes are names, not expressions", async () => {
  await expect(interp.run(`"\${1 + 2}" INTERPOLATE`)).rejects.toThrow(/not expressions/);
  await expect(interp.run(`"\${x:-default}" INTERPOLATE`)).rejects.toThrow(/not expressions/);
  await expect(interp.run(`"\${}" INTERPOLATE`)).rejects.toThrow(/not expressions/);
});

test("INTERPOLATE - __ hole names are reserved like ! and @", async () => {
  await expect(interp.run(`"\${__secret}" INTERPOLATE`)).rejects.toThrow(/__secret/);
});

test("INTERPOLATE - escaped holes stay literal", async () => {
  await interp.run(`7 .x !`);
  await interp.run(`"\\\${x} = \${x}" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("\${x} = 7");
});

test("INTERPOLATE - bare dots, braces, and dollars are literal text", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"file.count {count} $count .count" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("file.count {count} $count .count");
});

test("INTERPOLATE - null template stays null", async () => {
  await interp.run(`NULL INTERPOLATE`);
  expect(interp.stack_pop()).toBeNull();
});

test("INTERPOLATE - can be stored in variable", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"Count: \${count}" INTERPOLATE .message !`);
  await interp.run(`.message @`);

  const result = interp.stack_pop();
  expect(result).toBe("Count: 5");
});

test("INTERPOLATE - can be used with string operations", async () => {
  await interp.run(`"hello" .word !`);
  await interp.run(`"Say \${word}" INTERPOLATE UPPERCASE`);

  const result = interp.stack_pop();
  expect(result).toBe("SAY HELLO");
});

test("INTERPOLATE - array with custom separator option", async () => {
  await interp.run(`["apple" "banana" "cherry"] .items !`);
  await interp.run(`"Items: \${items}" [.separator " | "] ~> INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Items: apple | banana | cherry");
});

test("INTERPOLATE - json option", async () => {
  await interp.run(`["apple" "banana"] .items !`);
  await interp.run(`"Items: \${items}" [.json TRUE] ~> INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe('Items: ["apple","banana"]');
});

test("INTERPOLATE - record hole renders as JSON", async () => {
  await interp.run(`[["a" 1]] REC .rec !`);
  await interp.run(`"rec: \${rec}" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe('rec: {"a":1}');
});

test("INTERPOLATE - chaining multiple interpolations", async () => {
  await interp.run(`"world" .name !`);
  await interp.run(`"Hello \${name}" INTERPOLATE .greeting !`);
  await interp.run(`"Message: \${greeting}" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Message: Hello world");
});

// ========================================
// PRINT (shares INTERPOLATE's holes and rendering)
// ========================================

test("PRINT - basic interpolation", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`5 .count !`);
  await interp.run(`"Count: \${count}" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Count: 5");
  consoleSpy.mockRestore();
});

test("PRINT - multiple variables in one string", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`3 .number !`);
  await interp.run(`["apple" "banana"] .queue !`);
  await interp.run(`"There are \${number} items in the queue: \${queue}" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("There are 3 items in the queue: apple, banana");
  consoleSpy.mockRestore();
});

test("PRINT - variable at start of string", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`["apple" "banana"] .items !`);
  await interp.run(`"\${items} are available" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("apple, banana are available");
  consoleSpy.mockRestore();
});

test("PRINT - missing variable renders as null_text and creates nothing", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"Value: [\${missing}]" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Value: []");
  expect(interp.find_variable("missing")).toBeNull();
  consoleSpy.mockRestore();
});

test("PRINT - rejects expression holes too", async () => {
  await expect(interp.run(`"value: \${6 * 7}" PRINT`)).rejects.toThrow(/not expressions/);
});

test("PRINT - array with custom separator option", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`["apple" "banana" "cherry"] .items !`);
  await interp.run(`"Items: \${items}" [.separator " | "] ~> PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Items: apple | banana | cherry");
  consoleSpy.mockRestore();
});

test("PRINT - custom null_text option", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"Missing: \${missing}" [.null_text "N/A"] ~> PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Missing: N/A");
  consoleSpy.mockRestore();
});

test("PRINT - null array elements use null_text too", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`[1 NULL 3] [.null_text "N/A"] ~> PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("1, N/A, 3");
  consoleSpy.mockRestore();
});

test("PRINT - escaped hole stays literal", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`7 .x !`);
  await interp.run(`"shell says \\\${x}, forthic says \${x}" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("shell says \${x}, forthic says 7");
  consoleSpy.mockRestore();
});

test("PRINT - object values as JSON", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`[["name" "test"] ["value" 123]] REC .obj !`);
  await interp.run(`"Object: \${obj}" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith('Object: {"name":"test","value":123}');
  consoleSpy.mockRestore();
});

test("PRINT - json option for all values", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`["apple" "banana"] .items !`);
  await interp.run(`"Items: \${items}" [.json TRUE] ~> PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith('Items: ["apple","banana"]');
  consoleSpy.mockRestore();
});

test("PRINT - empty string", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("");
  consoleSpy.mockRestore();
});

test("PRINT - string with no variables", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"Just a plain string" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Just a plain string");
  consoleSpy.mockRestore();
});

test("PRINT - boolean values", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`TRUE .flag !`);
  await interp.run(`"Flag is: \${flag}" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Flag is: true");
  consoleSpy.mockRestore();
});

test("NUMBER? is true for Infinity (numbers, excluding NaN)", async () => {
  await interp.run("INFINITY NUMBER?");
  expect(interp.stack_pop()).toBe(true);
});

// ===== TRY: error handling as data (Rust Result semantics) =====

test("TRY wraps success as an ok record", async () => {
  await interp.run("5 '2 *' TRY");
  expect(interp.stack_pop()).toEqual({ ok: 10 });
});

test("TRY law: 'CODE' TRY UNWRAP === CODE on success", async () => {
  await interp.run("5 '2 *' TRY UNWRAP");
  expect(interp.stack_pop()).toBe(10);
});

test("TRY law: UNWRAP re-raises with message and error_type preserved", async () => {
  await expect(interp.run("'NO-SUCH-WORD' TRY UNWRAP")).rejects.toThrow(
    /NO-SUCH-WORD.*\(.*Error.*\)/,
  );
});

test("TRY wraps failure as an error record with message and error_type", async () => {
  await interp.run("'NO-SUCH-WORD' TRY");
  const outcome = interp.stack_pop();
  expect("error" in outcome).toBe(true);
  expect(outcome.error.message).toContain("NO-SUCH-WORD");
  expect(typeof outcome.error.error_type).toBe("string");
});

test("TRY is transactional for the stack on failure", async () => {
  // The failing code consumes 2 and pushes garbage-in-progress; afterwards
  // the stack must be exactly [1, 2, outcome]
  await interp.run("1 2 'POP POP NO-SUCH-WORD' TRY");
  const outcome = interp.stack_pop();
  expect("error" in outcome).toBe(true);
  expect(interp.stack_pop()).toBe(2);
  expect(interp.stack_pop()).toBe(1);
});

test("TRY does not roll back side effects (like catch_unwind)", async () => {
  await interp.run("'42 .written ! NO-SUCH-WORD' TRY POP .written @");
  expect(interp.stack_pop()).toBe(42);
});

test("TRY unwinds modules left open by failed code", async () => {
  const depth_before = (interp as any).module_stack_depth();
  await interp.run("'{my-mod NO-SUCH-WORD' TRY");
  expect((interp as any).module_stack_depth()).toBe(depth_before);
  const outcome = interp.stack_pop();
  expect("error" in outcome).toBe(true);
});

test("TRY with net-zero code succeeds with ok: null", async () => {
  await interp.run("'1 POP' TRY");
  expect(interp.stack_pop()).toEqual({ ok: null });
});

test("TRY success consumes inputs legitimately", async () => {
  // '+' consumes 1 and 2; success must NOT restore them
  await interp.run("1 2 '+' TRY");
  const outcome = interp.stack_pop();
  expect(outcome).toEqual({ ok: 3 });
  expect(interp.get_stack().get_items().length).toBe(0);
});

test("OK? and ERROR? discriminate outcomes", async () => {
  await interp.run("'1' TRY OK?");
  expect(interp.stack_pop()).toBe(true);
  await interp.run("'1' TRY ERROR?");
  expect(interp.stack_pop()).toBe(false);
  await interp.run("'NO-SUCH-WORD' TRY OK?");
  expect(interp.stack_pop()).toBe(false);
  await interp.run("'NO-SUCH-WORD' TRY ERROR?");
  expect(interp.stack_pop()).toBe(true);
});

test("UNWRAP-OR provides fallbacks", async () => {
  await interp.run("'5' TRY 0 UNWRAP-OR");
  expect(interp.stack_pop()).toBe(5);
  await interp.run("'NO-SUCH-WORD' TRY 0 UNWRAP-OR");
  expect(interp.stack_pop()).toBe(0);
});

test("UNWRAP-OR: ok null beats the default (failure is not nullness)", async () => {
  await interp.run("'NULL' TRY 99 UNWRAP-OR");
  expect(interp.stack_pop()).toBe(null);
});

test("UNWRAP on a non-outcome record throws", async () => {
  await expect(interp.run("[ [ 'other' 1 ] ] REC UNWRAP")).rejects.toThrow(/outcome record/);
});

test("UNWRAP is structural: hand-built ok records work", async () => {
  await interp.run("[ [ 'ok' 7 ] ] REC UNWRAP");
  expect(interp.stack_pop()).toBe(7);
});

test("MAP outcomes mode: per-element failures, nothing stranded", async () => {
  await interp.run(`[ 1 2 ] 'NO-SUCH-WORD' [.outcomes TRUE] ~> MAP`);
  const outcomes = interp.stack_pop();
  expect(outcomes.length).toBe(2);
  expect("error" in outcomes[0]).toBe(true);
  expect("error" in outcomes[1]).toBe(true);
  // MAP owns its pushes: failures can't strand anything on the stack
  expect(interp.get_stack().get_items().length).toBe(0);
});

test("MAP outcomes mode wraps successes", async () => {
  await interp.run(`[ 1 2 ] '2 *' [.outcomes TRUE] ~> MAP`);
  expect(interp.stack_pop()).toEqual([{ ok: 2 }, { ok: 4 }]);
});

test("MAP outcomes mode has fixed arity (one result, no errors array)", async () => {
  await interp.run(`[ 1 ] 'NO-SUCH-WORD' [.outcomes TRUE] ~> MAP`);
  expect(interp.get_stack().get_items().length).toBe(1);
  interp.stack_pop();
});

test("TRY inside MAP restores the item — the documented reason for outcomes mode", async () => {
  // TRY is transactional: its snapshot includes the item MAP pushed, so a
  // failing element is faithfully restored... beneath the outcome record.
  // This is correct TRY behavior and the wrong tool for mapping — use
  // [.outcomes TRUE] ~> MAP instead.
  await interp.run(`[ 1 2 ] "'NO-SUCH-WORD' TRY" MAP`);
  const outcomes = interp.stack_pop();
  expect("error" in outcomes[0]).toBe(true);
  expect(interp.get_stack().get_items()).toEqual([1, 2]); // restored items
  interp.stack_pop();
  interp.stack_pop();
});
