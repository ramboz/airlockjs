// Spec 013-02 — egress-breadth fan-out (LIVE, real-DOM main-thread reference run).
//
// The 012 chamber is a no-DOM worker: the classic demdex/AAM partner-sync surface is
// a DOM-injected <img> pixel the chamber's shim SWALLOWS invisibly, so a chamber-only
// run structurally under-counts (013-02 frame-critique). This rig runs stock alloy on
// a REAL DOM main thread (real document + Image()), renderDecisions:true, against the
// REAL Edge, and captures EVERY outbound request via Playwright — the true fan-out.
//
// Then it classifies each captured egress by how the CHAMBER would treat it:
//   - confined       : fetch/xhr → alloy's mediated fetch → orchestrator dispatch
//   - shim-swallowed  : an <img>/beacon DOM pixel the no-DOM chamber silently drops
//                       (NOT egressed, but NOT confined — a false-negative risk)
//   - escaped         : any other path the allow-list posture would miss
// and enumerates the egress ORIGIN set + roster stability across two runs (AC3).
//
// AC4 validity floor: a fresh test org typically has ~zero AAM third-party
// destinations, so a null/small 3rd-party fan-out is recorded as a LOWER BOUND /
// test-org artifact — NEVER as evidence of narrow egress. No identifiers committed
// (URLs redacted; raw capture gitignored).
//
// Usage: ALLOY_DATASTREAM_ID=… ALLOY_ORG_ID=… node rig/alloy-live-fanout.mjs
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-live-fanout.json");     // gitignored
const RAW = join(ROOT, "rig/out/alloy-live-fanout.raw.json"); // gitignored — full URLs
const FIXTURE = join(ROOT, "test/fixtures/alloy-live-fanout.redacted.json"); // COMMITTED — redacted

const DATASTREAM_ID = process.env.ALLOY_DATASTREAM_ID;
const ORG_ID = process.env.ALLOY_ORG_ID;
if (!DATASTREAM_ID || !ORG_ID) {
  console.error("FAIL — creds-gated capture. Set ALLOY_DATASTREAM_ID + ALLOY_ORG_ID (source .env, gitignored).");
  process.exit(2);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };

await mkdir(dirname(OUT), { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/__live_config__") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ datastreamId: DATASTREAM_ID, orgId: ORG_ID }));
    }
    if (p === "/") p = "/rig/alloy-live-fanout-harness.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const ORIGIN = `http://localhost:${port}`;

// How the no-DOM chamber would treat an egress of this Playwright resourceType.
function chamberDisposition(resourceType) {
  if (resourceType === "fetch" || resourceType === "xhr") return "confined";       // alloy's mediated fetch
  if (resourceType === "image") return "shim-swallowed";                            // DOM <img> pixel, dropped
  if (resourceType === "beacon" || resourceType === "ping") return "escaped";       // navigator.sendBeacon path
  return "escaped";                                                                 // script/other/redirect
}

const browser = await chromium.launch();
async function runOnce() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const egress = []; // { origin, host, resourceType, method, disposition }
  page.on("request", (r) => {
    let u;
    try { u = new URL(r.url()); } catch (e) { return; }
    if (u.origin === ORIGIN) return; // skip same-origin harness/bundle/config traffic
    egress.push({ url: r.url(), origin: u.origin, host: u.host, resourceType: r.resourceType(), method: r.method(), disposition: chamberDisposition(r.resourceType()) });
  });
  let result = null, pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  try {
    await page.goto(`${ORIGIN}/rig/alloy-live-fanout-harness.html`);
    await page.waitForFunction(() => window.__FANOUT_RESULT__ !== undefined, { timeout: 45000 });
    // let server-directed syncs (img pixels, follow-ups) settle
    try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch (e) {}
    await page.waitForTimeout(2500);
    result = await page.evaluate(() => window.__FANOUT_RESULT__);
  } finally {
    await context.close();
  }
  return { result, egress, pageErrors };
}

let runA, runB;
try {
  runA = await runOnce();
  runB = await runOnce(); // roster stability (AC3)
} finally {
  await browser.close();
  server.close();
}

// Gate on boot success: a run where alloy did NOT boot/send must fail LOUD, never write a
// committed fixture — otherwise a broken run (empty egress) masquerades as a zero-fanout
// "lower bound" (013-02 craft review). The affirmative signal is boot_ok + ≥1 confined POST.
const bootOk = runA.result && runA.result.ok === true;
if (!bootOk) {
  await writeFile(RAW, JSON.stringify({ runA, runB }, null, 2)).catch(() => {});
  console.log(JSON.stringify({
    pass: false,
    verdict: "FAIL — alloy did not boot/send on the real DOM (boot_ok=false): " +
      ((runA.result && runA.result.error) || "unknown") +
      ". No fixture written — a broken run must not masquerade as a zero-fanout lower bound.",
    page_errors: runA.pageErrors,
  }, null, 2));
  process.exit(1);
}

// ---- enumerate the egress origin set (AC1 + AC3) ----
function originSet(egress) { return [...new Set(egress.map((e) => e.origin))].sort(); }
const originsA = originSet(runA.egress);
const originsB = originSet(runB.egress);
const rosterStable = JSON.stringify(originsA) === JSON.stringify(originsB);

// per-origin: purpose (host) + how the chamber would dispose of it
const byOrigin = {};
for (const e of runA.egress) {
  const o = (byOrigin[e.origin] = byOrigin[e.origin] || { host: e.host, resourceTypes: new Set(), methods: new Set(), dispositions: new Set(), count: 0 });
  o.resourceTypes.add(e.resourceType); o.methods.add(e.method); o.dispositions.add(e.disposition); o.count++;
}
const originTable = Object.entries(byOrigin).map(([origin, o]) => ({
  origin, host: o.host, count: o.count,
  resourceTypes: [...o.resourceTypes], methods: [...o.methods], chamberDisposition: [...o.dispositions],
}));

// ---- third-party (non-Adobe-first-party) fan-out (AC4 validity floor) ----
const ADOBE_HOST = /(^|\.)(demdex\.net|omtrdc\.net|adobedc\.net|2o7\.net|everesttech\.net|adobe\.com)$/i;
const thirdPartyOrigins = originTable.filter((o) => !ADOBE_HOST.test(new URL(o.origin).hostname));
const dispositions = { confined: 0, "shim-swallowed": 0, escaped: 0 };
for (const e of runA.egress) dispositions[e.disposition] = (dispositions[e.disposition] || 0) + 1;
const swallowed = originTable.filter((o) => o.chamberDisposition.includes("shim-swallowed"));

// ---- redact for the committed fixture: origins/hosts + shape only, no full URLs ----
function redactHost(host) {
  // keep the registrable-ish host for shape; scrub any embedded id (defensive)
  let h = host;
  for (const sec of [DATASTREAM_ID, ORG_ID, ORG_ID.split("@")[0]]) if (sec) h = h.split(sec).join("REDACTED");
  return h;
}
const fixture = {
  _comment: "Spec 013-02: the real-DOM main-thread reference-run egress ORIGIN set (hosts + " +
    "how the no-DOM chamber would dispose of each: confined / shim-swallowed / escaped). No full " +
    "URLs, no identifiers — origins + shape only. See slice 013-02 Findings for the verdict.",
  origin_set: originTable.map((o) => ({ host: redactHost(o.host), count: o.count, resourceTypes: o.resourceTypes, methods: o.methods, chamberDisposition: o.chamberDisposition })),
  roster_stable_across_two_runs: rosterStable,
  chamber_disposition_totals: dispositions,
};

// belt-and-suspenders: no enumerated secret in the committed fixture
const secrets = [DATASTREAM_ID, ORG_ID, ORG_ID.split("@")[0]].filter(Boolean);
const fxStr = JSON.stringify(fixture);
const leaked = secrets.filter((s) => fxStr.includes(s));
if (leaked.length > 0) { console.log(JSON.stringify({ pass: false, verdict: "FAIL — redaction leak", leakedCount: leaked.length })); process.exit(1); }

await mkdir(dirname(FIXTURE), { recursive: true });
await writeFile(FIXTURE, JSON.stringify(fixture, null, 2));
await writeFile(RAW, JSON.stringify({ runA, runB }, null, 2)); // gitignored (full URLs)

const out = {
  question: "What is real Alloy's true egress breadth on a real DOM, and for each origin — confined (mediated fetch) / shim-swallowed (DOM <img>) / escaped? Is the origin set bounded + stable (authoritative-at-origin ceiling possible) or rotating (FLOOR)?",
  boot_ok: runA.result && runA.result.ok === true,
  boot_error: runA.result && runA.result.error,
  origin_set: originTable,
  origin_count: originTable.length,
  third_party_origin_count: thirdPartyOrigins.length,
  third_party_origins: thirdPartyOrigins.map((o) => o.host),
  roster_stable_across_two_runs: rosterStable,
  chamber_disposition_totals: dispositions,
  shim_swallowed_origins: swallowed.map((o) => o.host),
  page_errors: [...new Set([...(runA.pageErrors || []), ...(runB.pageErrors || [])])],
  validity_floor: thirdPartyOrigins.length === 0
    ? "LOWER BOUND — zero third-party (non-Adobe) fan-out fired. This is a TEST-ORG-CONFIG artifact (no AAM third-party destinations provisioned), NOT evidence of narrow egress. The enforcement design MUST NOT read this count as ceiling cardinality (R-004/012-04 flag the single-host result as 'a probe artifact, not evidence of narrowness')."
    : "third-party fan-out OBSERVED — see third_party_origins; still a lower bound on production breadth.",
  fixture: "test/fixtures/alloy-live-fanout.redacted.json",
  redaction_leak_check: leaked.length === 0 ? "clean" : "LEAK",
};
await writeFile(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(0);
