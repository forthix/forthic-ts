import { StandardInterpreter } from "../../../../interpreter";

describe("StringModule", () => {
  let interp: StandardInterpreter;

  beforeEach(() => {
    interp = new StandardInterpreter();
  });

  test(">STR", async () => {
    await interp.run("42 >STR");
    expect(interp.stack_pop()).toBe("42");
  });

  test("CONCAT array of strings", async () => {
    await interp.run("['Hello' ' ' 'World'] CONCAT");
    expect(interp.stack_pop()).toBe("Hello World");
  });

  test("CONCAT rejects two strings on stack", async () => {
    await expect(interp.run("'Hello' ' World' CONCAT")).rejects.toThrow(/array of strings/);
  });

  test("STR-LENGTH", async () => {
    await interp.run("'hello' STR-LENGTH");
    expect(interp.stack_pop()).toBe(5);

    await interp.run("'' STR-LENGTH");
    expect(interp.stack_pop()).toBe(0);

    await interp.run("NULL STR-LENGTH");
    expect(interp.stack_pop()).toBe(0);
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

  test("INTERPOLATE fills {.var}@ holes from scope", async () => {
    await interp.run("'world' .name ! 'hello {.name}@!' INTERPOLATE");
    expect(interp.stack_pop()).toBe("hello world!");
  });

  test("INTERPOLATE treats the leading dot as optional", async () => {
    await interp.run("'world' .name ! 'hi {name}@' INTERPOLATE");
    expect(interp.stack_pop()).toBe("hi world");
  });

  test("INTERPOLATE leaves bare braces untouched", async () => {
    await interp.run("'1' .a ! 'const x = { a: {.a}@ };' INTERPOLATE");
    expect(interp.stack_pop()).toBe("const x = { a: 1 };");
  });

  test("INTERPOLATE renders a missing variable as empty string", async () => {
    await interp.run("'[{.nope}@]' INTERPOLATE");
    expect(interp.stack_pop()).toBe("[]");
  });

  test("INTERPOLATE renders a record hole as JSON", async () => {
    await interp.run("[['a' 1]] REC .r ! '{.r}@' INTERPOLATE");
    expect(interp.stack_pop()).toBe('{"a":1}');
  });

  test("RE-MATCH-ALL returns full matches when the pattern has no capture group", async () => {
    await interp.run("'a1b2c3' '[0-9]' RE-MATCH-ALL");
    expect(interp.stack_pop()).toEqual(["1", "2", "3"]);
  });

  test("RE-MATCH-ALL still returns capture group 1 when present", async () => {
    await interp.run("'test1 test2 test3' 'test([0-9])' RE-MATCH-ALL");
    expect(interp.stack_pop()).toEqual(["1", "2", "3"]);
  });

  test(">STR returns empty string for null/undefined instead of throwing", async () => {
    await interp.run("NULL >STR");
    expect(interp.stack_pop()).toBe("");
  });
});
