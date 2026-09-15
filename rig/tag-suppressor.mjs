// Native-tag suppressor — the REAL browser network-0 proof (spec 049-01,
// AC1/AC2/AC3/AC4). `adapters/eds/tag-suppressor.js`'s `installTagSuppressor`
// patches the full DOM script-insertion surface (Node.prototype.appendChild/
// insertBefore/replaceChild + Element.prototype.append/prepend/
// insertAdjacentElement) so a matching `<script src>` never connects to the
// document — this is the ONE thing Node/vitest cannot prove (no DOM, no
// network, and this repo ships no jsdom — see the module's own SUBSTRATE
// note), so this rig is the load-bearing proof, mirroring
// rig/sanitize-boundary.mjs's server + response-header-CSP + gating pattern
// and rig/google-ads-hold-flush.mjs's network-observation discipline.
//
// ALL SIX patched methods are individually driven and blocked here (a
// craft-review blocker fix: prepend/replaceChild were patched but previously
// exercised by no fixture/assertion, so disabling either patch left the suite
// AND this rig green — AC1's "full insertion surface" was only proven 4/6).
//
// THE PROOF (dual assertion — defeats a cached-runtime confound, spec
// language): under a response-header CSP mirroring the reference site's
// (Trusted Types + strict-dynamic), the harness installs the suppressor, then
// injects vendor-runtime-shaped <script src> nodes via the REAL vendor idiom
// (`parentNode.insertBefore(script, firstScript)`) plus `append`/`prepend`/
// `insertAdjacentElement`/`replaceChild` variants:
//   - a MATCHED script -> ZERO network requests for its exact URL AND its
//     fake-runtime sentinel global never appears (the `replaceChild` variant
//     additionally proves its would-be-replaced placeholder SURVIVES — the
//     native replace never ran).
//   - a NON-matching script (same host+path, different `?id=` — AC4 partial
//     migration; and a wholly different resource — AC2 "scoped, not
//     blanket") -> the request IS seen and its sentinel IS present.
//   - the airlock-egress carve-out (AC3): an over-broad HOST-ONLY suppress
//     matcher would catch BOTH a container fixture and airlock's own fixture
//     on the same host, but an `allow` entry for airlock's own path wins —
//     the container fixture is blocked, airlock's own still loads.
//   - a `kind:"tag-suppressor"` diagnostic (spec 028-shaped, and FLAT — no
//     nested `matcher` object, per core/inspector/collector.js's flat-record
//     invariant) fires once per suppression, naming the URL + the matcher's
//     host/pathname/query as flat string fields; nothing fires for the loads.
//
// HERMETIC: every fixture is served by THIS rig's own local Node http server
// (a tiny fake-runtime script that sets `window.__SENTINEL_<id>__`) — no real
// vendor host is ever contacted. Two loopback aliases of the SAME server
// (127.0.0.1 + localhost) stand in for "two different hosts" so the
// partial-migration fixtures (same host+path) and the carve-out fixtures
// (an over-broad host-only matcher) can coexist in ONE installTagSuppressor
// config without their matchers colliding — see the harness for the detail.
//
// Usage: node rig/tag-suppressor.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json",
};

// The reference site's CSP shape (Trusted Types + strict-dynamic), byte-identical
// to rig/sanitize-boundary.mjs's BOILERPLATE_CSP — the same real-world envelope
// every DOM-mutating rig in this suite is proven against.
const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";

function fail(verdict, extra = {}) {
  const out = { pass: false, verdict, ...extra };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://internal.invalid");
    res.setHeader("content-security-policy", BOILERPLATE_CSP); // CSP on EVERY response (models the CDN header)

    // The hermetic fake-runtime fixtures (spec 049-01 AC2/AC3/AC4) — content is
    // driven ENTIRELY by `?id=`, regardless of which fixture filename is asked
    // for, so ONE handler covers runtime.js / other.js / container-egress.js /
    // airlock-egress.js. A real vendor host is never contacted.
    if (url.pathname.startsWith("/fixtures/")) {
      const rawId = url.searchParams.get("id") || "";
      const id = /^[A-Za-z0-9_]+$/.test(rawId) ? rawId : "unknown";
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(`window.__SENTINEL_${id}__ = true;\n`);
      return;
    }

    const file = join(ROOT, normalize(url.pathname));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end("404 " + e.message);
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const requests = [];
page.on("request", (req) => requests.push(req.url()));
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

let result = null;
let urls = null;
let harnessError = null;
let evalError = null;
try {
  // Navigate via the LITERAL "127.0.0.1" (not "localhost") so the harness's
  // HOST_A (location.hostname) is deterministic — HOST_B ("localhost") is a
  // second loopback alias of this SAME server (see the harness + header note).
  await page.goto(`http://127.0.0.1:${port}/rig/tag-suppressor-harness.html`);
  await page.waitForFunction(() => window.__READY__ === true || window.__HARNESS_ERROR__ !== undefined, { timeout: 30000 });
  harnessError = await page.evaluate(() => window.__HARNESS_ERROR__ ?? null);
  if (!harnessError) {
    result = await page.evaluate(() => window.__RESULT__);
    urls = await page.evaluate(() => window.__URLS__);
  }
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { pageErrors, consoleErrors });
if (harnessError) fail("FAIL — harness error: " + harnessError, { pageErrors, consoleErrors });
if (!result || !urls) fail("FAIL — no result captured from the harness", { pageErrors, consoleErrors });

const seen = (url) => requests.includes(url);
const { sentinels, diagnostics, replaceChildPlaceholderSurvived } = result;

const diagUrls = (diagnostics || []).map((d) => d && d.url);
// ALL SIX patched methods (craft-review blocker fix — prepend/replaceChild were
// patched but previously exercised by NO fixture/assertion here, so removing
// either patch left the suite AND this rig green).
const expectedSuppressedUrls = [
  urls.BEFORE_URL,
  urls.APPEND_URL,
  urls.PREPEND_URL,
  urls.ADJACENT_URL,
  urls.REPLACECHILD_URL,
  urls.CONTAINER_URL,
];
const expectedLoadedUrls = [urls.KEEP_URL, urls.OTHER_URL, urls.AIRLOCK_URL];

const assertions = {
  // (a) AC1/AC2 — the vendor idiom (parentNode.insertBefore) is intercepted: network-0 + sentinel absent.
  insertBefore_blocked_network_zero: !seen(urls.BEFORE_URL),
  insertBefore_blocked_sentinel_absent: sentinels.BEFORE === false,
  // (b) AC1/AC2 — the Element.prototype.append variant is intercepted too.
  append_blocked_network_zero: !seen(urls.APPEND_URL),
  append_blocked_sentinel_absent: sentinels.APPEND === false,
  // (b2) AC1/AC2 — the Element.prototype.prepend variant (BLOCKER fix).
  prepend_blocked_network_zero: !seen(urls.PREPEND_URL),
  prepend_blocked_sentinel_absent: sentinels.PREPEND === false,
  // (c) AC1/AC2 — the Element.prototype.insertAdjacentElement variant is intercepted too.
  insertAdjacentElement_blocked_network_zero: !seen(urls.ADJACENT_URL),
  insertAdjacentElement_blocked_sentinel_absent: sentinels.ADJACENT === false,
  // (c2) AC1/AC2 — the Node.prototype.replaceChild variant (BLOCKER fix): network-0 +
  // sentinel-absent, PLUS the native replaceChild contract itself — the placeholder the
  // suppressed script was supposed to replace must still be in place (never replaced).
  replaceChild_blocked_network_zero: !seen(urls.REPLACECHILD_URL),
  replaceChild_blocked_sentinel_absent: sentinels.REPLACECHILD === false,
  replaceChild_placeholder_survived: replaceChildPlaceholderSurvived === true,
  // (d) AC4 — partial migration: SAME host+path, a DIFFERENT `?id=` still loads.
  partial_migration_keep_network_seen: seen(urls.KEEP_URL),
  partial_migration_keep_sentinel_present: sentinels.KEEP === true,
  // AC2 — scoped, not blanket: a wholly different, non-matching resource still loads.
  nonmatching_other_network_seen: seen(urls.OTHER_URL),
  nonmatching_other_sentinel_present: sentinels.OTHER === true,
  // (e/f/g) AC3 — the carve-out: the over-broad host-only matcher blocks the container's
  // own fixture, but the SAME matcher's would-be catch of airlock's own fixture is
  // overridden by the allow entry — airlock's own fixture still loads.
  carveout_container_blocked_network_zero: !seen(urls.CONTAINER_URL),
  carveout_container_sentinel_absent: sentinels.CONTAINER === false,
  carveout_airlock_network_seen: seen(urls.AIRLOCK_URL),
  carveout_airlock_sentinel_present: sentinels.AIRLOCK === true,
  // AC5 — the diagnostic fires exactly once per suppression, naming the URL, and never
  // fires for a load (allow-carved-out or genuinely non-matching). FLAT shape (arch+
  // compliance review blocker fix — spec-028's collector flat-record invariant,
  // core/inspector/collector.js:53-60): matcherHost/matcherPathname/matcherQuery are
  // primitive strings, never a nested `matcher` object.
  diagnostics_fired_for_every_suppression: expectedSuppressedUrls.every((u) => diagUrls.includes(u)),
  diagnostics_count_matches_suppressions_exactly: diagUrls.length === expectedSuppressedUrls.length,
  diagnostics_shape_is_028_flat: (diagnostics || []).every(
    (d) =>
      d &&
      d.level === "warn" &&
      d.kind === "tag-suppressor" &&
      d.disposition === "suppressed" &&
      typeof d.url === "string" &&
      typeof d.matcherHost === "string" &&
      typeof d.matcherPathname === "string" &&
      typeof d.matcherQuery === "string" &&
      d.matcher === undefined, // no nested matcher object anywhere in the record
  ),
  diagnostics_silent_for_loaded_urls: !expectedLoadedUrls.some((u) => diagUrls.includes(u)),
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Under a response-header CSP mirroring the reference site's (Trusted Types + strict-dynamic), does installTagSuppressor PREVENT a matching runtime <script> — injected via ALL SIX patched insertion methods (the real vendor idiom parentNode.insertBefore, plus appendChild-family append/prepend, insertAdjacentElement, and replaceChild) — from ever downloading/evaluating (network-0 + sentinel-absent), while a non-matching script (partial migration and a wholly different resource) still loads, the airlock-egress carve-out wins over an over-broad matcher, and a FLAT, 028-collector-safe diagnostic fires exactly once per suppression and never for a load?",
  pass,
  assertions,
  requests_seen_matching_fixtures: requests.filter((u) => u.includes("/fixtures/")),
  sentinels,
  replaceChildPlaceholderSurvived,
  diagnostics,
  page_errors: pageErrors,
  console_errors: consoleErrors,
  verdict: pass
    ? "PASS — every matched runtime (insertBefore, append, prepend, insertAdjacentElement, replaceChild) was neutralized before connecting to the document (network-0, sentinel absent); the partial-migration and scoped-not-blanket non-matches loaded normally; the airlock-egress carve-out won over an over-broad matcher; the FLAT 028-shaped diagnostic fired exactly once per suppression (never a nested matcher object) and never for a load."
    : "FAIL — see assertions above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
