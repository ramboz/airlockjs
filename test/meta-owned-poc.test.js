import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";
import { createNodePrototypeChamber } from "../rig/meta-pageview-prototype.mjs";

const endpoint = "https://www.facebook.com/tr/";
const documentURL = "https://main--aem-eds-airlock-poc--adobe-rnd.aem.live/?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=synthetic_1";
const binding = () => ({ pixelId: "123456789012345", documentURL, notBefore: Date.now() - 1000, notAfter: Date.now() + 30000 });
const context = { pageURL: documentURL, referrer: "", inFrame: false, screenWidth: 412, screenHeight: 823, timezoneOffset: -420 };

describe("owned POC binding", () => {
  it("accepts only the exact closed document and window in both constructors", async () => {
    for (const factory of [createMetaPixelPrototype, createMetaPageViewPrototype]) {
      for (const invalid of [
        { ...binding(), extra: true },
        { ...binding(), documentURL: documentURL.replace("aem.live", "aem.page") },
        { ...binding(), documentURL: `${documentURL}&extra=1` },
        { ...binding(), documentURL: documentURL.replace("run=", "%72un=") },
        { ...binding(), documentURL: `${documentURL}\n` },
        { ...binding(), documentURL: documentURL.replace("meta-pixel=off&consent=accept", "consent=accept&meta-pixel=off") },
        { ...binding(), notBefore: 1, notAfter: 360002 },
        { ...binding(), notBefore: NaN },
      ]) expect(() => factory({ endpoint, ownedPocBinding: invalid })).toThrow();
      expect(() => factory({ endpoint, ownedPocBinding: binding(), experimentalEvents: true })).toThrow();
      expect(() => factory({ endpoint, ownedPocBinding: binding(), liveBinding: {} })).toThrow();
    }
    const adapter = createMetaPixelPrototype({ endpoint, ownedPocBinding: binding(), chamber: createNodePrototypeChamber() });
    await adapter.dispose();
    const connector = createMetaPageViewPrototype({ endpoint, ownedPocBinding: binding() });
    connector.init({});
  });

  it("serializes the binding to the real worker and spends one Fetch", async () => {
    const chamber = createNodePrototypeChamber();
    const fetchImpl = vi.fn(async () => ({ type: "cors", status: 204, body: null }));
    const adapter = createMetaPixelPrototype({ endpoint, ownedPocBinding: binding(), chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, fetchImpl });
    try {
      adapter.fbq("init", "123456789012345");
      adapter.fbq("track", "PageView");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(state.outcomes[1]).toMatchObject({ disposition: "transport-settled", status: 204 });
      expect(state.outcomes[2]).toMatchObject({ disposition: "failed", reason: "policy-rejected" });
    } finally { await adapter.dispose(); await chamber.dispose(); }
  }, 10000);

  it.each([
    { ...binding(), documentURL: `${documentURL}&extra=1` },
    { ...binding(), notBefore: 1, notAfter: 360002 },
    { ...binding(), extra: true },
  ])("rejects forged serialized worker configuration", async (ownedPocBinding) => {
    const chamber = createNodePrototypeChamber();
    try {
      const fatal = new Promise((resolve) => chamber.onMessage((message) => {
        if (message.type === "fatal") resolve(message);
      }));
      chamber.postMessage({ type: "init", endpoint, ownedPocBinding, transportTimeoutMs: 1000 });
      expect(await fatal).toEqual({ type: "fatal", message: "worker-configuration-failed" });
    } finally { await chamber.dispose(); }
  }, 10000);

  it("holds work across revoke and regrant without replay", async () => {
    const chamber = createNodePrototypeChamber();
    const fetchImpl = vi.fn();
    const adapter = createMetaPixelPrototype({ endpoint, ownedPocBinding: binding(), chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, fetchImpl });
    try {
      adapter.fbq("init", "123456789012345");
      adapter.fbq("track", "PageView");
      adapter.setConsent({ ad_storage: "denied" });
      adapter.setConsent({ ad_storage: "granted" });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "held", status: 0 });
      expect(fetchImpl).not.toHaveBeenCalled();
      await adapter.flush();
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); await chamber.dispose(); }
  }, 10000);

  it("checks expiry immediately before dispatch despite later input mutation", async () => {
    const original = { ...binding(), notBefore: 1, notAfter: 2 };
    const chamber = createNodePrototypeChamber();
    const fetchImpl = vi.fn();
    const adapter = createMetaPixelPrototype({ endpoint, ownedPocBinding: original, chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, fetchImpl });
    original.notBefore = Date.now() - 1000;
    original.notAfter = Date.now() + 30000;
    try {
      adapter.fbq("init", "123456789012345");
      adapter.fbq("track", "PageView");
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "policy-rejected" });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); await chamber.dispose(); }
  }, 10000);

  it("aborts an in-flight Fetch on revocation without retrying after regrant", async () => {
    const chamber = createNodePrototypeChamber();
    let started;
    const waiting = new Promise((resolve) => { started = resolve; });
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      started();
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const adapter = createMetaPixelPrototype({ endpoint, ownedPocBinding: binding(), chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, fetchImpl });
    try {
      adapter.fbq("init", "123456789012345");
      adapter.fbq("track", "PageView");
      await waiting;
      adapter.setConsent({ ad_storage: "denied" });
      adapter.setConsent({ ad_storage: "granted" });
      const state = await adapter.flush();
      expect(state.outcomes.at(-1)).toMatchObject({ disposition: "failed", reason: "transport-aborted" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally { await adapter.dispose(); await chamber.dispose(); }
  }, 10000);

  it.each(["pixel", "document", "extra", "duplicate", "event"])("rejects forged %s request", async (kind) => {
    const query = new URLSearchParams({ id: "123456789012345", ev: "PageView", dl: documentURL,
      rl: "", if: "false", sw: "412", sh: "823", tz: "420" });
    if (kind === "pixel") query.set("id", "999");
    if (kind === "document") query.set("dl", `${documentURL}x`);
    if (kind === "extra") query.set("fbp", "synthetic");
    if (kind === "duplicate") query.append("id", "123456789012345");
    if (kind === "event") query.set("ev", "Purchase");
    let listener;
    const chamber = {
      onMessage(fn) { listener = fn; return () => {}; }, onError() { return () => {}; }, dispose() {},
      postMessage(message) {
        if (message.type === "init") queueMicrotask(() => listener({ type: "phase", name: "configured" }));
        if (message.type === "event") queueMicrotask(() => listener({
          type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?${query}`,
        }));
      },
    };
    const fetchImpl = vi.fn();
    const adapter = createMetaPixelPrototype({ endpoint, ownedPocBinding: binding(), chamber,
      captureContext: () => context, consent: { ad_storage: "granted" }, fetchImpl });
    try {
      await adapter.ready();
      adapter.fbq("track", "PageView");
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });
});
