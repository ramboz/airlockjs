// worker-dom-nasty-tag — spec 025-01 AC1 driver: runs 023-01's synthetic
// DOM-mutation-heavy nasty tag (rig/nasty-tag-harness.html's naive per-
// element write+read+busy step) OFF-THREAD inside @ampproject/worker-dom
// (rig/worker-dom-nasty-tag-author.js, an unmodified port), fires a SCRIPTED
// click storm at a PINNED cadence (mirrors rig/nasty-tag.mjs's CLICKS/GAP
// pattern), and reads back the raw Event-Timing within-storm p75/p98/max
// distribution the SAME way rig/nasty-tag.mjs does. Runs N page loads (a
// FRESH browser launch each run) and reports the MEDIAN + a noise band.
//
// This measures the MAIN-THREAD MUTATION-APPLY cost of worker-dom's
// coordinator flushing a heavy mutation stream while the storm fires — the
// central, previously-unmeasured bet ADR-0014 flags (adr-0014:101,105-109).
//
// Usage: node rig/worker-dom-nasty-tag.mjs
//   env overrides: N (default 3), CLICKS (default 15), GAP (default 120ms),
//   ELEMENTS (default 400), WORK_US (default 500), SETTLE_TIMEOUT_MS
//   (default 200), SETTLE_MAX_POLLS (default 200).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // repo root
const AUTHOR_SCRIPT_PATH = "/rig/worker-dom-nasty-tag-author.js";
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

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    let body = await readFile(file);
    // Server-side templating of the author script's ELEMENTS/WORK_US
    // placeholders — the worker has no location.search of its own to read
    // (mirrors rig/nasty-tag-harness.html's own ?elements=&workUs= query
    // convention, just applied server-side since this file is fetched raw
    // by worker-dom's upgradeElement(), not loaded as the top-level page).
    if (p === AUTHOR_SCRIPT_PATH) {
      body = body.toString("utf8")
        .replaceAll("__ELEMENTS__", String(ELEMENTS))
        .replaceAll("__WORK_US__", String(WORK_US));
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

async function runOnce() {
  // FRESH browser per run — rig/cwv-budget.mjs:16-20's cross-invocation-
  // noise discipline, same as rig/nasty-tag.mjs.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const url = `http://localhost:${port}/rig/worker-dom-nasty-tag-harness.html?elements=${ELEMENTS}&workUs=${WORK_US}`;
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

  // Settle: poll workCompleted until it stabilizes (mirrors nasty-tag.mjs's
  // settle poll).
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
  `worker-dom-nasty-tag: sampling (N=${N}, clicks=${CLICKS}, gap=${GAP}ms, elements=${ELEMENTS}, workUs=${WORK_US})...`,
);
const runs = [];
for (let i = 0; i < N; i++) {
  const snap = await runOnce();
  if (snap.bootFailed) {
    console.log(`  run ${i + 1}/${N}: BOOT FAILED — ${snap.bootError}`);
  } else {
    console.log(
      `  run ${i + 1}/${N}: inp_p75=${snap.inp_p75}ms inp_p98=${snap.inp_p98}ms inp_max=${snap.inp_max}ms `
      + `interactions=${snap.interactions}/${snap.clicksFired} workCompleted=${snap.workCompleted} workerClicks=${snap.workerClicks} collectMs=${snap.collectMs}`,
    );
  }
  runs.push(snap);
}

const bootFailures = runs.filter((r) => r.bootFailed);
if (bootFailures.length === runs.length) {
  // AC1's honest escape: worker-dom@0.36 could not boot the synthetic at
  // all. This must NEVER be read as the mutation-apply re-tanking — it is a
  // lib-completeness/staleness gap (adr-0014's Assumptions section), a
  // DIFFERENT axis from the mechanism bet.
  console.log("\nworker-dom-nasty-tag: ESCAPE — worker-dom@0.36 could not boot the synthetic in ANY of the N runs.");
  console.log("axis: couldn't-measure-in-0.36 (lib-staleness, NOT a model KILL).");
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

// Same "good INP" band (<=200ms) rig/nasty-tag.mjs uses (the standard Web
// Vitals threshold) — applied here to the WORKER-DOM-MEDIATED apply, not a
// naive-vs-airlock contrast (there is no second mode in this driver; AC1's
// question is "does the apply itself stay in the safe band", not a ratio).
const inpSafe = scoreboard.p75_median <= 200;

console.log("\nworker-dom-nasty-tag INP scoreboard (spec 025-01 AC1):");
console.log(JSON.stringify(scoreboard, null, 2));
console.log(
  `\nworker-dom-nasty-tag: apply p75=${scoreboard.p75_median}ms (band ${JSON.stringify(scoreboard.p75_band)}) — `
  + `${inpSafe ? "INP-SAFE (<=200ms)" : "NOT INP-SAFE (>200ms) — possible re-tank"}.`,
);

server.close();
process.exit(inpSafe ? 0 : 1);
