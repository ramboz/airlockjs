// Meta advanced-matching normalization + hashing + the ud[...] merge helper —
// spec 026-04 AC1 (the normalization WITNESSES) + the shared
// `mergeAdvancedMatching` egress helper (Phase 3). The expected hashes are
// computed INDEPENDENTLY here via node:crypto (this test runs in Node, never
// bundled) over the value normalized BY HAND — so an assertion proves BOTH the
// SHA-256 digest AND the per-field normalization, not just the digest.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  hashField,
  normalizeField,
  mergeAdvancedMatching,
  ADVANCED_MATCHING_FIELDS,
} from "../connectors/pixel/advanced-matching.js";

/** Independent SHA-256 → lowercase hex (NOT the module's own crypto path). */
const sha256hex = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

describe("AC1 — SHA-256(normalize(raw)) → ud[<field>] hex, with normalization witnesses", () => {
  it("external_id is hashed VERBATIM (no normalization — the capture-grounded field)", async () => {
    const raw = "11111111-1111-4111-8111-111111111111"; // synthetic GUID (AC7)
    const hex = await hashField("external_id", raw);
    expect(hex).toBe(sha256hex(raw)); // no trim/lowercase applied
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("em WITNESS — ` User@Example.COM ` normalizes to the trim+lowercase hash", async () => {
    const hex = await hashField("em", " User@Example.COM ");
    expect(hex).toBe(sha256hex("user@example.com"));
    // and PROVABLY not the un-normalized digest (the witness is non-vacuous):
    expect(hex).not.toBe(sha256hex(" User@Example.COM "));
  });

  it("ph WITNESS — `(415) 555-0100` normalizes to the digits(+country-code), leading-zeros-stripped hash", async () => {
    const hex = await hashField("ph", "(415) 555-0100");
    expect(hex).toBe(sha256hex("4155550100"));
    expect(hex).not.toBe(sha256hex("(415) 555-0100"));
  });

  it("ph strips LEADING ZEROS but keeps an interior/country-code digit", async () => {
    expect(normalizeField("ph", "0044 20 7946 0018")).toBe("442079460018");
  });

  it("every emitted hash is 64 lowercase hex", async () => {
    for (const field of ["external_id", "em", "ph", "fn", "ln", "zp", "country"]) {
      const hex = await hashField(field, field === "external_id" ? "abc" : "Test-Value 12");
      expect(hex).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("normalization table (doc-grounded fields — ADR-0022 A4)", () => {
  it.each([
    ["fn", "  O'Brien ", "obrien"],
    ["ln", "de la Cruz", "delacruz"],
    ["ct", "New York", "newyork"],
    ["st", "CA", "ca"],
    ["zp", "94103-1234", "94103"], // no-punct then first-5
    ["country", "US", "us"],
    ["ge", "Female", "f"],
    ["db", "1990-01-15", "19900115"],
  ])("%s normalizes %j → %j", (field, raw, expected) => {
    expect(normalizeField(field, raw)).toBe(expected);
  });

  it("preserves non-Latin (UTF-8) letters in names, dropping only punctuation/space", () => {
    expect(normalizeField("fn", "María-José")).toBe("maríajosé");
  });
});

describe("unknown / absent fields are never hashed (only documented ud[...] fields reach the wire)", () => {
  it("an unknown field → undefined (normalizeField + hashField both)", async () => {
    expect(normalizeField("evil", "x")).toBeUndefined();
    expect(await hashField("evil", "x")).toBeUndefined();
  });

  it("a nullish value → undefined", async () => {
    expect(await hashField("em", null)).toBeUndefined();
    expect(await hashField("em", undefined)).toBeUndefined();
  });

  it("ADVANCED_MATCHING_FIELDS is the documented set", () => {
    expect([...ADVANCED_MATCHING_FIELDS].sort()).toEqual(
      ["country", "ct", "db", "em", "external_id", "fn", "ge", "ln", "ph", "st", "zp"].sort(),
    );
  });
});

describe("mergeAdvancedMatching — Phase 3 egress helper (hash-only, per-field, back-compat)", () => {
  const base = () => [{ url: "https://www.facebook.com/tr?id=x&ev=PageView", method: "GET" }];
  const HEX = "a".repeat(64);

  it("appends ud[<field>]=<hex> as URL-encoded query params", () => {
    const [req] = mergeAdvancedMatching(base(), { external_id: HEX, em: "b".repeat(64) });
    const u = new URL(req.url);
    expect(u.searchParams.get("ud[external_id]")).toBe(HEX);
    expect(u.searchParams.get("ud[em]")).toBe("b".repeat(64));
    expect(req.method).toBe("GET"); // shallow-cloned; other fields intact
    expect(req.url).toContain("ud%5Bexternal_id%5D="); // bracket-encoded like cd[...]
  });

  it("empty/absent hashes → the SAME requests reference (byte-identical back-compat)", () => {
    const reqs = base();
    expect(mergeAdvancedMatching(reqs, {})).toBe(reqs);
    expect(mergeAdvancedMatching(reqs, null)).toBe(reqs);
    expect(mergeAdvancedMatching(reqs, undefined)).toBe(reqs);
  });

  it("PER-FIELD degradation — a field absent from the cache is simply omitted (never blanked)", () => {
    const [req] = mergeAdvancedMatching(base(), { external_id: HEX }); // em NOT ready
    const u = new URL(req.url);
    expect(u.searchParams.get("ud[external_id]")).toBe(HEX);
    expect(u.searchParams.has("ud[em]")).toBe(false);
  });

  it("invents nothing — a field absent from udHashes never appears on the wire, even with another field present", () => {
    // Non-vacuous: `em` is deliberately withheld from udHashes, so this assertion
    // FAILS if the helper ever fabricates a field it wasn't given (e.g. a
    // hardcoded/leaked default) — unlike a raw GUID that was never passed in and
    // so can never appear regardless of the helper's behavior.
    const [req] = mergeAdvancedMatching(base(), { external_id: HEX }); // em intentionally absent
    expect(req.url).not.toContain("ud%5Bem%5D"); // em must never be invented
    expect(req.url).not.toContain("11111111-1111"); // no raw GUID anywhere
  });
});
