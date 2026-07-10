import { StandardInterpreter } from "../../../../interpreter";
import { FsModule } from "../../../../modules/typescript/fs_module";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
  interp.register_module(new FsModule());
  interp.use_modules([["fs", ""]]);
});

test("JOIN-PATH joins the array of components", async () => {
  await interp.run(`[ "/tmp" "test.txt" ] JOIN-PATH`);
  expect(interp.stack_pop()).toBe("/tmp/test.txt");
});

test("JOIN-PATH joins more than two components", async () => {
  await interp.run(`[ "a" "b" "c" ] JOIN-PATH`);
  expect(interp.stack_pop()).toBe("a/b/c");
});
