// Alloy concurrent-chamber mint coalescing, THROUGH CORE — spec 014-02 (ACs 1-5).
//
// Carries 012-02's rig (rig/alloy-coalescing.mjs) into core/: instead of the
// rig-inline main-thread broker mirror, EACH of the two chambers is hosted by
// core/wrapped-sdk-host.js (spec 014-01, unchanged) and BOTH share ONE
// core/coalescing-broker.js instance (this slice, ported from
// rig/alloy-coalescing-broker.js) — the single coalescing point sitting ABOVE
// each chamber's own 014-01 per-chamber round-trip dispatch. Every chamber's
// `caps.egress.dispatch` is wired to `(req) => broker.handleInterceptedFetch(req)`.
// core/airlock.js and core/chamber.worker.js are UNTOUCHED (verify via `git diff`
// outside this rig). connectors/alloy/alloy-chamber.worker.js is REUSED verbatim
// for both chambers, byte-identical to 012-01/012-02 — this slice does not
// modify it.
//
// Three scenarios, driven by the harness's ?scenario= query param, each in a
// FRESH browser context against a FRESH gate-able stub (no cross-scenario state
// leakage):
//   off    — AC3's baseline: coalescing off reproduces the split-identity fault
//            (two chambers, two distinct ECIDs, two mint egresses).
//   on     — AC1's fix: two concurrent core-hosted chambers, both booted from an
//            EMPTY jar and both first-minting, are coalesced by core's broker to
//            ONE ECID in both jars; exactly one identity-mint interact egresses.
//            Also runs AC4's non-mint-passthrough corroboration through the SAME
//            shared broker.
//   reject — AC2's reject-path, the load-bearing carry (012-02's craft fix): a
//            forced first-mint dispatch FAILURE must REJECT the held awaiter
//            within a bounded timeout (not hang), self-healing (`completed` left
//            unpopulated). Driven via two concurrent calls directly through a
//            DEDICATED core/coalescing-broker.js instance — the "held awaiter"
//            IS the caller of handleInterceptedFetch, and a real chamber's
//            intercepted-fetch dispatch is exactly such a call (wired 1:1 via
//            caps.egress.dispatch in the "on"/"off" scenarios above) — so this
//            exercises the identical broker code path a real held chamber would,
//            deterministically, decoupled from alloy-SDK-internal error handling.
//
// AC5 (async-only, no SAB): a static source scan (no `new SharedArrayBuffer` on
// the built worker, core/coalescing-broker.js, core/wrapped-sdk-host.js,
// rig/alloy-xdm-mint.js, or this harness) plus a runtime in-context check.
//
// Usage: node rig/alloy-coalescing-core.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createGatedMintStub } from "./alloy-mint-stub.js";
import { recognizeInteract } from "../connectors/alloy/xdm-mint.js";
import { parseAmcv, classifyIdentity } from "./coherency-model.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-coalescing-core.json");
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-coalescing-core.worker.built.js");
const HARNESS_PATH = "/rig/alloy-coalescing-core-harness.html";

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

// --- Build the classic-worker chamber (esbuild -> IIFE), REUSING 012-01/012-02's
//     worker verbatim for both chambers, into a rig-014-02-dedicated output path
//     so concurrently-run rigs never race on a shared build artifact. ---
await build({
  entryPoints: [WORKER_SRC],
  outfile: WORKER_BUILT,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
});
const builtWorker = await readFile(WORKER_BUILT, "utf8");
const brokerSrc = await readFile(join(ROOT, "core/coalescing-broker.js"), "utf8");
const hostSrc = await readFile(join(ROOT, "core/wrapped-sdk-host.js"), "utf8");
const xdmSrc = await readFile(join(ROOT, "connectors/alloy/xdm-mint.js"), "utf8");
const harnessSrc = await readFile(join(ROOT, "rig" + HARNESS_PATH.replace(/^\/rig/, "")), "utf8");

// AC5: no SharedArrayBuffer CONSTRUCTED anywhere on the coalescing path (the
// worker, core's broker, core's host, the XDM parse, the harness). Comments may
// NAME it (AD-4); what must be absent is an actual `new SharedArrayBuffer`.
const constructsSab = (s) => /new\s+(self\.)?SharedArrayBuffer\b/.test(s);
const noSabConstructedOnPath =
  !constructsSab(builtWorker) && !constructsSab(brokerSrc) && !constructsSab(hostSrc) &&
  !constructsSab(xdmSrc) && !constructsSab(harnessSrc);

// --- The gate-able minting-Edge stub. Recreated per scenario so parked/pending
//     state never leaks across runs. `forceFailNextHeldRelease` is the reject
//     scenario's server-side toggle: consumed (reset) the moment it fires, so it
//     affects ONLY the one held-then-released mint it was armed for. ---
let stub = createGatedMintStub();
let forceFailNextHeldRelease = false;
const parkedTimers = new Set();

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    const query = new URLSearchParams((req.url || "").split("?")[1] || "");

    // Minting-Edge stub: POST .../ee/v1/interact -> a fresh server-assigned ECID.
    // ?gate=hold PARKS the response until the broker releases it (AC1 in-flight
    // window construction). If armed, the released response is overridden with a
    // 500 instead of the normal mint (AC2's forced first-mint dispatch failure).
    if (req.method === "POST" && p === "/ee/v1/interact") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const reqBody = Buffer.concat(chunks).toString("utf8");
      const hold = query.get("gate") === "hold";
      // Anti-hang backstop: a parked response self-releases after 8s (records it).
      let timer = null;
      if (hold) {
        timer = setTimeout(() => { stub.releaseFirst(); }, 8000);
        parkedTimers.add(timer);
      }
      const { response } = await stub.handle({ reqBody, hold });
      if (timer) { clearTimeout(timer); parkedTimers.delete(timer); }
      if (hold && forceFailNextHeldRelease) {
        forceFailNextHeldRelease = false; // consume — only THIS held mint fails
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: "forced-first-mint-failure (spec 014-02 AC2 reject-path corroboration)" }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(response));
    }

    // The broker's gate release: the second mint has arrived in-flight (AC1/AC2).
    if (req.method === "POST" && p === "/__gate/release") {
      const released = stub.releaseFirst();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ released }));
    }

    // AC2 reject-path arming: fail the NEXT held-then-released mint.
    if (req.method === "POST" && p === "/__reject/arm") {
      forceFailNextHeldRelease = true;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ armed: true }));
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

// Run one scenario ("off" | "on" | "reject") in a fresh page against a fresh stub.
async function runScenario(scenario) {
  stub = createGatedMintStub(); // fresh gate per scenario — no cross-run leakage
  forceFailNextHeldRelease = false;
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  let result = null, evalError = null;
  try {
    await page.goto(`http://localhost:${port}${HARNESS_PATH}?scenario=${scenario}`);
    await page.waitForFunction(() => window.__ALLOY_COALESCING_CORE_RESULT__ !== undefined, { timeout: 30000 });
    result = await page.evaluate(() => window.__ALLOY_COALESCING_CORE_RESULT__);
  } catch (err) {
    evalError = err;
  } finally {
    await context.close();
  }
  return { result, evalError, pageErrors, stubCalls: stub.calls.slice() };
}

let off, on, reject;
try {
  off = await runScenario("off");       // AC3 baseline: split-identity fault
  on = await runScenario("on");         // AC1 fix + AC4 non-mint corroboration
  reject = await runScenario("reject"); // AC2 reject-path
} finally {
  for (const t of parkedTimers) clearTimeout(t);
  await browser.close();
  server.close();
}

if (off.evalError) fail("FAIL — OFF-scenario rig error: " + off.evalError.message, { pageErrors: off.pageErrors });
if (on.evalError) fail("FAIL — ON-scenario rig error: " + on.evalError.message, { pageErrors: on.pageErrors });
if (reject.evalError) fail("FAIL — REJECT-scenario rig error: " + reject.evalError.message, { pageErrors: reject.pageErrors });
if (!off.result) fail("FAIL — no OFF result captured", { pageErrors: off.pageErrors });
if (!on.result) fail("FAIL — no ON result captured", { pageErrors: on.pageErrors });
if (!reject.result) fail("FAIL — no REJECT result captured (a regressed reject-path would hang here, bounded by the 30s page timeout)", { pageErrors: reject.pageErrors });

// ---- extract each chamber's identity (the ECID in its OWN jar) ----
function chamberEcids(r) {
  const a = r.chambers.A || {};
  const b = r.chambers.B || {};
  const ecidA = a.jarEcid || null;
  const ecidB = b.jarEcid || null;
  return { ecidA, ecidB, a, b };
}
function bothChambersHealthy(r) {
  return ["A", "B"].every((l) => {
    const c = r.chambers[l] || {};
    return c.booted === true && c.configureSettled === "fulfilled" && c.sendEventSettled === "fulfilled" && !c.error;
  });
}

const offE = chamberEcids(off.result);
const onE = chamberEcids(on.result);

// Detector via 011's shared identity model (the measurement reference): the number
// of DISTINCT identities asserted for one visitor. >1 => split-identity fault.
const offVerdict = classifyIdentity({ identities: [offE.ecidA, offE.ecidB] });
const onVerdict = classifyIdentity({ identities: [onE.ecidA, onE.ecidB] });

// Broker egress accounting per scenario — count only IDENTITY-MINT interacts
// (mintKey non-null). The AC4 non-mint probe egresses too (role passthrough,
// mintKey null) and must NOT be counted as a mint.
const offMintEgress = (off.result.broker.egress || []).filter((e) => e.mintKey != null);
const onMintEgress = (on.result.broker.egress || []).filter((e) => e.mintKey != null);
const isMintCall = (c) => recognizeInteract({ body: c.reqBody }).isMint;
const offStubMints = off.stubCalls.filter(isMintCall);
const onStubMints = on.stubCalls.filter(isMintCall);
const onCoalescedDecisions = (on.result.broker.decisions || []).filter(
  (d) => d.coalesced === "held-in-flight" || d.coalesced === "late-suppressed");

// ---- AC2 reject-path scenario accounting ----
const rejectR = reject.result || {};
const rA = rejectR.rA || {};
const rB = rejectR.rB || {};
const rejectBothRejected = rA.settled === "rejected" && rB.settled === "rejected";
const rejectSameError = rejectBothRejected && rA.message === rB.message;
const rejectStubMints = reject.stubCalls.filter(isMintCall);

const assertions = {
  // --- AC3: baseline fault reproduced (coalescing OFF) ---
  off_two_chambers_both_booted_and_sent: bothChambersHealthy(off.result),
  off_two_workers_dedicated: off.result.workerCount === 2,
  off_both_chambers_have_a_jar_ecid: offE.a.jarEcid != null && offE.b.jarEcid != null,
  off_two_distinct_ecids_split_identity: offE.ecidA != null && offE.ecidB != null && offE.ecidA !== offE.ecidB,
  off_stub_minted_twice: offStubMints.length === 2,
  off_two_mint_egresses: offMintEgress.length === 2,
  off_detector_reports_fault: offVerdict.verdict === "fault" && offVerdict.kind === "split-identity",

  // --- AC1: coalesced through CORE's broker (coalescing ON) ---
  on_two_chambers_both_booted_and_sent: bothChambersHealthy(on.result),
  on_two_workers_dedicated: on.result.workerCount === 2,
  on_both_chambers_have_a_jar_ecid: onE.a.jarEcid != null && onE.b.jarEcid != null,
  on_one_ecid_in_both_chamber_jars: onE.ecidA != null && onE.ecidA === onE.ecidB,
  on_exactly_one_interact_egressed: onMintEgress.length === 1,
  on_stub_minted_exactly_once: onStubMints.length === 1,
  on_second_mint_was_coalesced: onCoalescedDecisions.length >= 1,
  on_no_inflight_leak_at_end: on.result.broker.inFlightCount === 0,
  on_detector_reports_no_fault: onVerdict.verdict !== "fault",

  // --- AC4: XDM mint-recognition in core — non-mint is NOT coalesced ---
  on_non_mint_recognized_as_non_mint: on.result.nonMintRecognized === true,
  on_non_mint_passed_through_not_coalesced: on.result.nonMintCoalesced === "passthrough",

  // --- AC2: reject-path preserved in core (the load-bearing carry) ---
  reject_held_signal_fired_exactly_once: rejectR.heldSignals === 1,
  reject_first_mint_caller_rejected: rA.settled === "rejected",
  reject_held_awaiter_rejected_not_timed_out: rB.settled === "rejected",
  reject_both_rejections_are_the_same_error: rejectSameError,
  reject_no_inflight_leak_after_failure: rejectR.inFlightCountAfter === 0,
  reject_completed_not_poisoned_by_failure: rejectR.completedCountAfter === 0,
  reject_no_phantom_egress_recorded_for_failure: rejectR.egressCountAfter === 0,
  reject_stub_received_exactly_the_one_failed_attempt: rejectStubMints.length === 1,

  // --- AC5: no SAB / async-only ---
  no_shared_array_buffer_constructed_on_path: noSabConstructedOnPath,
  runtime_context_has_no_shared_array_buffer: on.result.noSharedArrayBuffer === "absent-in-context",
  reject_runtime_context_has_no_shared_array_buffer: rejectR.noSharedArrayBuffer === "absent-in-context",

  // --- detector fails BOTH ways, deterministically ---
  detector_off_fault_on_clean_both_ways: offVerdict.verdict === "fault" && onVerdict.verdict !== "fault",
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Do TWO concurrent core-hosted alloy chambers (core/wrapped-sdk-host.js, spec 014-01), both booted from an EMPTY cookie jar and both first-minting identity, attach ONE ECID (not two) once core/coalescing-broker.js (spec 014-02) — the ONE broker shared across both chambers' caps.egress.dispatch — coalesces the second concurrent mint, with the 012-02 reject-path (a first-mint dispatch failure settles the held awaiter, bounded, self-healing) preserved exactly in core, and no SharedArrayBuffer anywhere on the path?",
  pass,
  scope:
    "spec 014-02 AC1-AC5. Two REUSED 012-01/012-02 alloy chambers (dedicated classic Workers), each hosted by core/wrapped-sdk-host.js (014-01, unchanged), sharing ONE core/coalescing-broker.js instance (this slice, ported from rig/alloy-coalescing-broker.js). Detector both ways via a gate-able stub: coalescing OFF -> two distinct ECIDs -> split-identity fault; ON -> one ECID in both jars -> no fault. The reject-path (AC2) is exercised directly through a DEDICATED core/coalescing-broker.js instance (the held-awaiter code path a real chamber's intercepted-fetch dispatch would hit 1:1), decoupled from alloy-SDK-internal error handling. core/airlock.js + core/chamber.worker.js untouched.",
  mechanism:
    "core/coalescing-broker.js: in-flight-mint table + completed-mint association + the reject-path (first-mint dispatch failure rejects every held awaiter with the same error, leaves `completed` unpopulated for self-heal); XDM mint-recognition (rig/alloy-xdm-mint.js, reused verbatim); gate-able minting-Edge stub for deterministic in-flight construction. No SAB, no COOP/COEP (AD-4).",
  off_scenario: {
    coalescing: false,
    ecidA: offE.ecidA, ecidB: offE.ecidB,
    distinct_ecids: [...new Set([offE.ecidA, offE.ecidB].filter(Boolean))].length,
    stub_mints: offStubMints.length,
    stub_calls_total: off.stubCalls.length,
    mint_egresses: offMintEgress.length,
    detector: offVerdict,
    chambers: off.result.chambers,
    broker: off.result.broker,
    page_errors: off.pageErrors,
  },
  on_scenario: {
    coalescing: true,
    ecidA: onE.ecidA, ecidB: onE.ecidB,
    distinct_ecids: [...new Set([onE.ecidA, onE.ecidB].filter(Boolean))].length,
    stub_mints: onStubMints.length,
    stub_calls_total: on.stubCalls.length,
    mint_egresses: onMintEgress.length,
    coalesced_decisions: onCoalescedDecisions,
    non_mint_probe: { recognized_non_mint: on.result.nonMintRecognized, coalesced: on.result.nonMintCoalesced },
    detector: onVerdict,
    chambers: on.result.chambers,
    broker: on.result.broker,
    page_errors: on.pageErrors,
  },
  reject_scenario: {
    held_signals: rejectR.heldSignals,
    first_mint_caller: rA,
    held_awaiter: rB,
    same_error: rejectSameError,
    in_flight_count_after: rejectR.inFlightCountAfter,
    completed_count_after: rejectR.completedCountAfter,
    egress_count_after: rejectR.egressCountAfter,
    stub_mint_attempts: rejectStubMints.length,
    page_errors: reject.pageErrors,
    note:
      "The forced first-mint dispatch failure REJECTS both the first-mint caller and the held awaiter with the SAME error, bounded (settled, not TIMED_OUT); inFlightCount/egressCount return to 0 and completedCount stays 0 (self-heal: `completed` is never poisoned by a failure) — the 012-02 craft fix, preserved exactly in core.",
  },
  no_shared_array_buffer: {
    constructed_on_path: !noSabConstructedOnPath ? "PRESENT (fault)" : "none",
    runtime_context: on.result.noSharedArrayBuffer,
    note: "AD-4: the coalescing is the broker's single-threaded serialization + an async hold. SharedArrayBuffer is neither constructed nor required, and (no COOP/COEP) not even exposed in-context.",
  },
  assertions,
  verdict: pass
    ? "PASS — two concurrent core-hosted alloy chambers, both booted EMPTY and both first-minting, are coalesced by core/coalescing-broker.js to ONE ECID in BOTH jars (exactly one interact egressed; the second mint was held in-flight), while coalescing OFF reproduces the split-identity fault (two chambers, two distinct ECIDs, two egresses). A non-mint interact is NOT coalesced (passes through). The reject-path is preserved EXACTLY in core: a forced first-mint dispatch failure rejects the held awaiter within a bounded timeout (not a hang), self-healing (`completed` left unpopulated). No SharedArrayBuffer constructed or exposed (AD-4). core/airlock.js + core/chamber.worker.js untouched."
    : "FAIL — see assertions",
};

await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  assertions: out.assertions,
  off: { ecidA: offE.ecidA, ecidB: offE.ecidB, distinct: out.off_scenario.distinct_ecids, stub_mints: offStubMints.length, egresses: offMintEgress.length, detector: offVerdict.verdict },
  on: { ecidA: onE.ecidA, ecidB: onE.ecidB, distinct: out.on_scenario.distinct_ecids, stub_mints: onStubMints.length, egresses: onMintEgress.length, coalesced: onCoalescedDecisions.map((d) => d.coalesced), non_mint: on.result.nonMintCoalesced, detector: onVerdict.verdict },
  reject: { held_signals: rejectR.heldSignals, first_mint_caller_settled: rA.settled, held_awaiter_settled: rB.settled, same_error: rejectSameError, in_flight_after: rejectR.inFlightCountAfter, completed_after: rejectR.completedCountAfter },
  no_shared_array_buffer: out.no_shared_array_buffer,
  verdict: out.verdict,
  out_file: "rig/out/alloy-coalescing-core.json",
}, null, 2));
process.exit(pass ? 0 : 1);
