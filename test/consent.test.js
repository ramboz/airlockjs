import { describe, it, expect } from "vitest";
import { CONSENT_PURPOSES, resolveConsent } from "../core/consent.js";

// core/consent.js is the vendor-neutral half of ADR-0007's purpose-dimensioned
// consent model (spec 017-01 AC1) — the taxonomy + a pure per-purpose resolver.
// No GA4/MP specifics belong here; this file only exercises the resolver's own
// pending-by-default contract (the sibling GA4 reshape is test/ga4-consent.test.js).

describe("core/consent.js: CONSENT_PURPOSES", () => {
  it("names the ADR-0007 taxonomy — the Consent Mode v2 four + the two starter extensions", () => {
    expect(CONSENT_PURPOSES).toEqual([
      "analytics_storage",
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
      "functional",
      "personalization",
    ]);
  });
});

describe("core/consent.js: resolveConsent", () => {
  it("resolves an explicit grant, case-insensitively", () => {
    expect(resolveConsent({ ad_user_data: "granted" }, "ad_user_data")).toBe("granted");
    expect(resolveConsent({ ad_user_data: "GRANTED" }, "ad_user_data")).toBe("granted");
  });

  it("resolves an explicit denial, case-insensitively", () => {
    expect(resolveConsent({ ad_user_data: "denied" }, "ad_user_data")).toBe("denied");
    expect(resolveConsent({ ad_user_data: "DENIED" }, "ad_user_data")).toBe("denied");
  });

  it("resolves pending when a KNOWN purpose is simply absent from the vector (unset, no signal yet)", () => {
    expect(resolveConsent({ ad_user_data: "granted" }, "ad_storage")).toBe("pending");
    expect(resolveConsent({}, "analytics_storage")).toBe("pending");
    expect(resolveConsent(undefined, "analytics_storage")).toBe("pending");
    expect(resolveConsent(null, "analytics_storage")).toBe("pending");
  });

  it("resolves pending for an UNRECOGNIZED purpose name, even if the vector happens to carry that key", () => {
    // "pending" here is a property of the PURPOSE, not the vector's contents —
    // a name outside CONSENT_PURPOSES is never resolvable to granted/denied.
    expect(resolveConsent({ not_a_real_purpose: "granted" }, "not_a_real_purpose")).toBe("pending");
  });

  it("resolves pending for an unrecognized value at a known purpose (defensive, never throws)", () => {
    expect(resolveConsent({ ad_user_data: "maybe" }, "ad_user_data")).toBe("pending");
    expect(resolveConsent({ ad_user_data: 1 }, "ad_user_data")).toBe("pending");
  });
});
