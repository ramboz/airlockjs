// XDM mint-recognition — spec 012-02, AC3 (pure piece).
//
// ADR-0008's coalescing GO is conditional on the broker being able to PARSE the
// vendor's opaque XDM `interact` call to recognize an IDENTITY MINT
// (`query.identity.fetch` of ECID, with no ECID yet asserted) and distinguish it
// from a non-mint `interact` (a pageView/personalization/commerce call that does
// not fetch a fresh ECID). That recognizability is ADR-0008's stated kill-
// criterion — so it is pinned here as a pure, hermetic unit under test, against
// the XDM shape the executed 012-01 chamber actually produced:
//   URL  : https://adobedc.demdex.net/ee/v1/interact?configId=<datastream>&requestId=<uuid>
//   body : { events:[{ xdm:{ eventType:"web.webpagedetails.pageViews" }}],
//            query:{ identity:{ fetch:["ECID","CORE"] }} }
// The mint KEY is derived from the datastream (configId) so two concurrent
// first-mints for the SAME datastream coalesce, while different datastreams do
// not. AC6 kill-criteria check rides on these being reliable against the stub XDM.
import { describe, it, expect } from "vitest";
import { recognizeInteract, extractEcidFromInteractResponse } from "../connectors/alloy/xdm-mint.js";

const DS = "00000000-0000-0000-0000-000000000000";
const INTERACT_URL = `https://adobedc.demdex.net/ee/v1/interact?configId=${DS}&requestId=abc-123`;

// The grounded first-mint interact body (012-01's captured XDM shape).
function mintBody() {
  return JSON.stringify({
    events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }],
    query: { identity: { fetch: ["ECID", "CORE"] } },
  });
}

describe("recognizeInteract — identity-mint recognition (spec 012-02 AC3)", () => {
  it("recognizes a first-mint interact (query.identity.fetch includes ECID, no ECID asserted)", () => {
    const r = recognizeInteract({ url: INTERACT_URL, body: mintBody() });
    expect(r.isMint).toBe(true);
    expect(r.namespace).toBe("ECID");
    expect(typeof r.mintKey).toBe("string");
    expect(r.mintKey.length).toBeGreaterThan(0);
  });

  it("accepts an already-parsed body object (not only a JSON string)", () => {
    const r = recognizeInteract({ url: INTERACT_URL, body: JSON.parse(mintBody()) });
    expect(r.isMint).toBe(true);
  });

  it("keys two concurrent mints for the SAME datastream to the SAME mintKey (coalescable)", () => {
    const a = recognizeInteract({ url: INTERACT_URL, body: mintBody() });
    const b = recognizeInteract({
      url: `https://adobedc.demdex.net/ee/v1/interact?configId=${DS}&requestId=different-req`,
      body: mintBody(),
    });
    expect(a.isMint && b.isMint).toBe(true);
    expect(a.mintKey).toBe(b.mintKey);
  });

  it("keys mints for DIFFERENT datastreams to DIFFERENT mintKeys (not coalesced across datastreams)", () => {
    const a = recognizeInteract({ url: INTERACT_URL, body: mintBody() });
    const b = recognizeInteract({
      url: "https://adobedc.demdex.net/ee/v1/interact?configId=99999999-9999-9999-9999-999999999999&requestId=x",
      body: mintBody(),
    });
    expect(a.mintKey).not.toBe(b.mintKey);
  });

  it("does NOT recognize a non-mint interact — no query.identity.fetch at all (passes through)", () => {
    const body = JSON.stringify({ events: [{ xdm: { eventType: "commerce.purchases" } }] });
    const r = recognizeInteract({ url: INTERACT_URL, body });
    expect(r.isMint).toBe(false);
    expect(r.reason).toBe("no-ecid-fetch");
  });

  it("does NOT recognize an interact that fetches other namespaces but NOT ECID", () => {
    const body = JSON.stringify({
      events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }],
      query: { identity: { fetch: ["CORE"] } },
    });
    expect(recognizeInteract({ url: INTERACT_URL, body }).isMint).toBe(false);
  });

  it("does NOT recognize a re-assertion that ALREADY carries an ECID identity (has identity, not a first-mint)", () => {
    // Once alloy has an ECID it sends it in xdm.identityMap.ECID; that is an
    // attach, not a mint — coalescing it would be wrong.
    const body = JSON.stringify({
      events: [{
        xdm: {
          eventType: "web.webpagedetails.pageViews",
          identityMap: { ECID: [{ id: "12345678901234567890", primary: true }] },
        },
      }],
      query: { identity: { fetch: ["ECID"] } },
    });
    const r = recognizeInteract({ url: INTERACT_URL, body });
    expect(r.isMint).toBe(false);
    expect(r.reason).toBe("already-has-ecid");
  });

  it("is defensive against an unparseable / empty body (never throws; not a mint)", () => {
    expect(() => recognizeInteract({ url: INTERACT_URL, body: "not json{" })).not.toThrow();
    expect(recognizeInteract({ url: INTERACT_URL, body: "not json{" }).isMint).toBe(false);
    expect(recognizeInteract({ url: INTERACT_URL, body: "" }).isMint).toBe(false);
    expect(recognizeInteract(undefined).isMint).toBe(false);
  });
});

describe("extractEcidFromInteractResponse — relocated pure parse (spec 012-02 AC3)", () => {
  it("extracts the ECID from an identity:result handle's ECID-namespace entry", () => {
    const response = {
      handle: [
        { type: "identity:result", payload: [{ id: "the-ecid", namespace: { code: "ECID" } }] },
      ],
    };
    expect(extractEcidFromInteractResponse(response)).toBe("the-ecid");
  });

  it("is defensive (returns null, never throws) on a missing handle", () => {
    expect(() => extractEcidFromInteractResponse(null)).not.toThrow();
    expect(extractEcidFromInteractResponse({})).toBeNull();
  });
});
