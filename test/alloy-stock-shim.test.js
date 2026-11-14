// Spec 067-08 AC3: the chamber feeds Alloy's context collection from the 067-07
// channel, for the listed groups only, and never invents a value.
import { describe, it, expect } from "vitest";
import { shimValuesFromStockContext, BLANKED_WHEN_UNSET } from "../connectors/alloy/stock-shim.js";
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
    expect(v.location).toEqual({});
    expect(v.document).toEqual({});
    expect(v.navigator).toEqual({});
  });

  it("an unset channel, or a missing group, yields no values", () => {
    for (const ctx of [undefined, {}, { web: {} }]) {
      const v = shimValuesFromStockContext(ctx, ALLOY_DEFAULT_CONTEXT);
      for (const part of Object.values(v)) expect(part).toEqual({});
    }
  });

  it("names the placeholders a listed-but-unset group blanks", () => {
    expect(BLANKED_WHEN_UNSET.device.screen).toContain("width");
    expect(BLANKED_WHEN_UNSET.web.document).toContain("referrer");
  });
});
