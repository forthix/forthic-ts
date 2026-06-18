import { CodeLocation, Token, PositionedString } from "./tokenizer.js";
import { StringRedirectError } from "./errors.js";
import { StringRedirectSink, isStringRedirectSink } from "./string_redirect_sink.js";

// Internal driver for the string-redirect feature. Not part of the public API
// (not re-exported from index.ts); the interpreter owns it. The public contract
// is `StringRedirectSink` in `string_redirect_sink.ts`.

/**
 * The slice of the interpreter the router needs: stack access plus the current
 * input string for error reporting. Keeps the router decoupled from the rest of
 * the Interpreter surface.
 */
export interface StringRedirectHost {
  stack_peek(): any;
  stack_push(val: any): void;
  get_top_input_string(): string;
}

/** The sink and per-redirect state for the one redirect currently in flight. */
interface ActiveRedirect {
  /**
   * The sink chosen at open() — the stack top at that moment. Kept for the
   * identity check in finish() that the same sink is still on top.
   */
  sink: StringRedirectSink;
  /**
   * How many chars of the (cumulative) string have already been written, so each
   * feed pushes only the newly-arrived suffix.
   */
  written: number;
}

/**
 * Adapter between the interpreter's streaming-token / stack world and a
 * StringRedirectSink. Drives the sink on the interpreter's behalf and holds the
 * per-redirect state the interpreter should not have to. Four jobs:
 *
 *   1. Cumulative -> delta diffing. The interpreter hands feed() the cumulative
 *      content-so-far of the open string on every chunk, not an incremental piece.
 *      This tracks `written` and writes only the new suffix.
 *   2. Choosing and validating the sink against the Forthic stack. open() binds the
 *      redirect to whatever sits on top of the stack when the first delta arrives —
 *      typically pushed earlier by a caller word like `REDIRECT<` — and throws a
 *      StringRedirectError if that value is not a sink.
 *   3. The stack effect `( sink -- sink string )`. finish() leaves the completed
 *      string on top (the sink stays beneath, the caller disposes of it), so the
 *      redirected string then behaves like an ordinary string for following words.
 *   4. Lifecycle mapping + mid-redirect defense. Maps the interpreter's three
 *      moments — delta arrived / string completed / turn abandoned — onto the sink's
 *      write / close / abort, and bails if something buries the sink mid-stream.
 *
 * The router does NOT guard sink calls. Per the StringRedirectSink contract, a sink
 * must not throw — write/close/abort are called directly, and a sink that throws
 * aborts the turn. Writes are awaited, so a blocking sink backpressures the generator.
 */
export class StringRedirectRouter {
  private activeRedirect: ActiveRedirect | undefined;

  constructor(private host: StringRedirectHost) {}

  /** Validate the stack top and remember it as the active redirect's sink. */
  private open(location: CodeLocation): ActiveRedirect {
    const top = this.host.stack_peek();
    if (!isStringRedirectSink(top)) {
      throw new StringRedirectError(
        this.host.get_top_input_string(),
        "No StringRedirectSink on top of the stack",
        location,
      );
    }
    this.activeRedirect = { sink: top, written: 0 };
    return this.activeRedirect;
  }

  /**
   * Forward the open string's content-so-far to the sink, opening the redirect
   * lazily on the first call. `content` is the cumulative string; only the
   * not-yet-sent suffix is written. Throws if the stack top is not a sink.
   */
  async feed(content: string, location: CodeLocation): Promise<void> {
    const active = this.activeRedirect ?? this.open(location);
    if (content.length > active.written) {
      const delta = content.slice(active.written);
      active.written = content.length;
      await active.sink.write(delta);
    }
  }

  /**
   * Complete the redirect for a finished string token: forward the final suffix,
   * close the sink, and leave the completed string on top of the stack — the sink
   * stays beneath it (stack effect `( sink -- sink string )`).
   */
  async finish(token: Token): Promise<void> {
    const wasActive = this.activeRedirect !== undefined;
    const active = this.activeRedirect ?? this.open(token.location);
    // Defensive: if deltas were already flowing (opened in a prior chunk), the
    // sink we are about to leave on the stack must still be the stack top. A
    // mismatch means something pushed another value mid-redirect; abandon the
    // remembered sink and bail rather than form a bogus stack effect.
    if (wasActive && this.host.stack_peek() !== active.sink) {
      this.activeRedirect = undefined;
      await active.sink.abort("StringRedirectSink is no longer on top of the stack");
      throw new StringRedirectError(
        this.host.get_top_input_string(),
        "StringRedirectSink is no longer on top of the stack",
        token.location,
      );
    }
    await this.feed(token.string, token.location); // forward any final suffix
    this.activeRedirect = undefined;
    await active.sink.close();
    this.host.stack_push(new PositionedString(token.string, token.location));
  }

  /** Abandon an in-progress redirect. No-op when idle. */
  async abort(): Promise<void> {
    const active = this.activeRedirect;
    if (!active) return;
    this.activeRedirect = undefined;
    await active.sink.abort("redirect aborted");
  }
}
