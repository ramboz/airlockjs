// MVP2 coherency probe — real two-Worker rig (spec 011-01).
//
// Stands up a main-thread BROKER owning the authoritative jar (a real first-party
// AMCV_*-shaped identity cookie in document.cookie) plus TWO real dedicated Worker
// chambers, each with its own sync-cache + async write-back — the worst-case
// Option-B coherency topology (AC1). Drives a fully SEQUENCED (deterministic)
// concurrent read-modify-write of the shared cookie from both chambers (AC2), then
// reports, programmatically (JSON to rig/out/coherency.json), whether the two
// caches ended coherent with each other and the jar and the measured staleness
// window (AC3), and — off an identity-consuming read — whether a stale read is a
// CORRECTNESS fault (duplicate / split identity) or a benign self-heal (AC5).
//
// The rig is self-verifying via a fails-BOTH-ways control (DoD): the concurrent
// async-write-back run must report divergence + a split-identity fault, while the
// single-chamber and broker-push controls must report coherent / self-heal. If the
// detector cannot tell them apart, the rig exits non-zero.
//
// Scope limits it states plainly (handed to the 011-03 ADR, per the spec): it
// makes NO B-vs-C isolation choice, and it does NOT exercise Option C's WASM
// read-semantics (marshal-each-read / unmodified-bundle) — it measures coherency
// for the Worker (Option B) topology only. No SharedArrayBuffer / COOP-COEP (AD-4).
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
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
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
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let scenarios = null, harnessError = null, evalError = null;
try {
  await page.goto(`http://localhost:${port}/rig/coherency-harness.html`);
  await page.waitForFunction(() => window.__coherencyDone === true, { timeout: 20000 });
  harnessError = await page.evaluate(() => window.__coherencyError ?? null);
  scenarios = await page.evaluate(() => window.__coherencyResult?.scenarios ?? null);
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

const concurrent = scenarios["concurrent-async-writeback"];
const single = scenarios["single-chamber"];
const push = scenarios["broker-push"];

// --- The fails-both-ways self-check (DoD): the SAME detector must fire on the
//     divergent run and stay silent on the coherent controls. ---
const divergentRunReportsFault =
  concurrent.coherence.coherent === false &&
  concurrent.identity.verdict === "fault" &&
  concurrent.identity.distinctEcids.length === 2 &&
  concurrent.staleness.reconciledWithinRun === false && // the lost update never reconciled in-page
  concurrent.mints.length === 2; // both chambers minted off the stale seed

const singleControlReportsCoherent =
  single.coherence.coherent === true &&
  single.identity.verdict === "coherent" &&
  single.mints.length === 1;

const brokerPushControlSelfHeals =
  push.coherence.coherent === true &&
  push.identity.verdict === "self-heal" &&
  push.staleness.staleReadOccurred === true && // c2 DID momentarily read stale
  push.staleness.reconciledWithinRun === true && // …and reconciled before consuming it
  push.mints.length === 1; // no duplicate ECID minted

// AC1 fidelity: the authoritative jar genuinely lived in the real document.cookie.
const jarIsRealCookie =
  concurrent.jarLivesInRealCookie === true &&
  single.jarLivesInRealCookie === true &&
  push.jarLivesInRealCookie === true;

const failsBothWays =
  divergentRunReportsFault && singleControlReportsCoherent && brokerPushControlSelfHeals;
const pass = failsBothWays && jarIsRealCookie;

const out = {
  question:
    "Under async write-back, do two real Worker chambers' sync-caches of a shared " +
    "identity cookie diverge when both write concurrently — and does a stale " +
    "identity-consuming read cause a CORRECTNESS fault (split identity) or self-heal?",
  pass,
  topology: "main-thread broker (authoritative jar = real document.cookie) + 2 real dedicated Worker chambers (own sync-cache + async write-back) — worst-case ADR-0001 Option B",
  no_shared_array_buffer: true, // AD-4: coherency measured over async postMessage only
  scope_limits: [
    "makes NO ADR-0001 B-vs-C isolation choice",
    "does NOT exercise Option C's WASM read-semantics (marshal-each-read / unmodified-bundle) — Worker (B) topology only",
  ],
  fails_both_ways: {
    divergent_run_reports_fault: divergentRunReportsFault,
    single_chamber_control_reports_coherent: singleControlReportsCoherent,
    broker_push_control_self_heals: brokerPushControlSelfHeals,
    jar_is_real_document_cookie: jarIsRealCookie,
  },
  // The scoreboard the rest of the probe (011-02/011-03) reuses.
  scoreboard: Object.fromEntries(Object.entries(scenarios).map(([k, r]) => [k, {
    mechanism: r.mechanism,
    chambers: r.chambers,
    jar_seed: r.jarSeed,
    jar_final: r.jarFinal,
    final_caches: r.finalCaches,
    coherent: r.coherence.coherent,
    caches_agree: r.coherence.cachesAgree,
    agree_with_jar: r.coherence.agreeWithJar,
    minted_ecids: r.mints,
    identity_verdict: r.identity.verdict,
    identity_kind: r.identity.kind,
    distinct_ecids: r.identity.distinctEcids,
    stale_read_occurred: r.staleness.staleReadOccurred,
    max_staleness_ops: r.staleness.maxStalenessOps,
    reconciled_within_run: r.staleness.reconciledWithinRun,
    jar_lives_in_real_cookie: r.jarLivesInRealCookie,
    jar_cookie_readback: r.jarCookieReadback,
  }])),
  scenarios, // full op-logs for auditability
  page_errors: pageErrors,
  verdict: pass
    ? "PASS — the concurrent async-write-back run diverged and minted a DUPLICATE identity (split-identity FAULT, lost update never reconciled in-page), while the single-chamber and broker-push controls stayed COHERENT (the broker-push control's stale read self-healed before consumption). The detector fails BOTH ways; the authoritative jar lived in the real document.cookie. No SharedArrayBuffer."
    : "FAIL — the detector did not discriminate divergence from coherence; see fails_both_ways",
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  fails_both_ways: out.fails_both_ways,
  scoreboard: out.scoreboard,
  verdict: out.verdict,
  out_file: "rig/out/coherency.json",
}, null, 2));
process.exit(pass ? 0 : 1);
