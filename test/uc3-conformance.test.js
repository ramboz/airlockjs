import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { mapToMp } from "../connectors/ga4/map.js";
import { VIEW_BLOCK_EVENT } from "../adapters/eds/blocks.js";

// Slice 006-01 AC3 (ga4_mp_conformance, hermetic): the `view_block` beacon the EDS
// block instrumenter emits MUST satisfy the pinned GA4 MP contract: (a) validate
// against ga4-mp-request.schema.json, and (b) reproduce the pinned golden fixture
// (exact event name + `block_name` param). The golden is what catches a typo'd event
// name — the schema and the live /debug endpoint cannot, because GA4 accepts arbitrary
// custom event names by design (contracts/ga4-mp.md § oracle). Deterministic, no network.
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const golden = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/ga4-mp-view-block.golden.json", import.meta.url)),
);

// The identity ctx pattern shared by the goldens (client_id from _ga, session_id from
// _ga_<stream>) — pinned literals so the golden match is exact.
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

// How the runtime shapes it: push({ event: VIEW_BLOCK_EVENT, block_name }) is unpacked
// by core into { type, params } (airlock.js), then mapped by mapToMp.
const viewBlockEvent = { type: VIEW_BLOCK_EVENT, params: { block_name: "promo" } };

describe("UC-3 conformance — view_block block-view payload (AC3)", () => {
  it("the block-view event name is the custom `view_block` (no standard GA4 event exists)", () => {
    expect(VIEW_BLOCK_EVENT).toBe("view_block");
  });

  it("maps to a schema-valid MP body carrying block_name + injected session identity", () => {
    const body = mapToMp(viewBlockEvent, ctx);

    expect(validate(body)).toBe(true);
    expect(body.events[0].name).toBe("view_block");
    expect(body.client_id).toBe("1234567890.1700000000");
    expect(body.events[0].params).toMatchObject({
      block_name: "promo",
      session_id: "1724668790", // injected — required for session attribution
      engagement_time_msec: 100, // injected — required to appear in standard reports
    });
  });

  it("reproduces the pinned view_block GOLDEN (golden half of the oracle)", () => {
    const built = mapToMp(viewBlockEvent, ctx);
    expect(built).toEqual(golden); // exact match — catches a typo'd name/param the schema can't
  });

  it("the pinned golden itself validates against the schema (fixture stays contract-true)", () => {
    expect(validate(golden)).toBe(true);
  });
});
