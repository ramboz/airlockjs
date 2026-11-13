// core/cookie-scope.js — spec 035-01 (OQ13-4): the shared, pure cookie-name
// scope + validation primitive behind the alloy cookie-grant hardening.
//
// Three pieces, tested independently:
//   - isValidCookieName: the RFC 6265 / RFC 7230 cookie-name TOKEN grammar
//     (fail-closed — rejects every AC2 injection vector).
//   - matchesGrantedName: the ratified exact-vs-prefix match rule, grounded
//     against alloy's + GA4's REAL declared cookie names (a trailing `_`
//     entry is a prefix; every other entry is exact).
//   - scopeSeedCookies: the READ-side jar filter (AC1) built on top of
//     matchesGrantedName.
//
// Pure, no DOM/globals — literal declared-name arrays are used here (mirroring
// alloy's/GA4's REAL manifests) rather than importing the connectors, keeping
// this suite a self-contained unit test of the primitive (the SSOT identity
// itself — manifest.capabilities.cookies === ALLOY_COOKIE_NAMES — is pinned in
// test/alloy-connector.test.js, AC3).
import { describe, it, expect } from "vitest";
import { isValidCookieName, matchesGrantedName, scopeSeedCookies } from "../core/cookie-scope.js";

// alloy's real declared set (connectors/alloy/connector.js).
const ALLOY_NAMES = ["com.adobe.alloy.getTld", "kndctr_", "AMCV_", "demdex", "s_ecid"];
// GA4's real declared set (connectors/ga4/connector.js) — exact + prefix mix too.
const GA4_NAMES = ["_ga", "_ga_"];

describe("core/cookie-scope.js: isValidCookieName (RFC 6265 / RFC 7230 cookie-name token)", () => {
  it("accepts every one of alloy's + GA4's real declared names (valid tokens)", () => {
    for (const n of [...ALLOY_NAMES, ...GA4_NAMES, "kndctr_org", "AMCV_1234", "_ga_ABC123"]) {
      expect(isValidCookieName(n)).toBe(true);
    }
  });

  it("accepts the full RFC 2616 token charset (non-alnum allowed chars)", () => {
    expect(isValidCookieName("a-b.c_d~e!f#g$h%i&j'k*l+m^n`o|p")).toBe(true);
  });

  it("rejects the empty string (a token needs at least one char)", () => {
    expect(isValidCookieName("")).toBe(false);
  });

  it("rejects a leading space", () => {
    expect(isValidCookieName(" evil")).toBe(false);
  });

  it("rejects a trailing space", () => {
    expect(isValidCookieName("evil ")).toBe(false);
  });

  it("rejects an internal space", () => {
    expect(isValidCookieName("ev il")).toBe(false);
  });

  it("rejects a horizontal tab", () => {
    expect(isValidCookieName("a\tb")).toBe(false);
  });

  it("rejects control characters (newline, CR, NUL)", () => {
    expect(isValidCookieName("a\nb")).toBe(false);
    expect(isValidCookieName("a\rb")).toBe(false);
    expect(isValidCookieName("a\0b")).toBe(false);
  });

  // AC2's enumerated injection vectors — every RFC 7230 separator, individually.
  it.each([";", "=", ",", "(", ")", "<", ">", "@", ":", "\\", '"', "/", "[", "]", "?", "{", "}"])(
    "rejects the separator %j embedded in an otherwise-valid name",
    (sep) => {
      expect(isValidCookieName(`a${sep}b`)).toBe(false);
    },
  );

  it("rejects a full attribute-injection string (name carrying a smuggled attribute)", () => {
    expect(isValidCookieName("x; domain=evil.com")).toBe(false);
  });

  it("rejects a header/response-splitting attempt (embedded newline + colon)", () => {
    expect(isValidCookieName("a\nSet-Cookie: b")).toBe(false);
  });

  it("is defensive against non-string input (never throws)", () => {
    expect(isValidCookieName(undefined)).toBe(false);
    expect(isValidCookieName(null)).toBe(false);
    expect(isValidCookieName(42)).toBe(false);
    expect(isValidCookieName({})).toBe(false);
  });
});

describe("core/cookie-scope.js: matchesGrantedName (ratified exact-vs-prefix rule)", () => {
  it("a trailing-`_` entry matches by PREFIX — alloy's kndctr_/AMCV_", () => {
    expect(matchesGrantedName("kndctr_org", ALLOY_NAMES)).toBe(true);
    expect(matchesGrantedName("kndctr_", ALLOY_NAMES)).toBe(true); // the bare prefix itself also matches (startsWith)
    expect(matchesGrantedName("AMCV_1234", ALLOY_NAMES)).toBe(true);
  });

  it("a non-trailing-`_` entry matches EXACT only — a stray suffix is NOT granted", () => {
    expect(matchesGrantedName("demdex", ALLOY_NAMES)).toBe(true);
    expect(matchesGrantedName("demdex_evil", ALLOY_NAMES)).toBe(false); // AC4's pinned negative case
    expect(matchesGrantedName("s_ecid", ALLOY_NAMES)).toBe(true);
    expect(matchesGrantedName("s_ecidx", ALLOY_NAMES)).toBe(false);
    expect(matchesGrantedName("com.adobe.alloy.getTld", ALLOY_NAMES)).toBe(true);
    expect(matchesGrantedName("com.adobe.alloy.getTldx", ALLOY_NAMES)).toBe(false);
  });

  it("a name outside the declared set entirely is not granted", () => {
    expect(matchesGrantedName("_ga", ALLOY_NAMES)).toBe(false);
    expect(matchesGrantedName("sid", ALLOY_NAMES)).toBe(false);
  });

  it("GA4's mixed exact(_ga)+prefix(_ga_) set: both forms resolve correctly", () => {
    expect(matchesGrantedName("_ga", GA4_NAMES)).toBe(true); // exact
    expect(matchesGrantedName("_ga_ABC123", GA4_NAMES)).toBe(true); // prefix
    expect(matchesGrantedName("_gat", GA4_NAMES)).toBe(false); // neither exact "_ga" nor prefix "_ga_"
  });

  it("is defensive against a non-array grantedNames / non-string name (never throws, denies)", () => {
    expect(matchesGrantedName("demdex", null)).toBe(false);
    expect(matchesGrantedName("demdex", undefined)).toBe(false);
    expect(matchesGrantedName(undefined, ALLOY_NAMES)).toBe(false);
  });

  it("an empty granted set matches nothing (default-deny)", () => {
    expect(matchesGrantedName("demdex", [])).toBe(false);
  });
});

describe("core/cookie-scope.js: scopeSeedCookies (the READ-side boot-seed filter, AC1)", () => {
  it("AC1's pinned example: keeps only the granted names, drops the rest", () => {
    const jar = "_ga=1; kndctr_org=2; sid=secret; demdex=3";
    expect(scopeSeedCookies(jar, ALLOY_NAMES)).toBe("kndctr_org=2; demdex=3");
  });

  it("preserves the relative order of the surviving pairs", () => {
    const jar = "demdex=3; sid=x; kndctr_org=2";
    expect(scopeSeedCookies(jar, ALLOY_NAMES)).toBe("demdex=3; kndctr_org=2");
  });

  it("drops a malformed segment (no `=`) without throwing", () => {
    const jar = "kndctr_org=2; bogus; demdex=3";
    expect(scopeSeedCookies(jar, ALLOY_NAMES)).toBe("kndctr_org=2; demdex=3");
  });

  it("a value containing `=` is preserved whole (splits on the FIRST `=` only)", () => {
    const jar = "demdex=a=b=c";
    expect(scopeSeedCookies(jar, ALLOY_NAMES)).toBe("demdex=a=b=c");
  });

  it("an empty jar yields an empty string", () => {
    expect(scopeSeedCookies("", ALLOY_NAMES)).toBe("");
  });

  it("a whitespace-only jar yields an empty string", () => {
    expect(scopeSeedCookies("   ", ALLOY_NAMES)).toBe("");
  });

  it("a jar with nothing granted yields an empty string", () => {
    expect(scopeSeedCookies("_ga=1; sid=2", ALLOY_NAMES)).toBe("");
  });

  it("is defensive against a non-string jar (never throws)", () => {
    expect(scopeSeedCookies(undefined, ALLOY_NAMES)).toBe("");
    expect(scopeSeedCookies(null, ALLOY_NAMES)).toBe("");
  });

  it("tolerates stray whitespace around pairs (mirrors real document.cookie shape)", () => {
    const jar = "kndctr_org=2;   demdex=3";
    expect(scopeSeedCookies(jar, ALLOY_NAMES)).toBe("kndctr_org=2; demdex=3");
  });
});

// spec 067-05 — the default grant is the stock set; narrowing is an opt-in subset.
import { resolveCookieGrant } from "../core/cookie-scope.js";

describe("resolveCookieGrant (spec 067-05)", () => {
  const STOCK = ["vendor_", "vsid", "vtld"]; // TEST vendor fixture set

  it("stock default: no narrowing -> the grant is the stock set, not narrowed", () => {
    expect(resolveCookieGrant(STOCK, undefined)).toEqual({ names: STOCK, narrowed: false });
  });

  it("narrowed opt-in: a subset replaces the grant", () => {
    expect(resolveCookieGrant(STOCK, ["vsid", "vendor_org"])).toEqual({ names: ["vsid", "vendor_org"], narrowed: true });
    expect(resolveCookieGrant(STOCK, [])).toEqual({ names: [], narrowed: true });
  });

  it("narrowing cannot widen: an entry outside the stock set throws", () => {
    expect(() => resolveCookieGrant(STOCK, ["_ga"])).toThrow(TypeError);
    expect(() => resolveCookieGrant(STOCK, ["vsid_x"])).toThrow(TypeError);
    expect(() => resolveCookieGrant(STOCK, ["vend_"])).toThrow(TypeError);
    expect(() => resolveCookieGrant(STOCK, "vsid")).toThrow(TypeError);
  });

  it("no stock declared: no grant is imposed (today's behavior); a narrowing alone still restricts", () => {
    expect(resolveCookieGrant(null, undefined)).toEqual({ names: null, narrowed: false });
    expect(resolveCookieGrant(null, ["a"])).toEqual({ names: ["a"], narrowed: true });
  });
});
