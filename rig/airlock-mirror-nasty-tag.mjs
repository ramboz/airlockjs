// airlock-mirror-nasty-tag — spec 025-02 AC5a driver: runs the SAME 025-01
// synthetic DOM-mutation-heavy nasty tag (rig/worker-dom-nasty-tag-author.js,
// BYTE-UNMODIFIED — this driver serves it as a plain static file, no
// server-side templating; the __ELEMENTS__/__WORK_US__ substitution happens
// WORKER-SIDE, in core/dom-chamber-host.js's boot()) OFF-THREAD through
// airlock's OWN bidirectional mirror (core/worker-dom/*,
// core/dom-chamber.worker.js, adapters/eds/dom-apply.js) instead of
// 025-01's @ampproject/worker-dom probe, fires a SCRIPTED click storm at a
// PINNED cadence (mirrors rig/worker-dom-nasty-tag.mjs's CLICKS/GAP
// pattern), and reads back the raw Event-Timing within-storm p75/p98/max
// distribution the SAME way rig/nasty-tag.mjs / rig/worker-dom-nasty-tag.mjs
// do. Runs N page loads (a FRESH browser launch each run) and reports the
// MEDIAN + a noise band.
//
// This is AC5a's COMPUTE-OFF-THREAD (plumbing) metric — the round-trip
// works and the heavy compute is off-thread — HONESTLY LABELED as distinct
// from AC5b's apply-INP proof (test/dom-apply-coordinator.test.js): the
// apply here is light (~400 style writes) and lands in a task decoupled
// from the click, so this p75 does not attribute the apply's own cost.
//
// THE AC5a MUST-FIX (the frame-critique's whole point): a `workCompleted=0`
// stall (the storm never actually fired) MUST FAIL this run, never pass as
// a flat-INP-looking false green — see the hard assertion below.
//
// Usage: node rig/airlock-mirror-nasty-tag.mjs
//   env overrides: N (default 3), CLICKS (default 15), GAP (default 120ms),
//   ELEMENTS (default 400), WORK_US (default 500), SETTLE_TIMEOUT_MS
//   (default 200), SETTLE_MAX_POLLS (default 200).
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

const N = Number(process.env.N || 3);
const CLICKS = Number(process.env.CLICKS || 15);
const GAP = Number(process.env.GAP || 120);
const ELEMENTS = Number(process.env.ELEMENTS || 400);
const WORK_US = Number(process.env.WORK_US || 500);
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS || 200);
const SETTLE_MAX_POLLS = Number(process.env.SETTLE_MAX_POLLS || 200);

// A GENERIC static file server — every file (incl. the author script) is
// served BYTE-UNMODIFIED (no templating): airlock's own dom-chamber-host.js
// does the __ELEMENTS__/__WORK_US__ substitution worker-side, from the
// elements/workUs fields the harness page posts in its "init" message.
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

async function runOnce() {
  // FRESH browser per run — rig/cwv-budget.mjs:16-20's cross-invocation-
  // noise discipline, same as rig/nasty-tag.mjs / rig/worker-dom-nasty-tag.mjs.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const url = `http://localhost:${port}/rig/airlock-mirror-nasty-tag-harness.html?elements=${ELEMENTS}&workUs=${WORK_US}`;
  await page.goto(url);
  await page
    .waitForFunction(() => window.__booted || window.__bootError, { timeout: 15000 })
    .catch(() => {});

  const bootError = await page.evaluate(() => window.__bootError || null);
  if (bootError) {
    await browser.close();
    return { bootFailed: true, bootError, pageErrors };
  }
  await page.waitForFunction(() => window.__rig, { timeout: 10000 });

  const target = page.locator("#target");
  for (let i = 0; i < CLICKS; i++) {
    await target.click({ timeout: 20000 });
    await page.waitForTimeout(GAP);
  }

  // Settle: poll workCompleted until it stabilizes (mirrors worker-dom-nasty-tag.mjs's settle poll).
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
  return { bootFailed: false, ...snap };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

console.log(
  `airlock-mirror-nasty-tag: sampling (N=${N}, clicks=${CLICKS}, gap=${GAP}ms, elements=${ELEMENTS}, workUs=${WORK_US})...`,
);
const runs = [];
for (let i = 0; i < N; i++) {
  const snap = await runOnce();
  if (snap.bootFailed) {
    console.log(`  run ${i + 1}/${N}: BOOT FAILED — ${snap.bootError}`);
  } else {
    console.log(
      `  run ${i + 1}/${N}: inp_p75=${snap.inp_p75}ms inp_p98=${snap.inp_p98}ms inp_max=${snap.inp_max}ms `
      + `interactions=${snap.interactions}/${snap.clicksFired} workCompleted=${snap.workCompleted} workerClicks=${snap.workerClicks} `
      + `expected=${snap.clicksFired * ELEMENTS} collectMs=${snap.collectMs}`,
    );
  }
  runs.push(snap);
}

const bootFailures = runs.filter((r) => r.bootFailed);
if (bootFailures.length === runs.length) {
  console.log("\nairlock-mirror-nasty-tag: ESCAPE — the harness could not boot the mirror in ANY of the N runs.");
  console.log("errors:", JSON.stringify(bootFailures.map((r) => r.bootError)));
  server.close();
  process.exit(2);
}

const ok = runs.filter((r) => !r.bootFailed);
const p75s = ok.map((r) => r.inp_p75);
const p98s = ok.map((r) => r.inp_p98);
const maxs = ok.map((r) => r.inp_max);
const scoreboard = {
  n: N,
  bootFailures: bootFailures.length,
  p75_samples: p75s, p75_median: median(p75s), p75_band: [Math.min(...p75s), Math.max(...p75s)],
  p98_samples: p98s, p98_median: median(p98s), p98_band: [Math.min(...p98s), Math.max(...p98s)],
  max_samples: maxs, max_median: median(maxs), max_band: [Math.min(...maxs), Math.max(...maxs)],
  interactions_samples: ok.map((r) => r.interactions),
  clicksFired_samples: ok.map((r) => r.clicksFired),
  workCompleted_samples: ok.map((r) => r.workCompleted),
  workerClicks_samples: ok.map((r) => r.workerClicks),
  expectedWork_perClick: ELEMENTS,
  collectMs_samples: ok.map((r) => r.collectMs),
  pageErrors: ok.flatMap((r) => r.pageErrors || []),
};

// AC5a's MUST-FIX (the frame-critique's whole point): the storm must have
// ACTUALLY FIRED — workCompleted == clicksFired * ELEMENTS for EVERY run.
// A workCompleted=0 stall (025-01's original-draft failure signature) MUST
// FAIL this run, never pass silently as a flat-INP-looking green.
const workCompletedOk = ok.every((r) => r.workCompleted === r.clicksFired * ELEMENTS);
const inpSafe = scoreboard.p75_median <= 200; // the standard Web Vitals "good INP" threshold

console.log("\nairlock-mirror-nasty-tag INP scoreboard (spec 025-02 AC5a):");
console.log(JSON.stringify(scoreboard, null, 2));
console.log(
  `\nairlock-mirror-nasty-tag: apply-round-trip p75=${scoreboard.p75_median}ms (band ${JSON.stringify(scoreboard.p75_band)}) — `
  + `${inpSafe ? "compute-off-thread p75 is LOW (<=200ms)" : "NOT low (>200ms)"}.`,
);
console.log(
  `airlock-mirror-nasty-tag: workCompleted check — ${workCompletedOk ? "PASS" : "FAIL"} `
  + `(every run's workCompleted == clicksFired * ELEMENTS; a stall must fail, never pass as a flat-INP green).`,
);

server.close();
process.exit(inpSafe && workCompletedOk ? 0 : 1);
