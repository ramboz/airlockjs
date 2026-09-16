// Native-tag suppressor — the REAL browser network-0 proof (spec 049-01
// AC1/AC2/AC3/AC4 + spec 049-02 AC1/AC2/AC3). `adapters/eds/tag-suppressor.js`'s
// `installTagSuppressor` patches TWO surfaces: (049-01) the full DOM
// script-insertion surface (Node.prototype.appendChild/insertBefore/
// replaceChild + Element.prototype.append/prepend/insertAdjacentElement) so a
// matching `<script src>` never connects to the document; and (049-02) the
// direct-beacon-transport surface (`<img>` src/setAttribute/srcset,
// `navigator.sendBeacon`, `XMLHttpRequest`, `fetch`) so a matching bare
// pixel/beacon (no runtime involved) is dropped too, EXCEPT airlock's own
// `fetch`+`keepalive` egress signature. This is the ONE thing Node/vitest
// cannot prove (no DOM, no network, and this repo ships no jsdom — see the
// module's own SUBSTRATE note), so this rig is the load-bearing proof,
// mirroring rig/sanitize-boundary.mjs's server + response-header-CSP + gating
// pattern and rig/google-ads-hold-flush.mjs's network-observation discipline.
//
// ALL SIX 049-01 patched methods are individually driven and blocked here (a
// craft-review blocker fix: prepend/replaceChild were patched but previously
// exercised by no fixture/assertion, so disabling either patch left the suite
// AND this rig green — AC1's "full insertion surface" was only proven 4/6).
//
// THE 049-01 PROOF (dual assertion — defeats a cached-runtime confound, spec
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
//
// THE 049-02 PROOF (the transport-of-emission carve-out — no sentinel needed;
// an img/XHR/fetch/sendBeacon beacon runs no code, so network-request
// presence/absence alone is the unambiguous signal): a matching beacon on
// EVERY patched transport is network-0; a non-matching one still loads; and —
// the LOAD-BEARING case — a container's `<img>`/`sendBeacon` copy of a beacon
// at the EXACT SAME url airlock reproduces (via its real `fetch(url,
// fetchInit(...))` shape, imported raw from core/egress.js) is suppressed
// while airlock's own copy still egresses: exactly ONE request ever reaches
// the network for that shared url.
//
// THE 049-02 AC4 PROOF (compliance-review blocker fix — previously ZERO executing
// coverage: the harness installed the suppressor exactly once and never
// re-installed or uninstalled): after the batch above settles, the harness
// re-installs (SAME config) then calls uninstall() exactly once, then fires two
// NEW, previously-unused matching beacons (img src + sendBeacon). A correct
// uninstall restores the native transports, so both now reach the network. This
// also proves re-install doesn't leave an un-peelable double-wrap (see the
// implementer's report for the mutation-red proofs on both the unpatch calls and
// the combined install/marker guards).
//
// BOTH PROOFS share ONE diagnostic shape: a `kind:"tag-suppressor"` record
// (spec 028-shaped, and FLAT — no nested `matcher` object, per
// core/inspector/collector.js's flat-record invariant) fires once per
// suppression, naming the URL + the matcher's host/pathname/query + (049-02)
// the suppressed TRANSPORT, all as flat string fields; nothing fires for a
// load (or a 049-02 keepalive-fetch exemption).
//
// HERMETIC: every fixture is served by THIS rig's own local Node http server
// (a tiny fake-runtime script that sets `window.__SENTINEL_<id>__` for the
// 049-01 script fixtures; a plain 204 for the 049-02 beacon fixtures) — no
// real vendor host is ever contacted. Two loopback aliases of the SAME server
// (127.0.0.1 + localhost) stand in for "two different hosts" so the
// 049-01 partial-migration fixtures (same host+path) and the carve-out
// fixtures (an over-broad host-only matcher) can coexist in ONE
// installTagSuppressor config without their matchers colliding — see the
// harness for the detail. 049-02's beacon fixtures need no second host — the
// discriminator there is the TRANSPORT, not the host.
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
    if (url.pathname.startsWith("/fixtures/") && url.pathname.endsWith(".js")) {
      const rawId = url.searchParams.get("id") || "";
      const id = /^[A-Za-z0-9_]+$/.test(rawId) ? rawId : "unknown";
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(`window.__SENTINEL_${id}__ = true;\n`);
      return;
    }

    // The hermetic beacon fixture (spec 049-02 AC1/AC2/AC3, e.g. /fixtures/beacon) —
    // a real analytics-style endpoint typically answers a beacon with an empty 204;
    // no sentinel is needed here (an img/XHR/fetch/sendBeacon beacon runs no code —
    // the network request's presence/absence, tracked by the rig's own request
    // listener, is the unambiguous signal).
    if (url.pathname.startsWith("/fixtures/")) {
      res.writeHead(204);
      res.end();
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
const { sentinels, diagnostics, replaceChildPlaceholderSurvived, uninstallRestoredIdentity } = result;
const identity = uninstallRestoredIdentity || {};

// Diagnostics are keyed by (url, transport) PAIRS, not url alone — spec
// 049-02's COLLIDE_URL is suppressed via TWO DIFFERENT transports (img AND
// sendBeacon) at the exact SAME url, while a THIRD call (airlock's own
// fetch+keepalive) to that SAME url is allowed — a url-only key could not
// express "this url has two suppressions and one allow" simultaneously.
const pairKey = (url, transport) => `${url}::${transport}`;
const diagPairs = (diagnostics || []).map((d) => pairKey(d && d.url, d && d.transport));

// ALL SIX 049-01 patched methods (craft-review blocker fix — prepend/replaceChild were
// patched but previously exercised by NO fixture/assertion here, so removing
// either patch left the suite AND this rig green) PLUS the 049-02 beacon transports
// (img src/setAttribute/srcset, sendBeacon, xhr, non-keepalive fetch) PLUS the
// load-bearing collision (COLLIDE_URL suppressed via BOTH img and sendBeacon).
const expectedSuppressions = [
  { url: urls.BEFORE_URL, transport: "script" },
  { url: urls.APPEND_URL, transport: "script" },
  { url: urls.PREPEND_URL, transport: "script" },
  { url: urls.ADJACENT_URL, transport: "script" },
  { url: urls.REPLACECHILD_URL, transport: "script" },
  { url: urls.CONTAINER_URL, transport: "script" },
  { url: urls.IMG_SRC_URL, transport: "img" },
  { url: urls.IMG_SETATTR_URL, transport: "img" },
  { url: urls.IMG_SRCSET_URL, transport: "img" },
  { url: urls.SENDBEACON_URL, transport: "sendBeacon" },
  { url: urls.XHR_URL, transport: "xhr" },
  { url: urls.FETCH_NONKEEPALIVE_URL, transport: "fetch" },
  { url: urls.COLLIDE_URL, transport: "img" }, // the container's bare-pixel copy
  { url: urls.COLLIDE_URL, transport: "sendBeacon" }, // the container's sendBeacon copy
  { url: urls.IMG_SETATTR_SRCSET_URL, transport: "img" }, // Task 4 — setAttribute("srcset", …)
];
const expectedSuppressedPairs = expectedSuppressions.map((e) => pairKey(e.url, e.transport));

// Every ALLOWED (url, transport) pair — MUST NEVER generate a diagnostic, even
// when the SAME url has a suppressed pair elsewhere (COLLIDE_URL's fetch is
// allowed while its img/sendBeacon copies are suppressed).
const expectedLoadedPairs = [
  pairKey(urls.KEEP_URL, "script"),
  pairKey(urls.OTHER_URL, "script"),
  pairKey(urls.AIRLOCK_URL, "script"),
  pairKey(urls.IMG_KEEP_URL, "img"),
  pairKey(urls.SENDBEACON_KEEP_URL, "sendBeacon"),
  pairKey(urls.XHR_KEEP_URL, "xhr"),
  pairKey(urls.FETCH_KEEP_URL, "fetch"),
  pairKey(urls.COLLIDE_URL, "fetch"), // airlock's own keepalive-exempt reproduction
  pairKey(urls.UNINSTALL_IMG_URL, "img"), // post-uninstall — native, never diagnosed
  pairKey(urls.UNINSTALL_SENDBEACON_URL, "sendBeacon"), // post-uninstall — native, never diagnosed
];

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

  // --- 049-02: direct-beacon-transport suppression ---

  // AC1 — the full image-src surface (incl. srcset), all suppressed (network-0).
  img_src_blocked_network_zero: !seen(urls.IMG_SRC_URL),
  img_setattr_blocked_network_zero: !seen(urls.IMG_SETATTR_URL),
  img_srcset_blocked_network_zero: !seen(urls.IMG_SRCSET_URL),
  // AC1 — navigator.sendBeacon, suppressed.
  sendbeacon_blocked_network_zero: !seen(urls.SENDBEACON_URL),
  // AC1 — XMLHttpRequest, suppressed.
  xhr_blocked_network_zero: !seen(urls.XHR_URL),
  // AC1/AC2 — a NON-keepalive fetch is STILL suppressed (only keepalive:true is exempt).
  fetch_nonkeepalive_blocked_network_zero: !seen(urls.FETCH_NONKEEPALIVE_URL),
  // AC1 — a non-matching beacon on each distinct patched surface still loads.
  img_keep_network_seen: seen(urls.IMG_KEEP_URL),
  sendbeacon_keep_network_seen: seen(urls.SENDBEACON_KEEP_URL),
  xhr_keep_network_seen: seen(urls.XHR_KEEP_URL),
  fetch_keep_network_seen: seen(urls.FETCH_KEEP_URL),
  // Task 4 (craft nit #1) — the setAttribute("srcset", …) combination (previously
  // undriven: srcset only via the accessor, setAttribute only via "src") is ALSO
  // suppressed. Mutation-tested: removing `n === "srcset"` from isImgSrcAttr turns
  // this red (see the implementer's report).
  img_setattr_srcset_blocked_network_zero: !seen(urls.IMG_SETATTR_SRCSET_URL),
  // AC2/AC3 — THE LOAD-BEARING COLLISION: airlock reproduces a container's beacon at
  // the BYTE-IDENTICAL url. The container's img AND sendBeacon copies of that url are
  // suppressed, while airlock's OWN fetch+keepalive reproduction of the SAME url still
  // egresses — exactly ONE request ever reaches the network for this url (not zero, not
  // three), proving airlock is the sole emitter even for a url-identical reproduction.
  collide_exactly_one_network_request: requests.filter((u) => u === urls.COLLIDE_URL).length === 1,
  collide_airlock_fetch_network_seen: seen(urls.COLLIDE_URL),

  // AC4 (Tasks 1/2, compliance-review blocker fix) — a re-install (Task 2) followed
  // by a SINGLE uninstall() (Task 1) restores the native beacon transports: two NEW,
  // previously-unused matching URLs fired ONLY after uninstall() reach the network
  // (native, not suppressed) — a real end-to-end behavioral sanity check, but NOT
  // by itself a discriminating proof: every patched transport reads SHARED, LIVE
  // module state that uninstall() unconditionally clears regardless of whether the
  // prototype patch itself was undone, so a leftover wrapper + cleared state is
  // behaviorally indistinguishable from a true native (verified empirically — see
  // the implementer's report). The two assertions below CANNOT go red for either
  // Task 1's or Task 2's mutation for that reason.
  uninstall_restores_img_network_seen: seen(urls.UNINSTALL_IMG_URL),
  uninstall_restores_sendbeacon_network_seen: seen(urls.UNINSTALL_SENDBEACON_URL),
  // THE actual mutation-red-provable AC4 proof: is each beacon transport's CURRENT
  // function/setter identical (===) to the TRUE native captured before the FIRST
  // installTagSuppressor call (see the harness)? Mutation-tested: (a) deleting the
  // beacon-transport unpatch calls in unpatchAll turns ALL of these red (nothing is
  // ever restored); (b) removing BOTH the `!state.installed` short-circuit AND the
  // per-function marker guards turns them red too (the re-install double-wraps, so
  // the single uninstall() peels only one layer, leaving a non-native wrapper
  // active) — see the implementer's report for both proofs.
  uninstall_restores_img_src_setter_identity: identity.imgSrcSetter === true,
  uninstall_restores_img_srcset_setter_identity: identity.imgSrcsetSetter === true,
  uninstall_restores_setattribute_identity: identity.setAttribute === true,
  uninstall_restores_sendbeacon_identity: identity.sendBeacon === true,
  uninstall_restores_xhr_open_identity: identity.xhrOpen === true,
  uninstall_restores_xhr_send_identity: identity.xhrSend === true,
  uninstall_restores_fetch_identity: identity.fetch === true,

  // AC3/AC5 — the diagnostic fires exactly once per suppression, naming the URL AND
  // (049-02) the suppressed TRANSPORT, and never fires for a load — keyed by (url,
  // transport) PAIRS so COLLIDE_URL's two suppressions (img, sendBeacon) and its one
  // allow (fetch) are all correctly distinguished. FLAT shape (arch+compliance review
  // blocker fix — spec-028's collector flat-record invariant,
  // core/inspector/collector.js:53-60): matcherHost/matcherPathname/matcherQuery are
  // primitive strings, never a nested `matcher` object.
  diagnostics_fired_for_every_suppression: expectedSuppressedPairs.every((p) => diagPairs.includes(p)),
  diagnostics_count_matches_suppressions_exactly: diagPairs.length === expectedSuppressedPairs.length,
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
      typeof d.transport === "string" &&
      d.matcher === undefined, // no nested matcher object anywhere in the record
  ),
  diagnostics_silent_for_loaded_pairs: !expectedLoadedPairs.some((p) => diagPairs.includes(p)),
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "(049-01) Under a response-header CSP mirroring the reference site's (Trusted Types + strict-dynamic), does installTagSuppressor PREVENT a matching runtime <script> — injected via ALL SIX patched insertion methods (the real vendor idiom parentNode.insertBefore, plus appendChild-family append/prepend, insertAdjacentElement, and replaceChild) — from ever downloading/evaluating (network-0 + sentinel-absent), while a non-matching script (partial migration and a wholly different resource) still loads and the airlock-egress carve-out wins over an over-broad matcher; AND (049-02) does it ALSO suppress a matching DIRECT BEACON on every transport (img src/setAttribute/srcset — incl. the setAttribute+srcset combination — sendBeacon, XHR, non-keepalive fetch) while EXEMPTING airlock's OWN fetch+keepalive reproduction of the byte-identical url (the transport-of-emission carve-out); AND (049-02 AC4) does a re-install followed by a single uninstall() restore the native beacon transports (no un-peelable double-wrap) — with a FLAT, 028-collector-safe diagnostic (naming the transport too) firing exactly once per suppression and never for a load?",
  pass,
  assertions,
  requests_seen_matching_fixtures: requests.filter((u) => u.includes("/fixtures/")),
  sentinels,
  replaceChildPlaceholderSurvived,
  diagnostics,
  page_errors: pageErrors,
  console_errors: consoleErrors,
  verdict: pass
    ? "PASS — (049-01) every matched runtime (insertBefore, append, prepend, insertAdjacentElement, replaceChild) was neutralized before connecting to the document (network-0, sentinel absent); the partial-migration and scoped-not-blanket non-matches loaded normally; the airlock-egress carve-out won over an over-broad matcher. (049-02) every matched direct beacon (img src/setAttribute/srcset — incl. setAttribute+srcset — sendBeacon, xhr, non-keepalive fetch) was dropped (network-0); airlock's OWN fetch+keepalive reproduction of a BYTE-IDENTICAL url survived while the container's img+sendBeacon copies of that SAME url were both dropped (exactly one network request for that url). (049-02 AC4) a re-install followed by a single uninstall() restored the native beacon transports — no un-peelable double-wrap. The FLAT 028-shaped diagnostic (naming the transport) fired exactly once per suppression (never a nested matcher object) and never for a load."
    : "FAIL — see assertions above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
