import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  compileMatcher,
  shouldSuppress,
  shouldSuppressCompiled,
  shouldSuppressBeacon,
  shouldSuppressBeaconCompiled,
  suppressionDiagnostic,
  installTagSuppressor,
} from "../adapters/eds/tag-suppressor.js";

// Spec 049-01/049-02 (craft-review nit fix, Task 5: this file now also covers
// 049-02) — the native-tag suppressor's PURE, DOM-free logic (matcher compile +
// shouldSuppress predicate + carve-out precedence + the diagnostic record
// shape; and, 049-02, the beacon-transport carve-out predicates
// shouldSuppressBeacon/shouldSuppressBeaconCompiled — the fetch+keepalive
// exemption that lets airlock's own egress survive at a URL a suppress matcher
// matches). The DOM-patching itself (installTagSuppressor's actual
// interception, BOTH surfaces) is Node/vitest-INELIGIBLE (no Node/Element
// globals, no jsdom in this repo) and is proven for real in
// rig/tag-suppressor.mjs (a real Chromium, per the module's own SUBSTRATE
// note) — these tests cover only what IS provable here: 049-01 AC1
// (matcher/predicate + the vendor-neutral grep guard), AC3 (the carve-out
// precedence), AC4 (partial migration), AC5 (the diagnostic record shape);
// 049-02 AC1/AC2 (shouldSuppressBeacon(Compiled)'s transport-of-emission
// carve-out, mutation-tested on the fetch+keepalive exemption).

const MODULE_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "adapters", "eds", "tag-suppressor.js");

describe("049-01 AC1 — the module is vendor-neutral (source-text grep guard, ADR-0018 R2)", () => {
  it("adapters/eds/tag-suppressor.js is grep-clean of hardcoded vendor tokens", () => {
    const src = readFileSync(MODULE_PATH, "utf8");
    expect(src).not.toMatch(/gtag|fbevents|google|facebook|AW-|DC-/i);
  });
});

describe("049-01 AC1 — compileMatcher (the pure matcher-compile step)", () => {
  it("returns null for a non-object matcher", () => {
    expect(compileMatcher(null)).toBeNull();
    expect(compileMatcher(undefined)).toBeNull();
    expect(compileMatcher("nope")).toBeNull();
  });

  it("returns null when host is missing or empty — a matcher can never be a universal wildcard", () => {
    expect(compileMatcher({})).toBeNull();
    expect(compileMatcher({ pathname: "/x" })).toBeNull();
    expect(compileMatcher({ host: "" })).toBeNull();
    expect(compileMatcher({ host: "   " })).toBeNull();
  });

  it("normalizes host to trimmed lowercase", () => {
    const c = compileMatcher({ host: "  Example.TEST  " });
    expect(c.host).toBe("example.test");
  });

  it("keeps pathname when present, null when absent (host-only matcher is valid — AC3's over-broad case)", () => {
    expect(compileMatcher({ host: "example.test", pathname: "/a" }).pathname).toBe("/a");
    expect(compileMatcher({ host: "example.test" }).pathname).toBeNull();
  });

  it("normalizes query entries to string values, dropping non-string keys; absent/empty query -> null", () => {
    const c = compileMatcher({ host: "example.test", query: { id: 123, ok: "x" } });
    expect(c.query).toEqual([
      ["id", "123"],
      ["ok", "x"],
    ]);
    expect(compileMatcher({ host: "example.test" }).query).toBeNull();
    expect(compileMatcher({ host: "example.test", query: {} }).query).toBeNull();
  });

  it("retains the original raw matcher as `source` (for the diagnostic to name it verbatim)", () => {
    const raw = { host: "example.test", pathname: "/a" };
    expect(compileMatcher(raw).source).toBe(raw);
  });
});

describe("049-01 AC1/AC4 — shouldSuppress: host + pathname + query matching", () => {
  it("no suppress/allow configured -> never suppressed", () => {
    expect(shouldSuppress("https://example.test/a")).toEqual({ suppressed: false, allowed: false, matcher: null });
    expect(shouldSuppress("https://example.test/a", { suppress: [], allow: [] })).toEqual({
      suppressed: false,
      allowed: false,
      matcher: null,
    });
  });

  it("matches on host + exact pathname", () => {
    const suppress = [{ host: "example.test", pathname: "/runtime.js" }];
    expect(shouldSuppress("https://example.test/runtime.js", { suppress }).suppressed).toBe(true);
    expect(shouldSuppress("https://example.test/other.js", { suppress }).suppressed).toBe(false);
    expect(shouldSuppress("https://other.test/runtime.js", { suppress }).suppressed).toBe(false);
  });

  it("host-only matcher (no pathname) matches ANY path on that host — the over-broad case AC3 carves out", () => {
    const suppress = [{ host: "example.test" }];
    expect(shouldSuppress("https://example.test/a", { suppress }).suppressed).toBe(true);
    expect(shouldSuppress("https://example.test/b?x=1", { suppress }).suppressed).toBe(true);
  });

  it("AC4 — a required query key/value discriminates a subset of a shared host+path (partial migration)", () => {
    const suppress = [{ host: "example.test", pathname: "/runtime.js", query: { id: "SUPPRESS-ME" } }];
    const hit = shouldSuppress("https://example.test/runtime.js?id=SUPPRESS-ME", { suppress });
    expect(hit.suppressed).toBe(true);
    expect(hit.matcher).toEqual(suppress[0]);

    // same host + same path, DIFFERENT id -> NOT suppressed (the kept-in-container runtime).
    const miss = shouldSuppress("https://example.test/runtime.js?id=KEEP-ME", { suppress });
    expect(miss.suppressed).toBe(false);
  });

  it("an extra, unrelated query param on the matched URL does not defeat a match (only DECLARED keys are checked)", () => {
    const suppress = [{ host: "example.test", pathname: "/runtime.js", query: { id: "X" } }];
    expect(shouldSuppress("https://example.test/runtime.js?id=X&extra=1", { suppress }).suppressed).toBe(true);
  });

  it("an unparseable url never throws and is never suppressed (fails open — never breaks the page)", () => {
    expect(() => shouldSuppress("not a url", { suppress: [{ host: "example.test" }] })).not.toThrow();
    expect(shouldSuppress("not a url", { suppress: [{ host: "example.test" }] }).suppressed).toBe(false);
    expect(shouldSuppress("", { suppress: [{ host: "example.test" }] }).suppressed).toBe(false);
  });

  it("an invalid matcher in the list (no host) is silently skipped, never throws", () => {
    const suppress = [{ pathname: "/x" }, { host: "example.test", pathname: "/runtime.js" }];
    expect(() => shouldSuppress("https://example.test/runtime.js", { suppress })).not.toThrow();
    expect(shouldSuppress("https://example.test/runtime.js", { suppress }).suppressed).toBe(true);
  });
});

describe("049-01 AC3 — the airlock-egress carve-out wins by construction (allow beats suppress)", () => {
  // This is the MUTATION-VERIFIED test (see the implementer's report): removing
  // the allow-checked-first precedence in shouldSuppress makes this go red
  // (airlock's own egress would get suppressed by the over-broad matcher).
  it("an allow-matched URL is NEVER suppressed, even when an over-broad suppress matcher also matches it", () => {
    const suppress = [{ host: "shared.test" }]; // over-broad: host-only, matches every path
    const allow = [{ host: "shared.test", pathname: "/mp/collect" }]; // airlock's own egress endpoint

    const airlockOwn = shouldSuppress("https://shared.test/mp/collect", { suppress, allow });
    expect(airlockOwn).toEqual({ suppressed: false, allowed: true, matcher: allow[0] });

    // the container's OWN egress on the same host, NOT allow-listed, is still suppressed.
    const containerOwn = shouldSuppress("https://shared.test/g/collect", { suppress, allow });
    expect(containerOwn).toEqual({ suppressed: true, allowed: false, matcher: suppress[0] });
  });

  it("allow with no matching suppress is simply not-suppressed (allow doesn't need a competing suppress to matter)", () => {
    const allow = [{ host: "shared.test", pathname: "/mp/collect" }];
    expect(shouldSuppress("https://shared.test/mp/collect", { allow }).allowed).toBe(true);
  });
});

describe("049-01 NIT (craft/perf review) — shouldSuppressCompiled: the precompiled-matcher hot path", () => {
  // installTagSuppressor's per-candidate evaluation (the DOM patch's hottest
  // path) must NOT recompile the matcher lists on every script insertion —
  // compileMatcher runs ONCE at install/config-update time, and the patched
  // methods call shouldSuppressCompiled directly against the stored compiled
  // arrays. This is the pure, DOM-free core both shouldSuppress (compiles on
  // every call, kept for its existing tested raw-matcher contract) and the
  // hot path (precompiled once) share.
  it("given precompiled matchers (compileMatcher's own output), yields the SAME verdict as shouldSuppress's raw-matcher call", () => {
    const rawSuppress = [{ host: "example.test", pathname: "/runtime.js", query: { id: "X" } }];
    const rawAllow = [{ host: "example.test", pathname: "/mp/collect" }];
    const compiledSuppress = rawSuppress.map(compileMatcher);
    const compiledAllow = rawAllow.map(compileMatcher);

    for (const url of [
      "https://example.test/runtime.js?id=X", // suppressed
      "https://example.test/mp/collect", // allowed
      "https://example.test/runtime.js?id=Y", // neither (different id)
    ]) {
      expect(shouldSuppressCompiled(url, { suppress: compiledSuppress, allow: compiledAllow })).toEqual(
        shouldSuppress(url, { suppress: rawSuppress, allow: rawAllow }),
      );
    }
  });

  it("carries the SAME carve-out precedence (allow beats suppress) over precompiled matchers", () => {
    const compiledSuppress = [compileMatcher({ host: "shared.test" })]; // over-broad
    const compiledAllow = [compileMatcher({ host: "shared.test", pathname: "/mp/collect" })];

    const airlockOwn = shouldSuppressCompiled("https://shared.test/mp/collect", {
      suppress: compiledSuppress,
      allow: compiledAllow,
    });
    expect(airlockOwn.allowed).toBe(true);
    expect(airlockOwn.suppressed).toBe(false);

    const containerOwn = shouldSuppressCompiled("https://shared.test/g/collect", {
      suppress: compiledSuppress,
      allow: compiledAllow,
    });
    expect(containerOwn.suppressed).toBe(true);
  });

  it("defaults to empty precompiled lists and never throws", () => {
    expect(() => shouldSuppressCompiled("https://example.test/a")).not.toThrow();
    expect(shouldSuppressCompiled("https://example.test/a")).toEqual({ suppressed: false, allowed: false, matcher: null });
  });
});

describe("049-01 AC5 — suppressionDiagnostic (the pure 028-shaped diagnostic-record builder, FLAT fields only)", () => {
  // BLOCKER FIX (arch+compliance review): spec 028's inspector collector
  // (core/inspector/collector.js:53-60) documents a FLAT-RECORD INVARIANT — its
  // shallow copy-on-write (`{ ...record }`) assumes every field is a primitive;
  // a nested `matcher` object (with a nested `query`) would alias the SAME
  // object across every buffered ring row referencing it, corrupting the
  // collector's isolation guarantee. So the record carries flat primitive
  // fields ONLY — no nested matcher object anywhere.
  it("names the level/kind/disposition + the matched URL + the matcher's host/pathname, and serializes query to a flat string; defaults transport to 'script' (049-01's own call sites)", () => {
    const matcher = { host: "shared.test", pathname: "/runtime.js", query: { id: "X" } };
    const record = suppressionDiagnostic("https://shared.test/runtime.js?id=X", matcher);
    expect(record).toEqual({
      level: "warn",
      kind: "tag-suppressor",
      disposition: "suppressed",
      url: "https://shared.test/runtime.js?id=X",
      matcherHost: "shared.test",
      matcherPathname: "/runtime.js",
      matcherQuery: "id=X",
      transport: "script",
    });
  });

  it("049-02 — names the caller-supplied transport (e.g. a beacon transport) instead of the 'script' default", () => {
    const matcher = { host: "shared.test", pathname: "/beacon" };
    const record = suppressionDiagnostic("https://shared.test/beacon?id=X", matcher, "img");
    expect(record.transport).toBe("img");
  });

  it("emits empty-string matcherPathname/matcherQuery when the matcher has no pathname/query constraint (host-only, the AC3 over-broad case)", () => {
    const record = suppressionDiagnostic("https://shared.test/a", { host: "shared.test" });
    expect(record.matcherPathname).toBe("");
    expect(record.matcherQuery).toBe("");
  });

  it("serializes a multi-key query as `&`-joined key=value pairs", () => {
    const record = suppressionDiagnostic("https://shared.test/runtime.js?id=X&y=2", {
      host: "shared.test",
      pathname: "/runtime.js",
      query: { id: "X", y: 2 },
    });
    expect(record.matcherQuery).toBe("id=X&y=2");
  });

  it("is a FLAT record — every field is a primitive (string/number), no nested object/array anywhere", () => {
    const record = suppressionDiagnostic("https://shared.test/runtime.js?id=X", {
      host: "shared.test",
      pathname: "/runtime.js",
      query: { id: "X" },
    });
    for (const value of Object.values(record)) {
      expect(value === null || typeof value === "string" || typeof value === "number").toBe(true);
    }
  });

  it("is safe (never throws, empty-string matcher fields) when matcher is null (defensive — should not occur in practice)", () => {
    expect(() => suppressionDiagnostic("https://shared.test/a", null)).not.toThrow();
    const record = suppressionDiagnostic("https://shared.test/a", null);
    expect(record.matcherHost).toBe("");
    expect(record.matcherPathname).toBe("");
    expect(record.matcherQuery).toBe("");
  });

  it("falls back to 'script' when a caller passes an invalid (non-string) transport", () => {
    expect(suppressionDiagnostic("https://shared.test/a", null, 42).transport).toBe("script");
    expect(suppressionDiagnostic("https://shared.test/a", null, "").transport).toBe("script");
  });
});

describe("049-02 AC1/AC2/AC3 — shouldSuppressBeacon: the transport-of-emission carve-out (pure, DOM-free)", () => {
  // A-collision (spec 049-02): airlock reproduces a container's beacon at the
  // container's BYTE-IDENTICAL URL, so a URL/query matcher alone cannot
  // separate airlock's copy from the container's — the discriminator is the
  // TRANSPORT the request was emitted through. airlock emits EVERY own
  // main-thread beacon via `fetch(url, { keepalive: true })` (core/egress.js
  // `fetchInit`) and NEVER `<img>`/`sendBeacon`/`XHR` — so a `fetch` carrying
  // `keepalive:true` is EXEMPT from suppression even at a matching URL; every
  // other transport (img/sendBeacon/xhr/non-keepalive fetch) is suppressed
  // exactly like 049-01's URL-based verdict.
  const suppress = [{ host: "shared.test", pathname: "/beacon" }];
  const MATCHING_URL = "https://shared.test/beacon?id=X";
  const NONMATCHING_URL = "https://shared.test/other";

  it.each(["img", "sendBeacon", "xhr"])(
    "AC1 — a %s beacon at a matching URL is suppressed (no keepalive concept for this transport)",
    (transport) => {
      const verdict = shouldSuppressBeacon(MATCHING_URL, { suppress, transport });
      expect(verdict.suppressed).toBe(true);
      expect(verdict.matcher).toEqual(suppress[0]);
    },
  );

  it("AC1/AC2 — a NON-keepalive fetch at a matching URL IS suppressed (only keepalive:true is exempt)", () => {
    const verdict = shouldSuppressBeacon(MATCHING_URL, { suppress, transport: "fetch", keepalive: false });
    expect(verdict.suppressed).toBe(true);
  });

  it("AC1 — a non-matching URL is never suppressed, on any transport", () => {
    for (const transport of ["img", "sendBeacon", "xhr", "fetch"]) {
      expect(shouldSuppressBeacon(NONMATCHING_URL, { suppress, transport, keepalive: true }).suppressed).toBe(false);
    }
  });

  // THE MUTATION-VERIFIED, LOAD-BEARING TEST (see the implementer's report): removing
  // the `transport === "fetch" && keepalive === true` exemption makes this go red
  // (airlock's own keepalive-fetch reproduction of a matching URL would be dropped).
  it("AC2 — a fetch with init.keepalive===true is EXEMPT even at a URL that matches a suppress matcher (airlock's own egress signature)", () => {
    const verdict = shouldSuppressBeacon(MATCHING_URL, { suppress, transport: "fetch", keepalive: true });
    expect(verdict.suppressed).toBe(false);
    expect(verdict.exempt).toBe(true);
  });

  it("AC2 — the 049-01 URL allow-set is ADDITIVE — it still keeps a URL on ANY transport, not just fetch+keepalive", () => {
    const allow = [{ host: "shared.test", pathname: "/beacon" }];
    for (const transport of ["img", "sendBeacon", "xhr"]) {
      const verdict = shouldSuppressBeacon(MATCHING_URL, { suppress, allow, transport });
      expect(verdict.suppressed).toBe(false);
      expect(verdict.allowed).toBe(true);
    }
  });

  it("never throws on garbage input", () => {
    expect(() => shouldSuppressBeacon("not a url", { suppress, transport: "img" })).not.toThrow();
    expect(() => shouldSuppressBeacon(MATCHING_URL, {})).not.toThrow();
    expect(() => shouldSuppressBeacon(MATCHING_URL)).not.toThrow();
  });
});

describe("049-02 — shouldSuppressBeaconCompiled: the precompiled-matcher hot path (mirrors 049-01's shouldSuppressCompiled)", () => {
  const rawSuppress = [{ host: "shared.test", pathname: "/beacon" }];
  const compiledSuppress = rawSuppress.map(compileMatcher);

  it("matches shouldSuppressBeacon's raw-matcher verdict for the same input", () => {
    for (const [transport, keepalive] of [
      ["img", false],
      ["fetch", false],
      ["fetch", true],
    ]) {
      expect(
        shouldSuppressBeaconCompiled("https://shared.test/beacon?id=X", { suppress: compiledSuppress, transport, keepalive }),
      ).toEqual(shouldSuppressBeacon("https://shared.test/beacon?id=X", { suppress: rawSuppress, transport, keepalive }));
    }
  });

  it("carries the SAME keepalive-fetch exemption over precompiled matchers", () => {
    const verdict = shouldSuppressBeaconCompiled("https://shared.test/beacon?id=X", {
      suppress: compiledSuppress,
      transport: "fetch",
      keepalive: true,
    });
    expect(verdict.suppressed).toBe(false);
    expect(verdict.exempt).toBe(true);
  });
});

describe("049-01 AC1 — installTagSuppressor is safe (never throws) with no DOM present (this repo's Node/vitest substrate)", () => {
  it("returns an inert { uninstall } controller and does not throw when Node/Element are undefined", () => {
    expect(typeof Node).toBe("undefined"); // sanity: this really is the no-DOM substrate the module must guard
    expect(typeof Element).toBe("undefined");
    let controller;
    expect(() => {
      controller = installTagSuppressor({ suppress: [{ host: "example.test" }] });
    }).not.toThrow();
    expect(controller).toBeTruthy();
    expect(typeof controller.uninstall).toBe("function");
    expect(() => controller.uninstall()).not.toThrow();
  });

  it("is safe to call with no config at all", () => {
    expect(() => installTagSuppressor()).not.toThrow();
    expect(() => installTagSuppressor({})).not.toThrow();
  });

  // RE-SCOPED (compliance-review blocker fix, Task 3): this test USED to be
  // titled "idempotent install" and claimed to prove double-wrap safety on a
  // second call — but in the no-DOM substrate `installTagSuppressor` early-returns
  // (see the test above) before any patching logic runs at all, so it exercised
  // NOTHING beyond "doesn't throw twice" — deleting the real idempotency guards
  // (the `!state.installed` short-circuit, the per-function marker checks) would
  // NOT turn this red. Real idempotency (no double-wrap survives a single
  // uninstall(), even after a re-install) is now proven for real in the
  // real-browser rig (rig/tag-suppressor.mjs) — see the implementer's report for
  // that mutation-red proof. This test asserts ONLY what is actually true here:
  // repeated calls in the no-DOM substrate are each a safe no-op, each returning
  // its own inert { uninstall } handle whose uninstall() never throws.
  it("calling it twice in the no-DOM substrate is still a safe no-op — each call returns an inert { uninstall } handle whose uninstall() never throws", () => {
    const first = installTagSuppressor({ suppress: [{ host: "a.test" }] });
    const second = installTagSuppressor({ suppress: [{ host: "b.test" }] });
    expect(typeof first.uninstall).toBe("function");
    expect(typeof second.uninstall).toBe("function");
    expect(() => first.uninstall()).not.toThrow();
    expect(() => second.uninstall()).not.toThrow();
  });
});
