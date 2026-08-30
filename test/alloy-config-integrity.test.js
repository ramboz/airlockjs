// Spec 013-03 — config-integrity / same-host-tenant re-routing (creds-free core).
//
// RELOCATED + GENERALIZED (spec 015-01, ADR-0011): the control this file exercises now lives in
// core/config-integrity.js (relocated from rig/config-integrity.js, since deleted) and is
// vendor-neutral — it verifies the outbound HOST against a pin AND a tenant-routing key whose
// PARAM NAME is INJECTED (`configId` for alloy below; a GA4-shaped `measurement_id` pin is
// exercised too, to prove the control is not alloy-specific). The 013-03 cases below are
// unchanged in intent — same assertions, updated to the new `pin`-object API
// (`{ pinnedHost, tenantKey, pinnedTenant }`) and the renamed `outboundTenants` (was
// `outboundDatastreams`).
//
// AC2 (config-mutability) + AC3 (the seam-side mitigation) demonstrated with a STUB alloy —
// no live traffic, no second tenant, SYNTHETIC datastreams (no live identifiers). AC1 (the
// end-to-end repro that real Edge LANDS data in the attacker tenant on the shared host) is
// creds-gated on a real second datastream and is DEFERRED (rig/alloy-live-reroute.mjs).
//
// The chamber is HOSTILE (013-03 craft review): it controls the whole interact URL, so the
// demonstration includes the evasion vectors a parse-and-compare would miss (parameter
// pollution, an omitted configId) and proves the robust posture — FAIL CLOSED + OVERRIDE.
import { describe, it, expect } from "vitest";
import { checkConfigIntegrity, outboundTenants, pinnedDispatchUrl } from "../core/config-integrity.js";

const HOST = "https://adobedc.demdex.net/ee/v1/interact";
const HONEST_DS = "11111111-1111-1111-1111-111111111111"; // synthetic — not a live datastream
const ATTACKER_DS = "99999999-9999-9999-9999-999999999999"; // synthetic
const PIN = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: HONEST_DS };

// A HOSTILE stub chamber that OWNS the alloy instance: it can re-configure alloy, and — since
// it controls the outbound URL — it can also pollute or omit the configId. No network; we only
// inspect the outbound interact URL the chamber hands to the dispatch seam.
function makeStubAlloyChamber(initialDatastream) {
  let datastream = initialDatastream;
  return {
    configure: (cfg) => { if (cfg && cfg.datastreamId) datastream = cfg.datastreamId; }, // re-config re-points
    craftInteractUrl: () => `${HOST}?configId=${datastream}&requestId=abc`,
    craftPollutedUrl: () => `${HOST}?configId=${HONEST_DS}&configId=${ATTACKER_DS}&requestId=p`, // evasion
    craftAbsentUrl: () => `${HOST}?requestId=none`,                                              // evasion
  };
}

describe("013-03 — config-integrity / same-host-tenant re-routing (creds-free)", () => {
  it("AC2: config is CHAMBER-MUTABLE — a compromised chamber re-points its own datastream", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    expect(outboundTenants(chamber.craftInteractUrl(), "configId")).toEqual([HONEST_DS]); // honest boot
    chamber.configure({ datastreamId: ATTACKER_DS }); // compromised code re-configures alloy
    const repointed = chamber.craftInteractUrl();
    expect(outboundTenants(repointed, "configId")).toEqual([ATTACKER_DS]); // re-pointed to the attacker tenant
    expect(new URL(repointed).host).toBe("adobedc.demdex.net"); // SAME host — allow-list is blind
  });

  it("AC3: the SEAM-SIDE detector HOLDS a re-pointed egress (host-pinned datastream)", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    chamber.configure({ datastreamId: ATTACKER_DS }); // compromised re-point
    const check = checkConfigIntegrity(chamber.craftInteractUrl(), PIN);
    expect(check.verdict).toBe("hold"); // caught at the seam, even though the chamber owns alloy
    expect(check.outboundTenants).toEqual([ATTACKER_DS]);
  });

  it("AC3: honest egress (matching the host-pinned datastream) is ALLOWED", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    expect(checkConfigIntegrity(chamber.craftInteractUrl(), PIN).verdict).toBe("allow");
  });

  it("host-owned-config-at-boot is NECESSARY-BUT-NOT-SUFFICIENT (the seam check is what binds)", () => {
    // Even if the orchestrator sets the datastream at boot, the compromised chamber owns the
    // alloy instance and can craft its own attacker-datastream fetch that BYPASSES the honest
    // configure — so boot-time host-ownership alone does not stop the re-route; only the
    // seam-side check (which every intercepted interact crosses) catches it.
    const bypassUrl = `${HOST}?configId=${ATTACKER_DS}&requestId=xyz`; // never called configure
    expect(new URL(bypassUrl).host).toBe("adobedc.demdex.net");        // host allow-list: passes
    expect(checkConfigIntegrity(bypassUrl, PIN).verdict).toBe("hold"); // seam check: catches it
  });

  it("FAIL CLOSED: parameter pollution (?configId=honest&configId=attacker) is HELD, not slipped past", () => {
    // A naive `.get()` returns the FIRST configId (honest) and would ALLOW — the getAll-based
    // detector sees both and fails closed.
    const chamber = makeStubAlloyChamber(HONEST_DS);
    const check = checkConfigIntegrity(chamber.craftPollutedUrl(), PIN);
    expect(check.verdict).toBe("hold");
    expect(check.outboundTenants.length).toBe(2);
  });

  it("FAIL CLOSED: an omitted configId on an alloy interact is HELD, not allowed", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    expect(checkConfigIntegrity(chamber.craftAbsentUrl(), PIN).verdict).toBe("hold");
  });

  it("OVERRIDE posture: the seam re-derives the dispatch URL with the host+tenant pin (evasion-proof)", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    chamber.configure({ datastreamId: ATTACKER_DS });
    // even a polluted URL is corrected: exactly one configId, the host's — the attacker value gone
    const dispatched = pinnedDispatchUrl(chamber.craftPollutedUrl(), PIN);
    expect(outboundTenants(dispatched, "configId")).toEqual([HONEST_DS]);
    expect(dispatched).not.toContain(ATTACKER_DS);
    expect(new URL(dispatched).host).toBe("adobedc.demdex.net"); // re-derived host too
  });
});

describe("015-01 — config-integrity generalization: host pin + injected tenant key (ADR-0011)", () => {
  it("foreign host held: an honest tenant on a FOREIGN host is still held — the host check is load-bearing", () => {
    const foreignUrl = `https://evil.com/ee/v1/interact?configId=${HONEST_DS}`;
    expect(checkConfigIntegrity(foreignUrl, PIN).verdict).toBe("hold");
  });

  it("the injected tenant key generalizes: a GA4-shaped pin (measurement_id) proves the control is vendor-neutral, not alloy-specific", () => {
    const GA4_PIN = { pinnedHost: "www.google-analytics.com", tenantKey: "measurement_id", pinnedTenant: "G-HONEST" };
    const honestUrl = "https://www.google-analytics.com/g/collect?measurement_id=G-HONEST";
    const attackerUrl = "https://www.google-analytics.com/g/collect?measurement_id=G-ATTACKER";
    const pollutedUrl = "https://www.google-analytics.com/g/collect?measurement_id=G-HONEST&measurement_id=G-ATTACKER";

    expect(checkConfigIntegrity(honestUrl, GA4_PIN).verdict).toBe("allow");
    expect(checkConfigIntegrity(attackerUrl, GA4_PIN).verdict).toBe("hold");
    expect(checkConfigIntegrity(pollutedUrl, GA4_PIN).verdict).toBe("hold");
  });

  it("override re-derives BOTH host and tenant: a foreign-host, attacker-tenant URL is corrected to exactly the pin", () => {
    const evilUrl = `https://evil.com/x?configId=${ATTACKER_DS}`;
    const corrected = pinnedDispatchUrl(evilUrl, PIN);
    expect(new URL(corrected).host).toBe("adobedc.demdex.net");
    expect(outboundTenants(corrected, "configId")).toEqual([HONEST_DS]);
    expect(corrected).not.toContain(ATTACKER_DS);
  });

  it("incomplete pin fails closed: a misconfigured pin (e.g. pinnedTenant missing) holds even an otherwise-honest URL", () => {
    const honestUrl = `${HOST}?configId=${HONEST_DS}&requestId=abc`;
    const incompletePin = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: null };
    expect(checkConfigIntegrity(honestUrl, incompletePin).verdict).toBe("hold");
  });
});
