import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { mapToMp, mpUrl } from "../connectors/ga4/map.js";

// Validate the connector's output against the PINNED external contract
// (contracts/ga4-mp-request.schema.json). This is the ga4_mp_conformance link:
// the runtime is correct iff what it produces matches the contract.
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

describe("GA4 connector: mapToMp", () => {
  it("maps a custom event to a schema-valid MP body", () => {
    const body = mapToMp(
      { type: "newsletter_signup", params: { method: "footer_form", plan_interest: "pro" } },
      ctx,
    );
    expect(validate(body)).toBe(true);
    expect(body.events[0].name).toBe("newsletter_signup");
    // session_id + engagement_time_msec are injected (required for reporting).
    expect(body.events[0].params.session_id).toBe("1724668790");
    expect(body.events[0].params.engagement_time_msec).toBe(100);
  });

  it("maps a page_view with the recommended params, schema-valid", () => {
    const body = mapToMp(
      {
        type: "page_view",
        params: {
          page_location: "https://spike.example/pricing",
          page_title: "Pricing",
          page_referrer: "https://spike.example/",
        },
      },
      { ...ctx, consent: { ad_user_data: "GRANTED", ad_personalization: "DENIED" } },
    );
    expect(validate(body)).toBe(true);
    expect(body.consent.ad_personalization).toBe("DENIED");
  });

  it("carries user_id when supplied", () => {
    const body = mapToMp({ type: "login", params: {} }, { ...ctx, userId: "u_8f3c" });
    expect(validate(body)).toBe(true);
    expect(body.user_id).toBe("u_8f3c");
  });

  it("produces output the schema REJECTS when the event name is reserved (contract bites)", () => {
    const body = mapToMp({ type: "session_start", params: {} }, ctx); // reserved name
    expect(validate(body)).toBe(false); // proves the conformance link is real, not vacuous
  });

  it("builds production and debug collect URLs", () => {
    const cfg = { measurementId: "G-XXXX", apiSecret: "SECRET" };
    expect(mpUrl(cfg)).toBe(
      "https://www.google-analytics.com/mp/collect?measurement_id=G-XXXX&api_secret=SECRET",
    );
    expect(mpUrl({ ...cfg, debug: true })).toContain("/debug/mp/collect");
    expect(mpUrl({ ...cfg, region: "region1" })).toContain("region1.google-analytics.com");
  });
});
