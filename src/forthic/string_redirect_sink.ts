// StringRedirectSink — the public contract for the string-redirect feature.
//
// A marked string literal (`<<'''…'''`) redirects its text into a StringRedirectSink
// while the string is still being generated. Host apps subclass this and implement
// the transport — `write`/`close`/`abort`; Forthic knows nothing of sockets or
// routing. The interpreter (see the internal StringRedirectRouter) calls `write(delta)`
// per chunk, then `close()` on completion (or `abort()` if abandoned); each is awaited,
// so a method may return a promise. Put transport cleanup in `close`/`abort`:
//
//   class SocketSink extends StringRedirectSink {
//     write(delta) { this.socket.send(delta); }
//     close()      { this.socket.close(); }
//     abort()      { this.socket.close(); }
//     toJSON()     { return { __type: "SocketSink", id: this.id }; }
//   }
//
// CONTRACT: a sink owns its transport errors and MUST NOT throw — the interpreter
// calls these unguarded, so a throw aborts the streaming turn and the completed
// string never lands on the stack. A blocking `write` backpressures the generator.
//
// Identity is a Symbol brand (not `instanceof`, fragile across duplicate package copies).
//
// Stack effect `( sink -- sink string )`: the redirect leaves the completed string on
// top and the sink beneath (it does NOT consume it); the caller drops/keeps the sink.
// Because the sink stays on the stack, a sink must also implement `toJSON` (see below).

export const STRING_REDIRECT_SINK_BRAND: unique symbol = Symbol.for("@forthix/forthic.StringRedirectSink");

/**
 * Abstract host transport a marked string redirects into. Subclass it and
 * implement `write`/`close`/`abort`; do the transport work in `write` and cleanup
 * in `close`/`abort`. These MUST NOT throw — the interpreter calls them unguarded,
 * so a thrown error aborts the streaming turn and the completed string never lands
 * on the stack. Handle transport failures inside the sink.
 */
export abstract class StringRedirectSink {
  readonly [STRING_REDIRECT_SINK_BRAND] = true;

  /** Receive one newly generated chunk of the redirected string. Awaited. */
  abstract write(delta: string): void | Promise<void>;
  /** The redirected string completed; flush/close the transport. Awaited. */
  abstract close(): void | Promise<void>;
  /** The redirect was abandoned; tear the transport down. Awaited. */
  abstract abort(reason?: string): void | Promise<void>;

  /**
   * JSON-safe wire form for the websocket serializer, which encounters the sink
   * because the redirect leaves it on the stack (`( sink -- sink string )`). Required:
   * Forthic can't usefully serialize a live transport, so the host returns a value it
   * can recognize and rehydrate (e.g. `{ __type, id }`). Without it the serializer
   * would walk the subclass's instance fields and leak the transport.
   */
  abstract toJSON(): unknown;
}

/**
 * True for StringRedirectSink instances (brand check, robust across duplicate
 * package copies; also confirms a callable `write`).
 */
export function isStringRedirectSink(value: unknown): value is StringRedirectSink {
  return (
    value != null &&
    typeof value === "object" &&
    (value as any)[STRING_REDIRECT_SINK_BRAND] === true &&
    typeof (value as any).write === "function"
  );
}
