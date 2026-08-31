import { describe, it, expect } from "vitest";
import { shapeAlloyConsent } from "../connectors/alloy/consent.js";

// Alloy consent shaper (spec 020-02 AC2, ADR-0007) — the vendor-specific half
// of the idiomatic DELEGATE lever (020-01 Finding: alloy consent is the
// Adobe 2.0 `setConsent` COMMAND, `{ consent: [{ standard:"Adobe",
// version:"2.0", value:{ collect:{ val:"y"|"n" } } }] }`, NOT an XDM body
// field). connectors/alloy/connector.js's manifest declares
// `purposes.egress: ["analytics_storage", "personalization"]` — BOTH govern
// alloy's single `collect` switch, which (unlike GA4's MP `consent` object,
// per-purpose GRANTED/DENIED/omitted) has no third "pending" state to
// delegate to: `val` is "y" iff EVERY governing purpose resolves "granted",
// else "n" (fail-closed — a denied OR pending purpose both collapse to "n").
//
// Reads ONLY core/consent.js's `resolveConsent` (connector -> core is
// allowed; the reverse is not — test/core-boundary.test.js). Modeled on
// connectors/ga4/consent.js's shapeMpConsent / test/ga4-consent.test.js.

describe("connectors/alloy/consent.js: shapeAlloyConsent", () => {
  it("both governing purposes granted -> collect.val: 'y'", () => {
    expect(shapeAlloyConsent({ analytics_storage: "granted", personalization: "granted" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }],
    });
  });

  it("one governing purpose denied -> collect.val: 'n' (fail-closed, even with the other granted)", () => {
    expect(shapeAlloyConsent({ analytics_storage: "denied", personalization: "granted" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("both governing purposes denied -> collect.val: 'n'", () => {
    expect(shapeAlloyConsent({ analytics_storage: "denied", personalization: "denied" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("one governing purpose PENDING (absent -> no signal) -> collect.val: 'n' (no third pending state to delegate to)", () => {
    expect(shapeAlloyConsent({ analytics_storage: "granted" })).toEqual({ // personalization absent -> pending
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("an empty vector (no signal at all) -> collect.val: 'n'", () => {
    expect(shapeAlloyConsent({})).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("no vector at all (null/undefined) -> undefined (back-compat: the chamber glue skips driving setConsent)", () => {
    expect(shapeAlloyConsent(null)).toBeUndefined();
    expect(shapeAlloyConsent(undefined)).toBeUndefined();
  });

  it("a purpose outside the collect-governing pair (e.g. ad_storage) does not affect the shape", () => {
    expect(
      shapeAlloyConsent({ analytics_storage: "granted", personalization: "granted", ad_storage: "denied" }),
    ).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }],
    });
  });

  it("case-insensitive values resolve the same as lower-case (delegates to core/consent.js's resolveConsent)", () => {
    expect(shapeAlloyConsent({ analytics_storage: "GRANTED", personalization: "GRANTED" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }],
    });
  });
});
