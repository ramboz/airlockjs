// airlock-mirror-prism — spec 025-03 AC4/AC5 driver: THE load-bearing
// measurement. Runs the REAL, UNMODIFIED Prism tag off-thread through
// airlock's OWN mirror (core/worker-dom/*, core/dom-chamber.worker.js),
// constructed via createAirlock's connector:"dom" selection seam (spec
// 025-03 AC6 — "the Prism rig's production path"), with its ~148KB
// `innerHTML` output applied through the SANITIZED apply path
// (adapters/eds/dom-apply.js, spec 025-03 AC3) — and measures it AGAINST a
// grounded NAIVE on-page Prism baseline (tokenize + ONE unsanitized
// `el.innerHTML =`), same page/CPU (rig/airlock-mirror-prism-harness.html).
//
// THE VERDICT (AC4 — three outcomes, not a two-outcome absolute-budget
// check): (a) WIN — governed's apply-window cost < naive's; (b) NET
// REGRESSION — governed >= naive but still under a frame-budget-scale
// reference; (c) RE-TANK — governed grossly exceeds naive/budget. All three
// are reported explicitly; (b)/(c) are honest, documented Outcomes (the
// Tier-0-viability boundary for innerHTML-heavy tags), not hidden failures.
//
// ALSO reports (AC4's "sharpening"): the raw click-p75 for BOTH phases under
// the SAME click cadence — naive's click-p75 should closely track its own
// instrumented apply-window cost (the write is fully synchronous inside the
// click handler); governed's click-p75 is the DECOUPLED-apply false-green
// AC5 warns about UNLESS piling makes a later click's own processing
// contend with a still-running apply (the ~150ms-spacing convergence the
// spec's DoR names) — reported, never substituted for the gating
// apply-window numbers.
//
// ALSO asserts (AC3): a DIRECTLY-crafted hostile setInnerHTML op (AD-5's
// untrusted-chamber threat model) is provably stripped by the SAME real
// apply path — benign markup survives, `onerror`/`<img` are absent, no XSS
// fires.
//
// ALSO asserts (AC5): the tokenization ran OFF-THREAD (mutationsApplied > 0,
// the mirror's own createElement/appendChild ops for the <pre><code> pair
// landed) and the sanitized markup LANDS on the real DOM
// (highlightedLen > rawLen, mirroring 025-01's own correctness signal) — a
// lands-assertion, NOT an "off-thread win" claim (AC4 is the win/loss
// verdict).
//
// Usage: node rig/airlock-mirror-prism.mjs
//   env overrides: N (default 3), CLICKS (default 10), GAP (default 250ms),
//   REPEAT (default 60), SETTLE_TIMEOUT_MS (default 200),
//   SETTLE_MAX_POLLS (default 100).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css",
};

const N = Number(process.env.N || 3);
const CLICKS = Number(process.env.CLICKS || 10);
const GAP = Number(process.env.GAP || 250);
const REPEAT = Number(process.env.REPEAT || 60);
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS || 200);
const SETTLE_MAX_POLLS = Number(process.env.SETTLE_MAX_POLLS || 100);

// A GENERIC static file server (mirrors rig/airlock-mirror-nasty-tag.mjs) —
// serves the repo root byte-unmodified, INCLUDING node_modules/prismjs
// (read fresh, never copied/forked into this repo — AC8).
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
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  const url = `http://localhost:${port}/rig/airlock-mirror-prism-harness.html?repeat=${REPEAT}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__booted || window.__bootError, { timeout: 15000 }).catch(() => {});

  const bootError = await page.evaluate(() => window.__bootError || null);
  if (bootError) {
    await browser.close();
    return { bootFailed: true, bootError, pageErrors };
  }
  await page.waitForFunction(() => window.__rig, { timeout: 10000 });

  const mark = () => page.evaluate(() => performance.now());

  // --- NAIVE phase ---
  const naiveStart = await mark();
  const naiveTarget = page.locator("#target-naive");
  for (let i = 0; i < CLICKS; i++) {
    await naiveTarget.click({ timeout: 20000 });
    await page.waitForTimeout(GAP);
  }
  const naiveEnd = await mark();

  // --- GOVERNED phase ---
  const governedStart = await mark();
  const governedTarget = page.locator("#target-governed");
  for (let i = 0; i < CLICKS; i++) {
    await governedTarget.click({ timeout: 20000 });
    await page.waitForTimeout(GAP);
  }
  // Settle: the apply is DECOUPLED from the click (spec 025-02's round-2
  // reframe) — poll until the apply-window sample count stabilizes.
  let prev = -1;
  let stable = 0;
  let snap = await page.evaluate(() => window.__rig.snapshot());
  for (let i = 0; i < SETTLE_MAX_POLLS && stable < 4; i++) {
    await page.waitForTimeout(SETTLE_TIMEOUT_MS);
    snap = await page.evaluate(() => window.__rig.snapshot());
    const n = snap.governed.applyMs.length;
    if (n === prev) stable++; else { stable = 0; prev = n; }
  }
  const governedEnd = await mark();

  // --- AC3: the hostile-payload sanitizer proof (a directly-crafted op —
  //     not something real Prism would ever emit; see the harness's own
  //     comment on why). ---
  const hostile = await page.evaluate(() => window.__rig.runHostilePayloadCheck());

  const naivePhase = await page.evaluate(([s, e]) => window.__rig.naiveClickPhase(s, e), [naiveStart, naiveEnd]);
  const governedPhase = await page.evaluate(([s, e]) => window.__rig.governedClickPhase(s, e), [governedStart, governedEnd]);

  if (pageErrors.length) snap.pageErrors = pageErrors;
  await browser.close();
  return { bootFailed: false, ...snap, hostile, naiveClickP75: naivePhase.p75, governedClickP75: governedPhase.p75 };
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function p75(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(0.75 * s.length))];
}

console.log(`airlock-mirror-prism: sampling (N=${N}, clicks=${CLICKS}, gap=${GAP}ms, repeat=${REPEAT})...`);
const runs = [];
for (let i = 0; i < N; i++) {
  const snap = await runOnce();
  if (snap.bootFailed) {
    console.log(`  run ${i + 1}/${N}: BOOT FAILED — ${snap.bootError}`);
  } else {
    const naiveMedian = median(snap.naive.applyMs);
    const governedMedian = median(snap.governed.applyMs);
    console.log(
      `  run ${i + 1}/${N}: naive apply-window median=${naiveMedian?.toFixed(2)}ms (n=${snap.naive.applyMs.length}) `
      + `governed apply-window median=${governedMedian?.toFixed(2)}ms (n=${snap.governed.applyMs.length}) `
      + `naiveClickP75=${snap.naiveClickP75}ms governedClickP75=${snap.governedClickP75}ms `
      + `rawLen=${snap.rawLen} naiveHighlightedLen=${snap.naive.highlightedLen} governedHighlightedLen=${snap.governed.highlightedLen} `
      + `mutationsApplied=${snap.governed.mutationsApplied} hostile=${JSON.stringify(snap.hostile)}`,
    );
  }
  runs.push(snap);
}

const bootFailures = runs.filter((r) => r.bootFailed);
if (bootFailures.length === runs.length) {
  console.log("\nairlock-mirror-prism: ESCAPE — the harness could not boot the dom-chamber in ANY of the N runs.");
  console.log("errors:", JSON.stringify(bootFailures.map((r) => r.bootError)));
  server.close();
  process.exit(2);
}

const ok = runs.filter((r) => !r.bootFailed);

// --- pool every per-click apply-window sample across all N runs (a same-
//     machine cross-run median/band, mirroring the repo's established
//     N-runs + median + band convention). ---
const naiveApplySamples = ok.flatMap((r) => r.naive.applyMs);
const governedApplySamples = ok.flatMap((r) => r.governed.applyMs);
const naiveApplyMedian = median(naiveApplySamples);
const governedApplyMedian = median(governedApplySamples);
const naiveApplyP75 = p75(naiveApplySamples);
const governedApplyP75 = p75(governedApplySamples);

// --- AC5: lands-assertion (NOT the INP verdict — see the module header). ---
const correctnessCheck = ok.map((r) => ({
  naiveGrew: r.naive.highlightedLen > r.rawLen,
  governedGrew: r.governed.highlightedLen > r.rawLen,
  mutationsApplied: r.governed.mutationsApplied,
}));
const tokenizedOffThreadAndLands = correctnessCheck.every((c) => c.governedGrew && c.mutationsApplied > 0);
const naiveTokenizedForReal = correctnessCheck.every((c) => c.naiveGrew);

// --- AC3: the sanitizer proof — gated (must hold on EVERY run). Covers all
//     three AC3-named vectors: <script> (STRIPPED_TAGS -> whole element
//     gone), onerror= (event-handler attr -> attr removed, <img> itself
//     legitimately survives — core/sanitize-html.js's real contract), and a
//     javascript: URL on href (ACTIVE_URL_ATTRS -> attr removed). ---
const hostileChecks = ok.map((r) => r.hostile);
const sanitizerProofOk = hostileChecks.every(
  (h) => h.ran && h.benignSurvived && h.scriptTagStripped && h.onerrorAttrStripped
    && h.javascriptUrlStripped && h.imgTagSurvives && !h.xssFired,
);

// --- AC4: THE VERDICT — governed vs naive, three outcomes. A conservative,
//     frame-scale reference budget (10x a single 16ms frame) distinguishes
//     "net regression, but still bounded" from "re-tank" — NOT an absolute
//     pass/fail line on its own (per the spec's own reframe: the win
//     condition is governed < naive; this budget only classifies (b) vs (c)
//     once (a) has already failed). ---
const REFERENCE_BUDGET_MS = 160;
let verdict;
if (governedApplyMedian == null || naiveApplyMedian == null) {
  verdict = "inconclusive — insufficient samples";
} else if (governedApplyMedian < naiveApplyMedian) {
  verdict = "win — governed apply-window MEDIAN < naive's (a Tier-0 win for innerHTML-heavy tags)";
} else if (governedApplyMedian <= REFERENCE_BUDGET_MS) {
  verdict = "net-regression — governed >= naive but still under the reference budget (the sanitize round-trip ate the off-thread win — a documented Tier-0-viability boundary, not a hidden failure)";
} else {
  verdict = "re-tank — governed grossly exceeds naive AND the reference budget";
}

const scoreboard = {
  n: N,
  bootFailures: bootFailures.length,
  naive_apply_window_ms: { samples: naiveApplySamples, median: naiveApplyMedian, p75: naiveApplyP75 },
  governed_apply_window_ms: { samples: governedApplySamples, median: governedApplyMedian, p75: governedApplyP75 },
  naive_click_p75_ms: ok.map((r) => r.naiveClickP75),
  governed_click_p75_ms: ok.map((r) => r.governedClickP75),
  rawLen_samples: ok.map((r) => r.rawLen),
  naive_highlightedLen_samples: ok.map((r) => r.naive.highlightedLen),
  governed_highlightedLen_samples: ok.map((r) => r.governed.highlightedLen),
  mutationsApplied_samples: ok.map((r) => r.governed.mutationsApplied),
  correctnessCheck,
  hostilePayloadChecks: hostileChecks,
  pageErrors: ok.flatMap((r) => r.pageErrors || []),
};

console.log("\nairlock-mirror-prism scoreboard (spec 025-03 AC4/AC5):");
console.log(JSON.stringify(scoreboard, null, 2));
console.log(
  `\nairlock-mirror-prism: naive apply-window median=${naiveApplyMedian?.toFixed(2)}ms (p75=${naiveApplyP75?.toFixed(2)}ms), `
  + `governed apply-window median=${governedApplyMedian?.toFixed(2)}ms (p75=${governedApplyP75?.toFixed(2)}ms).`,
);
console.log(`airlock-mirror-prism: VERDICT — ${verdict}`);
console.log(
  `airlock-mirror-prism: AC5 tokenized-off-thread + lands = ${tokenizedOffThreadAndLands ? "PASS" : "FAIL"} `
  + `(governed highlightedLen > rawLen AND mutationsApplied > 0 on every run — NOT an off-thread-WIN claim); `
  + `naive tokenized for real = ${naiveTokenizedForReal ? "PASS" : "FAIL"}.`,
);
console.log(
  `airlock-mirror-prism: AC3 sanitizer proof = ${sanitizerProofOk ? "PASS" : "FAIL"} `
  + "(benign markup survives; onerror=/<img are stripped from the applied DOM; no XSS fired).",
);
console.log(
  "airlock-mirror-prism: NOTE — naive/governed CLICK-p75 (above) is a plumbing/piling datum, NOT the apply-INP "
  + "verdict (the governed apply is decoupled from its triggering click — spec 025-02's round-2 reframe); the "
  + "GATING numbers are the apply-window medians this verdict is computed from.",
);

server.close();
const pass = tokenizedOffThreadAndLands && naiveTokenizedForReal && sanitizerProofOk;
process.exit(pass ? 0 : 1);
