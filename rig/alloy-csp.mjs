// Alloy classic-worker CSP rig — spec 033-02 AC1 (the 033-01 spike probe, PRODUCTIZED).
//
// Proves the SHIPPED classic alloy chamber worker (connectors/alloy/alloy-chamber.worker.js),
// with its 033-02 worker-realm Trusted Types policy, LOADS its (stub) bundle under the ENFORCED
// EDS boilerplate CSP — reaching `phase:"loaded"`/`"configured"`, NOT `fatal{phase:"load"}`. This
// promotes probes/alloy-csp-spike/{probe,probe2}.mjs into a real rig: the pre-033-02 bare
// `self.importScripts(bundleUrl)` is BLOCKED by Trusted Types (importScripts is a TrustedScriptURL
// sink; the page's `default` policy is per-realm), and the ~4-line fix (a worker-realm policy +
// importScripts(policy.createScriptURL(url))) admits it. The 004-01 un-nonced-inline NEGATIVE
// CONTROL proves the CSP is actually enforced (else "admitted" is a false positive). AD-7 regression:
// has_dynamic_import === false on the built classic worker.
//
// HERMETIC (slice § Residual): a STUB bundle under the CAPTURED boilerplate CSP — this establishes
// the CSP-load MECHANISM, not the live-host + real ~766 KB @adobe/alloy boot (deploy/creds-gated,
// like the 013 live-alloy re-probe). A restrictive live-host `trusted-types <names>` directive
// omitting the worker's policy name is the only residual CSP risk (ADR-0016 kill-criterion).
//
// Usage: node rig/alloy-csp.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-csp.json");
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-csp.worker.built.js");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };

// The enforced EDS boilerplate CSP (captured in the 033-01 spike): nonce + strict-dynamic, NO
// worker-src, require-trusted-types-for 'script'. Delivered as an HTTP header on EVERY response so
// the worker script inherits it (models a CDN applying it globally).
const CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; require-trusted-types-for 'script';";

function fail(verdict, extra = {}) {
  console.log(JSON.stringify({ pass: false, verdict, ...extra }, null, 2));
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });

// Build the SHIPPED classic worker into an IIFE (importScripts + worker globals untouched, ESM
// imports inlined) — the byte-identical load route the dist emits.
await build({ entryPoints: [WORKER_SRC], outfile: WORKER_BUILT, bundle: true, format: "iife", platform: "browser", target: "es2022" });
const builtWorker = await readFile(WORKER_BUILT, "utf8");
const usesImportScripts = /\bimportScripts\s*\(/.test(builtWorker);
const usesTrustedTypesPolicy = /createPolicy\s*\(/.test(builtWorker) && /createScriptURL\s*\(/.test(builtWorker);
const hasDynamicImport = /[^.\w]import\s*\(/.test(builtWorker); // must be false (AD-7)

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/rig/alloy-csp-harness.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "content-security-policy": CSP });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e)));

let R = null, evalError = null;
try {
  await page.goto(`http://localhost:${port}/rig/alloy-csp-harness.html`);
  await page.waitForFunction(() => window.__cspReady === true, { timeout: 20000 }).catch(() => {});
  R = await page.evaluate(() => window.__RESULT || null);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { consoleErrors });
if (!R) fail("FAIL — no result captured from the CSP harness", { consoleErrors });

const cspEnforced = R.cspControlRan === false; // negative control blocked => enforced
const importScriptsAdmitted = R.reachedLoaded === true || R.reachedConfigured === true;
const notFatalOnLoad = !(R.fatal && R.fatal.phase === "load");

const assertions = {
  csp_enforced_negative_control: cspEnforced,
  worker_installs_own_tt_policy: usesTrustedTypesPolicy,
  classic_worker_importscripts_admitted_under_boilerplate_csp: importScriptsAdmitted,
  not_fatal_on_load: notFatalOnLoad,
  uses_importScripts_load_route: usesImportScripts,
  has_dynamic_import_false_AD7: hasDynamicImport === false,
};
const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Does the SHIPPED classic alloy chamber worker (with its 033-02 worker-realm Trusted Types policy) load its bundle via importScripts under the ENFORCED EDS boilerplate CSP — reaching phase:loaded/configured, NOT fatal{phase:load} — with the un-nonced-inline negative control proving the CSP is enforced?",
  pass,
  csp: CSP,
  result: R,
  assertions,
  load_route: { uses_importScripts: usesImportScripts, worker_installs_own_tt_policy: usesTrustedTypesPolicy, has_dynamic_import: hasDynamicImport },
  console_errors: consoleErrors,
  residual:
    "HERMETIC: a STUB bundle under the CAPTURED boilerplate CSP — the CSP-load MECHANISM, not the live-host + real ~766 KB @adobe/alloy boot (deploy/creds-gated). A restrictive live-host `trusted-types <names>` directive omitting the worker's policy name is the only residual CSP risk (ADR-0016 kill-criterion — re-confirm on the live host).",
  verdict: pass
    ? "PASS — the classic alloy worker's own Trusted Types policy admits importScripts under the enforced boilerplate CSP (reached loaded/configured, not fatal{phase:load}); the negative control confirms the CSP is enforced; has_dynamic_import === false (AD-7)."
    : "FAIL — see assertions (a fatal{phase:load} means importScripts was blocked — the TT-policy fix regressed, or the CSP was not enforced).",
};

await writeFile(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ pass: out.pass, assertions: out.assertions, phases: R.phases, fatal: R.fatal, verdict: out.verdict, out_file: "rig/out/alloy-csp.json" }, null, 2));
process.exit(pass ? 0 : 1);
