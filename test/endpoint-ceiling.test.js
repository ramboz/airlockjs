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
