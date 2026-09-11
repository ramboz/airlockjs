import { describe, it, expect } from "vitest";
import { getCookieValue } from "../core/cookie-parse.js";

// Spec 043-01 AC1: `getCookieValue(cookieString, name)` is the shared pure
// exact-name cookie-value accessor extracted from the two byte-identical
// scan/decode copies (`adapters/eds/index.js` `readCookieValue` and
// `adapters/eds/cookies.js`'s `get(name)` inner loop). Its own sentinel for
// "absent" is `undefined` — callers reconcile to their own sentinel (e.g.
// `?? null`) at the call site. These tests witness every edge the two
// original copies handled, so the collapse (A1) is behavior-preserving.

describe("getCookieValue(cookieString, name)", () => {
  it("returns undefined for a non-string cookieString", () => {
    expect(getCookieValue(undefined, "_ga")).toBeUndefined();
    expect(getCookieValue(null, "_ga")).toBeUndefined();
    expect(getCookieValue(42, "_ga")).toBeUndefined();
  });

  it("returns undefined for an empty jar", () => {
    expect(getCookieValue("", "_ga")).toBeUndefined();
  });

  it("returns undefined when the name is absent from a non-empty jar", () => {
    expect(getCookieValue("other=x; another=y", "_ga")).toBeUndefined();
  });

  it("finds a cookie by exact name among several, trimming whitespace", () => {
    expect(
      getCookieValue("_gid=GA1.1.3.4; _ga=GA1.1.1234567890.1700000000; other=x", "_ga"),
    ).toBe("GA1.1.1234567890.1700000000");
  });

  it("does NOT confuse name prefixes (_ga vs _ga_S1)", () => {
    const jar = "_ga_S1=GS1.1.1724668790.1.1.1.1.0.0; _ga=GA1.1.1.2";
    expect(getCookieValue(jar, "_ga")).toBe("GA1.1.1.2");
    expect(getCookieValue(jar, "_ga_S1")).toBe("GS1.1.1724668790.1.1.1.1.0.0");
  });

  it("only the first `=` splits key/value (the value keeps its own `=`)", () => {
    expect(getCookieValue("k=a=b=c", "k")).toBe("a=b=c");
  });

  it("trims surrounding whitespace on both key and value", () => {
    expect(getCookieValue("  k  =  v  ", "k")).toBe("v");
  });

  it("decodes a percent-encoded value", () => {
    expect(getCookieValue("enc=a%3Bb%20c", "enc")).toBe("a;b c");
  });

  it("returns the raw trimmed value on a malformed %-escape instead of throwing", () => {
    expect(() => getCookieValue("enc=%zz-not-an-escape", "enc")).not.toThrow();
    expect(getCookieValue("enc=%zz-not-an-escape", "enc")).toBe("%zz-not-an-escape");
  });

  it("first match wins on a duplicate name", () => {
    expect(getCookieValue("dup=first; dup=second", "dup")).toBe("first");
  });
});
