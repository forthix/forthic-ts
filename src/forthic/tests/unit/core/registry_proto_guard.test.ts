/**
 * The interpreter's name-keyed registries (module tables, variable tables, the
 * word-count map, and word-local frames) must not resolve prototype-chain
 * names like `constructor` / `__proto__` to inherited Object members, and must
 * not let those names pollute a dictionary's prototype.
 */
import { StandardInterpreter } from "../../../interpreter";

let interp: StandardInterpreter;

beforeEach(() => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

describe("core registries resist prototype-name pollution", () => {
  test("a module named 'constructor' resolves to a real module, not Object", async () => {
    // `{constructor` used to find_module("constructor") -> the inherited Object
    // function on a plain {}, push it as the current module, and crash the next
    // word lookup. (The module name attaches to `{` with no space.)
    await interp.run("{constructor 1 2 + }");
    expect(interp.get_stack().get_items()).toEqual([3]);
  });

  test("a top-level variable named 'constructor' auto-creates cleanly", async () => {
    // find_module_variable("constructor") used to return the inherited Object.
    await interp.run(`5 "constructor" ! "constructor" @`);
    expect(interp.get_stack().get_items()).toEqual([5]);
  });

  test("a word-local variable named 'constructor' auto-creates cleanly", async () => {
    // Exercises the word-local frame table specifically (a separate registry
    // from the module variable tables).
    await interp.run(`: STORE 5 "constructor" ! "constructor" @ ; STORE`);
    expect(interp.get_stack().get_items()).toEqual([5]);
  });

  test("a module named '__proto__' does not corrupt the interpreter", async () => {
    // register_module used to do modules["__proto__"] = module, swapping the
    // dictionary's prototype. It must stay usable and not pollute globally.
    await interp.run("{__proto__ 7 8 +}");
    expect(interp.get_stack().get_items()).toEqual([15]);
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
});
