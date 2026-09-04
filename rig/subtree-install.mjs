// The risk-first proof (spec 031-01 AC5 + AC6) — publish → `git subtree add` onto a
// CLEAN EDS checkout → serve → boot, with CWV preserved. This is the mechanism ADR-0015
// flagged as "asserted, not yet probed": that a subtree of BUILT artifacts actually
// installs, serves, and boots on a real EDS-shaped site with no build step.
//
// The real end-to-end path (NOT a scratch root — the frame-critique's load-bearing
// correction). The rig CONSUMES publish-dist.mjs's output:
//   (a) `npm run build:dist` → dist/ (eds.js + the four sibling *.worker.js; build.mjs
//       self-asserts the same-origin-file-worker layout — AC3).
//   (b) publishDist(dist/) → a DIST-ROOTED `dist` ref in a local BARE repo (AC2): its
//       ROOT is exactly the servable artifacts + VERSION.
//   (c) `git subtree add --prefix scripts/airlock <bare> dist --squash` into a clean
//       EDS checkout (aem-boilerplate-shaped, prepared here in a temp dir — DISTINCT
//       from probes/eds-testbed/, which gets airlock by direct build-emit, not subtree).
//   (d) serve it under the boilerplate CSP header and assert airlock BOOTS: window.airlock
//       present, no window.__airlockBootFailed, and a beacon fires (worker-path egress).
//
// TWO SEEDED RED BREAKS prove the assertions bite (each into its OWN fresh checkout):
//   (i)  MISSING SIBLING — publish a tampered dist (chamber.worker.js omitted) → the served
//        eds.js's `new Worker(new URL('./chamber.worker.js', …))` 404s → the worker cycle
//        never delivers → NO beacon. (Boot still sets window.airlock; the missing sibling
//        surfaces as absent egress — exactly the 404 the same-origin-sibling layout prevents.)
//   (ii) ADD-FROM-MAIN — `git subtree add … main` (airlock's SOURCE-project root) instead of
//        the dist ref → the served path has NO eds.js (it has build.mjs/core/…) → the boot
//        import 404s → window.__airlockBootFailed is set. This is the frame-critique's crux:
//        `--prefix` is the LOCAL path and the add pulls the ref's ROOT, so `main` delivers the
//        source project, not the artifacts — only the dist-rooted ref works.
//
// AC6 — CWV preserved (opt-in `WITH_CWV=1`, reusing the MVP5 lh-eds.mjs machinery): Lighthouse
//   OFF (server-substituted no-op eds.js) vs ON (the subtree-installed bundle) on the
//   subtree-installed page, asserted within the same tolerance band (TBT delta ≤ 50ms,
//   |CLS delta| ≤ 0.01). Kept opt-in so the default proof stays fast/non-flaky (see the slice's
//   deviation-log note).
//
// HERMETIC + airlock-repo-SAFE: every git write is in a throwaway temp/bare repo (hooks disabled);
// the airlock repo is only READ (build:dist output + HEAD sha via publishDist). Nothing is pushed
// to origin and no branch is created in the airlock repo.
//
// 031-02 (AC3) extends this rig IN-PLACE with the UPDATE path: `git subtree add` a `dist-vA` tag →
// `git subtree pull` a `dist-vB` tag with --squash → the served tree flips A→B (VERSION + workers
// replaced), the pull applies WITHOUT a conflict, and airlock re-boots (reusing probeBoot). Two more
// seeded breaks bite: a HAND-EDIT to the vendored tree makes the pull conflict (the merge-hostility
// ADR-0015 warns of), and a pull WITHOUT --squash is rejected (`unrelated histories`) — proving
// --squash is load-bearing (each release is an unrelated orphan root).
//
// Usage: npm run rig:subtree            (install boot+beacon + update re-land + all seeded breaks)
//        WITH_CWV=1 npm run rig:subtree (also the Lighthouse OFF/ON CWV arm — slower)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync, execSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { publishDist } from "../publish-dist.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(REPO, "dist");
// The served-path convention: where the subtree lands so an EDS site serves it same-origin,
// relative to the site's code base path (served root). Matches the testbed's scripts/airlock/.
const SERVED_PATH = "scripts/airlock";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};
// The exact EDS boilerplate CSP (no worker-src; require-trusted-types-for 'script') — proves boot
// under the retired-risk 004-01 envelope, exactly as the testbed rigs do.
const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";

// git with global hooks disabled (skip the machine's gitleaks/pre-commit hook on throwaway
// commits) + a fixed identity (throwaway repos have no user config) + a no-op editor (so a
// `git subtree pull` merge never blocks on an interactive editor in CI).
const git = (args, cwd) =>
  execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "core.editor=true", "-c", "user.email=airlock-rig@local", "-c", "user.name=airlock rig", ...args],
    { cwd, encoding: "utf8" },
  );

const cleanups = [];
const mktmp = (p) => {
  const d = mkdtempSync(join(tmpdir(), p));
  cleanups.push(d);
  return d;
};

// A minimal, aem-boilerplate-shaped clean EDS checkout that boots airlock with the TWO documented
// boot lines (import + await bootEdsAnalytics) — DISTINCT from probes/eds-testbed/. Returns its path.
function makeEdsCheckout() {
  const dir = mktmp("airlock-eds-site-");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(
    join(dir, "index.html"),
    `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="Content-Security-Policy" content="${BOILERPLATE_CSP}"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Clean EDS checkout — airlock subtree-install fixture</title>
    <script nonce="aem" src="/scripts/scripts.js" type="module"></script>
  </head>
  <body>
    <header></header>
    <main><div><h1>Clean EDS checkout</h1><p>Boots airlock from a git-subtree'd dist tree.</p></div></main>
    <footer></footer>
  </body>
</html>
`,
  );
  // The site's boot: set the code base path, then the TWO documented boot lines. This is exactly
  // the install snippet AC4's README pins — the doc must not drift from what this rig runs.
  writeFileSync(
    join(dir, "scripts", "scripts.js"),
    `window.hlx = { codeBasePath: '' };
// Realistic EDS under require-trusted-types-for 'script': a passthrough default policy (mirrors
// the testbed). Dynamic import() + Worker() are not TT sinks, so boot doesn't depend on it.
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    window.trustedTypes.createPolicy('default', { createHTML: (s) => s, createScript: (s) => s, createScriptURL: (s) => s });
  } catch (e) { /* already defined */ }
}
(async () => {
  try {
    const { bootEdsAnalytics } = await import(\`\${window.hlx.codeBasePath}/scripts/airlock/eds.js\`);
    await bootEdsAnalytics();
    window.__airlockBooted = true;
  } catch (e) {
    window.__airlockBootFailed = String(e);
  }
})();
`,
  );
  git(["init", "-q", "-b", "main"], dir);
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "clean EDS checkout (aem-boilerplate-shaped)"], dir);
  return dir;
}

// Static server for a checkout, CSP on every response. `noopEds` substitutes a no-op eds.js at the
// served entry (the CWV OFF arm — a real no-airlock control, per lh-eds.mjs).
const NOOP_EDS = "export function bootEdsAnalytics(){}\nexport default bootEdsAnalytics;\n";
const EDS_ENTRY = `/${SERVED_PATH}/eds.js`;
// `opts.noopEds` is read PER REQUEST (may be a getter) so the CWV arm can flip OFF/ON on one server.
async function serve(root, opts = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || "/").split("?")[0]);
      if (p === "/") p = "/index.html";
      if (opts.noopEds && p === EDS_ENTRY) {
        res.writeHead(200, { "content-type": "text/javascript", "content-security-policy": BOILERPLATE_CSP });
        return res.end(NOOP_EDS);
      }
      const file = join(root, normalize(p));
      if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file)] || "application/octet-stream",
        "content-security-policy": BOILERPLATE_CSP,
      });
      res.end(body);
    } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
  });
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port };
}

// Load the served checkout, wait for the boot to resolve either way, drive a WORKER-PATH push, and
// report what a real integrator would observe.
async function probeBoot(browser, port) {
  const page = await browser.newPage();
  let beacons = 0;
  await page.route("**/collect*", (route) => { beacons += 1; return route.fulfill({ status: 204, body: "" }); });
  const noise = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") noise.push(m.text()); });
  page.on("pageerror", (e) => noise.push("pageerror: " + String(e)));

  await page.goto(`http://localhost:${port}/index.html`);
  await page
    .waitForFunction(() => window.__airlockBooted === true || window.__airlockBootFailed !== undefined, { timeout: 20000 })
    .catch(() => {});
  // Worker-path egress: a steady-state push + flush must cycle through the same-origin sibling worker
  // (the ONLY path that needs the worker sibling present — so a missing sibling shows as no beacon).
  const pushed = await page.evaluate(() => {
    if (!window.airlock) return false;
    window.airlock.push({ event: "page_view", page_location: location.href });
    window.airlock.flushNow();
    return true;
  });
  await page.waitForTimeout(1200);
  const bootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);
  const hasAirlock = await page.evaluate(() => !!window.airlock);
  await page.close();
  return { bootFailed, hasAirlock, pushed, beaconFired: beacons > 0, noise };
}

// --- AC6: Lighthouse OFF/ON on the subtree-installed page (opt-in; reuses lh-eds.mjs's method). ---
async function cwvArm(root) {
  const { launch } = await import("chrome-launcher");
  const lighthouse = (await import("lighthouse")).default;
  const N = Number(process.env.LH_N || 3);
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  let armMode = "off";
  const { server, port } = await serve(root, { get noopEds() { return armMode === "off"; } });
  const url = `http://localhost:${port}/index.html`;
  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
  const runOne = async () => {
    const res = await lighthouse(url, { port: chrome.port, onlyCategories: ["performance"], formFactor: "desktop", screenEmulation: { disabled: true } });
    const a = res.lhr.audits;
    return { TBT_ms: Math.round(a["total-blocking-time"].numericValue), CLS: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)) };
  };
  const off = [], on = [];
  for (let i = 0; i < N; i++) { armMode = "off"; off.push(await runOne()); armMode = "on"; on.push(await runOne()); }
  await chrome.kill();
  server.close();

  const tbtDelta = median(on.map((r) => r.TBT_ms)) - median(off.map((r) => r.TBT_ms));
  const clsDelta = Number((median(on.map((r) => r.CLS)) - median(off.map((r) => r.CLS))).toFixed(3));
  const withinBand = tbtDelta <= 50 && Math.abs(clsDelta) <= 0.01;
  return { lh_n: N, tbt_delta_ms: tbtDelta, cls_delta: clsDelta, within_band: withinBand, band: "TBT delta <= 50ms AND |CLS delta| <= 0.01" };
}

// --- 031-02 AC3: the UPDATE path — subtree add dist-vA → subtree pull dist-vB → clean re-land. ---
// Two INJECTED release versions (never the real pkg.version) so the A→B marker flip is unambiguous
// and hermetic. B's tree carries a distinguishing marker in a worker so "workers replaced" is
// byte-observable after the pull (not just a VERSION-file swap).
const VER_A = "9.9.9";
const VER_B = "9.9.10";
const B_WORKER_MARK = "//__airlock_dist_vB__"; // a harmless trailing comment (valid JS; boot-safe)

// Publish A (the real built DIST) and B (a copy of DIST with the B marker appended to a worker) as
// `dist-vA` / `dist-vB` RELEASE tags in a fresh bare repo, then exercise three arms into their OWN
// fresh EDS checkouts:
//   (clean)     add dist-vA → pull dist-vB --squash → VERSION flips A→B, workers replaced, no
//               conflict, airlock re-boots (boot + beacon, reusing probeBoot). The disciplined path.
//   (hand-edit) add dist-vA → HAND-EDIT the vendored tree → pull dist-vB --squash → CONFLICT. The
//               un-disciplined path the doc warns against (a generated bundle is merge-hostile).
//   (no-squash) add dist-vA → pull dist-vB WITHOUT --squash → `refusing to merge unrelated
//               histories`. Proves --squash is LOAD-BEARING (each release is an unrelated orphan root).
async function updatePathArms(browser) {
  const originRel = join(mktmp("airlock-remote-release-"), "origin.git");
  git(["init", "-q", "--bare", originRel], REPO);

  const relA = await publishDist({ distDir: DIST, target: originRel, release: true, version: VER_A });
  const distB = mktmp("airlock-dist-vb-");
  cpSync(DIST, distB, { recursive: true });
  appendFileSync(join(distB, "chamber.worker.js"), `\n${B_WORKER_MARK}\n`);
  const relB = await publishDist({ distDir: distB, target: originRel, release: true, version: VER_B });
  const tagA = relA.tag; // dist-v9.9.9
  const tagB = relB.tag; // dist-v9.9.10

  const workerPath = (co) => join(co, SERVED_PATH, "chamber.worker.js");
  const versionAt = (co) => readFileSync(join(co, SERVED_PATH, "VERSION"), "utf8").trim();
  const workerHasBMark = (co) => existsSync(workerPath(co)) && readFileSync(workerPath(co), "utf8").includes(B_WORKER_MARK);
  const addA = (co) => git(["subtree", "add", "--prefix", SERVED_PATH, originRel, tagA, "--squash", "-q"], co);
  const pullB = (co, squash) =>
    git(["subtree", "pull", "--prefix", SERVED_PATH, originRel, tagB, ...(squash ? ["--squash"] : []), "-q", "-m", "update airlock A→B"], co);

  // ARM: clean update A→B (the disciplined path).
  const clean = makeEdsCheckout();
  addA(clean);
  const before = { version: versionAt(clean), workerHasBMark: workerHasBMark(clean) };
  let cleanPullFailed = false;
  try { pullB(clean, true); } catch { cleanPullFailed = true; }
  const after = { version: versionAt(clean), workerHasBMark: workerHasBMark(clean) };
  const s = await serve(clean);
  const boot = await probeBoot(browser, s.port);
  s.server.close();

  // ARM: hand-edit the vendored tree before pulling → conflict (the un-disciplined path).
  const edited = makeEdsCheckout();
  addA(edited);
  appendFileSync(workerPath(edited), "\n// LOCAL HAND EDIT — never do this to a generated release\n");
  git(["add", "-A"], edited);
  git(["commit", "-q", "-m", "hand-edit the vendored airlock tree (anti-pattern)"], edited);
  let handEditConflict = false;
  try { pullB(edited, true); } catch { handEditConflict = true; }
  let unmerged = "";
  try { unmerged = git(["status", "--porcelain"], edited).trim(); } catch { /* best effort */ }

  // ARM: pull WITHOUT --squash → unrelated-histories rejection (--squash is load-bearing).
  const nosquash = makeEdsCheckout();
  addA(nosquash);
  let nonSquashRejected = false;
  let nonSquashReason = "";
  try { pullB(nosquash, false); } catch (e) { nonSquashRejected = true; nonSquashReason = String((e && (e.stderr || e.message)) || ""); }

  return {
    tag_a: tagA,
    tag_b: tagB,
    update_command: `git subtree pull --prefix ${SERVED_PATH} <airlock-remote> ${tagB} --squash`,
    clean: {
      version_before: before.version,
      version_after: after.version,
      version_flipped: before.version === `airlockjs v${VER_A}` && after.version === `airlockjs v${VER_B}`,
      worker_had_b_mark_before: before.workerHasBMark,
      worker_has_b_mark_after: after.workerHasBMark,
      workers_replaced: before.workerHasBMark === false && after.workerHasBMark === true,
      pull_applied_without_conflict: cleanPullFailed === false,
      ...boot,
    },
    // hand_edit: assert the throw is a real MERGE CONFLICT (a `UU` unmerged entry), not just any error.
    hand_edit: { conflict_surfaced: handEditConflict, unmerged, is_merge_conflict: /(^|\n)UU /.test(unmerged) },
    // no_squash: assert the throw is specifically the unrelated-histories rejection (the mechanism the
    // README promises), not any error — pins WHY --squash is load-bearing.
    no_squash: { rejected: nonSquashRejected, unrelated_histories: /refusing to merge unrelated histories/i.test(nonSquashReason) },
  };
}

async function main() {
  // (a) Build the first-class distributable (self-asserts the same-origin-file-worker layout, AC3).
  execSync("npm run build:dist", { cwd: REPO, stdio: "inherit" });
  if (!existsSync(join(DIST, "eds.js"))) throw new Error("build:dist produced no dist/eds.js");

  // (b) Publish the dist-rooted ref into a local BARE repo, and stage airlock's SOURCE root as `main`
  //     in the same repo (for the add-from-main break — the real "naive subtree add" a consumer might try).
  const originGood = join(mktmp("airlock-remote-good-"), "origin.git");
  git(["init", "-q", "--bare", originGood], REPO);
  const published = await publishDist({ distDir: DIST, target: originGood, ref: "dist" });

  const mainStage = mktmp("airlock-source-main-");
  for (const p of ["build.mjs", "package.json"]) cpSync(join(REPO, p), join(mainStage, p));
  cpSync(join(REPO, "core"), join(mainStage, "core"), { recursive: true }); // recognizably the source project — and NO eds.js at root
  git(["init", "-q"], mainStage);
  git(["add", "-A"], mainStage);
  git(["commit", "-q", "-m", "airlock source project root (no eds.js)"], mainStage);
  git(["push", "--force", originGood, "HEAD:refs/heads/main"], mainStage);

  // A separate bare repo carrying a TAMPERED dist (chamber.worker.js omitted) for break (i).
  const originBroken = join(mktmp("airlock-remote-broken-"), "origin.git");
  git(["init", "-q", "--bare", originBroken], REPO);
  const tampered = mktmp("airlock-dist-tampered-");
  cpSync(DIST, tampered, { recursive: true });
  rmSync(join(tampered, "chamber.worker.js"), { force: true }); // drop the DEFAULT GA4 worker sibling
  await publishDist({ distDir: tampered, target: originBroken, ref: "dist" });

  const browser = await chromium.launch();
  const arms = {};
  let cwv = null;
  let update; // assigned unconditionally in the try below, before the verdict reads it
  try {
    // --- HAPPY PATH: subtree add the dist ref → boot + beacon. ---
    const happyCheckout = makeEdsCheckout();
    git(["subtree", "add", "--prefix", SERVED_PATH, originGood, "dist", "--squash", "-q"], happyCheckout);
    const happyServed = existsSync(join(happyCheckout, SERVED_PATH, "eds.js"));
    let s = await serve(happyCheckout);
    arms.happy = { subtree_ref: "dist", served_eds_present: happyServed, ...(await probeBoot(browser, s.port)) };
    s.server.close();

    // --- BREAK (i): MISSING SIBLING → 404 → no worker-path beacon. ---
    const brokenCheckout = makeEdsCheckout();
    git(["subtree", "add", "--prefix", SERVED_PATH, originBroken, "dist", "--squash", "-q"], brokenCheckout);
    const missingSibling = !existsSync(join(brokenCheckout, SERVED_PATH, "chamber.worker.js"));
    s = await serve(brokenCheckout);
    arms.break_missing_sibling = { subtree_ref: "dist (tampered)", chamber_worker_absent: missingSibling, ...(await probeBoot(browser, s.port)) };
    s.server.close();

    // --- BREAK (ii): ADD-FROM-MAIN (source root) → no eds.js → boot import 404s. ---
    const mainCheckout = makeEdsCheckout();
    git(["subtree", "add", "--prefix", SERVED_PATH, originGood, "main", "--squash", "-q"], mainCheckout);
    const edsAbsentFromMain = !existsSync(join(mainCheckout, SERVED_PATH, "eds.js"));
    s = await serve(mainCheckout);
    arms.break_add_from_main = { subtree_ref: "main", served_eds_present: !edsAbsentFromMain, ...(await probeBoot(browser, s.port)) };
    s.server.close();

    // --- 031-02 AC3: the UPDATE path — subtree add dist-vA → pull dist-vB → clean re-land, plus the
    //     seeded hand-edit conflict + the non-squash rejection (both RED). ---
    update = await updatePathArms(browser);

    // --- AC6: CWV preserved on the subtree-installed page (opt-in). ---
    if (process.env.WITH_CWV) cwv = await cwvArm(happyCheckout);
  } finally {
    await browser.close();
    for (const d of cleanups) rmSync(d, { recursive: true, force: true });
  }

  // Verdict: happy boots + beacons; break (i) is RED (no beacon — missing sibling); break (ii) is
  // RED (boot fails — no eds.js at the served path). A break that did NOT go red means the mechanism
  // isn't actually enforced → rig fails.
  const happyOk = arms.happy.served_eds_present && arms.happy.hasAirlock && arms.happy.bootFailed === null && arms.happy.beaconFired;
  const breakMissingRed = arms.break_missing_sibling.chamber_worker_absent && arms.break_missing_sibling.beaconFired === false;
  const breakFromMainRed = !arms.break_add_from_main.served_eds_present && arms.break_add_from_main.bootFailed !== null;
  const cwvOk = cwv === null ? true : cwv.within_band;
  // 031-02 AC3: the disciplined update re-lands cleanly (VERSION flips A→B, workers replaced, no
  // conflict, airlock re-boots); the two seeded breaks (hand-edit conflict, non-squash rejection)
  // both go RED. A break that did NOT go red means the merge-hostility guard isn't real → rig fails.
  const updateCleanOk =
    update.clean.version_flipped &&
    update.clean.workers_replaced &&
    update.clean.pull_applied_without_conflict &&
    update.clean.hasAirlock &&
    update.clean.bootFailed === null &&
    update.clean.beaconFired;
  const updateHandEditRed = update.hand_edit.conflict_surfaced === true && update.hand_edit.is_merge_conflict === true;
  const updateNonSquashRed = update.no_squash.rejected === true && update.no_squash.unrelated_histories === true;
  const pass =
    happyOk && breakMissingRed && breakFromMainRed && cwvOk && updateCleanOk && updateHandEditRed && updateNonSquashRed;

  const out = {
    question:
      "does publishing a dist-rooted ref, `git subtree add`-ing it into a CLEAN EDS checkout, and serving it same-origin boot airlock (beacon fires, CWV preserved) — and does a `git subtree pull` of a newer dist-vX.Y.Z tag re-land cleanly (VERSION flips, workers replaced, re-boots) — and do all the seeded breaks go red?",
    pass,
    served_path_convention: SERVED_PATH,
    published_ref: published.ref,
    published_version: published.version,
    install_command: `git subtree add --prefix ${SERVED_PATH} <airlock-remote> dist --squash`,
    happy_path_ok: happyOk,
    break_missing_sibling_red: breakMissingRed,
    break_add_from_main_red: breakFromMainRed,
    update_command: update.update_command,
    update_path_clean_ok: updateCleanOk,
    update_hand_edit_conflict_red: updateHandEditRed,
    update_non_squash_rejected_red: updateNonSquashRed,
    cwv_within_band: cwv === null ? "not run (set WITH_CWV=1)" : cwv.within_band,
    cwv,
    arms,
    update,
    verdict: pass
      ? "PASS — a dist-rooted subtree add boots airlock same-origin on a clean EDS checkout (beacon fires" +
        (cwv ? ", CWV within band" : "; CWV arm opt-in") + "); the missing-sibling and add-from-main breaks both went red; " +
        "and the update path re-lands cleanly (dist-vA→dist-vB: VERSION flips, workers replaced, re-boots) with the " +
        "hand-edit-conflict and non-squash-rejection breaks both red"
      : "FAIL — see arms/flags above",
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  for (const d of cleanups) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  console.error("rig:subtree FAILED:", e);
  process.exit(1);
});
