// Bundle the airlock GA4 runtime for the EDS testbed (spec 004-02, AC1).
//
// TWO entry points, ONE outdir — not a single self-resolving file. esbuild has no
// automatic Web-Worker bundling (that is a Vite/Rollup-plugin behavior), so we emit
// two sibling bundles:
//
//   adapters/eds/index.js    →  probes/eds-testbed/scripts/airlock/eds.js
//   core/chamber.worker.js   →  probes/eds-testbed/scripts/airlock/chamber.worker.js
//
// The adapter entry imports the runtime SOURCE (`core/airlock.js`) directly, so the
// emitted eds.js is fully self-contained (no multi-module load chain). The outdir is
// INSIDE the testbed's served tree, so the real page's `scripts.js#loadLazy` can
// `import('/scripts/airlock/eds.js')` and the runtime's `new Worker(new
// URL("./chamber.worker.js", import.meta.url), { type: "module" })` resolves against
// the served eds.js URL to its SIBLING file. Both emitted files are gitignored
// (generated output, not source).
//
// HARD CONSTRAINT (load-bearing — 004-01 CSP verdict): the emitted worker MUST stay
// a same-origin file URL, never a `blob:`/`data:` URL. 004-01 validated a same-origin
// module worker under the boilerplate CSP (`worker-src` absent → falls back to
// `script-src 'nonce-aem' 'strict-dynamic' …`); a blob/data worker leaves that
// retired-risk envelope (its `worker-src 'self' blob:` escalation is untested). The
// assertions below enforce BOTH directions on every build: negatively (no blob:/data:
// anywhere) and positively (the worker sibling file exists in the emitted outputs and
// the emitted entry references it by exactly the expected sibling specifier) — so a
// hashed rename or a dropped worker entry fails the BUILD, not just the smoke rig.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

const OUTDIR = "probes/eds-testbed/scripts/airlock";
const ENTRY_OUT = "eds"; // → eds.js
const WORKER_OUT = "chamber.worker"; // → chamber.worker.js
const EXPECTED_WORKER_SPECIFIER = `./${WORKER_OUT}.js`; // the sibling-file reference

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: [
    { in: "adapters/eds/index.js", out: ENTRY_OUT },
    { in: "core/chamber.worker.js", out: WORKER_OUT },
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

// --- Assertions: the two-sibling same-origin-file layout, enforced at build time. ---
const failures = [];
const outputs = Object.keys(result.metafile.outputs).sort();

// Positive: both expected outputs were emitted, as siblings in OUTDIR.
const entryPath = `${OUTDIR}/${ENTRY_OUT}.js`;
const workerPath = `${OUTDIR}/${WORKER_OUT}.js`;
if (!outputs.includes(entryPath)) failures.push(`missing emitted entry ${entryPath} (outputs: ${outputs})`);
if (!outputs.includes(workerPath)) {
  failures.push(`missing emitted worker sibling ${workerPath} — a dropped/renamed worker entry (outputs: ${outputs})`);
}

// Positive: the emitted entry references the worker by EXACTLY the sibling specifier.
const emitted = readFileSync(new URL(`./${entryPath}`, import.meta.url), "utf8");
const workerRef = /new Worker\(\s*new URL\(\s*(["'`])(.*?)\1/.exec(emitted);
const workerSpecifier = workerRef ? workerRef[2] : null;
if (!workerRef) {
  failures.push("no `new Worker(new URL(...))` reference found in the emitted entry — esbuild rewrote the worker away from the sibling-file layout");
} else if (workerSpecifier !== EXPECTED_WORKER_SPECIFIER) {
  failures.push(
    `worker specifier is ${JSON.stringify(workerSpecifier)}, expected ${JSON.stringify(EXPECTED_WORKER_SPECIFIER)} — ` +
      "a hashed rename or path rewrite would break sibling resolution under the served tree",
  );
}

// Negative: no blob:/data: anywhere in EITHER emitted file (004-01 envelope) —
// the scan covers the worker chunk too, so the header comment's "anywhere" is true.
const emittedWorker = outputs.includes(workerPath)
  ? readFileSync(new URL(`./${workerPath}`, import.meta.url), "utf8")
  : "";
if (/\bblob:|\bdata:/.test(emitted) || /\bblob:|\bdata:/.test(emittedWorker)) {
  failures.push("emitted output contains a blob:/data: URL — the worker must stay a same-origin file URL");
}

// Derived, not hardcoded: same-origin file URL ⇔ the reference is the expected
// relative sibling specifier and nothing blob:/data: is present in either output.
const workerIsSameOriginFileUrl =
  workerSpecifier === EXPECTED_WORKER_SPECIFIER && !/^(blob:|data:)/.test(workerSpecifier ?? "") &&
  !/\bblob:|\bdata:/.test(emitted) && !/\bblob:|\bdata:/.test(emittedWorker);

if (failures.length) {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ built: outputs, failures }, null, 2));
  throw new Error(`build.mjs: bundle layout assertion failed:\n- ${failures.join("\n- ")}`);
}

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      built: outputs,
      worker_reference: workerSpecifier, // "./chamber.worker.js" (sibling file)
      worker_is_same_origin_file_url: workerIsSameOriginFileUrl,
    },
    null,
    2,
  ),
);
