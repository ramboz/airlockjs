// Reference-site runtime-load waterfall probe (spec 050-01 grounding; ADR-0020 §1).
//
// QUESTION (the 050-01 frame-critique's primary unknown): does the reference container load the
// four TBT-dominant vendors as SEPARABLE, per-`?id=`-keyed runtime `<script>`s — three
// `googletagmanager.com/gtag/js?id=<AW|DC|G>` loads + `connect.facebook.net/…/fbevents.js` — or as
// ONE shared `gtag/js` runtime serving all three Google vendors via in-JS config? The answer decides
// whether 050-01 AC1's per-vendor URL/query suppressor matchers are grounded or misframed.
//
// This is a RUNTIME-load probe (which `<script>`s inject), NOT a beacon-parity probe (that is R-009 /
// the 038 harness) and NOT a CWV probe (that is R-010 / rig/lh-r010.mjs). It captures every request
// the page makes and reports the vendor RUNTIME loaders (with their `?id=`), plus a beacon summary
// for context. No page modification, no container-owner cooperation — a public headless load
// (ADR-0029: the win is developer-provable, page-side, zero container-owner dependency).
//
// NO PII, NO HARDCODED ARENA: the vendor `?id=` values it surfaces (AW-1030811807 / DC-1996823 /
// G-GCCMSJL6CT) are already in-repo (docs/specs/050 overview); the beacon URLs carry a FRESH headless
// browser's synthetic `cid`/`auid` (not a real user's). Per the reference-site capture discipline
// (docs/memory: captures are local-only, redacted if committed), commit THIS RIG, never a raw capture.
//
// Usage:
//   node rig/erp-runtime-waterfall.mjs                                   # defaults to erp.intuit.com
//   REFERENCE_URL=https://<intuit-class-page> node rig/erp-runtime-waterfall.mjs
//   SETTLE_MS=12000 node rig/erp-runtime-waterfall.mjs                   # longer tag-fire window
import { chromium } from "playwright";

const REFERENCE_URL = process.env.REFERENCE_URL || "https://erp.intuit.com/";
const SETTLE_MS = Number(process.env.SETTLE_MS || 8000);

const reqs = [];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await (await browser.newContext()).newPage();
  page.on("request", (r) => reqs.push({ url: r.url(), type: r.resourceType() }));
  console.error(`[erp-runtime-waterfall] navigating ${REFERENCE_URL} …`);
  await page.goto(REFERENCE_URL, { waitUntil: "load", timeout: 45000 }).catch((e) => console.error("  goto:", e.message));
  await page.waitForTimeout(SETTLE_MS); // let the tag manager + vendor runtimes fire
  console.error(`[erp-runtime-waterfall] captured ${reqs.length} requests`);
} finally {
  await browser.close();
}

const has = (u, ...frags) => frags.every((f) => u.includes(f));
// Robust `?id=` extraction (URLSearchParams can miss a value on some captured shapes — grep the query directly).
const idOf = (u) => (u.match(/[?&]id=([^&]+)/) || [])[1] ?? null;

const gtag = reqs.filter((r) => has(r.url, "googletagmanager.com/gtag/js"));
const fbevents = reqs.filter((r) => has(r.url, "connect.facebook.net") && r.url.includes("fbevents"));
const tealium = reqs.filter((r) => has(r.url, "tiqcdn.com"));
const gtagIds = [...new Set(gtag.map((r) => idOf(r.url)).filter(Boolean))];

const beacons = {
  ga4_g_collect: reqs.filter((r) => has(r.url, "/g/collect")).length,
  ga4_mp_collect: reqs.filter((r) => has(r.url, "/mp/collect")).length,
  ccm_collect: reqs.filter((r) => has(r.url, "google.com/ccm/collect")).length,
  ads_pagead_viewthrough: reqs.filter((r) => has(r.url, "/pagead/viewthroughconversion")).length,
  floodlight_activity: reqs.filter((r) => has(r.url, "doubleclick.net") && r.url.includes("/activity")).length,
  meta_tr: reqs.filter((r) => has(r.url, "facebook.com/tr")).length,
};

const verdict =
  gtag.length === 0
    ? "NO gtag/js runtime observed — check consent gate / geo / SETTLE_MS"
    : gtagIds.length >= 2 || gtag.length >= 2
      ? `SEPARABLE — ${gtag.length} gtag/js runtime loads across ids [${gtagIds.join(", ")}]`
      : `UNIFIED — one gtag/js runtime (id ${gtagIds[0] ?? "?"}) serves the Google vendors`;

console.log(JSON.stringify({
  reference_url: REFERENCE_URL,
  total_requests: reqs.length,
  gtag_runtime_loads: gtag.map((r) => ({ id: idOf(r.url), url: r.url })),
  gtag_ids: gtagIds,
  fbevents_js: fbevents.map((r) => r.url),
  tealium_container: tealium.map((r) => r.url),
  beacons,
  VERDICT: verdict,
}, null, 2));
