import { StandardInterpreter } from "../../../interpreter";

describe("StringModule", () => {
  let interp: StandardInterpreter;

  beforeEach(() => {
    interp = new StandardInterpreter();
  });

  test(">STR", async () => {
    await interp.run("42 >STR");
    expect(interp.stack_pop()).toBe("42");
  });

  test("CONCAT two strings", async () => {
    await interp.run("'Hello' ' World' CONCAT");
    expect(interp.stack_pop()).toBe("Hello World");
  });

  test("CONCAT array of strings", async () => {
    await interp.run("['Hello' ' ' 'World'] CONCAT");
    expect(interp.stack_pop()).toBe("Hello World");
  });

  test("SPLIT", async () => {
    await interp.run("'a,b,c' ',' SPLIT");
    expect(interp.stack_pop()).toEqual(["a", "b", "c"]);
  });

  test("JOIN", async () => {
    await interp.run("['a' 'b' 'c'] ',' JOIN");
    expect(interp.stack_pop()).toBe("a,b,c");
  });

  test("/N", async () => {
    await interp.run("/N");
    expect(interp.stack_pop()).toBe("\n");
  });

  test("/R", async () => {
    await interp.run("/R");
    expect(interp.stack_pop()).toBe("\r");
  });

  test("/T", async () => {
    await interp.run("/T");
    expect(interp.stack_pop()).toBe("\t");
  });

  test("LOWERCASE", async () => {
    await interp.run("'HELLO' LOWERCASE");
    expect(interp.stack_pop()).toBe("hello");
  });

  test("UPPERCASE", async () => {
    await interp.run("'hello' UPPERCASE");
    expect(interp.stack_pop()).toBe("HELLO");
  });

  test("ASCII", async () => {
    await interp.run("'Hello\u0100World' ASCII");
    expect(interp.stack_pop()).toBe("HelloWorld");
  });

  test("STRIP", async () => {
    await interp.run("'  hello  ' STRIP");
    expect(interp.stack_pop()).toBe("hello");
  });

  test("REPLACE", async () => {
    await interp.run("'hello world' 'world' 'there' REPLACE");
    expect(interp.stack_pop()).toBe("hello there");
  });

  test("RE-MATCH success", async () => {
    await interp.run("'test123' 'test[0-9]+' RE-MATCH");
    const result = interp.stack_pop();
    expect(result).toBeTruthy();
    expect(result[0]).toBe("test123");
  });

  test("RE-MATCH failure", async () => {
    await interp.run("'test' '[0-9]+' RE-MATCH");
    expect(interp.stack_pop()).toBeFalsy();
  });

  test("RE-MATCH-ALL", async () => {
    await interp.run("'test1 test2 test3' 'test([0-9])' RE-MATCH-ALL");
    expect(interp.stack_pop()).toEqual(["1", "2", "3"]);
  });

  test("RE-MATCH-GROUP", async () => {
    await interp.run("'test123' 'test([0-9]+)' RE-MATCH 1 RE-MATCH-GROUP");
    expect(interp.stack_pop()).toBe("123");
  });

  test("URL-ENCODE", async () => {
    await interp.run("'hello world' URL-ENCODE");
    expect(interp.stack_pop()).toBe("hello%20world");
  });

  test("URL-DECODE", async () => {
    await interp.run("'hello%20world' URL-DECODE");
    expect(interp.stack_pop()).toBe("hello world");
  });
});
