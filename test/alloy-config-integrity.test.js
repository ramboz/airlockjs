// Spec 013-03 — config-integrity / same-host-tenant re-routing (creds-free core).
//
// AC2 (config-mutability) + AC3 (the seam-side mitigation) demonstrated with a STUB alloy —
// no live traffic, no second tenant, SYNTHETIC datastreams (no live identifiers). AC1 (the
// end-to-end repro that real Edge LANDS data in the attacker tenant on the shared host) is
// creds-gated on a real second datastream and is DEFERRED.
//
// The chamber is HOSTILE (013-03 craft review): it controls the whole interact URL, so the
// demonstration includes the evasion vectors a parse-and-compare would miss (parameter
// pollution, an omitted configId) and proves the robust posture — FAIL CLOSED + OVERRIDE.
import { describe, it, expect } from "vitest";
import { checkConfigIntegrity, outboundDatastreams, pinnedDispatchUrl } from "../rig/config-integrity.js";

const HOST = "https://adobedc.demdex.net/ee/v1/interact";
const HONEST_DS = "11111111-1111-1111-1111-111111111111"; // synthetic — not a live datastream
const ATTACKER_DS = "99999999-9999-9999-9999-999999999999"; // synthetic

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
    expect(outboundDatastreams(chamber.craftInteractUrl())).toEqual([HONEST_DS]); // honest boot
    chamber.configure({ datastreamId: ATTACKER_DS }); // compromised code re-configures alloy
    const repointed = chamber.craftInteractUrl();
    expect(outboundDatastreams(repointed)).toEqual([ATTACKER_DS]); // re-pointed to the attacker tenant
    expect(new URL(repointed).host).toBe("adobedc.demdex.net"); // SAME host — allow-list is blind
  });

  it("AC3: the SEAM-SIDE detector HOLDS a re-pointed egress (host-pinned datastream)", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    chamber.configure({ datastreamId: ATTACKER_DS }); // compromised re-point
    const check = checkConfigIntegrity(chamber.craftInteractUrl(), HONEST_DS);
    expect(check.verdict).toBe("hold"); // caught at the seam, even though the chamber owns alloy
    expect(check.outboundDatastreams).toEqual([ATTACKER_DS]);
  });

  it("AC3: honest egress (matching the host-pinned datastream) is ALLOWED", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    expect(checkConfigIntegrity(chamber.craftInteractUrl(), HONEST_DS).verdict).toBe("allow");
  });

  it("host-owned-config-at-boot is NECESSARY-BUT-NOT-SUFFICIENT (the seam check is what binds)", () => {
    // Even if the orchestrator sets the datastream at boot, the compromised chamber owns the
    // alloy instance and can craft its own attacker-datastream fetch that BYPASSES the honest
    // configure — so boot-time host-ownership alone does not stop the re-route; only the
    // seam-side check (which every intercepted interact crosses) catches it.
    const bypassUrl = `${HOST}?configId=${ATTACKER_DS}&requestId=xyz`; // never called configure
    expect(new URL(bypassUrl).host).toBe("adobedc.demdex.net");        // host allow-list: passes
    expect(checkConfigIntegrity(bypassUrl, HONEST_DS).verdict).toBe("hold"); // seam check: catches it
  });

  it("FAIL CLOSED: parameter pollution (?configId=honest&configId=attacker) is HELD, not slipped past", () => {
    // A naive `.get()` returns the FIRST configId (honest) and would ALLOW — the getAll-based
    // detector sees both and fails closed.
    const chamber = makeStubAlloyChamber(HONEST_DS);
    const check = checkConfigIntegrity(chamber.craftPollutedUrl(), HONEST_DS);
    expect(check.verdict).toBe("hold");
    expect(check.outboundDatastreams.length).toBe(2);
  });

  it("FAIL CLOSED: an omitted configId on an alloy interact is HELD, not allowed", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    expect(checkConfigIntegrity(chamber.craftAbsentUrl(), HONEST_DS).verdict).toBe("hold");
  });

  it("OVERRIDE posture: the seam re-derives the dispatch URL with ONLY the host pin (evasion-proof)", () => {
    const chamber = makeStubAlloyChamber(HONEST_DS);
    chamber.configure({ datastreamId: ATTACKER_DS });
    // even a polluted URL is corrected: exactly one configId, the host's — the attacker value gone
    const dispatched = pinnedDispatchUrl(chamber.craftPollutedUrl(), HONEST_DS);
    expect(outboundDatastreams(dispatched)).toEqual([HONEST_DS]);
    expect(dispatched).not.toContain(ATTACKER_DS);
  });
});
