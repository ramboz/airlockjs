// rig/rum-replace.mjs — spec 030-03: the page-side RUM replace, no double-count.
//
// Proves, on the REAL testbed page under the boilerplate CSP, that `?rum=airlock`
// hands RUM to airlock as the SINGLE governed authority — the inline sampleRUM egress
// is neutralized and airlock emits exactly one governed beacon per checkpoint, with
// NO double-count. The two authorities are attributed by TRANSPORT:
//
//   - inline sampleRUM egresses via `navigator.sendBeacon` (aem.js:124)
//   - airlock egresses via `fetch` (core/airlock.js:300 steady-state; core/egress.js:80
//     critical) and actively DENIES sendBeacon in its worker (egress-confinement.js)
//
// so an in-page wrap of both transports (installed via addInitScript, BEFORE any page
// script) records every `.rum` beacon as { via, checkpoint } and the verdict reads it.
// `ot.aem.live` is network-stubbed (page.route → 204) — hermetic, no live egress.
//
// Mirrors rig/e2e.mjs (build → serve probes/eds-testbed under the CSP → chromium).
// Usage: node rig/rum-replace.mjs   (exits non-zero if any gating assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(REPO, "probes/eds-testbed"); // the SERVED root, as under aem up

// 1. Build the bundle into the testbed tree (self-asserts the 5-worker layout).
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

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "content-security-policy": BOILERPLATE_CSP, // CSP on EVERY response (models the CDN header)
    });
    return res.end(body);
  } catch (e) { res.writeHead(404); return res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();

// In-page instrumentation, injected BEFORE any page script (addInitScript). (a) Record
// every `.rum` beacon with its transport. (b) Force sampleRUM's isSelected so the control
// is deterministic AND the replace proof is STRONGER — the neutralization must hold even
// when inline sampleRUM would otherwise have fired (weight 100 → ~1% natural selection).
const INSTRUMENT = () => {
  window.__rumBeacons = [];
  window.hlx = window.hlx || {};
  window.hlx.rum = { isSelected: true }; // pre-seed; aem.js reads .isSelected then replaces the object
  const isRum = (u) => { try { return new URL(u, location.href).pathname.includes("/.rum/"); } catch { return false; } };
  const sb = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (sb) {
    navigator.sendBeacon = (url, body) => {
      if (isRum(url)) window.__rumBeacons.push({ via: "sendBeacon", url: String(url), checkpoint: null });
      return sb(url, body);
    };
  }
  const of = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (isRum(url)) {
      let checkpoint = null;
      try { const b = init && init.body; if (typeof b === "string") checkpoint = JSON.parse(b).checkpoint; } catch { /* Blob/other → null */ }
      window.__rumBeacons.push({ via: "fetch", url: String(url), checkpoint });
    }
    return of(input, init);
  };
};

async function loadTestbed(query) {
  const page = await browser.newPage();
  await page.addInitScript(INSTRUMENT);
  await page.route("**/.rum/**", (route) => route.fulfill({ status: 204, body: "" })); // hermetic stub (both transports)
  await page.goto(`http://localhost:${port}/index.html${query}`);
  return page;
}

const waitFor = async (page, fn, timeoutMs) => page.waitForFunction(fn, { timeout: timeoutMs }).then(() => true).catch(() => false);

// ─── The REPLACE: ?rum=airlock ────────────────────────────────────────────────
const page = await loadTestbed("?rum=airlock");
// airlock boots in the lazy phase; wait for its top beacon (fetch) — or a visible RUM boot
// failure. Keyed off __airlockRumBootFailed ONLY: the GA4 boot flag (__airlockBootFailed) is
// unrelated to the RUM proof, and coupling to it could short-circuit the wait spuriously.
await waitFor(
  page,
  () => (window.__rumBeacons || []).some((b) => b.via === "fetch" && b.checkpoint === "top")
    || window.__airlockRumBootFailed !== undefined,
  20000,
);
// a synthetic page error → airlock's error listener → push({event:"error"}) → steady-state fetch.
// Snapshot the error-beacon count BEFORE the dispatch so the assertion proves EXACTLY ONE governed
// beacon PER dispatched error (a delta) — robust to any page-load error-event noise on the testbed.
const errorBefore = await page.evaluate(() =>
  (window.__rumBeacons || []).filter((b) => b.via === "fetch" && b.checkpoint === "error").length);
await page.evaluate(() => window.dispatchEvent(new ErrorEvent("error", { message: "rig-synthetic-error", filename: "rig.js" })));
await page.waitForFunction(
  (n) => (window.__rumBeacons || []).filter((b) => b.via === "fetch" && b.checkpoint === "error").length > n,
  errorBefore, { timeout: 5000 },
).catch(() => {});

const rumBootFailed = await page.evaluate(() => window.__airlockRumBootFailed ?? null);
const ga4BootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);
const beacons = await page.evaluate(() => window.__rumBeacons);
await page.close();

const fetchRum = beacons.filter((b) => b.via === "fetch");
const sendBeaconRum = beacons.filter((b) => b.via === "sendBeacon");
const fetchTop = fetchRum.filter((b) => b.checkpoint === "top");
const fetchError = fetchRum.filter((b) => b.checkpoint === "error");
const fetchCwv = fetchRum.filter((b) => b.checkpoint === "cwv"); // best-effort (non-gating)
const allToOtAemLive = fetchRum.length > 0 && fetchRum.every((b) => b.url.includes("ot.aem.live"));

// ─── The CONTROL: no param (default testbed — inline sampleRUM owns RUM) ───────
const control = await loadTestbed("");
await waitFor(control, () => (window.__rumBeacons || []).some((b) => b.via === "sendBeacon"), 8000);
const cbeacons = await control.evaluate(() => window.__rumBeacons);
await control.close();
const controlSendBeaconTop = cbeacons.filter((b) => b.via === "sendBeacon");
const controlFetchRum = cbeacons.filter((b) => b.via === "fetch");

await browser.close();
await new Promise((r) => server.close(r));

// ─── Verdict ──────────────────────────────────────────────────────────────────
const checks = {
  // AC1/AC2 — the replace: airlock is the SINGLE governed authority, no double-count.
  replace_rum_boot_ok: rumBootFailed === null,
  replace_zero_inline_sampleRUM: sendBeaconRum.length === 0,          // inline neutralized (no sendBeacon .rum)
  replace_exactly_one_airlock_top: fetchTop.length === 1,             // exactly ONE governed top (no double-count)
  replace_exactly_one_airlock_error: fetchError.length - errorBefore === 1, // exactly one governed beacon PER dispatched error
  replace_all_confined_ot_aem_live: allToOtAemLive,                  // confined to ot.aem.live
  // AC2 — the control inverse: default testbed keeps inline sampleRUM, no airlock RUM.
  control_inline_sampleRUM_fires: controlSendBeaconTop.length >= 1,
  control_no_airlock_fetch_rum: controlFetchRum.length === 0,
};
const passed = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  verdict: passed ? "PASS" : "FAIL",
  checks,
  observed: {
    replace: {
      fetch_rum: fetchRum.map((b) => b.checkpoint),
      sendBeacon_rum: sendBeaconRum.length,
      cwv_best_effort: fetchCwv.length, // attribution only — a headless timing flake never gates
      rumBootFailed, ga4BootFailed,
    },
    control: { sendBeacon_rum: controlSendBeaconTop.length, fetch_rum: controlFetchRum.length },
  },
}, null, 2));

process.exit(passed ? 0 : 1);
