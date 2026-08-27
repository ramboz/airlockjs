import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { mapToMp } from "../connectors/ga4/map.js";
import { EXPOSURE_EVENT } from "../adapters/eds/exposure.js";

// Slice 005-01 AC3 (ga4_mp_conformance, hermetic): the `experiment_impression`
// exposure beacon the EDS adapter emits MUST satisfy the pinned GA4 MP contract:
// (a) validate against ga4-mp-request.schema.json, and (b) reproduce the pinned
// golden fixture (exact event name + expected params). The golden is what catches
// a typo'd event name — the schema and the live /debug endpoint cannot, because
// GA4 accepts arbitrary custom event names by design (contracts/ga4-mp.md § oracle).
// Deterministic, no network — the live /debug endpoint is the complementary half.
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const golden = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/ga4-mp-experiment-impression.golden.json", import.meta.url)),
);

// The identity ctx pattern shared by the goldens (client_id from _ga, session_id
// from _ga_<stream>) — pinned literals so the golden match is exact.
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

// How the runtime shapes it: push({ event: EXPOSURE_EVENT, experiment_id, variant_id })
// is unpacked by core to { type, params } (airlock.js), then mapped by mapToMp.
const exposureEvent = {
  type: EXPOSURE_EVENT,
  params: { experiment_id: "hero-cta", variant_id: "challenger-1" },
};

describe("UC-1 conformance — experiment_impression exposure payload (AC3)", () => {
  it("the exposure event name is the custom `experiment_impression` (no standard GA4 event exists)", () => {
    expect(EXPOSURE_EVENT).toBe("experiment_impression");
  });

  it("maps to a schema-valid MP body carrying experiment_id + variant_id + injected session identity", () => {
    const body = mapToMp(exposureEvent, ctx);

    expect(validate(body)).toBe(true);
    expect(body.events[0].name).toBe("experiment_impression");
    expect(body.client_id).toBe("1234567890.1700000000");
    expect(body.events[0].params).toMatchObject({
      experiment_id: "hero-cta",
      variant_id: "challenger-1",
      session_id: "1724668790", // injected — required for session attribution
      engagement_time_msec: 100, // injected — required to appear in standard reports
    });
  });

  it("reproduces the pinned experiment_impression GOLDEN (golden half of the oracle)", () => {
    const built = mapToMp(exposureEvent, ctx);
    expect(built).toEqual(golden); // exact match — catches a typo'd name/param the schema can't
  });

  it("the pinned golden itself validates against the schema (fixture stays contract-true)", () => {
    expect(validate(golden)).toBe(true);
  });
});
