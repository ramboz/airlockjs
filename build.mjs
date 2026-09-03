// Bundle the airlock runtime for the EDS testbed (spec 004-02 AC1; 026-05 N-worker generalization).
//
// N+1 entry points, ONE outdir — not a single self-resolving file. esbuild has no automatic
// Web-Worker bundling (that is a Vite/Rollup-plugin behavior), so we emit the adapter entry plus
// one sibling bundle per chamber worker the runtime may spawn:
//
//   adapters/eds/index.js          →  probes/eds-testbed/scripts/airlock/eds.js
//   core/chamber.worker.js         →  probes/eds-testbed/scripts/airlock/chamber.worker.js        (GA4, default)
//   core/pixel-chamber.worker.js   →  probes/eds-testbed/scripts/airlock/pixel-chamber.worker.js  (026 pixel connector)
//   core/dom-chamber.worker.js     →  probes/eds-testbed/scripts/airlock/dom-chamber.worker.js    (025 worker-dom mirror)
//
// The adapter entry imports the runtime SOURCE (`core/airlock.js`) directly, so the emitted eds.js
// is fully self-contained. `createAirlock` selects a chamber worker by `connector` — the default
// GA4 `./chamber.worker.js`, `./pixel-chamber.worker.js` for `connector:"pixel"`, or
// `./dom-chamber.worker.js` for `connector:"dom"` (the selection seam, `airlock.js`'s
// connector-selection block) — so the emitted eds.js references ALL THREE by their sibling
// specifier, and each MUST be emitted as a sibling in the served tree or a real page 404s it.
//
// `core/dom-chamber.worker.js` (spec 025-02 build, spec 025-03 AC6 wires it here) is now
// production-reachable: `createAirlock`'s selection seam constructs it via `connector:"dom"` (a
// real worker-dom tag adapter's own path — the 025-03 AC4 rig's "production path" — un-defers
// 026-05's original grounded exclusion, which held while the dom chamber was test/rig-only).
//
// HARD CONSTRAINT (load-bearing — 004-01 CSP verdict): every emitted worker MUST stay a same-origin
// file URL, never a `blob:`/`data:` URL. 004-01 validated a same-origin module worker under the
// boilerplate CSP (`worker-src` absent → falls back to `script-src 'nonce-aem' 'strict-dynamic' …`);
// a blob/data worker leaves that retired-risk envelope. The assertions below enforce BOTH directions
// on every build, generalized over N workers: negatively (no blob:/data: in ANY emitted chunk) and
// positively (every worker sibling referenced by eds.js exists in the emitted outputs and is referenced
// by exactly its expected sibling specifier) — so a hashed rename or a dropped worker entry fails the
// BUILD, not just the smoke rig.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

const OUTDIR = "probes/eds-testbed/scripts/airlock";
const ENTRY_OUT = "eds"; // → eds.js

// Every same-origin sibling chamber worker the emitted eds.js may spawn. The `out` name is derived
// from the source basename (so `core/pixel-chamber.worker.js` → `pixel-chamber.worker` → the sibling
// `./pixel-chamber.worker.js`). Add an entry here when a new chamber worker becomes eds-reachable.
const WORKER_ENTRIES = ["core/chamber.worker.js", "core/pixel-chamber.worker.js", "core/dom-chamber.worker.js"];
const workerOut = (inPath) => inPath.replace(/^core\//, "").replace(/\.js$/, "");
const EXPECTED_WORKER_SPECIFIERS = new Set(WORKER_ENTRIES.map((p) => `./${workerOut(p)}.js`));

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: [
    { in: "adapters/eds/index.js", out: ENTRY_OUT },
    ...WORKER_ENTRIES.map((p) => ({ in: p, out: workerOut(p) })),
  ],
  outdir: OUTDIR,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  // No `minify` (readable output for review); no `splitting` (each entry is
  // self-contained — no shared-chunk load chain).
  metafile: true,
});

// --- Assertions: the (N+1)-sibling same-origin-file layout, enforced at build time. ---
const failures = [];
const outputs = Object.keys(result.metafile.outputs).sort();

// Positive: the adapter entry + every declared worker were emitted as siblings in OUTDIR.
const entryPath = `${OUTDIR}/${ENTRY_OUT}.js`;
if (!outputs.includes(entryPath)) failures.push(`missing emitted entry ${entryPath} (outputs: ${outputs})`);
const workerPaths = WORKER_ENTRIES.map((p) => `${OUTDIR}/${workerOut(p)}.js`);
for (const wp of workerPaths) {
  if (!outputs.includes(wp)) {
    failures.push(`missing emitted worker sibling ${wp} — a dropped/renamed worker entry (outputs: ${outputs})`);
  }
}

// Positive: EVERY `new Worker(new URL(...))` reference in the emitted entry resolves to a KNOWN,
// EMITTED sibling worker (026-05: matchAll, not just the first — eds.js references N workers).
const emitted = readFileSync(new URL(`./${entryPath}`, import.meta.url), "utf8");
const referencedSpecifiers = [...emitted.matchAll(/new Worker\(\s*new URL\(\s*(["'`])(.*?)\1/g)].map((m) => m[2]);
if (referencedSpecifiers.length === 0) {
  failures.push("no `new Worker(new URL(...))` reference found in the emitted entry — esbuild rewrote the worker away from the sibling-file layout");
}
for (const spec of referencedSpecifiers) {
  if (!EXPECTED_WORKER_SPECIFIERS.has(spec)) {
    failures.push(
      `worker specifier ${JSON.stringify(spec)} is not a known sibling worker (expected one of ` +
        `${[...EXPECTED_WORKER_SPECIFIERS].map((s) => JSON.stringify(s)).join(", ")}) — a hashed rename or path ` +
        "rewrite would break sibling resolution under the served tree",
    );
  } else if (!outputs.includes(`${OUTDIR}/${spec.replace(/^\.\//, "")}`)) {
    failures.push(
      `worker specifier ${JSON.stringify(spec)} is referenced by the emitted entry but was NOT emitted as a ` +
        "sibling — a real page would 404 it (a missing build.mjs worker entry)",
    );
  }
}

// Negative: no blob:/data: anywhere in the emitted entry OR any emitted worker chunk (004-01 envelope).
const emittedWorkerChunks = workerPaths
  .filter((wp) => outputs.includes(wp))
  .map((wp) => readFileSync(new URL(`./${wp}`, import.meta.url), "utf8"));
if ([emitted, ...emittedWorkerChunks].some((chunk) => /(["'`])(?:blob|data):/.test(chunk))) {
  failures.push("emitted output contains a blob:/data: URL — every worker must stay a same-origin file URL");
}

// Derived, not hardcoded: all workers are same-origin file URLs ⇔ every referenced specifier is a
// known expected sibling that was emitted, and nothing blob:/data: is present in any chunk.
const allWorkersAreSameOriginFileUrls =
  referencedSpecifiers.length > 0 &&
  referencedSpecifiers.every(
    (spec) => EXPECTED_WORKER_SPECIFIERS.has(spec) && outputs.includes(`${OUTDIR}/${spec.replace(/^\.\//, "")}`),
  ) &&
  ![emitted, ...emittedWorkerChunks].some((chunk) => /(["'`])(?:blob|data):/.test(chunk));

if (failures.length) {

  console.error(JSON.stringify({ built: outputs, failures }, null, 2));
  throw new Error(`build.mjs: bundle layout assertion failed:\n- ${failures.join("\n- ")}`);
}


console.log(
  JSON.stringify(
    {
      built: outputs,
      worker_references: [...new Set(referencedSpecifiers)].sort(), // e.g. ["./chamber.worker.js", "./pixel-chamber.worker.js"]
      all_workers_are_same_origin_file_urls: allWorkersAreSameOriginFileUrls,
    },
    null,
    2,
  ),
);
