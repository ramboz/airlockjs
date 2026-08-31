// Alloy-proposition → exposure mapping — spec 012-03, AC5 (pure piece).
//
// UC-1's exposure half for the wrapped-SDK archetype. `adapters/eds/exposure.js`
// reads aem-experimentation's `body[data-experiment]`/`[data-variant]`, which a
// Target PROPOSITION (`scope`/`scopeDetails`/`items`) does NOT populate — so this
// is a NEW mapping (a `propositionDisplay`-style event), reusing only the GENERIC
// `handle.push` → ring → beacon capture runtime. Deduped by proposition identity.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  PROPOSITION_EXPOSURE_EVENT,
  mapPropositionToExposure,
  createPropositionExposureReporter,
} from "../adapters/eds/decisions-exposure.js";

const proposition = (over = {}) => ({
  id: "AT:prop-1",
  scope: "__view__",
  scopeDetails: { decisionProvider: "TGT", activity: { id: "activity-9" }, experience: { id: "experience-3" } },
  items: [{ schema: "https://ns.adobe.com/personalization/html-content-item", data: { content: "<div/>" } }],
  ...over,
});
// A Decision (`{ scope, content }`) as delivered across the chamber boundary.
const decision = (over = {}) => ({ scope: "__view__", content: proposition(over) });

describe("mapPropositionToExposure — proposition → propositionDisplay-style event (AC5)", () => {
  it("maps a proposition's identity to a proposition_display exposure event", () => {
    expect(mapPropositionToExposure(proposition())).toEqual({
      event: PROPOSITION_EXPOSURE_EVENT,
      proposition_id: "AT:prop-1",
      scope: "__view__",
      activity_id: "activity-9",
      experience_id: "experience-3",
    });
  });

  it("accepts a Decision wrapper ({ scope, content }) too", () => {
    expect(mapPropositionToExposure(decision())).toMatchObject({
      event: "proposition_display",
      proposition_id: "AT:prop-1",
      scope: "__view__",
    });
  });

  it("the event name is a custom GA4-style name, NOT experiment_impression (a NEW mapping)", () => {
    expect(PROPOSITION_EXPOSURE_EVENT).toBe("proposition_display");
    expect(PROPOSITION_EXPOSURE_EVENT).not.toBe("experiment_impression");
  });

  it("omits activity/experience params when scopeDetails lacks them (no spurious keys)", () => {
    const evt = mapPropositionToExposure(proposition({ scopeDetails: {} }));
    expect(evt).toEqual({ event: "proposition_display", proposition_id: "AT:prop-1", scope: "__view__" });
    expect("activity_id" in evt).toBe(false);
  });

  it("returns null for a proposition with no scope or no id (nothing to report)", () => {
    expect(mapPropositionToExposure(proposition({ id: undefined }))).toBeNull();
    expect(mapPropositionToExposure(proposition({ scope: undefined }))).toBeNull();
  });

  it("is null-safe on garbage input (never throws)", () => {
    expect(() => mapPropositionToExposure(undefined)).not.toThrow();
    expect(mapPropositionToExposure(undefined)).toBeNull();
    expect(mapPropositionToExposure(null)).toBeNull();
    expect(mapPropositionToExposure(42)).toBeNull();
  });
});

describe("createPropositionExposureReporter — push through the GENERIC capture (AC5)", () => {
  it("pushes ONE proposition_display through handle.push per displayed proposition", () => {
    const handle = { push: vi.fn() };
    const reporter = createPropositionExposureReporter(handle, { seen: new Set() });
    reporter.report(decision());
    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({
      event: "proposition_display",
      proposition_id: "AT:prop-1",
      scope: "__view__",
      activity_id: "activity-9",
      experience_id: "experience-3",
    });
  });

  it("reportAll maps every delivered decision to an exposure push", () => {
    const handle = { push: vi.fn() };
    const reporter = createPropositionExposureReporter(handle, { seen: new Set() });
    reporter.reportAll([decision(), decision({ id: "AT:prop-2" })]);
    expect(handle.push).toHaveBeenCalledTimes(2);
  });

  it("dedups the same proposition (scope:id) → one push (no double-count)", () => {
    const handle = { push: vi.fn() };
    const reporter = createPropositionExposureReporter(handle, { seen: new Set() });
    reporter.report(decision());
    reporter.report(decision());
    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("a non-reportable decision (no id) is skipped, never a spurious push", () => {
    const handle = { push: vi.fn() };
    const reporter = createPropositionExposureReporter(handle, { seen: new Set() });
    reporter.report(decision({ id: undefined }));
    expect(handle.push).not.toHaveBeenCalled();
  });
});

// 018-02 AC2: this module's private propositionOf() used to re-narrow
// Decision.content on its own (a second, near-duplicate of
// connectors/alloy/decisions.js's htmlOfDecision unwrap). Rule-of-three: one
// shared base accessor (`contentOf`), imported here, with this module's own
// extra scope/id predicate layered on top locally (the two sites' predicates
// are NOT identical — see the 018-02 deviation log) — "no third private copy"
// means no independent re-implementation of the base unwrap, not that the
// extra gate must vanish too.
describe("shared proposition/content accessor — no third private copy (018-02 AC2)", () => {
  it("adapters/eds/decisions-exposure.js imports the shared contentOf accessor from connectors/alloy/decisions.js", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "adapters", "eds", "decisions-exposure.js"),
      "utf8",
    );
    expect(src).toMatch(/import\s*{\s*contentOf\s*}\s*from\s*["'][^"']*connectors\/alloy\/decisions\.js["']/);
  });
});
