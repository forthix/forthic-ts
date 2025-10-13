import { StandardInterpreter } from "../../../interpreter";
import {
  InvalidVariableNameError,
  WordExecutionError
} from "../../../errors";
import { CoreModule } from "../../../modules/core_module";
import { WordOptions } from "../../../word_options";

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

test("Auto-create variables with string names", async () => {
  // Test ! with string variable name (auto-creates variable)
  await interp.run('"hello" "autovar1" !');
  await interp.run('autovar1 @');
  expect(interp.stack_pop()).toBe("hello");

  // Verify variable was created in app module
  const autovar1 = (interp as any).app_module.variables["autovar1"];
  expect(autovar1).toBeDefined();
  expect(autovar1.get_value()).toBe("hello");

  // Test @ with string variable name (auto-creates with null)
  await interp.run('"autovar2" @');
  expect(interp.stack_pop()).toBe(null);

  // Verify variable was created
  const autovar2 = (interp as any).app_module.variables["autovar2"];
  expect(autovar2).toBeDefined();
  expect(autovar2.get_value()).toBe(null);

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

test("POP", async () => {
  await interp.run(`
    1 2 3 4 5 POP
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
  await interp.run(`[.depth 3 .with_key TRUE .push_error FALSE] ~>`);
  const opts = interp.stack_pop();
  expect(opts.get("depth")).toBe(3);
  expect(opts.get("with_key")).toBe(true);
  expect(opts.get("push_error")).toBe(false);
});

// ========================================
// INTERPOLATE
// ========================================

test("INTERPOLATE - basic interpolation with dynamic variable", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"Count: .count" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Count: 5");
});

test("INTERPOLATE - returns string without printing", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`3 .number !`);
  await interp.run(`"Number: .number" INTERPOLATE`);

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
  await interp.run(`"There are .number items: .queue" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("There are 3 items: apple, banana");
});

test("INTERPOLATE - can be stored in variable", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"Count: .count" INTERPOLATE .message !`);
  await interp.run(`.message @`);

  const result = interp.stack_pop();
  expect(result).toBe("Count: 5");
});

test("INTERPOLATE - can be used with string operations", async () => {
  await interp.run(`"hello" .word !`);
  await interp.run(`"Say .word" INTERPOLATE UPPERCASE`);

  const result = interp.stack_pop();
  expect(result).toBe("SAY HELLO");
});

test("INTERPOLATE - array with custom separator option", async () => {
  await interp.run(`["apple" "banana" "cherry"] .items !`);
  await interp.run(`"Items: .items" [.separator " | "] ~> INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Items: apple | banana | cherry");
});

test("INTERPOLATE - custom null_text option", async () => {
  await interp.run(`"Missing: .missing" [.null_text "N/A"] ~> INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Missing: N/A");
});

test("INTERPOLATE - json option", async () => {
  await interp.run(`["apple" "banana"] .items !`);
  await interp.run(`"Items: .items" [.json TRUE] ~> INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe('Items: ["apple","banana"]');
});

test("INTERPOLATE - escaped dots", async () => {
  await interp.run(`42 .linecount !`);
  await interp.run(`"Config: \\.bashrc has .linecount lines" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Config: .bashrc has 42 lines");
});

test("INTERPOLATE - decimal numbers don't get interpolated", async () => {
  await interp.run(`5 .count !`);
  await interp.run(`"Price is $10.50 for .count items" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Price is $10.50 for 5 items");
});

test("INTERPOLATE - chaining multiple interpolations", async () => {
  await interp.run(`"world" .name !`);
  await interp.run(`"Hello .name" INTERPOLATE .greeting !`);
  await interp.run(`"Message: .greeting" INTERPOLATE`);

  const result = interp.stack_pop();
  expect(result).toBe("Message: Hello world");
});

// ========================================
// PRINT
// ========================================

test("PRINT - basic interpolation with dynamic variable", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`5 .count !`);
  await interp.run(`"Count: .count" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Count: 5");
  consoleSpy.mockRestore();
});

test("PRINT - multiple variables in one string", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`3 .number !`);
  await interp.run(`["apple" "banana"] .queue !`);
  await interp.run(`"There are .number items in the queue: .queue" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("There are 3 items in the queue: apple, banana");
  consoleSpy.mockRestore();
});

test("PRINT - decimal numbers don't get interpolated", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`5 .count !`);
  await interp.run(`"Price is $10.50 for .count items" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Price is $10.50 for 5 items");
  consoleSpy.mockRestore();
});

test("PRINT - variable at start of string", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`["apple" "banana"] .items !`);
  await interp.run(`".items are available" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("apple, banana are available");
  consoleSpy.mockRestore();
});

test("PRINT - undefined variable creates null", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"Value: .undefined" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Value: null");
  consoleSpy.mockRestore();
});

test("PRINT - array with custom separator option", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`["apple" "banana" "cherry"] .items !`);
  await interp.run(`"Items: .items" [.separator " | "] ~> PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Items: apple | banana | cherry");
  consoleSpy.mockRestore();
});

test("PRINT - custom null_text option", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"Missing: .missing" [.null_text "N/A"] ~> PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Missing: N/A");
  consoleSpy.mockRestore();
});

test("PRINT - escaped dot with backslash", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`42 .linecount !`);
  await interp.run(`"Config file: \\.bashrc has .linecount lines" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Config file: .bashrc has 42 lines");
  consoleSpy.mockRestore();
});

test("PRINT - object values as JSON", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`[["name" "test"] ["value" 123]] REC .obj !`);
  await interp.run(`"Object: .obj" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith('Object: {"name":"test","value":123}');
  consoleSpy.mockRestore();
});

test("PRINT - json option for all values", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`["apple" "banana"] .items !`);
  await interp.run(`"Items: .items" [.json TRUE] ~> PRINT`);

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

test("PRINT - multiple escaped dots", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`"Files: \\.bashrc and \\.profile" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Files: .bashrc and .profile");
  consoleSpy.mockRestore();
});

test("PRINT - boolean values", async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

  await interp.run(`TRUE .flag !`);
  await interp.run(`"Flag is: .flag" PRINT`);

  expect(consoleSpy).toHaveBeenCalledWith("Flag is: true");
  consoleSpy.mockRestore();
});
