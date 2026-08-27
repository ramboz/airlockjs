import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { mapToMp } from "../connectors/ga4/map.js";
import { sourceGa4Ctx } from "../connectors/ga4/cookies.js";
import { createCookieCapability } from "../adapters/eds/cookies.js";
import { UC2_EVENTS } from "../adapters/eds/index.js";

// Slice 004-04 AC5 / DoD (ga4_mp_conformance, hermetic): the UC-2 beacons the
// EDS adapter emits — the AC1 steady-state `cta_engage` and the AC2 closing
// `page_view` mapped from a REAL cookie-sourced ctx — MUST satisfy the pinned
// GA4 MP contract: (a) validate against ga4-mp-request.schema.json, and (b) for
// the page_view (a fixture fits it) reproduce the pinned golden. This is the
// hermetic half of the oracle (contracts/ga4-mp.md); the live /debug endpoint is
// the complementary half. Deterministic, no network.
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const pageViewGolden = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/ga4-mp-page_view.golden.json", import.meta.url)),
);

// A returning visitor's real cookie jar → sourced through the SAME host path the
// adapter uses (createCookieCapability + sourceGa4Ctx), so the ctx under test is
// genuinely cookie-sourced (not a hand-built literal).
const JAR = "_ga=GA1.1.1234567890.1700000000; _ga_TEST9=GS1.1.1724668790.3.1.1724668850.60.0.0";

let ctx;
beforeAll(async () => {
  ctx = await sourceGa4Ctx({ cookies: createCookieCapability({ cookie: JAR }), cookieString: JAR });
});

describe("UC-2 conformance — cookie-sourced ctx", () => {
  it("the ctx really came from the cookies (client_id from _ga, session_id from _ga_<stream>)", () => {
    expect(ctx).toEqual({ clientId: "1234567890.1700000000", sessionId: "1724668790" });
  });
});

describe("UC-2 conformance — AC1 cta_engage (worker-cycle beacon)", () => {
  it("maps to a schema-valid MP body carrying the interaction params + session identity", () => {
    const body = mapToMp(
      {
        type: UC2_EVENTS.engage,
        params: { link_text: "See pricing", page_location: "http://localhost:3111/" },
      },
      ctx,
    );

    expect(validate(body)).toBe(true);
    expect(body.events[0].name).toBe("cta_engage");
    expect(body.client_id).toBe("1234567890.1700000000");
    expect(body.events[0].params).toMatchObject({
      link_text: "See pricing",
      page_location: "http://localhost:3111/",
      session_id: "1724668790",
      engagement_time_msec: 100, // injected — required for session attribution
    });
  });
});

describe("UC-2 conformance — AC2 closing page_view (unload-critical beacon)", () => {
  it("maps to a schema-valid MP body carrying the CURRENT page_location + session identity", () => {
    const body = mapToMp(
      { type: UC2_EVENTS.closing, params: { page_location: "http://localhost:3111/pricing" } },
      ctx,
    );

    expect(validate(body)).toBe(true);
    expect(body.events[0].name).toBe("page_view");
    expect(body.events[0].params.page_location).toBe("http://localhost:3111/pricing");
    expect(body.events[0].params.session_id).toBe("1724668790");
  });

  it("reproduces the pinned page_view GOLDEN when fed the golden's inputs (golden half of the oracle)", () => {
    const built = mapToMp(
      {
        type: UC2_EVENTS.closing, // "page_view"
        params: {
          page_location: "https://www.example.com/pricing",
          page_title: "Pricing",
          page_referrer: "https://www.example.com/",
        },
      },
      {
        clientId: "1234567890.1700000000",
        sessionId: "1724668790",
        consent: { ad_user_data: "GRANTED", ad_personalization: "DENIED" },
      },
    );

    expect(built).toEqual(pageViewGolden); // exact match — catches a typo'd name/param the schema can't
  });
});
