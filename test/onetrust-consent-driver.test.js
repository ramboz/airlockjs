import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { CONSENT_PURPOSES, resolveConsent } from "../core/consent.js";
import {
  CONSENT_MODE_V2_PURPOSES,
  ERP_INTUIT_GROUP_PURPOSE_MAP,
  mapOnetrustConsent,
  readOnetrustActiveGroups,
  resolveOnetrustBootConsent,
  subscribeOnetrustConsentChanges,
} from "../drivers/consent/onetrust.js";

// Spec 047-01 — the OneTrust consent-input driver (the first concrete driver on
// ADR-0007's consent-input seam; source-surface decided by ADR-0026). The driver
// reads OneTrust's OWN resolved-consent surface (`OnetrustActiveGroups`) + a
// host-provided group->purpose map, and PRODUCES a `core/consent.js`-shaped vector
// over the Consent Mode v2 four. It performs NO egress and reads the OneTrust
// surface only through an injected `win` — so the pure mapping is fixture-testable
// without a live OneTrust.
//
// FIXTURES — the §A5 opt-out captures (rig/onetrust-optout-probe.mjs), REDACTED to
// their structural, non-PII group-id strings only:
const ACTIVE_GRANTED = ",1,BG394,4,"; // accept-all (group 4 = the ad+analytics lever)
const ACTIVE_OPTED_OUT = ",1,"; // OneTrust.RejectAll() — only essential group 1 stays

// core/consent.js's four data-use/storage values over the CM v2 four, all granted /
// all denied — for the "matches core exactly" round-trips.
const ALL_FOUR = ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"];

const driverSrc = () =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "drivers", "consent", "onetrust.js"), "utf8");

// ---------------------------------------------------------------------------
// AC2 — maps granted groups -> the purpose vector via a host-provided map.
// ---------------------------------------------------------------------------
describe("AC2 — mapOnetrustConsent: granted groups -> the CM v2 purpose vector via a host map", () => {
  it("the granted (accept-all) capture + the reference map -> all four purposes granted", () => {
    expect(mapOnetrustConsent(ACTIVE_GRANTED, ERP_INTUIT_GROUP_PURPOSE_MAP)).toEqual({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("the opted-out capture (group 4 ABSENT while OneTrust is resolved) + the reference map -> all four DENIED", () => {
    expect(mapOnetrustConsent(ACTIVE_OPTED_OUT, ERP_INTUIT_GROUP_PURPOSE_MAP)).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("purpose names + values match core/consent.js EXACTLY (each key resolvable; values only granted/denied)", () => {
    const vector = mapOnetrustConsent(ACTIVE_GRANTED, ERP_INTUIT_GROUP_PURPOSE_MAP);
    for (const [purpose, value] of Object.entries(vector)) {
      expect(CONSENT_PURPOSES).toContain(purpose); // a real core taxonomy name
      expect(["granted", "denied"]).toContain(value); // core's own vocabulary
      expect(resolveConsent(vector, purpose)).toBe(value); // round-trips through the core resolver
    }
  });

  it("case-normalizes the host map's purpose names to core's lowercase taxonomy", () => {
    const map = { 4: ["AD_STORAGE", "Analytics_Storage"] };
    expect(mapOnetrustConsent(",4,", map)).toEqual({ ad_storage: "granted", analytics_storage: "granted" });
  });

  it("a purpose no mapped group covers is OMITTED (never invented), even when OneTrust is resolved", () => {
    // A partial map covering only ad_storage: the other three purposes are unmapped.
    const vector = mapOnetrustConsent(ACTIVE_OPTED_OUT, { 4: ["ad_storage"] });
    expect(vector).toEqual({ ad_storage: "denied" }); // resolved + group 4 absent -> denied
    expect(vector).not.toHaveProperty("analytics_storage");
    expect(vector).not.toHaveProperty("ad_user_data");
    expect(vector).not.toHaveProperty("ad_personalization");
  });

  it("multi-group coverage is OR: a purpose is granted when ANY covering group is granted", () => {
    const map = { 4: ["ad_storage"], 7: ["ad_storage"] };
    expect(mapOnetrustConsent(",1,7,", map)).toEqual({ ad_storage: "granted" }); // 7 granted, 4 absent
    expect(mapOnetrustConsent(",1,", map)).toEqual({ ad_storage: "denied" }); // neither granted, resolved
  });

  it("restricts output to the Consent Mode v2 four — a mapped out-of-scope purpose is ignored", () => {
    // `functional` is a real core purpose but OUT of this slice's CM-v2-four scope.
    const vector = mapOnetrustConsent(",4,", { 4: ["ad_storage", "functional"] });
    expect(vector).toEqual({ ad_storage: "granted" });
    expect(vector).not.toHaveProperty("functional");
  });
});

// ---------------------------------------------------------------------------
// AC1 — reads OneTrust's resolved-consent surface at boot, via an INJECTED read;
//        never GetDomainData().Status; absent surface -> empty result, no throw.
// ---------------------------------------------------------------------------
describe("AC1 — readOnetrustActiveGroups: the injected read of OneTrust's resolved surface", () => {
  it("reads the granted-group string off the injected host global's OnetrustActiveGroups", () => {
    expect(readOnetrustActiveGroups({ OnetrustActiveGroups: ACTIVE_GRANTED })).toBe(ACTIVE_GRANTED);
  });

  it("OneTrust absent / surface unavailable -> null, never a throw", () => {
    expect(readOnetrustActiveGroups(undefined)).toBeNull();
    expect(readOnetrustActiveGroups(null)).toBeNull();
    expect(readOnetrustActiveGroups({})).toBeNull(); // present global, no OneTrust surface yet
    expect(readOnetrustActiveGroups({ OnetrustActiveGroups: 42 })).toBeNull(); // non-string -> null
  });

  it("resolveOnetrustBootConsent composes the injected read + the map (no live OneTrust needed)", () => {
    const win = { OnetrustActiveGroups: ACTIVE_GRANTED };
    expect(resolveOnetrustBootConsent({ groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, win })).toEqual({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("reads the RESOLVED-consent surface, NOT GetDomainData().Status (the configured default — ADR-0026/§A5)", () => {
    // A win whose GetDomainData().Status says every ad group is active (the configured
    // default that does NOT flip on opt-out) but whose OnetrustActiveGroups is the
    // opted-out set. Reading Status would GRANT an opted-out user; the driver must DENY.
    const win = {
      OnetrustActiveGroups: ACTIVE_OPTED_OUT,
      OneTrust: {
        GetDomainData: () => ({ Groups: [{ OptanonGroupId: "4", Status: "active" }] }),
      },
    };
    expect(resolveOnetrustBootConsent({ groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, win })).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });
});

// ---------------------------------------------------------------------------
// AC4 — fail-to-pending, never fail-to-send: absent/malformed surface, unknown
//        group id, or unmapped purpose -> OMITTED (pending), never silent granted.
// ---------------------------------------------------------------------------
describe("AC4 — fail-to-pending: an absent/malformed/unresolved surface is OMITTED, never granted", () => {
  it.each([
    ["null (OneTrust absent)", null],
    ["undefined (OneTrust absent)", undefined],
    ["empty string (present but not yet resolved — §A4)", ""],
    ["a non-string surface", 1234],
    ["unstructured garbage (no group delimiter)", "garbage"],
    ["only delimiters (no group ids resolved)", ",,,"],
  ])("%s -> an empty vector (every purpose omitted -> pending -> the seal holds)", (_label, surface) => {
    expect(mapOnetrustConsent(surface, ERP_INTUIT_GROUP_PURPOSE_MAP)).toEqual({});
  });

  it("NEVER emits a silent `granted` for any absent/malformed surface", () => {
    for (const surface of [null, undefined, "", "garbage", ",,,", 0, {}]) {
      const vector = mapOnetrustConsent(surface, ERP_INTUIT_GROUP_PURPOSE_MAP);
      expect(Object.values(vector)).not.toContain("granted");
    }
  });

  it("an unknown granted group id (not in the host map) never grants a purpose (resolved -> denied, not granted)", () => {
    // group 99 is granted but unmapped; the mapped lever (group 4) is absent -> denied.
    const vector = mapOnetrustConsent(",1,99,", ERP_INTUIT_GROUP_PURPOSE_MAP);
    expect(Object.values(vector)).not.toContain("granted");
    expect(vector).toEqual({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("an empty / absent host map -> every purpose unmapped -> omitted (never granted), even on a granted surface", () => {
    expect(mapOnetrustConsent(ACTIVE_GRANTED, {})).toEqual({});
    expect(mapOnetrustConsent(ACTIVE_GRANTED, undefined)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// AC5 — the driver is host-neutral + egress-free: no worker, no egress, no
//        GA4/MP/connector imports; the OneTrust reads are dependency-injected.
// ---------------------------------------------------------------------------
describe("AC5 — host-neutral, egress-free, injected reads (structural guards on the driver source)", () => {
  it("CONSENT_MODE_V2_PURPOSES is exactly the CM v2 four and a subset of core's CONSENT_PURPOSES", () => {
    expect([...CONSENT_MODE_V2_PURPOSES].sort()).toEqual([...ALL_FOUR].sort());
    for (const p of CONSENT_MODE_V2_PURPOSES) expect(CONSENT_PURPOSES).toContain(p);
  });

  it("the driver imports NOTHING (a pure leaf — so it cannot import GA4/MP or connector specifics)", () => {
    const src = driverSrc();
    expect(/^\s*import\s/m.test(src)).toBe(false);
    expect(/\bimport\s*\(/.test(src)).toBe(false);
    expect(/\brequire\s*\(/.test(src)).toBe(false);
  });

  it("the driver performs no egress and opens no worker (no fetch / Worker / postMessage)", () => {
    const src = driverSrc();
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(/\bWorker\b/.test(src)).toBe(false);
    expect(/\bpostMessage\b/.test(src)).toBe(false);
  });

  it("the driver reads no AMBIENT DOM/global — the OneTrust surface is injected (no bare window/document)", () => {
    const src = driverSrc();
    expect(/\bwindow\b/.test(src)).toBe(false);
    expect(/\bdocument\b/.test(src)).toBe(false);
    // And the mapping logic is callable with ONLY a string + map (no globals present).
    expect(mapOnetrustConsent(ACTIVE_GRANTED, ERP_INTUIT_GROUP_PURPOSE_MAP)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Spec 047-02 — subscribeOnetrustConsentChanges: the driver's SECOND entry
// point (mid-session consent CHANGE, vs the boot-time read above). Subscribes
// via an INJECTED seam (`onetrust.OnConsentChanged` and/or wrapping the host
// global's `OptanonWrapper`), re-maps through the SAME 047-01 contract on every
// fire, and notifies the caller-supplied `onChange` — which the adapter wires
// to `handle.setConsent` (017-03 AC2). No egress, no new seam: this module
// only calls `onChange`; the flush/hold side effects are the seal's.
// ---------------------------------------------------------------------------

describe("047-02 AC1 — subscribeOnetrustConsentChanges: registers via an injected seam, idempotent + null-safe", () => {
  it("registers through onetrust.OnConsentChanged when present", () => {
    const onetrust = { OnConsentChanged: vi.fn() };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ onetrust, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    expect(onetrust.OnConsentChanged).toHaveBeenCalledTimes(1);
    expect(typeof onetrust.OnConsentChanged.mock.calls[0][0]).toBe("function");
  });

  it("wraps a host global's OptanonWrapper when present as a plain object (installs a callable hook)", () => {
    const win = {};
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    expect(typeof win.OptanonWrapper).toBe("function");
  });

  it("preserves + still calls a PRE-EXISTING OptanonWrapper (never clobbers a host-defined hook)", () => {
    const existing = vi.fn();
    const win = { OptanonWrapper: existing };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    win.OptanonWrapper("some", "args");

    expect(existing).toHaveBeenCalledWith("some", "args");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("no onetrust, no win, no onChange at all -> a complete no-op, never a throw", () => {
    expect(() => subscribeOnetrustConsentChanges()).not.toThrow();
    expect(() => subscribeOnetrustConsentChanges({})).not.toThrow();
    expect(() => subscribeOnetrustConsentChanges({ onetrust: null, win: null })).not.toThrow();
  });

  it("onetrust absent (OneTrust not yet loaded) -> no throw, and the win-side OptanonWrapper wiring still proceeds", () => {
    const win = {};
    const onChange = vi.fn();
    expect(() =>
      subscribeOnetrustConsentChanges({ onetrust: null, win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange }),
    ).not.toThrow();
    expect(typeof win.OptanonWrapper).toBe("function");
  });

  it("onetrust present but OnConsentChanged is not a function -> no throw, no registration attempted", () => {
    const onetrust = {};
    expect(() => subscribeOnetrustConsentChanges({ onetrust, onChange: vi.fn() })).not.toThrow();
  });

  it("no onChange wired -> a complete no-op (does not even register), even with a real onetrust/win", () => {
    const onetrust = { OnConsentChanged: vi.fn() };
    const win = {};
    subscribeOnetrustConsentChanges({ onetrust, win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP });

    expect(onetrust.OnConsentChanged).not.toHaveBeenCalled();
    expect(win.OptanonWrapper).toBeUndefined();
  });

  it("calling twice on the SAME onetrust never double-registers (OnConsentChanged itself is invoked only ONCE)", () => {
    const onetrust = { OnConsentChanged: vi.fn() };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ onetrust, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });
    subscribeOnetrustConsentChanges({ onetrust, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange }); // e.g. a re-boot

    expect(onetrust.OnConsentChanged).toHaveBeenCalledTimes(1);

    // And the ONE registered callback still fires onChange exactly once.
    onetrust.OnConsentChanged.mock.calls[0][0]();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calling twice on the SAME win never double-wraps OptanonWrapper (one fire -> onChange called ONCE)", () => {
    const win = {};
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });
    subscribeOnetrustConsentChanges({ win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    win.OptanonWrapper();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("047-02 AC2 — on a change event, re-maps via mapOnetrustConsent (047-01's contract) and calls onChange", () => {
  it("a fixture OnConsentChanged fire RE-READS the host global's OnetrustActiveGroups NOW (not a memoized boot-time value)", () => {
    let captured;
    const onetrust = {
      OnConsentChanged: (cb) => {
        captured = cb;
      },
    };
    const win = { OnetrustActiveGroups: ACTIVE_OPTED_OUT };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ onetrust, win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    win.OnetrustActiveGroups = ACTIVE_GRANTED; // the banner interaction resolved AFTER subscribe
    captured();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("ignores whatever argument shape the real callback passes — never trusts it, re-reads the host global instead", () => {
    let captured;
    const onetrust = {
      OnConsentChanged: (cb) => {
        captured = cb;
      },
    };
    const win = { OnetrustActiveGroups: ACTIVE_GRANTED };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ onetrust, win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    captured({ some: "unexpected-shape" }, 42, undefined);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ analytics_storage: "granted" }));
  });

  it("an OptanonWrapper fire re-maps identically to an OnConsentChanged fire (same host global, same map, same result)", () => {
    const win = { OnetrustActiveGroups: ACTIVE_GRANTED };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    win.OptanonWrapper();

    expect(onChange).toHaveBeenCalledWith(mapOnetrustConsent(ACTIVE_GRANTED, ERP_INTUIT_GROUP_PURPOSE_MAP));
  });
});

describe("047-02 AC4 — grant->deny->grant churn re-maps + notifies correctly each time, never throws", () => {
  it("three consecutive fires (granted, opted-out, granted again) call onChange 3x with the correct vector each time", () => {
    let captured;
    const onetrust = {
      OnConsentChanged: (cb) => {
        captured = cb;
      },
    };
    const win = { OnetrustActiveGroups: ACTIVE_GRANTED };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ onetrust, win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    expect(() => {
      captured(); // granted
      win.OnetrustActiveGroups = ACTIVE_OPTED_OUT;
      captured(); // denied
      win.OnetrustActiveGroups = ACTIVE_GRANTED;
      captured(); // granted again
    }).not.toThrow();

    const GRANTED_VECTOR = {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    };
    const DENIED_VECTOR = {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    };
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls[0][0]).toEqual(GRANTED_VECTOR);
    expect(onChange.mock.calls[1][0]).toEqual(DENIED_VECTOR);
    expect(onChange.mock.calls[2][0]).toEqual(GRANTED_VECTOR);
  });
});

describe("047-02 AC5 — no new seam, no egress: onChange is the ONLY side effect the subscribe helper triggers", () => {
  it("subscribeOnetrustConsentChanges calls ONLY onChange on a fire — nothing else observable", () => {
    const win = { OnetrustActiveGroups: ACTIVE_GRANTED };
    const onChange = vi.fn();
    subscribeOnetrustConsentChanges({ win, groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, onChange });

    win.OptanonWrapper();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("the driver source (as extended) still imports nothing and performs no egress (whole-file re-check)", () => {
    const src = driverSrc();
    expect(/^\s*import\s/m.test(src)).toBe(false);
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(/\bWorker\b/.test(src)).toBe(false);
    expect(/\bpostMessage\b/.test(src)).toBe(false);
    expect(src).toContain("subscribeOnetrustConsentChanges"); // the new export is actually present
  });
});
