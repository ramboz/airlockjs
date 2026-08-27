// UC-1 no-flicker structural invariant + conformant exposure beacon on the REAL
// testbed page (spec 005-01, AC3+AC4+AC5) — the no-flicker punchline, proven on the
// actual EDS boot sequence under the boilerplate CSP.
//
// Builds via `npm run build` (the adapter is the bundle entry — emits the two-entry
// bundle INTO the testbed's served tree), statically serves `probes/eds-testbed/` AS
// ROOT with the CSP header on every response (as `aem up`'s CDN would), then loads the
// REAL index.html TWICE with a forced variant: `?experiment=hero-cta/challenger-1` and
// `?experiment=hero-cta/control`. For each arm it asserts two things:
//
//   1. NO-FLICKER STRUCTURAL INVARIANT (AC4, the LOAD-BEARING half). From
//      `window.__flicker` marks (same-thread `performance.now()` order — the reliable
//      proof), the `exp-applied:hero-cta:<variant>` mark PRECEDES the `body:appear`
//      mark: the variant was applied before paint could happen (the page is born
//      hidden; first paint is gated on `appear` — R-005). The `paint:first-*`-never-
//      before-`appear` leg is reported as CORROBORATING ONLY and does NOT gate the
//      verdict — absolute paint timestamps are unreliable in headless/embedded
//      browsers (R-005), so they must not be the sole gate.
//
//   2. CONFORMANT EXPOSURE BEACON (AC3+AC5). The airlock's lazy boot reads the applied
//      variant from the durable body dataset and `push`es an `experiment_impression`;
//      the intercepted `/collect*` body must carry experiment_id="hero-cta" + the arm's
//      variant_id AND validate against the pinned GA4 MP schema (the hermetic oracle).
//      That the beacon fires in the lazy phase (after `airlock:init`, itself after
//      `body:appear`) is AC5: analytics is lazy, no paint impact.
//
// The verdict GATES on: the structural invariant holds in BOTH arms AND a conformant
// exposure beacon fired in BOTH arms. The forced-challenger arm ALSO writes a
// screenshot to rig/out/uc1-challenger.png for the OQ6 human visual review (the
// perceptual "no flash" half the structural invariant cannot prove).
//
// Usage: node rig/uc1.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import Ajv2020 from "ajv/dist/2020.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(REPO, "probes/eds-testbed"); // the SERVED root, as under aem up
const OUT_DIR = join(REPO, "rig/out");
const CHALLENGER_SHOT = join(OUT_DIR, "uc1-challenger.png");

// Env-configurable timeouts (07-05 CI robustness pass): defaults are the
// ORIGINAL hardcoded values (backward-compatible — local behavior unchanged).
// A slow shared CI runner needs more headroom for the airlock-boot wait and
// the beacon poll than a local dev machine, so the browser CI job overrides
// these via env rather than this script hardcoding a CI-sized value.
const BOOT_TIMEOUT_MS = Number(process.env.UC1_BOOT_TIMEOUT_MS || 20000);
const BEACON_TIMEOUT_MS = Number(process.env.UC1_BEACON_TIMEOUT_MS || 8000);

// Hermetic conformance oracle (the same schema the worker maps against).
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url))),
);

// 1. Build the two-entry bundle into the testbed tree (self-asserts the layout).
execSync("npm run build", { cwd: REPO, stdio: "inherit" });
await mkdir(OUT_DIR, { recursive: true });

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
    // Model aem up's extensionless content serving: the experimentation plugin
    // fetches the forced variant by its bare pathname (`/variant-b`, plugin
    // src/index.js:473/709), so map an extensionless path to its `.html` document —
    // without this the challenger fetch 404s and the swap silently falls back to
    // control (which is exactly what a naive static serve does).
    else if (!extname(p)) p += ".html";
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

/** Run one forced-variant arm; returns its structured verdict. */
async function runArm(variant, screenshotPath) {
  const context = await browser.newContext(); // fresh cookies + marks per arm
  const page = await context.newPage();

  const beacons = [];
  await page.route("**/collect*", (route) => {
    const raw = route.request().postData();
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { /* keep {} */ }
    beacons.push({ name: parsed?.events?.[0]?.name ?? null, params: parsed?.events?.[0]?.params ?? {}, body: raw });
    return route.fulfill({ status: 204, body: "" });
  });
  const consoleNoise = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleNoise.push(m.text()); });
  page.on("pageerror", (e) => consoleNoise.push("pageerror: " + String(e)));

  await page.goto(`http://localhost:${port}/index.html?experiment=hero-cta/${variant}`);
  // Wait for the lazy airlock boot to resolve (success mark or the visible failure flag).
  await page
    .waitForFunction(
      () => (window.__flicker && window.__flicker.events.some((e) => e.name === "airlock:init"))
        || window.__airlockBootFailed !== undefined,
      { timeout: BOOT_TIMEOUT_MS },
    )
    .catch(() => {});

  // Force-drain the exposure push (boot pushed it into the ring), then wait for its beacon.
  await page.evaluate(() => window.airlock && window.airlock.flushNow());
  const deadline = Date.now() + BEACON_TIMEOUT_MS;
  while (Date.now() < deadline && !beacons.some((b) => b.name === "experiment_impression")) {
    await page.waitForTimeout(50);
  }

  const flicker = await page.evaluate(() => (window.__flicker && window.__flicker.events) || []);
  const bootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);
  const bodyDataset = await page.evaluate(() => ({
    experiment: document.body.dataset.experiment ?? null,
    variant: document.body.dataset.variant ?? null,
  }));

  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  await context.close();

  // --- 1. Structural invariant (LOAD-BEARING): variant applied before paint. ---
  const mark = (name) => flicker.find((e) => e.name === name) || null;
  const expApplied = mark(`exp-applied:hero-cta:${variant}`);
  const bodyAppear = mark("body:appear");
  const appliedBeforeAppear = !!expApplied && !!bodyAppear && expApplied.t < bodyAppear.t;

  // --- Corroborating ONLY (not gated): first paint never before appear. ---
  const paintMarks = flicker.filter((e) => e.name.startsWith("paint:"));
  const firstPaintT = paintMarks.length ? Math.min(...paintMarks.map((p) => p.t)) : null;
  const paintNeverBeforeAppear = bodyAppear && firstPaintT !== null ? bodyAppear.t <= firstPaintT : null;

  // --- 2. Conformant exposure beacon (AC3+AC5). ---
  const beacon = beacons.find((b) => b.name === "experiment_impression") || null;
  let mpConformant = false;
  try { mpConformant = beacon ? validate(JSON.parse(beacon.body)) === true : false; } catch { mpConformant = false; }
  const exposureOk = beacon !== null && mpConformant
    && beacon.params.experiment_id === "hero-cta" && beacon.params.variant_id === variant;

  // AC5: the exposure report is lazy — its beacon rode the worker cycle after airlock:init.
  const initMark = mark("airlock:init");
  const exposureIsLazy = !!bodyAppear && !!initMark && bodyAppear.t <= initMark.t;

  // AC5 is now a hard gate (review 005-01): the exposure report must be lazy
  // (beacon after airlock:init, i.e. after body:appear) — not merely reported.
  const armPass = bootFailed === null && appliedBeforeAppear && exposureOk && exposureIsLazy;

  return {
    variant,
    arm_pass: armPass,
    boot_failed: bootFailed,
    body_dataset: bodyDataset, // proves the durable page-level state was set
    // structural invariant (gated)
    structural_invariant_holds: appliedBeforeAppear,
    exp_applied_t: expApplied ? expApplied.t : null,
    body_appear_t: bodyAppear ? bodyAppear.t : null,
    // corroborating paint ordering (NOT gated — headless paint ts unreliable, R-005)
    corroborating_paint_never_before_appear: paintNeverBeforeAppear,
    first_paint_t: firstPaintT,
    // exposure beacon (gated) + lazy-report evidence (AC5)
    exposure_beacon_conformant: exposureOk,
    exposure_beacon: beacon ? { name: beacon.name, experiment_id: beacon.params.experiment_id, variant_id: beacon.params.variant_id } : null,
    exposure_is_lazy_after_appear: exposureIsLazy,
    marks: flicker.map((e) => e.name),
    console_noise_tolerated: consoleNoise, // expected under static serve (no reverse proxy)
  };
}

const challenger = await runArm("challenger-1", CHALLENGER_SHOT);
const control = await runArm("control", null);

await browser.close();
server.close();

const pass = challenger.arm_pass && control.arm_pass;

const out = {
  question: "on the REAL testbed page, is the above-the-fold variant applied BEFORE paint (no-flicker), and its exposure reported as an MP-conformant experiment_impression through the airlock — in BOTH forced arms?",
  pass,
  served_root: "probes/eds-testbed (static; aem-up root)",
  gate: "structural invariant holds (both arms) AND conformant exposure beacon (both arms); paint ordering is corroborating only",
  challenger_screenshot: "rig/out/uc1-challenger.png (OQ6 human visual review — the perceptual half)",
  arms: { challenger, control },
  verdict: pass
    ? "PASS — variant applied before body:appear in both arms (structural no-flicker invariant), and a schema-conformant experiment_impression exposure beacon fired for each variant through the airlock's lazy boot"
    : "FAIL — see per-arm flags above",
};
// eslint-disable-next-line no-console
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
