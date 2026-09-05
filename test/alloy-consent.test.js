import { describe, it, expect } from "vitest";
import { shapeAlloyConsent } from "../connectors/alloy/consent.js";

// Alloy consent shaper (spec 020-02 AC2 + spec 034-01 AC1(A), ADR-0007) — the
// vendor-specific half of the idiomatic DELEGATE lever (020-01 Finding: alloy
// consent is the Adobe 2.0 `setConsent` COMMAND, `{ consent: [{ standard:"Adobe",
// version:"2.0", value:{ collect:{ val:"y"|"n" } } }] }`, NOT an XDM body field).
//
// alloy carries a SINGLE GENERAL consent switch (alloy-core `consentPurpose.js`
// GENERAL; no per-purpose granularity), and `collect:"n"` makes alloy's
// `awaitConsent()` REJECT the send BEFORE the request is built
// (`createEventManager.js:70` gates `sendEdgeNetworkRequest` at `:99`;
// `createConsentStateMachine.js` `awaitOut` rejects) — so `collect:"n"`
// suppresses the WHOLE interact UPSTREAM of the seam.
//
// 034-01 LIVENESS FIX: `collect:"y"` iff **`analytics_storage`** (the primary
// collection purpose) resolves "granted" — DELIBERATELY relaxed from 020-02's
// "iff BOTH governing purposes granted". Rationale: alloy's one-switch consent
// CANNOT express "analytics-yes / personalization-no"; if a personalization
// denial forced `collect:"n"`, alloy would suppress the interact upstream and
// analytics would never flow (the 034-01 Goal). So the delegate provides
// LIVENESS (alloy SENDS when analytics is consented) and the TRUSTED seam
// (`core/wrapped-sdk-host.js`) provides ENFORCEMENT (strips the per-event
// `query.personalization` when personalization is un-granted). Defense-in-depth
// — delegate = liveness, seam = trusted per-event enforcement — exactly as this
// module's own docstring frames the two halves. A denied OR pending
// `analytics_storage` still fails closed to `collect:"n"` (no third pending
// state in alloy's switch).
//
// Reads ONLY core/consent.js's `resolveConsent` (connector -> core is
// allowed; the reverse is not — test/core-boundary.test.js). Modeled on
// connectors/ga4/consent.js's shapeMpConsent / test/ga4-consent.test.js.

describe("connectors/alloy/consent.js: shapeAlloyConsent", () => {
  it("analytics_storage granted (+ personalization granted) -> collect.val: 'y'", () => {
    expect(shapeAlloyConsent({ analytics_storage: "granted", personalization: "granted" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }],
    });
  });

  it("034-01 LIVENESS: analytics_storage granted + personalization DENIED -> collect.val: 'y' (alloy SENDS; the seam strips pzn)", () => {
    // The load-bearing 034-01 case: pzn-denied must NOT force collect:"n" (which
    // would suppress the whole interact upstream of the seam). The delegate keeps
    // alloy live; the TRUSTED seam strips the personalization query per-event.
    expect(shapeAlloyConsent({ analytics_storage: "granted", personalization: "denied" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }],
    });
  });

  it("034-01 LIVENESS: analytics_storage granted + personalization PENDING (absent) -> collect.val: 'y' (a pzn no-signal no longer suppresses analytics)", () => {
    expect(shapeAlloyConsent({ analytics_storage: "granted" })).toEqual({ // personalization absent -> pending
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }],
    });
  });

  it("analytics_storage DENIED -> collect.val: 'n' (fail-closed, even with personalization granted)", () => {
    expect(shapeAlloyConsent({ analytics_storage: "denied", personalization: "granted" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("analytics_storage PENDING (absent -> no signal) -> collect.val: 'n' (fail-closed — analytics is the gate, no third pending state)", () => {
    expect(shapeAlloyConsent({ personalization: "granted" })).toEqual({ // analytics_storage absent -> pending
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("both DENIED -> collect.val: 'n'", () => {
    expect(shapeAlloyConsent({ analytics_storage: "denied", personalization: "denied" })).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("an empty vector (no signal at all) -> collect.val: 'n' (analytics pending -> fail-closed)", () => {
    expect(shapeAlloyConsent({})).toEqual({
      consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }],
    });
  });

  it("no vector at all (null/undefined) -> undefined (back-compat: the chamber glue skips driving setConsent)", () => {
    expect(shapeAlloyConsent(null)).toBeUndefined();
    expect(shapeAlloyConsent(undefined)).toBeUndefined();
  });

  it("a NON-collect purpose (e.g. ad_storage) does not affect the shape — only analytics_storage gates collect", () => {
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
