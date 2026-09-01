// helix-rum CWV capture — spec 022-04 AC1/AC2. Tests the main-thread capture
// module standalone (pure `projectCwv` + DI'd `startCwvCapture`), BEFORE any
// connector/map.js involvement — mirrors adapters/eds/exposure.js's own
// "pure / DI'd / null-safe" capture-module test style.
//
// *** THE LOAD-BEARING must-fix (frame-critique, folded into AC1/AC2) ***
// A raw `web-vitals/attribution` metric's `attribution` sub-object carries
// non-structured-cloneable PerformanceEntry-shaped values (arrays of entries,
// single entry refs, and one DOM-Node-carrying object) — grounded against
// `node_modules/web-vitals/dist/modules/types/{lcp,cls,inp}.d.ts`, read
// 2026-09-01 against the installed `web-vitals@6.2.1`:
//   - LCPAttribution: `navigationEntry`, `lcpResourceEntry`, `lcpEntry`
//   - CLSAttribution: `largestShiftEntry`, `largestShiftSource` (carries a live DOM `node`)
//   - INPAttribution: `processedEventEntries`, `longAnimationFrameEntries`, `longestScript` (nests `.entry`)
// Pushing any of these through airlock's push()->worker postMessage (structured
// clone) throws DataCloneError and breaks the WHOLE drain, not just the cwv
// event. The fixtures below deliberately INCLUDE these exact hazard field
// names (mock array-of-object / nested-object shapes standing in for the real
// PerformanceEntry/Node references) so an over-simplified stub can't hide the
// guard not doing its job — a naive `push({event:"cwv", ...metric.attribution})`
// would fail these tests' hazard-key-absence assertions.
import { describe, it, expect, vi } from "vitest";
import { projectCwv, startCwvCapture } from "../connectors/helix-rum/cwv-capture.js";

// Realistic LCPMetricWithAttribution fixture (lcp.d.ts:5-87) — includes the
// base Metric's own `entries`/`id`/`delta`/etc. (never read by projectCwv) and
// the three PerformanceEntry-shaped attribution hazards.
const lcpMetric = {
  name: "LCP",
  value: 2345.6,
  delta: 2345.6,
  id: "v3-123-456",
  rating: "needs-improvement",
  navigationType: "navigate",
  entries: [{}], // base Metric.entries: PerformanceEntry[] — must never ride
  attribution: {
    target: "#hero > img.banner",
    url: "https://example.test/hero.jpg",
    timeToFirstByte: 120.4,
    resourceLoadDelay: 30.1,
    resourceLoadDuration: 600.2,
    elementRenderDelay: 50.3,
    navigationEntry: {}, // hazard: PerformanceNavigationTiming stand-in
    lcpResourceEntry: {}, // hazard: PerformanceResourceTiming stand-in
    lcpEntry: {}, // hazard: LargestContentfulPaint entry stand-in
  },
};

// Realistic CLSMetricWithAttribution fixture (cls.d.ts:5-57).
const clsMetric = {
  name: "CLS",
  value: 0.12,
  attribution: {
    largestShiftTarget: "#promo-banner",
    largestShiftTime: 1801.2,
    largestShiftValue: 0.09,
    loadState: "complete",
    largestShiftEntry: {}, // hazard: LayoutShift entry stand-in
    largestShiftSource: { node: {}, previousRect: {}, currentRect: {} }, // hazard: carries a live DOM Node ref
  },
};

// Realistic INPMetricWithAttribution fixture (inp.d.ts:9-161).
const inpMetric = {
  name: "INP",
  value: 187,
  attribution: {
    interactionTarget: "#add-to-cart",
    interactionType: "pointer",
    interactionTime: 4501.7,
    nextPaintTime: 4689.2,
    inputDelay: 12,
    processingDuration: 40,
    presentationDelay: 8,
    loadState: "complete",
    totalScriptDuration: 20,
    totalStyleAndLayoutDuration: 5,
    totalPaintDuration: 3,
    totalUnattributedDuration: 2,
    processedEventEntries: [{}], // hazard: PerformanceEventTiming[] stand-in
    longAnimationFrameEntries: [{}], // hazard: PerformanceLongAnimationFrameTiming[] stand-in
    longestScript: { entry: {}, subpart: "processing-duration", intersectingDuration: 20 }, // hazard: nests an entry
  },
};

describe("projectCwv — the structured-clone guard (spec 022-04 AC1/AC2 must-fix)", () => {
  it("LCP: keeps only the grounded scalar attribution fields, strips the PerformanceEntry-shaped ones", () => {
    const projected = projectCwv(lcpMetric);

    expect(projected).toEqual({
      name: "LCP",
      value: 2345.6,
      target: "#hero > img.banner",
      url: "https://example.test/hero.jpg",
      timeToFirstByte: 120.4,
      resourceLoadDelay: 30.1,
      resourceLoadDuration: 600.2,
      elementRenderDelay: 50.3,
    });
    expect(projected).not.toHaveProperty("navigationEntry");
    expect(projected).not.toHaveProperty("lcpResourceEntry");
    expect(projected).not.toHaveProperty("lcpEntry");
    expect(projected).not.toHaveProperty("entries"); // base Metric.entries never even read
    expect(projected).not.toHaveProperty("id"); // base Metric fields other than name/value never ride
    expect(() => structuredClone(projected)).not.toThrow();
    expect(structuredClone(projected)).toEqual(projected);
  });

  it("CLS: keeps largestShiftTarget/Time/Value + loadState, strips the entry + the DOM-Node-carrying source", () => {
    const projected = projectCwv(clsMetric);

    expect(projected).toEqual({
      name: "CLS",
      value: 0.12,
      largestShiftTarget: "#promo-banner",
      largestShiftTime: 1801.2,
      largestShiftValue: 0.09,
      loadState: "complete",
    });
    expect(projected).not.toHaveProperty("largestShiftEntry");
    expect(projected).not.toHaveProperty("largestShiftSource");
    expect(() => structuredClone(projected)).not.toThrow();
  });

  it("INP: keeps interaction target/type/timings + the total*Duration scalars, strips the entry arrays + longestScript wholesale", () => {
    const projected = projectCwv(inpMetric);

    expect(projected).toEqual({
      name: "INP",
      value: 187,
      interactionTarget: "#add-to-cart",
      interactionType: "pointer",
      interactionTime: 4501.7,
      nextPaintTime: 4689.2,
      inputDelay: 12,
      processingDuration: 40,
      presentationDelay: 8,
      loadState: "complete",
      totalScriptDuration: 20,
      totalStyleAndLayoutDuration: 5,
      totalPaintDuration: 3,
      totalUnattributedDuration: 2,
    });
    expect(projected).not.toHaveProperty("processedEventEntries");
    expect(projected).not.toHaveProperty("longAnimationFrameEntries");
    // longestScript is dropped WHOLESALE by the shallow filter — including its
    // two safe sub-scalars (subpart/intersectingDuration) — a deliberate
    // simplicity/safety tradeoff (see cwv-capture.js's projectCwv doc + this
    // slice's deviation log), not a partial unwrap.
    expect(projected).not.toHaveProperty("longestScript");
    expect(() => structuredClone(projected)).not.toThrow();
  });

  it("EVERY projected value is a string/number/boolean — the structural guarantee holds regardless of field name, not just for the named hazards above", () => {
    for (const metric of [lcpMetric, clsMetric, inpMetric]) {
      const projected = projectCwv(metric);
      for (const [key, value] of Object.entries(projected)) {
        expect(["string", "number", "boolean"], `"${key}" on ${metric.name}`).toContain(typeof value);
      }
    }
  });

  it("proves the fixture is realistic, not an over-simplified stub: the RAW attribution DOES carry the exact hazard shapes a naive wholesale-spread would forward", () => {
    expect(Object.keys(inpMetric.attribution)).toEqual(
      expect.arrayContaining(["processedEventEntries", "longAnimationFrameEntries", "longestScript"]),
    );
    expect(Array.isArray(inpMetric.attribution.processedEventEntries)).toBe(true);
    expect(typeof inpMetric.attribution.longestScript).toBe("object");
    expect(typeof clsMetric.attribution.largestShiftSource).toBe("object");
    // ...yet the PROJECTED output (what actually crosses push()) is clone-safe.
    expect(() => structuredClone(projectCwv(inpMetric))).not.toThrow();
  });

  it("is null-safe: a metric with no attribution sub-object still projects name/value, never throws", () => {
    expect(projectCwv({ name: "LCP", value: 5 })).toEqual({ name: "LCP", value: 5 });
    expect(() => projectCwv({})).not.toThrow();
    expect(() => projectCwv(undefined)).not.toThrow();
  });
});

describe("startCwvCapture — wires push() to web-vitals/attribution's onLCP/onCLS/onINP (spec 022-04 AC2)", () => {
  it("subscribes to all three metric sources exactly once each, with a function handler", () => {
    const push = vi.fn();
    const onLCP = vi.fn();
    const onCLS = vi.fn();
    const onINP = vi.fn();

    startCwvCapture({ push, onLCP, onCLS, onINP });

    expect(onLCP).toHaveBeenCalledTimes(1);
    expect(onCLS).toHaveBeenCalledTimes(1);
    expect(onINP).toHaveBeenCalledTimes(1);
    expect(typeof onLCP.mock.calls[0][0]).toBe("function");
    expect(typeof onCLS.mock.calls[0][0]).toBe("function");
    expect(typeof onINP.mock.calls[0][0]).toBe("function");
  });

  it("a finalized LCP metric pushes ONE `cwv` event carrying the projected scalars", () => {
    const push = vi.fn();
    let lcpCallback;
    startCwvCapture({
      push,
      onLCP: (cb) => { lcpCallback = cb; },
      onCLS: vi.fn(),
      onINP: vi.fn(),
    });

    lcpCallback(lcpMetric);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({
      event: "cwv",
      name: "LCP",
      value: 2345.6,
      target: "#hero > img.banner",
      url: "https://example.test/hero.jpg",
      timeToFirstByte: 120.4,
      resourceLoadDelay: 30.1,
      resourceLoadDuration: 600.2,
      elementRenderDelay: 50.3,
    });
  });

  it("emission model: LCP, CLS, and INP each finalize independently as THEIR OWN push — three separate cwv events, never batched into one combined beacon", () => {
    const push = vi.fn();
    let lcpCb;
    let clsCb;
    let inpCb;
    startCwvCapture({
      push,
      onLCP: (cb) => { lcpCb = cb; },
      onCLS: (cb) => { clsCb = cb; },
      onINP: (cb) => { inpCb = cb; },
    });

    lcpCb(lcpMetric);
    clsCb(clsMetric);
    inpCb(inpMetric);

    expect(push).toHaveBeenCalledTimes(3);
    expect(push.mock.calls.map((c) => c[0].name)).toEqual(["LCP", "CLS", "INP"]);
    expect(push.mock.calls.every((c) => c[0].event === "cwv")).toBe(true);
  });

  it("every pushed cwv event survives a structuredClone round-trip end-to-end through startCwvCapture (the DataCloneError guard, not just at the projectCwv unit level)", () => {
    const push = vi.fn();
    let inpCb;
    startCwvCapture({ push, onLCP: vi.fn(), onCLS: vi.fn(), onINP: (cb) => { inpCb = cb; } });

    inpCb(inpMetric);

    const [pushed] = push.mock.calls[0];
    expect(() => structuredClone(pushed)).not.toThrow();
    expect(structuredClone(pushed)).toEqual(pushed);
  });
});
