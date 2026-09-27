import { StandardInterpreter } from "../../interpreter";

/**
 * The techniques of Doug Hoyte's *Let Over Lambda*, in Forthic.
 *
 * Each test names the book's construct it stands in for. Forthic has no macros,
 * so where the book expands code at compile time these build it at run time:
 * closures (CLOSURE) supply the lexical scope, and code as data (>LITERAL, CODE>,
 * >CODE, GENSYM) supplies the code generation.
 *
 * Not covered, because Forthic cannot do them: compile-time expansion inside a
 * definition, the chapter 7 speed techniques, and tail-call loops (nlet-tail).
 */

async function run(code: string) {
  const interp = new StandardInterpreter();
  await interp.run(code);
  return interp;
}

async function top(code: string) {
  return (await run(code)).stack_pop();
}

describe("Chapter 1: utilities", () => {
  test("group", async () => {
    expect(await top(`[1 2 3 4 5 6 7] 3 GROUPS-OF`)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  test("flatten", async () => {
    expect(await top(`[1 [2 [3 [4]]] 5] FLATTEN`)).toEqual([1, 2, 3, 4, 5]);
  });

  test("fact and choose: a definition can recurse", async () => {
    const code = `
      : FACT     .n !  .n @ 0 ==  '1'  '.n @  .n @ 1 - FACT  *'  IF-RUN ;
      : CHOOSE   .r ! .n !  .n @ FACT  .n @ .r @ - FACT /  .r @ FACT / ;
      5 FACT  10 3 CHOOSE`;
    const interp = await run(code);
    expect(interp.stack_pop()).toBe(120);
    expect(interp.stack_pop()).toBe(120);
  });

  test("symb: build a name, then define and call the word it names", async () => {
    const code = `
      [ { .def [ 'GREET-' 'ANN' ] CONCAT }  { .str 'hello Ann' }  ';' ] >CODE RUN
      GREET-ANN`;
    expect(await top(code)).toBe("hello Ann");
  });
});

describe("Chapter 2: closures", () => {
  test("let over lambda: each counter has its own count", async () => {
    const code = `
      : MAKE-COUNTER   0 .n !  '.n @ 1 + .n !  .n @' CLOSURE ;
      MAKE-COUNTER .a !  MAKE-COUNTER .b !
      .a @ RUN DROP  .a @ RUN DROP  .b @ RUN DROP  .a @ RUN`;
    expect(await top(code)).toBe(3);
  });

  test("let over lambda over let over lambda: shared and private state", async () => {
    // The factory's .total is shared by every child; each child's .n is its own.
    const code = `
      : MAKE-CHILD     .bump-total !  0 .n !
                       '.n @ 1 + .n !  .bump-total @ RUN  .n @' CLOSURE ;
      : MAKE-FACTORY   0 .total !
                       '.total @ 1 + .total !' CLOSURE .bump !
                       { .make   '.bump @ MAKE-CHILD' CLOSURE
                         .total  '.total @'           CLOSURE } ;
      MAKE-FACTORY .f !
      .f @ [.make] REC@ RUN .a !
      .f @ [.make] REC@ RUN .b !
      .a @ RUN DROP  .a @ RUN DROP  .b @ RUN DROP
      .a @ RUN  .f @ [.total] REC@ RUN`;
    const interp = await run(code);
    expect(interp.stack_pop()).toBe(4); // total across both children
    expect(interp.stack_pop()).toBe(3); // a's own count
  });

  test("lexical scope with CLOSURE, dynamic scope without it", async () => {
    // The helper has its own .x. A plain string reads the helper's; a closure
    // reads its creator's. Both are useful, so both remain.
    const helper = `: APPLY   .code !  99 .x !  .code @ RUN ;`;
    expect(await top(`${helper}  : T  10 .x !  1 '.x @ +' APPLY ;  T`)).toBe(
      100,
    );
    expect(
      await top(`${helper}  : T  10 .x !  1 '.x @ +' CLOSURE APPLY ;  T`),
    ).toBe(11);
  });
});

describe("Chapter 3: macro basics", () => {
  test("defmacro that defines functions (defgetter): generate words from data", async () => {
    const code = `
      # ( field:string -- code:string )
      : GETTER-CODE   .f !
          [ { .def [ 'GET-' .f @ ] CONCAT }  '['  { .dot .f @ }  ']'  'REC@'  ';' ] >CODE ;
      : DEFINE-GETTERS   'GETTER-CODE' MAP  ' ' JOIN  RUN ;

      [ 'name' 'age' ] DEFINE-GETTERS
      { .name 'Ann' .age 30 } DUP GET-name SWAP GET-age`;
    const interp = await run(code);
    expect(interp.stack_pop()).toBe(30);
    expect(interp.stack_pop()).toBe("Ann");
  });

  test("a new control structure (unless) is a word that takes a closure", async () => {
    const code = `
      : UNLESS   .code !  '' .code @ IF-RUN ;
      : T        5 .x !  [ FALSE '.x @ 2 *' CLOSURE UNLESS  TRUE '.x @ 3 *' CLOSURE UNLESS ] ;
      T`;
    expect(await top(code)).toEqual([10]);
  });

  test("nlet: a named loop is a closure that calls itself", async () => {
    const code = `
      : SUM-TO   .n !  0 .acc !
          '.n @ 0 >  ".acc @ .n @ + .acc !  .n @ 1 - .n !  .loop @ RUN"  ""  IF-RUN' CLOSURE .loop !
          .loop @ RUN  .acc @ ;
      100 SUM-TO`;
    expect(await top(code)).toBe(5050);
  });

  describe("unwanted capture, and gensym", () => {
    // ( a:string b:string -- code:string ) code that swaps two variables through a
    // temporary. The naive version names the temporary .tmp.
    const swap_code = (temp: string) => `
      : SWAP-CODE   .b ! .a !  ${temp} .t !
          [ { .dot .a @ } '@' { .dot .t @ } '!'
            { .dot .b @ } '@' { .dot .a @ } '!'
            { .dot .t @ } '@' { .dot .b @ } '!' ] >CODE ;
      : TEST        1 .tmp !  2 .y !  'tmp' 'y' SWAP-CODE RUN  [ .tmp @ .y @ ] ;
      TEST`;

    test("a fixed temporary name captures the caller's variable", async () => {
      expect(await top(swap_code(`'tmp'`))).toEqual([2, 2]);
    });

    test("a gensym temporary cannot", async () => {
      expect(await top(swap_code(`'tmp' GENSYM`))).toEqual([2, 1]);
    });
  });
});

describe("Chapter 4: read macros", () => {
  test("sharp-backquote: map a template over data to build code", async () => {
    const code = `[ 'x' 'y' 'z' ]  '.w !  [ .w @ { .str .w @ } ] >CODE' MAP  ' ' JOIN`;
    expect(await top(code)).toBe("x 'x' y 'y' z 'z'");
  });

  test("a word that parses a string is a read macro for its syntax", async () => {
    expect(await top(`r'''{"a": [1, 2]}''' JSON>`)).toEqual({ a: [1, 2] });
  });

  describe("reader security: values in generated code", () => {
    const hostile = `"x' TRUE .pwned ! 'y"`;

    test("text joined into code runs whatever the value contains", async () => {
      const interp = await run(
        `${hostile} .v !  [ "'" .v @ "' .got !" ] CONCAT RUN  .pwned @`,
      );
      expect(interp.stack_pop()).toBe(true);
    });

    test(">LITERAL keeps the value one string", async () => {
      const interp = await run(
        `${hostile} .v !  [ .v @ >LITERAL " .got !" ] CONCAT RUN  .got @`,
      );
      expect(interp.stack_pop()).toBe("x' TRUE .pwned ! 'y");
      await expect(interp.run(".pwned @")).rejects.toThrow("Unknown variable");
    });
  });
});

describe("Chapter 5: programs that program", () => {
  test("dlambda: a record of closures is an object with methods", async () => {
    const code = `
      : SEND           .msg !  [ .msg @ ] REC@ RUN ;
      : MAKE-ACCOUNT   0 .bal !
          { .deposit   '.bal @ + .bal !' CLOSURE
            .withdraw  '.bal @ SWAP - .bal !' CLOSURE
            .balance   '.bal @' CLOSURE } ;
      MAKE-ACCOUNT .acct !
      100 .acct @ 'deposit' SEND
      30  .acct @ 'withdraw' SEND
      .acct @ 'balance' SEND`;
    expect(await top(code)).toBe(70);
  });

  test("an implicit context (with-*): the helper provides a variable to the caller's code", async () => {
    // Deliberately dynamic: a plain string runs in the helper's frame, where .ticket is.
    const helper = `: WITH-TICKET   .code !  { .title 'Fix bug' } .ticket !  .code @ RUN ;`;
    expect(await top(`${helper}  '.ticket @ [.title] REC@' WITH-TICKET`)).toBe(
      "Fix bug",
    );

    // A closure runs in its creator's frame instead, so it does not see .ticket.
    await expect(
      run(`${helper}  : T  '.ticket @' CLOSURE WITH-TICKET ;  T`),
    ).rejects.toThrow();
  });

  test("code walking: transform a program as data, then run it", async () => {
    const code = `'1 2 + 3 *' CODE>  "DUP '+' == SWAP '-' SWAP IF" MAP  >CODE RUN`;
    expect(await top(code)).toBe(-3);
  });
});

describe("Chapter 6: anaphoric macros", () => {
  test("aif: the helper names the tested value .it", async () => {
    const aif = `: AIF   .code !  .it !  .it @ .code @ '' IF-RUN ;`;
    expect(await top(`${aif}  'ann' '.it @ UPPERCASE' AIF`)).toBe("ANN");
    expect(
      (await run(`${aif}  NULL '.it @ UPPERCASE' AIF`)).get_stack().length,
    ).toBe(0);
  });

  test("alambda: a closure that calls itself as .self", async () => {
    const code = `
      : MAKE-FACT   '.n !  .n @ 0 ==  "1"  ".n @  .n @ 1 - .self @ RUN  *"  IF-RUN' CLOSURE .self !
                    .self @ ;
      5 MAKE-FACT RUN`;
    expect(await top(code)).toBe(120);
  });

  test("alet-fsm: the book's going-up / going-down machine", async () => {
    const code = `
      : MAKE-FSM   0 .acc !
          '.n !  .n @ "invert" ==  ".down @ .this !"  ".acc @ .n @ + .acc !"  IF-RUN' CLOSURE .up !
          '.n !  .n @ "invert" ==  ".up @ .this !"    ".acc @ .n @ - .acc !"  IF-RUN' CLOSURE .down !
          .up @ .this !
          '.this @ RUN  .acc @' CLOSURE ;
      MAKE-FSM .f !
      [ 10 .f @ RUN   5 .f @ RUN   'invert' .f @ RUN   3 .f @ RUN   'invert' .f @ RUN   1 .f @ RUN ]`;
    expect(await top(code)).toEqual([10, 15, 15, 12, 12, 13]);
  });

  test("pandoric get/set and hotpatching: open the state, then replace the behavior", async () => {
    // .this is a plain string, so it runs in the box's frame whatever set it.
    const code = `
      : MAKE-BOX   0 .acc !  '.acc @ + .acc !  .acc @' .this !
          { .run    '.this @ RUN' CLOSURE
            .get    '.acc @'      CLOSURE
            .set    '.acc !'      CLOSURE
            .patch  '.this !'     CLOSURE } ;
      MAKE-BOX .box !
      [ 10 .box @ [.run] REC@ RUN
        100 .box @ [.set] REC@ RUN  .box @ [.get] REC@ RUN
        '2 * .acc @ + .acc !  .acc @' .box @ [.patch] REC@ RUN
        5 .box @ [.run] REC@ RUN ]`;
    expect(await top(code)).toEqual([10, 100, 110]);
  });

  test("sub-lexical scope: rename a variable in code text before running it", async () => {
    // The caller's .x is untouched because the code's .x was renamed first.
    const code = `
      : RENAME   .to ! .from !
          "DUP [.dot] REC@ .from @ == SWAP { .dot .to @ } SWAP IF" MAP ;
      : T   1 .x !
          '5 .x !  .x @' CODE>  'x' 'x' GENSYM RENAME  >CODE RUN
          .x @ ;
      [ T ]`;
    expect(await top(code)).toEqual([5, 1]);
  });
});
