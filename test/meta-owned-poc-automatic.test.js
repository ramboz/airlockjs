import { describe, expect, it, vi } from "vitest";
import { prepareAutomaticOwnedPoc } from "../adapters/meta-pixel-owned-poc.js";

const url = "https://main--aem-eds-airlock-poc--adobe-rnd.aem.live/?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=synthetic";
const pixel = "123456789012345";
const config = () => ({ enabled: true, pixelId: pixel, documentURL: url,
  notBefore: Date.now() - 1000, notAfter: Date.now() + 30000, maxPageViewsPerDocument: 1 });
const disabled = () => ({ enabled: false, pixelId: pixel, documentURL: "",
  notBefore: 0, notAfter: 0, maxPageViewsPerDocument: 1 });
const response = (value, init = {}) => new Response(JSON.stringify(value), {
  headers: { "content-type": "application/json" }, ...init,
});
function page(href = url) {
  const result = new EventTarget();
  result.location = { href };
  result.document = { URL: href, referrer: "", querySelectorAll: () => [
    { textContent: `window.fbq('init', '${pixel}');` },
  ] };
  result.self = result;
  result.top = result;
  return result;
}
function consent(target, value) {
  const event = new Event("consent.update");
  event.detail = { consented: value };
  target.dispatchEvent(event);
}
const settle = async (target, state) => {
  await vi.waitFor(() => expect(target.__airlockMetaAutomatic.getState().state).toBe(state));
  return target.__airlockMetaAutomatic.getState();
};
function adapter() {
  return { fbq: vi.fn(), setConsent: vi.fn(), dispose: vi.fn(async () => {}),
    flush: vi.fn(async () => ({ outcomes: [{ disposition: "initialized" },
      { disposition: "transport-settled", status: 204 }], liveResponse: { body: "not-collected" } })) };
}
function start(target, fetchImpl, makeAdapter = vi.fn(() => adapter())) {
  expect(prepareAutomaticOwnedPoc({ page: target, fetchImpl, makeAdapter })).toBe(true);
  return makeAdapter;
}

describe("automatic owned page", () => {
  it("subscribes before initial consent and dispatches once through the owned entry", async () => {
    const target = page();
    const fetchImpl = vi.fn(async () => response(config()));
    const makeAdapter = start(target, fetchImpl);
    consent(target, true);
    expect(await settle(target, "complete")).toEqual({ state: "complete",
      outcome: { disposition: "transport-settled", status: 204, body: "not-collected" } });
    consent(target, true);
    expect(prepareAutomaticOwnedPoc({ page: target, fetchImpl, makeAdapter })).toBe(true);
    expect(makeAdapter).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("/tools/airlock-meta/automatic-config.json");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      credentials: "omit", redirect: "error", cache: "no-store",
    });
    expect(await target.__airlockMetaPoc.arm({})).toEqual({ error: "already-armed" });
  });

  it("waits while pending, terminates on denial and never replays on regrant", async () => {
    const target = page();
    const makeAdapter = start(target, async () => response(config()));
    await settle(target, "waiting-consent");
    consent(target, false);
    expect(await settle(target, "denied")).toEqual({ state: "denied" });
    consent(target, true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("allows a later actual grant during the window", async () => {
    const target = page();
    const makeAdapter = start(target, async () => response(config()));
    await settle(target, "waiting-consent");
    consent(target, true);
    await settle(target, "complete");
    expect(makeAdapter).toHaveBeenCalledTimes(1);
  });

  it("spends before running and preserves in-flight revocation across regrant", async () => {
    const target = page();
    const instance = adapter();
    let release;
    instance.flush.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const makeAdapter = start(target, async () => response(config()), vi.fn(() => instance));
    consent(target, true);
    await settle(target, "running");
    consent(target, true);
    consent(target, false);
    consent(target, true);
    expect(await target.__airlockMetaPoc.arm({})).toEqual({ error: "already-armed" });
    expect(makeAdapter).toHaveBeenCalledTimes(1);
    expect(instance.setConsent.mock.calls).toEqual([
      [{ ad_storage: "granted" }], [{ ad_storage: "denied" }], [{ ad_storage: "granted" }],
    ]);
    release({ outcomes: [{ disposition: "initialized" }, { disposition: "held", status: 0 }] });
    expect((await settle(target, "complete")).outcome.disposition).toBe("held");
    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });

  it("expires pending consent and removes the automatic listener", async () => {
    const target = page();
    const makeAdapter = start(target, async () => response({ ...config(), notAfter: Date.now() + 150 }));
    await settle(target, "waiting-consent");
    await settle(target, "expired");
    consent(target, true);
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("denies while configuration is still loading and ignores its later result", async () => {
    const target = page();
    let release;
    let signal;
    const makeAdapter = start(target, (_url, options) => {
      signal = options.signal;
      return new Promise((resolve) => { release = resolve; });
    });
    consent(target, false);
    expect(signal.aborted).toBe(true);
    release(response(config()));
    consent(target, true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(target.__airlockMetaAutomatic.getState()).toEqual({ state: "denied" });
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("bounds a stalled preparation and never sends after its deadline", async () => {
    const target = page();
    let signal;
    const makeAdapter = vi.fn();
    prepareAutomaticOwnedPoc({ page: target, makeAdapter, deadline: Date.now() + 30,
      fetchImpl: (_url, options) => { signal = options.signal; return new Promise(() => {}); } });
    consent(target, true);
    await settle(target, "config-error");
    expect(signal.aborted).toBe(true);
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("does not reset the shared manual latch", async () => {
    const target = page();
    let release;
    const fetchImpl = () => new Promise((resolve) => { release = resolve; });
    const makeAdapter = start(target, fetchImpl);
    consent(target, true);
    const { pixelId, notBefore, notAfter } = config();
    await target.__airlockMetaPoc.arm({ pixelId, notBefore, notAfter });
    release(response(config()));
    const result = await settle(target, "failed");
    expect(result.outcome).toEqual({ error: "already-armed" });
    expect(makeAdapter).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled config inert", async () => {
    const target = page();
    const makeAdapter = start(target, async () => response(disabled()));
    consent(target, true);
    await settle(target, "disabled");
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("fails closed on an absent or ambiguous site binding", async () => {
    for (const scripts of [[], [
      { textContent: `window.fbq('init', '${pixel}');` },
      { textContent: `window.fbq('init', '${pixel}');` },
    ]]) {
      const target = page();
      target.document.querySelectorAll = () => scripts;
      const makeAdapter = start(target, async () => response(config()));
      consent(target, true);
      await settle(target, "config-error");
      expect(makeAdapter).not.toHaveBeenCalled();
    }
  });

  it("reports cleanup failure without exposing the underlying error", async () => {
    const target = page();
    const instance = adapter();
    instance.dispose.mockRejectedValue(new Error("private"));
    start(target, async () => response(config()), () => instance);
    consent(target, true);
    expect(await settle(target, "failed")).toEqual({ state: "failed", outcome: { error: "cleanup-failed" } });
  });

  it.each([
    ["missing", () => new Response("", { status: 404 })],
    ["HTTP error", () => new Response("", { status: 500 })],
    ["redirect failure", () => { throw new Error("private redirect"); }],
    ["malformed JSON", () => new Response("{", { headers: { "content-type": "application/json" } })],
    ["wrong MIME", () => new Response("{}", { headers: { "content-type": "text/plain" } })],
    ["oversized", () => new Response("x".repeat(4097), { headers: { "content-type": "application/json" } })],
    ["oversized content length", () => new Response("{}", { headers: {
      "content-type": "application/json", "content-length": "4097",
    } })],
    ["future", () => response({ ...config(), notBefore: Date.now() + 10000 })],
    ["expired", () => response({ ...config(), notBefore: 1, notAfter: 2 })],
    ["other document", () => response({ ...config(), documentURL: `${url}&extra=1` })],
    ["other Pixel", () => response({ ...config(), pixelId: "999" })],
    ["extra key", () => response({ ...config(), extra: true })],
    ["bad budget", () => response({ ...config(), maxPageViewsPerDocument: 2 })],
    ["bad disabled", () => response({ ...disabled(), documentURL: url })],
    ["prototype key", () => new Response('{"__proto__":{},"enabled":false}', {
      headers: { "content-type": "application/json" },
    })],
  ])("rejects %s without creating a worker", async (_name, makeResponse) => {
    const target = page();
    const makeAdapter = start(target, async () => makeResponse());
    consent(target, true);
    expect(await settle(target, "config-error")).toEqual({ state: "config-error" });
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it("terminates pending work on page exit and aborts its fetch", async () => {
    const target = page();
    let signal;
    const makeAdapter = start(target, (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    target.dispatchEvent(new Event("pagehide"));
    expect(signal.aborted).toBe(true);
    expect(target.__airlockMetaAutomatic.getState()).toEqual({ state: "exited" });
    consent(target, true);
    expect(makeAdapter).not.toHaveBeenCalled();
  });

  it.each(["disabled", "denied", "exited", "config-error", "complete"])(
    "removes automatic listeners after %s", async (terminal) => {
      const target = page();
      const add = vi.spyOn(target, "addEventListener");
      const remove = vi.spyOn(target, "removeEventListener");
      const fetchImpl = terminal === "config-error"
        ? () => { throw new Error("private"); }
        : terminal === "disabled" ? async () => response(disabled())
          : async () => response(config());
      start(target, fetchImpl);
      const automaticConsent = add.mock.calls.filter(([name]) => name === "consent.update")[1][1];
      const automaticExit = add.mock.calls.filter(([name]) => name === "pagehide")[1][1];
      if (terminal === "denied") consent(target, false);
      if (terminal === "exited") target.dispatchEvent(new Event("pagehide"));
      if (terminal === "complete") consent(target, true);
      await settle(target, terminal);
      expect(remove).toHaveBeenCalledWith("consent.update", automaticConsent);
      expect(remove).toHaveBeenCalledWith("pagehide", automaticExit);
    },
  );

  it("does nothing for an ineligible page", () => {
    const target = page(`${url}&extra=1`);
    const fetchImpl = vi.fn();
    expect(prepareAutomaticOwnedPoc({ page: target, fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(target.__airlockMetaAutomatic).toBeUndefined();
  });
});
