import {
  StandardInterpreter,
  export_state,
  import_state,
} from "../../../interpreter";
import { Closure } from "../../../closure";
import { getForthicType } from "../../../../common/type_utils";
import * as ws from "../../../../websocket/serializer";
import * as wire from "../../../../common/serializer";

/**
 * Closures: `CLOSURE` binds a code string to the word-local frame it was created
 * in, and running it — through RUN or any word that takes code — pushes that
 * frame. A plain code string runs in whatever frame is current when it runs,
 * which is why the cases below that use one fail or answer wrongly.
 */

async function run(code: string) {
  const interp = new StandardInterpreter();
  await interp.run(code);
  return interp;
}

async function top(code: string) {
  return (await run(code)).stack_pop();
}

// A user-defined higher-order word: it keeps the code in its own local `.code`
// and runs it from inside its own frame.
const APPLY = `: APPLY   .code !  .code @ RUN ;`;

describe("the cases a plain code string gets wrong", () => {
  test("a built-in higher-order word already sees the caller's locals", async () => {
    expect(await top(`: T  10 .x !  [1 2 3] '.x @ +' MAP ;  T`)).toEqual([
      11, 12, 13,
    ]);
  });

  test("a user-defined word cannot run a plain string that reads the caller's locals", async () => {
    await expect(
      run(`${APPLY}  : T  10 .x !  1 '.x @ +' APPLY ;  T`),
    ).rejects.toThrow();
  });

  test("a user-defined word runs a closure in the caller's frame", async () => {
    expect(
      await top(`${APPLY}  : T  10 .x !  1 '.x @ +' CLOSURE APPLY ;  T`),
    ).toBe(11);
  });

  test("a helper's same-named local does not capture the caller's", async () => {
    const helper = `: APPLY   .code !  99 .x !  .code @ RUN ;`;
    // With a plain string the helper's .x wins and the answer is 100.
    expect(await top(`${helper}  : T  10 .x !  1 '.x @ +' APPLY ;  T`)).toBe(
      100,
    );
    expect(
      await top(`${helper}  : T  10 .x !  1 '.x @ +' CLOSURE APPLY ;  T`),
    ).toBe(11);
  });

  test("a closure outlives the word that made it", async () => {
    expect(
      await top(
        `: MAKE-ADDER  10 .x !  '.x @ +' CLOSURE ;  MAKE-ADDER .adder !  1 .adder @ RUN`,
      ),
    ).toBe(11);
  });

  test("a closure works in a parallel MAP", async () => {
    expect(
      await top(
        `: T  10 .x !  [1 2 3 4] '.x @ +' CLOSURE { .interps 2 } ~> MAP ;  T`,
      ),
    ).toEqual([11, 12, 13, 14]);
  });
});

describe("the frame is shared, not copied", () => {
  // The creating word's frame leaves the frame stack when the word returns, but
  // the closure still holds the frame object. It sees every variable the word
  // put there — including ones assigned after CLOSURE — at their latest values.
  test("a stored closure run later sees the frame as the word left it", async () => {
    const code = `
      : T   10 .x !  '.x @ .y @ +' CLOSURE .f !  5 .y !  20 .x !  .f @ ;
      : OTHER   1 .x !  2 .y ! ;
      T .saved !
      OTHER
      .saved @ RUN  .saved @ RUN`;
    const interp = await run(code);
    expect(interp.stack_pop()).toBe(25);
    expect(interp.stack_pop()).toBe(25);
  });

  test("writes reach the creating word", async () => {
    const code = `
      : MY-FOREACH   .f !  .items !  .items @ .f @ FOREACH ;
      : SUM   0 .acc !  [1 2 3 4] '.acc @ + .acc !' CLOSURE MY-FOREACH  .acc @ ;
      SUM`;
    expect(await top(code)).toBe(10);
  });

  test("each call of the creating word gets its own frame", async () => {
    const code = `
      : MAKE-COUNTER   0 .n !  '.n @ 1 + .n !  .n @' CLOSURE ;
      MAKE-COUNTER .a !  MAKE-COUNTER .b !
      .a @ RUN DROP  .a @ RUN DROP  .a @ RUN  .b @ RUN`;
    const interp = await run(code);
    expect(interp.stack_pop()).toBe(1);
    expect(interp.stack_pop()).toBe(3);
  });

  test("closures made in one call share state", async () => {
    const code = `
      : MAKE-ACCOUNT   0 .bal !
          { .deposit '.bal @ + .bal !' CLOSURE
            .balance '.bal @'          CLOSURE } ;
      MAKE-ACCOUNT .acct !
      100 .acct @ [.deposit] REC@ RUN
      25  .acct @ [.deposit] REC@ RUN
      .acct @ [.balance] REC@ RUN`;
    expect(await top(code)).toBe(125);
  });

  test("a closure made while a closure runs shares its frame", async () => {
    const code = `
      : T   5 .x !  "'.x @ 2 *' CLOSURE" CLOSURE RUN ;
      T RUN`;
    expect(await top(code)).toBe(10);
  });

  test("a state machine: states swap the closure held in .this", async () => {
    const code = `
      : MAKE-TOGGLE   0 .acc !
          '.acc @ + .acc !  .down @ .this !' CLOSURE .up !
          '.acc @ SWAP - .acc !  .up @ .this !' CLOSURE .down !
          .up @ .this !
          '.this @ RUN  .acc @' CLOSURE ;
      MAKE-TOGGLE .t !
      10 .t @ RUN DROP  3 .t @ RUN DROP  1 .t @ RUN`;
    expect(await top(code)).toBe(8);
  });
});

describe("words that take code accept a closure", () => {
  test("IF-RUN", async () => {
    expect(
      await top(`: T  2 .x !  TRUE '.x @ 10 *' CLOSURE '0' IF-RUN ;  T`),
    ).toBe(20);
  });

  test("TRY", async () => {
    expect(await top(`: T  2 .x !  '.x @ 1 +' CLOSURE TRY ;  T`)).toEqual({
      ok: 3,
    });
  });

  test("SORT's comparator option", async () => {
    const code = `: T  -1 .dir !  [3 1 2] { .comparator '.dir @ *' CLOSURE } ~> SORT ;  T`;
    expect(await top(code)).toEqual([3, 2, 1]);
  });
});

describe("frame bookkeeping", () => {
  test("a failing closure restores the caller's frame", async () => {
    const code = `
      : MAKE-BAD   1 .x !  'NO-SUCH-WORD' CLOSURE ;
      : T   7 .y !  MAKE-BAD TRY DROP  .y @ ;
      T`;
    expect(await top(code)).toBe(7);
  });

  test("a top-level closure gets a private frame of its own", async () => {
    // New locals stay in the closure's frame instead of becoming module variables...
    await expect(run(`'42 .tmp !' CLOSURE RUN  .tmp @`)).rejects.toThrow(
      "Unknown variable",
    );

    // ...and persist across its runs.
    const interp = await run(`'.tmp !' CLOSURE`);
    const closure = interp.stack_pop() as Closure;
    interp.stack_push(42);
    await interp.run(closure);
    expect(closure.frame["tmp"].get_value()).toBe(42);
  });

  test("module variables stay reachable, and writes to them stay module writes", async () => {
    expect(await top(`10 .m !  1 '.m @ +' CLOSURE RUN`)).toBe(11);
    expect(await top(`10 .m !  '99 .m !' CLOSURE RUN  .m @`)).toBe(99);
  });
});

describe("closure words", () => {
  test("CLOSURE? and CLOSURE-CODE", async () => {
    const interp = await run(
      `'1 2 +' CLOSURE DUP CLOSURE? SWAP CLOSURE-CODE  '1 2 +' CLOSURE?`,
    );
    expect(interp.stack_pop()).toBe(false);
    expect(interp.stack_pop()).toBe("1 2 +");
    expect(interp.stack_pop()).toBe(true);
  });

  test("CLOSURE-CODE rejects a non-closure", async () => {
    await expect(run(`'1 2 +' CLOSURE-CODE`)).rejects.toThrow(
      "requires a closure",
    );
  });

  test(">JSON shows the code, not the frame", async () => {
    expect(await top(`: T  10 .x !  '.x @' CLOSURE ;  T >JSON`)).toBe(
      `{"closure":".x @"}`,
    );
  });
});

describe("the wire copies the frame", () => {
  async function make_adder() {
    const interp = await run(`: MK  10 .x !  '.x @ +' CLOSURE ;  MK`);
    return interp.stack_pop() as Closure;
  }

  test("a closure is its own wire type", async () => {
    expect(getForthicType(await make_adder())).toBe("closure");
  });

  test("websocket form: code plus env", async () => {
    expect(ws.serializeValue(await make_adder())).toEqual({
      type: "closure",
      value: { code: ".x @ +", env: { x: { type: "int", value: 10 } } },
    });
  });

  test("JSON-RPC form: code plus env", async () => {
    expect(wire.serializeValue(await make_adder())).toEqual({
      closure_value: { code: ".x @ +", env: { x: { int_value: 10 } } },
    });
  });

  test.each([
    ["websocket", ws],
    ["JSON-RPC", wire],
  ])(
    "a %s round trip runs, and its writes stay on the far side",
    async (_label, serializer: any) => {
      const original = await make_adder();
      const copy = serializer.deserializeValue(
        serializer.serializeValue(original),
      ) as Closure;

      const interp = new StandardInterpreter();
      interp.stack_push(1);
      await interp.run(copy);
      expect(interp.stack_pop()).toBe(11);

      copy.frame["x"].set_value(500);
      expect(original.frame["x"].get_value()).toBe(10);
    },
  );

  test("a closure whose frame holds itself is a clear error", async () => {
    const interp = await run(`: MK  '.self @' CLOSURE .self !@ ;  MK`);
    expect(() => ws.serializeValue(interp.stack_pop())).toThrow(
      "contains itself",
    );
  });

  test("export_state and import_state keep a closure in a variable", async () => {
    const source = await run(`: MK  10 .x !  '.x @ +' CLOSURE ;  MK .adder !`);
    const target = new StandardInterpreter();
    await import_state(
      target,
      JSON.parse(JSON.stringify(export_state(source))),
    );
    await target.run(`1 .adder @ RUN`);
    expect(target.stack_pop()).toBe(11);
  });
});
