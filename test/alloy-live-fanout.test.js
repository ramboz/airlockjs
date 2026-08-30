// Spec 013-02 — egress fan-out reference run, replayed creds-free.
//
// The real-DOM main-thread reference run (rig/alloy-live-fanout.mjs) captured the true
// egress ORIGIN set alloy fires against a real Edge — the surface the no-DOM chamber
// would otherwise under-count. This test replays the redacted capture creds-free: it
// pins the enumeration + the three-outcome chamber-disposition classification, and
// guards the AC4 validity floor (a zero-third-party result is a LOWER BOUND, never
// evidence of narrow egress).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(HERE, "fixtures/alloy-live-fanout.redacted.json"), "utf8"));
const VALID_DISPOSITIONS = new Set(["confined", "shim-swallowed", "escaped"]);
const ADOBE_FIRST_PARTY = /(^|\.)(demdex\.net|omtrdc\.net|adobedc\.net|2o7\.net|everesttech\.net|adobe\.com)$/i;

describe("013-02 — egress fan-out (real-DOM reference run, creds-free replay)", () => {
  it("captured a non-empty egress origin set, each origin classified by chamber disposition", () => {
    expect(Array.isArray(fx.origin_set)).toBe(true);
    expect(fx.origin_set.length).toBeGreaterThan(0);
    for (const o of fx.origin_set) {
      expect(typeof o.host).toBe("string");
      expect(o.chamberDisposition.length).toBeGreaterThan(0);
      expect(o.chamberDisposition.every((d) => VALID_DISPOSITIONS.has(d))).toBe(true);
    }
  });

  it("the disposition totals classify every captured egress (no unclassified requests)", () => {
    const totals = fx.chamber_disposition_totals;
    for (const k of Object.keys(totals)) expect(VALID_DISPOSITIONS.has(k)).toBe(true);
    const totalClassified = Object.values(totals).reduce((a, b) => a + b, 0);
    const perOriginCount = fx.origin_set.reduce((a, o) => a + o.count, 0);
    expect(totalClassified).toBe(perOriginCount);
  });

  it("the captured origin roster was stable across the two reference runs", () => {
    expect(fx.roster_stable_across_two_runs).toBe(true);
  });

  it("AC4 validity floor: an all-Adobe-first-party capture is a LOWER BOUND, not narrow egress", () => {
    // The test org fired only Adobe-first-party origins (no AAM third-party
    // destinations). This pins that interpretation: a zero-third-party capture is a
    // test-org-config artifact, and the enforcement design must not read this origin
    // count as ceiling cardinality.
    const thirdParty = fx.origin_set.filter((o) => !ADOBE_FIRST_PARTY.test(o.host));
    const isLowerBound = thirdParty.length === 0;
    expect(isLowerBound).toBe(true); // this capture: no third-party fan-out → lower bound
  });
});
