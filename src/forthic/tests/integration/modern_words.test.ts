import { StandardInterpreter } from "../../interpreter";

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter([], "America/Los_Angeles");
});

describe("IF (value selection)", () => {
  test("pushes then-value when bool is truthy", async () => {
    await interp.run("TRUE 1 2 IF");
    expect(interp.stack_pop()).toBe(1);
  });

  test("pushes else-value when bool is falsy", async () => {
    await interp.run("FALSE 1 2 IF");
    expect(interp.stack_pop()).toBe(2);
  });

  test("works with string values without forthic-string wrapping", async () => {
    await interp.run("TRUE 'Howdy' 'Bye' IF");
    expect(interp.stack_pop()).toBe("Howdy");

    await interp.run("FALSE 'Howdy' 'Bye' IF");
    expect(interp.stack_pop()).toBe("Bye");
  });
});

describe("IF-RUN (lazy code execution)", () => {
  test("runs the then-branch when bool is truthy", async () => {
    await interp.run("TRUE '1 2 +' '3 4 *' IF-RUN");
    expect(interp.stack_pop()).toBe(3);
  });

  test("runs the else-branch when bool is falsy", async () => {
    await interp.run("FALSE '1 2 +' '3 4 *' IF-RUN");
    expect(interp.stack_pop()).toBe(12);
  });

  test("does nothing when chosen branch is empty string", async () => {
    await interp.run("42 TRUE '' '99' IF-RUN");
    expect(interp.stack_pop()).toBe(42);
  });
});

describe("RUN", () => {
  test("executes a Forthic string", async () => {
    await interp.run("'1 2 +' RUN");
    expect(interp.stack_pop()).toBe(3);
  });

  test("composes naturally with IF for selected-then-run", async () => {
    await interp.run("TRUE '10 20 +' '50 50 +' IF RUN");
    expect(interp.stack_pop()).toBe(30);
  });
});

describe("DEFAULT-RUN (lazy default)", () => {
  test("returns value when non-empty (forthic not run)", async () => {
    await interp.run("'hello' '999 1 /' DEFAULT-RUN");
    expect(interp.stack_pop()).toBe("hello");
  });

  test("runs forthic when value is null", async () => {
    await interp.run("NULL '10 20 +' DEFAULT-RUN");
    expect(interp.stack_pop()).toBe(30);
  });

  test("runs forthic when value is empty string", async () => {
    await interp.run("'' '\"fallback\"' DEFAULT-RUN");
    expect(interp.stack_pop()).toBe("fallback");
  });

  test("returns 0 (truthy in non-empty sense)", async () => {
    await interp.run("0 '999' DEFAULT-RUN");
    expect(interp.stack_pop()).toBe(0);
  });
});

describe("WHEN (single-branch lazy execution)", () => {
  test("runs forthic when bool is truthy", async () => {
    await interp.run("TRUE '7' WHEN");
    expect(interp.stack_pop()).toBe(7);
  });

  test("does nothing when bool is falsy", async () => {
    await interp.run("100 FALSE '7' WHEN");
    expect(interp.stack_pop()).toBe(100);
  });

  test("runs multi-step forthic", async () => {
    await interp.run("TRUE '10 20 +' WHEN");
    expect(interp.stack_pop()).toBe(30);
  });
});

describe("RANGE", () => {
  test("inclusive integer range", async () => {
    await interp.run("1 5 RANGE");
    expect(interp.stack_pop()).toEqual([1, 2, 3, 4, 5]);
  });

  test("singleton range when start == end", async () => {
    await interp.run("3 3 RANGE");
    expect(interp.stack_pop()).toEqual([3]);
  });

  test("empty range when start > end", async () => {
    await interp.run("5 1 RANGE");
    expect(interp.stack_pop()).toEqual([]);
  });

  test("zero-based range", async () => {
    await interp.run("0 3 RANGE");
    expect(interp.stack_pop()).toEqual([0, 1, 2, 3]);
  });
});

describe("FIRST", () => {
  test("first element of array", async () => {
    await interp.run("[1 2 3] FIRST");
    expect(interp.stack_pop()).toBe(1);
  });

  test("first value of record (sorted-key order)", async () => {
    await interp.run("[['b' 2] ['a' 1] ['c' 3]] REC FIRST");
    expect(interp.stack_pop()).toBe(1);
  });

  test("first of empty array is null", async () => {
    await interp.run("[] FIRST");
    expect(interp.stack_pop()).toBeNull();
  });

  test("first of null is null", async () => {
    await interp.run("NULL FIRST");
    expect(interp.stack_pop()).toBeNull();
  });
});

describe("Type predicates", () => {
  test("NULL?", async () => {
    await interp.run("NULL NULL?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("0 NULL?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("'' NULL?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("EMPTY?", async () => {
    await interp.run("NULL EMPTY?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("'' EMPTY?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("[] EMPTY?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("[] REC EMPTY?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("'a' EMPTY?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("[1] EMPTY?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("0 EMPTY?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("STRING?", async () => {
    await interp.run("'abc' STRING?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("123 STRING?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("NULL STRING?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("NUMBER?", async () => {
    await interp.run("42 NUMBER?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("3.14 NUMBER?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("'42' NUMBER?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("NULL NUMBER?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("RECORD?", async () => {
    await interp.run("[['a' 1]] REC RECORD?");
    expect(interp.stack_pop()).toBe(true);
    await interp.run("[1 2 3] RECORD?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("NULL RECORD?");
    expect(interp.stack_pop()).toBe(false);
    await interp.run("'abc' RECORD?");
    expect(interp.stack_pop()).toBe(false);
  });
});

describe("Classic words still resolve", () => {
  test("ADD still works", async () => {
    await interp.run("3 4 ADD");
    expect(interp.stack_pop()).toBe(7);
  });

  test("IDENTITY still works", async () => {
    await interp.run("42 IDENTITY");
    expect(interp.stack_pop()).toBe(42);
  });

  test("XOR still works", async () => {
    await interp.run("TRUE FALSE XOR");
    expect(interp.stack_pop()).toBe(true);
  });

  test("JSON-PRETTIFY still works", async () => {
    await interp.run('\'{"a":1}\' JSON-PRETTIFY');
    expect(interp.stack_pop()).toBe('{\n  "a": 1\n}');
  });

  test("INTERPRET still works (now in classic, RUN is the surface name)", async () => {
    await interp.run("'10 20 +' INTERPRET");
    expect(interp.stack_pop()).toBe(30);
  });
});
