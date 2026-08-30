// Decisions-Edge stub — spec 012-03, AC1 (pure piece).
//
// Extends 012-01's minting-Edge stub so the `interact` response ALSO carries
// Target propositions for the `__view__` scope (a `personalization:decisions`
// handle, alongside the identity handles). This is the (stub) Edge response alloy
// surfaces as `result.propositions` when `renderDecisions:false`.
import { describe, it, expect } from "vitest";
import {
  mintDecisionsResponse,
  personalizationDecisionsHandle,
  extractEcidFromInteractResponse,
} from "../rig/alloy-mint-stub.js";

describe("personalizationDecisionsHandle — the __view__ decisions handle (AC1)", () => {
  it("builds a personalization:decisions handle whose payload proposition targets __view__", () => {
    const handle = personalizationDecisionsHandle({ html: "<div>hi</div>", activityId: "a1", experienceId: "e1" });
    expect(handle.type).toBe("personalization:decisions");
    const [prop] = handle.payload;
    expect(prop.scope).toBe("__view__");
    expect(prop.id).toBeTruthy();
    expect(prop.scopeDetails.activity.id).toBe("a1");
    expect(prop.scopeDetails.experience.id).toBe("e1");
  });

  it("carries an html-content-item whose data.content is the HTML the host will apply", () => {
    const handle = personalizationDecisionsHandle({ html: "<b>x</b>" });
    const item = handle.payload[0].items[0];
    expect(item.schema).toBe("https://ns.adobe.com/personalization/html-content-item");
    expect(item.data.content).toBe("<b>x</b>");
  });
});

describe("mintDecisionsResponse — identity + decisions in one interact response (AC1)", () => {
  it("returns { response, ecid, proposition } — the response has BOTH identity and decisions handles", () => {
    const { response, ecid, proposition } = mintDecisionsResponse({ html: "<div>hero</div>" });
    expect(typeof ecid).toBe("string");
    expect(ecid.length).toBeGreaterThan(0);
    // identity handle is preserved (012-01 ECID persistence still works)
    expect(extractEcidFromInteractResponse(response)).toBe(ecid);
    // and a decisions handle for __view__ is added
    const decisions = response.handle.find((h) => h.type === "personalization:decisions");
    expect(decisions).toBeTruthy();
    expect(decisions.payload[0].scope).toBe("__view__");
    expect(proposition.scope).toBe("__view__");
    expect(proposition.items[0].data.content).toBe("<div>hero</div>");
  });

  it("still carries the identity:result + state:store handles (no 012-01 regression)", () => {
    const { response } = mintDecisionsResponse({ html: "<i/>" });
    expect(response.handle.some((h) => h.type === "identity:result")).toBe(true);
    expect(response.handle.some((h) => h.type === "state:store")).toBe(true);
  });

  it("mints a fresh ECID per call (identity mint intact)", () => {
    const a = mintDecisionsResponse({ html: "x" }).ecid;
    const b = mintDecisionsResponse({ html: "x" }).ecid;
    expect(a).not.toBe(b);
  });
});
