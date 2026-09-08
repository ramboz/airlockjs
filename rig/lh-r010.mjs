// R-010 — the rewire's indicative CWV bound (MVP7 risk-first; ADR-0018 E11).
//
// Question: how much Core-Web-Vitals headroom does removing the four TBT-dominant vendor
// runtimes (Meta `fbevents.js`, Google Ads + GA4 `gtag.js`, Floodlight) buy on an intuit-class
// page? This rig measures the shipped page (OFF) vs the SAME URL with those runtimes
// network-blocked (ON, via Lighthouse `blockedUrlPatterns` — rig/lh-core.mjs's runLighthouseOnce
// opt-in), mobile-throttled, N interleaved runs, on BOTH container configurations: shipped
// (phase-split off) and `?martech-phase-split=on`. It reuses lh-core.mjs's median/summary/delta
// engine (NOT a parallel re-implementation), exactly as lh-eds/lh-live do.
//
// INDICATIVE, NOT A HARD CEILING (ADR-0018 E11 / R-010): `blockedUrlPatterns` strips the
// vendors' RUNTIME cost but not the container's per-template PINIT/INIT init (which MVP9's
// native tag-exclusion also removes). A strong result here is only an approximate ceiling on
// MVP9's achievable win; a modest one is the earliest, cheapest trip of the CWV kill criterion.
//
// Same-URL, same host, same cache/edge/origin — the only thing that varies between OFF and ON
// is the block, so (like lh-eds's query-gate) the read is meaningful. Blocking happens at the
// network layer; no page modification, no container-owner cooperation (E11).
//
// Usage:
//   REFERENCE_URL=https://<intuit-class-page> node rig/lh-r010.mjs
//   REFERENCE_URL=… LH_N=7 node rig/lh-r010.mjs                     # more runs (default 5)
//   REFERENCE_URL=… PHASE_SPLIT="" node rig/lh-r010.mjs             # skip the phase-split config
//   REFERENCE_URL=… BLOCK_PATTERNS="*connect.facebook.net*,*gtag/js*" node rig/lh-r010.mjs
//   REFERENCE_URL=… RECON_ONLY=1 node rig/lh-r010.mjs               # just list what WOULD be blocked
//
// The recon pass (always first) runs ONE un-blocked Lighthouse pass and lists which real
// requests match the block patterns, with transfer sizes — so we confirm the patterns hit the
// four runtimes on THIS page before trusting any delta (R5 discipline: ground the block set on
// the real network log, don't assume it).
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { armSummary, computeDeltaMedian, runLighthouseOnce } from "./lh-core.mjs";

const REFERENCE_URL = process.env.REFERENCE_URL || process.env.LIVE_URL || "";
const LH_N = Number(process.env.LH_N || 5);
const PHASE_SPLIT = process.env.PHASE_SPLIT ?? "martech-phase-split=on";
const RECON_ONLY = process.env.RECON_ONLY === "1";

// Documented vendor-runtime loaders — the DEFAULT block set. The reference site's exact runtime
// URLs live in its container (intuit-erp/MARTECH.md, not in this repo), so this set is
// best-effort and MUST be confirmed by the recon pass below; override with BLOCK_PATTERNS.
const DEFAULT_BLOCK = [
  "*connect.facebook.net*", // Meta fbevents.js
  "*googletagmanager.com/gtag/js*", // GA4 + Google Ads gtag.js runtime (one file, two ids)
  "*doubleclick.net*", // Floodlight (fls.doubleclick.net) + Google Ads (googleads.g.doubleclick.net)
  "*google-analytics.com*", // GA4 collect — residual network cost after the runtime is gone
];
const BLOCK_PATTERNS = (process.env.BLOCK_PATTERNS || DEFAULT_BLOCK.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Lighthouse mobileSlow4G preset (explicit for reproducibility) + mobile emulation. The
// before/after rigs run un-throttled desktop by design; the CWV bound is a mobile-throttled read.
const MOBILE = {
  formFactor: "mobile",
  screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
  throttling: {
    rttMs: 150,
    throughputKbps: 1638.4,
    requestLatencyMs: 562.5,
    downloadThroughputKbps: 1474.56,
    uploadThroughputKbps: 675,
    cpuSlowdownMultiplier: 4,
  },
};

if (!REFERENCE_URL) {
  console.error(
    "R-010: set REFERENCE_URL to the intuit-class page to measure.\n" +
      "  REFERENCE_URL=https://<page> node rig/lh-r010.mjs\n" +
      "No URL is hardcoded — the reference page lives in the container owner's docs (MARTECH.md),\n" +
      "not this repo. Confirm the page is public + Lighthouse-loadable (not an authed app) first.",
  );
  process.exit(2);
}

/** `*a*b*` → matches when every non-`*` fragment appears in `url`, in order-independent contains. */
function matchesPattern(url, pattern) {
  const frags = pattern.split("*").filter(Boolean);
  return frags.every((f) => url.includes(f));
}
function matchedBy(url) {
  return BLOCK_PATTERNS.filter((p) => matchesPattern(url, p));
}

function configUrls() {
  const urls = [{ label: "shipped", url: REFERENCE_URL }];
  if (PHASE_SPLIT) {
    const u = new URL(REFERENCE_URL);
    const [k, v] = PHASE_SPLIT.split("=");
    u.searchParams.set(k, v ?? "");
    urls.push({ label: `phase-split (${PHASE_SPLIT})`, url: u.toString() });
  }
  return urls;
}

/** Recon: one un-blocked pass; list the requests the block set WOULD strip, with sizes. */
async function recon(port) {
  const res = await lighthouse(REFERENCE_URL, {
    port,
    onlyCategories: ["performance"],
    ...MOBILE,
  });
  const items = res.lhr.audits["network-requests"]?.details?.items ?? [];
  const hits = [];
  for (const it of items) {
    const which = matchedBy(it.url || "");
    if (which.length) hits.push({ url: it.url, transferKB: Math.round((it.transferSize || 0) / 1024), patterns: which });
  }
  return { totalRequests: items.length, hits, shippedPerf: Math.round(res.lhr.categories.performance.score * 100) };
}

async function runArmsForConfig(port, url) {
  const off = [];
  const on = [];
  for (let i = 0; i < LH_N; i++) {
    // Interleave OFF/ON so any time-varying drift against the origin cancels in the median.
    off.push(await runLighthouseOnce(lighthouse, url, { port, ...MOBILE }));
    on.push(await runLighthouseOnce(lighthouse, url, { port, blockedUrlPatterns: BLOCK_PATTERNS, ...MOBILE }));
  }
  const offS = armSummary(off);
  const onS = armSummary(on);
  return { off: offS, on: onS, delta_median: computeDeltaMedian(offS, onS) };
}

async function main() {
  const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
  try {
    console.error(`R-010: recon on ${REFERENCE_URL} …`);
    const rec = await recon(chrome.port);
    console.error(
      `  ${rec.hits.length} of ${rec.totalRequests} requests match the block set` +
        (rec.hits.length ? ":" : " — WARNING: patterns matched nothing; check BLOCK_PATTERNS vs the page."),
    );
    for (const h of rec.hits) console.error(`    - [${h.transferKB} KB] ${h.url}  (${h.patterns.join(", ")})`);

    const report = {
      question:
        "How much CWV headroom does removing the four TBT-dominant vendor runtimes buy on this page? (indicative, not a hard ceiling — ADR-0018 E11)",
      reference_url: REFERENCE_URL,
      runs_per_arm: LH_N,
      block_patterns: BLOCK_PATTERNS,
      throttle: "mobile slow-4G, 4x CPU",
      recon: rec,
      note:
        "delta_median = ON(blocked) − OFF(shipped); a NEGATIVE TBT/LCP delta is headroom gained by removing the runtimes. " +
        "INDICATIVE ONLY: blockedUrlPatterns strips the vendors' runtime cost, NOT the container's per-template PINIT/INIT init (MVP9's native exclusion removes strictly more).",
    };

    if (RECON_ONLY) {
      console.log(JSON.stringify({ ...report, configs: "skipped (RECON_ONLY=1)" }, null, 2));
      return;
    }

    report.configs = {};
    for (const { label, url } of configUrls()) {
      console.error(`R-010: measuring config "${label}" — ${LH_N} interleaved OFF/ON runs …`);
      report.configs[label] = await runArmsForConfig(chrome.port, url);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await chrome.kill();
  }
}

main().catch((e) => {
  console.error("R-010 rig failed:", e?.stack || e);
  process.exit(1);
});
