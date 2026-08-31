import { describe, it, expect } from "vitest";
import { governPayload, DEFAULT_DENYLIST } from "../core/payload-governance.js";

// Spec 019-01 (ADR-0012) — the host-owned, input-side sensitive-field
// denylist. `governPayload` is the vendor-neutral, import-free, PURE
// primitive (mirrors core/consent.js / core/endpoint-ceiling.js): these are
// its hermetic node unit tests. The two crossing points that WIRE it
// (core/airlock.js's sendBatch + the sync/critical dispatcher) are covered
// end-to-end in test/payload-governance-seam.test.js; the adapter threading
// is covered in test/eds-boot.test.js.
//
// Non-mutation is the load-bearing property under test here (frame-critique
// "nested-mutation-trap" focus): governPayload must NEVER touch its `params`
// input, including along a nested/dotted denied path, where a naive shallow
// copy would otherwise mutate a subtree the caller's local event log shares.

describe("AC1 — identity when the denylist is empty/absent (AC6 back-compat, no clone)", () => {
  it("an empty array denylist returns the SAME params reference and an empty stripped list", () => {
    const params = { a: 1, password: "hunter2" };
    const result = governPayload(params, []);
    expect(result.governed).toBe(params); // identity — no clone
    expect(result.stripped).toEqual([]);
  });

  it("an absent (undefined) denylist is identity too", () => {
    const params = { a: 1 };
    const result = governPayload(params, undefined);
    expect(result.governed).toBe(params);
    expect(result.stripped).toEqual([]);
  });

  it("a null denylist is identity too (never throws on a malformed denylist)", () => {
    const params = { a: 1 };
    const result = governPayload(params, null);
    expect(result.governed).toBe(params);
    expect(result.stripped).toEqual([]);
  });

  it("a non-array truthy denylist (malformed) is treated as absent -> identity", () => {
    const params = { a: 1 };
    const result = governPayload(params, "password");
    expect(result.governed).toBe(params);
    expect(result.stripped).toEqual([]);
  });
});

describe("AC1 — top-level strip: the pinned observable", () => {
  it('governPayload({a:1, password:"x"}, ["password"]) -> { governed:{a:1}, stripped:["password"] }', () => {
    const params = { a: 1, password: "x" };
    const result = governPayload(params, ["password"]);
    expect(result.governed).toEqual({ a: 1 });
    expect(result.stripped).toEqual(["password"]);
  });

  it("does not mutate the input — the original object still has the denied field afterward", () => {
    const params = { a: 1, password: "x" };
    governPayload(params, ["password"]);
    expect(params).toEqual({ a: 1, password: "x" }); // untouched
  });

  it("a non-empty denylist that matches NOTHING present returns the SAME reference (no needless clone — always-on default, clean payload is the common hot-path case)", () => {
    const params = { a: 1 };
    const result = governPayload(params, ["password"]);
    expect(result.governed).toBe(params); // nothing stripped -> original ref, byte- AND reference-identical
    expect(result.stripped).toEqual([]);
  });

  it("case-insensitive matching: an uppercase denylist entry strips a lowercase field and vice versa", () => {
    expect(governPayload({ password: "x" }, ["PASSWORD"]).governed).toEqual({});
    expect(governPayload({ Password: "x" }, ["password"]).governed).toEqual({});
  });

  it("exact match only — a field that merely CONTAINS the denied name is not stripped", () => {
    const result = governPayload({ passwordConfirm: "x" }, ["password"]);
    expect(result.governed).toEqual({ passwordConfirm: "x" });
    expect(result.stripped).toEqual([]);
  });

  it("multiple top-level denied fields are all stripped, benign fields pass through", () => {
    const result = governPayload(
      { email: "a@b.c", ssn: "123-45-6789", link_text: "Buy" },
      ["email", "ssn"],
    );
    expect(result.governed).toEqual({ link_text: "Buy" });
    expect(result.stripped.slice().sort()).toEqual(["email", "ssn"]);
  });
});

describe("AC1 — nested/dotted-path strip: copy-on-write along the path only", () => {
  it("governPayload({user:{email,name}}, ['user.email']) strips only the nested leaf, keeps the sibling", () => {
    const params = { user: { email: "a@b.c", name: "Jo" } };
    const result = governPayload(params, ["user.email"]);
    expect(result.governed.user).toEqual({ name: "Jo" });
    expect(result.stripped).toEqual(["user.email"]);
  });

  it("does NOT mutate the input's nested object — the shared sub-object is untouched", () => {
    const params = { user: { email: "a@b.c", name: "Jo" } };
    governPayload(params, ["user.email"]);
    expect(params.user).toEqual({ email: "a@b.c", name: "Jo" }); // still has email
  });

  it("clones ONLY the objects on the denied path — an off-path sibling subtree stays STRUCTURALLY SHARED", () => {
    const params = { user: { email: "a@b.c", name: "Jo" }, other: { x: 1 } };
    const result = governPayload(params, ["user.email"]);
    expect(result.governed.user).not.toBe(params.user); // on-path: cloned
    expect(result.governed.other).toBe(params.other); // off-path: SAME reference (not a full deep clone)
  });

  it("a dotted path that does not resolve (missing intermediate) is a no-op — nothing stripped, original reference returned", () => {
    const params = { a: 1 };
    const result = governPayload(params, ["user.email"]);
    expect(result.governed).toEqual({ a: 1 });
    expect(result.stripped).toEqual([]);
    expect(result.governed).toBe(params); // nothing stripped -> same ref (no needless clone)
  });

  it("a dotted path whose leaf is absent (parent exists, field does not) is a no-op for that entry", () => {
    const params = { user: { name: "Jo" } };
    const result = governPayload(params, ["user.email"]);
    expect(result.governed.user).toBe(params.user); // untouched — nothing to strip on this path
    expect(result.stripped).toEqual([]);
  });

  it("case-insensitive matching applies at each dotted-path segment", () => {
    const params = { User: { Email: "a@b.c" } };
    const result = governPayload(params, ["user.email"]);
    expect(result.governed.User).toEqual({});
    expect(result.stripped).toEqual(["user.email"]);
  });

  it("a malformed dotted-path entry (e.g. a lone '.') never throws and is ignored", () => {
    expect(() => governPayload({ a: 1 }, ["."])).not.toThrow();
    const result = governPayload({ a: 1 }, ["."]);
    expect(result.stripped).toEqual([]);
  });

  it("combines top-level and nested denials in one call, in a single pass", () => {
    const params = { password: "x", user: { email: "a@b.c", name: "Jo" }, link_text: "Buy" };
    const result = governPayload(params, ["password", "user.email"]);
    expect(result.governed).toEqual({ user: { name: "Jo" }, link_text: "Buy" });
    expect(result.stripped.slice().sort()).toEqual(["password", "user.email"]);
    // non-mutation still holds across the combined call
    expect(params).toEqual({ password: "x", user: { email: "a@b.c", name: "Jo" }, link_text: "Buy" });
  });
});

describe("AC1 — a conservative built-in DEFAULT_DENYLIST is exported", () => {
  it("is a non-empty array of lower-case field-name strings covering the named conservative set", () => {
    expect(Array.isArray(DEFAULT_DENYLIST)).toBe(true);
    expect(DEFAULT_DENYLIST.length).toBeGreaterThan(0);
    for (const entry of DEFAULT_DENYLIST) {
      expect(typeof entry).toBe("string");
      expect(entry.length).toBeGreaterThan(0);
    }
    // The ADR-0012 / slice-named conservative examples must be present.
    expect(DEFAULT_DENYLIST).toEqual(expect.arrayContaining(["password", "cvv", "ssn"]));
  });
});

describe("AC1 — never throws (malformed input fails safe to a best-effort copy)", () => {
  it("a null/undefined/primitive params never throws — returns a best-effort result", () => {
    expect(() => governPayload(null, ["password"])).not.toThrow();
    expect(() => governPayload(undefined, ["password"])).not.toThrow();
    expect(() => governPayload(42, ["password"])).not.toThrow();
    expect(() => governPayload("a string", ["password"])).not.toThrow();
  });

  it("a denylist with malformed entries (null/number/empty-string) is filtered out, never throws", () => {
    const params = { a: 1, password: "x" };
    let result;
    expect(() => { result = governPayload(params, [null, 42, "", "password"]); }).not.toThrow();
    expect(result.governed).toEqual({ a: 1 });
    expect(result.stripped).toEqual(["password"]);
  });

  it("never throws even when reading a field throws (a hostile getter) — falls back to the identity", () => {
    const hostile = {};
    Object.defineProperty(hostile, "password", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    let result;
    expect(() => {
      result = governPayload(hostile, ["password"]);
    }).not.toThrow();
    expect(result.governed).toBe(hostile); // last-resort fallback: the original reference
    expect(result.stripped).toEqual([]);
    expect(result.error).toBe(true); // fail-open is FLAGGED (arch+craft review), not silent
  });

  it("strips EVERY case-variant of a denied name at the same level, not just the first (craft review — a value-leak fix)", () => {
    // Two own case-variants of a denied field (plausibly from merged/autofilled
    // form sources): stripping only the first would leak the second's value.
    const params = { password: "a", Password: "b", PASSWORD: "c", keep: 1 };
    const { governed, stripped } = governPayload(params, ["password"]);
    expect(governed).toEqual({ keep: 1 }); // all three variants gone
    expect("Password" in governed).toBe(false);
    expect("PASSWORD" in governed).toBe(false);
    expect(stripped).toEqual(["password"]);
    expect(params).toEqual({ password: "a", Password: "b", PASSWORD: "c", keep: 1 }); // input unmutated
  });

  it("strips every case-variant at a nested dotted-path leaf too (craft review)", () => {
    const params = { user: { email: "a@b.c", Email: "d@e.f", ok: 1 } };
    const { governed } = governPayload(params, ["user.email"]);
    expect(governed.user).toEqual({ ok: 1 }); // both email casings gone on the clone
    expect(params.user).toEqual({ email: "a@b.c", Email: "d@e.f", ok: 1 }); // original untouched
  });
});
