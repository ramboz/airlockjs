// The pure, Lighthouse-INDEPENDENT engine behind the before/after CWV rigs — spec 036-01
// AC1. Extracted from rig/lh-eds.mjs (which now imports median/summ/armSummary/
// computeDeltaMedian/withinTightBand/runLighthouseOnce from here — see its own header)
// so rig/lh-live.mjs's live/local query-gate + two-deployment harness REUSES the exact
// engine, not a parallel re-implementation. Every export here is a plain function/const —
// no `lighthouse`/`chrome-launcher`/`playwright` import, no I/O at module load — so this
// file is safe to import from vitest (test/lh-core.test.js) without launching a browser.
// `runLighthouseOnce` is the one exception that performs I/O, but it takes the actual
// `lighthouse` function as a parameter (dependency injection) rather than importing the
// package itself, so it stays a plain, DI-testable function here too (fed a fake in tests;
// fed the real `lighthouse` import by its two callers, rig/lh-eds.mjs + rig/lh-live.mjs).

// ---- median / per-metric summary / delta (byte-identical math, shared with lh-eds.mjs) ----

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Reduce one metric column (e.g. "TBT_ms") across N run-rows to {median,min,max}.
export function summ(rows, key) {
  const xs = rows.map((r) => r[key]);
  return { median: median(xs), min: Math.min(...xs), max: Math.max(...xs) };
}

// Summarize one arm's N `runLighthouseOnce` rows into the four-metric card shape, +raw.
export function armSummary(rows) {
  return {
    performance: summ(rows, "performance"),
    LCP_ms: summ(rows, "LCP_ms"),
    TBT_ms: summ(rows, "TBT_ms"),
    CLS: summ(rows, "CLS"),
    raw: rows,
  };
}

// The ON-OFF median delta per metric (CLS rounded to 3dp, matching lh-eds.mjs's toFixed(3)).
export function computeDeltaMedian(off, on) {
  return {
    performance: on.performance.median - off.performance.median,
    LCP_ms: on.LCP_ms.median - off.LCP_ms.median,
    TBT_ms: on.TBT_ms.median - off.TBT_ms.median,
    CLS: Number((on.CLS.median - off.CLS.median).toFixed(3)),
  };
}

// The tight band carried from lh-eds.mjs: median TBT delta <= 50ms AND |CLS delta| <= 0.01.
export const TIGHT_BAND = Object.freeze({ tbtMs: 50, clsAbs: 0.01 });

export function withinTightBand(deltaMedian) {
  return deltaMedian.TBT_ms <= TIGHT_BAND.tbtMs && Math.abs(deltaMedian.CLS) <= TIGHT_BAND.clsAbs;
}

// ---- the DI'd Lighthouse-once runner (shared shape; the actual `lighthouse` call is the
// one impure bit — callers pass the real `lighthouse` import, tests pass a fake) ----

export async function runLighthouseOnce(lighthouseFn, url, { port } = {}) {
  const res = await lighthouseFn(url, {
    port,
    onlyCategories: ["performance"],
    formFactor: "desktop",
    screenEmulation: { disabled: true },
  });
  const a = res.lhr.audits;
  return {
    performance: Math.round(res.lhr.categories.performance.score * 100),
    LCP_ms: Math.round(a["largest-contentful-paint"].numericValue),
    TBT_ms: Math.round(a["total-blocking-time"].numericValue),
    CLS: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
  };
}

// ---- the profile -> band-disposition decision (AC2/AC3) ----

// The three operator-declared profiles (the harness cannot introspect a remote site's
// window.__airlockConfig, so the operator names which boot shape is live — spec Fork A′).
export const PROFILES = ["ga4", "alloy-analytics", "personalization"];

// Soft fallback to "ga4" on an unknown/absent profile — mirrors cwv-scoreboard.mjs's
// resolveProfile (an unrecognized PROFILE env falls back to a safe default rather than
// silently mis-banding a result).
export function normalizeProfile(profile) {
  return PROFILES.includes(profile) ? profile : "ga4";
}

export const TWO_DEPLOYMENT_CAVEAT =
  "two-deployment mode compares TWO SEPARATE deployments, so a FIXED between-deployment " +
  "bias (CDN warmth, edge PoP, hostname routing) is plausibly 10-100x the band and is NOT " +
  "cancelled by interleaving (which only cancels TIME-VARYING drift against one server). " +
  "The band is WITHHELD; this mode answers \"grossly regressed?\", not \"preserved within 50ms\".";

/**
 * Decide the acceptance-band disposition for one before/after delta (spec 036-01 AC2/AC3):
 * whether the tight TBT/CLS band applies WITH the LCP-by-construction claim (ga4-only, no
 * window.__airlockConfig — all airlock work is post-LCP), applies WITHOUT that claim (any
 * window.__airlockConfig profile — the eager pre-`appear` reserve import fires, so LCP is a
 * MEASURED delta), or is withheld entirely (the two-deployment fallback — a fixed
 * between-deployment bias interleaving cannot cancel).
 *
 * @param {{mode: "query-gate"|"two-deployment", profile?: string, deltaMedian: {TBT_ms:number, CLS:number, LCP_ms:number, performance:number}}} args
 */
export function bandDisposition({ mode, profile, deltaMedian }) {
  const p = normalizeProfile(profile);
  const tbtWithinBand = deltaMedian.TBT_ms <= TIGHT_BAND.tbtMs;
  const clsHeld = Math.abs(deltaMedian.CLS) <= TIGHT_BAND.clsAbs;
  // An IMPROVED CLS (materially better, not just noise) is a PASS signal (spec AC2 —
  // personalization's pre-paint box reservation is the intended no-flicker intervention),
  // never a band violation — only a MEASURABLE regression beyond tolerance is a true violation.
  const clsImproved = deltaMedian.CLS < -TIGHT_BAND.clsAbs;
  const clsRegressed = deltaMedian.CLS > TIGHT_BAND.clsAbs;

  if (mode === "two-deployment") {
    return {
      mode,
      profile: p,
      byConstructionLcp: false,
      lcpClaim: "measured-no-claim",
      band: null,
      bandWithheld: true,
      withinBand: null,
      tbtWithinBand,
      clsHeld,
      clsImproved,
      clsRegressed,
      caveat: TWO_DEPLOYMENT_CAVEAT,
    };
  }

  if (p === "ga4") {
    // No window.__airlockConfig: all airlock work is post-LCP (lazy boot only) -> LCP delta
    // is ~0 BY CONSTRUCTION -> the tight TBT/CLS band is the meaningful pass/fail read.
    return {
      mode,
      profile: p,
      byConstructionLcp: true,
      lcpClaim: "by-construction-zero",
      band: TIGHT_BAND,
      bandWithheld: false,
      withinBand: tbtWithinBand && clsHeld,
      tbtWithinBand,
      clsHeld,
      clsImproved,
      clsRegressed,
      caveat: null,
    };
  }

  // alloy-analytics | personalization: window.__airlockConfig is set, so the eager
  // pre-`appear` import (scripts.js:184) fires -> LCP is a MEASURED delta, reported WITHOUT
  // the by-construction claim. TBT delta <= 50ms still applies to both; CLS should hold
  // (alloy-analytics, no box reserved) or hold/IMPROVE (personalization, boxes reserved
  // pre-paint) — only a measurable regression beyond tolerance fails the band.
  return {
    mode,
    profile: p,
    byConstructionLcp: false,
    lcpClaim: "measured-no-claim",
    band: { tbtMs: TIGHT_BAND.tbtMs },
    bandWithheld: false,
    withinBand: tbtWithinBand && !clsRegressed,
    tbtWithinBand,
    clsHeld,
    clsImproved,
    clsRegressed,
    caveat: null,
  };
}

// ---- honest note + full card rendering (AC4) ----

const PROFILE_NOTE = {
  ga4: () =>
    "PROFILE: ga4-only (no window.__airlockConfig) — all airlock work runs post-LCP, so LCP delta is ~0 BY " +
    `CONSTRUCTION; the tight band applies: TBT delta <= ${TIGHT_BAND.tbtMs}ms AND |CLS delta| <= ${TIGHT_BAND.clsAbs}.`,
  "alloy-analytics": () =>
    "PROFILE: alloy analytics-only (window.__airlockConfig set, no placements) — the eager pre-appear " +
    "import (reserve-personalization.js, scripts.js:184) fires before body.appear, so LCP is a MEASURED " +
    "delta, reported WITHOUT a by-construction claim (that pre-paint import cost is exactly what this " +
    `measures — the 033-03 live bet). CLS should hold (no box reserved). TBT delta <= ${TIGHT_BAND.tbtMs}ms still applies.`,
  personalization: () =>
    "PROFILE: personalization (window.__airlockConfig with placements) — the eager pre-appear reserve " +
    "additionally reserves boxes pre-paint, so LCP is a MEASURED delta, reported WITHOUT a by-construction " +
    "claim. CLS should hold or IMPROVE — an improvement is a PASS signal, not a band violation. TBT delta " +
    `<= ${TIGHT_BAND.tbtMs}ms still applies.`,
};

/** Render the honest note naming the mode, profile, and band disposition (AC4). */
export function renderNote(disposition) {
  const parts = [];
  if (disposition.mode === "two-deployment") {
    parts.push("MODE: two-deployment (FALLBACK — the single-deployment query-gate is PRIMARY).");
    parts.push(`Acceptance band WITHHELD: ${disposition.caveat}`);
  } else {
    parts.push(
      "MODE: query-gate (single deployment, PRIMARY) — one URL, OFF (plain) vs ON (the query flag set), " +
        "holding cache/edge/content/origin constant.",
    );
    parts.push((PROFILE_NOTE[disposition.profile] || PROFILE_NOTE.ga4)());
  }
  parts.push("Carries cwv-scoreboard's tolerance/provenance/human-read discipline — ADVISORY, never a gate (ADR-0005).");
  return parts.join(" ");
}

/**
 * Assemble the full JSON card: config echoed through, the ON-OFF delta computed, the
 * acceptance block mirroring the profile's band disposition, and the honest note (AC4).
 * @param {{mode: string, profile?: string, config?: object, off: object, on: object}} args
 */
export function buildResult({ mode, profile, config, off, on }) {
  const deltaMedian = computeDeltaMedian(off, on);
  const disposition = bandDisposition({ mode, profile, deltaMedian });
  return {
    question: "does adopting airlock preserve Core Web Vitals on this deployment?",
    mode,
    config: config || {},
    off,
    on,
    delta_median: deltaMedian,
    acceptance: {
      profile: disposition.profile,
      band: disposition.band,
      band_withheld: disposition.bandWithheld,
      by_construction_lcp: disposition.byConstructionLcp,
      within_band: disposition.withinBand,
      tbt_within_band: disposition.tbtWithinBand,
      cls_held: disposition.clsHeld,
      cls_improved: disposition.clsImproved,
      cls_regressed: disposition.clsRegressed,
    },
    note: renderNote(disposition),
  };
}
