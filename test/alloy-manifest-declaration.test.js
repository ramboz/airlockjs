// Alloy manifest declaration-shape + declared-not-enforced sentinel — spec 012-04.
//
// This slice is the forward-compat scaffolding half of MVP2: the alloy connector
// DECLARES its full I/O surface (reads / capabilities / endpoints / purposes) so
// MVP3's ADR-0006/0007 enforcement is a switch-flip, not a breaking retrofit. The
// declaration is DECLARED, NOT ENFORCED (mvp2.md): no egress gate exists in core/
// yet (the seal is unbuilt).
//
//   AC1 — the manifest populates `endpoints` (advisory, ADR-0006) + `purposes`
//         (the ADR-0007 per-declared-I/O consent-purpose annotation).
//   AC2 — a boundary SENTINEL: an alloy `interact` egresses WHETHER OR NOT its
//         host matches a declared endpoint (manifest.endpoints is advisory).
//
// Alloy is faked here exactly as every other alloy unit test fakes it (the real
// stock bundle needs a browser — that is the rig's job); these pin the
// declaration SHAPE and the absence-of-gating boundary against that fake.
import { describe, it, expect, vi } from "vitest";
import { createAlloyConnector } from "../connectors/alloy/connector.js";
import { applyEgressConfinement } from "../core/egress-confinement.js";

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

const pageView = (overrides = {}) => ({
  seq: 1,
  type: "page_view",
  ts: 10,
  params: { page_location: "https://airlock.example/", page_title: "airlock" },
  payload: {},
  snapshot: {},
  ...overrides,
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
// AC2 — the declared-NOT-enforced boundary SENTINEL.
//
// The manifest does NOT gate egress in MVP2: no egress gate exists in core/ at
// all (the seal is unbuilt — spec Assumptions). The sentinel shows an `interact`
// egresses whether or not it matches a declared endpoint — proving
// manifest.endpoints is ADVISORY (ADR-0006), not a ceiling.
//
// FRAMING: this sentinel asserts an ABSENCE of gating, so it does NOT map to the
// "fail on feature-removal" rule. It fails the moment MVP3 enforcement is *added*
// (an endpoint ceiling that blocks the undeclared host makes the "undeclared still
// egresses" assertion go red). The companion test below exercises exactly that red
// condition against a HYPOTHETICAL ceiling, proving the sentinel is non-vacuous.
//
// HONEST LIMIT: this sentinel cannot distinguish "the manifest is deliberately
// non-enforcing" from "the seal is simply unbuilt" — both hold in MVP2. It guards
// the declared-not-enforced boundary until MVP3, no finer.
// ---------------------------------------------------------------------------

/**
 * A fake alloy that models alloy's real egress: on `sendEvent` it issues its own
 * worker-side `fetch` to the interact endpoint (the egress the chamber intercepts,
 * R-004). The interact host is a parameter so the sentinel can target a DECLARED
 * vs an UNDECLARED endpoint. `configure` is a no-op.
 */
function fakeAlloyEgressingTo(interactUrl, mediatedFetch) {
  return vi.fn(async (command) => {
    if (command === "sendEvent") {
      await mediatedFetch(interactUrl, {
        method: "POST",
        body: JSON.stringify({
          events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }],
          query: { identity: { fetch: ["ECID", "CORE"] } },
        }),
      });
      return {};
    }
    return undefined;
  });
}

/**
 * The chamber's SOLE network surface in MVP2: the mediated `fetch` preserved by
 * egress confinement (spec 012-01 AC5). It is host-AGNOSTIC — it withholds other
 * network primitives, not particular hosts. Records every URL it dispatches.
 */
function confinedMediatedFetch() {
  const egressed = [];
  const scope = {
    fetch: (url) => {
      egressed.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    },
    navigator: {},
  };
  const record = applyEgressConfinement(scope);
  return { fetch: scope.fetch, egressed, record };
}

describe("alloy declared-NOT-enforced boundary sentinel (spec 012-04 AC2)", () => {
  it("SENTINEL: an alloy `interact` egresses WHETHER OR NOT its host is a declared endpoint (manifest.endpoints is advisory)", async () => {
    const { manifest } = createAlloyConnector(baseConfig());
    const declared = manifest.endpoints[0]; // the demdex interact host, declared
    const undeclared = "https://sink.not-declared.example/ee/v1/interact";
    expect(manifest.endpoints).toContain(declared);
    expect(manifest.endpoints).not.toContain(undeclared);

    const { fetch: mediatedFetch, egressed, record } = confinedMediatedFetch();
    // Confinement leaves the mediated fetch as the sole surviving network surface...
    expect(record.fetchPreserved).toBe(true);

    // ...and drive the real connector to an interact at the DECLARED host, then at
    // an UNDECLARED host. Nothing consults manifest.endpoints on the way out.
    for (const url of [declared, undeclared]) {
      const connector = createAlloyConnector({ ...baseConfig(), alloy: fakeAlloyEgressingTo(url, mediatedFetch) });
      await connector.init({});
      await connector.handle(pageView());
    }

    // The load-bearing assertion: the UNDECLARED host egressed unblocked. No
    // manifest-endpoint gate exists in MVP2. This is an ABSENCE of gating — it
    // goes RED the moment MVP3 adds an endpoint ceiling that holds the undeclared
    // host at the seal.
    expect(egressed).toContain(declared);
    expect(egressed).toContain(undeclared);
  });

  it("SENTINEL is non-vacuous: a HYPOTHETICAL MVP3 endpoint ceiling BLOCKS the undeclared host — the red condition the sentinel guards", async () => {
    const { manifest } = createAlloyConnector(baseConfig());
    const undeclared = "https://sink.not-declared.example/ee/v1/interact";
    const raw = confinedMediatedFetch();

    // Model MVP3's endpoint ceiling: wrap the mediated fetch to enforce
    // manifest.endpoints (declared∩ host — ADR-0006 flip advisory→authoritative).
    const originOf = (u) => { try { return new URL(u).origin; } catch (e) { return u; } };
    const declaredOrigins = new Set(manifest.endpoints.map(originOf));
    const ceilingFetch = (url, opts) => {
      if (!declaredOrigins.has(originOf(url))) {
        throw new Error("held at the seal: undeclared endpoint (MVP3 endpoint ceiling)");
      }
      return raw.fetch(url, opts);
    };

    const connector = createAlloyConnector({ ...baseConfig(), alloy: fakeAlloyEgressingTo(undeclared, ceilingFetch) });
    await connector.init({});

    // Under the hypothetical ceiling the undeclared interact is HELD — so the
    // sentinel above (which asserts it egresses) necessarily fails once MVP3
    // enforcement lands. Proves the sentinel is a real boundary guard, not a
    // tautology.
    await expect(connector.handle(pageView())).rejects.toThrow(/held at the seal/i);
    expect(raw.egressed).not.toContain(undeclared);
  });
});
