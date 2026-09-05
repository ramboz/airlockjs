// Alloy Target personalization — decisions-as-data + CWV-safe host-apply — spec 012-03.
//
// Builds on 012-01's DONE alloy chamber + rig: REUSES connectors/alloy/alloy-chamber.worker.js
// (the same classic-worker chamber) and the minting-Edge stub, EXTENDED so the interact
// response also carries a Target proposition for the __view__ scope (mintDecisionsResponse).
// alloy runs headless (renderDecisions:false, R-004): it fetches the decision from the (stub)
// Edge and returns it as DATA (propositions) across the chamber boundary; the HOST applies it
// through the mediated, CWV-safe reserveSpace capability (adapters/eds/dom.js), with prehiding
// kept main-thread (out of the chamber, mvp2.md).
//
// The verdict GATES on a deterministic BY-CONSTRUCTION structural invariant, MIRRORING
// rig/uc1.mjs (per R-005, quantitative headless CLS/paint numbers are unreliable — geometry
// via getBoundingClientRect IS deterministic; paint timestamps are not). Three legs (AC3):
//   (a) the personalization is applied via the mediated reserveSpace helper, never a raw write
//       (the capability stamps data-airlock-reserved/-filled; a raw inject stamps neither);
//   (b) the reserved box geometry AND surrounding-content position is UNCHANGED reserve→fill
//       (getBoundingClientRect equal — the decision fills the pre-reserved box, no reflow);
//   (c) the box is reserved BEFORE body:appear (uc1's applied-before-paint leg) — a POST-paint
//       control reserve is caught as reserved-AFTER-appear (the gate is not vacuous).
// Plus AC1 (propositions returned), AC2 (worker no DOM; decisions cross as data), AC4 (no
// prehiding in the worker; prehide observed main-thread), AC5 (exposure via generic capture).
//
// Advisory ONLY (NOT the gate, OQ6): a raw-un-reserved-inject control's sentinel shift (a
// reflow/CLS) — honest that a headless raw inject may not itself score a measurable CLS.
//
// Usage: node rig/alloy-decisions.mjs   (exits non-zero if any GATED assertion fails)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { mintDecisionsResponse } from "./alloy-mint-stub.js";
import { rectsEqual } from "../adapters/eds/dom.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-decisions.json");
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-decisions.worker.built.js");
const DECISION_HTML = '<div class="airlock-hero" style="height:200px">Personalized above the fold</div>';

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
//     verbatim. The ESM imports (incl. the new connectors/alloy/decisions.js) are
//     inlined; importScripts + worker globals left untouched (classic load route). ---
await build({ entryPoints: [WORKER_SRC], outfile: WORKER_BUILT, bundle: true, format: "iife", platform: "browser", target: "es2022" });
const builtWorker = await readFile(WORKER_BUILT, "utf8");

// AC2/AC4 structural: the host-apply + prehide capability is HOST-side only — the
// built worker must carry NONE of its DOM-apply tokens (the chamber touches no DOM
// for decisions; prehiding is main-thread, out of the chamber).
const domApplyTokens = ["reserveSpace(", "getBoundingClientRect", "data-airlock-"];
const workerHasNoDomApply = !domApplyTokens.some((t) => builtWorker.includes(t));

const interactStubCalls = [];
const exposureBeacons = [];

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    // Decisions-Edge stub: identity mint (012-01) + a __view__ Target decision (012-03).
    if (req.method === "POST" && p === "/ee/v1/interact") {
      const chunks = []; for await (const c of req) chunks.push(c);
      const reqBody = Buffer.concat(chunks).toString("utf8");
      const { response, ecid, proposition } = mintDecisionsResponse({ html: DECISION_HTML });
      interactStubCalls.push({ ecid, proposition, reqBody });
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(response));
    }
    // Exposure beacon capture (the generic push→ring→beacon path's destination, AC5).
    if (req.method === "POST" && p === "/airlock-exposure") {
      const chunks = []; for await (const c of req) chunks.push(c);
      let evt = {}; try { evt = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) {}
      exposureBeacons.push(evt);
      res.writeHead(204); return res.end();
    }
    if (p === "/") p = "/rig/alloy-decisions-harness.html";
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
  await page.goto(`http://localhost:${port}/rig/alloy-decisions-harness.html`);
  await page.waitForFunction(() => window.__ALLOY_DECISIONS_RESULT__ !== undefined, { timeout: 30000 });
  result = await page.evaluate(() => window.__ALLOY_DECISIONS_RESULT__);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { pageErrors });
if (!result) fail("FAIL — no result captured from the harness", { pageErrors });
if (result.fatal) fail("FAIL — harness fatal: " + result.fatal, { result, pageErrors, interactStubCalls: interactStubCalls.length });

const mt = result.markTimes || {};

// --- AC1: headless decisions fetched — propositions came back for __view__. ---
const decisions = Array.isArray(result.decisions) ? result.decisions : [];
const ac1_decisions_returned_for_view_scope =
  decisions.length >= 1 && decisions[0].scope === "__view__" && typeof result.decision_html === "string" && result.decision_html.length > 0;

// --- AC2: decisions crossed the boundary as DATA; the worker performed no DOM apply. ---
const decisionsAreData = decisions.every((d) => d && typeof d === "object" && typeof d.scope === "string" && d.content && typeof d.content === "object");
const ac2_decisions_crossed_as_data = decisions.length >= 1 && decisionsAreData;
const ac2_worker_touched_no_dom = workerHasNoDomApply;
const ac2_worker_did_no_real_fetch = result.workerNoRealFetch === 0;

// --- AC3 leg (a): applied via the mediated helper, never a raw write. ---
const ac3a_applied_via_capability =
  !!result.heroReservedAttr && result.heroFilledAttr === "1" && result.heroInnerHtml === result.decision_html;
// falsifiability: the raw un-reserved inject did NOT go through the capability (no markers).
const ac3a_raw_inject_bypasses_markers = result.rawHeroReservedAttr == null && result.rawHeroFilledAttr == null;
const ac3a = ac3a_applied_via_capability && ac3a_raw_inject_bypasses_markers;

// --- AC3 leg (b): reserved box + surrounding-content geometry UNCHANGED reserve→fill. ---
const rr = result.reserveRects || {}, fr = result.fillRects || {};
const ac3b_hero_geometry_unchanged = rectsEqual(rr.hero, fr.hero);
const ac3b_surrounding_unchanged = rectsEqual(rr.below, fr.below);
const ac3b = ac3b_hero_geometry_unchanged && ac3b_surrounding_unchanged;

// --- AC3 leg (c): reserved BEFORE body:appear; the POST-paint control is caught. ---
const ac3c_reserved_before_appear = mt.reserveHero != null && mt.bodyAppear != null && mt.reserveHero < mt.bodyAppear;
const ac3c_control_reserved_after_appear = mt.reserveControl != null && mt.bodyAppear != null && mt.reserveControl > mt.bodyAppear;
const ac3c = ac3c_reserved_before_appear && ac3c_control_reserved_after_appear; // gate discriminates

// --- AC4: prehiding is main-thread (observed) and NONE runs in the worker. ---
const ac4_prehide_observed_main_thread = result.reserveVisibility === "hidden" && result.fillVisibility === "visible";
const ac4_no_prehiding_in_worker = workerHasNoDomApply;

// --- AC5: exposure emitted via the generic capture path (proposition→exposure map). ---
const exposureBeacon = exposureBeacons.find((b) => b && b.event === "proposition_display") || null;
const ac5_exposure_beacon_via_generic_capture =
  !!exposureBeacon && exposureBeacon.scope === "__view__" && typeof exposureBeacon.proposition_id === "string" && exposureBeacon.proposition_id.length > 0;
const ac5_exposure_drained_through_ring = Array.isArray(result.exposureBeaconsSent)
  && result.exposureBeaconsSent.some((e) => e && e.event === "proposition_display");

// --- 033-03 AC2/AC4: the REAL two-phase eager entrypoint + no-loop exposure routing. ---
// The eager reserve went through the production reservePersonalization (not an inline
// reserveSpace), and the proposition_display exposure fanned to the GA4 ["*"] sink while
// alloy's ["page_view"] handle IGNORED it (no second interact / proposition loop).
const ac033_two_phase_via_reserve_personalization = result.twoPhaseViaReservePersonalization === true && ac3c_reserved_before_appear;
const ac033_exposure_routed_to_ga4_not_alloy = result.exposureRoutedToAlloyCount === 0 && ac5_exposure_beacon_via_generic_capture;

// --- Advisory (NOT the gate, OQ6): the raw un-reserved inject's sentinel shift. ---
const rawShiftPx = result.rawInjectSentinelShiftPx;

const assertions = {
  // AC1
  ac1_decisions_returned_for_view_scope,
  // AC2
  ac2_decisions_crossed_as_data,
  ac2_worker_touched_no_dom,
  ac2_worker_did_no_real_fetch,
  // AC3 — the GATED structural invariant (mirrors uc1)
  ac3a_applied_via_mediated_reserveSpace_never_raw: ac3a,
  ac3b_geometry_and_surrounding_unchanged_no_reflow: ac3b,
  ac3c_reserved_before_body_appear_control_caught: ac3c,
  // AC4
  ac4_prehide_observed_main_thread,
  ac4_no_prehiding_in_worker,
  // AC5
  ac5_exposure_beacon_via_generic_capture,
  ac5_exposure_drained_through_ring,
  // 033-03 — the two-phase promotion + no-loop exposure routing
  ac033_two_phase_via_reserve_personalization,
  ac033_exposure_routed_to_ga4_not_alloy,
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Does stock alloy, run HEADLESS (renderDecisions:false) in the 012-01 chamber, return a Target __view__ decision as DATA across the boundary — which the HOST applies through the mediated CWV-safe reserveSpace capability (reserved BEFORE paint, content fills the pre-reserved box with no reflow, prehiding main-thread), reporting the exposure through the generic capture path?",
  pass,
  scope:
    "AC1-AC5. Reuses the 012-01 classic-worker chamber + minting-Edge stub, extended with a __view__ personalization:decisions handle. Gate = the deterministic by-construction structural invariant (uc1/R-005 analog): applied-via-capability (a) + geometry-unchanged (b) + reserved-before-appear-with-control-caught (c), plus decisions-as-data / worker-no-DOM (AC2), prehide-main-thread (AC4), exposure-via-generic-capture (AC5). Quantitative CLS is advisory only.",
  gate: "AC3 legs a+b+c hold (structural, by-construction) AND AC1/AC2/AC4/AC5; the raw-inject CLS shift is advisory/corroborating only (headless raw inject may not score a measurable CLS).",
  structural_invariant: {
    reserve_before_appear: ac3c_reserved_before_appear,
    control_post_paint_reserve_caught: ac3c_control_reserved_after_appear,
    mark_times: mt,
    marks: result.marks,
    geometry: { reserveRects: rr, fillRects: fr, hero_unchanged: ac3b_hero_geometry_unchanged, surrounding_unchanged: ac3b_surrounding_unchanged },
    prehide: { reserveVisibility: result.reserveVisibility, fillVisibility: result.fillVisibility },
  },
  decisions_as_data: {
    count: decisions.length,
    scope: decisions[0] && decisions[0].scope,
    decision_html: result.decision_html,
    applied_into_reserved_box: result.heroInnerHtml === result.decision_html,
    hero_markers: { reserved: result.heroReservedAttr, filled: result.heroFilledAttr },
    raw_inject_markers: { reserved: result.rawHeroReservedAttr, filled: result.rawHeroFilledAttr },
    worker_has_no_dom_apply_tokens: workerHasNoDomApply,
  },
  exposure: { beacon: exposureBeacon, beacons_captured: exposureBeacons, drained_through_ring: ac5_exposure_drained_through_ring },
  advisory_cls: {
    raw_unreserved_inject_sentinel_shift_px: rawShiftPx,
    note: "Advisory / corroborating ONLY (OQ6), NOT the gate. The reserved box causes no sentinel shift (leg b); a raw UN-reserved inject shifts its sentinel by ~content height (a reflow/CLS). Honest caveat: a headless raw inject may not itself score a measurable Lighthouse CLS — which is exactly why the gate is the structural invariant, not a CLS number.",
  },
  minting_edge_stub: { interact_calls: interactStubCalls.length, minted_ecid: interactStubCalls[0] && interactStubCalls[0].ecid, proposition_scope: interactStubCalls[0] && interactStubCalls[0].proposition && interactStubCalls[0].proposition.scope },
  assertions,
  page_errors: pageErrors,
  verdict: pass
    ? "PASS — alloy returned a __view__ Target decision as DATA (the worker touched no DOM, no real worker fetch); the host applied it ONLY through the mediated reserveSpace capability, reserving the box BEFORE body:appear (a post-paint control reserve was caught as after-appear), the reserved box + surrounding content geometry UNCHANGED reserve→fill (no reflow), prehiding observed main-thread; and the exposure was reported as a proposition_display through the generic push→ring→beacon capture. Advisory: a raw un-reserved inject shifts its sentinel (reflow), corroborating the reserve's no-reflow — not the gate."
    : "FAIL — see assertions",
};

await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  assertions: out.assertions,
  structural_invariant: {
    reserve_before_appear: ac3c_reserved_before_appear,
    control_post_paint_reserve_caught: ac3c_control_reserved_after_appear,
    geometry_unchanged: ac3b,
  },
  decisions_count: decisions.length,
  decision_scope: decisions[0] && decisions[0].scope,
  exposure_event: exposureBeacon && exposureBeacon.event,
  advisory_raw_inject_shift_px: rawShiftPx,
  verdict: out.verdict,
  out_file: "rig/out/alloy-decisions.json",
}, null, 2));
process.exit(pass ? 0 : 1);
