import { StandardInterpreter } from "../../../interpreter";
import { Module, Word, ModuleWord, WordErrorHandler } from "../../../module";
import { IntentionalStopError } from "../../../errors";

describe("Word Error Handlers", () => {
  test("addErrorHandler adds handler to word", () => {
    const word = new Word("TEST");
    const handler: WordErrorHandler = async () => {};

    expect(word.getErrorHandlers()).toHaveLength(0);
    word.addErrorHandler(handler);
    expect(word.getErrorHandlers()).toHaveLength(1);
  });

  test("removeErrorHandler removes specific handler", () => {
    const word = new Word("TEST");
    const handler1: WordErrorHandler = async () => {};
    const handler2: WordErrorHandler = async () => {};

    word.addErrorHandler(handler1);
    word.addErrorHandler(handler2);
    expect(word.getErrorHandlers()).toHaveLength(2);

    word.removeErrorHandler(handler1);
    expect(word.getErrorHandlers()).toHaveLength(1);
    expect(word.getErrorHandlers()[0]).toBe(handler2);
  });

  test("clearErrorHandlers removes all handlers", () => {
    const word = new Word("TEST");
    word.addErrorHandler(async () => {});
    word.addErrorHandler(async () => {});

    expect(word.getErrorHandlers()).toHaveLength(2);
    word.clearErrorHandlers();
    expect(word.getErrorHandlers()).toHaveLength(0);
  });

  test("getErrorHandlers returns a copy", () => {
    const word = new Word("TEST");
    const handler: WordErrorHandler = async () => {};
    word.addErrorHandler(handler);

    const handlers = word.getErrorHandlers();
    handlers.push(async () => {});

    // Original should be unchanged
    expect(word.getErrorHandlers()).toHaveLength(1);
  });

  test("ModuleWord calls error handler when word throws", async () => {
    const interp = new StandardInterpreter();
    let handlerCalled = false;
    let receivedError: Error | null = null;

    const word = new ModuleWord("FAILING-WORD", async () => {
      throw new Error("Test error");
    });

    word.addErrorHandler(async (error, _word, _interp) => {
      handlerCalled = true;
      receivedError = error;
    });

    await word.execute(interp);

    expect(handlerCalled).toBe(true);
    expect(receivedError?.message).toBe("Test error");
  });

  test("Error suppressed when handler succeeds", async () => {
    const interp = new StandardInterpreter();

    const word = new ModuleWord("FAILING-WORD", async () => {
      throw new Error("Test error");
    });

    word.addErrorHandler(async () => {
      // Handler succeeds by returning normally
    });

    // Should not throw
    await expect(word.execute(interp)).resolves.toBeUndefined();
  });

  test("Error propagates when handler throws", async () => {
    const interp = new StandardInterpreter();

    const word = new ModuleWord("FAILING-WORD", async () => {
      throw new Error("Original error");
    });

    word.addErrorHandler(async () => {
      throw new Error("Handler also failed");
    });

    await expect(word.execute(interp)).rejects.toThrow("Original error");
  });

  test("Handlers called in order until one succeeds", async () => {
    const interp = new StandardInterpreter();
    const callOrder: number[] = [];

    const word = new ModuleWord("FAILING-WORD", async () => {
      throw new Error("Test error");
    });

    word.addErrorHandler(async () => {
      callOrder.push(1);
      throw new Error("Handler 1 failed");
    });

    word.addErrorHandler(async () => {
      callOrder.push(2);
      // Handler 2 succeeds
    });

    word.addErrorHandler(async () => {
      callOrder.push(3);
      // Should not be called
    });

    await word.execute(interp);

    expect(callOrder).toEqual([1, 2]);
  });

  test("IntentionalStopError bypasses error handlers", async () => {
    const interp = new StandardInterpreter();
    let handlerCalled = false;

    const word = new ModuleWord("STOPPING-WORD", async () => {
      throw new IntentionalStopError("Intentional stop");
    });

    word.addErrorHandler(async () => {
      handlerCalled = true;
    });

    await expect(word.execute(interp)).rejects.toThrow(IntentionalStopError);
    expect(handlerCalled).toBe(false);
  });

  test("add_module_word creates ModuleWord with error handler support", async () => {
    const interp = new StandardInterpreter();
    const module = new Module("test-module");
    let handlerCalled = false;

    module.add_module_word("FAILING", async () => {
      throw new Error("Test error");
    });

    const word = module.find_word("FAILING");
    expect(word).toBeInstanceOf(ModuleWord);

    word?.addErrorHandler(async () => {
      handlerCalled = true;
    });

    await word?.execute(interp);
    expect(handlerCalled).toBe(true);
  });

  test("Handler receives word and interpreter", async () => {
    const interp = new StandardInterpreter();
    let receivedWord: Word | null = null;
    let receivedInterp: StandardInterpreter | null = null;

    const word = new ModuleWord("TEST-WORD", async () => {
      throw new Error("Test error");
    });

    word.addErrorHandler(async (error, word, interp) => {
      receivedWord = word;
      receivedInterp = interp as StandardInterpreter;
    });

    await word.execute(interp);

    expect(receivedWord).toBe(word);
    expect(receivedInterp).toBe(interp);
  });
});
