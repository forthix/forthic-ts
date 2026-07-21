# Changelog

All notable changes to `@forthix/forthic` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project is pre-1.0: while `0.x`, **breaking changes ship in minor releases**. Releases before 0.16.0 are recorded in the git history rather than here.

## [0.16.1] - 2026-07-21

A bug-fix release for the streaming execution path (`Interpreter.streamingRun`), which drives the interpreter from a live token stream one chunk at a time against a single long-lived interpreter. Four defects — present since at least 0.15.0 — corrupted user-defined words or wedged the interpreter. No API changes; upgrading is safe and recommended for anyone using `streamingRun` or `export_state`/`import_state`.

### Fixed

- **Compile state leaked across turns, permanently wedging the interpreter.** `is_compiling` / `cur_definition` / `is_memo_definition` were never cleared when a turn ended or threw, so any error inside a definition body left the shared interpreter stuck in compile mode. Every later turn was then silently swallowed into an orphaned definition or threw a `MissingSemicolonError` attributed to unrelated code. These are now reset when a streaming turn ends, aborts, or throws — but never between the chunks of a single in-progress turn, so a definition streamed across chunks still works.
- **A chunk boundary right after a bare `:` / `@:` threw `InvalidWordNameError`.** The tokenizer ran off the end of input while looking for the definition name. In streaming mode the incomplete token is now held back (like an unterminated string) and re-read once the name arrives, so a definition no longer succeeds or fails based on where the stream happened to split.
- **A streaming-defined word serialized the wrong source.** The definition body was sliced from the tokenizer's live position, which `streamingRun` had already advanced to the end of the chunk. `export_state` recorded a truncated or shifted body, so `import_state` replayed a different definition than executed (or threw). Tokens now carry the position captured at tokenize time; the non-streaming path is unchanged.
- **`export_state` reverted redefinitions.** It kept the first definition of each word, but redefining a word appends and lookup resolves the last one, so a word redefined in a later turn was snapshotted with its stale body and reverted on restore. It now serializes the live (last) definition, ordered so a redefinition that references a later-defined word restores in a valid order.

## [0.16.0] - 2026-07-13

A correctness-and-safety release. Several word contracts were realigned to the cross-runtime Forthic contract (shared with `forthic-rs` and `forthic-py`), the gRPC transport was removed, and the JSON-RPC server was hardened. **Read the migration notes below before upgrading** — this release removes words and changes semantics.

### Removed

- **gRPC transport, entirely.** The `@forthix/forthic/grpc` entry point, the gRPC client/server, the `@grpc/*` dependencies, and `protos/` are gone. The `./grpc` export and its dependencies were already dropped in 0.15.0; 0.16.0 removes the remaining source, the protocol definitions, and the documentation that still advertised the import path. **JSON-RPC (`@forthix/forthic/jsonrpc`) is the supported server-to-server transport**, and it mirrors the old gRPC surface. `transport: grpc` in `forthic-runtimes.yaml` is now a validation error.
- **`|REC@`.** It built Forthic source by interpolating a field name into a single-quoted string, so a field name containing `'` escaped the string and executed as code. The JQ iterate path is a strict superset and parses the path as data, so the injection class does not exist there. Use `"[].field" JQ@`.
- **`push_error` on `MAP`/`FOREACH`.** It changed word arity via a flag, conflated `NULL` results with failures, and stranded operands on failure. Use `TRY`, or `MAP`'s new `outcomes` option.
- **`INTERPOLATE` in the `string` module.** Core now owns interpolation, with one grammar.

### Added

- **`TRY` — error handling as data.** `TRY ( forthic -- outcome )` yields `{"ok": value}` or `{"error": {message, error_type}}`, restoring the stack to its pre-`TRY` state on failure and unwinding modules the failed code left open. Comes with `OK?`, `ERROR?`, `UNWRAP`, and `UNWRAP-OR`. The law `'CODE' TRY UNWRAP === CODE` is tested.
- **`MAP` `outcomes` option.** `[.outcomes TRUE] ~> MAP` maps each element to `{ok}`/`{error}` with fixed arity and no stranded operands.
- **Standard words**: `UNDEFINED`, `SUBSTR`, `SPLICE`.
- **Word-local variable scoping.** Dot-vars assigned with `!` inside a word are private to that call; an existing module variable still wins, so intentional shared state works.
- **`PlainTime` wire support** in the serializer.
- **CI**: GitHub Actions build/test/smoke on Node 18 and 20.

### Changed

- **`${name}` interpolation grammar.** One contract, mirrored in `forthic-rs`, replacing both the bare-dot grammar and the string module's `{.var}@`. Holes are variable **names only** — `${1 + 2}` is a hard error, so a template can never execute Forthic. Lookup is read-only: a miss renders as the null text and creates nothing, so a typo can no longer mint a variable. The default null text changed from `"null"` to `""`.
- **Record ordering is insertion order, not sorted.** `JQ@` record index/iterate and `REC>ENTRIES` now use raw key order, consistent with `KEYS`/`NTH` and with `forthic-rs`. `REC>ENTRIES ENTRIES>REC` now round-trips. `REC>ENTRIES`' docstring previously promised sorted output; this is a deliberate contract change.
- **Record-shaped words preserve record shape**, and record access words use insertion order.
- **`REVERSE`, `SORT`, `APPEND`, `DELETE`, `VALUES` are copy-on-write** — they no longer mutate their input in place.
- **`>STR` renders records as JSON** instead of `"[object Object]"`.
- **`>DATE` resolves absolute instants in the interpreter's timezone**, and **`>DATETIME` treats zone-carrying strings as instants**.
- **`NOW` returns the correct type**; epoch-0, Temporal equality, and midnight classification are fixed.
- **`undefined` is purged from Forthic data** at three word boundaries — `undefined` is not a Forthic value.
- **JQ paths parse indices strictly.** A malformed `[n]` now errors instead of silently indexing. `JQ!` pads out-of-range array sets with `null`, and errors on negative set indices and field-into-array.
- **`OMIT` stringifies drop keys**, so `[ 1 ] OMIT` matches the key `"1"`.
- **`DELETE` requires integer array keys**; a negative index wraps once, and out-of-range is a no-op.
- **`RANGE`/`SLICE` allocation is bounded.**
- Error locations are tracked per definition rather than on the shared `Word`.
- `dup_interpreter` clones modules instead of sharing them, so a dup's stateful words no longer operate on the source interpreter.

### Security

- **The JSON-RPC server is hardened.** It now **binds `127.0.0.1` by default** (was `0.0.0.0`), supports bearer-token auth, caps the request body, and sanitizes errors (stack traces, which leak absolute server paths, are opt-in via `exposeStackTraces`). **This is breaking for deployments that relied on remote access** — see the migration notes.
- Name-keyed registries are prototype-less, and a prototype-pollution guard was added.

### Fixed

- The standalone JSON-RPC server CLI installs Temporal, so date words work when it is run directly.
- Error-path robustness: the recovery loop, stack invariants, streaming validation, and a crash-proof error formatter.
- Two false word contracts in the docs; the LLM prompt is now self-verifying.

---

## Migration from 0.15.x

### The JSON-RPC server binds loopback

If you ran the server and reached it from another host, it is now unreachable by default. Bind explicitly **and set a token** — the endpoint executes arbitrary words, so never expose it without one:

```typescript
await startJsonRpcServer(8765, {
  host: "0.0.0.0",
  token: process.env.FORTHIC_TOKEN,
});
```

Equivalently: `FORTHIC_JSONRPC_HOST` and `FORTHIC_JSONRPC_TOKEN`. Clients send `Authorization: Bearer <token>`.

### gRPC → JSON-RPC

```diff
- import { GrpcClient, RemoteModule, startGrpcServer } from '@forthix/forthic/grpc';
+ import { JsonRpcClient, RemoteModule, startJsonRpcServer } from '@forthix/forthic/jsonrpc';

- const client = new GrpcClient('localhost:50051');
+ const client = new JsonRpcClient('localhost:8765');
```

`RemoteModule`, `RuntimeManager`, and `ConfigLoader` are unchanged and re-exported from `./jsonrpc`. In `forthic-runtimes.yaml`, drop `transport: grpc` or set it to `jsonrpc`.

### `|REC@` → JQ

```diff
- fields |REC@
+ "[].field" JQ@
```

### `push_error` → `TRY` / `MAP` outcomes

```diff
- [.push_error TRUE] ~> MAP
+ [.outcomes TRUE] ~> MAP    # each element becomes {ok: ...} or {error: {...}}
```

For a single block, `'CODE' TRY` yields `{ok}`/`{error}`; pair it with `OK?`, `ERROR?`, `UNWRAP`, or `UNWRAP-OR`.

### Interpolation

```diff
- "Hello {.name}@!" INTERPOLATE
+ "Hello ${name}!" INTERPOLATE
```

Holes are names only. A missing variable renders as `""` (was `"null"`), and no longer creates the variable. Escape a literal hole with `\${`.

### Record order

If you relied on `REC>ENTRIES` or `JQ@` returning **sorted** keys, they now return **insertion order**. Sort explicitly where you need it.

### Copy-on-write

`REVERSE`, `SORT`, `APPEND`, `DELETE`, and `VALUES` return new values instead of mutating in place. If you depended on the mutation as a side effect, store the result.
