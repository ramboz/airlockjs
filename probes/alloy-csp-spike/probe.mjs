// Spike 033-01 — the PRIMARY KILL-risk probe. Does a CLASSIC importScripts worker
// (NOT the { type:"module" } worker 004-01 proved) load + execute a SAME-ORIGIN
// bundle under the ENFORCED EDS boilerplate CSP (script-src 'nonce-aem'
// 'strict-dynamic' …; NO worker-src; require-trusted-types-for 'script')?
//
// Adapts rig/csp-probe.mjs: CSP as an HTTP response header on EVERY response
// (faithful to the boilerplate's move-to-http-header + a CDN applying it globally,
// so the worker script inherits the same script-src), playwright chromium, a
// negative control proving enforcement, and the same escalation ladder.
//
// Two probes under one harness:
//   A) a minimal classic worker whose first act is importScripts('./probe-bundle.js')
//   B) the REAL built connectors/alloy/alloy-chamber.worker.js (esbuild IIFE), driven
//      through its shipped init protocol, read via its own phase/fatal messages.
//
// Usage: node probes/alloy-csp-spike/probe.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(HERE, "out/alloy-chamber.worker.built.js");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };

const BOILERPLATE =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";
const CSP = {
  boilerplate: BOILERPLATE,
  "worker-self": BOILERPLATE + " worker-src 'self';",
  "worker-blob": BOILERPLATE + " worker-src 'self' blob:;",
};

// --- Build the SHIPPED classic-worker chamber into an IIFE (byte-identical load
//     route to rig/alloy-chamber.mjs: importScripts + worker globals untouched). ---
await build({
  entryPoints: [WORKER_SRC],
  outfile: WORKER_BUILT,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
});

async function probe(csp) {
  const server = http.createServer(async (req, res) => {
    try {
      const p = decodeURIComponent((req.url || "/").split("?")[0]);
      const file = join(HERE, normalize(p === "/" ? "/harness.html" : p));
      if (!file.startsWith(HERE)) { res.writeHead(403); return res.end(); }
      const body = await readFile(file);
      // CSP header on EVERY response (models a CDN applying it globally — and gives
      // the worker script its OWN CSP, which governs its importScripts).
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "content-security-policy": csp });
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

  await page.goto(`http://localhost:${port}/harness.html`);
  await page.waitForFunction(() => window.__cspReady === true, { timeout: 15000 }).catch(() => {});
  const R = await page.evaluate(() => window.__RESULT || null);
  await browser.close();
  server.close();

  const cspEnforced = R && R.cspControlRan === false; // negative control blocked => enforced
  const classicImportScriptsAdmitted = !!(R && R.classic && R.classic.bundleExecuted === true && R.classic.importScriptsThrew === false);
  const realWorkerImportScriptsAdmitted = !!(R && R.realWorker && (R.realWorker.reachedLoaded === true || R.realWorker.reachedConfigured === true));

  return {
    csp,
    csp_enforced: cspEnforced,
    result: R,
    console_errors: consoleErrors,
    classic_importscripts_admitted: classicImportScriptsAdmitted,
    real_worker_importscripts_admitted: realWorkerImportScriptsAdmitted,
    verdict: !cspEnforced
      ? "INVALID — CSP not enforced (negative control ran); result cannot be trusted"
      : classicImportScriptsAdmitted
        ? "ADMITTED — classic worker constructed AND importScripts of a same-origin bundle executed under the ENFORCED boilerplate CSP"
        : (R && R.classic && R.classic.constructed === false)
          ? "BLOCKED at worker construction (CSP/Trusted-Types)"
          : "BLOCKED at importScripts (worker constructed, same-origin importScripts did not execute)",
  };
}

const results = {};
results.boilerplate = await probe(CSP.boilerplate);
// Escalate only if the boilerplate did not admit importScripts (mirror rig:csp).
if (!results.boilerplate.classic_importscripts_admitted) {
  results["worker-self"] = await probe(CSP["worker-self"]);
  if (!results["worker-self"].classic_importscripts_admitted) {
    results["worker-blob"] = await probe(CSP["worker-blob"]);
  }
}

const admittedUnderBoilerplate = results.boilerplate.csp_enforced && results.boilerplate.classic_importscripts_admitted;
const minimalAccommodation = admittedUnderBoilerplate
  ? "none — classic importScripts worker runs under the unmodified EDS boilerplate CSP"
  : results["worker-self"]?.classic_importscripts_admitted
    ? "worker-src 'self'"
    : results["worker-blob"]?.classic_importscripts_admitted
      ? "worker-src 'self' blob:"
      : "UNRESOLVED — none of the tested CSP variants admitted the classic importScripts worker";

console.log(JSON.stringify({
  question: "classic importScripts worker + same-origin bundle under EDS boilerplate CSP + Trusted Types?",
  csp_enforced_negative_control: results.boilerplate.csp_enforced,
  admitted_under_boilerplate: admittedUnderBoilerplate,
  minimal_accommodation: minimalAccommodation,
  results,
}, null, 2));
