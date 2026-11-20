// Spec 064-18 (B2): the egress bridge seam. Browser-free: a fake chamber and fake caps drive the
// real seam, the real ceiling matcher and the real Alloy connector allowlist.
import { describe, it, expect } from "vitest";
import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";
import { sanitizeFetchInit } from "../core/egress.js";
import { checkEndpointCeiling } from "../core/endpoint-ceiling.js";
import { ALLOY_STOCK_ENDPOINTS, ALLOY_KNOWN_HANDLE_TYPES, allowlistForEdgeDomain } from "../connectors/alloy/connector.js";

const DS = "23190fa7-9e6b-4250-b87b-abcdc8ebc297";

function fakeChamber() {
  let handler; const posted = []; let waiter;
  return {
    postMessage: (m) => { posted.push(m); waiter?.(m); },
    onMessage: (h) => { handler = h; },
    emit: (m) => handler(m),
    next: () => new Promise((r) => { waiter = r; }),
    posted,
  };
}

async function run({ url, init, beacon, response, diag = [], hostOpts = {} }) {
  const chamber = fakeChamber();
  const seen = [];
  const caps = { egress: { dispatch: async (req) => { seen.push(req); return response || { status: 200, statusText: "OK", headers: { "content-type": "application/json", "x-adobe-edge": "OR2;9" }, body: '{"handle":[]}' }; } } };
  createWrappedSdkHost({
    chamber, caps, onDiagnostic: (d) => diag.push(d),
    endpointCeiling: [...ALLOY_STOCK_ENDPOINTS, ...(hostOpts.edge ? allowlistForEdgeDomain(hostOpts.edge) : [])],
    knownHandleTypes: ALLOY_KNOWN_HANDLE_TYPES,
    configIntegrity: { pinnedHost: "adobedc.demdex.net", extraHosts: ["edge.adobedc.net", ...(hostOpts.edge ? [hostOpts.edge] : [])], tenantKey: "configId", pinnedTenant: DS },
  });
  const p = chamber.next();
  chamber.emit({ type: "intercepted-fetch", id: "t1", url, method: "POST", headers: {}, body: "{}", init, beacon });
  const msg = await p;
  return { msg, seen, diag };
}

describe("AC1: the fetch init is carried, not dropped", () => {
  it("keeps only the known transport fields", () => {
    expect(sanitizeFetchInit({ cache: "no-cache", credentials: "include", referrerPolicy: "no-referrer-when-downgrade", mode: "no-cors", redirect: "x", keepalive: true })).toEqual({ cache: "no-cache", credentials: "include", referrerPolicy: "no-referrer-when-downgrade", keepalive: true });
    expect(sanitizeFetchInit({ credentials: "bogus", cache: 3 })).toEqual({});
    expect(sanitizeFetchInit(undefined)).toEqual({});
  });
  it("reaches caps.egress.dispatch and the response headers return to the chamber (AC3)", async () => {
    const { msg, seen } = await run({ url: `https://edge.adobedc.net/ee/or2/v1/interact?configId=${DS}`, init: { cache: "no-cache", credentials: "include", referrerPolicy: "no-referrer-when-downgrade" } });
    expect(seen[0].init).toEqual({ cache: "no-cache", credentials: "include", referrerPolicy: "no-referrer-when-downgrade" });
    expect(msg.status).toBe(200);
    expect(msg.headers["x-adobe-edge"]).toBe("OR2;9");
  });
});

describe("AC2: sendBeacon goes through the seal", () => {
  it("is dispatched as a keepalive POST when allowed", async () => {
    const { seen } = await run({ url: `https://edge.adobedc.net/ee/or2/v1/collect?configId=${DS}`, init: { credentials: "include" }, beacon: true, response: { status: 204, statusText: "", headers: {}, body: "" } });
    expect(seen[0].init).toMatchObject({ credentials: "include", keepalive: true });
  });
  it("is held visibly when off the allowlist", async () => {
    const diag = [];
    const { msg } = await run({ url: "https://evil.example/ee/v1/collect", beacon: true, diag });
    expect(msg.status).toBe(0);
    expect(diag.some((d) => d.kind === "endpoint-ceiling" && d.disposition === "held")).toBe(true);
  });
});

describe("AC4: an unknown handle type is loud", () => {
  const body = (types) => JSON.stringify({ handle: types.map((type) => ({ type, payload: [] })) });
  it("emits an error diagnostic for an unlisted type", async () => {
    const diag = [];
    await run({ url: `https://edge.adobedc.net/ee/or2/v1/interact?configId=${DS}`, diag, response: { status: 200, statusText: "OK", headers: { "content-type": "application/json" }, body: body(["state:store", "brand:new"]) } });
    const d = diag.find((x) => x.kind === "unknown-handle");
    expect(d).toMatchObject({ level: "error", disposition: "ignored", handleTypes: ["brand:new"] });
  });
  it("is silent for every known type, including the ignored ones", async () => {
    const diag = [];
    await run({ url: `https://edge.adobedc.net/ee/or2/v1/interact?configId=${DS}`, diag, response: { status: 200, statusText: "OK", headers: { "content-type": "application/json" }, body: body(["locationHint:result", "consent:preferences", "identity:exchange", "personalization:decisions"]) } });
    expect(diag.filter((x) => x.kind === "unknown-handle")).toEqual([]);
  });
});

describe("AC5: the default allowlist covers spec 064 section 2.2", () => {
  const ok = (u) => checkEndpointCeiling(u, ALLOY_STOCK_ENDPOINTS).verdict === "allow";
  it("allows every recorded destination", () => {
    for (const u of [
      "https://adobedc.demdex.net/ee/v1/interact?configId=x",
      "https://adobedc.demdex.net/ee/v1/identity/acquire?configId=x",
      "https://adobedc.demdex.net/ee/v1/privacy/set-consent?configId=x",
      "https://edge.adobedc.net/ee/v1/interact?configId=x",
      "https://edge.adobedc.net/ee/v1/privacy/set-consent?configId=x",
      "https://edge.adobedc.net/ee/or2/v1/interact?configId=x",
      "https://edge.adobedc.net/ee/or2/v1/collect?configId=x",
      "https://edge.adobedc.net/ee/or2/v1/identity/acquire?configId=x",
      "https://edge.adobedc.net/ee/or2/v1/privacy/set-consent?configId=x",
      "https://edge.adobedc.net/ee/or2/v1/interact?configId=x&adobeAepValidationToken=t",
    ]) expect(ok(u), u).toBe(true);
  });
  it("still holds foreign hosts and odd paths", () => {
    for (const u of ["https://evil.example/ee/v1/interact", "https://edge.adobedc.net/ee/a/b/v1/interact", "https://edge.adobedc.net/ee/OR2/v1/interact", "https://edge.adobedc.net/other"]) expect(ok(u), u).toBe(false);
  });
  it("a first-party edge domain is honored only when host-set", async () => {
    const fp = "https://data.example.com/ee/or2/v1/interact";
    expect(ok(fp)).toBe(false);
    const { seen } = await run({ url: `${fp}?configId=${DS}`, hostOpts: { edge: "data.example.com" } });
    expect(seen).toHaveLength(1);
    const wrong = await run({ url: "https://data.example.com/ee/or2/v1/interact?configId=other", hostOpts: { edge: "data.example.com" } });
    expect(wrong.seen).toHaveLength(0);
    expect(() => allowlistForEdgeDomain("https://x.example/path")).toThrow();
  });
});
