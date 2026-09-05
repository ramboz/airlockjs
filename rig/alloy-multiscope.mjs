// Alloy multi-scope personalization — decisionScopes + N placements — spec 034-02.
//
// EXTENDS the 033-03 decisions rig (rig/alloy-decisions.mjs) from a single __view__
// placement to N scopes. REUSES connectors/alloy/alloy-chamber.worker.js verbatim (the
// same classic-worker chamber + the REAL stock @adobe/alloy@2.35.0 bundle) and the
// minting-Edge stub, EXTENDED so the interact response carries ONE Target proposition
// PER requested scope (mintMultiScopeDecisionsResponse).
//
// What this rig proves that the vitest stub-worker E2E (test/eds-boot-alloy.test.js
// "AC5 spec 034-02") cannot — it drives REAL stock alloy, not a fake:
//   (1) REQUEST wiring rig-proven against real alloy: the interact request body REALLY
//       carries decisionScopes for BOTH scopes (the connector's config.decisionScopes →
//       alloy sendEvent → the Edge query) — upgrading AC1's "source-grounded" to
//       "rig-proven against alloy 2.35.0";
//   (2) per-scope RESPONSE mapping: the stub Edge returns a proposition per scope, the
//       chamber crosses them as DATA, and the HOST maps EACH to its box BY SCOPE
//       (reservePersonalization reserves both pre-appear; each fills with its scope's html);
//   (3) one proposition_display exposure PER scope through the generic capture path.
// The per-scope RESPONSE is server behavior — rig-proven with the STUB here; live-Alloy
// is a creds-gated residual (013 pattern), NOT claimed by this rig.
//
// Usage: node rig/alloy-multiscope.mjs   (exits non-zero if any GATED assertion fails)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { mintMultiScopeDecisionsResponse } from "./alloy-mint-stub.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-multiscope.json");
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-multiscope.worker.built.js");
const VIEW_HTML = '<div class="airlock-hero" style="height:180px">Above the fold (__view__)</div>';
const PRODUCTS_HTML = '<div class="airlock-recs" style="height:120px">Recommended for you (products)</div>';

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };

function fail(verdict, extra = {}) {
  console.log(JSON.stringify({ pass: false, verdict, ...extra }, null, 2));
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });

// Build the classic-worker chamber (esbuild -> IIFE), REUSING the DONE worker verbatim —
// so the connector's new decisionScopes wiring (connectors/alloy/connector.js) is exercised.
await build({ entryPoints: [WORKER_SRC], outfile: WORKER_BUILT, bundle: true, format: "iife", platform: "browser", target: "es2022" });

// Collect every scope decisionScopes the REAL alloy interact request carried.
function decisionScopesInRequest(reqBody) {
  let body; try { body = JSON.parse(reqBody); } catch (e) { return []; }
  const found = new Set();
  const events = Array.isArray(body && body.events) ? body.events : [];
  for (const ev of events) {
    const ds = ev && ev.query && ev.query.personalization && ev.query.personalization.decisionScopes;
    if (Array.isArray(ds)) for (const s of ds) found.add(s);
  }
  // Also tolerate a top-level query.personalization.decisionScopes (defensive).
  const topDs = body && body.query && body.query.personalization && body.query.personalization.decisionScopes;
  if (Array.isArray(topDs)) for (const s of topDs) found.add(s);
  return [...found];
}

const interactRequests = []; // { requestedScopes }
const exposureBeacons = [];

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (req.method === "POST" && p === "/ee/v1/interact") {
      const chunks = []; for await (const c of req) chunks.push(c);
      const reqBody = Buffer.concat(chunks).toString("utf8");
      interactRequests.push({ requestedScopes: decisionScopesInRequest(reqBody) });
      // Per-scope RESPONSE (the stub models a Target per-scope decision).
      const { response } = mintMultiScopeDecisionsResponse({ scopes: [
        { scope: "__view__", html: VIEW_HTML },
        { scope: "products", html: PRODUCTS_HTML },
      ] });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(response));
    }
    if (req.method === "POST" && p === "/airlock-exposure") {
      const chunks = []; for await (const c of req) chunks.push(c);
      let evt = {}; try { evt = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) {}
      exposureBeacons.push(evt);
      res.writeHead(204); return res.end();
    }
    if (p === "/") p = "/rig/alloy-multiscope-harness.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let result = null, evalError = null;
try {
  await page.goto(`http://localhost:${port}/rig/alloy-multiscope-harness.html`);
  await page.waitForFunction(() => window.__ALLOY_MULTISCOPE_RESULT__ !== undefined, { timeout: 30000 });
  result = await page.evaluate(() => window.__ALLOY_MULTISCOPE_RESULT__);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { pageErrors });
if (!result) fail("FAIL — no result captured from the harness", { pageErrors });
if (result.fatal) fail("FAIL — harness fatal: " + result.fatal, { result, pageErrors, interactRequests });

const mt = result.markTimes || {};

// (1) REQUEST wiring — the REAL alloy interact carried BOTH scopes' decisionScopes.
const requested = (interactRequests[0] && interactRequests[0].requestedScopes) || [];
const real_alloy_requested_both_scopes = requested.includes("__view__") && requested.includes("products");

// (2) per-scope RESPONSE mapping — both boxes filled BY SCOPE with the right html.
const delivered = Array.isArray(result.deliveredScopes) ? result.deliveredScopes : [];
const both_scopes_delivered_as_data = delivered.includes("__view__") && delivered.includes("products");
const hero_filled_with_view = result.heroFilledAttr === "1" && String(result.heroInnerHtml || "").includes("__view__");
const recs_filled_with_products = result.recsFilledAttr === "1" && String(result.recsInnerHtml || "").includes("products");
const both_boxes_filled_by_scope = hero_filled_with_view && recs_filled_with_products;

// (3) one proposition_display exposure PER scope through the generic capture path.
const exposureScopes = exposureBeacons.filter((b) => b && b.event === "proposition_display").map((b) => b.scope);
const both_exposures_reported = exposureScopes.includes("__view__") && exposureScopes.includes("products");

// no-flicker: both boxes reserved BEFORE appear; the worker did NO real fetch; exposure not looped to alloy.
const reserved_before_appear = mt.reserveBoxes != null && mt.bodyAppear != null && mt.reserveBoxes < mt.bodyAppear;
const worker_no_real_fetch = result.workerNoRealFetch === 0;
const exposure_not_routed_to_alloy = result.exposureRoutedToAlloyCount === 0;

const assertions = {
  real_alloy_requested_both_scopes,
  both_scopes_delivered_as_data,
  both_boxes_filled_by_scope,
  both_exposures_reported,
  reserved_before_appear,
  worker_no_real_fetch,
  exposure_not_routed_to_alloy,
};

const pass = Object.values(assertions).every(Boolean);
const out = {
  pass,
  assertions,
  requested_scopes: requested,
  delivered_scopes: delivered,
  exposure_scopes: exposureScopes,
  filled_by_scope: result.filledByScope,
  verdict: pass
    ? "PASS — REAL stock alloy@2.35.0 requested BOTH decisionScopes on the interact (rig-proven, not just source-grounded); the stub Edge returned a proposition per scope; the host reserved both boxes BEFORE appear and filled EACH by scope (host-side scope→box map), reporting one proposition_display exposure per scope through the generic capture (alloy ignored the exposure — no loop). Per-scope RESPONSE is rig-proven with the stub; live-Alloy per-scope is a creds-gated residual, NOT claimed."
    : "FAIL — see assertions",
  out_file: "rig/out/alloy-multiscope.json",
};
console.log(JSON.stringify(out, null, 2));
await writeFile(OUT, JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
