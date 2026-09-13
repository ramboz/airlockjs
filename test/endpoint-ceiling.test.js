// Endpoint ceiling — the seam-side destination control (spec 016-01,
// ADR-0006's declared-as-ceiling law: `granted = declared ∩ host-policy ∩
// consent`).
//
// Pins the PURE checker (originPath / checkEndpointCeiling) — vendor-neutral,
// no connector specifics — against SYNTHETIC hosts. Granularity is origin +
// pathname (query + fragment dropped): a declared deploy-time URL carrying
// `measurement_id`/`api_secret`/a cluster-hint query param must not break the
// ceiling (ADR-0006 Kill #4), and secrets never need to enter the comparison.
// A WRONG PATH on an otherwise-declared origin HOLDS — the path-confinement
// gap `core/config-integrity.js` (spec 015) leaves open (its `hostOf` checks
// only `.host`, never `.pathname`). Every ambiguous case (no declared
// endpoints / an unparseable url) FAILS CLOSED (hold), never open.
import { describe, it, expect } from "vitest";
import { originPath, checkEndpointCeiling } from "../core/endpoint-ceiling.js";

const DECLARED = "https://collect.example/mp/collect";
const EVIL = "https://evil.example/steal";
// A non-numeric port makes this an UNPARSEABLE absolute URL (WHATWG URL
// parsing rejects a non-digit port) — synthetic, no real host.
const UNPARSEABLE = "https://collect.example:notaport/mp/collect";

describe("originPath (spec 016-01 AC1)", () => {
  it("reduces a url to origin + pathname, dropping the query string", () => {
    expect(originPath(`${DECLARED}?measurement_id=G-SYNTHETIC&api_secret=synthetic-secret`)).toBe(DECLARED);
  });

  it("drops a fragment too", () => {
    expect(originPath(`${DECLARED}#section`)).toBe(DECLARED);
  });

  it("returns null for an unparseable url — never guesses a destination", () => {
    expect(originPath(UNPARSEABLE)).toBe(null);
  });
});

describe("checkEndpointCeiling (spec 016-01 AC1)", () => {
  it("allows an outbound url whose origin+path matches a declared endpoint", () => {
    expect(checkEndpointCeiling(DECLARED, [DECLARED])).toEqual({
      verdict: "allow",
      destination: DECLARED,
      reason: "ok",
    });
  });

  it("holds an outbound url to an undeclared origin", () => {
    const result = checkEndpointCeiling(EVIL, [DECLARED]);
    expect(result.verdict).toBe("hold");
    expect(result.destination).toBe(EVIL);
    expect(result.reason).toContain("not in declared endpoints");
    expect(result.reason).toContain("held at the seal");
  });

  it("holds the WRONG PATH on a declared ORIGIN (the path gap config-integrity leaves open)", () => {
    const wrongPath = "https://collect.example/mp/exfiltrate";
    const result = checkEndpointCeiling(wrongPath, [DECLARED]);
    expect(result.verdict).toBe("hold");
    expect(result.destination).toBe(wrongPath);
  });

  it("allows when the declared endpoint AND the outbound url both carry (different) query params — query is dropped before comparison (AC2 / Kill #4)", () => {
    const declaredWithQuery = `${DECLARED}?measurement_id=G-SYNTHETIC&api_secret=synthetic-secret`;
    const outboundWithExtraQuery = `${DECLARED}?measurement_id=G-SYNTHETIC&api_secret=synthetic-secret&_dbg=1&cache_bust=42`;
    const result = checkEndpointCeiling(outboundWithExtraQuery, [declaredWithQuery]);
    expect(result.verdict).toBe("allow");
    expect(result.destination).toBe(DECLARED); // the reported destination never carries the query
  });

  it("holds an unparseable outbound url — fails closed, not open", () => {
    const result = checkEndpointCeiling(UNPARSEABLE, [DECLARED]);
    expect(result.verdict).toBe("hold");
    expect(result.destination).toBe(null);
    expect(result.reason).toContain("unparseable");
  });

  it("holds EVERYTHING when the declared set is empty — fails closed, never open", () => {
    const result = checkEndpointCeiling(DECLARED, []);
    expect(result.verdict).toBe("hold");
    expect(result.destination).toBe(DECLARED);
    expect(result.reason).toContain("no declared endpoints");
  });
});

// ---------------------------------------------------------------------------
// spec 046-02 AC4 — the ;-matrix path-prefix admission (the frame-critique's
// named ceiling break). A declared endpoint whose PATH itself carries a
// ;-matrix segment (DC's `ad.doubleclick.net/activity;src=<id>`) opts into a
// SEGMENT-ANCHORED prefix match: the outbound activity beacon carries a
// per-request `num`/`ord` cachebuster IN THE PATH, so an exact origin+pathname
// match can never hold it. This is ADDITIVE + OPT-IN — every query-delimited
// declared endpoint (no ';' in its path) keeps the strict EXACT match, so the
// fail-closed ceiling is unweakened for GA4 /g/collect, ccm/collect, pixel /tr,
// alloy interact. The prefix is anchored to the DECLARED identity segment
// (`/activity;src=<id>`) and matched at a `;` boundary, so neither a different
// origin/path nor a src-VALUE extension (`src=00000001` vs declared
// `src=0000000`) is admitted.
// ---------------------------------------------------------------------------
const DECLARED_MATRIX = "https://ad.doubleclick.net/activity;src=0000000";

describe("checkEndpointCeiling — ;-matrix path-prefix admission (spec 046-02 AC4)", () => {
  it("admits a ;-matrix outbound that extends a declared ;-matrix prefix — the per-request num/ord cachebuster rides the path", () => {
    const outbound = `${DECLARED_MATRIX};type=syntc000;cat=syntw000;ord=1;num=9999999999999`;
    expect(checkEndpointCeiling(outbound, [DECLARED_MATRIX])).toEqual({
      verdict: "allow",
      destination: outbound,
      reason: "ok",
    });
  });

  it("admits the SAME matrix prefix under a VARYING cachebuster — num is per-request, never part of the ceiling identity", () => {
    const a = `${DECLARED_MATRIX};type=t;num=1111111111111`;
    const b = `${DECLARED_MATRIX};type=t;num=2222222222222`;
    expect(checkEndpointCeiling(a, [DECLARED_MATRIX]).verdict).toBe("allow");
    expect(checkEndpointCeiling(b, [DECLARED_MATRIX]).verdict).toBe("allow");
  });

  it("admits the bare declared prefix itself (destination === prefix, no extra segments)", () => {
    expect(checkEndpointCeiling(DECLARED_MATRIX, [DECLARED_MATRIX]).verdict).toBe("allow");
  });

  it("HOLDS a matrix outbound whose src VALUE extends the declared src — segment-boundary anchored, not a raw startsWith", () => {
    // src=00000001 literally startsWith declared src=0000000, but the next char
    // is `1`, not the `;` segment delimiter — so it is a DIFFERENT advertiser id
    // and must be held.
    const outbound = "https://ad.doubleclick.net/activity;src=00000001;type=x;num=1";
    expect(checkEndpointCeiling(outbound, [DECLARED_MATRIX]).verdict).toBe("hold");
  });

  it("HOLDS a matrix-declared connector's outbound to a DIFFERENT path — the identity prefix is anchored", () => {
    expect(checkEndpointCeiling("https://ad.doubleclick.net/evil;src=0000000;num=1", [DECLARED_MATRIX]).verdict).toBe("hold");
  });

  it("HOLDS a matrix-declared connector's outbound to a DIFFERENT origin", () => {
    expect(checkEndpointCeiling("https://evil.example/activity;src=0000000;num=1", [DECLARED_MATRIX]).verdict).toBe("hold");
  });

  it("REGRESSION: a query-delimited declared endpoint keeps EXACT origin+path match — a ;-suffixed impostor path is HELD, exact allows", () => {
    // DECLARED has no ';' in its path -> it stays an EXACT-match endpoint, NOT a
    // prefix. An outbound that merely appends a ;-segment to the declared path
    // must still be held (the prefix behavior is opt-in via the DECLARED shape,
    // never a blanket prefix-match).
    const impostor = `${DECLARED};evil=1`;
    expect(checkEndpointCeiling(impostor, [DECLARED]).verdict).toBe("hold");
    expect(checkEndpointCeiling(DECLARED, [DECLARED]).verdict).toBe("allow");
  });

  it("a connector declaring BOTH a query-delimited (exact) and a ;-matrix (prefix) endpoint matches each by its own rule", () => {
    const declared = [DECLARED, DECLARED_MATRIX];
    expect(checkEndpointCeiling(DECLARED, declared).verdict).toBe("allow"); // exact
    expect(checkEndpointCeiling(`${DECLARED_MATRIX};num=1`, declared).verdict).toBe("allow"); // prefix
    expect(checkEndpointCeiling("https://collect.example/mp/exfiltrate", declared).verdict).toBe("hold"); // neither
  });
});
