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

describe("Iteration with .with_key option (substrate; no convenience aliases)", () => {
  test("MAP { .with_key TRUE } pushes index then value to forthic on arrays", async () => {
    await interp.run("['a' 'b' 'c'] '+' [.with_key TRUE] ~> MAP");
    expect(interp.stack_pop()).toEqual(["0a", "1b", "2c"]);
  });

  test("MAP { .with_key TRUE } pushes key then value on records", async () => {
    await interp.run("[['x' 1] ['y' 2]] REC '+' [.with_key TRUE] ~> MAP");
    expect(interp.stack_pop()).toEqual({ x: "x1", y: "y2" });
  });

  test("FOREACH with .with_key TRUE runs forthic with key+value", async () => {
    await interp.run(
      "0 .total !  [10 20 30] '+ .total @ + .total !' [.with_key TRUE] ~> FOREACH  .total @"
    );
    // sum of (index + value) for each: (0+10)+(1+20)+(2+30) = 63
    expect(interp.stack_pop()).toBe(63);
  });

  test("FILTER with .with_key TRUE filters by key/index condition", async () => {
    await interp.run("[10 20 30 40] 'POP 1 >' [.with_key TRUE] ~> FILTER");
    expect(interp.stack_pop()).toEqual([30, 40]);
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

describe("Record additions (PR 6)", () => {
  test("HAS-KEY? returns true for present key", async () => {
    await interp.run("[['a' 1] ['b' 2]] REC 'a' HAS-KEY?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("HAS-KEY? returns false for missing key", async () => {
    await interp.run("[['a' 1]] REC 'b' HAS-KEY?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("HAS-KEY? distinguishes intentional null from missing", async () => {
    await interp.run("[['a' NULL]] REC 'a' HAS-KEY?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("PICK keeps only listed keys", async () => {
    await interp.run("[['a' 1] ['b' 2] ['c' 3]] REC ['a' 'c'] PICK");
    expect(interp.stack_pop()).toEqual({ a: 1, c: 3 });
  });

  test("PICK skips missing keys", async () => {
    await interp.run("[['a' 1]] REC ['a' 'nope'] PICK");
    expect(interp.stack_pop()).toEqual({ a: 1 });
  });

  test("OMIT drops listed keys", async () => {
    await interp.run("[['a' 1] ['b' 2] ['c' 3]] REC ['b'] OMIT");
    expect(interp.stack_pop()).toEqual({ a: 1, c: 3 });
  });

  test("REC>ENTRIES produces pair-array sorted by key", async () => {
    await interp.run("[['b' 2] ['a' 1] ['c' 3]] REC REC>ENTRIES");
    expect(interp.stack_pop()).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  test("ENTRIES>REC builds record from pair-array", async () => {
    await interp.run("[['x' 10] ['y' 20]] ENTRIES>REC");
    expect(interp.stack_pop()).toEqual({ x: 10, y: 20 });
  });

  test("REC>ENTRIES and ENTRIES>REC roundtrip", async () => {
    await interp.run("[['a' 1] ['b' 2]] REC REC>ENTRIES ENTRIES>REC");
    expect(interp.stack_pop()).toEqual({ a: 1, b: 2 });
  });

  test("MERGE: rec2 wins on key conflict", async () => {
    await interp.run("[['a' 1] ['b' 2]] REC [['b' 99] ['c' 3]] REC MERGE");
    expect(interp.stack_pop()).toEqual({ a: 1, b: 99, c: 3 });
  });

  test("MERGE replaces REC-DEFAULTS pattern", async () => {
    // Defaults on left, input on right (input wins for present keys; defaults fill missing)
    await interp.run("[['name' 'default'] ['age' 0]] REC [['name' 'Alice']] REC MERGE");
    expect(interp.stack_pop()).toEqual({ name: "Alice", age: 0 });
  });
});

describe("CONCAT extension for arrays", () => {
  test("two strings concatenate", async () => {
    await interp.run("'hello' 'world' CONCAT");
    expect(interp.stack_pop()).toBe("helloworld");
  });

  test("two arrays concatenate", async () => {
    await interp.run("[1 2] [3 4] CONCAT");
    expect(interp.stack_pop()).toEqual([1, 2, 3, 4]);
  });

  test("array of strings still joins to one string", async () => {
    await interp.run("['a' 'b' 'c'] CONCAT");
    expect(interp.stack_pop()).toBe("abc");
  });

  test("array of arrays flattens one level", async () => {
    await interp.run("[[1 2] [3] [4 5]] CONCAT");
    expect(interp.stack_pop()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("MAP-AT path-array support (deep update)", () => {
  test("single-key form still works", async () => {
    await interp.run("[['a' 1]] REC 'a' '10 *' MAP-AT");
    expect(interp.stack_pop()).toEqual({ a: 10 });
  });

  test("path-array on nested record", async () => {
    await interp.run("[['user' [['name' 'alice'] ['age' 30]] REC]] REC ['user' 'age'] '1 +' MAP-AT");
    expect(interp.stack_pop()).toEqual({ user: { name: "alice", age: 31 } });
  });

  test("path-array mixing record key and array index", async () => {
    await interp.run("[['scores' [10 20 30]]] REC ['scores' 1] '100 *' MAP-AT");
    expect(interp.stack_pop()).toEqual({ scores: [10, 2000, 30] });
  });

  test("empty path-array applies forthic to whole container", async () => {
    await interp.run("42 [] '1 +' MAP-AT");
    expect(interp.stack_pop()).toBe(43);
  });

  test("missing path leaves container unchanged", async () => {
    await interp.run("[['a' 1]] REC ['nope' 'still-nope'] '0 *' MAP-AT");
    expect(interp.stack_pop()).toEqual({ a: 1 });
  });
});

describe("String additions (PR 6)", () => {
  test("STARTS-WITH? true for matching prefix", async () => {
    await interp.run("'hello world' 'hello' STARTS-WITH?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("STARTS-WITH? false for non-matching prefix", async () => {
    await interp.run("'hello' 'world' STARTS-WITH?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("ENDS-WITH? true for matching suffix", async () => {
    await interp.run("'hello.json' '.json' ENDS-WITH?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("TRIM-PREFIX strips matching prefix", async () => {
    await interp.run("'/api/users' '/api/' TRIM-PREFIX");
    expect(interp.stack_pop()).toBe("users");
  });

  test("TRIM-PREFIX leaves str unchanged when no match", async () => {
    await interp.run("'hello' 'xyz' TRIM-PREFIX");
    expect(interp.stack_pop()).toBe("hello");
  });

  test("TRIM-SUFFIX strips matching suffix", async () => {
    await interp.run("'data.json' '.json' TRIM-SUFFIX");
    expect(interp.stack_pop()).toBe("data");
  });

  test("RE-MATCH? true for matching pattern", async () => {
    await interp.run("'abc123' '[0-9]+' RE-MATCH?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("RE-MATCH? false for non-matching pattern", async () => {
    await interp.run("'abc' '[0-9]+' RE-MATCH?");
    expect(interp.stack_pop()).toBe(false);
  });
});

describe("Collection additions (PR 6)", () => {
  test("FIND returns first matching item", async () => {
    await interp.run("[1 2 3 4 5] '3 >' FIND");
    expect(interp.stack_pop()).toBe(4);
  });

  test("FIND returns null when no match", async () => {
    await interp.run("[1 2 3] '99 >' FIND");
    expect(interp.stack_pop()).toBeNull();
  });

  test("COUNT counts matching items", async () => {
    await interp.run("[1 2 3 4 5] '2 >' COUNT");
    expect(interp.stack_pop()).toBe(3);
  });

  test("SORT-BY sorts by computed key (negation reverses)", async () => {
    await interp.run("[3 1 2] '-1 *' SORT-BY");
    // Sort by (item * -1) ascending → original sorted descending
    expect(interp.stack_pop()).toEqual([3, 2, 1]);
  });

  test("SORT-BY with identity key", async () => {
    await interp.run("[3 1 2] '0 +' SORT-BY");
    expect(interp.stack_pop()).toEqual([1, 2, 3]);
  });

  test("MIN-BY returns item with smallest key", async () => {
    await interp.run("[3 1 4 1 5] '0 +' MIN-BY");
    expect(interp.stack_pop()).toBe(1);
  });

  test("MAX-BY returns item with largest key", async () => {
    await interp.run("[3 1 4 1 5] '0 +' MAX-BY");
    expect(interp.stack_pop()).toBe(5);
  });

  test("UNIQUE-BY dedupes by computed key", async () => {
    await interp.run("[1 2 3 4 5] '2 MOD' UNIQUE-BY");
    // Group by parity; keep first of each: 1 (odd), 2 (even)
    expect(interp.stack_pop()).toEqual([1, 2]);
  });

  test("NUMBERED enumerates with index", async () => {
    await interp.run("['a' 'b' 'c'] NUMBERED");
    expect(interp.stack_pop()).toEqual([
      [0, "a"],
      [1, "b"],
      [2, "c"],
    ]);
  });

  test("ALL? true when every item matches", async () => {
    await interp.run("[2 4 6] '2 MOD 0 ==' ALL?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("ALL? false when any item fails", async () => {
    await interp.run("[2 4 5] '2 MOD 0 ==' ALL?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("ANY? true when any item matches", async () => {
    await interp.run("[1 3 5 6] '2 MOD 0 ==' ANY?");
    expect(interp.stack_pop()).toBe(true);
  });

  test("ANY? false when no item matches", async () => {
    await interp.run("[1 3 5] '2 MOD 0 ==' ANY?");
    expect(interp.stack_pop()).toBe(false);
  });

  test("TAKE-LAST on array", async () => {
    await interp.run("[1 2 3 4 5] 2 TAKE-LAST");
    expect(interp.stack_pop()).toEqual([4, 5]);
  });
});

describe("Math aggregates (PR 6)", () => {
  test("PRODUCT of numbers", async () => {
    await interp.run("[2 3 4] PRODUCT");
    expect(interp.stack_pop()).toBe(24);
  });

  test("PRODUCT of empty array is 1", async () => {
    await interp.run("[] PRODUCT");
    expect(interp.stack_pop()).toBe(1);
  });

  test("MAX-OF picks the maximum", async () => {
    await interp.run("[3 7 2 5] MAX-OF");
    expect(interp.stack_pop()).toBe(7);
  });

  test("MIN-OF picks the minimum", async () => {
    await interp.run("[3 7 2 5] MIN-OF");
    expect(interp.stack_pop()).toBe(2);
  });
});

describe("Date getters (PR 6)", () => {
  test("YEAR extracts year", async () => {
    await interp.run("2026-05-01 YEAR");
    expect(interp.stack_pop()).toBe(2026);
  });

  test("MONTH extracts month", async () => {
    await interp.run("2026-05-01 MONTH");
    expect(interp.stack_pop()).toBe(5);
  });

  test("DAY-OF-WEEK extracts ISO day-of-week", async () => {
    // 2026-05-01 is a Friday → ISO day 5
    await interp.run("2026-05-01 DAY-OF-WEEK");
    expect(interp.stack_pop()).toBe(5);
  });
});

describe("REPLACE / RE-REPLACE (PR 7 footgun fix)", () => {
  test("REPLACE does literal substitution", async () => {
    await interp.run("'a.b.c.d' '.' '_' REPLACE");
    expect(interp.stack_pop()).toBe("a_b_c_d");
  });

  test("REPLACE does not interpret regex metacharacters", async () => {
    await interp.run("'hello world' '.' 'X' REPLACE");
    expect(interp.stack_pop()).toBe("hello world");
  });

  test("RE-REPLACE does regex substitution", async () => {
    await interp.run("'abc123def' '[0-9]+' 'NUM' RE-REPLACE");
    expect(interp.stack_pop()).toBe("abcNUMdef");
  });

  test("RE-REPLACE supports anchors", async () => {
    await interp.run("'foo bar' '^foo' 'baz' RE-REPLACE");
    expect(interp.stack_pop()).toBe("baz bar");
  });
});

describe("Bash-flavored layer (PR 7)", () => {
  test("LINES splits on newline", async () => {
    // Build "a\nb\nc" via /N JOIN, then exercise LINES on it
    await interp.run("['a' 'b' 'c'] /N JOIN LINES");
    expect(interp.stack_pop()).toEqual(["a", "b", "c"]);
  });

  test("UNLINES joins with newline", async () => {
    await interp.run("['a' 'b' 'c'] UNLINES");
    expect(interp.stack_pop()).toBe("a\nb\nc");
  });

  test("LINES and UNLINES roundtrip", async () => {
    await interp.run("['foo' 'bar' 'baz'] UNLINES LINES");
    expect(interp.stack_pop()).toEqual(["foo", "bar", "baz"]);
  });

  test("GREP keeps matching lines", async () => {
    await interp.run("['apple' 'banana' 'cherry' 'avocado'] '^a' GREP");
    expect(interp.stack_pop()).toEqual(["apple", "avocado"]);
  });

  test("GREP-V keeps non-matching lines", async () => {
    await interp.run("['apple' 'banana' 'cherry' 'avocado'] '^a' GREP-V");
    expect(interp.stack_pop()).toEqual(["banana", "cherry"]);
  });

  test("SED replaces in each line", async () => {
    await interp.run("['hello world' 'hello there'] 'hello' 'hi' SED");
    expect(interp.stack_pop()).toEqual(["hi world", "hi there"]);
  });

  test("SED uses regex semantics", async () => {
    await interp.run("['abc123' 'def456'] '[0-9]+' 'X' SED");
    expect(interp.stack_pop()).toEqual(["abcX", "defX"]);
  });

  test("CUT picks the field-th column", async () => {
    await interp.run("['a,b,c' 'd,e,f' 'g,h,i'] ',' 1 CUT");
    expect(interp.stack_pop()).toEqual(["b", "e", "h"]);
  });

  test("CUT returns null for out-of-range field", async () => {
    await interp.run("['a,b' 'c,d,e'] ',' 2 CUT");
    expect(interp.stack_pop()).toEqual([null, "e"]);
  });

  test("SORT-U sorts and dedupes", async () => {
    await interp.run("[3 1 2 1 3 2] SORT-U");
    expect(interp.stack_pop()).toEqual([1, 2, 3]);
  });

  test("SORT-U on strings", async () => {
    await interp.run("['banana' 'apple' 'banana' 'cherry' 'apple'] SORT-U");
    expect(interp.stack_pop()).toEqual(["apple", "banana", "cherry"]);
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

  test("REC-DEFAULTS still works (now in classic, MERGE is the surface)", async () => {
    await interp.run("[['name' 'Alice']] REC [['name' 'default'] ['age' 0]] REC-DEFAULTS");
    expect(interp.stack_pop()).toEqual({ name: "Alice", age: 0 });
  });
});
