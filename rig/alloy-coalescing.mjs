// Alloy concurrent-chamber mint coalescing — spec 012-02 (all 6 ACs).
//
// Builds on 012-01's DONE rig: REUSES connectors/alloy/alloy-chamber.worker.js
// (the same chamber) for BOTH chambers, and the same minting-Edge stub shape.
// Drives TWO concurrent alloy chambers, each a dedicated CLASSIC Worker booted
// from an EMPTY cookie jar, so both read empty identity and both FIRST-MINT.
//
// The coalescing BROKER (core/coalescing-broker.js — REDIRECTED here, spec
// 014-03 DoD arch-2: the rig-only verbatim fork, rig/alloy-coalescing-broker.js,
// is retired) lives on the MAIN thread in the harness — a PARALLEL mirror of
// core/airlock.js's dispatch (ADR-0004; the real core is UNTOUCHED). It holds an
// in-flight-mint table + a completed-mint association and suppresses the second
// identity mint in both windows, so two chambers attach ONE ECID, retiring
// ADR-0008's concurrent-first-mint split-identity fault — demonstrated, not
// argued, lifting the freeze HOLD (not the freeze itself, which awaits a
// creds-gated live-Alloy re-probe).
//
// Detector BOTH ways, deterministically (AC5): the minting-Edge stub is GATE-ABLE
// (createGatedMintStub) — in ON mode the first mint is dispatched ?gate=hold so
// the stub PARKS its response; the broker releases it only once the SECOND
// chamber's mint has arrived (POST /__gate/release), so the in-flight window is
// CONSTRUCTED, not raced. coalescing OFF → two distinct ECIDs → fault; ON → one
// ECID in both jars → no fault. No SharedArrayBuffer / COOP-COEP (AD-4).
//
// Usage: node rig/alloy-coalescing.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createGatedMintStub } from "./alloy-mint-stub.js";
import { recognizeInteract } from "../connectors/alloy/xdm-mint.js";
import { classifyIdentity } from "./coherency-model.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-coalescing.json");
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-coalescing.worker.built.js");

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

// --- Build the classic-worker chamber (esbuild -> IIFE), REUSING 012-01's worker
//     verbatim for both chambers. The ESM imports are inlined; importScripts and
//     the worker globals are left untouched (classic-worker load route, AD-7). ---
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
const xdmSrc = await readFile(join(ROOT, "connectors/alloy/xdm-mint.js"), "utf8");
const harnessSrc = await readFile(join(ROOT, "rig/alloy-coalescing-harness.html"), "utf8");

// AC4: no SharedArrayBuffer CONSTRUCTED anywhere on the coalescing path (the
// worker, the broker, the XDM parse, the harness). Comments may NAME it (AD-4);
// what must be absent is an actual `new SharedArrayBuffer`.
const constructsSab = (s) => /new\s+(self\.)?SharedArrayBuffer\b/.test(s);
const noSabConstructedOnPath =
  !constructsSab(builtWorker) && !constructsSab(brokerSrc) && !constructsSab(xdmSrc) && !constructsSab(harnessSrc);

// --- The gate-able minting-Edge stub. Recreated per mode so parked/pending state
//     never leaks OFF↔ON. The server handler routes to the CURRENT stub. ---
let stub = createGatedMintStub();
const parkedTimers = new Set();

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    const query = new URLSearchParams((req.url || "").split("?")[1] || "");

    // Minting-Edge stub: POST .../ee/v1/interact -> a fresh server-assigned ECID.
    // ?gate=hold PARKS the response until the broker releases it (AC5).
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
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(response));
    }

    // The broker's gate release: the second mint has arrived in-flight (AC5).
    if (req.method === "POST" && p === "/__gate/release") {
      const released = stub.releaseFirst();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ released }));
    }

    if (p === "/") p = "/rig/alloy-coalescing-harness.html";
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

// Run one mode (coalescing off|on) in a fresh page against a fresh stub.
async function runMode(coalescing) {
  stub = createGatedMintStub(); // fresh gate per mode — no OFF↔ON leakage
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  let result = null, evalError = null;
  try {
    await page.goto(`http://localhost:${port}/rig/alloy-coalescing-harness.html?coalescing=${coalescing ? "on" : "off"}`);
    await page.waitForFunction(() => window.__ALLOY_COALESCING_RESULT__ !== undefined, { timeout: 30000 });
    result = await page.evaluate(() => window.__ALLOY_COALESCING_RESULT__);
  } catch (err) {
    evalError = err;
  } finally {
    await context.close();
  }
  return { result, evalError, pageErrors, stubCalls: stub.calls.slice() };
}

let off, on;
try {
  off = await runMode(false); // AC1 baseline: split-identity fault
  on = await runMode(true); // AC2 fix: one ECID
} finally {
  for (const t of parkedTimers) clearTimeout(t);
  await browser.close();
  server.close();
}

if (off.evalError) fail("FAIL — OFF-mode rig error: " + off.evalError.message, { pageErrors: off.pageErrors });
if (on.evalError) fail("FAIL — ON-mode rig error: " + on.evalError.message, { pageErrors: on.pageErrors });
if (!off.result) fail("FAIL — no OFF result captured", { pageErrors: off.pageErrors });
if (!on.result) fail("FAIL — no ON result captured", { pageErrors: on.pageErrors });

// ---- extract each chamber's identity (the ECID in its OWN jar) ----
function chamberEcids(r) {
  const a = r.chambers.A || {};
  const b = r.chambers.B || {};
  const ecidA = a.jarEcid || a.deliveredEcid || null;
  const ecidB = b.jarEcid || b.deliveredEcid || null;
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

// Broker egress accounting per mode — count only IDENTITY-MINT interacts (mintKey
// non-null). The AC3 non-mint probe egresses too (role passthrough, mintKey null)
// and must NOT be counted as a mint. Same for the stub's served calls: filter to
// the mint bodies, so the non-mint probe's (always-minting) stub call is excluded.
const isMintCall = (c) => recognizeInteract({ body: c.reqBody }).isMint;
const offMintEgress = (off.result.broker.egress || []).filter((e) => e.mintKey != null);
const onMintEgress = (on.result.broker.egress || []).filter((e) => e.mintKey != null);
const offStubMints = off.stubCalls.filter(isMintCall);
const onStubMints = on.stubCalls.filter(isMintCall);
const onCoalescedDecisions = (on.result.broker.decisions || []).filter(
  (d) => d.coalesced === "held-in-flight" || d.coalesced === "late-suppressed");

const assertions = {
  // --- AC1: baseline fault reproduced (coalescing OFF) ---
  off_two_chambers_both_booted_and_sent: bothChambersHealthy(off.result),
  off_two_workers_dedicated: off.result.workerCount === 2,
  off_both_chambers_have_a_jar_ecid: offE.a.jarEcid != null && offE.b.jarEcid != null,
  off_two_distinct_ecids_split_identity: offE.ecidA != null && offE.ecidB != null && offE.ecidA !== offE.ecidB,
  off_stub_minted_twice: offStubMints.length === 2,
  off_two_mint_egresses: offMintEgress.length === 2,
  off_detector_reports_fault: offVerdict.verdict === "fault" && offVerdict.kind === "split-identity",

  // --- AC2: broker-side coalescing built (coalescing ON) ---
  on_two_chambers_both_booted_and_sent: bothChambersHealthy(on.result),
  on_two_workers_dedicated: on.result.workerCount === 2,
  on_both_chambers_have_a_jar_ecid: onE.a.jarEcid != null && onE.b.jarEcid != null,
  on_one_ecid_in_both_chamber_jars: onE.ecidA != null && onE.ecidA === onE.ecidB,
  on_delivered_ecid_matches_jar_ecid_both: onE.a.deliveredEcid === onE.a.jarEcid && onE.b.deliveredEcid === onE.b.jarEcid,
  on_exactly_one_interact_egressed: onMintEgress.length === 1,
  on_stub_minted_exactly_once: onStubMints.length === 1,
  on_second_mint_was_coalesced: onCoalescedDecisions.length >= 1,
  on_no_inflight_leak_at_end: on.result.broker.inFlightCount === 0,
  on_detector_reports_no_fault: onVerdict.verdict !== "fault",

  // --- AC3: XDM mint-recognition — non-mint is NOT coalesced (in-browser witness) ---
  on_non_mint_recognized_as_non_mint: on.result.nonMintRecognized === true,
  on_non_mint_passed_through_not_coalesced: on.result.nonMintCoalesced === "passthrough",

  // --- AC4: no SAB / async-only; two independent dedicated Workers ---
  no_shared_array_buffer_constructed_on_path: noSabConstructedOnPath,
  runtime_context_has_no_shared_array_buffer: on.result.noSharedArrayBuffer === "absent-in-context",

  // --- AC5: detector fails BOTH ways, deterministically ---
  detector_off_fault_on_clean_both_ways: offVerdict.verdict === "fault" && onVerdict.verdict !== "fault",
};

const pass = Object.values(assertions).every(Boolean);

// AC6: mechanism built + demonstrated → freeze HOLD lifted (NOT the freeze). Check
// ADR-0008's kill-criteria against the STUB XDM and record the live-Alloy residual.
const killCriteria = {
  stub_xdm_mint_recognizable:
    recognizeInteract({ url: "https://x/ee/v1/interact?configId=" + "00000000-0000-0000-0000-000000000000",
      body: JSON.stringify({ events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }], query: { identity: { fetch: ["ECID", "CORE"] } } }) }).isMint === true,
  non_mint_not_misrecognized:
    recognizeInteract({ url: "https://x/ee/v1/interact", body: JSON.stringify({ events: [{ xdm: { eventType: "commerce.purchases" } }] }) }).isMint === false,
  live_alloy_residual:
    "CARRIED FORWARD (creds-gated): the live-Alloy interact XDM shape is NOT re-verified here. Mint-recognition is demonstrated against the STUB XDM (grounded in 012-01's captured shape). ADR-0008's kill-criterion — re-probe real Alloy before the step-5 contract freeze — remains OPEN. This slice lifts the freeze HOLD (mechanism built+demonstrated); it does NOT authorize the freeze.",
};

const out = {
  question:
    "Do TWO concurrent alloy chambers, both booted from an EMPTY cookie jar and both first-minting identity, attach ONE ECID (not two) once the main-thread broker coalesces the second concurrent mint — retiring ADR-0008's concurrent-first-mint split-identity fault, demonstrated against a gate-able minting-Edge stub, with no SharedArrayBuffer?",
  pass,
  scope:
    "AC1-AC6. Two REUSED 012-01 alloy chambers (dedicated classic Workers) + a main-thread coalescing broker (in-flight-mint table + completed-mint association, parallel to core/airlock.js). Detector both ways via a gate-able stub: coalescing OFF → two distinct ECIDs → split-identity fault; ON → one ECID in both jars → no fault. Lifts ADR-0008's freeze HOLD (mechanism built+demonstrated); does NOT authorize the freeze (live-Alloy re-probe carried forward).",
  mechanism: "broker-side async request coalescing (in-flight-mint table + completed-mint association); XDM mint-recognition; gate-able minting-Edge stub for deterministic in-flight construction. No SAB, no COOP/COEP (AD-4).",
  off_mode: {
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
  on_mode: {
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
  no_shared_array_buffer: {
    constructed_on_path: !noSabConstructedOnPath ? "PRESENT (fault)" : "none",
    runtime_context: on.result.noSharedArrayBuffer,
    note: "AD-4: the coalescing is the broker's single-threaded serialization + an async hold. SharedArrayBuffer is neither constructed nor required, and (no COOP/COEP) not even exposed in-context.",
  },
  ac6_freeze_hold: {
    mechanism_built_and_demonstrated: pass,
    freeze_hold_lifted: pass, // the HOLD on the wrapped-SDK identity path — NOT the freeze
    contract_freeze_authorized: false, // still gated on the live-Alloy re-probe
    kill_criteria_against_stub_xdm: killCriteria,
    note: "AC6: ADR-0008's coalescing mechanism is now BUILT + DEMONSTRATED against the stub, lifting the freeze HOLD on the wrapped-SDK identity path. It does NOT authorize the step-5 contract freeze, which still awaits the creds-gated live-Alloy mint-recognition re-probe. docs/refinement-todo.md OQ9 update is owned by the spec ceremony (not edited by this rig).",
  },
  assertions,
  verdict: pass
    ? "PASS — two concurrent alloy chambers, both booted EMPTY and both first-minting, are coalesced by the main-thread broker to ONE ECID in BOTH jars (exactly one interact egressed; the second mint was held in-flight / late-suppressed), while coalescing OFF reproduces the split-identity fault (two chambers, two distinct ECIDs, two egresses). Deterministic both ways via the gate-able stub. A non-mint interact is NOT coalesced (passes through). No SharedArrayBuffer constructed or exposed (AD-4). ADR-0008's freeze HOLD is lifted (mechanism built+demonstrated); the contract freeze still awaits the creds-gated live-Alloy re-probe."
    : "FAIL — see assertions",
};

await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  assertions: out.assertions,
  off: { ecidA: offE.ecidA, ecidB: offE.ecidB, distinct: out.off_mode.distinct_ecids, stub_mints: offStubMints.length, egresses: offMintEgress.length, detector: offVerdict.verdict },
  on: { ecidA: onE.ecidA, ecidB: onE.ecidB, distinct: out.on_mode.distinct_ecids, stub_mints: onStubMints.length, egresses: onMintEgress.length, coalesced: onCoalescedDecisions.map((d) => d.coalesced), non_mint: on.result.nonMintCoalesced, detector: onVerdict.verdict },
  no_shared_array_buffer: out.no_shared_array_buffer,
  ac6_freeze_hold_lifted: out.ac6_freeze_hold.freeze_hold_lifted,
  verdict: out.verdict,
  out_file: "rig/out/alloy-coalescing.json",
}, null, 2));
process.exit(pass ? 0 : 1);
