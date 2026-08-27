import { describe, it, expect, vi, beforeEach } from "vitest";
import { readAppliedExperiment, createExposureReporter } from "../adapters/eds/exposure.js";
import { wireExposure } from "../adapters/eds/index.js";

// Slice 005-01 AC1+AC2: the EDS adapter captures the applied above-the-fold
// experiment/variant and reports it as ONE `experiment_impression` push — read
// from the durable `body[data-experiment]`/`body[data-variant]` state at lazy
// boot (AC1), plus a live `aem:experimentation` listener for a post-boot
// experiment (AC2), de-duplicated against the boot read via ONE shared `seen` Set
// so the same exposure is never double-counted.
//
// Unit-tested over tiny DOM shims (the real-page proof is rig/uc1.mjs). No Worker,
// no network — this asserts the CAPTURE + DEDUP, not the cycle.

// A fake document whose body.dataset carries (or omits) the applied experiment.
const docWith = (dataset) => ({ body: { dataset } });

describe("readAppliedExperiment — durable body-dataset read (AC1)", () => {
  it("returns { experimentId, variantId } when BOTH data-experiment and data-variant are present", () => {
    const doc = docWith({ experiment: "hero-cta", variant: "challenger-1" });
    expect(readAppliedExperiment(doc)).toEqual({ experimentId: "hero-cta", variantId: "challenger-1" });
  });

  it("returns null when data-variant is absent (partial state — not a spurious event)", () => {
    expect(readAppliedExperiment(docWith({ experiment: "hero-cta" }))).toBeNull();
  });

  it("returns null when data-experiment is absent (partial state)", () => {
    expect(readAppliedExperiment(docWith({ variant: "challenger-1" }))).toBeNull();
  });

  it("returns null when neither is present (no experiment applied)", () => {
    expect(readAppliedExperiment(docWith({}))).toBeNull();
  });

  it("is null-safe: no body / no dataset / no doc → null, never throws", () => {
    expect(readAppliedExperiment(undefined)).toBeNull();
    expect(readAppliedExperiment(null)).toBeNull();
    expect(readAppliedExperiment({})).toBeNull(); // no body
    expect(readAppliedExperiment({ body: {} })).toBeNull(); // no dataset
    expect(() => readAppliedExperiment({ body: { dataset: null } })).not.toThrow();
  });
});

describe("createExposureReporter.reportFromBody — eager page-level exposure (AC1)", () => {
  let handle;
  beforeEach(() => {
    handle = { push: vi.fn() };
  });

  it("pushes a single experiment_impression carrying experiment_id + variant_id (string params)", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    reporter.reportFromBody(docWith({ experiment: "hero-cta", variant: "challenger-1" }));

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({
      event: "experiment_impression",
      experiment_id: "hero-cta",
      variant_id: "challenger-1",
    });
  });

  it("no experiment applied → no event (not an empty/spurious one)", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    reporter.reportFromBody(docWith({})); // no dataset keys
    expect(handle.push).not.toHaveBeenCalled();
  });

  it("is idempotent: calling reportFromBody twice for the same exposure pushes ONCE", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    const doc = docWith({ experiment: "hero-cta", variant: "control" });
    reporter.reportFromBody(doc);
    reporter.reportFromBody(doc);
    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("null-safe: a doc with no body never throws and sends nothing", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    expect(() => reporter.reportFromBody({})).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });
});

describe("createExposureReporter.onAemExperimentation — post-boot live listener (AC2)", () => {
  let handle;
  beforeEach(() => {
    handle = { push: vi.fn() };
  });

  it("pushes the same experiment_impression from a CustomEvent detail (experiment/variant)", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    reporter.onAemExperimentation({ experiment: "hero-cta", variant: "challenger-1", type: "experiment" });

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({
      event: "experiment_impression",
      experiment_id: "hero-cta",
      variant_id: "challenger-1",
    });
  });

  it("dedups a repeated live event on the same <experiment>:<variant> key → one push", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    reporter.onAemExperimentation({ experiment: "hero-cta", variant: "control" });
    reporter.onAemExperimentation({ experiment: "hero-cta", variant: "control" });
    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("null-safe: no detail / missing fields → no-op, never throws", () => {
    const reporter = createExposureReporter(handle, { seen: new Set() });
    expect(() => reporter.onAemExperimentation(undefined)).not.toThrow();
    expect(() => reporter.onAemExperimentation({})).not.toThrow();
    expect(() => reporter.onAemExperimentation({ experiment: "hero-cta" })).not.toThrow(); // partial
    expect(handle.push).not.toHaveBeenCalled();
  });
});

describe("createExposureReporter — ONE shared seen Set across both entry points (AC2 dedup)", () => {
  it("the boot-read exposure is NOT double-counted when the live listener sees the same key", () => {
    const handle = { push: vi.fn() };
    const seen = new Set();
    const reporter = createExposureReporter(handle, { seen });

    // Eager path: body dataset read at boot pushes once.
    reporter.reportFromBody(docWith({ experiment: "hero-cta", variant: "challenger-1" }));
    // Live path later re-announces the SAME exposure (e.g. plugin re-fires) → deduped.
    reporter.onAemExperimentation({ experiment: "hero-cta", variant: "challenger-1" });

    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("a genuinely DIFFERENT post-boot experiment is still reported (dedup is per-key, not global)", () => {
    const handle = { push: vi.fn() };
    const reporter = createExposureReporter(handle, { seen: new Set() });

    reporter.reportFromBody(docWith({ experiment: "hero-cta", variant: "control" }));
    reporter.onAemExperimentation({ experiment: "pricing-block", variant: "challenger-1" });

    expect(handle.push).toHaveBeenCalledTimes(2);
    expect(handle.push).toHaveBeenLastCalledWith({
      event: "experiment_impression",
      experiment_id: "pricing-block",
      variant_id: "challenger-1",
    });
  });
});

// A document shim that both carries body.dataset (for the boot read) and captures
// the aem:experimentation listener the adapter registers (so a test can fire it).
function makeExposureDoc(dataset = {}) {
  const listeners = {};
  return {
    body: { dataset },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    fire(type, event) {
      (listeners[type] || []).forEach((fn) => fn(event));
    },
  };
}

describe("wireExposure — adapter boot wiring (AC1+AC2, DI'd doc seam)", () => {
  let handle;
  beforeEach(() => {
    handle = { push: vi.fn() };
  });

  it("boot reads the durable body dataset and pushes the eager exposure once (AC1)", () => {
    const doc = makeExposureDoc({ experiment: "hero-cta", variant: "challenger-1" });
    wireExposure(handle, { doc });

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({
      event: "experiment_impression",
      experiment_id: "hero-cta",
      variant_id: "challenger-1",
    });
  });

  it("the registered aem:experimentation listener reports a post-boot experiment (AC2)", () => {
    const doc = makeExposureDoc({}); // no eager experiment applied at boot
    wireExposure(handle, { doc });
    expect(handle.push).not.toHaveBeenCalled(); // nothing from the empty body read

    doc.fire("aem:experimentation", { detail: { experiment: "pricing-block", variant: "challenger-1", type: "experiment" } });

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({
      event: "experiment_impression",
      experiment_id: "pricing-block",
      variant_id: "challenger-1",
    });
  });

  it("boot read + live listener share ONE seen Set — the SAME exposure is not double-counted (AC2)", () => {
    const doc = makeExposureDoc({ experiment: "hero-cta", variant: "challenger-1" });
    wireExposure(handle, { doc }); // boot read pushes once

    // The plugin re-announces the SAME applied exposure via the live event → deduped.
    doc.fire("aem:experimentation", { detail: { experiment: "hero-cta", variant: "challenger-1" } });

    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("is double-wire-guarded: a second boot does NOT re-report the eager exposure (review 005-01)", () => {
    const doc = makeExposureDoc({ experiment: "hero-cta", variant: "challenger-1" });
    wireExposure(handle, { doc }); // boot read pushes once
    wireExposure(handle, { doc }); // second boot must be a no-op (no fresh seen Set, no 2nd listener)

    expect(handle.push).toHaveBeenCalledTimes(1);
    // and the live listener was not stacked: one fire → still one push total
    doc.fire("aem:experimentation", { detail: { experiment: "hero-cta", variant: "challenger-1" } });
    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("no DOM (node) → no-op, never throws (boot stays safe off a real page)", () => {
    expect(() => wireExposure(handle, {})).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });

  it("a doc without addEventListener → no-op (guarded like wireInteractions)", () => {
    expect(() => wireExposure(handle, { doc: { body: { dataset: { experiment: "x", variant: "y" } } } })).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });
});
