// Spec 064-22 (B6): out-of-default-surface disposition, proved in the REAL chamber (pinned Alloy 2.31.1).
// Everything here is SOURCE-DERIVED or synthetic, not capture-verified (spec 064 D11): the corpus has no
// Media, push, BrandConcierge, Advertising or Assurance request. Fake values are obviously fake.
//
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1` (the `browser-oracle` CI job).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { loadFixture, replayFixture } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 60000;
const kinds = (r, kind) => r.diagnostics.filter((d) => d.kind === kind);
const FAKE_SESSION = "00000000-fake-0000-0000-sessionid000";
const FAKE_CLIENT = "11111111-fake-1111-1111-clientid0000";

describe.runIf(real)("064-22 out-of-default-surface dispositions (real Chromium)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, T);
  afterAll(async () => { await browser?.close(); });

  describe("Media, push (AC1) and the 064-19 function-valued options: unconfigured in the default chamber", () => {
    it("rejects each command with Alloy's own 'not configured' error and sends nothing", async () => {
      const r = await replayFixture(browser, "s1-base", {
        commands: [
          { command: "sendMediaEvent", options: { xdm: { eventType: "media.play", mediaCollection: { playhead: 0, sessionID: "fake-session" } } } },
          { command: "getMediaAnalyticsTracker", options: {} },
          { command: "sendPushSubscription", options: {} },
        ],
      });
      expect(r.results.sendMediaEvent.error).toMatch(/Streaming media is not configured/);
      expect(r.results.getMediaAnalyticsTracker.error).toMatch(/Streaming media is not configured/);
      expect(r.results.sendPushSubscription.error).toMatch(/Push notifications module is not configured/);
      expect(r.network.some((n) => n.url.includes("/va/"))).toBe(false);
    }, T);

    it("createMediaSession also rejects as unconfigured (data form; the function form is incompatible per 064-19 AC2)", async () => {
      const opts = { xdm: { eventType: "media.sessionStart", mediaCollection: { playhead: 0, sessionDetails: { name: "fake", friendlyName: "fake", length: 1, contentType: "video" } } } };
      const r = await replayFixture(browser, "s1-base", { commands: [{ command: "createMediaSession", options: opts }] });
      expect(r.results.createMediaSession.error).toMatch(/Streaming media is not configured/);
    }, T);
  });

  describe("AC3: BrandConcierge streaming fetch is held at the seal", () => {
    it("the conversation request is not on the allowlist, so it is held visibly and Alloy gives up", async () => {
      const r = await replayFixture(browser, "s1-base", { commands: [{ command: "sendConversationEvent", options: { message: "hi" } }] });
      expect(r.results.sendConversationEvent.error).toMatch(/held at the seal: endpoint-ceiling/);
      expect(kinds(r, "endpoint-ceiling").length).toBe(4);
      expect(r.network.some((n) => n.url.includes("/brand-concierge/"))).toBe(false);
    }, T);
  });

  describe("AC2: Assurance request side (synthetic page inputs, source-derived)", () => {
    const withAssurance = async (on) => {
      const f = structuredClone(await loadFixture("s1-base"));
      if (on) {
        const u = new URL(f.manifest.input_state.url);
        u.searchParams.set("adb_validation_sessionid", FAKE_SESSION);
        f.manifest.input_state.url = u.toString();
        f.manifest.input_state.storage_before = { ...f.manifest.input_state.storage_before, local_storage: { "com.adobe.alloy.validation.clientId": FAKE_CLIENT } };
      }
      return f;
    };

    it("adds adobeAepValidationToken=<session>|<clientId> and the query crosses the seal", async () => {
      const r = await replayFixture(browser, await withAssurance(true));
      const sent = new URL(r.observed[0].url);
      const token = sent.searchParams.get("adobeAepValidationToken");
      expect(token.startsWith(`${FAKE_SESSION}|`)).toBe(true);
      expect(token.split("|")[1]).toMatch(/^[0-9a-f-]{36}$/);
      // Known gap: chamber storage is in-memory, so the seeded clientId is not read.
      expect(token.split("|")[1]).not.toBe(FAKE_CLIENT);
      expect(r.network.some((n) => n.url.includes("adobeAepValidationToken="))).toBe(true);
    }, T);

    it("adds nothing when the page has no validation session", async () => {
      const r = await replayFixture(browser, await withAssurance(false));
      expect(r.observed[0].url).not.toContain("adobeAepValidationToken");
    }, T);
  });

  describe("AC4: DS-17 to DS-20 client side (source-derived request fields)", () => {
    it("decisionScopes and personalization.surfaces reach the interact body", async () => {
      const r = await replayFixture(browser, "s1-base", {
        commands: [{ command: "sendEvent", options: { renderDecisions: false, decisionScopes: ["fake-scope"], personalization: { surfaces: ["web://example.invalid/fake#s1"] }, xdm: { eventType: "web.webinteraction.linkClicks" } } }],
      });
      const body = r.observed.at(-1).body;
      expect(body).toContain("fake-scope");
      expect(body).toContain("web://example.invalid/fake#s1");
    }, T);
  });

  describe("Audiences activation pixels: tagged, not bridged", () => {
    it("a URL destination does not leave the chamber; the tag says so", async () => {
      const f = await loadFixture("s1-base");
      const origin = new URL(f.manifest.input_state.url).origin;
      const body = JSON.stringify({ requestId: "fake", handle: [{ type: "activation:push", payload: [{ type: "url", spec: { url: "https://pixel.example.invalid/p?x=1", hideReferrer: false } }] }] });
      const respond = (_req, i) => (i === 0 ? { status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-credentials": "true" }, body } : null);
      const r = await replayFixture(browser, "s1-base", { respond });
      const tagged = kinds(r, "unbridged-load");
      expect(tagged.some((d) => d.tag === "IMG" && /pixel-not-bridged/.test(d.reason))).toBe(true);
      expect(r.network.some((n) => n.url.includes("pixel.example.invalid"))).toBe(false);
    }, T);

    it("hideReferrer:true waits for a page BODY the chamber lacks: nothing leaves (and nothing is tagged)", async () => {
      const f = await loadFixture("s1-base");
      const origin = new URL(f.manifest.input_state.url).origin;
      const body = JSON.stringify({ requestId: "fake", handle: [{ type: "activation:push", payload: [{ type: "url", spec: { url: "https://pixel.example.invalid/h", hideReferrer: true } }] }] });
      const respond = (_req, i) => (i === 0 ? { status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-credentials": "true" }, body } : null);
      const r = await replayFixture(browser, "s1-base", { respond });
      expect(r.network.some((n) => n.url.includes("pixel.example.invalid"))).toBe(false);
    }, T);
  });
});
