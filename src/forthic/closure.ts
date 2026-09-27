import { Variable } from "./module.js";
import type { CodeLocation } from "./tokenizer.js";

/**
 * A word-local variable frame: the dot-vars one call of a user-defined word
 * assigns. Prototype-less, because the keys are names from program text.
 */
export type LocalFrame = { [name: string]: Variable };

export function new_local_frame(): LocalFrame {
  return Object.create(null);
}

/**
 * Closure - A Forthic code string bound to the frame it was created in
 *
 * Made by `CLOSURE`. Running one (`RUN`, `MAP`, `IF-RUN`, ... — anything that
 * calls `interp.run`) pushes its frame as the current word-local frame, so the
 * code reads and writes the dot-vars of the word that created it no matter
 * where it runs: inside another user-defined word, after the creating word has
 * returned, or in a parallel `MAP` interpreter.
 *
 * The frame is held by reference, not copied. A closure that assigns `.acc` is
 * visible to its creator, and several closures made in one call share state.
 * The only place the frame is copied is the wire (see `closure_env_snapshot`),
 * because a reference cannot cross a process boundary.
 *
 * A plain code string still runs in whatever frame is current when it runs.
 * That is unchanged, and it is why built-in higher-order words already worked
 * with locals: they run their code without pushing a frame of their own.
 */
export class Closure {
  code: string;
  location: CodeLocation | null;
  frame: LocalFrame;

  constructor(code: string, location: CodeLocation | null, frame: LocalFrame) {
    this.code = code;
    this.location = location;
    this.frame = frame;
  }

  toString(): string {
    return `<closure: ${this.code}>`;
  }

  // For display paths that JSON-stringify a value (e.g. `{ .json TRUE } ~> PRINT`).
  // Deliberately omits the frame: it is live interpreter state, and a closure
  // stored in its own frame would make it circular. The wire form is built by
  // the serializers, not by this.
  toJSON(): { closure: string } {
    return { closure: this.code };
  }
}

// Frames currently being snapshotted, to turn a cyclic environment into a clear
// error instead of unbounded recursion. A closure stored in its own frame — the
// `.this` of a state machine — is the ordinary way to get one.
const frames_in_progress = new Set<LocalFrame>();

/**
 * Copy a closure's frame for the wire: each variable's value, run through the
 * caller's value serializer. Values the serializer rejects (options, collection
 * marks) raise at the boundary. `serialize` receives the variable name so the
 * caller can build the error path with its own key formatting.
 */
export function closure_env_snapshot<T>(
  closure: Closure,
  serialize: (value: any, name: string) => T,
  path: string,
): { [name: string]: T } {
  if (frames_in_progress.has(closure.frame)) {
    throw new Error(
      `A closure whose environment contains itself cannot be serialized${path ? ` at path: ${path}` : ""}`,
    );
  }
  frames_in_progress.add(closure.frame);
  try {
    const env: { [name: string]: T } = {};
    for (const [name, variable] of Object.entries(closure.frame)) {
      env[name] = serialize(variable.get_value(), name);
    }
    return env;
  } finally {
    frames_in_progress.delete(closure.frame);
  }
}

/**
 * Rebuild a closure from its wire form. The frame is a fresh copy, so writes
 * on this side do not reach the runtime that sent it.
 */
export function closure_from_env(
  code: string,
  env: { [name: string]: any },
): Closure {
  const frame = new_local_frame();
  for (const [name, value] of Object.entries(env)) {
    frame[name] = new Variable(name, value);
  }
  return new Closure(code, null, frame);
}
