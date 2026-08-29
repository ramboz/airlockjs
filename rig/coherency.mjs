// MVP2 coherency probe — real two-Worker rig (spec 011-01 in-band + 011-02 out-of-band).
//
// Stands up a main-thread BROKER owning the authoritative jar (a real first-party
// AMCV_*-shaped identity cookie in document.cookie) plus TWO real dedicated Worker
// chambers, each with its own sync-cache + async write-back — the worst-case
// Option-B coherency topology (011-01 AC1). Drives a fully SEQUENCED (deterministic)
// concurrent read-modify-write of the shared cookie from both chambers, reports
// whether the two caches ended coherent + the staleness window, and — off an
// identity-consuming read — whether a stale read is a CORRECTNESS fault (split
// identity) or a benign self-heal (011-01 AC5).
//
// 011-02 extends it with OUT-OF-BAND writes from OUTSIDE any chamber (the identity
// cookie is only ever JS-written, R-004, so the positive sources are foreign JS
// writers and network Set-Cookie is a negative boundary):
//   AC1 foreign main-thread script  — measured in the harness (same-document write;
//                                     cookieStore `change` vs document.cookie poll).
//   AC2 second tab                  — measured here (a second same-origin PAGE in
//                                     the SAME context shares the jar; does tab-1
//                                     detect the write, and how).
//   AC3 network Set-Cookie (negative, both variants) — same-origin (harness) writes
//                                     a DIFFERENT cookie; cross-site demdex (here,
//                                     via page.route) targets Adobe's domain. Neither
//                                     mutates the customer-origin identity cell, by
//                                     JAR RE-READ (Set-Cookie is a forbidden response
//                                     header, R-006 F4 — proven unreadable).
//   AC4 per-source scoreboard.
//
// The rig self-verifies (fails-BOTH-ways, DoD): the concurrent + oob-foreign runs
// must report a split-identity FAULT; the single-chamber, broker-push + oob-broker-
// push controls must report coherent / self-heal; the negative boundaries must NOT
// reach the identity cell. It also re-runs the deterministic scenarios once and
// asserts they are byte-identical (011-01 craft-nit #2 made executable). If any of
// these fails to discriminate, the rig exits non-zero.
//
// Scope limits it states plainly (handed to the 011-03 ADR, per the spec): it
// makes NO B-vs-C isolation choice, does NOT exercise Option C's WASM read-
// semantics, and the server-side / first-party-CNAME mode that WOULD Set-Cookie
// kndctr_* directly is a DIFFERENT deployment R-004 never probed — out of scope
// here, recorded as an open follow-up. No SharedArrayBuffer / COOP-COEP (AD-4).
//
// Usage: node rig/coherency.mjs   (exits non-zero if the detector fails to discriminate)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = fileURLToPath(new URL("./out/coherency.json", import.meta.url));
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const p = decodeURIComponent(url.pathname);
    // AC3 (011-02): a same-origin server Set-Cookie writing a DIFFERENT (session/
    // consent) cookie — the negative boundary the harness re-reads the jar against.
    // NOT HttpOnly, so document.cookie can confirm the different cell was written.
    if (p === "/__set-cookie__") {
      const name = (url.searchParams.get("name") || "airlock_session").replace(/[^a-zA-Z0-9_-]/g, "");
      const value = (url.searchParams.get("value") || "1").replace(/[^a-zA-Z0-9_.-]/g, "");
      res.writeHead(200, {
        "content-type": "text/plain",
        "set-cookie": `${name}=${value}; Path=/; SameSite=Lax`,
      });
      return res.end("set-cookie issued");
    }
    // A minimal same-origin blank doc for the AC2 second tab to write from.
    if (p === "/__blank__") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<!doctype html><meta charset=utf-8><title>second tab</title>");
    }
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
const context = await browser.newContext(); // one context = one shared cookie jar (AC2 second-tab needs this)
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let scenarios = null, detection = null, negativeBoundary = null;
let secondTab = null, crossSite = null, determinism = null;
let harnessError = null, evalError = null, probeError = null;

const HARNESS = `http://localhost:${port}/rig/coherency-harness.html`;

// --- AC2 (011-02): SECOND-TAB write. A second same-origin PAGE in the SAME context
//     (so it shares the cookie jar — separate Playwright *contexts* have isolated
//     jars, which would be a rig artifact, not a browser fact) writes the shared
//     cookie. Measure whether tab-1's broker detects it (cookieStore `change`
//     cross-tab) and, as the guaranteed fallback, by polling the shared jar. ---
async function probeSecondTab() {
  const tabValue = "MCMID|ECID-tab2";
  const sinceLen = await page.evaluate(() => window.__changeLogLen());
  const identityBefore = await page.evaluate(() => window.__readIdentityCookie());
  const tab2 = await context.newPage();
  await tab2.goto(`http://localhost:${port}/__blank__`);
  await tab2.evaluate((v) => {
    document.cookie = "AMCV_TESTORG=" + encodeURIComponent(v) + "; path=/; SameSite=Lax";
  }, tabValue);
  // cookieStore `change` is async; polling the shared jar is immediate on next read.
  const deadline = Date.now() + 1500;
  let cookieStoreChangeFired = false, pollingDetected = false;
  while (Date.now() < deadline) {
    cookieStoreChangeFired = await page.evaluate(([v, s]) => window.__changeFiredFor(v, s), [tabValue, sinceLen]);
    pollingDetected = (await page.evaluate(() => window.__readIdentityCookie())) === tabValue;
    if (cookieStoreChangeFired || pollingDetected) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await tab2.close();
  return {
    source: "second-tab",
    identityCellBefore: identityBefore,
    tabWroteValue: tabValue,
    cookieStoreChangeFired,
    pollingDetected,
    detectable: cookieStoreChangeFired || pollingDetected,
    detectionMechanism: cookieStoreChangeFired
      ? "cookieStore-change" : (pollingDetected ? "document.cookie-polling" : "none"),
  };
}

// --- AC3 (011-02): CROSS-SITE demdex Set-Cookie (negative boundary). Intercept a
//     cross-site demdex-shaped request and return Set-Cookie for Adobe's domain.
//     By same-origin policy it cannot reach the customer-origin AMCV_* cell; confirm
//     by broker jar re-read that the identity cell is untouched and demdex is absent
//     from the customer jar. ---
async function probeCrossSiteDemdex() {
  const identityBefore = await page.evaluate(() => window.__readIdentityCookie());
  const demdexUrl = "https://demdex-fake.example/id?d_visid_ver=5.5.0";
  let routed = false, fetchError = null;
  await page.route("https://demdex-fake.example/**", (route) => {
    routed = true;
    return route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/plain",
        "access-control-allow-origin": "*",
        "set-cookie": "demdex=DEMDEX-xyz; Domain=.demdex-fake.example; Path=/; SameSite=None; Secure",
      },
      body: "{}",
    });
  });
  try {
    await page.evaluate(
      (u) => fetch(u, { mode: "no-cors", credentials: "include" }).then(() => {}).catch(() => {}),
      demdexUrl,
    );
  } catch (e) { fetchError = String(e); }
  await page.waitForTimeout(150);
  const identityAfter = await page.evaluate(() => window.__readIdentityCookie());
  const demdexInCustomerJar = await page.evaluate(() => /(?:^|;\s*)demdex=/.test(document.cookie));
  await page.unroute("https://demdex-fake.example/**");
  return {
    source: "network-set-cookie:cross-site-demdex",
    routed,
    driven: "page.route interception of a cross-site demdex-shaped request returning Set-Cookie for Adobe's domain",
    identityCellBefore: identityBefore,
    identityCellAfter: identityAfter,
    identityCellMutated: identityBefore !== identityAfter, // must be false
    demdexInCustomerJar, // must be false — the cookie targets Adobe's domain / is partitioned
    fetchError,
    rationale:
      "A cross-site Set-Cookie targets Adobe's domain (.demdex-fake.example here; .demdex.net live) or is " +
      "CHIPS-partitioned — by same-origin policy it cannot write the customer-origin AMCV_* identity cell, and " +
      "it is absent from the customer jar. Confirmed by broker jar re-read, not header inspection (R-006 F4).",
  };
}

// --- 011-01 craft-nit #2 made executable: re-run the deterministic scenarios once
//     in a fresh page and assert byte-identity (empirical detection latencies/sids
//     are excluded — only the sequenced model scenarios are deterministic). ---
async function reRunScenariosForDeterminism() {
  const p = await context.newPage();
  await p.goto(HARNESS);
  await p.waitForFunction(() => window.__coherencyDone === true, { timeout: 20000 });
  const s2 = await p.evaluate(() => window.__coherencyResult?.scenarios ?? null);
  await p.close();
  return s2;
}

try {
  await page.goto(HARNESS);
  await page.waitForFunction(() => window.__coherencyDone === true, { timeout: 20000 });
  harnessError = await page.evaluate(() => window.__coherencyError ?? null);
  scenarios = await page.evaluate(() => window.__coherencyResult?.scenarios ?? null);
  detection = await page.evaluate(() => window.__coherencyResult?.detection ?? null);
  negativeBoundary = await page.evaluate(() => window.__coherencyResult?.negativeBoundary ?? null);

  if (!harnessError && scenarios) {
    // The Node-driven out-of-band probes (multi-page / cross-site routing).
    try {
      secondTab = await probeSecondTab();
      crossSite = await probeCrossSiteDemdex();
      const scenarios2 = await reRunScenariosForDeterminism();
      determinism = {
        scenarios_byte_identical: JSON.stringify(scenarios) === JSON.stringify(scenarios2),
        note: "the sequenced model scenarios re-run byte-identical across two browser loads; empirical detection latencies/random sids are excluded by design",
      };
    } catch (e) {
      probeError = String(e && (e.stack || e.message || e));
    }
  }
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

function fail(verdict, extra = {}) {
  const out = { pass: false, verdict, page_errors: pageErrors, ...extra };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

if (evalError) fail("FAIL — rig error: " + evalError.message);
if (harnessError) fail("FAIL — harness threw: " + harnessError);
if (!scenarios) fail("FAIL — no scenarios captured from the harness");
if (probeError) fail("FAIL — out-of-band probe error: " + probeError, { scenarios });

const concurrent = scenarios["concurrent-async-writeback"];
const single = scenarios["single-chamber"];
const push = scenarios["broker-push"];
const oobForeign = scenarios["oob-foreign-writeback"];
const oobPush = scenarios["oob-broker-push"];

// --- 011-01 fails-both-ways self-check (in-band). ---
const divergentRunReportsFault =
  concurrent.coherence.coherent === false &&
  concurrent.identity.verdict === "fault" &&
  concurrent.identity.distinctEcids.length === 2 &&
  concurrent.staleness.reconciledWithinRun === false &&
  concurrent.mints.length === 2;

const singleControlReportsCoherent =
  single.coherence.coherent === true &&
  single.identity.verdict === "coherent" &&
  single.mints.length === 1;

const brokerPushControlSelfHeals =
  push.coherence.coherent === true &&
  push.identity.verdict === "self-heal" &&
  push.staleness.staleReadOccurred === true &&
  push.staleness.reconciledWithinRun === true &&
  push.mints.length === 1;

// --- 011-02 out-of-band self-check. The foreign write with no invalidation is a
//     split-identity FAULT that never adopts the foreign identity; broker-push on
//     detection SELF-HEALS (the chamber attaches the foreign ECID, mints nothing),
//     with the staleness window decomposing into detection + propagation lag. ---
const oobForeignReportsFault =
  oobForeign.identity.verdict === "fault" &&
  oobForeign.identity.distinctEcids.includes("ECID-foreign") &&
  oobForeign.oob.reconciledToOobValue === false &&
  oobForeign.staleness.staleReadOccurred === true;

const oobBrokerPushSelfHeals =
  oobPush.identity.verdict === "self-heal" &&
  oobPush.oob.reconciledToOobValue === true &&
  oobPush.mints.length === 0 &&
  oobPush.oob.detectionLagOps >= 1 &&
  oobPush.oob.propagationLagOps >= 1;

// --- 011-02 detection (positive sources must be detectable by SOME AD-4-clean
//     means; polling is the guaranteed backstop — we do NOT gate on cookieStore
//     `change` firing, which we merely measure). ---
const foreignScriptDetectable = detection?.foreignMainThreadScript?.detectable === true;
const secondTabDetectable = secondTab?.detectable === true;

// --- 011-02 negative boundaries: neither Set-Cookie variant mutates the identity
//     cell; the same-origin server DID write a DIFFERENT cell; the Set-Cookie
//     response header is NOT readable (R-006 F4). ---
const neg = negativeBoundary?.sameOriginSetCookie;
const sameOriginNegativeHolds =
  neg?.identityCellMutated === false &&
  neg?.otherCookieWritten === true &&
  neg?.setCookieHeaderReadable !== true;
const crossSiteNegativeHolds =
  crossSite?.routed === true && // page.route MUST have intercepted, else the boundary passes vacuously (011-02 compliance review)
  crossSite?.identityCellMutated === false &&
  crossSite?.demdexInCustomerJar === false;

// AC1 fidelity: the authoritative jar genuinely lived in the real document.cookie
// (every scenario, including the two out-of-band ones).
const jarIsRealCookie = Object.values(scenarios).every((r) => r.jarLivesInRealCookie === true);

const determinismHeld = determinism?.scenarios_byte_identical === true;

const failsBothWays =
  divergentRunReportsFault && singleControlReportsCoherent && brokerPushControlSelfHeals &&
  oobForeignReportsFault && oobBrokerPushSelfHeals;
const outOfBandBoundariesHold =
  foreignScriptDetectable && secondTabDetectable && sameOriginNegativeHolds && crossSiteNegativeHolds;
const pass = failsBothWays && jarIsRealCookie && outOfBandBoundariesHold && determinismHeld;

// --- The per-source out-of-band scoreboard (AC4). The correctness mechanism is
//     source-INDEPENDENT (it turns on detect-before-consume, not on which foreign
//     actor wrote) — so both positive sources share the deterministic oob
//     correctness verdicts; the per-source variable is DETECTABILITY. ---
const unmitigated = {
  mechanism: oobForeign.mechanism,
  identity_verdict: oobForeign.identity.verdict, // fault
  distinct_identities: oobForeign.identity.distinctEcids,
  reconciles_to_foreign_identity: oobForeign.oob.reconciledToOobValue, // false
  staleness_ops: oobForeign.oob.totalStalenessOps,
  note: "seed + async write-back (MVP1 shim, no invalidation): the chamber mints a DUPLICATE off its stale cache while a valid foreign identity already exists — split identity, never reconciled to the foreign value.",
};
const mitigated = {
  mechanism: oobPush.mechanism,
  identity_verdict: oobPush.identity.verdict, // self-heal
  reconciles_to_foreign_identity: oobPush.oob.reconciledToOobValue, // true
  detection_lag_ops: oobPush.oob.detectionLagOps,
  propagation_lag_ops: oobPush.oob.propagationLagOps,
  total_staleness_ops: oobPush.oob.totalStalenessOps,
  note: "broker-push invalidation on detection: the broker detects the foreign write and pushes it before consumption -> the chamber ATTACHES the foreign ECID and mints nothing. Window = detection lag + propagation lag (R-006 F4).",
};
function positiveSourceRow(det) {
  return {
    detectable: det.detectable,
    detection_mechanism: det.detectionMechanism,
    cookie_store_available: det.cookieStoreAvailable ?? null,
    cookie_store_change_fired: det.cookieStoreChangeFired,
    cookie_store_change_latency_ms: det.cookieStoreChangeLatencyMs ?? null,
    polling_detected: det.pollingDetected,
    unmitigated_correctness: unmitigated, // source-independent (see note)
    mitigated_correctness: mitigated, // source-independent (see note)
  };
}

const outOfBand = {
  correctness_is_source_independent:
    "The fault/self-heal dichotomy depends on detect-before-consume, not on which foreign actor wrote — so both positive sources share the deterministic oob correctness verdicts. The per-source variable is DETECTABILITY, measured empirically below.",
  cookie_store: {
    ...(detection.cookieStore || {}),
    note: "cookieStore is a Window property (present on the broker); listenerValidated is measured against the async cookieStore.set() path so a negative for document.cookie / cross-tab writes below is real platform behavior, not a broken probe (R-006 F3; DoD kill-criteria).",
  },
  positive_sources: {
    "foreign-main-thread-script": positiveSourceRow(detection.foreignMainThreadScript),
    "second-tab": positiveSourceRow(secondTab),
  },
  negative_boundary: {
    "network-set-cookie:same-origin": {
      identity_cell_mutated: neg.identityCellMutated, // false
      other_cookie_written: neg.otherCookieWritten, // true — a DIFFERENT cell
      other_cookie_name: neg.otherCookieName,
      set_cookie_header_readable: neg.setCookieHeaderReadable, // false — forbidden header (R-006 F4)
      identity_cell_before: neg.identityCellBefore,
      identity_cell_after: neg.identityCellAfter,
      note: "a same-origin server Set-Cookie writes a DIFFERENT (session/consent) cookie; the AMCV_* identity cell is untouched. Detected by jar re-read; the Set-Cookie header is unreadable.",
    },
    "network-set-cookie:cross-site-demdex": {
      identity_cell_mutated: crossSite.identityCellMutated, // false
      demdex_in_customer_jar: crossSite.demdexInCustomerJar, // false
      routed: crossSite.routed,
      driven: crossSite.driven,
      rationale: crossSite.rationale,
    },
  },
  out_of_scope: {
    "server-side / first-party-CNAME Set-Cookie of kndctr_* directly":
      "A DIFFERENT deployment R-004 never probed — a first-party-CNAME edge that Set-Cookies the identity cell directly (rather than JS-writing it from the Edge response body). Explicitly out of scope for this slice (AC3); recorded as an open follow-up for OQ9 / 011-03.",
  },
  determinism,
};

const out = {
  question:
    "When the shared first-party identity cookie is written OUTSIDE any chamber — by a foreign main-thread script or a second tab — how stale does a chamber's synchronous cached view become, for how long, does it reconcile without SAB, and is a stale identity-consuming read a split-identity FAULT or a self-heal? And does any network Set-Cookie reach the cached identity cell at all?",
  pass,
  topology: "main-thread broker (authoritative jar = real document.cookie) + 2 real dedicated Worker chambers (own sync-cache + async write-back) — worst-case ADR-0001 Option B",
  no_shared_array_buffer: true, // AD-4: coherency measured over async postMessage / cookieStore only
  scope_limits: [
    "makes NO ADR-0001 B-vs-C isolation choice",
    "does NOT exercise Option C's WASM read-semantics (marshal-each-read / unmodified-bundle) — Worker (B) topology only",
    "server-side / first-party-CNAME Set-Cookie of kndctr_* directly is a different deployment R-004 never probed — out of scope (open follow-up)",
  ],
  fails_both_ways: {
    // in-band (011-01)
    divergent_run_reports_fault: divergentRunReportsFault,
    single_chamber_control_reports_coherent: singleControlReportsCoherent,
    broker_push_control_self_heals: brokerPushControlSelfHeals,
    // out-of-band (011-02)
    oob_foreign_write_reports_fault: oobForeignReportsFault,
    oob_broker_push_self_heals: oobBrokerPushSelfHeals,
    // boundaries (011-02)
    foreign_script_detectable: foreignScriptDetectable,
    second_tab_detectable: secondTabDetectable,
    same_origin_set_cookie_does_not_reach_identity_cell: sameOriginNegativeHolds,
    cross_site_demdex_does_not_reach_identity_cell: crossSiteNegativeHolds,
    // fidelity + reproducibility
    jar_is_real_document_cookie: jarIsRealCookie,
    scenarios_byte_identical_across_two_browser_runs: determinismHeld,
  },
  // The in-band scoreboard (011-01) the rest of the probe reuses.
  scoreboard: Object.fromEntries(Object.entries(scenarios).map(([k, r]) => [k, {
    mechanism: r.mechanism,
    source: r.source,
    chambers: r.chambers,
    jar_seed: r.jarSeed,
    jar_final: r.jarFinal,
    final_caches: r.finalCaches,
    coherent: r.coherence.coherent,
    caches_agree: r.coherence.cachesAgree,
    agree_with_jar: r.coherence.agreeWithJar,
    any_cache_absent: r.coherence.anyAbsent,
    minted_ecids: r.mints,
    identity_verdict: r.identity.verdict,
    identity_kind: r.identity.kind,
    distinct_ecids: r.identity.distinctEcids,
    stale_read_occurred: r.staleness.staleReadOccurred,
    max_staleness_ops: r.staleness.maxStalenessOps,
    reconciled_within_run: r.staleness.reconciledWithinRun,
    oob: r.oob,
    jar_lives_in_real_cookie: r.jarLivesInRealCookie,
    jar_cookie_readback: r.jarCookieReadback,
  }])),
  // The out-of-band per-source scoreboard (011-02 AC4).
  out_of_band: outOfBand,
  scenarios, // full op-logs for auditability
  page_errors: pageErrors,
  verdict: pass
    ? "PASS — out-of-band: a foreign write with the MVP1 seed+async-write-back shim is a split-identity FAULT (the chamber mints a duplicate; never reconciles to the foreign identity), while broker-push invalidation on detection SELF-HEALS it (attach, no mint; window = detection + propagation lag). Both positive sources (foreign script, second tab) are DETECTABLE (cookieStore `change` where it fires, else the document.cookie-polling backstop). Neither network Set-Cookie variant reaches the customer-origin identity cell (jar re-read; Set-Cookie header unreadable). The in-band controls still fail both ways, the jar lived in the real document.cookie, and the deterministic scenarios re-ran byte-identical. No SharedArrayBuffer."
    : "FAIL — the detector did not discriminate; see fails_both_ways",
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  fails_both_ways: out.fails_both_ways,
  out_of_band: out.out_of_band,
  verdict: out.verdict,
  out_file: "rig/out/coherency.json",
}, null, 2));
process.exit(pass ? 0 : 1);
