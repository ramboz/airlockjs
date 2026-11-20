// Spec 067-08 AC3: the chamber feeds Alloy's context collection from the 067-07
// channel, for the listed groups only, and never invents a value.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { shimValuesFromStockContext, applyStockContextToShims } from "../connectors/alloy/stock-shim.js";
import { ALLOY_DEFAULT_CONTEXT } from "../connectors/alloy/connector.js";

const context = {
  web: { url: "https://a.example/p?q=1", origin: "https://a.example", hostname: "a.example", pathname: "/p", search: "?q=1", referrer: "https://r.example/", title: "T" },
  device: { screenWidth: 1920, screenHeight: 1080, colorDepth: 24, pixelRatio: 2, screenOrientation: "landscape-primary" },
  environment: { viewportWidth: 800, viewportHeight: 600, visibilityState: "visible", userAgent: "UA", language: "fr", languages: ["fr", "en"], cookieEnabled: true },
  placeContext: { localTime: "2026-01-01T00:00:00.000+00:00", timezoneOffset: 0 },
};

describe("shimValuesFromStockContext (067-08)", () => {
  it("maps every stock group onto the shim fields Alloy reads", () => {
    const v = shimValuesFromStockContext(context, ALLOY_DEFAULT_CONTEXT);
    expect(v.location).toMatchObject({ href: "https://a.example/p?q=1", hostname: "a.example", search: "?q=1" });
    expect(v.document).toMatchObject({ referrer: "https://r.example/", title: "T", visibilityState: "visible" });
    expect(v.screen).toMatchObject({ width: 1920, height: 1080, colorDepth: 24 });
    expect(v.window).toMatchObject({ innerWidth: 800, innerHeight: 600, devicePixelRatio: 2 });
    expect(v.navigator).toMatchObject({ userAgent: "UA", language: "fr", languages: ["fr", "en"] });
  });

  it("a narrowed list yields only those groups", () => {
    const v = shimValuesFromStockContext(context, ["device"]);
    expect(v.screen.width).toBe(1920);
    expect(v.location).toEqual({ origin: "https://a.example", hostname: "a.example" }); // host identity only
    expect(v.document).toEqual({});
    expect(v.navigator).toEqual({});
  });

  it("the host identity comes from the channel even when `web` is not listed", () => {
    const v = shimValuesFromStockContext({ web: { origin: "https://a.example", host: "a.example", hostname: "a.example", protocol: "https:", url: "https://a.example/p" } }, []);
    expect(v.location).toEqual({ origin: "https://a.example", host: "a.example", hostname: "a.example", protocol: "https:" });
  });

  it("an empty referrer is a real value; the viewport also feeds documentElement.clientWidth/Height", () => {
    const v = shimValuesFromStockContext({ web: { referrer: "" }, environment: { viewportWidth: 785, viewportHeight: 600 } }, ALLOY_DEFAULT_CONTEXT);
    expect(v.document.referrer).toBe("");
    expect(v.documentElement).toEqual({ clientWidth: 785, clientHeight: 600 });
  });

  it("an unset channel, or a missing group, yields no values", () => {
    for (const ctx of [undefined, {}, { web: {} }]) {
      const v = shimValuesFromStockContext(ctx, ALLOY_DEFAULT_CONTEXT);
      for (const part of Object.values(v)) expect(part).toEqual({});
    }
  });

});

describe("applyStockContextToShims (067-08)", () => {
  const targets = () => ({
    location: { href: "https://airlock.example/", hostname: "airlock.example", pathname: "/", search: "?old=1", hash: "#old" },
    document: { referrer: "https://old.example/", title: "airlock", visibilityState: "visible" },
    screen: { width: 1280, height: 800, orientation: { type: "landscape-primary" } },
    window: { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1 },
    navigator: { userAgent: "UA", language: "en-US" },
  });

  it("clears the placeholders of a listed group the channel never sent, and keeps the cookie-scope hostname", () => {
    const t = targets();
    applyStockContextToShims(t, {}, ["web", "device"]);
    expect(t.location).toEqual({ hostname: "airlock.example" });
    expect(t.document.referrer).toBeUndefined();
    expect(t.screen).toEqual({});
    expect(t.window.devicePixelRatio).toBeUndefined();
    expect(t.window.innerWidth).toBe(1280); // environment not listed: untouched
  });

  it("a denylisted field leaves no placeholder, and a field the page dropped leaves no stale value", () => {
    const t = targets();
    applyStockContextToShims(t, { web: { pathname: "/p", title: "T" }, device: { screenHeight: 50 } }, ["web", "device"]);
    expect(t.location).toMatchObject({ pathname: "/p" });
    expect(t.location.href).toBeUndefined(); // url denied
    expect(t.location.search).toBeUndefined(); // dropped
    expect(t.document.referrer).toBeUndefined();
    expect(t.screen).toEqual({ height: 50 }); // width denied: no 1280
  });

  it("a navigator field the channel omits reads undefined, not the placeholder or the worker's own value", () => {
    const t = targets();
    t.navigator.languages = ["en-US"];
    applyStockContextToShims(t, { environment: { language: "fr-FR" } }, ["environment"]);
    expect(t.navigator.language).toBe("fr-FR");
    expect(t.navigator.userAgent).toBeUndefined();
    expect(t.navigator.languages).toBeUndefined();
  });

  it("a denied url falls back to the host root, never to the location object", () => {
    const t = { ...targets(), documentElement: {} };
    applyStockContextToShims(t, { web: { origin: "https://a.example", hostname: "a.example", pathname: "/p" } }, ["web"]);
    expect(t.location.href).toBe("https://a.example/");
  });

  it("leaves groups the site did not list alone", () => {
    const t = targets();
    applyStockContextToShims(t, context, ["device"]);
    expect(t.location.href).toBe("https://airlock.example/");
    expect(t.screen.width).toBe(1920);
  });
});

describe("chamber shims carry no invented page identity (064-17 AC1, AC4)", () => {
  const src = readFileSync(new URL("../connectors/alloy/alloy-chamber.worker.js", import.meta.url), "utf8");
  const winBack = src.slice(src.indexOf("const winBack = {"), src.indexOf("Intl: self.Intl"));

  it("hard-codes no host, locale or 1280x800 screen", () => {
    expect(src).not.toMatch(/airlock\.example/);
    expect(src).not.toMatch(/en-US/);
    expect(src).not.toMatch(/\b1280\b|\b800\b/);
  });

  it("the window shim does not define title, url, referrer, height or width", () => {
    for (const key of ["title", "url", "referrer", "height", "width"]) expect(winBack).not.toMatch(new RegExp(`\\b${key}\\s*:`));
    expect(winBack).not.toMatch(/\b(inner|outer)(Width|Height)\b/);
  });
});
