import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { shapeMpConsent } from "../connectors/ga4/consent.js";
import { mapToMp } from "../connectors/ga4/map.js";
import { createCriticalDispatcher } from "../core/egress.js";

// Validate against the PINNED external contract — proves a denied data-use
// purpose still produces a schema-valid, POST-able MP body (ADR-0007's
// delegate-and-send: the beacon reshapes, it does not withhold).
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

describe("GA4 consent shaper: shapeMpConsent (spec 017-01 AC3)", () => {
  it("shapes a single denied data-use purpose, omitting the unsignaled one", () => {
    expect(shapeMpConsent({ ad_user_data: "denied" })).toEqual({ ad_user_data: "DENIED" });
  });

  it("shapes both data-use purposes when both are explicitly signaled", () => {
    expect(shapeMpConsent({ ad_user_data: "granted", ad_personalization: "denied" })).toEqual({
      ad_user_data: "GRANTED",
      ad_personalization: "DENIED",
    });
  });

  it("returns undefined when no data-use purpose is signaled (back-compat: ctx.consent stays absent)", () => {
    expect(shapeMpConsent({})).toBeUndefined();
    expect(shapeMpConsent(undefined)).toBeUndefined();
  });

  it("returns undefined for a storage-only vector — storage purposes are not MP consent (017-02's job)", () => {
    expect(shapeMpConsent({ analytics_storage: "denied" })).toBeUndefined();
  });
});

describe("GA4 consent reshape at mapToMp — the mechanism BOTH mapping sites share (spec 017-01 AC4/AC5/AC7)", () => {
  it("a denied data-use purpose sets body.consent DENIED and the beacon is still a complete, valid POST body", () => {
    const ctxWithConsent = { ...ctx, consent: shapeMpConsent({ ad_user_data: "denied" }) };
    const body = mapToMp(
      { type: "page_view", params: { page_location: "https://spike.example/" } },
      ctxWithConsent,
    );

    expect(body.consent.ad_user_data).toBe("DENIED");
    expect(body.client_id).toBe(ctx.clientId); // delegate-and-send: full identity still crosses
    expect(validate(body)).toBe(true); // still a schema-valid POST body — egress happens (AC5)
  });

  it("a granted data-use purpose sets body.consent GRANTED", () => {
    const ctxWithConsent = { ...ctx, consent: shapeMpConsent({ ad_user_data: "granted" }) };
    const body = mapToMp({ type: "page_view", params: {} }, ctxWithConsent);
    expect(body.consent.ad_user_data).toBe("GRANTED");
  });

  it("no consent set → ctx.consent absent → body.consent omitted (unchanged map.js behavior, back-compat)", () => {
    const body = mapToMp({ type: "page_view", params: {} }, ctx);
    expect(body.consent).toBeUndefined();
    expect(validate(body)).toBe(true);
  });
});

// The worker mapping site (connectors/ga4/connector.js `handle`) calls this
// exact `mapToMp(event, ctx)` with the same host-sourced `ctx` — so the block
// above already covers it; this block asserts the SYNC fast path concretely
// (core/egress.js), proving the OQ16 fast-path parity holds for the reshape.
describe("GA4 consent reshape on the SYNC fast path (spec 017-01 AC4, OQ16 parity)", () => {
  it("the critical dispatcher's POSTed body carries the denied data-use consent, and still POSTs", () => {
    const fetchImpl = vi.fn(() => Promise.resolve());
    const ctxWithConsent = { ...ctx, consent: shapeMpConsent({ ad_user_data: "denied" }) };
    const endpoints = ["https://t0.example/collect"];
    const d = createCriticalDispatcher({ ctx: ctxWithConsent, endpoints, trackers: 1, fetchImpl });

    d.dispatch({ type: "page_view", params: { page_location: "https://spike.example/x" } });

    expect(fetchImpl).toHaveBeenCalledTimes(1); // delegate-and-send: the beacon still fires
    const sentBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sentBody.consent.ad_user_data).toBe("DENIED");
    expect(validate(sentBody)).toBe(true);
  });
});
