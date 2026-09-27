import { StandardInterpreter } from "../../../interpreter";
import { to_literal } from "../../../code";
import { Closure, new_local_frame } from "../../../closure";
import { CollectionMark, CodeLocation } from "../../../tokenizer";
import { WordOptions } from "../../../word_options";

/**
 * Code as data: >LITERAL, CODE>, >CODE, GENSYM.
 *
 * The laws the words exist to keep:
 *   value >LITERAL RUN          ≡ value
 *   code CODE> >CODE CODE>      ≡ code CODE>
 */

async function run(code: string) {
  const interp = new StandardInterpreter();
  await interp.run(code);
  return interp;
}

async function top(code: string) {
  return (await run(code)).stack_pop();
}

// Push a value, write it as a literal, and run the literal in a fresh interpreter.
async function literal_round_trip(value: any) {
  const interp = new StandardInterpreter();
  interp.stack_push(value);
  await interp.run(">LITERAL");
  const code = interp.stack_pop();
  const reader = new StandardInterpreter();
  await reader.run(code);
  expect(reader.get_stack().length).toBe(1);
  return { code, value: reader.stack_pop() };
}

describe(">LITERAL", () => {
  test.each([
    [null, "NULL"],
    [true, "TRUE"],
    [false, "FALSE"],
    [42, "42"],
    [-7, "-7"],
    [2.5, "2.5"],
    [1e21, "1.0e+21"], // no bare exponent literal: a float needs a decimal point
    [1e-7, "1.0e-7"],
    ["plain", "'plain'"],
    ["", "''"],
    ["he's", "'he\\'s'"],
    ["a\nb\tc", "'a\\nb\\tc'"],
    ["C:\\temp", "'C:\\\\temp'"],
    [[], "[ ]"],
    [[1, "a"], "[ 1 'a' ]"],
    [{}, "{ }"],
    [{ name: "Ann", tags: ["x"] }, "{ .name 'Ann' .tags [ 'x' ] }"],
  ])("writes %j as %s", async (value, expected) => {
    const { code } = await literal_round_trip(value);
    expect(code).toBe(expected);
  });

  test.each([
    ["nested data", { a: { b: [1, 2.5, null, true, "x"] }, c: [] }],
    ["every string escape", "q' dq\" bs\\ nl\n tab\t cr\r nul\0 end"],
    ["regex-like text", "\\d+\\w*"],
    ["HTML entities", "&lt;b&gt;AT&amp;T"],
    ["unicode", "héllo — 世界 🎉"],
    ["a key that is not a dot symbol", { "first name": "Ann", "a[0]": 1 }],
    ["a key with a comment character", { "#tag": 1 }],
    ["a key that is a word delimiter", { "(x)": 1, "a,b": 2 }],
  ])("round-trips %s", async (_label, value) => {
    expect((await literal_round_trip(value)).value).toEqual(value);
  });

  test("a record whose keys are not all dot symbols is written with REC", async () => {
    const { code } = await literal_round_trip({ "first name": "Ann" });
    expect(code).toBe("[ [ 'first name' 'Ann' ] ] REC");
  });

  test("dates and times round-trip", async () => {
    const date = Temporal.PlainDate.from("2025-05-20");
    expect(await literal_round_trip(date)).toEqual({
      code: "2025-05-20",
      value: date,
    });

    const time = Temporal.PlainTime.from("09:30");
    expect(await literal_round_trip(time)).toEqual({
      code: "9:30",
      value: time,
    });

    // The bare time literal is HH:MM, so seconds go through >TIME.
    const precise = Temporal.PlainTime.from("09:30:15.25");
    const r = await literal_round_trip(precise);
    expect(r.code).toBe("'09:30:15.25' >TIME");
    expect(r.value.equals(precise)).toBe(true);

    const zoned = Temporal.ZonedDateTime.from(
      "2025-05-20T08:00:00-07:00[America/Los_Angeles]",
    );
    const z = await literal_round_trip(zoned);
    expect(z.value.equals(zoned)).toBe(true);
  });

  test("a hostile string stays one string", async () => {
    const hostile = "x' TRUE .pwned ! 'y";
    const interp = new StandardInterpreter();
    interp.stack_push(hostile);
    await interp.run(">LITERAL RUN");
    expect(interp.stack_pop()).toBe(hostile);
    expect(interp.get_stack().length).toBe(0);
    await expect(interp.run(".pwned @")).rejects.toThrow("Unknown variable");
  });

  test.each([
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["an instant", Temporal.Instant.from("2025-05-20T08:00:00Z")],
    ["a closure", new Closure("1", null, new_local_frame())],
    ["word options", new WordOptions({ depth: 1 })],
    ["a collection mark", new CollectionMark("array", new CodeLocation())],
  ])("%s has no literal", (_label, value) => {
    expect(() => to_literal(value)).toThrow("has no Forthic literal");
  });
});

describe("CODE>", () => {
  test("reads every kind of token, and drops comments", async () => {
    const code = `1 'a\\'b' .x ! # a comment
      : SQ DUP * ;  @: CACHED 2 ;  [ 1 ] { .k 2 }`;
    expect(await top(`r"""${code}""" CODE>`)).toEqual([
      "1",
      { str: "a'b" },
      { dot: "x" },
      "!",
      { def: "SQ" },
      "DUP",
      "*",
      ";",
      { memo: "CACHED" },
      "2",
      ";",
      "[",
      "1",
      "]",
      "{",
      { dot: "k" },
      "2",
      "}",
    ]);
  });

  test("does not run the code", async () => {
    const interp = await run(`'5 .ran !' CODE>`);
    await expect(interp.run(".ran @")).rejects.toThrow("Unknown variable");
  });

  test("rejects a redirect string", async () => {
    await expect(run(`r"""<<'''text'''""" CODE>`)).rejects.toThrow("redirect");
  });
});

describe(">CODE", () => {
  test.each([
    "1 2 + 3 *",
    ": SQ DUP * ;  4 SQ",
    `[ 'he\\'s' "dq" '''multi\nline''' r'C:\\temp' ] CONCAT`,
    "{ .a [ 1 2 ] .b { .c 'x' } } [.b .c] REC@",
    "@: TWO 2 ;  TWO TWO +",
    "2025-05-20T08:00:00[America/Los_Angeles] >DATE",
    "[ 3 1 2 ] { .comparator '-1 *' } ~> SORT",
  ])(
    "CODE> >CODE CODE> equals CODE>, and the code runs the same: %s",
    async (code) => {
      const interp = new StandardInterpreter();
      interp.stack_push(code);
      await interp.run("CODE>");
      const quotation = interp.stack_pop();
      interp.stack_push(quotation);
      await interp.run(">CODE");
      const rewritten = interp.stack_pop();

      const again = new StandardInterpreter();
      again.stack_push(rewritten);
      await again.run("CODE>");
      expect(again.stack_pop()).toEqual(quotation);

      const original_result = (await run(code)).get_stack().get_items();
      const rewritten_result = (await run(rewritten)).get_stack().get_items();
      expect(rewritten_result).toEqual(original_result);
    },
  );

  test("any other item is a value, so a quotation is a template", async () => {
    expect(await top(`[ 5 'DUP' '*' ] >CODE`)).toBe("5 DUP *");
    expect(await top(`[ 5 'DUP' '*' ] >CODE RUN`)).toBe(25);
    expect(await top(`[ { .str "it's" } 'STR-LENGTH' ] >CODE RUN`)).toBe(4);
    expect(await top(`[ { .a 1 } [.a] 'REC@' ] >CODE RUN`)).toBe(1);
  });

  test("a record with more than a tag key is a value, not a token", async () => {
    expect(await top(`[ { .str 'x' .n 1 } ] >CODE`)).toBe("{ .str 'x' .n 1 }");
  });

  test.each([
    ["two words in one item", `[ 'DUP DUP' ]`, "not a single word"],
    ["a quoted string as a word", `[ "'a'" ]`, "not a single word"],
    ["a dot symbol as a word", `[ '.x' ]`, "not a single word"],
    ["a dot name with a space", `[ { .dot 'a b' } ]`, "not a valid dot name"],
    [
      "a definition name with a bracket",
      `[ { .def 'A[' } ]`,
      "not a valid def name",
    ],
  ])("rejects %s", async (_label, code, message) => {
    await expect(run(`${code} >CODE`)).rejects.toThrow(message);
  });

  test("rejects a value that is not a quotation", async () => {
    await expect(run(`'DUP' >CODE`)).rejects.toThrow("requires a quotation");
  });
});

describe("GENSYM", () => {
  test("makes distinct names from one prefix", async () => {
    const interp = await run(`'tmp' GENSYM 'tmp' GENSYM`);
    const [a, b] = interp.get_stack().get_items();
    expect(a).toMatch(/^tmp~\d+$/);
    expect(b).toMatch(/^tmp~\d+$/);
    expect(a).not.toBe(b);
  });

  test("a gensym works as a variable and as a dot symbol in code", async () => {
    const code = `
      : T   'tmp' GENSYM .name !
            7 .name @ !
            [ { .dot .name @ } '@' ] >CODE RUN ;
      T`;
    expect(await top(code)).toBe(7);
  });

  test("rejects a prefix that cannot make a name", async () => {
    await expect(run(`'a b' GENSYM`)).rejects.toThrow(
      "does not make a valid name",
    );
    await expect(run(`'__x' GENSYM`)).rejects.toThrow(
      "does not make a valid name",
    );
  });
});
