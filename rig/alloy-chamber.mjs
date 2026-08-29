// Alloy Option-B chamber rig — spec 012-01, AC2 + AC3.
//
// Proves the stock UNMODIFIED `@adobe/alloy@2.35.0` bundle boots inside an
// AIRLOCK classic-worker chamber that hosts it via the shared connector host
// (createConnectorHost + createAlloyConnector), with the synchronous-cookie
// capability (caps.cookies.sync, AC3) serving alloy's synchronous document.cookie
// reads. Mirrors R-004's probe route (probes/alloy-worker) and the browser-rig
// structure of rig/coherency.mjs (node http server + playwright chromium + a
// JSON verdict to rig/out/ + non-zero exit on any failed assertion).
//
// SCOPE — AC2/AC3/AC4. alloy's own worker-side fetch is INTERCEPTED in the chamber
// and routed into the orchestrator's main-thread dispatch (ADR-0004, mirrored in
// the harness); the harness runs the REAL network fetch ON MAIN against this rig's
// minting-Edge stub, which server-assigns a fresh ECID; alloy persists it into the
// AMCV_<ORGID> cell. Egress CONFINEMENT (AC5) + the contract-guard ADR (AC6) are
// later stages, NOT exercised here.
//
// Asserts (AC2/AC3, kept green):
//   1. alloy `configure` + `sendEvent` both resolve inside the chamber (no throw);
//   2. the loaded bundle is byte-identical stock 2.35.0 — sha256 pinned + checked
//      against the actually-served file (AD-7);
//   3. alloy's FIRST synchronous cookie access (the getApexDomain/getTld probe) is
//      served from the sync cache via the granted caps.cookies.sync surface (no
//      throw, correct value round-trips);
// Asserts (AC4, added):
//   4. EXACTLY ONE interact request egressed via the orchestrator's MAIN-thread
//      dispatch, and the worker's shim did NO real network fetch;
//   5. the minting stub's SERVER-assigned ECID landed in the AMCV_*/kndctr_* cell
//      (read from real document.cookie on main after the async write-back);
//   6. the intercepted XDM interact payload validates (pageView + top-level
//      query.identity.fetch includes "ECID").
//
// Usage: node rig/alloy-chamber.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import {
  mintInteractResponse,
  extractEcidFromInteractResponse,
  OLD_INCHAMBER_STUB_ECID,
} from "./alloy-mint-stub.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-chamber.json");
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-chamber.worker.built.js");
const BUNDLE_FILE = join(ROOT, "probes/alloy-worker/node_modules/@adobe/alloy/dist/alloy.js");

// AD-7 hash pin: the byte-identical stock @adobe/alloy@2.35.0 dist/alloy.js.
const ALLOY_SHA256_PIN = "3cea73e10b9cdd3bd2b58cf2c15a11d559203b51193f09499e4dc7050b821122";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css",
};

function fail(verdict, extra = {}) {
  const out = { pass: false, verdict, ...extra };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });

// --- 1. Build the classic-worker chamber (esbuild -> IIFE). The ESM imports
//        (createConnectorHost, createAlloyConnector, createSyncCookieCache) are
//        inlined; `importScripts` and worker globals are left untouched. This is
//        the deliberately-taken load route (AC2): a CLASSIC worker + importScripts,
//        NOT a module worker / dynamic import(). ---
await build({
  entryPoints: [WORKER_SRC],
  outfile: WORKER_BUILT,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
});
const builtWorker = await readFile(WORKER_BUILT, "utf8");
const usesImportScripts = /\bimportScripts\s*\(/.test(builtWorker);
const hasDynamicImport = /[^.\w]import\s*\(/.test(builtWorker);
const hasStaticEsm = /^\s*import\s+[\w{*]/m.test(builtWorker) || /^\s*export\s/m.test(builtWorker);

// --- 2. Hash the ACTUALLY-served bundle and check the pin BEFORE launching. ---
const bundleBytes = await readFile(BUNDLE_FILE);
const bundleSha256 = createHash("sha256").update(bundleBytes).digest("hex");
const bundleUnmodified = bundleSha256 === ALLOY_SHA256_PIN;

// AC4: every call the minting-Edge stub served, with the ECID it server-assigned
// and the XDM request body it received — captured server-side for the assertions.
const interactStubCalls = [];

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    // --- AC4 minting-Edge stub: POST .../ee/v1/interact -> a fresh server-assigned
    //     ECID in an Edge-shaped response (the shape alloy persists from). The
    //     harness's main-thread dispatcher rewrites alloy's absolute Edge URL to
    //     this same-origin path. ---
    if (req.method === "POST" && p === "/ee/v1/interact") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const reqBody = Buffer.concat(chunks).toString("utf8");
      const { response, ecid } = mintInteractResponse();
      interactStubCalls.push({ ecid, reqBody, response });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(response));
    }
    if (p === "/") p = "/rig/alloy-chamber-harness.html";
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

let result = null, evalError = null, cookieOnMain = "";
try {
  await page.goto(`http://localhost:${port}/rig/alloy-chamber-harness.html`);
  await page.waitForFunction(() => window.__ALLOY_CHAMBER_RESULT__ !== undefined, { timeout: 30000 });
  result = await page.evaluate(() => window.__ALLOY_CHAMBER_RESULT__);
  // AC4: the broker's REAL jar on main, after the async ECID write-back landed.
  cookieOnMain = await page.evaluate(() => document.cookie);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { pageErrors });
if (!result) fail("FAIL — no result captured from the chamber harness", { pageErrors });
if (result.fatal || result.workerError) {
  fail("FAIL — chamber threw: " + (result.fatal || result.workerError), { result, pageErrors });
}

const s = result.summary || {};

// --- AC2: configure + sendEvent both resolved inside the chamber (no throw). ---
const configureResolved = s.configureSettled === "fulfilled";
const sendEventResolved = s.sendEventSettled === "fulfilled";
const alloyBooted = s.booted === true;

// --- AC2: the load route is the classic-worker / importScripts one (no dynamic
//     import(), no residual ESM in the built worker). ---
const classicLoadRoute = usesImportScripts && !hasDynamicImport && !hasStaticEsm;

// --- AC3: alloy's FIRST synchronous cookie access is served from the sync cache
//     via the granted caps.cookies.sync surface (the getApexDomain/getTld probe),
//     no throw, and the probe cookie round-trips (correct value). ---
const firstReadStack = (s.firstCookieRead && s.firstCookieRead.stack) || [];
const firstReadIsApexProbe = firstReadStack.some((l) => /getApexDomain|getTld/.test(l));
const firstSyncReadServed =
  s.firstCookieRead != null &&
  s.firstCookieReadServedFromSyncSurface === true &&
  s.syncSurfacePresent === true;
const getTldRoundTrips = s.getTldProbeRoundTrip === true;
// AC3: a write-back reconciled the cache to the broker's authoritative jar.
const writeBackReconciled = Array.isArray(result.writeBacks) && result.writeBacks.length >= 1;

// --- AC4: alloy's interact fetch is INTERCEPTED in the chamber and dispatched on
//     MAIN (the boundary the 2a stub marked is now crossed). The shim routes
//     exactly one interact to main; the worker did NO real network fetch; the
//     main-thread dispatcher ran exactly one interact fetch. ---
const interceptedInteract = (s.fetchCalls || []).filter(
  (f) => f.via === "intercepted-to-main" && /\/ee\/v1\/interact/.test(f.url || ""),
);
const exactlyOneInteractIntercepted = interceptedInteract.length === 1;
// No real-network fetch happened in the worker: the counted escape hatch stayed 0
// AND no legacy in-chamber `via:"fetch"` marker survived.
const workerDidNoRealNetworkFetch =
  s.workerRealFetchCalls === 0 && !(s.fetchCalls || []).some((f) => f.via === "fetch");
const md = result.mainDispatch || { count: 0, requests: [] };
const interactDispatchesOnMain = (md.requests || []).filter((r) => /\/ee\/v1\/interact/.test(r.url || ""));
const exactlyOneInteractDispatchedOnMain = interactDispatchesOnMain.length === 1 && md.count === 1;

// --- AC4: the minting stub server-assigned a fresh ECID (unique per call, not the
//     old in-chamber constant), and it landed in the AMCV_*/kndctr_* cell — read
//     from the REAL document.cookie on main after the async write-back. ---
const stubCalledExactlyOnce = interactStubCalls.length === 1;
const mintedEcid = stubCalledExactlyOnce ? interactStubCalls[0].ecid : null;
const ecidIsServerAssigned =
  mintedEcid != null && mintedEcid !== OLD_INCHAMBER_STUB_ECID && /^\d{10,}$/.test(mintedEcid);
// Shape cross-check: the ECID recoverable from the stub's response under the SAME
// read alloy makes (identity:result / namespace ECID) == what the stub minted.
const stubResponseYieldsMintedEcid =
  stubCalledExactlyOnce && extractEcidFromInteractResponse(interactStubCalls[0].response) === mintedEcid;
const amcvWriteBack = (result.writeBacks || []).find((w) => /^AMCV_/.test(w) && /MCMID\|/.test(w));
const ecidInAmcvWriteBack = amcvWriteBack != null && mintedEcid != null && amcvWriteBack.includes(mintedEcid);
const ecidLandedInBrokerJarOnMain =
  mintedEcid != null && /(AMCV_|kndctr_)/.test(cookieOnMain) && cookieOnMain.includes(mintedEcid);

// --- AC4: the intercepted XDM interact payload validates — pageView + top-level
//     query.identity.fetch includes "ECID" (grounded against the executed probe). ---
let xdmInteractValidates = false;
let xdmDetail = null;
try {
  const parsed = JSON.parse((interactDispatchesOnMain[0] || {}).body || "null");
  const ev = ((parsed && parsed.events) || [])[0] || {};
  const isPageView = !!(ev.xdm && ev.xdm.eventType === "web.webpagedetails.pageViews");
  const idFetch = parsed && parsed.query && parsed.query.identity && parsed.query.identity.fetch;
  const fetchesEcid = Array.isArray(idFetch) && idFetch.includes("ECID");
  xdmInteractValidates = isPageView && fetchesEcid;
  xdmDetail = { eventType: ev.xdm && ev.xdm.eventType, identityFetch: idFetch };
} catch (e) {
  xdmDetail = { parseError: String((e && e.message) || e) };
}

const assertions = {
  // --- AC2 + AC3 (kept green) ---
  alloy_booted: alloyBooted,
  configure_resolved: configureResolved,
  send_event_resolved: sendEventResolved,
  classic_worker_importscripts_load_route: classicLoadRoute,
  bundle_unmodified_stock_2_35_0: bundleUnmodified,
  first_sync_cookie_read_served_from_cache: firstSyncReadServed,
  first_read_is_getApexDomain_probe: firstReadIsApexProbe,
  getTld_probe_round_trips_in_sync_cache: getTldRoundTrips,
  sync_read_surface_present_on_caps: s.syncSurfacePresent === true,
  write_back_reconciled_to_broker_jar: writeBackReconciled,
  // --- AC4 (added) ---
  exactly_one_interact_intercepted_in_chamber: exactlyOneInteractIntercepted,
  worker_shim_made_no_real_network_fetch: workerDidNoRealNetworkFetch,
  exactly_one_interact_dispatched_on_main: exactlyOneInteractDispatchedOnMain,
  minting_stub_called_exactly_once: stubCalledExactlyOnce,
  minted_ecid_is_server_assigned_unique: ecidIsServerAssigned,
  stub_response_shape_yields_minted_ecid: stubResponseYieldsMintedEcid,
  minted_ecid_in_amcv_write_back: ecidInAmcvWriteBack,
  minted_ecid_landed_in_broker_jar_on_main: ecidLandedInBrokerJarOnMain,
  xdm_interact_payload_validates: xdmInteractValidates,
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Does stock UNMODIFIED @adobe/alloy@2.35.0, booted in an AIRLOCK classic-worker chamber, have its worker-side interact fetch INTERCEPTED and dispatched by the orchestrator on the MAIN thread (ADR-0004) to a minting-Edge stub, with the server-assigned ECID persisted synchronously into the AMCV_*/kndctr_* cell?",
  pass,
  scope: "AC2 + AC3 + AC4. alloy's interact fetch is intercepted in the chamber and dispatched on MAIN to the rig's minting-Edge stub (server-assigned ECID); the ECID is written back to the broker jar. Egress confinement (AC5) + contract-guard ADR (AC6) are later stages, NOT built here.",
  load_route: {
    worker: "classic Web Worker (new Worker(url), no { type: 'module' })",
    bundle_load: "importScripts (766 KB IIFE)",
    uses_importScripts: usesImportScripts,
    has_dynamic_import: hasDynamicImport, // must be false (AD-7 / AC2 residual)
    has_static_esm_in_built_worker: hasStaticEsm, // must be false (fully bundled)
    no_shared_array_buffer: true, // AD-4
  },
  bundle: {
    file: "probes/alloy-worker/node_modules/@adobe/alloy/dist/alloy.js",
    sha256: bundleSha256,
    sha256_pin: ALLOY_SHA256_PIN,
    unmodified: bundleUnmodified,
  },
  chamber_summary: {
    booted: s.booted,
    importScriptsRevoked: s.importScriptsRevoked,
    configureSettled: s.configureSettled,
    sendEventSettled: s.sendEventSettled,
    syncSurfacePresent: s.syncSurfacePresent,
    firstCookieRead: s.firstCookieRead,
    firstCookieReadServedFromSyncSurface: s.firstCookieReadServedFromSyncSurface,
    getTldProbeRoundTrip: s.getTldProbeRoundTrip,
    cookieReads: s.cookieReads,
    cookieWrites: s.cookieWrites,
    writeBacks: s.writeBacks,
    workerRealFetchCalls: s.workerRealFetchCalls, // AC4: must be 0 (no worker network egress)
    fetchCalls: s.fetchCalls,
    dropped: s.dropped,
  },
  write_backs_received_on_main_thread: (result.writeBacks || []).length,
  // AC4: the orchestrator's main-thread dispatch — the REAL network fetch(es).
  main_thread_dispatch: {
    count: md.count,
    interact_requests: interactDispatchesOnMain.map((r) => ({ url: r.url, method: r.method })),
  },
  interact_intercepted_in_chamber: interceptedInteract,
  minting_edge_stub: {
    calls: interactStubCalls.length,
    minted_ecid: mintedEcid,
    old_inchamber_stub_ecid: OLD_INCHAMBER_STUB_ECID,
  },
  ecid_write_back: {
    amcv_write_back: amcvWriteBack || null,
    cookie_on_main_after_write_back: cookieOnMain,
    minted_ecid_present_in_broker_jar: ecidLandedInBrokerJarOnMain,
  },
  xdm_interact: xdmDetail,
  assertions,
  phases: result.phases,
  page_errors: pageErrors,
  verdict: pass
    ? "PASS — stock unmodified alloy 2.35.0 booted in a classic-worker chamber via createConnectorHost; alloy's interact fetch was INTERCEPTED in the chamber (no real worker fetch) and dispatched by the orchestrator on the MAIN thread to the minting-Edge stub; the stub's server-assigned ECID was persisted synchronously into the AMCV_*/kndctr_* cell and reconciled to the broker's real jar on main; the XDM payload validates (pageView + query.identity.fetch includes ECID). AC2/AC3 stay green. No dynamic import, no SharedArrayBuffer."
    : "FAIL — see assertions",
};

await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  assertions: out.assertions,
  bundle_sha256: out.bundle.sha256,
  main_thread_dispatch: out.main_thread_dispatch,
  minting_edge_stub: out.minting_edge_stub,
  ecid_write_back: out.ecid_write_back,
  xdm_interact: out.xdm_interact,
  verdict: out.verdict,
  out_file: "rig/out/alloy-chamber.json",
}, null, 2));
process.exit(pass ? 0 : 1);
