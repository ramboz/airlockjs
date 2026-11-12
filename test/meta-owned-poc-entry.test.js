import { describe, expect, it, vi } from "vitest";
import { prepareOwnedPoc } from "../adapters/meta-pixel-owned-poc.js";

const url = "https://main--aem-eds-airlock-poc--adobe-rnd.aem.live/?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=synthetic";
const arm = () => ({ pixelId: "123456789012345", notBefore: Date.now() - 1000, notAfter: Date.now() + 30000 });
function page(href = url) {
  const target = new EventTarget();
  target.location = { href };
  target.document = { URL: href, referrer: "" };
  target.top = target;
  target.self = target;
  return target;
}
function consent(target, value) {
  const event = new Event("consent.update");
  event.detail = { consented: value };
  target.dispatchEvent(event);
}
function fakeAdapter() {
  return { fbq: vi.fn(), setConsent: vi.fn(), dispose: vi.fn(async () => {}),
    flush: vi.fn(async () => ({ outcomes: [{ disposition: "initialized" },
      { disposition: "transport-settled", status: 204 }], liveResponse: { body: "not-collected" } })) };
}

describe("owned page entry", () => {
  it("stays inert without exact opt-in and until explicit arm", () => {
    const makeAdapter = vi.fn();
    const invalid = page(`${url}&extra=1`);
    expect(prepareOwnedPoc({ page: invalid, makeAdapter })).toBe(false);
    const target = page();
    expect(prepareOwnedPoc({ page: target, makeAdapter })).toBe(true);
    expect(prepareOwnedPoc({ page: target, makeAdapter })).toBe(true);
    expect(makeAdapter).not.toHaveBeenCalled();
    expect(target.fbq).toBeUndefined();
  });

  it("never defers a denied or absent-consent attempt or resets its latch", async () => {
    for (const value of [undefined, false, "true"]) {
      const target = page();
      const makeAdapter = vi.fn();
      prepareOwnedPoc({ page: target, makeAdapter });
      if (value !== undefined) consent(target, value);
      expect(await target.__airlockMetaPoc.arm(arm())).toEqual({ error: "consent-unavailable" });
      consent(target, true);
      expect(await target.__airlockMetaPoc.arm(arm())).toEqual({ error: "already-armed" });
      expect(makeAdapter).not.toHaveBeenCalled();
    }
  });

  it("forwards consent while active, disposes, and never rearms", async () => {
    const target = page();
    const adapter = fakeAdapter();
    let finish;
    adapter.flush.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const makeAdapter = vi.fn(() => adapter);
    prepareOwnedPoc({ page: target, makeAdapter });
    consent(target, true);
    const result = target.__airlockMetaPoc.arm(arm());
    consent(target, false);
    consent(target, true);
    expect(adapter.setConsent.mock.calls).toEqual([[{ ad_storage: "denied" }], [{ ad_storage: "granted" }]]);
    finish({ outcomes: [{ disposition: "initialized" }, { disposition: "held", status: 0 }] });
    expect(await result).toEqual({ disposition: "held", status: 0, body: "unavailable" });
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(await target.__airlockMetaPoc.arm(arm())).toEqual({ error: "already-armed" });
  });

  it("redacts setup and cleanup failures", async () => {
    const target = page();
    const adapter = fakeAdapter();
    adapter.dispose.mockRejectedValue(new Error("private"));
    prepareOwnedPoc({ page: target, makeAdapter: () => adapter });
    consent(target, true);
    expect(await target.__airlockMetaPoc.arm(arm())).toEqual({ error: "cleanup-failed" });
  });

  it("claims the latch on expired input and on page exit", async () => {
    const target = page();
    const makeAdapter = vi.fn();
    prepareOwnedPoc({ page: target, makeAdapter });
    consent(target, true);
    expect(await target.__airlockMetaPoc.arm({ ...arm(), notBefore: 1, notAfter: 2 }))
      .toEqual({ error: "execution-failed" });
    expect(await target.__airlockMetaPoc.arm(arm())).toEqual({ error: "already-armed" });
    const another = page();
    prepareOwnedPoc({ page: another, makeAdapter });
    another.dispatchEvent(new Event("pagehide"));
    expect(await another.__airlockMetaPoc.arm(arm())).toEqual({ error: "already-armed" });
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("fails closed when the consent payload throws", async () => {
    const target = page();
    const makeAdapter = vi.fn();
    prepareOwnedPoc({ page: target, makeAdapter });
    consent(target, true);
    const event = new Event("consent.update");
    Object.defineProperty(event, "detail", { get() { throw new Error("private"); } });
    target.dispatchEvent(event);
    expect(await target.__airlockMetaPoc.arm(arm())).toEqual({ error: "consent-unavailable" });
    expect(makeAdapter).not.toHaveBeenCalled();
  });
});
