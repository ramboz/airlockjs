// Active-markup sanitizer boundary — the REAL browser security proof (spec
// 018-01, AC2/AC3/AC5). `adapters/eds/dom.js`'s `reserveSpace().fill()`
// default write path is now sanitize-then-write (core/sanitize-html.js)
// instead of raw `innerHTML` — because the EDS default Trusted-Types policy
// is COMPATIBILITY-only for the `Element innerHTML` sink
// (probes/eds-testbed/scripts/scripts.js:61-78), not a sanitizer.
//
// SUBSTRATE (DoR pillar 4 — load-bearing, frame-critique 018-01): Node/vitest
// has NO DOMParser and this project deliberately ships no jsdom/happy-dom/
// linkedom, so the real parse->walk->strip->serialize proof CANNOT run there
// — a shimmed parser would make the vector table green-but-meaningless. This
// rig is that proof: it runs the actual `createDomCapability` default write
// path in REAL chromium, under the EXACT EDS boilerplate CSP
// (`require-trusted-types-for 'script'`, R-005:79), against a vector table
// covering every item in ACTIVE_URL_ATTRS + STRIPPED_TAGS +
// on*-handler-on-any-element, plus a benign-preserved control, an AC4
// override contrast, a multi-fill TT-policy-memoization proof, and one
// documented (NOT gated) mXSS-adjacent known-boundary.
//
// GATE (deterministic, environment-independent — mirrors this project's
// preference for structural invariants over quantitative/behavioural
// signals, e.g. rig/alloy-decisions.mjs's CLS-is-advisory posture): for every
// GATED vector, none of its `deny` patterns match the filled box's resulting
// innerHTML. `securitypolicyviolation` events, thrown page errors, and the
// `window.__xssFired` marker are reported as CORROBORATING evidence, not
// solely gating (CSP's own `strict-dynamic` inline-handler semantics are a
// separate, browser-version-sensitive layer this rig does not need to
// arbitrate to prove the SANITIZER itself stripped the construct).
//
// Usage: node rig/sanitize-boundary.mjs   (exits non-zero if any GATED
// assertion fails)
import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/sanitize-boundary.json");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json",
};

// The exact EDS boilerplate CSP (no worker-src; require-trusted-types-for
// 'script') — same string as rig/uc1.mjs / rig/csp-probe.mjs / rig/e2e.mjs,
// so this rig proves the sanitizer under the SAME CSP the rest of the suite
// already validates the runtime against, not a bespoke one.
const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";

function fail(verdict, extra = {}) {
  const out = { pass: false, verdict, ...extra };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(ROOT, normalize(p === "/" ? "/rig/sanitize-boundary-harness.html" : p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "content-security-policy": BOILERPLATE_CSP, // CSP on EVERY response (models the CDN header)
    });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

let result = null, evalError = null;
try {
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__SANITIZE_RIG_RESULT__ !== undefined, { timeout: 30000 });
  result = await page.evaluate(() => window.__SANITIZE_RIG_RESULT__);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) fail("FAIL — rig error: " + evalError.message, { pageErrors, consoleErrors });
if (!result) fail("FAIL — no result captured from the harness", { pageErrors, consoleErrors });
if (result.fatal) fail("FAIL — harness fatal: " + result.fatal, { pageErrors, consoleErrors });

const { results, vectorDenylists, xssFired, cspViolations, mediaErrorTargets } = result;

// --- AC2/AC3: every GATED vector's denylist patterns are ABSENT from the
//     sanitized output (deterministic structural check — the gate). ---
const gatedIds = Object.keys(vectorDenylists);
const vectorChecks = {};
for (const id of gatedIds) {
  const sanitized = results[id]?.sanitized ?? null;
  const patterns = vectorDenylists[id] || [];
  const violations = patterns.filter((src) => new RegExp(src, "i").test(sanitized || ""));
  vectorChecks[id] = { sanitized, denylist: patterns, violations, pass: violations.length === 0 && sanitized !== null };
}
const ac2_ac3_all_vectors_stripped = Object.values(vectorChecks).every((v) => v.pass);

// --- AC3: benign authored content preserved (key substrings survive; no
//     dangerous stripping occurred). ---
const benign = results["v-benign"]?.sanitized || "";
const ac3_benign_preserved =
  benign.includes('class="hero"') &&
  benign.includes("Hi") &&
  benign.includes("<b>there</b>") &&
  benign.includes('href="https://example.test/x?y=1"') &&
  benign.includes('src="https://example.test/y.png"') &&
  // AC3 explicitly names data-*/aria-* attribute preservation (compliance
  // review 018-01): the v-benign vector carries these, so assert they survive.
  benign.includes('data-x="1"') &&
  benign.includes('aria-label="promo"') &&
  !/onerror|onclick|<script/i.test(benign);

// --- AC4: a caller-supplied setContent fully overrides — the RAW (dangerous)
//     content survives when the default sanitize step is bypassed, proving
//     the override seam is a REAL bypass (not silently still-sanitized) and
//     did not throw (the pre-registered EDS 'default' TT policy accepted the
//     plain-string write, exactly as 012-03 already shipped). ---
const override = results["v-override-raw"] || {};
const ac4_override_bypasses_sanitize_and_does_not_throw =
  override.threw === null && /onerror=/i.test(override.sanitized || "");

// --- Multi-fill / TT-policy-memoization: two LATER fills (through two
//     separate default capability instances) still write real sanitized
//     content, not "" — proving the memoized named policy did not throw
//     "already exists" and get silently swallowed on repeat use. ---
const multiA = results["v-multi-a"]?.sanitized || "";
const multiB = results["v-multi-b"]?.sanitized || "";
const ac5_multi_fill_policy_memoized_no_swallow =
  multiA.includes("multi-a") && !/onclick/i.test(multiA) &&
  multiB.includes("multi-b") && !/onclick/i.test(multiB);

// --- AC5: no CSP violation from the sanitizer's OWN written value, and no
//     thrown page error anywhere in the run. (A `securitypolicyviolation`
//     COULD legitimately fire for reasons UNRELATED to the sanitized write —
//     observed in this rig: a `base-uri` violation from the SANITIZER'S OWN
//     inert DOMParser processing a `<base>` START TAG while walking the
//     v-base-href vector — Chromium's `<base>` tree-construction step seems
//     to run the base-uri check even for a detached, un-rendered document;
//     the element is still correctly REMOVED before anything reaches the
//     live DOM (see vector_checks["v-base-href"]), and a `script-src-attr`
//     violation from the v-override-raw CONTROL's deliberately-unsanitized
//     `onerror=` attribute actually reaching the live DOM (the override
//     seam's whole point, AC4) — neither is the sanitized DEFAULT write
//     being rejected, so this check looks specifically for a `trusted-types`
//     directive violation, the one AC5 cares about.) ---
const ttViolations = (cspViolations || []).filter((v) => /trusted-types/i.test(v.directive || ""));
const ac5_no_trusted_types_violation = ttViolations.length === 0;
const ac5_no_thrown_page_errors = pageErrors.length === 0;

// --- Known boundary (mXSS-adjacent) — REPORTED, never gated (AC4's honest
//     limit: a hand-rolled denylist cannot reach a scripting-context parser
//     differential). ---
const knownBoundary = results["v-noscript-mxss"] || {};

const assertions = {
  ac2_ac3_all_vectors_stripped,
  ac3_benign_preserved,
  ac4_override_bypasses_sanitize_and_does_not_throw,
  ac5_multi_fill_policy_memoized_no_swallow,
  ac5_no_trusted_types_violation,
  ac5_no_thrown_page_errors,
};

const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "Under the EXACT EDS boilerplate CSP (require-trusted-types-for 'script'), does reserveSpace().fill()'s DEFAULT write path strip every active-markup vector (on* handlers on any element; javascript:/vbscript:/data:text/html on the active URL attrs; the denylisted elements, including inside a <template>) while preserving benign authored content byte-for-byte-equivalent, keep the injectable opts.setContent seam a REAL full override, survive repeated fills without the memoized Trusted-Types policy throwing, and never itself trip a trusted-types CSP violation or a page error?",
  pass,
  gate: "Deterministic structural absence-of-dangerous-construct per vector (AC2/AC3) + benign preservation (AC3) + override-bypass-works-and-does-not-throw (AC4) + multi-fill memoization (AC5) + no trusted-types violation / no thrown error (AC5). xssFired + full CSP violation list are corroborating, not gating (CSP's strict-dynamic inline-handler semantics are a separate, browser-version-sensitive layer).",
  assertions,
  vector_checks: vectorChecks,
  benign: { sanitized: benign },
  override_contrast: override,
  multi_fill: { a: multiA, b: multiB },
  corroborating: {
    xssFired,
    cspViolations,
    mediaErrorTargets,
    pageErrors,
    consoleErrors,
  },
  known_boundary_NOT_GATED: {
    id: "v-noscript-mxss",
    note:
      "mXSS-adjacent PROBE (AC4's honest boundary, frame-critique 018-01's named example) — NOT a pass/fail gate either way, in EITHER direction. The theory: the sanitizer's inert DOMParser parses with SCRIPTING DISABLED, so <noscript> content walks as normal markup (an attribute value looks inert to the walk); a LIVE page re-parses the SAME bytes with scripting ENABLED, where <noscript> content is raw-text-tokenized until a literal '</noscript>', which a crafted attribute value could smuggle — resurrecting a live element the sanitizer never saw. OBSERVED THIS RUN (see `observed.sanitized`): this specific payload did NOT reproduce a live bypass — Chromium's attribute-value serialization HTML-entity-escaped the smuggled '<'/'>' characters (visible as `&lt;`/`&gt;` in the output), which defeats this exact smuggling attempt, and `xssFiredAfterAllVectors` stayed false. IMPORTANT: this is NOT proof of safety against noscript-based (or other scripting-context) mXSS in general — it means only that THIS payload, against THIS Chromium version's serializer, did not demonstrate one. A hand-rolled denylist has no principled defense against this whole CLASS of attack (AC4); do not read a non-reproduction here as a defended claim, and do not read it as a demonstrated exploit either — it is reported for the record, unconditionally excluded from `pass`.",
    observed: knownBoundary,
    xssFiredAfterAllVectors: xssFired,
  },
  verdict: pass
    ? "PASS — every gated active-markup vector (on* on any element, dangerous-URL-scheme active attrs, denylisted elements incl. inside <template>) was stripped from reserveSpace().fill()'s DEFAULT write under the real EDS boilerplate CSP; benign authored content survived; opts.setContent still fully overrides (and, unsanitized, the dangerous construct survives — proving it's a real bypass, not silently re-sanitized); repeated fills across separate capability instances did not trip the memoized Trusted-Types policy into swallowing writes; no trusted-types CSP violation and no thrown page error occurred. The <noscript> mXSS-adjacent case is a documented, non-gated known boundary (AC4)."
    : "FAIL — see assertions / vector_checks",
};

await writeFile(OUT, JSON.stringify(out, null, 2));

console.log(JSON.stringify({
  pass: out.pass,
  assertions: out.assertions,
  failing_vectors: Object.entries(vectorChecks).filter(([, v]) => !v.pass).map(([id]) => id),
  corroborating: { xssFired, cspViolationCount: (cspViolations || []).length, pageErrorCount: pageErrors.length },
  known_boundary: { id: "v-noscript-mxss", note: "reported, not gated — see out_file" },
  verdict: out.verdict,
  out_file: "rig/out/sanitize-boundary.json",
}, null, 2));
process.exit(pass ? 0 : 1);
