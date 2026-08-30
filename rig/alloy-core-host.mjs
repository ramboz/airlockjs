// Alloy core-hosted chamber rig — spec 014-01, AC1/AC2/AC3/AC4.
//
// Re-runs the 012-01 single-chamber scenario (rig/alloy-chamber.mjs) but
// drives it THROUGH core/wrapped-sdk-host.js (the new sibling core module,
// spec 014-01) instead of the rig-only inline harness logic that module was
// extracted from. connectors/alloy/alloy-chamber.worker.js is byte-identical
// to 012-01 — UNCHANGED by this slice, DO NOT modify it — and so is the
// minting-Edge stub (rig/alloy-mint-stub.js): only the MAIN-THREAD side (the
// round-trip egress dispatch + cookie write-back reconciliation) moved, from
// the harness into core/.
//
// SCOPE — AC1/AC2/AC3/AC4 of spec 014-01. AC5 (the round-trip surface is a
// documented, contract-pinned capability) is a static grounding check verified
// by test/contract-stability.test.js, not a runtime behavior this browser rig
// can demonstrate. AC6 (the fetch-shim timeout hardening) is verified by
// test/wrapped-sdk-host.test.js's bounded timeout test, not re-proven here.
//
// Asserts (AC1 — a sibling core module hosts alloy via the generic host, in a
// real Worker chamber):
//   1. alloy `configure` + `sendEvent` both resolve inside the core-hosted
//      chamber (no throw), driven by core/wrapped-sdk-host.js's init()/driveEvent();
//   2. the loaded bundle is byte-identical stock 2.35.0 — sha256 pinned (AD-7);
//   3. the classic-worker / importScripts load route is unchanged (012-01 AC2).
// Asserts (AC2 — round-trip egress dispatch IN THE SIBLING MODULE):
//   4. the worker's shim did NO real network fetch (workerRealFetchCalls===0)
//      and made exactly one intercepted-to-main call;
//   5. core/wrapped-sdk-host.js's OWN mainDispatch tally shows EXACTLY ONE
//      interact dispatched (via its caps.egress.dispatch -> real main fetch);
//   6. the intercepted XDM interact payload validates (pageView + top-level
//      query.identity.fetch includes "ECID").
// Asserts (AC3 — ECID round-trips into the jar THROUGH core):
//   7. the minting stub's SERVER-assigned ECID (unique, not the old in-chamber
//      constant) landed in the AMCV_*/kndctr_* cell — read from real
//      document.cookie on main, after core's write-back reconciliation
//      (caps.cookies.reconcile, wired from core/wrapped-sdk-host.js's
//      reconcileForBrokerJar).
// Asserts (AC4 — confinement regression re-run against the core-hosted chamber):
//   8. the UNCHANGED 012-01 AC5 adversarial probe set is unreachable inside the
//      chamber post-boot (XHR / sendBeacon / WebSocket / EventSource /
//      WebTransport / nested Worker / CacheStorage / post-load importScripts);
//   9. the mediated fetch is PRESERVED as the sole surface and alloy STILL
//      boots + sends through it;
//  10. the disclosed dynamic-loader residual outcome is recorded honestly
//      (blocked | disclosed-residual) — never silently passed, never failing
//      the rig.
//
// Usage: node rig/alloy-core-host.mjs   (exits non-zero if any assertion fails)
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
const OUT = join(ROOT, "rig/out/alloy-core-host.json");
// UNCHANGED 012-01 chamber source — this slice does not touch it.
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-core-host.worker.built.js");
const BUNDLE_FILE = join(ROOT, "probes/alloy-worker/node_modules/@adobe/alloy/dist/alloy.js");
const HARNESS_PATH = "/rig/alloy-core-host-harness.html";

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

// --- 1. Build the SAME unmodified 012-01 chamber worker into a classic IIFE
//        (esbuild -> IIFE, importScripts left untouched) — byte-identical
//        load route to rig/alloy-chamber.mjs; only the OUTPUT path differs so
//        the two rigs never race on a shared build artifact. ---
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

// Every call the minting-Edge stub served, with the ECID it server-assigned
// and the XDM request body it received — captured server-side for the
// assertions (byte-identical stub logic to rig/alloy-chamber.mjs).
const interactStubCalls = [];

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (req.method === "POST" && p === "/ee/v1/interact") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const reqBody = Buffer.concat(chunks).toString("utf8");
      const { response, ecid } = mintInteractResponse();
      interactStubCalls.push({ ecid, reqBody, response });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(response));
    }
    // AC4 (012-01 AC5 regression): a REMOTE ES module the chamber's disclosed
    // dynamic-loader residual probe attempts to load.
    if (p === "/__egress_probe_module__.mjs") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end('export const MARKER = "REMOTE_LOADER_REACHED";');
    }
    if (p === "/") p = HARNESS_PATH;
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
  await page.goto(`http://localhost:${port}${HARNESS_PATH}`);
  await page.waitForFunction(() => window.__ALLOY_CORE_HOST_RESULT__ !== undefined, { timeout: 30000 });
  result = await page.evaluate(() => window.__ALLOY_CORE_HOST_RESULT__);
  // AC3: the broker's REAL jar on main, after core's async ECID write-back landed.
  cookieOnMain = await page.evaluate(() => document.cookie);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { pageErrors });
if (!result) fail("FAIL — no result captured from the core-hosted chamber harness", { pageErrors });
if (result.fatal || result.workerError) {
  fail("FAIL — core-hosted chamber threw: " + (result.fatal || result.workerError), { result, pageErrors });
}

const s = result.summary || {};

// --- AC1: alloy boots in the core-hosted chamber (core/wrapped-sdk-host.js
//     drove init()+driveEvent() through the SAME createConnectorHost route as
//     012-01) and sends; the classic-worker / importScripts load route holds. ---
const alloyBooted = s.booted === true;
const configureResolved = s.configureSettled === "fulfilled";
const sendEventResolved = s.sendEventSettled === "fulfilled";
const classicLoadRoute = usesImportScripts && !hasDynamicImport && !hasStaticEsm;

// --- AC2: the round-trip egress dispatch ran through core/wrapped-sdk-host.js
//     (caps.egress.dispatch -> the real main-thread fetch): the worker made NO
//     real network fetch, and core's own mainDispatch tally shows EXACTLY ONE
//     interact dispatched. ---
const workerDidNoRealNetworkFetch =
  s.workerRealFetchCalls === 0 && !(s.fetchCalls || []).some((f) => f.via === "fetch");
const interceptedInteract = (s.fetchCalls || []).filter(
  (f) => f.via === "intercepted-to-main" && /\/ee\/v1\/interact/.test(f.url || ""),
);
const exactlyOneInteractIntercepted = interceptedInteract.length === 1;
const md = result.mainDispatch || { count: 0, requests: [] };
const interactDispatchesOnMain = (md.requests || []).filter((r) => /\/ee\/v1\/interact/.test(r.url || ""));
const exactlyOneInteractDispatchedByCore = interactDispatchesOnMain.length === 1 && md.count === 1;

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

// --- AC3: the stub's server-assigned ECID round-trips into the AMCV_*/kndctr_*
//     jar THROUGH core's dispatch + write-back reconciliation
//     (core/wrapped-sdk-host.js's reconcileForBrokerJar -> caps.cookies.reconcile). ---
const stubCalledExactlyOnce = interactStubCalls.length === 1;
const mintedEcid = stubCalledExactlyOnce ? interactStubCalls[0].ecid : null;
const ecidIsServerAssigned =
  mintedEcid != null && mintedEcid !== OLD_INCHAMBER_STUB_ECID && /^\d{10,}$/.test(mintedEcid);
const stubResponseYieldsMintedEcid =
  stubCalledExactlyOnce && extractEcidFromInteractResponse(interactStubCalls[0].response) === mintedEcid;
const writeBackReconciledThroughCore = Array.isArray(result.writeBacks) && result.writeBacks.length >= 1;
const amcvWriteBack = (result.writeBacks || []).find((w) => /^AMCV_/.test(w) && /MCMID\|/.test(w));
const ecidInAmcvWriteBack = amcvWriteBack != null && mintedEcid != null && amcvWriteBack.includes(mintedEcid);
const ecidLandedInBrokerJarOnMain =
  mintedEcid != null && /(AMCV_|kndctr_)/.test(cookieOnMain) && cookieOnMain.includes(mintedEcid);

// --- AC4: confinement regression re-run — the UNCHANGED 012-01 AC5 adversarial
//     probe, against the core-hosted chamber (location-independent per spec's
//     Assumptions: confinement is chamber-side, so this is a cheap re-run, not
//     a live risk). ---
const egress = result.egressProbe || {};
const egressProbes = egress.probes || {};
const egressConfinement = egress.confinement || {};
const remoteLoader = egress.remoteLoader || {};

const unreachable = (key) => {
  const p = egressProbes[key];
  return !!p && p.reachable === false;
};

const xhrConfined = unreachable("XMLHttpRequest");
const sendBeaconConfined = unreachable("navigator_sendBeacon");
const webSocketConfined = unreachable("WebSocket");
const eventSourceConfined = unreachable("EventSource");
const webTransportConfined = unreachable("WebTransport");
const nestedWorkerConfined = unreachable("nested_Worker");
const cacheStorageConfined = unreachable("CacheStorage");
const importScriptsConfined = unreachable("importScripts") && s.importScriptsRevoked === true;

const mediatedFetchPreserved = egressConfinement.fetchPreserved === true;
const alloyStillBootsAndSendsAfterConfinement =
  alloyBooted && configureResolved && sendEventResolved &&
  exactlyOneInteractIntercepted && exactlyOneInteractDispatchedByCore;

const remoteLoaderResidualHonestlyRecorded =
  remoteLoader.attempted === true &&
  (remoteLoader.outcome === "blocked" || remoteLoader.outcome === "disclosed-residual");

const assertions = {
  // --- AC1 ---
  ac1_alloy_booted_in_core_hosted_chamber: alloyBooted,
  ac1_configure_resolved: configureResolved,
  ac1_send_event_resolved: sendEventResolved,
  ac1_classic_worker_importscripts_load_route: classicLoadRoute,
  ac1_bundle_unmodified_stock_2_35_0: bundleUnmodified,
  // --- AC2 ---
  ac2_worker_shim_made_no_real_network_fetch: workerDidNoRealNetworkFetch,
  ac2_exactly_one_interact_intercepted_in_chamber: exactlyOneInteractIntercepted,
  ac2_exactly_one_interact_dispatched_by_core: exactlyOneInteractDispatchedByCore,
  ac2_xdm_interact_payload_validates: xdmInteractValidates,
  // --- AC3 ---
  ac3_minting_stub_called_exactly_once: stubCalledExactlyOnce,
  ac3_minted_ecid_is_server_assigned_unique: ecidIsServerAssigned,
  ac3_stub_response_shape_yields_minted_ecid: stubResponseYieldsMintedEcid,
  ac3_write_back_reconciled_through_core: writeBackReconciledThroughCore,
  ac3_minted_ecid_in_amcv_write_back: ecidInAmcvWriteBack,
  ac3_minted_ecid_landed_in_broker_jar_on_main: ecidLandedInBrokerJarOnMain,
  // --- AC4 (012-01 AC5 regression) ---
  ac4_egress_XMLHttpRequest_unreachable_in_chamber: xhrConfined,
  ac4_egress_navigator_sendBeacon_unreachable_in_chamber: sendBeaconConfined,
  ac4_egress_WebSocket_unreachable_in_chamber: webSocketConfined,
  ac4_egress_EventSource_unreachable_in_chamber: eventSourceConfined,
  ac4_egress_WebTransport_unreachable_in_chamber: webTransportConfined,
  ac4_egress_nested_Worker_unreachable_in_chamber: nestedWorkerConfined,
  ac4_egress_CacheStorage_unreachable_in_chamber: cacheStorageConfined,
  ac4_egress_post_load_importScripts_revoked_and_unreachable: importScriptsConfined,
  ac4_egress_mediated_fetch_preserved_as_sole_surface: mediatedFetchPreserved,
  ac4_egress_alloy_still_boots_and_sends_after_confinement: alloyStillBootsAndSendsAfterConfinement,
  ac4_egress_remote_loader_residual_honestly_recorded: remoteLoaderResidualHonestlyRecorded,
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Does the 012-01 single-chamber alloy scenario (stock alloy booted in a classic-worker chamber, its intercepted interact fetch dispatched on MAIN to the minting-Edge stub, the server-assigned ECID persisted into the AMCV_*/kndctr_* jar) now run THROUGH core/wrapped-sdk-host.js (a new sibling core module, spec 014-01) instead of the rig-only harness mirror — with core/airlock.js and core/chamber.worker.js untouched — while the 012-01 AC5 egress-confinement posture still holds against the core-hosted chamber?",
  pass,
  scope:
    "spec 014-01 AC1-AC4 (AC5 — the round-trip surface is a documented, contract-pinned capability — is verified by test/contract-stability.test.js, not this browser rig; AC6 — the fetch-shim timeout hardening — is verified by test/wrapped-sdk-host.test.js's bounded timeout test, not re-proven here). connectors/alloy/alloy-chamber.worker.js is BYTE-IDENTICAL to 012-01 (unchanged by this slice).",
  load_route: {
    worker: "classic Web Worker (new Worker(url), no { type: 'module' }) — UNCHANGED from 012-01",
    bundle_load: "importScripts (766 KB IIFE)",
    uses_importScripts: usesImportScripts,
    has_dynamic_import: hasDynamicImport,
    has_static_esm_in_built_worker: hasStaticEsm,
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
    workerRealFetchCalls: s.workerRealFetchCalls, // AC2: must be 0 (no worker network egress)
    fetchCalls: s.fetchCalls,
    dropped: s.dropped,
  },
  // AC2: core/wrapped-sdk-host.js's OWN dispatch tally — the round-trip egress
  // ran through THIS module, not the rig harness mirror.
  main_thread_dispatch_via_core: {
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
  egress_confinement_regression: {
    posture:
      "ALLOW-LIST (unchanged 012-01 posture; the chamber source is byte-identical). Re-run here against the CORE-hosted chamber per spec 014-01 AC4 — confinement is chamber-side (applyEgressConfinement runs in the worker's own scope), so this is a cheap regression re-run, not a live risk (spec Assumptions).",
    withheld_record: egressConfinement,
    adversarial_probes: egressProbes,
    mediated_fetch_preserved: mediatedFetchPreserved,
    alloy_still_boots_and_sends_after_confinement: alloyStillBootsAndSendsAfterConfinement,
    remote_loader_residual: remoteLoader,
  },
  assertions,
  phases: result.phases,
  page_errors: pageErrors,
  verdict: pass
    ? "PASS — the 012-01 single-chamber alloy scenario now runs through core/wrapped-sdk-host.js (spec 014-01): alloy boots in the core-hosted chamber, its intercepted interact is dispatched EXACTLY ONCE by core's own round-trip egress (caps.egress.dispatch) to the minting-Edge stub, the server-assigned ECID round-trips into the AMCV_*/kndctr_* jar via core's write-back reconciliation, and the 012-01 AC5 egress-confinement posture regression-passes unchanged against the core-hosted chamber. core/airlock.js + core/chamber.worker.js are untouched by this slice (verify via `git diff` outside this rig)."
    : "FAIL — see assertions",
};

await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  assertions: out.assertions,
  bundle_sha256: out.bundle.sha256,
  main_thread_dispatch_via_core: out.main_thread_dispatch_via_core,
  minting_edge_stub: out.minting_edge_stub,
  ecid_write_back: out.ecid_write_back,
  xdm_interact: out.xdm_interact,
  egress_confinement_regression: {
    mediated_fetch_is_sole_surface: mediatedFetchPreserved,
    adversarial_set_all_unreachable:
      xhrConfined && sendBeaconConfined && webSocketConfined && eventSourceConfined &&
      webTransportConfined && nestedWorkerConfined && cacheStorageConfined && importScriptsConfined,
    alloy_still_boots_and_sends_after_confinement: alloyStillBootsAndSendsAfterConfinement,
    disclosed_remote_loader_residual: { outcome: remoteLoader.outcome, reachable: remoteLoader.reachable, detail: remoteLoader.detail },
  },
  verdict: out.verdict,
  out_file: "rig/out/alloy-core-host.json",
}, null, 2));
process.exit(pass ? 0 : 1);
