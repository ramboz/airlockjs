// Before/after Lighthouse on the REAL testbed page (spec 004-04, AC3 + AC4) — the
// UC-2 CWV scoreboard: does loading the airlock runtime cost ~zero on page-load CWV?
//
// Two arms, runtime OFF vs ON, toggled SERVER-SIDE (no test-only flag ships in
// scripts.js / the adapter — slice Assumptions):
//   - OFF: the server serves a NO-OP ES module for /scripts/airlock/eds.js
//          (`export function bootEdsAnalytics(){}`), so the page is a real
//          no-airlock control whose load graph differs only by the (lazy, post-LCP)
//          boot that never happens.
//   - ON:  the server serves the REAL built bundle emitted by `npm run build`.
// The page is served AS ROOT with the boilerplate CSP header on every response
// (as `aem up`'s CDN would), so the runtime boots exactly as in production.
//
// Runs LH_N iterations per arm (env LH_N, default 5), INTERLEAVED (off, on, off, …)
// so machine drift does not bias one arm, and reports per-arm MEDIAN performance
// score + LCP/TBT/CLS with min/max spread, plus the median deltas (on − off).
//
// Honest-scoreboard notes (AC4):
//   - TBT is the RUNTIME-ATTRIBUTABLE number. The runtime boots in the lazy phase
//     after body:appear (post-LCP, verified 004-02), so it cannot move LCP — LCP
//     delta is ~0 by construction; the only load-CWV signal it can affect is TBT
//     (and CLS, spike-measured 0).
//   - A static serve 404s the pipeline nav/footer (present in BOTH arms), so the
//     ABSOLUTE scores are not an `aem up` claim — the load-bearing output is the
//     MEDIAN DELTA with its spread, human-read (jig-supervised). Noise does not
//     cancel in a single pair, hence the repeated iterations.
//   - Acceptance band: median TBT delta ≤ 50 ms and |CLS delta| ≤ 0.01 ⇒ "~0".
//
// Usage: LH_N=5 node rig/lh-eds.mjs   (prints the scoreboard JSON to stdout)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";
// spec 036-01 AC1: the median/armSummary/delta/band engine now lives in lh-core.mjs so
// rig/lh-live.mjs's live/local query-gate harness REUSES it — not a parallel
// re-implementation. Pure logic, unit-tested in test/lh-core.test.js; this file's own
// behavior is byte-unchanged (AC7) — only WHERE the math lives moved.
import { armSummary, computeDeltaMedian, runLighthouseOnce, withinTightBand } from "./lh-core.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(REPO, "probes/eds-testbed");
const LH_N = Number(process.env.LH_N || 5);

// 1. Build the real bundle into the testbed tree (the ON arm serves it verbatim).
execSync("npm run build", { cwd: REPO, stdio: "inherit" });

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};
const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";

// The no-airlock control module (OFF arm) — a real no-op boot entry.
const NOOP_EDS = "export function bootEdsAnalytics(){}\nexport default bootEdsAnalytics;\n";

let arm = "off"; // server-side toggle, flipped between iterations
const EDS_ENTRY = "/scripts/airlock/eds.js";

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    // OFF arm: substitute a no-op for the airlock boot entry (server-controlled).
    if (arm === "off" && p === EDS_ENTRY) {
      res.writeHead(200, { "content-type": "text/javascript", "content-security-policy": BOILERPLATE_CSP });
      return res.end(NOOP_EDS);
    }
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "content-security-policy": BOILERPLATE_CSP,
    });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://localhost:${port}/index.html`;

const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });

async function runOne() {
  return runLighthouseOnce(lighthouse, url, { port: chrome.port });
}

const arms = { off: [], on: [] };
for (let i = 0; i < LH_N; i++) {
  arm = "off"; arms.off.push(await runOne());
  arm = "on"; arms.on.push(await runOne());
}

await chrome.kill();
server.close();

const off = armSummary(arms.off);
const on = armSummary(arms.on);
const deltaMedian = computeDeltaMedian(off, on);
const withinBand = withinTightBand(deltaMedian);

const out = {
  question: "does loading the airlock runtime (bundled + lazy) cost ~zero page-load CWV on the REAL testbed page?",
  config: {
    lh_n: LH_N,
    form_factor: "desktop",
    screen_emulation: "disabled",
    served_root: "probes/eds-testbed (static; aem-up root)",
    toggle: "server-side no-op module on the OFF arm (no production flag)",
    iteration_order: "interleaved (off, on, off, …)",
  },
  off,
  on,
  delta_median: deltaMedian,
  acceptance: {
    band: "median TBT delta <= 50ms AND |CLS delta| <= 0.01",
    tbt_delta_ms: deltaMedian.TBT_ms,
    cls_delta: deltaMedian.CLS,
    within_band: withinBand,
  },
  note:
    "TBT is the runtime-attributable number (lazy post-LCP boot ⇒ LCP delta ~0 by construction). "
    + "Static serve 404s the pipeline nav/footer in BOTH arms, so absolute scores are not an aem-up claim — "
    + "the median delta with spread is the load-bearing output (human-read). On the ON arm a closing "
    + "pushCritical page_view may be issued to the collect endpoint at page teardown, AFTER the trace window, "
    + "so it does not affect the measured numbers.",
};
console.log(JSON.stringify(out, null, 2));
