import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootAlloy, createAlloyCommandBridge, classifyAdobeConsent } from "../adapters/eds/index.js";
import { shapeAlloyConsent } from "../connectors/alloy/consent.js";

// Slice 064-30 (ADR-0064): the stock Adobe consent path. HERMETIC tests: a fake Worker records what the
// adapter posts; the chamber's own handling is exercised against the real worker file in the second half.
// The real-Chromium proof (the set-consent body and host equal stock's) is test/adobe-b5-martech.test.js.
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const DS = "12345678-1234-1234-1234-123456789012";
const entry = (extra = {}) => ({ type: "alloy", bundleUrl: "https://airlock.example/alloy.js", datastreamId: DS, orgId: "ORG@AdobeOrg", ...extra });

const adobe = (value, version = "2.0") => ({ standard: "Adobe", version, value });
const FULL = adobe({ collect: { val: "y" }, marketing: { preferred: "email", any: { val: "y" } }, personalize: { content: { val: "y" } }, share: { val: "y" } });
const REFUSAL = adobe({ collect: { val: "n" }, personalize: { content: { val: "n" } } });
const TCF = { standard: "IAB TCF", version: "2.0", value: "CPxyz" };

class Worker {
  constructor() { this.handlers = []; this.messages = []; this.n = 0; Worker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() {}
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  fire() {
    this.n += 1;
    this.emit({ type: "intercepted-fetch", id: `f${this.n}`, url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    if (m.type === "intercepted-fetch-response") setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
  }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
  vi.stubGlobal("Worker", Worker);
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const boot = async (extra = {}) => {
  const diags = [];
  const handle = await bootAlloy(entry({ onDiagnostic: (d) => diags.push(d), ...extra }));
  return { handle, diags, worker: Worker.last };
};
const types = (worker) => worker.messages.map((m) => m.type);

describe("064-30 AC5: classifyAdobeConsent (the readable-shape rule)", () => {
  it("sends the whole array only for one first Adobe 2.0 entry with y/n values and plain data", () => {
    const r = classifyAdobeConsent([FULL, TCF]);
    expect(r.kind).toBe("send");
    expect(r.consent).toEqual([FULL, TCF]);
    expect(r.vector).toEqual({ analytics_storage: "granted", personalization: "granted" });
  });

  it.each([
    ["a TCF entry first", [TCF, REFUSAL]],
    ["two Adobe entries", [REFUSAL, FULL]],
    ["an Adobe version that is not 2.0", [adobe({ collect: { val: "y" } }, "1.0")]],
    ["no collect", [adobe({ personalize: { content: { val: "y" } } })]],
    ["a collect val that is not y or n", [adobe({ collect: { val: "yes" } })]],
    ["a personalize.content val that is not y or n", [adobe({ collect: { val: "y" }, personalize: { content: { val: "maybe" } } })]],
    ["a function inside the object", [adobe({ collect: { val: "n" }, hook: () => 1 })]],
  ])("falls back to the vector for %s", (_name, consent) => {
    const r = classifyAdobeConsent(consent);
    expect(r.kind).toBe("fallback");
    expect(r.reason).toEqual(expect.any(String));
    expect(r.vector).toBeTruthy();
  });

  it("keeps the opt-out vector for [TCF, Adobe collect n]", () => {
    expect(classifyAdobeConsent([TCF, REFUSAL]).vector.analytics_storage).toBe("denied");
  });

  it.each([[[]], [[TCF]], [null], ["y"]])("reports no readable Adobe entry for %j", (consent) => {
    expect(classifyAdobeConsent(consent).kind).toBe("none");
  });

  it("never lets a non-y collect val derive a granted analytics_storage (AC2a)", () => {
    for (const val of ["yes", "Y", "", 1, null]) {
      expect(classifyAdobeConsent([adobe({ collect: { val } })]).vector.analytics_storage).toBe("denied");
    }
  });
});

describe("064-30 bridge: setConsent -> handle.setAdobeConsent", () => {
  const rig = (handle) => {
    const diags = [];
    return { alloy: createAlloyCommandBridge(handle, { onDiagnostic: (d) => diags.push(d) }), diags };
  };

  it("hands the page's object to the handle and nothing else", async () => {
    const handle = { setAdobeConsent: vi.fn(), setConsent: vi.fn() };
    await rig(handle).alloy("setConsent", { consent: [FULL] });
    expect(handle.setAdobeConsent).toHaveBeenCalledWith([FULL]);
    expect(handle.setAdobeConsent.mock.calls[0]).toHaveLength(1);
    expect(handle.setConsent).not.toHaveBeenCalled();
  });

  it("falls back to handle.setConsent(vector) for a handle with no setAdobeConsent (consent is never lost)", async () => {
    const handle = { setConsent: vi.fn() };
    await rig(handle).alloy("setConsent", { consent: [FULL] });
    expect(handle.setConsent).toHaveBeenCalledWith({ analytics_storage: "granted", personalization: "granted" });
  });

  it("applies nothing and says so when there is no Adobe entry with collect or personalize", async () => {
    const handle = { setAdobeConsent: vi.fn(), setConsent: vi.fn() };
    const { alloy, diags } = rig(handle);
    await alloy("setConsent", { consent: [TCF] });
    expect(handle.setAdobeConsent).not.toHaveBeenCalled();
    expect(handle.setConsent).not.toHaveBeenCalled();
    expect(diags.map((d) => d.kind)).toEqual(["unsupported-consent"]);
  });
});

describe("064-30 AC2/AC5/AC6: handle.setAdobeConsent on a booted chamber", () => {
  it("(d) posts the object message first, then the vector message, and by return the seal holds the new vector and parked requests are released", async () => {
    const { handle, worker } = await boot();
    worker.fire(); // parked at the seal: no consent yet
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();

    const before = worker.messages.length;
    handle.setAdobeConsent([FULL]);
    expect(types(worker).slice(before)).toEqual(["adobeConsent", "setConsent"]);
    expect(worker.messages[before].consent).toEqual([FULL]);
    expect(worker.messages[before + 1].consent).toEqual({ analytics_storage: "granted", personalization: "granted" });
    await tick(80);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a partial object keeps the earlier purposes in the vector the adapter posts", async () => {
    const { handle, worker } = await boot();
    handle.setConsent({ analytics_storage: "granted", personalization: "granted" });
    handle.setAdobeConsent([adobe({ collect: { val: "n" } })]);
    expect(worker.messages.filter((m) => m.type === "setConsent").at(-1).consent).toEqual({ analytics_storage: "denied", personalization: "granted" });
  });

  it("(a) takes the object only: an extra vector argument is ignored", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent([REFUSAL], { analytics_storage: "granted" });
    const vector = worker.messages.filter((m) => m.type === "setConsent").at(-1).consent;
    expect(vector.analytics_storage).toBe("denied");
  });

  it("(b, c) an adobeConsent message from the chamber neither changes the seal nor releases or admits a request", async () => {
    const { handle, worker } = await boot(); // consent pending: requests park at the seal
    worker.fire();
    worker.emit({ type: "adobeConsent", consent: [FULL] });
    worker.fire(); // a request made after the chamber's object message
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handle.getState().consentHeld).toBe(2);
  });

  it.each([
    ["a TCF entry first", [TCF, REFUSAL], "denied"],
    ["a val of yes", [adobe({ collect: { val: "yes" } })], "denied"],
    ["a version that is not 2.0", [adobe({ collect: { val: "y" } }, "1.0")], "granted"],
    ["a function in the object", [adobe({ collect: { val: "y" }, hook: () => 1 })], "granted"],
  ])("AC5 fallback for %s: no adobeConsent message, a diagnostic, the vector still applied", async (_n, consent, expected) => {
    const { handle, worker, diags } = await boot();
    handle.setAdobeConsent(consent);
    expect(types(worker)).not.toContain("adobeConsent");
    expect(diags.filter((d) => d.kind === "consent-object-fallback")).toHaveLength(1);
    expect(worker.messages.filter((m) => m.type === "setConsent").at(-1).consent.analytics_storage).toBe(expected);
  });

  it("AC5: a Proxy whose traps throw never loses the call: nothing is posted and a diagnostic says so", async () => {
    const { handle, worker, diags } = await boot();
    const before = worker.messages.length;
    const bad = new Proxy([], { getPrototypeOf() { throw new Error("trap"); }, ownKeys() { throw new Error("trap"); } });
    expect(() => handle.setAdobeConsent(bad)).not.toThrow();
    expect(worker.messages).toHaveLength(before);
    expect(diags.some((d) => d.kind === "unsupported-consent")).toBe(true);
  });

  it("AC5: a revoked Proxy does not throw out of the bridge's setConsent", async () => {
    const { handle } = await boot();
    const { proxy, revoke } = Proxy.revocable([], {});
    revoke();
    await expect(createAlloyCommandBridge(handle)("setConsent", { consent: proxy })).resolves.toEqual({});
  });

  it("AC5: no readable Adobe entry posts nothing and leaves the seal alone", async () => {
    const { handle, worker, diags } = await boot();
    const before = worker.messages.length;
    handle.setAdobeConsent([TCF]);
    expect(worker.messages).toHaveLength(before);
    expect(diags.some((d) => d.kind === "unsupported-consent")).toBe(true);
  });

  it("AC5: with no consent ref (consentHold:false, no consent) it does nothing, like setConsent", async () => {
    const { handle, worker } = await boot({ consentHold: false });
    const before = worker.messages.length;
    handle.setAdobeConsent([FULL]);
    handle.setConsent({ analytics_storage: "granted" });
    expect(worker.messages).toHaveLength(before);
  });

  it("AC6: a direct handle.setConsent(vector) posts only the vector message", async () => {
    const { handle, worker } = await boot();
    handle.setConsent({ analytics_storage: "granted" });
    expect(types(worker)).not.toContain("adobeConsent");
    expect(types(worker)).toContain("setConsent");
  });
});

describe("064-30 AC4: the full-object refusal still forwards (068-02 opt-out)", () => {
  it("a refusal sent through setAdobeConsent forwards only consent and meta, with the full object inside consent", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent([REFUSAL]);
    const body = JSON.stringify({ consent: [REFUSAL], query: { identity: { fetch: ["ECID"] } }, meta: { state: { domain: "site.example" } } });
    worker.emit({ type: "intercepted-fetch", id: "o1", url: "https://adobedc.demdex.net/ee/v1/privacy/set-consent?configId=" + DS, method: "POST", headers: {}, body });
    await tick(60);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(sent).sort()).toEqual(["consent", "meta"]);
    expect(sent.consent).toEqual([REFUSAL]);
  });
});

// Slice 064-33 (ADR-0062 amendment, 068-03): the opt-out forward carries only a `consent` the adapter registered.
// HERMETIC (fake Worker, mocked fetch); there is no real-Chromium test in this slice.
describe("064-33: the opt-out forward carries only the consent the adapter registered", () => {
  const SET_CONSENT = `https://adobedc.demdex.net/ee/v1/privacy/set-consent?configId=${DS}`;
  const VECTOR_REFUSAL = [{ standard: "Adobe", version: "2.0", value: { collect: { val: "n" } } }];
  const DENIED = { analytics_storage: "denied", personalization: "denied" };
  const wire = (consent) => JSON.stringify({ consent, query: { identity: { fetch: ["ECID"] } }, meta: { state: { domain: "site.example" } } });
  const send = (worker, id, consent) => worker.emit({ type: "intercepted-fetch", id, url: SET_CONSENT, method: "POST", headers: {}, body: wire(consent) });
  const forwarded = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/privacy/set-consent")).map((c) => JSON.parse(c[1].body));

  it("a boot-time denial forwards the vector-shaped refusal, and a tampered one is held", async () => {
    const { worker } = await boot({ consent: { ...DENIED } });
    send(worker, "b1", VECTOR_REFUSAL);
    send(worker, "b2", [{ ...VECTOR_REFUSAL[0], extra: "data" }]);
    await tick(60);
    const sent = forwarded();
    expect(sent).toHaveLength(1);
    expect(sent[0].consent).toEqual(VECTOR_REFUSAL);
    expect(Object.keys(sent[0]).sort()).toEqual(["consent", "meta"]);
  });

  it("a direct handle.setConsent denial forwards the vector refusal and holds a tampered one", async () => {
    const { handle, worker } = await boot({ consent: { analytics_storage: "granted", personalization: "granted" } });
    handle.setConsent({ ...DENIED });
    send(worker, "d1", [{ ...VECTOR_REFUSAL[0], version: "9.9" }]);
    send(worker, "d2", VECTOR_REFUSAL);
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([VECTOR_REFUSAL]);
  });

  it("the page's object forwards on the object path and a tampered object is held", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent([REFUSAL]);
    const tampered = adobe({ collect: { val: "n" }, personalize: { content: { val: "n" } }, share: { val: "y" } });
    send(worker, "o1", [tampered]);
    send(worker, "o2", [REFUSAL]);
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([[REFUSAL]]);
  });

  it("the chamber's one retry with the vector-shaped consent still forwards after the object path", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent([REFUSAL]);
    send(worker, "r1", [REFUSAL]);
    send(worker, "r2", VECTOR_REFUSAL);
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([[REFUSAL], VECTOR_REFUSAL]);
  });

  it("the 064-30 fallback registers the vector, not the unreadable object", async () => {
    const { handle, worker } = await boot();
    const unreadable = [adobe({ collect: { val: "n" } }, "1.0")];
    handle.setAdobeConsent(unreadable);
    send(worker, "f1", unreadable);
    send(worker, "f2", VECTOR_REFUSAL);
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([VECTOR_REFUSAL]);
  });

  it("an object the chamber never received (postMessage throws) is not registered", async () => {
    const { handle, worker } = await boot();
    const orig = worker.postMessage.bind(worker);
    worker.postMessage = (m) => { if (m.type === "adobeConsent") throw new Error("gone"); orig(m); };
    handle.setAdobeConsent([REFUSAL]);
    send(worker, "t1", [REFUSAL]);
    send(worker, "t2", VECTOR_REFUSAL);
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([VECTOR_REFUSAL]);
  });

  it("a falsy handle.setConsent leaves the registration and the page object as they were", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent([REFUSAL]);
    handle.setConsent(null);
    send(worker, "n1", [REFUSAL]);
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([[REFUSAL]]);
  });

  it("a later handle.setConsent keeps the page object registered while its request may be in flight (064-34)", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent([REFUSAL]);
    handle.setConsent({ ...DENIED });
    send(worker, "s1", VECTOR_REFUSAL);
    send(worker, "s2", [REFUSAL]); // the vector is in the object's generation too, so it retires nothing
    await tick(60);
    expect(forwarded().map((b) => b.consent)).toEqual([VECTOR_REFUSAL, [REFUSAL]]);
  });
});

// Slice 064-34: two same-tick consent updates keep both registrations until a newer update's request leaves.
// HERMETIC (fake Worker, mocked fetch); the real-Chromium half is test/adobe-064-34-consent-refusal-chromium.test.js.
describe("064-34: an opt-out in flight for a superseded consent update still forwards", () => {
  const SET_CONSENT = `https://adobedc.demdex.net/ee/v1/privacy/set-consent?configId=${DS}`;
  const FIRST = [adobe({ collect: { val: "n" }, share: { val: "y" } })];
  const SECOND = [REFUSAL];
  const send = (worker, id, consent) => worker.emit({ type: "intercepted-fetch", id, url: SET_CONSENT, method: "POST", headers: {}, body: JSON.stringify({ consent, meta: { state: {} } }) });
  const forwarded = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/privacy/set-consent")).map((c) => JSON.parse(c[1].body).consent);

  it("setAdobeConsent then setConsent: both requests forward, a never-registered one is held", async () => {
    const { handle, worker } = await boot();
    const DENIED = { analytics_storage: "denied", personalization: "denied" };
    handle.setAdobeConsent(FIRST);
    handle.setConsent({ ...DENIED });
    send(worker, "a1", FIRST);
    send(worker, "a2", [adobe({ collect: { val: "n" }, marketing: { any: { val: "y" } } })]);
    send(worker, "a3", shapeAlloyConsent(DENIED).consent);
    await tick(60);
    expect(forwarded()).toEqual([FIRST, shapeAlloyConsent(DENIED).consent]);
  });

  it("two setAdobeConsent calls: both requests forward, a never-registered one is held", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent(FIRST);
    handle.setAdobeConsent(SECOND);
    send(worker, "b1", FIRST);
    send(worker, "b2", [adobe({ collect: { val: "n" }, personalize: { content: { val: "y" } } })]);
    send(worker, "b3", SECOND);
    await tick(60);
    expect(forwarded()).toEqual([FIRST, SECOND]);
  });

  it("a superseded registration retires once a newer update's request has left", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent(FIRST);
    handle.setAdobeConsent(SECOND);
    send(worker, "c1", SECOND);
    await tick(30);
    send(worker, "c2", FIRST);
    await tick(60);
    expect(forwarded()).toEqual([SECOND]);
  });

  it("a value repeated in a later update does not retire one still in flight, and a key-reordered request still matches", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent(FIRST);
    handle.setAdobeConsent(SECOND);
    handle.setAdobeConsent(FIRST);
    handle.setAdobeConsent(FIRST);
    const reordered = [{ standard: "Adobe", version: "2.0", value: { share: { val: "y" }, collect: { val: "n" } } }];
    send(worker, "e1", reordered);
    send(worker, "e2", SECOND);
    send(worker, "e3", FIRST);
    await tick(60);
    expect(forwarded()).toEqual([reordered, SECOND, FIRST]);
  });

  it("a request for the newest update leaves nothing else retired, and a later update still adds", async () => {
    const { handle, worker } = await boot();
    handle.setAdobeConsent(FIRST);
    send(worker, "d1", FIRST);
    await tick(30);
    handle.setAdobeConsent(SECOND);
    send(worker, "d2", FIRST);
    send(worker, "d3", SECOND);
    await tick(60);
    expect(forwarded()).toEqual([FIRST, FIRST, SECOND]);
  });
});

describe("064-30 AC3: the thirdPartyCookiesEnabled boot option", () => {
  it("reaches the chamber config unchanged and only when given", async () => {
    for (const value of [true, false]) {
      const { worker } = await boot({ thirdPartyCookiesEnabled: value });
      expect(worker.messages.find((m) => m.type === "init").config.thirdPartyCookiesEnabled).toBe(value);
    }
    const { worker } = await boot();
    expect(worker.messages.find((m) => m.type === "init").config).not.toHaveProperty("thirdPartyCookiesEnabled");
  });

  it("rejects a non-boolean with a plain Error", async () => {
    await expect(bootAlloy(entry({ thirdPartyCookiesEnabled: "false" }))).rejects.toThrow(/thirdPartyCookiesEnabled.*boolean/);
  });

  it("does not change which hosts the seal allows", async () => {
    for (const value of [true, false]) {
      fetchMock.mockClear();
      const { handle, worker } = await boot({ thirdPartyCookiesEnabled: value, consent: { analytics_storage: "granted" } });
      handle.push({ event: "page_view", page_location: "https://site/p" });
      worker.emit({ type: "intercepted-fetch", id: "x1", url: "https://evil.example/ee/v1/interact", method: "POST", headers: {}, body: "{}" });
      worker.emit({ type: "intercepted-fetch", id: "x2", url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      await tick();
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.startsWith("https://evil.example"))).toBe(false);
      expect(urls.some((u) => u.startsWith("https://adobedc.demdex.net/"))).toBe(true);
    }
  });
});

describe("064-30 AC7: the chamber's use of the waiting object (real worker file)", () => {
  let fakeSelf;
  let alloy;
  const send = (m) => fakeSelf.onmessage({ data: m });
  const GRANT = { analytics_storage: "granted", personalization: "granted" };

  beforeEach(async () => {
    alloy = vi.fn(() => Promise.resolve({}));
    fakeSelf = { postMessage: vi.fn(), alloy, fetch: vi.fn() };
    globalThis.self = fakeSelf;
    vi.resetModules();
    await import("../connectors/alloy/alloy-chamber.worker.js");
  });
  afterEach(() => { delete globalThis.self; });

  it("calls Alloy's setConsent once with the object, and a later vector-only message uses the shaped options", async () => {
    send({ type: "adobeConsent", consent: [FULL] });
    send({ type: "setConsent", consent: GRANT });
    await tick(5);
    expect(alloy).toHaveBeenCalledTimes(1);
    expect(alloy).toHaveBeenCalledWith("setConsent", { consent: [FULL] });

    send({ type: "setConsent", consent: GRANT }); // no waiting object: an older one is never reused
    await tick(5);
    expect(alloy).toHaveBeenCalledTimes(2);
    expect(alloy.mock.calls[1][1].consent[0].value.collect).toEqual({ val: "y" });
    expect(alloy.mock.calls[1][1].consent).not.toEqual([FULL]);
  });

  it("the object message alone does not call Alloy (AC2b)", async () => {
    send({ type: "adobeConsent", consent: [FULL] });
    await tick(5);
    expect(alloy).not.toHaveBeenCalled();
  });

  it("drops the object under a still-pending analytics_storage, leaving Alloy's queue alone", async () => {
    send({ type: "adobeConsent", consent: [FULL] });
    send({ type: "setConsent", consent: { personalization: "granted" } });
    await tick(5);
    expect(alloy).not.toHaveBeenCalled();
    send({ type: "setConsent", consent: GRANT });
    await tick(5);
    expect(alloy.mock.calls[0][1].consent).not.toEqual([FULL]); // dropped, not kept for later
  });

  it("a partial object keeps the earlier purposes in the vector and sends only what the page sent", async () => {
    send({ type: "setConsent", consent: GRANT });
    const partial = [adobe({ collect: { val: "n" } })];
    send({ type: "adobeConsent", consent: partial });
    send({ type: "setConsent", consent: { analytics_storage: "denied" } });
    await tick(5);
    expect(alloy.mock.calls.at(-1)).toEqual(["setConsent", { consent: partial }]);
  });

  it("ignores an object that is not plain data", async () => {
    send({ type: "adobeConsent", consent: [{ standard: "Adobe", fn() {} }] });
    send({ type: "setConsent", consent: GRANT });
    await tick(5);
    expect(alloy.mock.calls[0][1].consent[0].value.collect).toEqual({ val: "y" });
  });

  it("retries once with the vector-shaped options when Alloy rejects the object", async () => {
    alloy.mockImplementationOnce(() => Promise.reject(new Error("invalid consent")));
    send({ type: "adobeConsent", consent: [FULL] });
    send({ type: "setConsent", consent: GRANT });
    await tick(10);
    expect(alloy).toHaveBeenCalledTimes(2);
    expect(alloy.mock.calls[0][1]).toEqual({ consent: [FULL] });
    expect(alloy.mock.calls[1][1].consent).not.toEqual([FULL]);
    expect(fakeSelf.postMessage.mock.calls.some(([m]) => m.name === "consent-object-rejected")).toBe(true);
  });
});
