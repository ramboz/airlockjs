// The before/after CWV scoreboard — spec 029-01 (MVP5).
//
// Promotes the vision's INP punchline from a buried prose table to a runnable,
// honestly-hedged command. Runs the existing INP-storm driver (rig/measure.mjs)
// under naive / deferred / worker, N runs each, medians them, and emits a
// regenerable artifact (JSON + a markdown card) to the gitignored rig/out/.
//
// HONEST BY CONSTRUCTION (029-01 frame-critique). Two things the artifact must
// NOT do: (1) present a naive-vs-worker "19x" as the sole claim — the vision's
// own positioning is "wins-the-common-case vs naive; TIES a competently-deferred
// main thread — NOT a blanket 'beats the main thread'"; so all THREE arms are
// shown. (2) Report a false-precise fast-arm p75 — rig/harness.html's Event-
// Timing observer uses durationThreshold:16, so the fast arms' sub-16ms steady-
// state interactions are BELOW the INP measurement floor and dropped, leaving
// only the cold first-input (interactions ~= 1). So the fast arms are reported
// as "at/below the 16ms floor" with their captured-interactions count, never a
// precise p75. The durable, committed card is docs/scoreboard.md (tolerance-band
// language); THIS rig's rig/out/ output is the regenerable per-run cache.
//
// Advisory / jig-supervised — NOT in oracle.sh's gating composite (ADR-0005).
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// rig/harness.html's Event-Timing observer durationThreshold (the INP measurement floor).
export const MEASUREMENT_FLOOR_MS = 16;
// interactions at/below this median => the arm's steady-state was sub-floor (only the
// cold first-input was captured) — report it as "below the floor", not a precise p75.
const FLOOR_INTERACTIONS = 2;

// 029-03: load profiles. `micro` is the 5-tracker synthetic micro-fixture; `realistic`
// is a grounded HEAVIER synthetic load — ~12 uniform trackers, reflecting R-007's ~10-15
// INP-relevant real-stack tags. HONEST LIMIT: uniform WORK per tracker (not a varied real
// mix), and NOT the real customer stack (creds/availability-gated — deferred, per mvp5.md).
export const PROFILES = {
  micro: { trackers: 5, work_us: 30000 },
  realistic: { trackers: 12, work_us: 20000 },
};

// Resolve the load profile from env: PROFILE picks the base fixture; TRACKERS/WORK override.
export function resolveProfile(env = {}) {
  const name = env.PROFILE && PROFILES[env.PROFILE] ? env.PROFILE : "micro";
  const base = PROFILES[name];
  return {
    profile: name,
    // `Number(x) || base` — a non-numeric/empty override (NaN) falls back to the profile base
    // rather than passing "NaN" through to measure.mjs's harness (craft-review robustness).
    trackers: Number(env.TRACKERS) || base.trackers,
    work_us: Number(env.WORK) || base.work_us,
    // realistic is a representative uniform-work synthetic — NOT the varied real customer stack.
    synthetic: true,
  };
}

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Summarize one arm from its N `rig/measure.mjs` run snapshots.
export function summarizeArm(runs) {
  const p75s = runs.map((r) => r.inp_p75);
  const interactions = runs.map((r) => r.interactions);
  const interactionsMedian = median(interactions);
  const delivery = runs
    .filter((r) => r.expected_egress)
    .map((r) => r.egress_requests / r.expected_egress);
  return {
    p75_median: median(p75s),
    p75_runs: p75s,
    band_ms: p75s.length > 1 ? Math.max(...p75s) - Math.min(...p75s) : 0,
    interactions_median: interactionsMedian,
    // below the INP measurement floor: FEW captured interactions (steady-state
    // sub-16ms, dropped by durationThreshold — only ~the cold first-input remains)
    // AND that captured sample is itself sub-floor. The p75 conjunct guards against
    // mislabeling a few-but-SLOW arm (e.g. 2 interactions at 100ms) as "below floor".
    below_floor: interactionsMedian <= FLOOR_INTERACTIONS && median(p75s) <= MEASUREMENT_FLOOR_MS,
    delivery_median: delivery.length ? median(delivery) : null,
  };
}

// Build the scoreboard model from the three arms' run snapshots. Pure — the test
// feeds fixtures here (no browser). `meta` carries fixture/provenance.
export function buildScoreboard({ naive, deferred, worker, meta = {} }) {
  const arms = {
    naive: summarizeArm(naive),
    deferred: summarizeArm(deferred),
    worker: summarizeArm(worker),
  };
  // The naive->worker multiplier uses the fast-arm sample (honest_note applies);
  // the naive->floor multiplier is the conservative "at least" bound (naive / the
  // 16ms floor), true regardless of the fast arm's single-sample noise.
  const naiveOverWorker = arms.worker.p75_median > 0 ? Math.round(arms.naive.p75_median / arms.worker.p75_median) : null;
  // FLOOR the lower bound (a stated "at least Nx" must never round UP past the truth):
  // naive 152/16 = 9.5 → 9, not 10 — so a fresh run can't contradict a committed "~9x".
  const naiveOverFloor = Math.floor(arms.naive.p75_median / MEASUREMENT_FLOOR_MS);
  return {
    generated_at: meta.generated_at || new Date().toISOString(),
    fixture: meta.fixture || {},
    n_runs: naive.length,
    measurement_floor_ms: MEASUREMENT_FLOOR_MS,
    arms,
    contrast: {
      naive_over_worker_x: naiveOverWorker,
      naive_over_floor_x: naiveOverFloor,
      // Lead with the ROBUST floor bound (naive / the 16ms floor) — stable run-to-run,
      // since it does not depend on the noisy single-sample fast arm. The true margin is
      // LARGER (the fast arms are below the floor); `naive_over_worker_x` is the softer,
      // vision-consistent figure when a fast sample lands ~8ms.
      headline:
        `naive multi-tracker ~${arms.naive.p75_median}ms → airlock BELOW the ${MEASUREMENT_FLOOR_MS}ms INP floor: ` +
        `at least ~${naiveOverFloor}x vs naive (and larger — its interactions are sub-floor), while TYING a ` +
        `competently-deferred main thread, without the deferral discipline baseline must get right by hand`,
      honest_note:
        `The deferred and worker arms sit BELOW the ${MEASUREMENT_FLOOR_MS}ms Event-Timing floor — steady-state ` +
        `sub-threshold, ~${arms.worker.interactions_median} interaction(s) captured (cold first-input only), so ` +
        `their number is a floor, not a precise p75. The robust contrast is naive's real ~${arms.naive.p75_median}ms p75.`,
    },
    // 029-02: the load-CWV (page-load Lighthouse before/after) arm — null until
    // folded in by `foldLoadCwv` (opt-in via WITH_LH, since lh-eds is slow).
    load_cwv: null,
    routing: "advisory — jig-supervised, NOT in oracle.sh's gating composite (ADR-0005)",
  };
}

// 029-02: fold rig/lh-eds.mjs's off-vs-on Lighthouse deltas into the model as the
// load-CWV half of the before/after. Pure — the test feeds a fake lh JSON. LCP
// delta is ~0 by construction (lazy post-LCP boot), so TBT + CLS are the arms.
export function foldLoadCwv(model, lh) {
  if (!lh || !lh.delta_median) return model;
  return {
    ...model,
    load_cwv: {
      tbt_delta_ms: lh.delta_median.TBT_ms,
      cls_delta: lh.delta_median.CLS,
      within_band: lh.acceptance ? lh.acceptance.within_band : null,
      lcp_note: "LCP delta ~0 by construction (airlock boots lazily, post-LCP)",
    },
  };
}

// Render the model as a human markdown card.
export function renderCard(model) {
  const a = model.arms;
  const val = (arm) => (arm.below_floor ? `below ${model.measurement_floor_ms}ms floor` : `~${arm.p75_median}ms`);
  const row = (name, arm, note) => `| ${name} | ${val(arm)} | ${arm.interactions_median} | ${note} |`;
  const fx = model.fixture || {};
  return [
    `# airlock CWV scoreboard — INP under a multi-tracker storm`,
    ``,
    `_Generated ${model.generated_at} · **${fx.profile ?? "micro"}** profile: synthetic ` +
      `${fx.trackers ?? "?"}-tracker load (uniform work ${fx.work_us ?? "?"}µs) · N=${model.n_runs} per arm · ` +
      `advisory (not a gate)._`,
    ``,
    ...(fx.profile === "realistic"
      ? [
          `> _Realistic profile: a grounded heavier **synthetic** load (~${fx.trackers} uniform trackers, R-007's ` +
            `INP-relevant count) — a representative average, NOT a varied real mix, and NOT the real customer stack ` +
            `(creds-gated, deferred)._`,
          ``,
        ]
      : []),
    `| arm | INP p75 | interactions | note |`,
    `|---|---|---|---|`,
    row("naive (sync multi-tracker)", a.naive, "real p75 — every interaction is above the 16ms floor"),
    row("deferred (rIC main thread)", a.deferred, "steady-state below the Event-Timing floor"),
    row("worker (airlock)", a.worker, "steady-state below the Event-Timing floor"),
    ``,
    `**Headline:** ${model.contrast.headline}`,
    ``,
    `> ${model.contrast.honest_note}`,
    ``,
    model.load_cwv
      ? `**Load CWV (airlock OFF→ON, real testbed):** TBT delta **${model.load_cwv.tbt_delta_ms}ms**, ` +
        `CLS delta **${model.load_cwv.cls_delta}** (LCP ~0 by construction) — ` +
        `${model.load_cwv.within_band === true ? "within band (~zero page-load cost)" : model.load_cwv.within_band === false ? "OVER band" : "band unknown"}.`
      : "_Load CWV: run `WITH_LH=1 npm run cwv:scoreboard` to add the off-vs-on Lighthouse TBT/CLS arm._",
    ``,
    `_${model.routing}._`,
  ].join("\n");
}

// --- script entry (guarded so importing for tests never launches a browser) ---
function runMeasure(mode, fixture) {
  const out = execFileSync("node", ["rig/measure.mjs"], {
    env: { ...process.env, MODE: mode, TRACKERS: String(fixture.trackers), WORK: String(fixture.work_us) },
    encoding: "utf8",
    timeout: Number(process.env.CWV_CHILD_TIMEOUT_MS || 180000),
  });
  return JSON.parse(out);
}

// lh-eds.mjs shells `npm run build` with stdio:"inherit", prefixing an npm banner
// ahead of its JSON — so parse from the last top-level object (mirrors cwv-budget.mjs's
// extractTrailingJSON). The lh-eds source-side fix (build output → stderr) is tracked in
// docs/inbox.md; consuming robustly here keeps this slice non-invasive to lh-eds's callers.
function extractTrailingJSON(text) {
  const idx = text.lastIndexOf("\n{\n");
  const start = text.startsWith("{\n") ? 0 : idx < 0 ? -1 : idx + 1;
  if (start < 0) throw new Error(`no JSON object found in output:\n${text}`);
  return JSON.parse(text.slice(start).trim());
}

function runLighthouse() {
  const out = execFileSync("node", ["rig/lh-eds.mjs"], {
    encoding: "utf8",
    timeout: Number(process.env.CWV_CHILD_TIMEOUT_MS || 180000),
  });
  return extractTrailingJSON(out);
}

async function main() {
  const N = Math.max(1, Number(process.env.INP_N || 3)); // guard: >=1 (median([]) is NaN)
  const fixture = resolveProfile(process.env); // 029-03: micro | realistic (+ TRACKERS/WORK override)
  const modes = ["naive", "deferred", "worker"];
  const runs = {};
  for (const mode of modes) {
    process.stderr.write(`cwv:scoreboard — ${fixture.profile} · ${mode} x${N}...\n`);
    runs[mode] = [];
    for (let i = 0; i < N; i++) runs[mode].push(runMeasure(mode, fixture));
  }
  let model = buildScoreboard({
    ...runs,
    meta: { generated_at: new Date().toISOString(), fixture },
  });
  // 029-02: opt-in load-CWV arm (lh-eds is slow — build + Lighthouse). Default stays INP-only + fast.
  if (process.env.WITH_LH) {
    process.stderr.write("cwv:scoreboard — load-CWV (rig/lh-eds.mjs)...\n");
    model = foldLoadCwv(model, runLighthouse());
  }
  mkdirSync("rig/out", { recursive: true });
  writeFileSync("rig/out/cwv-scoreboard.json", JSON.stringify(model, null, 2));
  const card = renderCard(model);
  writeFileSync("rig/out/cwv-scoreboard.md", card + "\n");
  console.log(card);
  // Advisory: always exit 0 (ADR-0005 — never a gate). The JSON cache is for CI upload.
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
