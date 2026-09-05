// Supported-subset live smoke — spec 036-02. Answers "does the supported connector
// subset (GA4 + Adobe/alloy) boot cleanly and emit conformant/present beacons on a real
// EDS page?" — the SECOND half of the MVP6 adoption proof (rig/lh-live.mjs's before/after
// CWV harness, spec 036-01, is the first).
//
// PRESENCE + CLIENT-SIDE CONFORMANCE ONLY (AC1) — never presence-as-acceptance:
//   - boot-health: no window.__airlockBootFailed / __airlockRumBootFailed; the
//     `airlock:init` (and, when RUM is owned, `airlock:rum`) __flicker mark fired.
//   - GA4: the /collect beacon is checked for MP-schema conformance against
//     contracts/ga4-mp-request.schema.json — a LEGITIMATE client-side acceptance
//     oracle for GA4 (unlike alloy/RUM below).
//   - alloy: the interact is asserted only FIRED to the pinned datastream host — a
//     PRESENCE signal. A malformed XDM still POSTs and can get an error handle back,
//     so the interact SHAPE + ECID write-back is NOT confirmed here; it rides the
//     spec-013 rig/alloy-live-*.mjs redacted-fixture rigs.
//   - RUM: the SENT beacon shape is captured when window.__airlockOwnsRum — what
//     airlock SENT, NEVER what the collector KEPT (see docs/real-site-validation.md's
//     residuals checklist — the cwv-superset ACCEPTANCE gate is a downstream property
//     a captured beacon can never honestly confirm).
//
// Reuses rig/e2e.mjs's three genuinely-shared primitives via rig/smoke-core.mjs (AC5):
// the Ajv ga4-mp-request.schema.json oracle compile, the `/collect*` beacon-capture
// route, and the boot-health wait on window.__flicker's marks / the __airlock*BootFailed
// flags. The pass/fail DECISION itself (given boot-health + GA4-conformance +
// alloy-fired + RUM-present) is pure logic, unit-tested red->green in
// test/smoke-core.test.js (item 3) — this file only drives the browser + feeds that
// decision its inputs.
//
// THE UNIVERSAL TRIGGER: rather than a testbed-only selector (a real operator's page
// has no `#cta-engage`), this rig calls the PUBLIC push() contract every airlock boot
// path installs on `window.airlock` (adapters/eds/index.js's installOnWindow) —
// `window.airlock.push({event:"page_view", ...})` — which GA4's `["*"]` catch-all and
// alloy's `["page_view"]` manifest both accept, so ONE generic call exercises both
// connectors on ANY airlock-booted page, local or live. RUM needs no trigger: bootHelixRum
// auto-pushes its own `top` checkpoint synchronously on boot.
//
// LOCAL DRY RUN (no LIVE_URL) — AC3, the local-provability split. Two arms against the
// local testbed:
//   - probes/eds-testbed/index.html?rum=airlock, booted via bootEdsAnalytics() (no
//     window.__airlockConfig) — a REAL /collect beacon + MP conformance, PLUS (via the
//     ?rum=airlock opt-in, spec 030-03) a REAL RUM `top` beacon captured as SENT-only.
//   - probes/eds-testbed/index-alloy.html, booted via boot(config) against the SAME CSP
//     stub bundle rig/lh-live.mjs's own local dry run uses (rig/alloy-csp-stub-bundle.js)
//     — chamber BOOT-HEALTH only; the stub performs no network call, so "interact FIRED"
//     is honestly reported "not exercised locally" (AC3), never faked.
//
// LIVE mode — LIVE_URL="https://your-preview-url/" node rig/subset-smoke.mjs. Loads the
// operator's real page as-is and reads its OWN window.__airlockConfig to decide which of
// GA4/alloy it declares (absent config -> bootEdsAnalytics()'s GA4-only shape, mirroring
// scripts.js's own dispatch), then drives the SAME universal trigger + reports every
// check honestly. Run MANUALLY (spec 013 convention) — NOT wired into `npm test`.
//
// Usage:
//   node rig/subset-smoke.mjs                                   # local dry-run
//   LIVE_URL=https://your-preview-url/ node rig/subset-smoke.mjs # the operator's live run
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  compileGa4Validator,
  captureCollectBeacons,
  waitForBootHealth,
  bootHealthDisposition,
  ga4Disposition,
  alloyPresenceDisposition,
  rumSentDisposition,
  buildSmokeVerdict,
} from "./smoke-core.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const TESTBED_ROOT = join(REPO, "probes/eds-testbed");
const LIVE_URL = process.env.LIVE_URL || null;
const MODE = LIVE_URL ? "live" : "local";
const RUM_EXPECTED_FIELDS = ["weight", "id", "referer", "checkpoint", "t"];
const ALLOY_STUB_PATH = "/rig-fixtures/alloy-stub.js";
// A minimal, VALID alloy connector config (ADR-0016: a stub bundleUrl — NOT the real
// ~766 KB @adobe/alloy, NOT a live Adobe Edge endpoint; local dry-run only).
const LOCAL_ALLOY_CONFIG = { connectors: [{ type: "alloy", bundleUrl: ALLOY_STUB_PATH, datastreamId: "subset-smoke-local-stub" }] };

// The SAME hermetic conformance oracle rig/e2e.mjs uses (spec 036-02 AC5, shared not
// re-implemented).
const validate = compileGa4Validator(
  JSON.parse(readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url))),
);

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

/**
 * The local dry-run static server (LOCAL mode only) — serves probes/eds-testbed/ as
 * root (as `aem up`'s CDN would, mirroring rig/e2e.mjs), plus the alloy CSP stub bundle
 * and an unconditionally-injected window.__airlockConfig on index-alloy.html (mirrors
 * rig/lh-live.mjs's local dry-run server, minus its OFF/ON toggle — this smoke always
 * wants the alloy arm ON).
 */
async function startLocalServer() {
  // 034-02:117 pre-flight — a fresh rebuild so stale pre-034 bytes are never exercised.
  execSync("npm run build", { cwd: REPO, stdio: "inherit" });
  const alloyTemplate = await readFile(join(TESTBED_ROOT, "index-alloy.html"), "utf8");

  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || "/").split("?")[0]);
      if (p === "/") p = "/index.html";

      if (p === ALLOY_STUB_PATH) {
        const body = await readFile(join(REPO, "rig/alloy-csp-stub-bundle.js"));
        res.writeHead(200, { "content-type": "text/javascript", "content-security-policy": BOILERPLATE_CSP });
        return res.end(body);
      }
      if (p === "/index-alloy.html") {
        const configScript = `<script nonce="aem">window.__airlockConfig = ${JSON.stringify(LOCAL_ALLOY_CONFIG)};</script>`;
        const body = alloyTemplate.replace("<!--AIRLOCK_CONFIG-->", configScript);
        res.writeHead(200, { "content-type": "text/html", "content-security-policy": BOILERPLATE_CSP });
        return res.end(body);
      }
      const file = join(TESTBED_ROOT, normalize(p));
      if (!file.startsWith(TESTBED_ROOT)) { res.writeHead(403); return res.end(); }
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
  return { base: `http://localhost:${port}`, close: () => server.close() };
}

/**
 * Run one smoke arm against `url` — boot-health, config introspection (which connectors
 * does THIS page declare?), the universal push() trigger, and the beacon/interact/RUM
 * capture. `passthrough` (true in LIVE mode) lets every captured request continue to its
 * real destination instead of being fulfilled with a local stub response.
 */
async function runArm(browser, { url, passthrough }) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const beacons = [];
  const rumBeacons = [];
  const interacts = [];
  await captureCollectBeacons(page, beacons, { passthrough });
  await page.route("**/.rum/**", (route) => {
    const raw = route.request().postData();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* keep null */ }
    rumBeacons.push({ body: raw, parsed, t: Date.now() });
    return passthrough ? route.continue() : route.fulfill({ status: 200, body: "" });
  });
  await page.route("**/ee/v1/interact*", (route) => {
    interacts.push({ url: route.request().url(), body: route.request().postData(), t: Date.now() });
    return passthrough ? route.continue() : route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(url);
  await waitForBootHealth(page); // airlock:init / __airlockBootFailed
  const bootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);

  // Which connectors does THIS page declare? Mirrors scripts.js's own dispatch
  // (no window.__airlockConfig -> bootEdsAnalytics()'s GA4-only shape).
  const airlockConfig = await page.evaluate(() => window.__airlockConfig ?? null);
  const connectorTypes = airlockConfig && Array.isArray(airlockConfig.connectors)
    ? airlockConfig.connectors.map((c) => c && c.type).filter(Boolean)
    : [];
  const hasGa4 = !airlockConfig || connectorTypes.includes("ga4");
  const hasAlloy = connectorTypes.includes("alloy");
  const ownsRum = await page.evaluate(() => window.__airlockOwnsRum === true);

  let rumBootFailed = null;
  if (ownsRum) {
    await waitForBootHealth(page, { successMark: "airlock:rum", failureFlags: ["__airlockRumBootFailed"] });
    rumBootFailed = await page.evaluate(() => window.__airlockRumBootFailed ?? null);
  }

  // The universal trigger (AC1) — see this file's header. A no-op (guarded) if boot
  // never installed window.airlock (e.g. a boot failure already recorded above).
  await page.evaluate(() => {
    if (window.airlock && typeof window.airlock.push === "function") {
      window.airlock.push({ event: "page_view", page_location: location.href });
    }
  });

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && beacons.length === 0 && interacts.length === 0) {
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(300); // let a slightly-later sibling beacon (RUM/alloy) land too

  const ga4Beacon = beacons.find((b) => b.name === "page_view") || null;
  let ga4Conformant = null;
  if (ga4Beacon) {
    try { ga4Conformant = validate(JSON.parse(ga4Beacon.body)) === true; } catch { ga4Conformant = false; }
  }
  const rumBeacon = rumBeacons[0] || null;
  const rumFields = rumBeacon && rumBeacon.parsed ? rumBeacon.parsed : null;
  const rumHasExpectedFields = !!rumFields && RUM_EXPECTED_FIELDS.every((k) => Object.prototype.hasOwnProperty.call(rumFields, k));

  await context.close();

  return {
    url, bootFailed, hasGa4, hasAlloy, ownsRum, rumBootFailed,
    ga4Beacon, ga4Conformant, alloyFired: interacts.length > 0, interacts,
    rumBeacon, rumHasExpectedFields,
  };
}

async function main() {
  const browser = await chromium.launch();
  let localServer = null;
  let arms;
  try {
    if (MODE === "live") {
      arms = [await runArm(browser, { url: LIVE_URL, passthrough: true })];
    } else {
      localServer = await startLocalServer();
      arms = [
        await runArm(browser, { url: `${localServer.base}/index.html?rum=airlock`, passthrough: false }),
        await runArm(browser, { url: `${localServer.base}/index-alloy.html`, passthrough: false }),
      ];
    }
  } finally {
    await browser.close();
    if (localServer) localServer.close();
  }

  // Pick whichever arm actually exercised each connector (LIVE mode has exactly one).
  const anyBootFailedArm = arms.find((a) => a.bootFailed) || null;
  const ga4Arm = arms.find((a) => a.hasGa4) || null;
  const alloyArm = arms.find((a) => a.hasAlloy) || null;
  const rumArm = arms.find((a) => a.ownsRum) || null;

  const checks = {
    boot_health: bootHealthDisposition(anyBootFailedArm ? anyBootFailedArm.bootFailed : null),
    ga4: ga4Disposition({
      exercised: !!ga4Arm,
      present: ga4Arm ? !!ga4Arm.ga4Beacon : null,
      conformant: ga4Arm ? ga4Arm.ga4Conformant : null,
    }),
    alloy: alloyPresenceDisposition({
      exercised: !!alloyArm,
      locallyExercisable: MODE === "live",
      fired: alloyArm ? alloyArm.alloyFired : null,
    }),
    rum: rumSentDisposition({
      owns: !!rumArm,
      captured: rumArm ? !!rumArm.rumBeacon : null,
      hasExpectedFields: rumArm ? rumArm.rumHasExpectedFields : null,
    }),
  };
  if (rumArm) checks.rum_boot_health = bootHealthDisposition(rumArm.rumBootFailed);

  const verdict = buildSmokeVerdict({ mode: MODE, checks });

  const note = MODE === "local"
    ? "LOCAL DRY RUN (spec 036-02 AC3) — GA4 presence+MP-conformance and alloy chamber BOOT-HEALTH are " +
      "locally provable; alloy's interact-FIRED check is honestly reported not-exercised-locally (the CSP-proof " +
      "stub bundle performs no network call). RUM's beacon is captured as SENT only. See " +
      "docs/real-site-validation.md's residuals checklist for the creds-gated live gates this smoke does NOT " +
      "decide: RUM cwv-superset acceptance, alloy endpoint-ceiling breadth, live-host Trusted-Types + the real " +
      "~766 KB bundle boot, and the alloy interact SHAPE/ECID (spec-013 rig/alloy-live-*.mjs)."
    : "LIVE RUN — presence + client-side conformance ONLY, never presence-as-acceptance. GA4's MP-schema match " +
      "is a legitimate client-side oracle; alloy's interact is FIRED-only (shape rides spec-013's " +
      "rig/alloy-live-*.mjs); RUM's beacon is the SENT shape, NOT collector acceptance. Read " +
      "docs/real-site-validation.md's residuals checklist before treating this page as production-ready.";

  const out = { ...verdict, arms, note };
  console.log(JSON.stringify(out, null, 2));
  process.exit(verdict.pass ? 0 : 1);
}

await main();
