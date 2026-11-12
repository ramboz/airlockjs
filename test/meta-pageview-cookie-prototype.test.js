import { describe, expect, it, vi } from "vitest";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { pageViewCookie } from "../connectors/meta-pixel/pageview-cookie.js";
import { closePrototypeResources, createNodePrototypeChamber, createPrototypeReceiver } from "../rig/meta-pageview-prototype.mjs";

const pixel = "000000000000000";
const page = () => ({
  pageURL: "https://example.test/", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: 0,
});

function jar(hostname = "example.test") {
  let value = "";
  const operations = { reads: 0, writes: 0, domains: [] };
  return {
    operations,
    document: {
      location: { hostname, protocol: "https:" },
      get cookie() { operations.reads += 1; return value ? `_fbp=${value}` : ""; },
      set cookie(input) {
        operations.writes += 1;
        const domain = input.match(/;\s*domain=([^;]+)/i)?.[1];
        operations.domains.push(domain);
        if (domain === hostname) value = input.split(";")[0].slice("_fbp=".length);
      },
    },
  };
}

async function setup(options = {}) {
  const receiver = await createPrototypeReceiver();
  const chamber = createNodePrototypeChamber();
  const { wrapChamber = (value) => value, ...config } = options;
  const adapter = createMetaPixelPrototype({
    endpoint: receiver.endpoint, chamber: wrapChamber(chamber), captureContext: page,
    consent: { ad_storage: "granted" }, ...config,
  });
  return { adapter, chamber, receiver, close: () => closePrototypeResources({ adapter, chamber, receiver }) };
}

describe("scoped PageView browser cookie prototype", () => {
  it("refreshes a synthetic packed cookie with its appendix and saved domain index", async () => {
    const value = "fb.1.1700000000000.synthetic__DOT__payload.Bg";
    const cookies = { get: vi.fn(async () => value), set: vi.fn(async () => {}) };
    expect(await pageViewCookie(cookies, "https://a.example.test/")).toBe(value);
    expect(cookies.set).toHaveBeenCalledOnce();
    expect(cookies.set).toHaveBeenCalledWith("_fbp", value, {
      maxAge: 7776000, path: "/", domain: "example.test", sameSite: "lax",
    });
  });

  it("replaces a malformed packed cookie with a newly generated value", async () => {
    let value = "malformed";
    const cookies = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_name, next, options) => { if (options.domain === "example.test") value = next; }),
    };
    const generated = await pageViewCookie(cookies, "https://example.test/");
    expect(generated).toMatch(/^fb\.1\.\d+\.\d+$/);
    expect(generated).toBe(value);
    expect(cookies.set.mock.calls.map((call) => call[2].domain)).toEqual(["test", "example.test"]);
  });

  it("creates and reuses a generated cookie through the actual worker and host", async () => {
    const cookie = jar();
    const env = await setup({ experimentalFirstPartyCookie: true, cookieDocument: cookie.document });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.map((item) => item.disposition)).toEqual([
        "initialized", "transport-settled", "transport-settled",
      ]);
      const identities = env.receiver.arrivals.map(({ url }) => new URL(url).searchParams.get("fbp"));
      expect(identities).toHaveLength(2);
      expect(identities[0]).toMatch(/^fb\.\d+\.\d+\.\d+$/);
      expect(identities[1]).toBe(identities[0]);
      expect(decodeURIComponent(cookie.document.cookie.slice("_fbp=".length))).toBe(identities[0]);
      expect(cookie.operations.domains).toEqual(["test", "example.test", "example.test"]);
      expect(cookie.operations.reads).toBeGreaterThan(0);
      expect(cookie.operations.writes).toBeGreaterThan(0);
      expect(JSON.stringify(state)).not.toContain(identities[0]);
    } finally { await env.close(); }
  }, 5000);

  it("probes domain suffixes from the last label toward the full host", async () => {
    const cookie = jar("a.example.test");
    const env = await setup({
      experimentalFirstPartyCookie: true, cookieDocument: cookie.document,
      captureContext: () => ({ ...page(), pageURL: "https://a.example.test/" }),
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(cookie.operations.domains).toEqual(["test", "example.test", "a.example.test"]);
      expect(new URL(env.receiver.arrivals[0].url).searchParams.get("fbp")).toMatch(/^fb\.2\./);
    } finally { await env.close(); }
  }, 5000);

  it.each([undefined, "pending", "denied"])("never reads or writes cookie state with %s consent", async (consent) => {
    const cookie = jar();
    const env = await setup({
      experimentalFirstPartyCookie: true, cookieDocument: cookie.document,
      consent: consent === undefined ? null : { ad_storage: consent },
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(cookie.operations).toEqual({ reads: 0, writes: 0, domains: [] });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("does not request cookie access when the grant is omitted", async () => {
    const cookie = jar();
    const env = await setup({ cookieDocument: cookie.document });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(cookie.operations).toEqual({ reads: 0, writes: 0, domains: [] });
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("fbp")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it("does not use the PageView cookie grant for a custom event of the same name", async () => {
    const cookie = jar();
    const env = await setup({
      experimentalFirstPartyCookie: true, experimentalEvents: true, cookieDocument: cookie.document,
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("trackCustom", "PageView");
      expect((await env.adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(cookie.operations).toEqual({ reads: 0, writes: 0, domains: [] });
      expect(new URL(env.receiver.arrivals[0].url).searchParams.has("fbp")).toBe(false);
    } finally { await env.close(); }
  }, 5000);

  it.each(["missing", "read-fails", "write-fails", "write-ignored"])(
    "reports %s cookie access without dispatching or exposing the failure", async (fault) => {
      const cookie = jar();
      const doc = fault === "missing" ? null : fault === "read-fails" ? {
        ...cookie.document, get cookie() { throw new Error("private-cookie-error"); },
      } : fault === "write-fails" ? {
        location: cookie.document.location,
        get cookie() { return ""; },
        set cookie(_value) { throw new Error("private-cookie-error"); },
      } : fault === "write-ignored" ? {
        location: cookie.document.location, get cookie() { return ""; }, set cookie(_value) {},
      } : cookie.document;
      const env = await setup({ experimentalFirstPartyCookie: true, cookieDocument: doc });
      try {
        env.adapter.fbq("init", pixel);
        env.adapter.fbq("track", "PageView");
        const state = await env.adapter.flush();
        expect(state.outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "cookie-access-failed" });
        expect(env.receiver.arrivals).toEqual([]);
        expect(JSON.stringify(state)).not.toContain("private-cookie-error");
      } finally { await env.close(); }
    }, 5000,
  );

  it.each(["get", "set"])("rechecks consent before a delayed %s reaches the host", async (operation) => {
    const cookie = jar();
    let release;
    let notify;
    const waiting = new Promise((resolve) => { notify = resolve; });
    const env = await setup({
      experimentalFirstPartyCookie: true, cookieDocument: cookie.document,
      wrapChamber: (chamber) => ({
        ...chamber,
        onMessage(listener) {
          return chamber.onMessage((message) => {
            if (message.type === "cookie-request" && message.operation === operation && !release) {
              release = () => listener(message);
              notify();
            } else listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      await waiting;
      const before = { ...cookie.operations };
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(cookie.operations.reads).toBe(before.reads);
      expect(cookie.operations.writes).toBe(before.writes);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it.each(["get", "set"])("does not use a delayed %s result after revoke and regrant", async (operation) => {
    const cookie = jar();
    let release;
    let notify;
    let currentOperation;
    const waiting = new Promise((resolve) => { notify = resolve; });
    const env = await setup({
      experimentalFirstPartyCookie: true, cookieDocument: cookie.document,
      wrapChamber: (chamber) => ({
        ...chamber,
        onMessage(listener) {
          return chamber.onMessage((message) => {
            if (message.type === "cookie-request") currentOperation = message.operation;
            listener(message);
          });
        },
        postMessage(message) {
          if (message.type === "cookie-response" && currentOperation === operation && !release) {
            release = () => chamber.postMessage(message);
            notify();
          } else chamber.postMessage(message);
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      await waiting;
      const before = { reads: cookie.operations.reads, writes: cookie.operations.writes };
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(cookie.operations.reads).toBe(before.reads);
      expect(cookie.operations.writes).toBe(before.writes);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("refuses a worker request for another cookie name before touching the jar", async () => {
    const cookie = jar();
    const env = await setup({
      experimentalFirstPartyCookie: true, cookieDocument: cookie.document,
      wrapChamber: (chamber) => ({
        ...chamber,
        onMessage(listener) {
          return chamber.onMessage((message) => listener(message.type === "cookie-request"
            ? { ...message, name: "_fbp_other" } : message));
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      const state = await env.adapter.flush();
      expect(state.terminalReason).toBe("invalid-worker-result");
      expect(cookie.operations).toEqual({ reads: 0, writes: 0, domains: [] });
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);

  it("holds an already-mapped identity request if consent is revoked before egress", async () => {
    const cookie = jar();
    let release;
    let notify;
    const waiting = new Promise((resolve) => { notify = resolve; });
    const env = await setup({
      experimentalFirstPartyCookie: true, cookieDocument: cookie.document,
      wrapChamber: (chamber) => ({
        ...chamber,
        onMessage(listener) {
          return chamber.onMessage((message) => {
            if (message.type === "intercepted-fetch") {
              release = () => listener(message);
              notify();
            } else listener(message);
          });
        },
      }),
    });
    try {
      env.adapter.fbq("init", pixel);
      env.adapter.fbq("track", "PageView");
      await waiting;
      env.adapter.setConsent({ ad_storage: "denied" });
      env.adapter.setConsent({ ad_storage: "granted" });
      release();
      const state = await env.adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(state.host.dispatchAttempts).toBe(0);
      expect(env.receiver.arrivals).toEqual([]);
    } finally { await env.close(); }
  }, 5000);
});
