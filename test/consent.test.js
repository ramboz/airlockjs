import { describe, it, expect } from "vitest";
import { CONSENT_PURPOSES, resolveConsent, egressVerdict } from "../core/consent.js";

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

// The THIRD ADR-0007 enforcement point — the seal (spec 017-03). `egressVerdict`
// folds a beacon's governing purpose(s) into ONE dispatch verdict
// (`"send"|"hold"|"drop"`); `core/airlock.js`'s seal only calls it and acts on
// the result — all the SEMANTICS live here, pure and vendor-neutral.
describe("core/consent.js: egressVerdict", () => {
  it("granted -> send", () => {
    expect(egressVerdict({ analytics_storage: "granted" }, ["analytics_storage"])).toBe("send");
  });

  it("pending (no signal at all) -> hold", () => {
    expect(egressVerdict({}, ["analytics_storage"])).toBe("hold");
    expect(egressVerdict(undefined, ["analytics_storage"])).toBe("hold");
    expect(egressVerdict({ analytics_storage: "pending" }, ["analytics_storage"])).toBe("hold");
  });

  it("denied (non-strict) -> send — a denial is 017-01's mapper-reshape / 017-02's cookie-deny concern, not a seal hold", () => {
    expect(egressVerdict({ analytics_storage: "denied" }, ["analytics_storage"])).toBe("send");
    expect(egressVerdict({ ad_user_data: "denied" }, ["ad_user_data"])).toBe("send");
  });

  it("no governing purposes at all -> send (nothing for the seal to gate on)", () => {
    expect(egressVerdict({}, [])).toBe("send");
    expect(egressVerdict({}, undefined)).toBe("send");
    expect(egressVerdict({}, null)).toBe("send");
  });

  it("multiple governing purposes: the WORST verdict wins (fail-closed) — one pending among granted holds the whole beacon", () => {
    expect(
      egressVerdict(
        { analytics_storage: "granted", ad_storage: "pending" },
        ["analytics_storage", "ad_storage"],
      ),
    ).toBe("hold");
    // Order independence: the pending purpose can be first or last.
    expect(
      egressVerdict(
        { analytics_storage: "pending", ad_storage: "granted" },
        ["analytics_storage", "ad_storage"],
      ),
    ).toBe("hold");
  });

  it("multiple purposes all granted/denied (non-strict, no pending) -> send", () => {
    expect(
      egressVerdict(
        { analytics_storage: "granted", ad_storage: "denied" },
        ["analytics_storage", "ad_storage"],
      ),
    ).toBe("send");
  });

  describe("strict regime (AC3)", () => {
    it("strict + pending -> drop", () => {
      expect(egressVerdict({}, ["analytics_storage"], { strict: true })).toBe("drop");
    });

    it("strict + denied -> drop (unlike non-strict, which sends)", () => {
      expect(egressVerdict({ analytics_storage: "denied" }, ["analytics_storage"], { strict: true })).toBe("drop");
    });

    it("strict + granted -> send (a fully-granted beacon is unaffected by strict)", () => {
      expect(egressVerdict({ analytics_storage: "granted" }, ["analytics_storage"], { strict: true })).toBe("send");
    });

    it("strict + multiple purposes: ANY un-granted purpose drops the whole beacon, even if others are granted", () => {
      expect(
        egressVerdict(
          { analytics_storage: "granted", ad_storage: "pending" },
          ["analytics_storage", "ad_storage"],
          { strict: true },
        ),
      ).toBe("drop");
      expect(
        egressVerdict(
          { analytics_storage: "granted", ad_storage: "denied" },
          ["analytics_storage", "ad_storage"],
          { strict: true },
        ),
      ).toBe("drop");
    });

    it("strict + no governing purposes -> send (nothing to gate on, even under strict)", () => {
      expect(egressVerdict({}, [], { strict: true })).toBe("send");
    });
  });
});
