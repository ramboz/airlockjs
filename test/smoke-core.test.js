// The pure, browser-INDEPENDENT logic behind rig/subset-smoke.mjs (spec 036-02) — the
// CI-provable core of the supported-subset live smoke. The rig itself needs a real
// Playwright browser and is a manually/dry-run-invoked harness (like rig/e2e.mjs, NOT
// gated on a live URL in this vitest suite); this file is what CAN be red->green tested:
//
//   - the three primitives EXTRACTED from rig/e2e.mjs (AC5 — genuine reuse, not a fork):
//     the Ajv ga4-mp-request.schema.json oracle compile, the `/collect*` beacon-capture
//     route, and the boot-health wait — each DI'd (fed a fake `page`), so they are cheap
//     to exercise here without a browser;
//   - the PURE verdict/disposition logic (item 3): given boot-health flags + GA4-
//     conformance + alloy-fired + RUM-present, decide a per-check disposition + an
//     overall pass/fail — carrying the honest-labeling discipline (presence != acceptance)
//     as an ASSERTED property, not just a comment.
import { describe, it, expect } from "vitest";
import {
  compileGa4Validator,
  captureCollectBeacons,
  waitForBootHealth,
  bootHealthDisposition,
  ga4Disposition,
  alloyPresenceDisposition,
  rumSentDisposition,
  buildSmokeVerdict,
} from "../rig/smoke-core.mjs";

describe("compileGa4Validator — the shared Ajv MP-schema oracle (AC5, reused not re-implemented)", () => {
  const MINI_SCHEMA = { type: "object", required: ["ok"], properties: { ok: { const: true } } };

  it("compiles a schema into a working Ajv validate function", () => {
    const validate = compileGa4Validator(MINI_SCHEMA);
    expect(validate({ ok: true })).toBe(true);
    expect(validate({ ok: false })).toBe(false);
  });
});

describe("captureCollectBeacons — the shared /collect* route (AC5, e2e.mjs's own pattern, byte-preserved)", () => {
  it("routes **/collect*, parses a GA4 MP body into `beacons`, and fulfills 204 by default", async () => {
    let routedPattern;
    let routedHandler;
    const fakePage = {
      route: async (pattern, handler) => {
        routedPattern = pattern;
        routedHandler = handler;
      },
    };
    const beacons = [];
    await captureCollectBeacons(fakePage, beacons);
    expect(routedPattern).toBe("**/collect*");

    let fulfilled;
    const fakeRoute = {
      request: () => ({
        postData: () => JSON.stringify({
          client_id: "abc.123",
          events: [{ name: "page_view", params: { page_location: "http://x/" } }],
        }),
      }),
      fulfill: (opts) => { fulfilled = opts; },
    };
    routedHandler(fakeRoute);
    expect(beacons).toHaveLength(1);
    expect(beacons[0]).toMatchObject({ name: "page_view", clientId: "abc.123", pageLocation: "http://x/" });
    expect(fulfilled).toEqual({ status: 204, body: "" });
  });

  it("keeps an unparseable body as {} rather than throwing (matches e2e.mjs's try/catch)", async () => {
    let routedHandler;
    const fakePage = { route: async (_pattern, handler) => { routedHandler = handler; } };
    const beacons = [];
    await captureCollectBeacons(fakePage, beacons);
    const fakeRoute = { request: () => ({ postData: () => "not-json" }), fulfill: () => {} };
    expect(() => routedHandler(fakeRoute)).not.toThrow();
    expect(beacons[0]).toMatchObject({ name: null, clientId: null, pageLocation: null });
  });

  it("passthrough:true lets the real request continue instead of fulfilling (the live-mode arm)", async () => {
    let routedHandler;
    const fakePage = { route: async (_pattern, handler) => { routedHandler = handler; } };
    const beacons = [];
    await captureCollectBeacons(fakePage, beacons, { passthrough: true });
    let continued = false;
    let fulfilled = false;
    const fakeRoute = {
      request: () => ({ postData: () => JSON.stringify({ client_id: "x", events: [{ name: "page_view" }] }) }),
      fulfill: () => { fulfilled = true; },
      continue: () => { continued = true; },
    };
    routedHandler(fakeRoute);
    expect(continued).toBe(true);
    expect(fulfilled).toBe(false);
  });
});

describe("waitForBootHealth — the shared boot-health wait (AC5, e2e.mjs's own pattern, DI'd mark/flags)", () => {
  it("defaults to airlock:init / __airlockBootFailed at a 20s timeout (byte-identical to e2e.mjs's original inline wait)", async () => {
    let seenFn;
    let seenArg;
    let seenOpts;
    const fakePage = {
      waitForFunction: async (fn, arg, opts) => { seenFn = fn; seenArg = arg; seenOpts = opts; },
    };
    await waitForBootHealth(fakePage);
    expect(seenArg).toEqual({ mark: "airlock:init", flags: ["__airlockBootFailed"] });
    expect(seenOpts).toEqual({ timeout: 20000 });
    expect(typeof seenFn).toBe("function");
  });

  it("accepts a DI'd mark/flags/timeout (e.g. subset-smoke.mjs's RUM boot-health check)", async () => {
    let seenArg;
    let seenOpts;
    const fakePage = { waitForFunction: async (_fn, arg, opts) => { seenArg = arg; seenOpts = opts; } };
    await waitForBootHealth(fakePage, { timeout: 5000, successMark: "airlock:rum", failureFlags: ["__airlockRumBootFailed"] });
    expect(seenArg).toEqual({ mark: "airlock:rum", flags: ["__airlockRumBootFailed"] });
    expect(seenOpts).toEqual({ timeout: 5000 });
  });

  it("never throws even if page.waitForFunction rejects (matches e2e.mjs's .catch(() => {}))", async () => {
    const fakePage = { waitForFunction: async () => { throw new Error("timeout"); } };
    await expect(waitForBootHealth(fakePage)).resolves.toBeUndefined();
  });
});

describe("bootHealthDisposition — pure verdict logic (item 3)", () => {
  it("null/undefined bootFailed -> healthy", () => {
    expect(bootHealthDisposition(null).ok).toBe(true);
    expect(bootHealthDisposition(undefined).ok).toBe(true);
  });

  it("a bootFailed string -> FAIL, disposition names it", () => {
    const d = bootHealthDisposition("Error: boom");
    expect(d.ok).toBe(false);
    expect(d.disposition).toMatch(/boom/);
  });
});

describe("ga4Disposition — presence + MP-conformance (a legitimate client-side oracle for GA4)", () => {
  it("not exercised (no GA4 connector in this arm) -> informational pass, never fails the verdict", () => {
    const d = ga4Disposition({ exercised: false });
    expect(d.ok).toBe(true);
    expect(d.exercised).toBe(false);
  });

  it("exercised but absent (no beacon captured) -> FAIL", () => {
    const d = ga4Disposition({ exercised: true, present: false, conformant: null });
    expect(d.ok).toBe(false);
    expect(d.disposition).toMatch(/absent/i);
  });

  it("present + NON-conformant -> FAIL", () => {
    const d = ga4Disposition({ exercised: true, present: true, conformant: false });
    expect(d.ok).toBe(false);
    expect(d.disposition).toMatch(/non-conformant/i);
  });

  it("present + conformant -> PASS", () => {
    const d = ga4Disposition({ exercised: true, present: true, conformant: true });
    expect(d.ok).toBe(true);
    expect(d.disposition).toMatch(/conformant/i);
  });
});

describe("alloyPresenceDisposition — presence ONLY, never shape/acceptance (AC1)", () => {
  it("not exercised (no alloy connector in this arm) -> informational pass", () => {
    const d = alloyPresenceDisposition({ exercised: false });
    expect(d.ok).toBe(true);
  });

  it("not locally exercisable (the CSP stub performs no network call) -> informational pass, honestly labeled (AC3)", () => {
    const d = alloyPresenceDisposition({ exercised: true, locallyExercisable: false, fired: null });
    expect(d.ok).toBe(true);
    expect(d.disposition).toMatch(/not exercised locally/i);
  });

  it("exercised + fired -> PASS, labeled presence-only, and the disposition NEVER claims acceptance", () => {
    const d = alloyPresenceDisposition({ exercised: true, locallyExercisable: true, fired: true });
    expect(d.ok).toBe(true);
    expect(d.disposition).toMatch(/fired/i);
    expect(d.disposition).toMatch(/presence only/i);
    expect(d.disposition.toLowerCase()).not.toContain("accepted");
  });

  it("exercised + NOT fired (live) -> FAIL", () => {
    const d = alloyPresenceDisposition({ exercised: true, locallyExercisable: true, fired: false });
    expect(d.ok).toBe(false);
    expect(d.disposition).toMatch(/not fired/i);
  });
});

describe("rumSentDisposition — the SENT beacon shape only, never collector acceptance (AC1/AC2)", () => {
  it("window.__airlockOwnsRum not set -> not applicable, informational pass", () => {
    const d = rumSentDisposition({ owns: false });
    expect(d.ok).toBe(true);
    expect(d.disposition).toMatch(/not applicable/i);
  });

  it("owns RUM but nothing captured -> FAIL", () => {
    const d = rumSentDisposition({ owns: true, captured: false });
    expect(d.ok).toBe(false);
    expect(d.disposition).toMatch(/not sent/i);
  });

  it("captured with the expected fields -> PASS, labeled sent-shape-only, and NEVER claims collector acceptance", () => {
    const d = rumSentDisposition({ owns: true, captured: true, hasExpectedFields: true });
    expect(d.ok).toBe(true);
    expect(d.disposition).toMatch(/sent/i);
    expect(d.disposition.toLowerCase()).not.toContain("accepted");
    expect(d.disposition).toMatch(/downstream/i);
  });

  it("captured but missing an expected field -> FAIL", () => {
    const d = rumSentDisposition({ owns: true, captured: true, hasExpectedFields: false });
    expect(d.ok).toBe(false);
  });
});

describe("buildSmokeVerdict — assembles the full card (pass iff every check's `ok` holds)", () => {
  it("all-informational (nothing exercised) -> PASS", () => {
    const checks = {
      boot_health: bootHealthDisposition(null),
      ga4: ga4Disposition({ exercised: false }),
      alloy: alloyPresenceDisposition({ exercised: false }),
      rum: rumSentDisposition({ owns: false }),
    };
    const v = buildSmokeVerdict({ mode: "local", checks });
    expect(v.pass).toBe(true);
    expect(v.verdict).toMatch(/PASS/);
  });

  it("bootFailed anywhere -> overall FAIL", () => {
    const checks = {
      boot_health: bootHealthDisposition("boom"),
      ga4: ga4Disposition({ exercised: false }),
      alloy: alloyPresenceDisposition({ exercised: false }),
      rum: rumSentDisposition({ owns: false }),
    };
    const v = buildSmokeVerdict({ mode: "local", checks });
    expect(v.pass).toBe(false);
    expect(v.verdict).toMatch(/FAIL/);
  });

  it("GA4 non-conformant -> overall FAIL even when every other check passes", () => {
    const checks = {
      boot_health: bootHealthDisposition(null),
      ga4: ga4Disposition({ exercised: true, present: true, conformant: false }),
      alloy: alloyPresenceDisposition({ exercised: false }),
      rum: rumSentDisposition({ owns: false }),
    };
    expect(buildSmokeVerdict({ mode: "local", checks }).pass).toBe(false);
  });

  it("alloy fired (presence-only) + RUM sent (shape-only) both PASS without the card ever claiming acceptance", () => {
    const checks = {
      boot_health: bootHealthDisposition(null),
      ga4: ga4Disposition({ exercised: true, present: true, conformant: true }),
      alloy: alloyPresenceDisposition({ exercised: true, locallyExercisable: true, fired: true }),
      rum: rumSentDisposition({ owns: true, captured: true, hasExpectedFields: true }),
    };
    const v = buildSmokeVerdict({ mode: "live", checks });
    expect(v.pass).toBe(true);
    const serialized = JSON.stringify(v).toLowerCase();
    expect(serialized).not.toContain("accepted");
  });

  it("a RUM boot failure (rum_boot_health, when present) fails the verdict independent of the other checks", () => {
    const checks = {
      boot_health: bootHealthDisposition(null),
      rum_boot_health: bootHealthDisposition("rum boot exploded"),
      ga4: ga4Disposition({ exercised: true, present: true, conformant: true }),
      alloy: alloyPresenceDisposition({ exercised: false }),
      rum: rumSentDisposition({ owns: true, captured: false }),
    };
    expect(buildSmokeVerdict({ mode: "local", checks }).pass).toBe(false);
  });
});
