// Bundle + real-page cycle smoke (spec 004-02, AC1 + AC2 + AC4) — the
// "verified-by-building" check on the REAL testbed page.
//
// Builds via `npm run build` (emitting the two-entry bundle INTO the testbed's
// served tree: /scripts/airlock/eds.js + sibling chamber.worker.js), statically
// serves `probes/eds-testbed/` AS ROOT (the same root `aem up` serves), and loads
// the REAL `index.html`. That exercises the ACTUAL wiring: boilerplate loadEager →
// `body:appear` → loadLazy → `import('/scripts/airlock/eds.js')` → boot → mark
// `airlock:init`. The rig then drives a CONTRACT-SHAPED `push` and asserts the
// worker cycles (intercepted egress > 0). Because the bundled runtime's `new
// Worker(new URL("./chamber.worker.js", import.meta.url))` must resolve to its
// served same-origin SIBLING file (never blob:/data: — 004-01 envelope), a green
// run is the runtime proof the served layout works under the boilerplate CSP.
//
// The boilerplate CSP is delivered as an HTTP response header on every response
// (faithful to head.html's move-to-http-header="true"; index.html's meta CSP is
// ALSO active — same policy). CSP-*enforcement* proof (negative control) lives in
// `npm run rig:csp` (004-01); this rig asserts the bundle RUNS under that policy.
//
// Tolerance: a plain static serve has no aem-up reverse proxy, so unrelated EDS
// noise is expected (nav/footer .plain.html 404s, experimentation-plugin fetches).
// The experimentation loaders catch their own failures (experiment-loader.js), so
// loadLazy still reaches the airlock boot. We assert ONLY the airlock boot,
// ordering, and cycle — and surface (not fail on) other console noise. The live
// `aem up` + Lighthouse verification is 004-04's scope.
//
// Usage: node rig/bundle-smoke.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(REPO, "probes/eds-testbed"); // the SERVED root, as under aem up

// 1. Build the two-entry bundle into the testbed tree. build.mjs self-asserts the
//    sibling layout + same-origin file worker (no blob:/data:).
execSync("npm run build", { cwd: REPO, stdio: "inherit" });

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};

// The exact EDS boilerplate CSP (no worker-src; require-trusted-types-for 'script').
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
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
let egress = 0;
await page.route("**/collect*", (route) => { egress++; return route.fulfill({ status: 204, body: "" }); });
const consoleNoise = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleNoise.push(m.text()); });
page.on("pageerror", (e) => consoleNoise.push("pageerror: " + String(e)));

await page.goto(`http://localhost:${port}/index.html`);
// Wait for the airlock boot to resolve either way: the airlock:init mark (success)
// or the visible failure flag scripts.js sets (window.__airlockBootFailed).
await page
  .waitForFunction(
    () => (window.__flicker && window.__flicker.events.some((e) => e.name === "airlock:init"))
      || window.__airlockBootFailed !== undefined,
    { timeout: 20000 },
  )
  .catch(() => {});

// 2. AC4: a contract-shaped push on the real page → worker cycle → orchestrator
//    dispatch (intercepted by the route stub above).
const pushed = await page.evaluate(() => {
  if (!window.airlock) return false;
  window.airlock.push({ event: "page_view", page_location: location.href });
  window.airlock.flushNow();
  return true;
});
await page.waitForTimeout(800); // let the worker cycle complete

const flicker = await page.evaluate(() => (window.__flicker && window.__flicker.events) || []);
const bootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);
const state = await page.evaluate(() => (window.airlock ? window.airlock.getState("page_view.params.page_location") : null));
await browser.close();
server.close();

const marks = flicker.map((e) => e.name);
const appearIdx = marks.indexOf("body:appear");
const initIdx = marks.indexOf("airlock:init");
const bootedAfterAppear = appearIdx !== -1 && initIdx !== -1 && appearIdx < initIdx
  && flicker[appearIdx].t <= flicker[initIdx].t;
const workerCycled = egress > 0;

const pass = bootFailed === null && bootedAfterAppear && pushed && workerCycled;

const out = {
  question: "does the SERVED two-entry bundle boot lazily and cycle on the REAL testbed page?",
  pass,
  served_root: "probes/eds-testbed (static; aem-up root — live aem up + Lighthouse is 004-04)",
  boot_failed: bootFailed,            // scripts.js's visible-failure flag (null = booted)
  lazy_ordering_ok: bootedAfterAppear, // AC2: body:appear precedes airlock:init
  pushed_contract_shape: pushed,       // push({ event, ...params }) accepted on the page
  worker_cycled: workerCycled,         // AC4: cycle reached the worker → egress
  egress,
  getState_path_read: state,           // dotted-path read on the real page
  marks,
  console_noise_tolerated: consoleNoise, // expected under static serve (no reverse proxy)
  verdict: pass
    ? "PASS — bundled runtime served from the testbed tree booted after body:appear and cycled a contract-shaped event under the boilerplate CSP"
    : "FAIL — see flags above",
};
// eslint-disable-next-line no-console
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
