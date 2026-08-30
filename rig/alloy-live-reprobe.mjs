// Spec 013-01 — real Edge round-trip + mint-recognizability (LIVE).
//
// The MVP3 Risk-First lead. Boots the SAME stock @adobe/alloy@2.35.0 Option-B
// chamber as 012-01 (rig/alloy-chamber.mjs), but pointed at a REAL Adobe Edge
// datastream (creds from env: ALLOY_DATASTREAM_ID / ALLOY_ORG_ID; see .env,
// gitignored). alloy's worker-side interact fetch is INTERCEPTED in the chamber
// and dispatched on MAIN (ADR-0004); this node rig PROXIES /ee/v1/interact to the
// real Edge and CAPTURES the real request + response there.
//
// AC1: a real server-assigned ECID returns and round-trips into the jar.
// AC2 (kill-criterion evidence, decoupled from standing creds): the captured real
//   request + response are run through the EXISTING pure recognizer/extractor
//   (rig/alloy-xdm-mint.js), then REDACTED (identifier VALUES scrubbed, SHAPE
//   preserved) and written to test/fixtures/alloy-live-interact.redacted.json as a
//   durable creds-free regression (test/alloy-live-mint-recognizability.test.js).
// AC4: a CONFIRMED / FAILED kill-criterion verdict is emitted.
//
// No live identifiers are written to any committed file: the raw capture goes to
// rig/out/ (gitignored); only the REDACTED fixture is committed. Redaction is
// structural (sensitive keys) + a belt-and-suspenders exact-substring scrub of the
// known secrets (datastream / org / minted ECID / requestIds / cookie values).
//
// Usage: ALLOY_DATASTREAM_ID=… ALLOY_ORG_ID=… node rig/alloy-live-reprobe.mjs
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { recognizeInteract, extractEcidFromInteractResponse } from "../connectors/alloy/xdm-mint.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/alloy-live-reprobe.json"); // gitignored
const RAW = join(ROOT, "rig/out/alloy-live-capture.raw.json"); // gitignored — real ids
const FIXTURE = join(ROOT, "test/fixtures/alloy-live-interact.redacted.json"); // COMMITTED — must be redacted
const WORKER_SRC = join(ROOT, "connectors/alloy/alloy-chamber.worker.js");
const WORKER_BUILT = join(ROOT, "rig/out/alloy-live.worker.built.js");
const REAL_EDGE = "https://adobedc.demdex.net";

const DATASTREAM_ID = process.env.ALLOY_DATASTREAM_ID;
const ORG_ID = process.env.ALLOY_ORG_ID;
if (!DATASTREAM_ID || !ORG_ID) {
  console.error(
    "FAIL — live-traffic AC is creds-gated. Set ALLOY_DATASTREAM_ID + ALLOY_ORG_ID " +
    "(source .env, gitignored). Drafting/replay are creds-free; the live capture is not.");
  process.exit(2);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };
function fail(verdict, extra = {}) { console.log(JSON.stringify({ pass: false, verdict, ...extra }, null, 2)); process.exit(1); }

await mkdir(dirname(OUT), { recursive: true });

// Build the classic-worker chamber (esbuild -> IIFE), REUSING 012-01's worker verbatim.
await build({ entryPoints: [WORKER_SRC], outfile: WORKER_BUILT, bundle: true, format: "iife", platform: "browser", target: "es2022" });

// --- the real-Edge proxy capture store ---
const captured = []; // { url, reqBody, status, respBody }

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    const search = (req.url || "").split("?")[1] || "";

    // Host-owned alloy config (creds from env; NEVER committed to the harness).
    if (p === "/__live_config__") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ datastreamId: DATASTREAM_ID, orgId: ORG_ID, context: [], debugEnabled: true }));
    }

    // AC1: PROXY alloy's interact to the REAL Edge and capture req + response.
    if (req.method === "POST" && p === "/ee/v1/interact") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const reqBody = Buffer.concat(chunks).toString("utf8");
      const target = REAL_EDGE + "/ee/v1/interact" + (search ? "?" + search : "");
      let status = 0, respBody = "";
      try {
        const edgeRes = await fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: reqBody });
        status = edgeRes.status;
        respBody = await edgeRes.text();
      } catch (err) {
        respBody = JSON.stringify({ __proxy_error__: String(err) });
      }
      captured.push({ url: target, reqBody, status, respBody });
      res.writeHead(status || 502, { "content-type": "application/json" });
      return res.end(respBody);
    }

    if (p === "/") p = "/rig/alloy-live-harness.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// --- boot the chamber against real Edge ---
const browser = await chromium.launch();
let result = null, pageErrors = [], evalError = null;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`http://localhost:${port}/rig/alloy-live-harness.html`);
  await page.waitForFunction(() => window.__ALLOY_LIVE_RESULT__ !== undefined, { timeout: 45000 });
  result = await page.evaluate(() => window.__ALLOY_LIVE_RESULT__);
  await context.close();
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — live rig error: " + evalError.message, { pageErrors });
if (!result) fail("FAIL — no result captured", { pageErrors });
if (result.fatal || result.workerError) fail("FAIL — chamber fatal: " + (result.fatal || result.workerError), { result, pageErrors });
if (captured.length === 0) fail("FAIL — no interact reached the real-Edge proxy (alloy did not send?)", { result, pageErrors });

// --- the interact round-trip: recognize (request) + extract (response) ---
const interact = captured.find((c) => /\/ee\/v1\/interact/.test(c.url)) || captured[0];
let reqObj = null, respObj = null, parseErr = null;
try { reqObj = JSON.parse(interact.reqBody); } catch (e) { parseErr = "request: " + e.message; }
try { respObj = JSON.parse(interact.respBody); } catch (e) { parseErr = (parseErr ? parseErr + "; " : "") + "response: " + e.message; }

const rec = recognizeInteract({ url: interact.url, body: interact.reqBody });
const liveEcid = respObj ? extractEcidFromInteractResponse(respObj) : null;
const identityHandle = respObj && Array.isArray(respObj.handle)
  ? respObj.handle.find((h) => h && h.type === "identity:result") : null;
const hasEcidNamespace = !!identityHandle && (identityHandle.payload || []).some((e) => e && e.namespace && e.namespace.code === "ECID");

// jar round-trip (AC1): the broker reconciled a set-cookie into this page's jar.
const jarHasIdentity = Array.isArray(result.writeBacks) && result.writeBacks.some((w) => /AMCV_|kndctr_|MCMID/.test(String(w)));

// ---- AC4 kill-criterion verdict ----
const requestRecognizedAsMint = rec.isMint === true;         // request side (re-confirmed live)
const responseYieldsEcid = typeof liveEcid === "string" && liveEcid.length > 0 && hasEcidNamespace; // response side (the new probe)
const edgeOk = interact.status >= 200 && interact.status < 300;
const CONFIRMED = edgeOk && requestRecognizedAsMint && responseYieldsEcid;
const verdictLabel = CONFIRMED ? "CONFIRMED" : "FAILED";

// ---- redaction: DENY-BY-DEFAULT + belt-and-suspenders exact-substring scrub ----
// A key-ALLOWLIST (013-01 review) let server-ASSIGNED values (Target eventToken /
// correlationID) survive — no enumerated-secret scan can catch what it doesn't know.
// Invert to deny-by-default: every captured leaf STRING is redacted UNLESS its key is
// a curated SHAPE token (or it is an element of a known shape array). A new/unknown key
// in a future capture defaults to REDACTED, so no identifier can leak by omission.
const KEEP_VALUE_KEYS = new Set([
  "type", "code", "eventType", "schema", "name", "version", "environment",
  "step", "trafficType", "scope", "decisionProvider",
]);
const KEEP_ARRAY_KEYS = new Set(["fetch", "schemas", "decisionScopes", "surfaces"]);

function redactByDefault(node, keyHint, inKeptArray) {
  if (Array.isArray(node)) {
    const keep = KEEP_ARRAY_KEYS.has(keyHint);
    return node.map((x) => redactByDefault(x, keyHint, keep));
  }
  if (node && typeof node === "object") {
    // namespace-aware `id` placeholder: an identity handle's ECID id -> REDACTED_ECID
    // (vs REDACTED_CORE), so the extractor test can prove it selected the ECID entry,
    // not merely that it returned a truthy value.
    const nsCode = node.namespace && typeof node.namespace.code === "string" ? node.namespace.code : null;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "id" && typeof v === "string") { out[k] = nsCode ? "REDACTED_" + nsCode : "REDACTED"; continue; }
      out[k] = redactByDefault(v, k, false);
    }
    return out;
  }
  if (typeof node === "string") {
    if (inKeptArray) return node;                  // element of a known shape array
    if (KEEP_VALUE_KEYS.has(keyHint)) return node; // a curated shape token
    return "REDACTED";                             // default: redact
  }
  return node; // numbers / booleans / null are never identifiers
}

// The exact-substring scrub is a BACKSTOP over the deny-by-default pass: it covers the
// enumerated INPUT secrets AND every server-assigned id-like value harvested from the
// raw capture, so the leak assertion is OPEN-set (catches server-assigned), not closed.
const reqIds = new Set();
for (const c of captured) { const m = /[?&]requestId=([^&]+)/.exec(c.url); if (m) reqIds.add(decodeURIComponent(m[1])); }
try { if (respObj && respObj.requestId) reqIds.add(respObj.requestId); } catch (e) {}
// The org id also appears TRANSFORMED (@ -> _) inside kndctr_<orgNum>_AdobeOrg_* cookie
// keys, so scrub the bare org-numeric prefix too, not just "<num>@AdobeOrg".
const orgNumeric = ORG_ID.split("@")[0];
const serverAssigned = new Set();
(function harvest(node) {
  if (Array.isArray(node)) return void node.forEach(harvest);
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string" && /^(id|value|eventToken|correlationID|tntId|namespaceId)$/.test(k) && v.length > 3) serverAssigned.add(v);
      else harvest(v);
    }
  }
})({ req: reqObj, resp: respObj });
const secrets = [DATASTREAM_ID, ORG_ID, orgNumeric, liveEcid, ...reqIds, ...serverAssigned]
  .filter((s) => typeof s === "string" && s.length > 0)
  .sort((a, b) => b.length - a.length); // scrub longest first (org id before org-numeric)

function substringScrub(str) {
  let s = str;
  for (const sec of secrets) s = s.split(sec).join("REDACTED");
  return s;
}
function redactObj(obj) {
  return JSON.parse(substringScrub(JSON.stringify(redactByDefault(obj, null, false))));
}

const redactedReq = reqObj ? redactObj(reqObj) : { __unparseable__: true };
const redactedResp = respObj ? redactObj(respObj) : { __unparseable__: true };
// redact the URL (configId + requestId live in the query string)
let redactedUrl = interact.url;
try {
  const u = new URL(interact.url);
  if (u.searchParams.has("configId")) u.searchParams.set("configId", "REDACTED");
  if (u.searchParams.has("requestId")) u.searchParams.set("requestId", "REDACTED");
  redactedUrl = substringScrub(u.toString());
} catch (e) { redactedUrl = substringScrub(interact.url); }

const fixture = {
  _comment: "Spec 013-01: a REAL Adobe Edge interact capture, DENY-BY-DEFAULT redacted (every captured value " +
    "scrubbed except a curated set of shape tokens; identity ids tagged REDACTED_<namespace>). Durable creds-free " +
    "regression for ADR-0008's mint-recognizability kill-criterion — replayed by " +
    "test/alloy-live-mint-recognizability.test.js against rig/alloy-xdm-mint.js. No live identifiers here.",
  request: { url: redactedUrl, body: redactedReq },
  response: redactedResp,
};

// belt-and-suspenders: assert no known secret survived into the committed fixture
const fixtureStr = JSON.stringify(fixture);
const leaked = secrets.filter((s) => fixtureStr.includes(s));
if (leaked.length > 0) fail("FAIL — redaction leak: a real identifier survived into the fixture", { leakedCount: leaked.length });

await mkdir(dirname(FIXTURE), { recursive: true });
// Only overwrite the durable committed fixture on a CONFIRMED capture — a FAILED /
// unparseable re-probe must not silently clobber the good regression fixture.
if (CONFIRMED) await writeFile(FIXTURE, JSON.stringify(fixture, null, 2));
await writeFile(RAW, JSON.stringify({ interact, result }, null, 2)); // gitignored raw (real ids)

const out = {
  question: "Does stock alloy's REAL interact round-trip (real server-assigned ECID, real response shape) satisfy ADR-0008's mint-recognizability kill-criterion — request recognized as a coalescable ECID first-mint AND the real response's identity handle extractable by the same path?",
  pass: CONFIRMED,
  kill_criterion_verdict: verdictLabel,
  edge_status: interact.status,
  request_side: {
    recognized_as_mint: requestRecognizedAsMint,
    reason: rec.reason,
    namespace: rec.namespace,
    xdm_shape: reqObj ? { eventType: reqObj?.events?.[0]?.xdm?.eventType, identityFetch: reqObj?.query?.identity?.fetch } : null,
  },
  response_side: {
    yields_ecid: responseYieldsEcid,
    ecid_present: typeof liveEcid === "string" && liveEcid.length > 0,
    has_identity_result_ecid_namespace: hasEcidNamespace,
    handle_types: respObj && Array.isArray(respObj.handle) ? respObj.handle.map((h) => h && h.type) : null,
  },
  jar_round_trip: jarHasIdentity,
  parse_error: parseErr,
  fixture: "test/fixtures/alloy-live-interact.redacted.json",
  redaction_leak_check: leaked.length === 0 ? "clean" : "LEAK",
  verdict: CONFIRMED
    ? "CONFIRMED — real Alloy's live interact is recognized as a coalescable ECID first-mint AND the real Edge response's identity handle is extractable by the same path (rig/alloy-xdm-mint.js). ADR-0008's mint-recognizability kill-criterion holds against live Alloy; the contract-freeze mint-axis is cleared (necessary, not sufficient — 013-02/03 remain)."
    : "FAILED — see request_side / response_side; the kill-criterion did NOT hold live (→ host-seeded-identity fallback per ADR-0008). This is a valid spike outcome, recorded honestly.",
};
await writeFile(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(CONFIRMED ? 0 : 1);
