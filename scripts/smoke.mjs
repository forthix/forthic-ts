/**
 * Post-build smoke test: verifies the published entry points actually load and
 * run, in both ESM and CommonJS, for every export subpath. This catches
 * packaging regressions that unit tests cannot — e.g. an ESM-incompatible
 * `require.main` in a server module, or the global `Temporal` contract.
 *
 * Run after `npm run build`:  node scripts/smoke.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const failures = [];

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok    ${label}`);
  } catch (err) {
    console.error(`  FAIL  ${label}\n        ${err.message.split("\n")[0]}`);
    failures.push(label);
  }
}

// ESM entry points must import without throwing.
await check("esm import .", () => import("../dist/esm/index.js"));
await check("esm import ./jsonrpc", () => import("../dist/esm/jsonrpc/index.js"));
await check("esm import ./websocket", () => import("../dist/esm/websocket/index.js"));

// CommonJS entry points must require without throwing.
await check("cjs require .", async () => require("../dist/cjs/index.js"));
await check("cjs require ./jsonrpc", async () => require("../dist/cjs/jsonrpc/index.js"));
await check("cjs require ./websocket", async () => require("../dist/cjs/websocket/index.js"));

// The runtime must actually execute a program.
await check("interpreter runs a definition", async () => {
  const { StandardInterpreter } = await import("../dist/esm/index.js");
  const interp = new StandardInterpreter();
  await interp.run(": DOUBLE 2 * ; 5 DOUBLE");
  const [result] = interp.get_stack().get_items();
  if (result !== 10) throw new Error(`expected 10, got ${result}`);
});

// The documented Temporal contract: with a global Temporal provided, date
// words work. (temporal-polyfill is a devDependency, so it is present in CI.)
await check("date words work when global Temporal is provided", async () => {
  await import("temporal-polyfill/global");
  const { StandardInterpreter } = await import("../dist/esm/index.js");
  const interp = new StandardInterpreter();
  await interp.run("TODAY");
  const [today] = interp.get_stack().get_items();
  if (today == null) throw new Error("TODAY produced no value");
});

// The standalone JSON-RPC server CLI must work in a bare node process. The
// library deliberately does NOT install a global Temporal (the polyfill is an
// optional peer dep, so consumers can bring their own), but the CLI is a
// first-party executable: without a Temporal global it deserialized every
// date/time value on the wire into "ReferenceError: Temporal is not defined".
// A unit test cannot catch this — jest's setup installs the polyfill globally.
await check("jsonrpc server CLI round-trips a date", async () => {
  const { spawn } = await import("node:child_process");
  const port = 18994;
  const server = spawn(
    process.execPath,
    ["dist/cjs/jsonrpc/server.js", "--port", String(port)],
    { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" },
  );
  try {
    const endpoint = `http://127.0.0.1:${port}/rpc`;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "executeWord",
      params: {
        word_name: "DUP",
        stack: [{ plain_date_value: { iso8601_date: "2020-06-05" } }],
      },
    });
    let response;
    for (let i = 0; i < 100; i++) {
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!response) throw new Error("server never accepted connections");
    const payload = await response.json();
    if (payload.error) {
      throw new Error(`server errored: ${JSON.stringify(payload.error.data ?? payload.error)}`);
    }
    const stack = payload.result?.result_stack ?? [];
    if (stack.length !== 2 || stack[0]?.plain_date_value?.iso8601_date !== "2020-06-05") {
      throw new Error(`date did not round-trip: ${JSON.stringify(stack)}`);
    }
  } finally {
    server.kill();
  }
});

// The LLM prompt (docs/forthic-prompt.md) carries handwritten prose that
// nothing else verifies, so it drifts against the runtime: it once taught
// `[ [1 2] [3 4] ] CONCAT` -> `[1 2 3 4]` when CONCAT is string-only and
// actually yields "1,23,4". That prose is fed to LLMs as the language
// reference, so a false claim there teaches code generators to emit broken
// Forthic. Execute every concrete claim it makes. Both sides of a
// `code` -> `expected` example are Forthic, so run both and compare.
await check("LLM prompt examples still hold", async () => {
  const { readFile } = await import("node:fs/promises");
  await import("temporal-polyfill/global");
  const { StandardInterpreter } = await import("../dist/esm/index.js");

  const prompt = await readFile(new URL("../docs/forthic-prompt.md", import.meta.url), "utf8");
  // Only the handwritten guidance above "## Words" — the word listing below it
  // is generated from decorator metadata and is not executable prose.
  const prose = prompt.split(/^## Words/m)[0];

  // Claims where BOTH sides are backticked code. Prose right-hand sides
  // (e.g. "-> string with newline between") are not machine-checkable.
  const claims = [...prose.matchAll(/`([^`\n]+)`\s*\u2192\s*`([^`\n]+)`/g)];
  if (claims.length === 0) {
    throw new Error("no `code` -> `expected` examples found in the prompt prose");
  }

  const evaluate = async (code) => {
    const interp = new StandardInterpreter();
    await interp.run(code);
    return interp.stack_pop();
  };

  const wrong = [];
  for (const [, code, expected] of claims) {
    try {
      const actual = await evaluate(code);
      const want = await evaluate(expected);
      if (JSON.stringify(actual) !== JSON.stringify(want)) {
        wrong.push(
          `${code} produces ${JSON.stringify(actual)}, prompt claims ${JSON.stringify(want)}`,
        );
      }
    } catch (err) {
      wrong.push(`${code} threw: ${err.message.split("\n")[0]}`);
    }
  }
  if (wrong.length > 0) {
    throw new Error(`${wrong.length}/${claims.length} prompt claim(s) false: ${wrong.join("; ")}`);
  }
});

if (failures.length > 0) {
  console.error(`\nSmoke test failed (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nSmoke test passed.");
