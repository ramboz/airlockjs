// Alloy manifest declaration-shape + endpoint-ceiling boundary sentinel — spec 012-04, FLIPPED by 016-02.
//
// This slice is the forward-compat scaffolding half of MVP2: the alloy connector
// DECLARES its full I/O surface (reads / capabilities / endpoints / purposes) so
// MVP3's ADR-0006/0007 enforcement is a switch-flip, not a breaking retrofit.
// MVP2 (012-04) declared this WITHOUT enforcing it (no egress gate existed in
// core/ yet — the seal was unbuilt). MVP3 (spec 016-02) FLIPS that: the reused
// 016-01 control (`core/endpoint-ceiling.js`'s `checkEndpointCeiling`) is now
// wired into the wrapped-SDK dispatch seam (`core/wrapped-sdk-host.js`'s
// `dispatchInterceptedFetch` — see test/wrapped-sdk-host.test.js's composed-seam
// describe block for the full E2E proof AT that seam) and enforces
// `manifest.endpoints` as a CEILING, not advisory.
//
//   AC1 — the manifest populates `endpoints` (ADR-0006) + `purposes` (the
//         ADR-0007 per-declared-I/O consent-purpose annotation).
//   AC2 — a boundary SENTINEL, FLIPPED (016-02 AC3): an alloy `interact` to a
//         DECLARED origin+path is ALLOWED by the reused control; to an
//         UNDECLARED origin+path it is HELD. manifest.endpoints is now an
//         enforced ceiling, not advisory.
//
// Alloy is faked here exactly as every other alloy unit test fakes it (the real
// stock bundle needs a browser — that is the rig's job); this pins the
// declaration SHAPE and the (now-enforced) boundary against that fake.
import { describe, it, expect, vi } from "vitest";
import { createAlloyConnector } from "../connectors/alloy/connector.js";
import { checkEndpointCeiling } from "../core/endpoint-ceiling.js";

/** ADR-0007's starter taxonomy — the Consent Mode v2 four + functional/personalization. */
const ADR_0007_TAXONOMY = new Set([
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "functional",
  "personalization",
]);

const baseConfig = () => ({
  datastreamId: "00000000-0000-0000-0000-000000000000",
  orgId: "SPIKE@AdobeOrg",
  alloy: vi.fn(() => Promise.resolve()),
});

describe("alloy manifest declaration-shape (spec 012-04 AC1)", () => {
  it("declares `endpoints` — the Adobe interact host it knows of (advisory; ADR-0006 — host allow-list wins)", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    expect(Array.isArray(manifest.endpoints)).toBe(true);
    expect(manifest.endpoints.length).toBeGreaterThan(0);
    // The one host R-004 / the 012-01 chamber observed: the Edge interact host.
    expect(manifest.endpoints.some((e) => e.includes("adobedc.demdex.net"))).toBe(true);
    expect(manifest.endpoints.some((e) => e.includes("/ee/v1/interact"))).toBe(true);
  });

  it("declares `purposes` (ADR-0007) — a per-declared-I/O consent-purpose annotation", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    expect(manifest.purposes).toBeTruthy();
    // Overall egress serves analytics + personalization (Adobe Analytics + Target).
    expect(manifest.purposes.egress).toContain("analytics_storage");
    expect(manifest.purposes.egress).toContain("personalization");
    // The declared interact endpoint is tagged with the purpose(s) it serves...
    const declaredEndpoint = manifest.endpoints[0];
    expect(Array.isArray(manifest.purposes.endpoints[declaredEndpoint])).toBe(true);
    expect(manifest.purposes.endpoints[declaredEndpoint].length).toBeGreaterThan(0);
    // ...and the identity/first-party cookies are tagged per-declared-I/O (ADR-0007:
    // denial is per declared I/O, not per connector).
    expect(manifest.purposes.cookies).toBeTruthy();
    expect(Object.keys(manifest.purposes.cookies).length).toBeGreaterThan(0);
  });

  it("every declared purpose is drawn from ADR-0007's taxonomy (no invented purposes)", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    const p = manifest.purposes;
    const all = [
      ...(p.egress || []),
      ...Object.values(p.endpoints || {}).flat(),
      ...Object.values(p.cookies || {}).flat(),
      ...Object.values(p.reads || {}).flat(),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const purpose of all) {
      expect(ADR_0007_TAXONOMY.has(purpose)).toBe(true);
    }
  });

  it("keeps the pre-012-04 manifest fields intact (additive-only — no regression to name/events/reads/capabilities)", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    expect(manifest.name).toBe("airlock/alloy");
    expect(manifest.events).toContain("page_view");
    expect(Array.isArray(manifest.reads)).toBe(true);
    expect(Array.isArray(manifest.capabilities.cookies)).toBe(true);
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.decisions).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2 — the endpoint-ceiling boundary SENTINEL (FLIPPED, spec 016-02 AC3).
//
// MVP2 (012-04) this sentinel asserted an ABSENCE of gating: an `interact`
// egressed whether or not it matched a declared endpoint, proving
// manifest.endpoints was advisory. Enforcement now EXISTS (spec 016):
// core/endpoint-ceiling.js's `checkEndpointCeiling` (016-01) is wired into the
// wrapped-SDK dispatch seam (core/wrapped-sdk-host.js's
// `dispatchInterceptedFetch`, 016-02), reconciled with 015's config-integrity —
// see test/wrapped-sdk-host.test.js's composed-seam describe block for the full
// E2E proof AT that seam. This sentinel now asserts the PRESENCE of the gate
// directly against the real manifest + the real reused control: a declared
// origin+path verdicts "allow"; an undeclared one verdicts "hold".
//
// HONEST LIMIT (unchanged framing from 012-04): this sentinel pins the
// manifest's declared set against the control's verdict; that the seam actually
// CALLS this control on every egress, before any real dispatch, is proven in
// test/wrapped-sdk-host.js, not here.
// ---------------------------------------------------------------------------
describe("alloy endpoint-ceiling boundary sentinel (spec 012-04 AC2, flipped by 016-02 AC3)", () => {
  it("SENTINEL: an interact to the DECLARED endpoint is ALLOWED; to an UNDECLARED origin+path it is HELD (checkEndpointCeiling now enforces manifest.endpoints, spec 016)", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    const declared = manifest.endpoints[0]; // the demdex interact host, declared
    const undeclared = "https://sink.not-declared.example/ee/v1/interact";
    expect(manifest.endpoints).toContain(declared);
    expect(manifest.endpoints).not.toContain(undeclared);

    // The load-bearing assertion: enforcement now EXISTS — the inverse of the
    // 012-04 "egresses either way" assertion. The declared origin+path is
    // allowed; the undeclared one is held at the seal.
    expect(checkEndpointCeiling(declared, manifest.endpoints)).toMatchObject({ verdict: "allow" });
    expect(checkEndpointCeiling(undeclared, manifest.endpoints)).toMatchObject({ verdict: "hold" });
  });
});
