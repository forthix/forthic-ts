import { StandardInterpreter } from "../../interpreter";

test("Dot symbols work as strings in interpreter", async () => {
  const interp = new StandardInterpreter();

  // Test that dot symbols are pushed as strings onto the stack
  await interp.run(".symbol .test-123");

  const stack = interp.get_stack().get_items();
  expect(stack).toEqual(["symbol", "test-123"]);
});

test("PEEK! and STACK! work as debug words", async () => {
  const interp = new StandardInterpreter();

  // These should trigger the debugging words and stop execution
  let error1: Error | null = null;
  let error2: Error | null = null;

  try {
    await interp.run("42 PEEK!");
  } catch (e) {
    error1 = e as Error;
  }

  try {
    await interp.run("1 2 STACK!");
  } catch (e) {
    error2 = e as Error;
  }

  // Both should throw IntentionalStopError, indicating they executed as words
  expect(error1?.name).toEqual("IntentionalStopError");
  expect(error2?.name).toEqual("IntentionalStopError");
});

test("Dot symbols mixed with regular tokens", async () => {
  const interp = new StandardInterpreter();

  await interp.run('[ .key1 "value1" .key2 "value2" ]');

  const stack = interp.get_stack().get_items();
  expect(stack).toEqual([["key1", "value1", "key2", "value2"]]);
});

test("Minimum length boundary cases", async () => {
  const interp = new StandardInterpreter();

  // .ab should be a dot symbol
  await interp.run(".ab");
  expect(interp.get_stack().get_items()).toEqual(["ab"]);

  // Clear stack
  interp.get_stack().get_raw_items().length = 0;

  // .a should now also be a dot symbol (one-character symbols supported)
  await interp.run(".a");
  expect(interp.get_stack().get_items()).toEqual(["a"]);

  // Clear stack
  interp.get_stack().get_raw_items().length = 0;

  // Just a dot by itself should be treated as a word (will cause UnknownWordError)
  let error: Error | null = null;
  try {
    await interp.run(".");
  } catch (e) {
    error = e as Error;
  }

  expect(error?.name).toEqual("UnknownWordError");
});
