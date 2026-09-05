// Bundle the airlock runtime (spec 004-02 AC1; 026-05 N-worker generalization;
// 031-01 first-class distributable target).
//
// N+1 entry points, ONE outdir — not a single self-resolving file. esbuild has no
// automatic Web-Worker bundling (that is a Vite/Rollup-plugin behavior), so we emit
// the adapter entry plus one sibling bundle per chamber worker the runtime may spawn:
//
//   adapters/eds/index.js          →  <outdir>/eds.js
//   core/chamber.worker.js         →  <outdir>/chamber.worker.js        (GA4, default)
//   core/pixel-chamber.worker.js   →  <outdir>/pixel-chamber.worker.js  (026 pixel connector)
//   core/dom-chamber.worker.js     →  <outdir>/dom-chamber.worker.js    (025 worker-dom mirror)
//   core/helix-rum-chamber.worker.js → <outdir>/helix-rum-chamber.worker.js (030 RUM authority)
//
// The adapter entry imports the runtime SOURCE (`core/airlock.js`) directly, so the emitted eds.js
// is fully self-contained. `createAirlock` selects a chamber worker by `connector` — the default
// GA4 `./chamber.worker.js`, `./pixel-chamber.worker.js` for `connector:"pixel"`,
// `./dom-chamber.worker.js` for `connector:"dom"`, or `./helix-rum-chamber.worker.js` for
// `connector:"helix-rum"` (the selection seam, `airlock.js`'s connector-selection block) — so the
// emitted eds.js references ALL FOUR by their sibling specifier, and each MUST be emitted as a
// sibling in the served tree or a real page 404s it.
//
// 031-01: the build target is a PARAMETER (`outdir`), no longer hardwired to the testbed. The
// default `npm run build` still emits into probes/eds-testbed/ (so the testbed keeps its own
// direct-emit boot path and every existing rig stays green); `npm run build:dist` emits a
// first-class, ready-to-serve distributable into `dist/` — the tree publish-dist.mjs commits to a
// dist-rooted ref (AC2) and a consumer `git subtree add`s (AC4/AC5). The same-origin-file-worker
// assertions below run against WHICHEVER outdir, so they enforce the invariant on the distributable
// too (AC3) — not just the testbed emit.
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
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

// The default target: the testbed's served tree (unchanged pre-031 behavior — keeps
// every existing rig + the testbed direct-emit boot path green).
export const DEFAULT_OUTDIR = "probes/eds-testbed/scripts/airlock";
export const ENTRY_OUT = "eds"; // → eds.js

// 033-03: the EAGER pre-paint personalization reserve module — a SECOND non-worker
// ESM entry emitted alongside eds.js. It is deliberately its OWN dist entry (NOT
// exported from eds.js) so an eager `import()` before paint pulls only
// createDomCapability + the pure placement parser onto the critical path, never the
// full runtime (createAirlock + every connector + web-vitals). The build asserts
// below that the emitted eager chunk carries NO `createAirlock` (the lightweight
// invariant, AC2) and no blob:/data:/ajv (the shared envelope).
export const RESERVE_ENTRY_OUT = "reserve-personalization"; // → reserve-personalization.js

// Every same-origin sibling chamber worker the emitted eds.js may spawn. The `out` name is derived
// from the source basename (so `core/pixel-chamber.worker.js` → `pixel-chamber.worker` → the sibling
// `./pixel-chamber.worker.js`). Add an entry here when a new chamber worker becomes eds-reachable.
export const WORKER_ENTRIES = [
  "core/chamber.worker.js",
  "core/pixel-chamber.worker.js",
  "core/dom-chamber.worker.js",
  "core/helix-rum-chamber.worker.js", // 030-02: airlock-as-RUM-authority (connector:"helix-rum")
];

// 033-02: airlock's CLASSIC alloy chamber worker. It is an `importScripts` worker
// (NOT a `{type:"module"}` worker), so it CANNOT join the `format:"esm"` WORKER_ENTRIES
// build above — it needs a SECOND `format:"iife"` esbuild call (rig/alloy-chamber.mjs's
// pattern). It is a same-origin `dist` sibling like the others, referenced by
// `bootAlloy`'s `new Worker(new URL("./alloy-chamber.worker.js", …))`, so eds.js's
// same-origin-sibling assertions below cover it too (the alloy specifier is added to
// EXPECTED_WORKER_SPECIFIERS and its output merged into emittedBasenames + the negative
// blob:/data:/ajv scans). The adopter-supplied STOCK bundle is NOT shipped (ADR-0016).
export const CLASSIC_WORKER_ENTRIES = [
  "connectors/alloy/alloy-chamber.worker.js",
];

// The `out` name = the source basename minus `.js` (so `core/pixel-chamber.worker.js`
// → `pixel-chamber.worker` → the sibling `./pixel-chamber.worker.js`, and
// `connectors/alloy/alloy-chamber.worker.js` → `alloy-chamber.worker`). Generalized
// from the old `core/`-only strip so a connectors/-rooted worker names correctly (033-02).
// LATENT (no collision today): basename-only would clash if two entries in different dirs
// shared a basename (e.g. `core/x.worker.js` + `connectors/y/x.worker.js`) — all current
// entries are basename-unique; a future clash would need a dir-qualified out name.
const defaultWorkerOut = (inPath) => inPath.split("/").pop().replace(/\.js$/, "");

/**
 * Build the airlock runtime (eds.js + the N sibling chamber workers) into `outdir` and enforce the
 * same-origin-file-worker layout at build time. Returns a summary; THROWS if any invariant fails.
 *
 * @param {object} [opts]
 * @param {string} [opts.outdir]        repo-relative or absolute output dir (default: the testbed tree).
 * @param {string[]} [opts.workerEntries] source ESM (module) worker entries to emit (default: the four
 *                                        eds-reachable chambers). Dropping one seeds the AC3 "missing sibling" regression.
 * @param {string[]} [opts.classicWorkerEntries] source CLASSIC (importScripts) worker entries emitted by a
 *                                        SECOND `format:"iife"` build call (default: the alloy chamber, 033-02).
 * @param {(inPath:string)=>string} [opts.outNameFor] out-name deriver (default: the source basename minus `.js`).
 *                                        Overriding it seeds the AC3 "hashed rename" regression.
 * @param {string} [opts.reserveEntry]    the eager pre-paint reserve module source (default the real
 *                                        adapters/eds/reserve-personalization.js). Overriding it seeds the
 *                                        033-03 "a Worker entered the eager reserve graph" regression.
 */
export async function buildAirlock({
  outdir = DEFAULT_OUTDIR,
  workerEntries = WORKER_ENTRIES,
  classicWorkerEntries = CLASSIC_WORKER_ENTRIES,
  outNameFor = defaultWorkerOut,
  reserveEntry = "adapters/eds/reserve-personalization.js",
} = {}) {
  const absOutdir = isAbsolute(outdir) ? outdir : join(ROOT, outdir);
  // Every same-origin sibling worker eds.js may reference — the ESM set AND the classic
  // set (033-02): a `new Worker(new URL("./x", …))` in eds.js must resolve to one of these,
  // regardless of which build call (esm or iife) emitted it.
  const allWorkerEntries = [...workerEntries, ...classicWorkerEntries];
  const EXPECTED_WORKER_SPECIFIERS = new Set(allWorkerEntries.map((p) => `./${outNameFor(p)}.js`));

  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: [
      { in: "adapters/eds/index.js", out: ENTRY_OUT },
      // 033-03: the eager pre-paint reserve module — a 2nd non-worker ESM entry.
      { in: reserveEntry, out: RESERVE_ENTRY_OUT },
      ...workerEntries.map((p) => ({ in: p, out: outNameFor(p) })),
    ],
    outdir: absOutdir,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    // No `minify` (readable output for review); no `splitting` (each entry is
    // self-contained — no shared-chunk load chain).
    metafile: true,
  });

  // 033-02: the CLASSIC alloy chamber worker(s) — an `importScripts` worker that cannot
  // join the `format:"esm"` call above. A SECOND `format:"iife"` build emits it into the
  // SAME outdir as a same-origin sibling; its output is merged into the layout assertions
  // below so eds.js's `./alloy-chamber.worker.js` reference resolves to a known, emitted
  // sibling and the no-blob:/data:/ajv invariant is enforced on it too.
  const classicResult = classicWorkerEntries.length
    ? await build({
        absWorkingDir: ROOT,
        entryPoints: classicWorkerEntries.map((p) => ({ in: p, out: outNameFor(p) })),
        outdir: absOutdir,
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "es2022",
        metafile: true,
      })
    : { metafile: { outputs: {} } };

  // --- Assertions: the (N+1)-sibling same-origin-file layout, enforced at build time. ---
  // Basename-keyed so the checks are robust to an absolute vs repo-relative outdir (031-01: the
  // distributable target may be `dist/`, a temp dir, or the testbed) — the invariant is about the
  // SIBLING FILE NAMES a served eds.js resolves against, not the metafile's key format. Merges BOTH
  // build results (the esm N-worker call + the classic iife call) so the alloy worker is covered too.
  const failures = [];
  const outputs = [...Object.keys(result.metafile.outputs), ...Object.keys(classicResult.metafile.outputs)].sort();
  const baseOf = (p) => p.split(/[\\/]/).pop();
  const emittedBasenames = new Set(outputs.map(baseOf));

  // Positive: the adapter entry + every declared worker (esm AND classic) were emitted as siblings.
  const entryBase = `${ENTRY_OUT}.js`;
  if (!emittedBasenames.has(entryBase)) {
    failures.push(`missing emitted entry ${entryBase} (outputs: ${outputs})`);
  }
  const workerBasenames = allWorkerEntries.map((p) => `${outNameFor(p)}.js`);
  for (const wb of workerBasenames) {
    if (!emittedBasenames.has(wb)) {
      failures.push(`missing emitted worker sibling ${wb} — a dropped/renamed worker entry (outputs: ${outputs})`);
    }
  }

  // Positive (033-03 AC2): the eager pre-paint reserve module was emitted as a sibling.
  const reserveBase = `${RESERVE_ENTRY_OUT}.js`;
  if (!emittedBasenames.has(reserveBase)) {
    failures.push(`missing emitted eager reserve module ${reserveBase} — the 033-03 personalization pre-paint entry (outputs: ${outputs})`);
  }
  const reserveChunk = emittedBasenames.has(reserveBase) ? readFileSync(join(absOutdir, reserveBase), "utf8") : "";

  // Positive: EVERY `new Worker(new URL(...))` reference in the emitted entry resolves to a KNOWN,
  // EMITTED sibling worker (026-05: matchAll, not just the first — eds.js references N workers).
  const emitted = emittedBasenames.has(entryBase) ? readFileSync(join(absOutdir, entryBase), "utf8") : "";
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
    } else if (!emittedBasenames.has(spec.replace(/^\.\//, ""))) {
      failures.push(
        `worker specifier ${JSON.stringify(spec)} is referenced by the emitted entry but was NOT emitted as a ` +
          "sibling — a real page would 404 it (a missing build.mjs worker entry)",
      );
    }
  }

  // Negative: no blob:/data: anywhere in the emitted entry OR any emitted worker chunk (004-01 envelope).
  const emittedWorkerChunks = workerBasenames
    .filter((wb) => emittedBasenames.has(wb))
    .map((wb) => readFileSync(join(absOutdir, wb), "utf8"));
  // The blob:/data: scan enforces the WORKER same-origin-file-URL invariant, so it
  // covers eds.js (which constructs Workers) + the worker chunks — NOT the eager
  // reserve module, which spawns no Worker and legitimately carries a `data:text/html`
  // token in core/sanitize-html.js's XSS URL-scheme denylist (a security feature that
  // STRIPS such URLs, not a worker-load URL). The reserve chunk is still ajv-scanned below.
  if ([emitted, ...emittedWorkerChunks].some((chunk) => /(["'`])(?:blob|data):/.test(chunk))) {
    failures.push("emitted output contains a blob:/data: URL — every worker must stay a same-origin file URL");
  }

  // Negative (spec 032-02 AC2): NO `ajv` (a contracts/ DEV-dependency, used only by the
  // dev validation harness) may reach the shipped bundle. `boot(config)`'s runtime config
  // validation is a hand-rolled SUBSET of the pinned JSON Schema precisely so the dev-only
  // validator dependency never ships — a runtime `import … "ajv"` would smuggle ~100KB of
  // dev tooling into every consumer's page. No-minify keeps identifiers readable, so a bare
  // `/ajv/i` reference in any emitted chunk means ajv was bundled.
  if ([emitted, reserveChunk, ...emittedWorkerChunks].some((chunk) => /ajv/i.test(chunk))) {
    failures.push("emitted output references `ajv` — a contracts/ dev-dependency must not reach the shipped bundle (032-02 AC2: runtime config validation is hand-rolled)");
  }

  // Negative (spec 033-03 AC2 — the LIGHTWEIGHT invariant): the eager pre-paint reserve
  // module must NOT pull the full runtime onto the critical path. `createAirlock` is the
  // runtime factory (adapters/eds/index.js -> core/airlock.js); its identifier appearing in
  // the eager chunk means an `import(eds.js)`-equivalent leaked in (a connector/web-vitals
  // graph regressing LCP). No-minify keeps identifiers readable, so a bare `createAirlock`
  // token in the eager chunk means the lightweight boundary broke. eds.js legitimately
  // carries it (the full runtime) — this scan is the EAGER chunk only.
  if (reserveChunk && /createAirlock/.test(reserveChunk)) {
    failures.push(`the eager reserve module ${reserveBase} references \`createAirlock\` — it must stay lightweight (only createDomCapability + placement parsing), never pull the full runtime onto the pre-paint critical path (033-03 AC2)`);
  }

  // Negative (spec 033-03 AC2 — the eager module's WORKER-URL invariant, self-defended).
  // The reserve chunk is EXCLUDED from the blob:/data: worker-URL scan above BECAUSE it
  // spawns no Worker (and legitimately carries a `data:text/html` sanitizer token) — so make
  // THAT premise a build failure, not a fact only a (deletable) test asserts: a `new Worker(`
  // in the eager chunk means a Worker entered the pre-paint reserve graph, and its URL is no
  // longer covered by the same-origin-file-URL invariant the blob:/data: scan enforces on
  // eds.js + the worker chunks. Fail the build so the exclusion above stays sound.
  if (reserveChunk && /new Worker\(/.test(reserveChunk)) {
    failures.push(`the eager reserve module ${reserveBase} constructs a \`new Worker(\` — the pre-paint reserve module must spawn NO Worker (its URL would escape the same-origin-file-URL invariant the blob:/data: scan enforces on the worker-spawning chunks) (033-03 AC2)`);
  }

  // Derived, not hardcoded: all workers are same-origin file URLs ⇔ every referenced specifier is a
  // known expected sibling that was emitted, and nothing blob:/data: is present in any chunk.
  const allWorkersAreSameOriginFileUrls =
    referencedSpecifiers.length > 0 &&
    referencedSpecifiers.every(
      (spec) => EXPECTED_WORKER_SPECIFIERS.has(spec) && emittedBasenames.has(spec.replace(/^\.\//, "")),
    ) &&
    ![emitted, ...emittedWorkerChunks].some((chunk) => /(["'`])(?:blob|data):/.test(chunk));

  if (failures.length) {
    throw new Error(`build.mjs: bundle layout assertion failed:\n- ${failures.join("\n- ")}`);
  }

  return {
    outdir,
    built: outputs,
    worker_references: [...new Set(referencedSpecifiers)].sort(), // e.g. ["./chamber.worker.js", …]
    all_workers_are_same_origin_file_urls: allWorkersAreSameOriginFileUrls,
  };
}

// --- script entry (guarded so importing for tests never triggers a build) ---
// `--outdir <dir>` overrides the default testbed target — `npm run build:dist` passes `dist`.
function parseOutdir(argv) {
  const i = argv.indexOf("--outdir");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : DEFAULT_OUTDIR;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const summary = await buildAirlock({ outdir: parseOutdir(process.argv.slice(2)) });
  console.log(JSON.stringify(summary, null, 2));
}
