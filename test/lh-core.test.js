// The pure, Lighthouse-INDEPENDENT logic behind rig/lh-live.mjs (spec 036-01) — the CI-
// provable core of the live before/after CWV harness. Lighthouse itself needs headless
// chromium and is a manually-run rig (like rig/lh-eds.mjs, NOT in this vitest suite);
// this file is what CAN be red->green tested: the median/spread/armSummary/delta math
// SHARED with rig/lh-eds.mjs (extracted here so both rigs reuse ONE engine, not a parallel
// re-implementation — AC1), the profile -> band-disposition decision (AC2/AC3 — is the
// tight LCP-by-construction band meaningful, or is LCP a measured number with no claim,
// or is the whole band withheld), and the card/note rendering (AC4 — the honest note names
// the mode + profile + band disposition, cwv-scoreboard's advisory discipline, ADR-0005).
import { describe, it, expect } from "vitest";
import {
  median,
  summ,
  armSummary,
  computeDeltaMedian,
  TIGHT_BAND,
  withinTightBand,
  runLighthouseOnce,
  PROFILES,
  normalizeProfile,
  bandDisposition,
  TWO_DEPLOYMENT_CAVEAT,
  renderNote,
  buildResult,
} from "../rig/lh-core.mjs";

describe("median/summ/armSummary/delta math (AC1 — shared engine, not a re-implementation)", () => {
  it("median handles odd/even (byte-identical to lh-eds.mjs's own)", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 2])).toBe(3);
  });

  it("summ reduces one metric column to {median,min,max}", () => {
    expect(summ([{ x: 3 }, { x: 1 }, { x: 2 }], "x")).toEqual({ median: 2, min: 1, max: 3 });
  });

  it("armSummary computes per-metric median/min/max across all four metrics + carries raw", () => {
    const rows = [
      { performance: 90, LCP_ms: 1200, TBT_ms: 10, CLS: 0.01 },
      { performance: 92, LCP_ms: 1180, TBT_ms: 20, CLS: 0.02 },
      { performance: 88, LCP_ms: 1210, TBT_ms: 15, CLS: 0.015 },
    ];
    const s = armSummary(rows);
    expect(s.performance).toEqual({ median: 90, min: 88, max: 92 });
    expect(s.LCP_ms).toEqual({ median: 1200, min: 1180, max: 1210 });
    expect(s.TBT_ms).toEqual({ median: 15, min: 10, max: 20 });
    expect(s.CLS).toEqual({ median: 0.015, min: 0.01, max: 0.02 });
    expect(s.raw).toBe(rows);
  });

  it("computeDeltaMedian subtracts ON-OFF per metric, CLS rounded to 3dp (matches lh-eds.mjs's rounding)", () => {
    const off = armSummary([{ performance: 90, LCP_ms: 1000, TBT_ms: 10, CLS: 0.01 }]);
    const on = armSummary([{ performance: 88, LCP_ms: 1005, TBT_ms: 25, CLS: 0.0234 }]);
    expect(computeDeltaMedian(off, on)).toEqual({ performance: -2, LCP_ms: 5, TBT_ms: 15, CLS: 0.013 });
  });

  it("withinTightBand: TBT delta <= 50ms AND |CLS delta| <= 0.01 (lh-eds.mjs's carried band)", () => {
    expect(TIGHT_BAND).toEqual({ tbtMs: 50, clsAbs: 0.01 });
    expect(withinTightBand({ TBT_ms: 40, CLS: 0.005 })).toBe(true);
    expect(withinTightBand({ TBT_ms: 50, CLS: 0.01 })).toBe(true); // inclusive boundary
    expect(withinTightBand({ TBT_ms: 51, CLS: 0 })).toBe(false);
    expect(withinTightBand({ TBT_ms: 0, CLS: 0.011 })).toBe(false);
  });
});

describe("runLighthouseOnce — DI'd Lighthouse-result parser (no browser; a fake lighthouse() fn)", () => {
  it("parses a fake lighthouse() lhr into the arm-row shape lh-eds.mjs's runOne produces", async () => {
    const fakeLighthouse = async () => ({
      lhr: {
        categories: { performance: { score: 0.955 } },
        audits: {
          "largest-contentful-paint": { numericValue: 1234.6 },
          "total-blocking-time": { numericValue: 12.4 },
          "cumulative-layout-shift": { numericValue: 0.00649 },
        },
      },
    });
    const row = await runLighthouseOnce(fakeLighthouse, "http://x/", { port: 1234 });
    expect(row).toEqual({ performance: 96, LCP_ms: 1235, TBT_ms: 12, CLS: 0.006 });
  });

  it("passes the url + {port, onlyCategories, formFactor, screenEmulation} through, matching lh-eds.mjs's call", async () => {
    let seenUrl, seenOpts;
    const fakeLighthouse = async (url, opts) => {
      seenUrl = url;
      seenOpts = opts;
      return { lhr: { categories: { performance: { score: 1 } }, audits: { "largest-contentful-paint": { numericValue: 0 }, "total-blocking-time": { numericValue: 0 }, "cumulative-layout-shift": { numericValue: 0 } } } };
    };
    await runLighthouseOnce(fakeLighthouse, "http://y/", { port: 42 });
    expect(seenUrl).toBe("http://y/");
    expect(seenOpts).toMatchObject({ port: 42, onlyCategories: ["performance"], formFactor: "desktop", screenEmulation: { disabled: true } });
  });

  it("omits blockedUrlPatterns/throttling by default (byte-identical to the before/after rigs' call)", async () => {
    let seenOpts;
    const fakeLighthouse = async (_url, opts) => {
      seenOpts = opts;
      return { lhr: { categories: { performance: { score: 1 } }, audits: { "largest-contentful-paint": { numericValue: 0 }, "total-blocking-time": { numericValue: 0 }, "cumulative-layout-shift": { numericValue: 0 } } } };
    };
    await runLighthouseOnce(fakeLighthouse, "http://y/", { port: 7 });
    expect(seenOpts).not.toHaveProperty("blockedUrlPatterns");
    expect(seenOpts).not.toHaveProperty("throttling");
  });

  it("R-010: passes blockedUrlPatterns + a mobile-throttled override through to lighthouse()", async () => {
    let seenOpts;
    const fakeLighthouse = async (_url, opts) => {
      seenOpts = opts;
      return { lhr: { categories: { performance: { score: 1 } }, audits: { "largest-contentful-paint": { numericValue: 0 }, "total-blocking-time": { numericValue: 0 }, "cumulative-layout-shift": { numericValue: 0 } } } };
    };
    const blockedUrlPatterns = ["*connect.facebook.net*", "*googletagmanager.com/gtag/js*"];
    const throttling = { cpuSlowdownMultiplier: 4 };
    await runLighthouseOnce(fakeLighthouse, "http://z/", {
      port: 9,
      blockedUrlPatterns,
      formFactor: "mobile",
      screenEmulation: { mobile: true, disabled: false },
      throttling,
    });
    expect(seenOpts).toMatchObject({
      port: 9,
      onlyCategories: ["performance"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, disabled: false },
      blockedUrlPatterns,
      throttling,
    });
  });
});

describe("normalizeProfile — operator-declared input, soft fallback (mirrors cwv-scoreboard's resolveProfile)", () => {
  it("recognizes the three named profiles; unknown/absent falls back to ga4", () => {
    expect(PROFILES).toEqual(["ga4", "alloy-analytics", "personalization"]);
    expect(normalizeProfile("ga4")).toBe("ga4");
    expect(normalizeProfile("alloy-analytics")).toBe("alloy-analytics");
    expect(normalizeProfile("personalization")).toBe("personalization");
    expect(normalizeProfile(undefined)).toBe("ga4");
    expect(normalizeProfile("bogus")).toBe("ga4");
  });
});

describe("bandDisposition — profile -> band-disposition decision (AC2/AC3, discriminated on __airlockConfig presence)", () => {
  it("GA4-only (no __airlockConfig) + TBT delta=40, CLS held -> LCP by-construction + within the tight band", () => {
    const d = bandDisposition({ mode: "query-gate", profile: "ga4", deltaMedian: { TBT_ms: 40, CLS: 0.004, LCP_ms: 2, performance: 0 } });
    expect(d.byConstructionLcp).toBe(true);
    expect(d.lcpClaim).toBe("by-construction-zero");
    expect(d.bandWithheld).toBe(false);
    expect(d.band).toEqual(TIGHT_BAND);
    expect(d.withinBand).toBe(true);
  });

  it("GA4-only + CLS regressed beyond 0.01 -> OUT of the tight band despite a fine TBT", () => {
    const d = bandDisposition({ mode: "query-gate", profile: "ga4", deltaMedian: { TBT_ms: 5, CLS: 0.02, LCP_ms: 0, performance: 0 } });
    expect(d.withinBand).toBe(false);
  });

  it("any __airlockConfig profile (alloy-analytics OR personalization) + any LCP delta -> MEASURED, no by-construction claim", () => {
    for (const profile of ["alloy-analytics", "personalization"]) {
      const d = bandDisposition({ mode: "query-gate", profile, deltaMedian: { TBT_ms: 10, CLS: 0.002, LCP_ms: 40, performance: 0 } });
      expect(d.byConstructionLcp).toBe(false);
      expect(d.lcpClaim).toBe("measured-no-claim");
      expect(d.bandWithheld).toBe(false); // TBT band still applies (AC2) — not withheld like two-deployment
    }
  });

  it("alloy-analytics: TBT delta <= 50ms still applies, CLS should hold — a real regression IS flagged", () => {
    const within = bandDisposition({ mode: "query-gate", profile: "alloy-analytics", deltaMedian: { TBT_ms: 10, CLS: 0.002, LCP_ms: 5, performance: 0 } });
    expect(within.withinBand).toBe(true);
    const regressed = bandDisposition({ mode: "query-gate", profile: "alloy-analytics", deltaMedian: { TBT_ms: 10, CLS: 0.05, LCP_ms: 5, performance: 0 } });
    expect(regressed.clsRegressed).toBe(true);
    expect(regressed.withinBand).toBe(false);
  });

  it("personalization: an IMPROVED CLS (a large negative delta) is a PASS signal, NOT a band violation", () => {
    const d = bandDisposition({ mode: "query-gate", profile: "personalization", deltaMedian: { TBT_ms: 10, CLS: -0.06, LCP_ms: 30, performance: 0 } });
    expect(d.clsImproved).toBe(true);
    expect(d.clsRegressed).toBe(false);
    expect(d.withinBand).toBe(true); // improvement never fails the band
  });

  it("two-deployment mode -> band withheld + a loud, non-empty caveat, regardless of profile", () => {
    const d = bandDisposition({ mode: "two-deployment", profile: "ga4", deltaMedian: { TBT_ms: 5, CLS: 0.001, LCP_ms: 3, performance: 0 } });
    expect(d.bandWithheld).toBe(true);
    expect(d.band).toBeNull();
    expect(d.withinBand).toBeNull();
    expect(d.byConstructionLcp).toBe(false);
    expect(d.caveat).toBe(TWO_DEPLOYMENT_CAVEAT);
    expect(d.caveat).toMatch(/cdn|edge|hostname/i);
  });
});

describe("renderNote — the honest note names mode + profile + band disposition (AC4, ADR-0005 advisory)", () => {
  it("query-gate + ga4: names the mode, the by-construction LCP claim, and the tight band", () => {
    const d = bandDisposition({ mode: "query-gate", profile: "ga4", deltaMedian: { TBT_ms: 10, CLS: 0.002, LCP_ms: 0, performance: 0 } });
    const note = renderNote(d);
    expect(note).toMatch(/query-gate/i);
    expect(note).toMatch(/ga4/i);
    expect(note).toMatch(/by construction/i);
    expect(note).toMatch(/50\s*ms/);
    expect(note).toMatch(/advisory/i);
    expect(note).not.toMatch(/withheld/i);
  });

  it("query-gate + alloy-analytics / personalization: measured LCP, explicitly NO by-construction claim", () => {
    for (const profile of ["alloy-analytics", "personalization"]) {
      const d = bandDisposition({ mode: "query-gate", profile, deltaMedian: { TBT_ms: 10, CLS: 0.002, LCP_ms: 22, performance: 0 } });
      const note = renderNote(d);
      expect(note).toMatch(/measured/i);
      expect(note).toMatch(/without a by-construction claim/i);
      expect(note).not.toMatch(/LCP delta is ~0 by construction/i);
    }
  });

  it("personalization note calls out held/IMPROVED CLS as the pass signal", () => {
    const d = bandDisposition({ mode: "query-gate", profile: "personalization", deltaMedian: { TBT_ms: 10, CLS: -0.05, LCP_ms: 22, performance: 0 } });
    expect(renderNote(d)).toMatch(/improve/i);
  });

  it("two-deployment: band withheld + the fixed-bias caveat text present in the note", () => {
    const d = bandDisposition({ mode: "two-deployment", profile: "ga4", deltaMedian: { TBT_ms: 10, CLS: 0.002, LCP_ms: 22, performance: 0 } });
    const note = renderNote(d);
    expect(note).toMatch(/withheld/i);
    expect(note).toMatch(/cdn warmth|fixed between-deployment bias/i);
    expect(note).toMatch(/grossly regressed/i);
  });

  it("every note carries the cwv-scoreboard advisory discipline (ADR-0005 — never a gate)", () => {
    for (const mode of ["query-gate", "two-deployment"]) {
      const d = bandDisposition({ mode, profile: "ga4", deltaMedian: { TBT_ms: 0, CLS: 0, LCP_ms: 0, performance: 0 } });
      expect(renderNote(d)).toMatch(/advisory/i);
    }
  });
});

describe("buildResult — the full JSON card (config echoed, delta computed, acceptance mirrors the disposition, note present)", () => {
  it("query-gate + ga4: within-band card", () => {
    const off = armSummary([{ performance: 95, LCP_ms: 1000, TBT_ms: 5, CLS: 0.001 }]);
    const on = armSummary([{ performance: 94, LCP_ms: 1002, TBT_ms: 20, CLS: 0.003 }]);
    const result = buildResult({ mode: "query-gate", profile: "ga4", config: { lh_n: 1 }, off, on });
    expect(result.config).toEqual({ lh_n: 1 });
    expect(result.off).toBe(off);
    expect(result.on).toBe(on);
    expect(result.delta_median).toEqual({ performance: -1, LCP_ms: 2, TBT_ms: 15, CLS: 0.002 });
    expect(result.acceptance.profile).toBe("ga4");
    expect(result.acceptance.by_construction_lcp).toBe(true);
    expect(result.acceptance.band_withheld).toBe(false);
    expect(result.acceptance.within_band).toBe(true);
    expect(typeof result.note).toBe("string");
    expect(result.note.length).toBeGreaterThan(0);
  });

  it("two-deployment mode withholds the band in acceptance + carries the caveat in the note", () => {
    const off = armSummary([{ performance: 95, LCP_ms: 1000, TBT_ms: 5, CLS: 0.001 }]);
    const on = armSummary([{ performance: 94, LCP_ms: 1300, TBT_ms: 20, CLS: 0.003 }]);
    const result = buildResult({ mode: "two-deployment", profile: "ga4", config: { lh_n: 1 }, off, on });
    expect(result.acceptance.band_withheld).toBe(true);
    expect(result.acceptance.within_band).toBeNull();
    expect(result.note).toMatch(/withheld/i);
  });

  it("query-gate + personalization: an improved CLS reads as within-band in the assembled card", () => {
    const off = armSummary([{ performance: 95, LCP_ms: 1000, TBT_ms: 5, CLS: 0.05 }]);
    const on = armSummary([{ performance: 94, LCP_ms: 1030, TBT_ms: 15, CLS: 0.0 }]);
    const result = buildResult({ mode: "query-gate", profile: "personalization", config: { lh_n: 1 }, off, on });
    expect(result.acceptance.by_construction_lcp).toBe(false);
    expect(result.acceptance.cls_improved).toBe(true);
    expect(result.acceptance.within_band).toBe(true);
  });
});
