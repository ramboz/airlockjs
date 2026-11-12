import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleBrowserRealm, googleBrowserFramePolicy } from "../adapters/google-browser-operation-realm.js";

const origin = "http://127.0.0.1:41234";
const frameURL = `${origin}/rig/google-browser-operation-frame.html`;
const bytes = "<!doctype html>\n<html><head></head><body></body></html>\n";

afterEach(() => vi.unstubAllGlobals());

function install({ policy = googleBrowserFramePolicy([origin]), body = bytes } = {}) {
  const listeners = new Map();
  const realmFetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
  const window = { fetch: realmFetch, Request };
  const child = { URL: frameURL, defaultView: window };
  const frame = {
    hidden: false, isConnected: false, contentWindow: window, contentDocument: child,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    remove() { this.isConnected = false; },
  };
  let mutation;
  const doc = {
    URL: `${origin}/google`,
    createElement: vi.fn(() => frame),
    body: { appendChild(element) {
      element.isConnected = true;
      queueMicrotask(() => { for (const fn of [...listeners.get("load")]) fn(); });
    } },
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("location", { origin });
  vi.stubGlobal("MutationObserver", class {
    constructor(callback) { mutation = callback; }
    observe() {}
    disconnect() {}
  });
  const response = new Response(body, {
    status: 200, headers: { "content-security-policy": policy, "content-length": String(bytes.length) },
  });
  Object.defineProperty(response, "url", { value: frameURL });
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return { frame, fetch, realmFetch, mutate: () => mutation() };
}

describe("private Google transport realm", () => {
  it("pins the static response and captures the loaded realm's fetch, then detects replacement", async () => {
    const fake = install();
    const lost = vi.fn();
    const realm = await createGoogleBrowserRealm([origin], lost, new AbortController().signal);
    expect(fake.fetch).toHaveBeenCalledWith(frameURL, expect.objectContaining({ credentials: "omit", redirect: "error" }));
    expect(fake.frame.src).toBe(frameURL);
    expect(realm.valid()).toBe(true);
    await realm.fetch(`${origin}/test`, { method: "GET" });
    expect(fake.realmFetch).toHaveBeenCalledTimes(1);
    fake.frame.contentDocument = { URL: frameURL, defaultView: fake.frame.contentWindow };
    fake.mutate();
    expect(lost).toHaveBeenCalledTimes(1);
    expect(realm.valid()).toBe(false);
    expect(() => realm.fetch(`${origin}/test`, {})).toThrow("frame-identity");
    realm.dispose();
    expect(fake.frame.isConnected).toBe(false);
  });

  it.each([
    ["wrong enforcing policy", { policy: "default-src *" }],
    ["changed static bytes", { body: "<script></script>" }],
  ])("rejects %s before creating a frame", async (_name, options) => {
    const fake = install(options);
    await expect(createGoogleBrowserRealm([origin], vi.fn(), new AbortController().signal)).rejects.toThrow();
    expect(fake.frame.isConnected).toBe(false);
    expect(fake.realmFetch).not.toHaveBeenCalled();
  });
});
