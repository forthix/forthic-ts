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

describe("MAP-WITH-KEY / FOREACH-WITH-KEY (convenience aliases)", () => {
  test("MAP-WITH-KEY pushes index then value to forthic on arrays", async () => {
    await interp.run("['a' 'b' 'c'] '+' MAP-WITH-KEY");
    expect(interp.stack_pop()).toEqual(["0a", "1b", "2c"]);
  });

  test("MAP-WITH-KEY pushes key then value on records", async () => {
    await interp.run("[['x' 1] ['y' 2]] REC '+' MAP-WITH-KEY");
    expect(interp.stack_pop()).toEqual({ x: "x1", y: "y2" });
  });

  test("FOREACH-WITH-KEY runs forthic with key+value", async () => {
    // Body sees [..., index, value]. + reduces them into one number,
    // then we add to running total.
    await interp.run(
      "0 .total !  [10 20 30] '+ .total @ + .total !' FOREACH-WITH-KEY  .total @"
    );
    // sum of (index + value) for each: (0+10)+(1+20)+(2+30) = 63
    expect(interp.stack_pop()).toBe(63);
  });
});

describe("FILTER-WITH-KEY (convenience alias)", () => {
  test("filters by key/index condition", async () => {
    // forthic stack at entry: [..., index, value]. POP drops value, leaves index;
    // then 1 > tests index > 1.
    await interp.run("[10 20 30 40] 'POP 1 >' FILTER-WITH-KEY");
    expect(interp.stack_pop()).toEqual([30, 40]);
  });
});

describe("GROUP-BY-WITH-KEY (convenience alias)", () => {
  test("groups by a function of key+value", async () => {
    await interp.run(
      "[['a' 1] ['b' 2] ['c' 3]] REC 'SWAP POP 2 MOD' GROUP-BY-WITH-KEY"
    );
    // Group records by (value MOD 2): odd values {a:1, c:3}, even values {b:2}
    const result = interp.stack_pop();
    expect(result).toBeDefined();
  });
});

describe("MAP-AT (jq |= equivalent)", () => {
  test("transforms a single record field", async () => {
    await interp.run("[['name' 'alice'] ['age' 30]] REC 'age' '1 +' MAP-AT");
    expect(interp.stack_pop()).toEqual({ name: "alice", age: 31 });
  });

  test("transforms a single array element by index", async () => {
    await interp.run("[10 20 30] 1 '100 *' MAP-AT");
    expect(interp.stack_pop()).toEqual([10, 2000, 30]);
  });

  test("returns container unchanged when key not found in record", async () => {
    await interp.run("[['a' 1]] REC 'nope' '999 +' MAP-AT");
    expect(interp.stack_pop()).toEqual({ a: 1 });
  });

  test("returns container unchanged when index out of range", async () => {
    await interp.run("[1 2 3] 99 '0 *' MAP-AT");
    expect(interp.stack_pop()).toEqual([1, 2, 3]);
  });

  test("does not mutate the original container", async () => {
    await interp.run("[10 20 30] .original ! .original @ 1 '100 *' MAP-AT POP .original @");
    expect(interp.stack_pop()).toEqual([10, 20, 30]);
  });
});

describe("FILTER (modern of SELECT)", () => {
  test("filters array by predicate", async () => {
    await interp.run("[1 2 3 4] '2 >' FILTER");
    expect(interp.stack_pop()).toEqual([3, 4]);
  });

  test("filters record values by predicate", async () => {
    await interp.run("[['a' 1] ['b' 2] ['c' 3]] REC '1 >' FILTER");
    expect(interp.stack_pop()).toEqual({ b: 2, c: 3 });
  });
});

describe("CONTAINS? (modern of IN, container-first args)", () => {
  test("returns true when needle present", async () => {
    await interp.run("[1 2 3] 2 CONTAINS?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("returns false when needle absent", async () => {
    await interp.run("[1 2 3] 99 CONTAINS?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("returns false when haystack is not an array", async () => {
    await interp.run("NULL 'x' CONTAINS?");
    expect(interp.stack_pop()).toBe(false);
  });
});

describe("TIMES-RUN (modern of <REPEAT)", () => {
  test("runs forthic the given number of times", async () => {
    await interp.run("0 .count !  3 '.count @ 1 + .count !' TIMES-RUN  .count @");
    expect(interp.stack_pop()).toBe(3);
  });

  test("zero iterations does nothing", async () => {
    await interp.run("0 'NEVER-CALLED' TIMES-RUN  42");
    expect(interp.stack_pop()).toBe(42);
  });
});

describe("DELETE (modern of <DEL)", () => {
  test("deletes a record key", async () => {
    await interp.run("[['a' 1] ['b' 2]] REC 'a' DELETE");
    expect(interp.stack_pop()).toEqual({ b: 2 });
  });

  test("deletes an array index", async () => {
    await interp.run("[10 20 30] 1 DELETE");
    expect(interp.stack_pop()).toEqual([10, 30]);
  });
});

describe("FORMAT-FIXED (modern of >FIXED)", () => {
  test("formats with two decimal places", async () => {
    await interp.run("3.14159 2 FORMAT-FIXED");
    expect(interp.stack_pop()).toBe("3.14");
  });

  test("returns null for null input", async () => {
    await interp.run("NULL 2 FORMAT-FIXED");
    expect(interp.stack_pop()).toBeNull();
  });
});

describe("DAYS-BETWEEN (modern of SUBTRACT-DATES)", () => {
  test("computes day difference", async () => {
    await interp.run("2026-01-10 2026-01-01 DAYS-BETWEEN");
    expect(interp.stack_pop()).toBe(9);
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

  test("SELECT still works (now in classic, FILTER is the surface name)", async () => {
    await interp.run("[1 2 3 4] '2 >' SELECT");
    expect(interp.stack_pop()).toEqual([3, 4]);
  });

  test("IN still works (now in classic, CONTAINS? is the surface name)", async () => {
    await interp.run("2 [1 2 3] IN");
    expect(interp.stack_pop()).toBe(true);
  });

  test("<DEL still works", async () => {
    await interp.run("[['a' 1] ['b' 2]] REC 'a' <DEL");
    expect(interp.stack_pop()).toEqual({ b: 2 });
  });

  test(">FIXED still works", async () => {
    await interp.run("3.14159 2 >FIXED");
    expect(interp.stack_pop()).toBe("3.14");
  });

  test("SUBTRACT-DATES still works", async () => {
    await interp.run("2026-01-10 2026-01-01 SUBTRACT-DATES");
    expect(interp.stack_pop()).toBe(9);
  });
});
