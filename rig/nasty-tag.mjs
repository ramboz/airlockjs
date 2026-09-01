// nasty-tag — DOM-cost containment POC INP scoreboard driver (spec 023-01
// AC4). Loads rig/nasty-tag-harness.html in naive vs airlock mode, fires a
// SCRIPTED click storm at a PINNED cadence (mirrors rig/measure.mjs's
// CLICKS/GAP pattern, :36-37), and reads back the raw Event-Timing
// within-storm p75/p98/max distribution — rig/harness.html:30-74's PROVEN
// method (NOT web-vitals onINP — 023-01 AC4's must-fix). Runs N page loads
// PER MODE (a FRESH browser launch each run — inherits
// rig/cwv-budget.mjs:16-20's cross-invocation-noise discipline) and reports
// the MEDIAN + a noise band (min/max across the N runs), work-completed on
// BOTH modes (fairness, verified not asserted), and the naive INP breakdown.
//
// Usage: node rig/nasty-tag.mjs
//   env overrides: N (default 3, page loads per mode), CLICKS (default 15),
//   GAP (default 120ms), ELEMENTS (default 400), WORK_US (default 500),
//   BUDGET_MS (default 10), YIELD (default "platform"; "fallback" forces
//   the MessageChannel path — 023-01's grounding probe), SETTLE_TIMEOUT_MS
//   (default 200, poll interval), SETTLE_MAX_POLLS (default 200).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // repo root
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

const N = Number(process.env.N || 3);
const CLICKS = Number(process.env.CLICKS || 15);
const GAP = Number(process.env.GAP || 120);
const ELEMENTS = Number(process.env.ELEMENTS || 400);
const WORK_US = Number(process.env.WORK_US || 500);
const BUDGET_MS = Number(process.env.BUDGET_MS || 10);
const YIELD = process.env.YIELD || "platform";
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS || 200);
const SETTLE_MAX_POLLS = Number(process.env.SETTLE_MAX_POLLS || 200);

async function runOnce(mode) {
  // FRESH browser per run (not a shared warm instance) — the cross-
  // invocation-noise discipline rig/cwv-budget.mjs:16-20 established
  // (thermal/GC/scheduling variance BETWEEN browser launches is exactly what
  // N-runs-median-with-a-band is meant to swamp; a long-lived warm browser
  // would understate it).
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const url = `http://localhost:${port}/rig/nasty-tag-harness.html`
    + `?mode=${mode}&elements=${ELEMENTS}&workUs=${WORK_US}&budgetMs=${BUDGET_MS}&yield=${YIELD}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__rig, { timeout: 10000 });

  const target = page.locator("#target");
  for (let i = 0; i < CLICKS; i++) {
    await target.click({ timeout: 20000 }); // naive mode's own handler can block well past a default timeout under load
    await page.waitForTimeout(GAP);
  }

  // Settle: poll workCompleted until it stabilizes (mirrors measure.mjs's
  // egress-stabilize poll). Naive completes instantly (fully synchronous per
  // click); airlock may still be draining a queued backlog.
  let prev = -1;
  let stable = 0;
  let snap = await page.evaluate(() => window.__rig.snapshot());
  for (let i = 0; i < SETTLE_MAX_POLLS && stable < 4; i++) {
    await page.waitForTimeout(SETTLE_TIMEOUT_MS);
    snap = await page.evaluate(() => window.__rig.snapshot());
    if (snap.workCompleted === prev) stable++; else { stable = 0; prev = snap.workCompleted; }
  }
  if (pageErrors.length) snap.pageErrors = pageErrors;

  await browser.close();
  return snap;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function runMode(mode) {
  console.log(
    `nasty-tag: sampling mode=${mode} (N=${N}, clicks=${CLICKS}, gap=${GAP}ms, `
    + `elements=${ELEMENTS}, workUs=${WORK_US}, budgetMs=${BUDGET_MS}, yield=${YIELD})...`,
  );
  const runs = [];
  for (let i = 0; i < N; i++) {
    const snap = await runOnce(mode);
    console.log(`  run ${i + 1}/${N}: inp_p75=${snap.inp_p75}ms inp_p98=${snap.inp_p98}ms inp_max=${snap.inp_max}ms interactions=${snap.interactions}/${snap.clicksFired} workCompleted=${snap.workCompleted}/${snap.expectedWork}`);
    runs.push(snap);
  }
  const p75s = runs.map((r) => r.inp_p75);
  const p98s = runs.map((r) => r.inp_p98);
  const maxs = runs.map((r) => r.inp_max);
  const workCompleted = runs.map((r) => r.workCompleted);
  return {
    mode,
    n: N,
    p75_samples: p75s, p75_median: median(p75s), p75_band: [Math.min(...p75s), Math.max(...p75s)],
    p98_samples: p98s, p98_median: median(p98s), p98_band: [Math.min(...p98s), Math.max(...p98s)],
    max_samples: maxs, max_median: median(maxs), max_band: [Math.min(...maxs), Math.max(...maxs)],
    interactions_samples: runs.map((r) => r.interactions),
    workCompleted_samples: workCompleted, workCompleted_median: median(workCompleted),
    expectedWork_median: median(runs.map((r) => r.expectedWork)),
    collectMs_median: median(runs.map((r) => r.collectMs)),
    mechanism: runs[0].mechanism,
    breakdown_median: {
      inputDelay: median(runs.map((r) => r.breakdown.inputDelay_median)),
      processing: median(runs.map((r) => r.breakdown.processing_median)),
      presentation: median(runs.map((r) => r.breakdown.presentation_median)),
    },
    pageErrors: runs.flatMap((r) => r.pageErrors || []),
  };
}

const naive = await runMode("naive");
const airlock = await runMode("airlock");

// A transparent, documented (not hidden) definition of "decisive" — airlock
// lands in the standard "good" INP band (<=200ms) AND is at least 2x better
// than naive. See this slice's deviation log for the ACTUAL observed numbers
// and an honest read on whether the contrast is decisive for this fixture
// (023-01 AC4: "a non-decisive contrast falsifies Lever 1 — record that
// plainly").
const decisive = airlock.p75_median <= 200 && airlock.p75_median * 2 <= naive.p75_median;

const scoreboard = {
  naive,
  airlock,
  contrast: {
    p75_delta_ms: naive.p75_median - airlock.p75_median,
    p75_ratio: airlock.p75_median > 0 ? Math.round((naive.p75_median / airlock.p75_median) * 10) / 10 : null,
    decisive,
  },
  fairness: {
    naive_workCompleted_median: naive.workCompleted_median,
    airlock_workCompleted_median: airlock.workCompleted_median,
    naive_expectedWork_median: naive.expectedWork_median,
    airlock_expectedWork_median: airlock.expectedWork_median,
    same_total_work: naive.workCompleted_median === airlock.workCompleted_median,
  },
  fixture: {
    collectMs_naive_median: naive.collectMs_median,
    collectMs_airlock_median: airlock.collectMs_median,
  },
};

console.log("\nnasty-tag INP scoreboard (spec 023-01 AC4):");
console.log(JSON.stringify(scoreboard, null, 2));
console.log(
  `\nnasty-tag: thesis ${decisive ? "HELD" : "NOT DECISIVE (falsified for this fixture)"} — `
  + `naive p75=${naive.p75_median}ms vs airlock p75=${airlock.p75_median}ms `
  + `(median of ${N} runs each; naive interactions/clicks=${naive.interactions_samples}; `
  + `airlock interactions/clicks=${airlock.interactions_samples}).`,
);

server.close();
process.exit(decisive ? 0 : 1);
