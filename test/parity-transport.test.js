// Spec 038-03 — the credential/cookie TRANSPORT-parity ledger (feeds ADR-0018 E10, ADR-0020
// commitments 1 + 3). NOT a diffParity extension: rig/parity/transport-report.js is a REPORT
// GENERATOR over each descriptor's declarative `transport` field, never a diff against a fixture
// (the cross-site cookie is opaque to page JS, absent from the beacon URL — see the module's own
// header). Covers AC1 (the per-vendor transport declaration), AC2/AC3 (per-cohort gap
// classification with two DISTINCT owners — including the frame-critique's keystone correction
// that the BLOCKED cohort still carries a first-party-identity gap for Meta), and AC4 (the
// ledger + Markdown table is the E10 input).
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { metaParityDescriptor } from "../rig/parity/descriptors/meta.js";
import { ga4ParityDescriptor } from "../rig/parity/descriptors/ga4.js";
import { buildTransportLedger, renderTransportMarkdown } from "../rig/parity/transport-report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(HERE, "../rig/parity/run-transport.mjs");

const OWNER_E10 = "E10";
const OWNER_COOKIE_CAP = "chamber cookie-capability follow-up"; // metaParityDescriptor's own gapMap owner string

function findVendor(ledger, vendor) {
  return ledger.vendors.find((v) => v.vendor === vendor);
}

function findGap(cell, name) {
  return cell.gaps.find((g) => g.name === name);
}

describe("AC1 — per-vendor transport declaration", () => {
  it("Meta declares fr as a cross-site cookie owned by E10, and _fbp/fbc as first-party identity", () => {
    expect(metaParityDescriptor.transport.crossSiteCookies).toEqual([{ cookie: "fr", owner: "E10" }]);
    expect(metaParityDescriptor.transport.firstPartyIdentity).toEqual(["_fbp", "fbc"]);
  });

  it("GA4 declares NO cross-site cookie and cid as its only first-party identity field", () => {
    expect(ga4ParityDescriptor.transport.crossSiteCookies).toEqual([]);
    expect(ga4ParityDescriptor.transport.firstPartyIdentity).toEqual(["cid"]);
  });
});

describe("AC2/AC3 — Meta per-cohort gap classification, two DISTINCT owners", () => {
  const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor] });
  const meta = findVendor(ledger, "meta");

  it("the cross-site cookie (fr) is a gap on the ALLOWED cohort only, owner E10", () => {
    const allowedFr = findGap(meta.cohorts.allowed, "fr");
    expect(allowedFr).toMatchObject({ class: "cross-site-cookie", name: "fr", owner: OWNER_E10 });
  });

  it("the cross-site cookie (fr) is ABSENT on the BLOCKED cohort — the browser drops it there too, so it is not a divergence", () => {
    expect(findGap(meta.cohorts.blocked, "fr")).toBeUndefined();
  });

  it("first-party identity (_fbp/fbc) is a gap on the ALLOWED cohort, owner cookie-capability", () => {
    for (const name of ["_fbp", "fbc"]) {
      const gap = findGap(meta.cohorts.allowed, name);
      expect(gap).toMatchObject({ class: "first-party-identity", name, owner: OWNER_COOKIE_CAP });
    }
  });

  it("KEYSTONE (frame-critique's correction): first-party identity (_fbp/fbc) is STILL a gap on the BLOCKED cohort — never false-greened as 'no gap'", () => {
    expect(meta.cohorts.blocked.gapFree).toBe(false);
    for (const name of ["_fbp", "fbc"]) {
      const gap = findGap(meta.cohorts.blocked, name);
      expect(gap).toMatchObject({ class: "first-party-identity", name, owner: OWNER_COOKIE_CAP });
    }
  });

  it("the blocked-cohort cell is a GAP overall, not green — the allowed cohort carries the strictly larger gap set (fr + both first-party fields)", () => {
    expect(meta.cohorts.allowed.gapFree).toBe(false);
    expect(meta.cohorts.allowed.gaps.length).toBe(3); // fr + _fbp + fbc
    expect(meta.cohorts.blocked.gaps.length).toBe(2); // _fbp + fbc only
  });

  it("the two gap classes carry visibly DISTINCT owners on the allowed cohort — E10 is never conflated with cookie-capability", () => {
    const owners = new Set(meta.cohorts.allowed.gaps.map((g) => g.owner));
    expect(owners.has(OWNER_E10)).toBe(true);
    expect(owners.has(OWNER_COOKIE_CAP)).toBe(true);
    expect(owners.size).toBe(2);
  });
});

describe("AC2 — GA4 is gap-free on BOTH cohorts (cid emitted from _ga, no cross-site cookie)", () => {
  const ledger = buildTransportLedger({ descriptors: [ga4ParityDescriptor] });
  const ga4 = findVendor(ledger, "ga4");

  it("no gaps on either cohort", () => {
    expect(ga4.cohorts.allowed.gaps).toEqual([]);
    expect(ga4.cohorts.blocked.gaps).toEqual([]);
  });

  it("gapFree is true on both cohorts", () => {
    expect(ga4.cohorts.allowed.gapFree).toBe(true);
    expect(ga4.cohorts.blocked.gapFree).toBe(true);
  });
});

describe("the owner is READ from the descriptor's gapMap, never hardcoded", () => {
  it("mutating a descriptor's gapMap owner for _fbp changes the ledger's reported owner on BOTH cohorts", () => {
    const mutated = { ...metaParityDescriptor, gapMap: { ...metaParityDescriptor.gapMap, _fbp: { owner: "a-different-owner" } } };
    const ledger = buildTransportLedger({ descriptors: [mutated] });
    const meta = findVendor(ledger, "meta");
    expect(findGap(meta.cohorts.allowed, "_fbp").owner).toBe("a-different-owner");
    expect(findGap(meta.cohorts.blocked, "_fbp").owner).toBe("a-different-owner");
    // the sibling field is unaffected — only the mutated entry moved
    expect(findGap(meta.cohorts.allowed, "fbc").owner).toBe(OWNER_COOKIE_CAP);
  });

  it("removing a first-party field from the gapMap (the owner LANDED it) clears its gap from BOTH cohorts", () => {
    const { _fbp: _removed, ...rest } = metaParityDescriptor.gapMap;
    const mutated = { ...metaParityDescriptor, gapMap: rest };
    const ledger = buildTransportLedger({ descriptors: [mutated] });
    const meta = findVendor(ledger, "meta");
    expect(findGap(meta.cohorts.allowed, "_fbp")).toBeUndefined();
    expect(findGap(meta.cohorts.blocked, "_fbp")).toBeUndefined();
    // fbc is still gap-map-owned and unaffected
    expect(findGap(meta.cohorts.allowed, "fbc")).toBeTruthy();
  });
});

describe("AC4 — the ledger is the E10 input: consequence text, provenance, and a fail-loud contract", () => {
  it("every gap carries a non-empty owner + cookieless-egress consequence string", () => {
    const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor, ga4ParityDescriptor] });
    for (const vendor of ledger.vendors) {
      for (const cell of Object.values(vendor.cohorts)) {
        for (const gap of cell.gaps) {
          expect(typeof gap.owner).toBe("string");
          expect(gap.owner.length).toBeGreaterThan(0);
          expect(typeof gap.consequence).toBe("string");
          expect(gap.consequence.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("the ledger carries a question and a note for provenance (mirrors report.js's shape)", () => {
    const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor, ga4ParityDescriptor] });
    expect(typeof ledger.question).toBe("string");
    expect(typeof ledger.note).toBe("string");
    expect(ledger.vendors.map((v) => v.vendor)).toEqual(["meta", "ga4"]);
  });

  it("a descriptor with no `transport` declaration throws, rather than silently reporting a gap-free false-green", () => {
    const noTransport = { ...metaParityDescriptor, transport: undefined };
    expect(() => buildTransportLedger({ descriptors: [noTransport] })).toThrow(/transport/i);
  });

  it("a `transport.firstPartyIdentity` field NOT also in `attributionFields` throws — the completeness guard against a first-party field invisible to both diffParity and the gap-map inference", () => {
    // `_orphan` is a first-party identity the descriptor never lists as an attribution field. With
    // the guard REMOVED, buildVendorRow would find it absent from the gapMap, `continue`, and report
    // gap-free — yet diffParity (which iterates attributionFields alone) never gates its drop either,
    // so a real drop would false-green on every cohort. The guard must refuse. (Removing the guard at
    // transport-report.js makes this assertion fail — the DoD's "shown to fail when the feature is
    // removed"; the sibling missing-`transport` throw above cannot catch this case.)
    const orphanFirstParty = {
      ...metaParityDescriptor,
      attributionFields: ["id", "ev"], // deliberately WITHOUT `_orphan`
      transport: { crossSiteCookies: [], firstPartyIdentity: ["_orphan"] },
    };
    expect(() => buildTransportLedger({ descriptors: [orphanFirstParty] })).toThrow(/not in attributionFields/i);
  });
});

describe("AC4 — the Markdown table (an E10 author reads)", () => {
  it("names both vendors, the owned gap classes, both owners, and the GA4/Meta contrast", () => {
    const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor, ga4ParityDescriptor] });
    const md = renderTransportMarkdown(ledger);
    expect(md).toContain("meta");
    expect(md).toContain("ga4");
    expect(md).toContain("fr");
    expect(md).toContain("_fbp");
    expect(md).toContain("fbc");
    expect(md).toContain("cross-site-cookie");
    expect(md).toContain("first-party-identity");
    expect(md).toContain(OWNER_E10);
    expect(md).toContain(OWNER_COOKIE_CAP);
    expect(md).toMatch(/gap-free/i); // GA4's contrast row
    expect(md).toContain("|"); // an actual table, not prose
  });

  it("is a real Markdown table — a header separator row is present", () => {
    const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor, ga4ParityDescriptor] });
    const md = renderTransportMarkdown(ledger);
    expect(md).toMatch(/\|\s*-{3,}\s*\|/);
  });
});

describe("no live identifiers — cookie NAMES / presence only, never values (R5)", () => {
  it("every declared transport name is a short, literal cookie/field name — not a value shape", () => {
    for (const descriptor of [metaParityDescriptor, ga4ParityDescriptor]) {
      for (const { cookie } of descriptor.transport.crossSiteCookies) {
        expect(typeof cookie).toBe("string");
        expect(cookie.length).toBeLessThan(10);
      }
      for (const field of descriptor.transport.firstPartyIdentity) {
        expect(typeof field).toBe("string");
        expect(field.length).toBeLessThan(10);
      }
    }
  });
});

describe("npm run parity:transport — the CLI entrypoint (deliverable 3)", () => {
  it("prints the JSON ledger + a Markdown table naming both vendors, and exits 0 (a report, not a gate)", () => {
    const out = execFileSync("node", [CLI_PATH], { encoding: "utf8" });
    expect(out).toContain('"vendor": "meta"');
    expect(out).toContain('"vendor": "ga4"');
    expect(out).toContain("| Vendor | Cohort |");
    expect(out).toMatch(/gap-free/i);
  });
});
