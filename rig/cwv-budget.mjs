// cwv_budget — advisory Core Web Vitals budget check (spec 007 slice 07-03,
// AC1 + AC2). This is deliberately NOT wired into oracle.sh's COMPONENTS
// array: it is a standalone advisory invocation, run locally or as a
// separate CI step, that reports but never feeds the servo-unattended
// gating composite (AC2 — cwv_budget is the weakest oracle: statistical,
// rIC-protected, widest proxy-gap).
//
// Checks four budgets pinned from spec 003's spike measurements
// (spec.md A4):
//   - TBT: before/after Lighthouse delta <= 50ms                (rig/lh-eds.mjs)
//   - CLS: before/after Lighthouse delta <= 0.01                (rig/lh-eds.mjs)
//   - INP: a cross-invocation, median-of-N delta vs the rIC-deferred
//     control, within a pinned tolerance band. rig/measure.mjs runs ONE
//     MODE per invocation (one browser, one page) — there is no same-run
//     control+worker pair — so this script is the pairing wrapper: it spawns
//     measure.mjs under MODE=deferred and MODE=worker N times each, takes
//     the median inp_p75 of each side, and budgets
//     delta = median(worker) - median(deferred) against a tolerance band
//     sized to swamp cross-invocation noise (thermal/GC/scheduling between
//     browser launches), NOT a same-run point comparison (spec.md A4).
//   - Delivery: drain-stage delivery >= 99% under storm, sampled from the
//     same MODE=worker measure.mjs runs used for the INP pairing, PLUS the
//     last-beacon fast path (pushCritical) and ring-tail flush delivering
//     their full count within the teardown window (rig/teardown.mjs).
//     Deliberately drain-stage-scoped, not end-to-end: the still-open
//     teardown/unload loss on the enqueued push() path (OQ10, R-001) is out
//     of this budget's scope and must not be folded in.
//
// Usage: node rig/cwv-budget.mjs
//   env overrides: INP_N (default 3, samples per mode), INP_BAND_MS
//   (default 30, the tolerance band on the median delta), LH_N (forwarded
//   to rig/lh-eds.mjs).
//
// Exit 0 if every metric is within budget, 1 if any metric is over. This
// exit code is for local/CI ADVISORY reporting only — it is never consumed
// by oracle.sh's gating composite (AC2).
import { execFileSync } from "node:child_process";

const INP_N = Number(process.env.INP_N || 3);
const INP_BAND_MS = Number(process.env.INP_BAND_MS || 30);
// Per-child wall-clock cap so a hung chromium launch / stalled `npm run build`
// can't hang this advisory step indefinitely in CI (07-03 craft/arch nit).
const CHILD_TIMEOUT_MS = Number(process.env.CWV_CHILD_TIMEOUT_MS || 180000);

function runMeasure(mode) {
  const out = execFileSync("node", ["rig/measure.mjs"], {
    env: { ...process.env, MODE: mode },
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
  });
  return JSON.parse(out);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// rig/lh-eds.mjs shells out to `npm run build` with stdio:"inherit" before
// printing its JSON scoreboard, so the captured stdout has an npm banner
// prefixed ahead of the JSON. The JSON is always the last thing printed, as
// a pretty (indent=2) top-level object whose opening "{" sits alone on its
// own line — find that line and parse from there.
function extractTrailingJSON(text) {
  const marker = "\n{\n";
  const idx = text.lastIndexOf(marker);
  if (!text.startsWith("{\n") && idx < 0) {
    throw new Error(`no JSON object found in output:\n${text}`);
  }
  const start = text.startsWith("{\n") ? 0 : idx + 1;
  return JSON.parse(text.slice(start).trim());
}

console.log(`cwv_budget: sampling INP p75 (N=${INP_N} per mode: deferred [rIC control], worker [airlock])...`);
const deferredRuns = [];
const workerRuns = [];
for (let i = 0; i < INP_N; i++) deferredRuns.push(runMeasure("deferred"));
for (let i = 0; i < INP_N; i++) workerRuns.push(runMeasure("worker"));

const deferredP75 = deferredRuns.map((r) => r.inp_p75);
const workerP75 = workerRuns.map((r) => r.inp_p75);
const deferredMedian = median(deferredP75);
const workerMedian = median(workerP75);
const inpDelta = workerMedian - deferredMedian;
const inpWithin = Math.abs(inpDelta) <= INP_BAND_MS;

// Drain-stage delivery: sampled from the same MODE=worker runs used above
// (storm delivery after full settle — NOT the teardown window; that loss
// is OQ10's separate, out-of-scope concern, checked below via teardown.mjs
// only for the fast-path/ring-tail scenarios).
const deliveryRatios = workerRuns.map((r) => r.egress_requests / r.expected_egress);
const deliveryMedian = median(deliveryRatios);
const deliveryWithin = deliveryMedian >= 0.99;

console.log("cwv_budget: running before/after Lighthouse (rig/lh-eds.mjs)...");
const lh = extractTrailingJSON(execFileSync("node", ["rig/lh-eds.mjs"], { encoding: "utf8", timeout: CHILD_TIMEOUT_MS }));
const tbtDelta = lh.delta_median.TBT_ms;
const clsDelta = lh.delta_median.CLS;
const tbtWithin = tbtDelta <= 50;
const clsWithin = Math.abs(clsDelta) <= 0.01;

console.log("cwv_budget: running teardown delivery rig (rig/teardown.mjs)...");
const td = JSON.parse(execFileSync("node", ["rig/teardown.mjs"], { encoding: "utf8", timeout: CHILD_TIMEOUT_MS }));
// Look up by scenario label (each result carries `scenario`), not by array
// index — robust to any reordering of teardown.mjs's scenario array (07-03
// craft nit). The enqueued-last-beacon scenario (OQ10 loss) is deliberately
// not budgeted here.
const byScenario = (re) => {
  const hit = td.results.find((r) => re.test(r.scenario));
  if (!hit) throw new Error(`teardown scenario not found for ${re}; got: ${td.results.map((r) => r.scenario).join(" | ")}`);
  return hit;
};
const critical = byScenario(/critical/i); // pushCritical synchronous fast path
const ringTail = byScenario(/ring tail/i); // ring tail flushed at visibilitychange->hidden
const criticalWithin = critical.delivered_in_teardown_window >= critical.expected;
const ringTailWithin = ringTail.delivered_in_teardown_window >= ringTail.expected;

const rows = [
  ["TBT delta (ms)", tbtDelta, "<= 50", tbtWithin],
  ["CLS delta", clsDelta, "<= 0.01", clsWithin],
  [`INP p75 delta worker-deferred (median of ${INP_N})`, `${inpDelta}ms`, `within +/-${INP_BAND_MS}ms band`, inpWithin],
  ["drain-stage delivery (storm, worker, median)", `${(deliveryMedian * 100).toFixed(1)}%`, ">= 99%", deliveryWithin],
  ["pushCritical delivered-in-window", `${critical.delivered_in_teardown_window}/${critical.expected}`, "full count", criticalWithin],
  ["ring-tail delivered-in-window", `${ringTail.delivered_in_teardown_window}/${ringTail.expected}`, "full count", ringTailWithin],
];

console.log("\ncwv_budget report:");
console.log("metric".padEnd(48), "observed".padEnd(20), "budget".padEnd(24), "status");
for (const [metric, observed, budget, ok] of rows) {
  console.log(String(metric).padEnd(48), String(observed).padEnd(20), String(budget).padEnd(24), ok ? "PASS" : "FAIL");
}
console.log(
  `\nINP samples: deferred=[${deferredP75}] (median=${deferredMedian}ms) `
  + `worker=[${workerP75}] (median=${workerMedian}ms) delta=${inpDelta}ms`,
);

const allPass = rows.every(([, , , ok]) => ok);
console.log(`\ncwv_budget: ${allPass ? "PASS" : "FAIL"} — advisory only, does not feed oracle.sh's gating composite (AC2).`);
process.exit(allPass ? 0 : 1);
