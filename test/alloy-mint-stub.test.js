// Minting-Edge stub — spec 012-01, AC4 (pure pieces).
//
// AC4 replaces the in-chamber fetch stub with real interception: alloy's
// worker-side fetch to `.../ee/v1/interact` is routed to the main thread, which
// dispatches the real network fetch to a MINTING-Edge stub. That stub
// server-assigns a NEW ECID per call (ADR-0008: two concurrent mints must yield
// distinct ECIDs — the fault later coalescing prevents), and alloy persists it
// into the AMCV_<ORGID> cell.
//
// These unit tests pin the two PURE pieces the rig's server + assertions build on:
//   1. the minting-stub response SHAPE (the Edge `interact` response alloy reads);
//   2. ECID EXTRACTION from that response (mirrors what alloy reads to persist it).
// The browser rig proves the real bundle actually persists the minted ECID.
import { describe, it, expect } from "vitest";
import {
  mintInteractResponse,
  extractEcidFromInteractResponse,
  OLD_INCHAMBER_STUB_ECID,
} from "../rig/alloy-mint-stub.js";

describe("minting-Edge stub response shape (spec 012-01 AC4)", () => {
  it("returns { response, ecid } where the ecid is carried in an identity:result handle", () => {
    const { response, ecid } = mintInteractResponse();
    expect(typeof ecid).toBe("string");
    expect(ecid.length).toBeGreaterThan(0);
    expect(Array.isArray(response.handle)).toBe(true);
    const idResult = response.handle.find((h) => h.type === "identity:result");
    expect(idResult).toBeTruthy();
    // grounded R-004 + the executed chamber probe: alloy reads the ECID from the
    // identity:result handle's payload[].id where namespace.code === "ECID".
    const ecidEntry = idResult.payload.find((p) => p.namespace && p.namespace.code === "ECID");
    expect(ecidEntry).toBeTruthy();
    expect(ecidEntry.id).toBe(ecid);
  });

  it("carries a state:store handle with a kndctr_*_identity cookie (grounded R-004)", () => {
    const { response } = mintInteractResponse();
    const store = response.handle.find((h) => h.type === "state:store");
    expect(store).toBeTruthy();
    expect(Array.isArray(store.payload)).toBe(true);
    expect(store.payload.some((e) => /kndctr_.*identity/.test(e.key || ""))).toBe(true);
  });

  it("SERVER-ASSIGNS a fresh ECID per call — two calls yield distinct ECIDs (the mint)", () => {
    const a = mintInteractResponse().ecid;
    const b = mintInteractResponse().ecid;
    expect(a).not.toBe(b);
  });

  it("the minted ECID is NOT the old hardcoded in-chamber stub value (proves it is server-assigned)", () => {
    const { ecid } = mintInteractResponse();
    expect(ecid).not.toBe(OLD_INCHAMBER_STUB_ECID);
    expect(ecid).not.toBe("STUB-ECID-0123456789");
  });

  it("accepts a requestId and echoes it (Edge response shape)", () => {
    const { response } = mintInteractResponse("req-42");
    expect(response.requestId).toBe("req-42");
  });
});

describe("ECID extraction from the Edge interact response (spec 012-01 AC4)", () => {
  it("extracts the ECID the stub minted (round-trips what alloy persists)", () => {
    const { response, ecid } = mintInteractResponse();
    expect(extractEcidFromInteractResponse(response)).toBe(ecid);
  });

  it("returns the id of the ECID-namespace entry, ignoring other namespaces", () => {
    const response = {
      handle: [
        {
          type: "identity:result",
          payload: [
            { id: "not-this", namespace: { code: "CORE" } },
            { id: "the-ecid", namespace: { code: "ECID" } },
          ],
        },
      ],
    };
    expect(extractEcidFromInteractResponse(response)).toBe("the-ecid");
  });

  it("returns null when there is no identity:result handle", () => {
    expect(extractEcidFromInteractResponse({ handle: [{ type: "state:store", payload: [] }] })).toBeNull();
  });

  it("returns null when there is no ECID-namespace entry", () => {
    const response = { handle: [{ type: "identity:result", payload: [{ id: "x", namespace: { code: "CORE" } }] }] };
    expect(extractEcidFromInteractResponse(response)).toBeNull();
  });

  it("is defensive against a missing/empty handle (never throws)", () => {
    expect(() => extractEcidFromInteractResponse({})).not.toThrow();
    expect(extractEcidFromInteractResponse({})).toBeNull();
    expect(extractEcidFromInteractResponse(null)).toBeNull();
  });
});
