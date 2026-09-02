// worker-dom-prism — spec 025-01 AC2 driver: runs a REAL, UNMODIFIED,
// write/compute-heavy-WITHOUT-sync-read tag (prismjs — a syntax highlighter;
// see rig/worker-dom-prism-author.js's header for the sync-read grep that
// grounds the shape claim) OFF-THREAD inside @ampproject/worker-dom, fires a
// pinned click storm the same way rig/nasty-tag.mjs / rig/worker-dom-nasty-
// tag.mjs do, and reads back the raw Event-Timing within-storm p75/p98/max.
//
// Usage: node rig/worker-dom-prism.mjs
//   env overrides: N (default 3), CLICKS (default 12), GAP (default 150ms),
//   REPEAT (default 60, code-sample repetitions per highlight pass),
//   SETTLE_TIMEOUT_MS (default 200), SETTLE_MAX_POLLS (default 100).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// A VIRTUAL path — not a file on disk. Built on the fly per-request by
// concatenating the REAL, UNMODIFIED node_modules/prismjs/prism.js (read
// fresh, never copied into this repo) + a one-line Prism.manual=true prefix
// + rig/worker-dom-prism-glue.js (templated). See worker-dom-prism-glue.js's
// header for why concatenation, not importScripts().
const AUTHOR_SCRIPT_PATH = "/rig/worker-dom-prism-author.built.js";
const PRISM_JS_PATH = join(fileURLToPath(new URL("..", import.meta.url)), "node_modules/prismjs/prism.js");
const GLUE_JS_PATH = join(fileURLToPath(new URL("..", import.meta.url)), "rig/worker-dom-prism-glue.js");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css",
};

const N = Number(process.env.N || 3);
const CLICKS = Number(process.env.CLICKS || 12);
const GAP = Number(process.env.GAP || 150);
const REPEAT = Number(process.env.REPEAT || 60);
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS || 200);
const SETTLE_MAX_POLLS = Number(process.env.SETTLE_MAX_POLLS || 100);

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === AUTHOR_SCRIPT_PATH) {
      const [prismJs, glueJs] = await Promise.all([readFile(PRISM_JS_PATH, "utf8"), readFile(GLUE_JS_PATH, "utf8")]);
      // PREFIX (before Prism's own code runs): (1) Prism.manual — see
      // worker-dom-prism-glue.js's header; (2) an Element.prototype.matches
      // STUB — @ampproject/worker-dom@0.36's mirror Element does NOT
      // implement .matches() at all (grounded: this slice's AC2 first run
      // hit "TypeError: pre.matches is not a function", thrown from
      // prism.js's OWN bundled file-highlight plugin hook, which calls
      // `pre.matches('pre[data-src]:not([data-src-status="loaded"])')`
      // UNCONDITIONALLY on every highlight — not a code path this probe
      // chose). .matches() needs ZERO live-layout info (pure selector/
      // class logic) — a LIB-COMPLETENESS gap, not model-inherent (unlike
      // offsetHeight/getBoundingClientRect). The stub always returns
      // `false` rather than implementing a real selector engine — a fair
      // shim for THIS fixture (the code element genuinely has no
      // `data-src` attribute, so `false` is the semantically correct
      // answer here, just reached by a shortcut, not full CSS-selector
      // logic) — it demonstrates the gap is fixable (airlock's own mirror
      // could implement matches() for real), not a workaround that hides a
      // REAL model-boundary failure.
      const PREFIX = "self.Prism = { manual: true };\n"
        + "if (!self.Element.prototype.matches) { self.Element.prototype.matches = function () { return false; }; }\n";
      const body = PREFIX + prismJs + "\n"
        + glueJs.replaceAll("__REPEAT__", String(REPEAT));
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(body);
    }
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

  const url = `http://localhost:${port}/rig/worker-dom-prism-harness.html?repeat=${REPEAT}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__booted || window.__bootError, { timeout: 15000 }).catch(() => {});

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

console.log(`worker-dom-prism: sampling (N=${N}, clicks=${CLICKS}, gap=${GAP}ms, repeat=${REPEAT})...`);
const runs = [];
for (let i = 0; i < N; i++) {
  const snap = await runOnce();
  if (snap.bootFailed) {
    console.log(`  run ${i + 1}/${N}: BOOT FAILED — ${snap.bootError}`);
  } else {
    console.log(
      `  run ${i + 1}/${N}: inp_p75=${snap.inp_p75}ms inp_p98=${snap.inp_p98}ms inp_max=${snap.inp_max}ms `
      + `interactions=${snap.interactions}/${snap.clicksFired} workCompleted=${snap.workCompleted} workerClicks=${snap.workerClicks} `
      + `rawLen=${snap.rawLen} highlightedLen=${snap.highlightedLen}`,
    );
  }
  runs.push(snap);
}

const bootFailures = runs.filter((r) => r.bootFailed);
if (bootFailures.length === runs.length) {
  console.log("\nworker-dom-prism: ESCAPE — worker-dom@0.36 could not boot Prism in ANY of the N runs.");
  console.log("axis: couldn't-measure-in-0.36 (lib-staleness/lib-completeness, NOT a model KILL) — OR a real prismjs incompatibility; see errors below.");
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
  rawLen_samples: ok.map((r) => r.rawLen),
  highlightedLen_samples: ok.map((r) => r.highlightedLen),
  correctnessCheck: ok.map((r) => r.highlightedLen > r.rawLen), // real highlighting grows markup via <span> wraps
  pageErrors: ok.flatMap((r) => r.pageErrors || []),
};

const inpSafe = scoreboard.p75_median <= 200;
const highlightedForReal = scoreboard.correctnessCheck.every(Boolean);

console.log("\nworker-dom-prism INP scoreboard (spec 025-01 AC2):");
console.log(JSON.stringify(scoreboard, null, 2));
console.log(
  `\nworker-dom-prism: apply p75=${scoreboard.p75_median}ms (band ${JSON.stringify(scoreboard.p75_band)}) — `
  + `${inpSafe ? "INP-SAFE (<=200ms)" : "NOT INP-SAFE (>200ms)"}; highlighting-for-real=${highlightedForReal}.`,
);

server.close();
process.exit(inpSafe && highlightedForReal ? 0 : 1);
