// Spec 064-18 (B2): the egress bridge, replayed through the REAL chamber and seam in real Chromium.
// Extends the 064-17 replay harness (rig/adobe-b1-replay.mjs). Unlike B1, which compared what the
// chamber emitted, these assertions also read what the BROWSER sent (the `network` log) and what the
// tag got back (the chamber-side `responses` tee), so the seal's allowlist is proven on the wire.
//
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1` (the `browser-oracle` CI job).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { diffBodies, recordedInteract, replayFixture, splitRequestUrl } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 60000;
const kinds = (r, kind) => r.diagnostics.filter((d) => d.kind === kind);

describe.runIf(real)("064-18 egress bridge (real Chromium)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, T);
  afterAll(async () => { await browser?.close(); });

  describe("AC1/AC3/AC5/AC6: S0, S3, S11 leave through the seal with the recorded shape", () => {
    // S3 sent a custom XDM and an event merge id (recorded); the replay sends the same.
    const S3_EVENT = { event: "page_view", xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } }, eventMergeId: "airlock064-merge-1", _airlock064: { probe: "custom-xdm" } } };
    for (const name of ["s0-headed", "s0-headless", "s3-base", "s3-repeat", "s11-s1", "s11-s3"]) {
      it(`${name}: the browser's request carries the recorded transport and the chamber reads x-adobe-edge`, async () => {
        const r = await replayFixture(browser, name, name.includes("s3") ? { event: S3_EVENT } : {});
        const expected = recordedInteract(r.fixture);
        const [sent] = r.observed;
        expect(sent, "the chamber emitted a request").toBeTruthy();
        expect(splitRequestUrl(sent.url).stable).toBe(splitRequestUrl(expected.url).stable);
        expect(diffBodies(sent.body, expected.request_body)).toEqual([]);

        // The fetch init is carried through the bridge (not dropped).
        expect(sent.init).toEqual({ cache: "no-cache", credentials: "include", referrerPolicy: "no-referrer-when-downgrade" });
        expect(r.responses[0].status).toBe(200);

        // It is on the network: the endpoint ceiling no longer holds it, and Chromium applied the init.
        const seen = r.network.find((n) => n.url === sent.url);
        expect(seen, "the request reached the network").toBeTruthy();
        for (const h of ["referer", "origin", "content-type", "accept-language", "accept"]) {
          expect(seen.headers[h], h).toBe(expected.request_headers[h]);
        }

        // The response headers come back to the chamber, so Alloy can read the edge cluster.
        const recorded = expected.response_headers["x-adobe-edge"];
        expect(recorded).toBeTruthy();
        expect(r.responses[0].headers["x-adobe-edge"]).toBe(recorded);
        expect(r.responses[0].status).toBe(200);
        expect(kinds(r, "unknown-handle")).toEqual([]);
      }, T);
    }
  });

  describe("AC5: every spec 064 section 2.2 destination crosses the seal", () => {
    it("identity/acquire on demdex (S5 fresh) is no longer held", async () => {
      const r = await replayFixture(browser, "s5-fresh");
      expect(r.results.getIdentity.error).toBeUndefined();
      expect(r.network.some((n) => n.url.includes("/ee/v1/identity/acquire"))).toBe(true);
      expect(kinds(r, "endpoint-ceiling")).toEqual([]);
    }, T);

    it("a returning profile reaches edge.adobedc.net with the location-hint path (S2)", async () => {
      const r = await replayFixture(browser, "s2-base");
      expect(r.network.some((n) => /edge\.adobedc\.net\/ee\/[a-z0-9]+\/v1\/interact/.test(n.url) || /edge\.adobedc\.net\/ee\/v1\/interact/.test(n.url))).toBe(true);
      expect(kinds(r, "endpoint-ceiling")).toEqual([]);
    }, T);

    it("S6 transport: set-consent leaves on the recorded host and path", async () => {
      const r = await replayFixture(browser, "s6-in", { commands: [{ command: "setConsent", options: { consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }] } }] });
      const recorded = r.fixture.requests.find((q) => q.url.includes("/privacy/set-consent"));
      const sent = r.observed.find((o) => o.url.includes("/privacy/set-consent"));
      expect(sent, "set-consent emitted").toBeTruthy();
      expect(splitRequestUrl(sent.url).stable).toBe(splitRequestUrl(recorded.url).stable);
      expect(diffBodies(sent.body, recorded.request_body)).toEqual([]);
      expect(r.network.some((n) => n.url === sent.url)).toBe(true);
    }, T);
  });

  describe("AC3: edge domain kind", () => {
    it("a first-party edge domain is honored when the host sets it, with the same tenant pin", async () => {
      // A returning profile skips the demdex first hop, so its first request goes to the edge domain.
      const r = await replayFixture(browser, "s2-base", { bootOptions: { edgeDomain: "data.example.com" }, extraHosts: ["data.example.com"] });
      const [sent] = r.observed;
      expect(new URL(sent.url).hostname).toBe("data.example.com");
      expect(r.network.some((n) => new URL(n.url).hostname === "data.example.com")).toBe(true);
      expect(kinds(r, "endpoint-ceiling")).toEqual([]);
    }, T);

    it("without the host option the default Adobe edge domain is used", async () => {
      const r = await replayFixture(browser, "s2-base");
      expect(new URL(r.observed[0].url).hostname).toBe("edge.adobedc.net");
    }, T);

    it("credentials: include is applied on the main thread: a wildcard CORS answer fails the request", async () => {
      const r = await replayFixture(browser, "s1-base", { respond: () => ({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" }) });
      expect(r.responses[0].status).toBe(0);
    }, T);
  });

  describe("AC6: S8 error shapes cross the bridge", () => {
    it("blocked network: both hosts fail, the chamber sees status 0 (a rejected fetch), nothing is silent", async () => {
      const r = await replayFixture(browser, "s8-blocked");
      expect(r.observed.map((o) => new URL(o.url).hostname)).toEqual(["adobedc.demdex.net", "edge.adobedc.net"]);
      expect(r.responses.map((x) => x.status)).toEqual([0, 0]);
      expect(r.observed.map((o) => splitRequestUrl(o.url).stable)).toEqual(r.fixture.requests.filter((q) => q.method === "POST").map((q) => splitRequestUrl(q.url).stable));
    }, T);

    it("non-200: the recorded 400 and its body reach the chamber unchanged", async () => {
      const r = await replayFixture(browser, "s8-non200");
      const recorded = recordedInteract(r.fixture);
      expect(r.responses[0].status).toBe(400);
      expect(r.responses[0].headers["x-adobe-edge"]).toBe(recorded.response_headers["x-adobe-edge"]);
      expect(r.observed).toHaveLength(1);
    }, T);
  });

  describe("AC2: beacons, pixels and element loads are routed or visibly tagged", () => {
    it("a beacon on an allowed destination is bridged as a keepalive POST", async () => {
      const url = "https://edge.adobedc.net/ee/or2/v1/collect?configId=23190fa7-9e6b-4250-b87b-abcdc8ebc297";
      const r = await replayFixture(browser, "s1-base", { commands: [{ command: "rig:sendBeacon", options: { url, body: "{}" } }] });
      expect(r.results["rig:sendBeacon"].result).toBe(true);
      const sent = r.observed.find((o) => o.beacon);
      expect(sent.init).toMatchObject({ credentials: "include", keepalive: true });
      expect(r.network.some((n) => n.url === url && n.method === "POST")).toBe(true);
    }, T);

    it("a beacon off the allowlist is held with a visible diagnostic", async () => {
      const r = await replayFixture(browser, "s1-base", { commands: [{ command: "rig:sendBeacon", options: { url: "https://tracker.example/b", body: "{}" } }] });
      expect(kinds(r, "endpoint-ceiling").some((d) => d.destination?.includes("tracker.example"))).toBe(true);
      expect(r.network.some((n) => n.url.includes("tracker.example"))).toBe(false);
    }, T);

    for (const [tag, url] of [["IMG", "https://cm.everesttech.net/cm/dd?d_uuid=x"], ["IFRAME", "https://pixel.everesttech.net/1/gr?x=1"], ["SCRIPT", "https://cdn.example/x.js"]]) {
      it(`a ${tag} load in the chamber is tagged with its reason, not swallowed`, async () => {
        const r = await replayFixture(browser, "s1-base", { commands: [{ command: "rig:loadElement", options: { tag, url } }] });
        const d = kinds(r, "unbridged-load").find((x) => x.tag === tag);
        expect(d).toMatchObject({ disposition: "not-bridged" });
        expect(d.reason).toMatch(/not-bridged/);
      }, T);
    }
  });

  describe("AC4: an unknown handle type is loud", () => {
    it("emits an error diagnostic for a type outside the known list", async () => {
      const body = JSON.stringify({ requestId: "x", handle: [{ type: "state:store", payload: [] }, { type: "brand:new", payload: [] }] });
      const r = await replayFixture(browser, "s1-base", { respond: () => ({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": new URL(r0Origin).origin, "access-control-allow-credentials": "true" }, body }) });
      expect(kinds(r, "unknown-handle")[0]).toMatchObject({ level: "error", handleTypes: ["brand:new"] });
    }, T);

    it("the recorded corpus raises none: every observed type is on the known list", async () => {
      const r = await replayFixture(browser, "s9-05");
      expect(kinds(r, "unknown-handle")).toEqual([]);
      // The recorded identity:exchange asks for ID-sync pixels; they are tagged, not silently dropped.
      expect(kinds(r, "unbridged-load").some((d) => d.tag === "IMG" && d.destination === "cm.everesttech.net")).toBe(true);
    }, T);
  });
});

const r0Origin = "https://main--aem-eds-airlock-poc--adobe-rnd.aem.page";
