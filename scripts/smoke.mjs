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

if (failures.length > 0) {
  console.error(`\nSmoke test failed (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nSmoke test passed.");
