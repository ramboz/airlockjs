// CWV scoreboard — spec 029-01. Tests the PURE model/render logic (no browser)
// with fixtures matching the real 2026-09-03 re-probe (naive p75=152/61-interactions,
// deferred p75=0/1, worker p75=8/1), plus the committed durable card + advisory routing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { median, summarizeArm, buildScoreboard, renderCard, foldLoadCwv, MEASUREMENT_FLOOR_MS } from "../rig/cwv-scoreboard.mjs";

// A measure.mjs run snapshot (the fields the scoreboard consumes).
const run = (inp_p75, interactions) => ({ inp_p75, interactions, egress_requests: 300, expected_egress: 300 });
// The real re-probe shape: naive is a robust p75 over ~61 interactions; the fast arms are single first-input samples.
const NAIVE = [run(152, 61), run(150, 61), run(152, 60)];
const DEFERRED = [run(0, 1), run(8, 1), run(0, 1)];
const WORKER = [run(8, 1), run(0, 1), run(8, 1)];
const build = () => buildScoreboard({ naive: NAIVE, deferred: DEFERRED, worker: WORKER, meta: { fixture: { trackers: 5, work_us: 30000 }, generated_at: "2026-09-03T00:00:00Z" } });

describe("median + summarizeArm", () => {
  it("median handles odd/even", () => {
    expect(median([152, 150, 152])).toBe(152);
    expect(median([8, 0])).toBe(4);
  });

  it("summarizeArm: naive is a real p75 (above the floor); the fast arms are below-floor single-samples", () => {
    const naive = summarizeArm(NAIVE);
    expect(naive.p75_median).toBe(152);
    expect(naive.below_floor).toBe(false); // 61 interactions -> a real p75
    expect(naive.band_ms).toBe(2); // 152-150
    expect(naive.delivery_median).toBe(1); // work-completed parity (300/300)

    const worker = summarizeArm(WORKER);
    expect(worker.below_floor).toBe(true); // ~1 interaction -> steady-state sub-floor
    expect(worker.interactions_median).toBe(1);
  });
});

describe("buildScoreboard (AC1/AC3) — three arms, medianed, honest + floor-aware", () => {
  it("AC1 — runs are medianed into all THREE arms", () => {
    const m = build();
    expect(Object.keys(m.arms).sort()).toEqual(["deferred", "naive", "worker"]);
    expect(m.arms.naive.p75_median).toBe(152);
    expect(m.n_runs).toBe(3);
    expect(m.measurement_floor_ms).toBe(MEASUREMENT_FLOOR_MS);
  });

  it("AC3 — the deferred baseline is present (no naive-vs-worker-only overclaim)", () => {
    const m = build();
    expect(m.arms.deferred).toBeDefined();
    expect(m.arms.deferred.below_floor).toBe(true); // ties worker at the floor
  });

  it("AC3 — fast arms are floor-aware, NOT a false-precise p75; the honest_note discloses the single-sample", () => {
    const m = build();
    expect(m.arms.worker.below_floor).toBe(true);
    expect(m.contrast.honest_note).toMatch(/below the 16ms/i);
    expect(m.contrast.honest_note).toMatch(/first-input|not a precise p75/i);
    // a conservative "at least" ratio against the floor is present (robust to fast-arm noise).
    // FLOORED, not rounded — a stated lower bound must not round UP past the truth.
    expect(m.contrast.naive_over_floor_x).toBe(Math.floor(152 / 16)); // 9 (not 10)
  });

  it("AC3 — the headline states the win vs NAIVE and the 'ties deferred, without the discipline' honesty", () => {
    const m = build();
    expect(m.contrast.headline).toMatch(/vs naive/i);
    expect(m.contrast.headline).toMatch(/t(?:ies|ying) a competently-deferred/i);
    expect(m.contrast.headline).toMatch(/without the deferral discipline/i);
    // the headline leads with the ROBUST floored floor bound (stable run-to-run), not the noisy fast-arm ratio
    expect(m.contrast.headline).toMatch(/at least ~9x vs naive/i);
  });
});

describe("renderCard (AC2/AC3) — a human card showing all three arms, floor-aware", () => {
  it("renders all three arm rows; fast arms show 'below floor', not a precise ms", () => {
    const card = renderCard(build());
    expect(card).toMatch(/naive/i);
    expect(card).toMatch(/deferred/i);
    expect(card).toMatch(/worker \(airlock\)/i);
    expect(card).toMatch(/~152ms/); // naive: real p75
    expect(card).toMatch(/below 16ms floor/); // fast arms: floor, not "~8ms"
    expect(card).not.toMatch(/~8ms/); // no false-precise fast-arm number
    expect(card).toMatch(/advisory/i); // routing disclosed
  });
});

describe("the committed durable card (AC2b) — docs/scoreboard.md", () => {
  const card = readFileSync(new URL("../docs/scoreboard.md", import.meta.url), "utf8");
  it("shows all three arms in tolerance-band language, with provenance + a regenerate pointer", () => {
    for (const arm of ["naive", "deferred", "worker"]) expect(card.toLowerCase()).toContain(arm);
    expect(card).toMatch(/~150ms/); // band, not raw run output
    expect(card).toMatch(/below the 16ms floor/i); // floor honesty for the fast arms
    expect(card).toMatch(/npm run cwv:scoreboard/); // regenerate pointer
    expect(card).toMatch(/2026-09-03/); // provenance
    expect(card).toMatch(/ties a competently-deferred|tying a competently-deferred/i); // honesty, not overclaim
    expect(card).not.toMatch(/\|\s*worker[^|]*\|\s*~8ms/i); // the committed worker row is NOT a false-precise 8ms
  });
});

// A fake rig/lh-eds.mjs JSON (its real shape: delta_median{TBT_ms,CLS} + acceptance).
const LH = { delta_median: { TBT_ms: 4, CLS: 0.001 }, acceptance: { within_band: true } };

describe("029-02 — the load-CWV arm (foldLoadCwv) + CI wiring", () => {
  it("AC2 — the default model has load_cwv: null (opt-in; no Lighthouse spawned by default)", () => {
    expect(build().load_cwv).toBeNull();
    expect(renderCard(build())).toMatch(/run `WITH_LH=1 npm run cwv:scoreboard`/i); // the opt-in note
  });

  it("AC1 — foldLoadCwv adds the load_cwv section from lh-eds's JSON; renderCard shows the row", () => {
    const m = foldLoadCwv(build(), LH);
    expect(m.load_cwv).toEqual({
      tbt_delta_ms: 4,
      cls_delta: 0.001,
      within_band: true,
      lcp_note: expect.stringMatching(/LCP delta ~0 by construction/i),
    });
    const card = renderCard(m);
    expect(card).toMatch(/Load CWV.*TBT delta \*\*4ms\*\*/i);
    expect(card).toMatch(/CLS delta \*\*0\.001\*\*/);
    expect(card).toMatch(/within band/i);
  });

  it("AC1/AC2 — foldLoadCwv is a no-op when the lh JSON is absent or malformed (default stays INP-only)", () => {
    expect(foldLoadCwv(build(), null).load_cwv).toBeNull();
    expect(foldLoadCwv(build(), {}).load_cwv).toBeNull(); // no delta_median
  });

  it("AC3 — CI's browser-oracle runs the scoreboard as an ADVISORY (continue-on-error) step, WITH_LH", () => {
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    expect(ci).toMatch(/cwv_scoreboard/);
    // THIS step's own continue-on-error binds to its WITH_LH run (advisory, like cwv:budget) — not just
    // some continue-on-error elsewhere in the file. The lazy spans stay inside the one step block.
    expect(ci).toMatch(/cwv_scoreboard[\s\S]*?continue-on-error: true[\s\S]*?WITH_LH=1 npm run cwv:scoreboard/);
  });

  it("AC4 — the committed card notes the load-CWV arm (TBT/CLS band + how to run it)", () => {
    const card = readFileSync(new URL("../docs/scoreboard.md", import.meta.url), "utf8");
    expect(card).toMatch(/Load CWV/i);
    expect(card).toMatch(/TBT delta within band/i);
    expect(card).toMatch(/WITH_LH=1 npm run cwv:scoreboard/);
  });
});

describe("AC5 — advisory, NOT wired into oracle.sh's gating composite", () => {
  it("oracle.sh's COMPONENTS still lists only vitest + ga4_mp_conformance (the scoreboard is not a gate)", () => {
    const oracle = readFileSync(new URL("../oracle.sh", import.meta.url), "utf8");
    const comps = oracle.match(/COMPONENTS=\(([^)]*)\)/);
    expect(comps).not.toBeNull();
    expect(comps[1]).not.toMatch(/cwv[_-]scoreboard|cwv[_-]budget/);
    expect(comps[1]).toMatch(/vitest/);
    expect(comps[1]).toMatch(/ga4_mp_conformance/);
  });

  it("AC6 — the rig source carries no live identifiers (synthetic fixture only)", () => {
    const src = readFileSync(new URL("../rig/cwv-scoreboard.mjs", import.meta.url), "utf8");
    expect(src).not.toMatch(/G-[A-Z0-9]{10}/); // no live GA4 measurement id
    expect(src).not.toMatch(/demdex|facebook\.com|bat\.bing/); // no live vendor hosts
  });
});
