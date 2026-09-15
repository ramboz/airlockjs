// Manifest-vocabulary SINGLE SOURCE OF TRUTH guard (refinement-todo § manifest-const mirror-drift).
// The adapter (adapters/eds/index.js) used to hand-mirror each connector's `manifest.events` /
// `manifest.purposes.egress` in local `*_MANIFEST_EVENTS` / `*_EGRESS_PURPOSES` consts kept in sync by
// COMMENT only — a documented-but-unenforced mirror that silently drifted on a manifest change. The
// structural fix exports each connector's vocabulary from its OWN module and has BOTH the manifest AND
// the adapter consume the SAME frozen reference, so drift is structurally impossible.
//
// This test LOCKS that in: it asserts each connector's built `manifest.events` /
// `manifest.purposes.egress` IS (reference identity, `toBe`) the exported const — so a future edit that
// re-inlines a literal in the manifest (re-opening the drift) fails HERE, loudly. It also pins the
// values (a manifest change is now a deliberate, test-visible edit of the one home).
import { describe, it, expect } from "vitest";
import { createGa4Connector, GA4_EVENTS, GA4_EGRESS_PURPOSES } from "../connectors/ga4/connector.js";
import { createGa4GtagConnector, GA4_GTAG_EVENTS, GA4_GTAG_EGRESS_PURPOSES } from "../connectors/ga4/gtag.js";
import { createGoogleAdsConnector, GOOGLE_ADS_EVENTS, GOOGLE_ADS_EGRESS_PURPOSES } from "../connectors/google-ads/connector.js";
import { createFloodlightConnector, FLOODLIGHT_EVENTS, FLOODLIGHT_EGRESS_PURPOSES } from "../connectors/floodlight/connector.js";
import { createAlloyConnector, ALLOY_EVENTS, ALLOY_EGRESS_PURPOSES } from "../connectors/alloy/connector.js";
import { createHelixRumConnector, HELIX_RUM_EVENTS } from "../connectors/helix-rum/connector.js";

// Each connector's factory + its exported vocab consts. `egress: null` = no exported egress const
// (helix-rum's manifest egress is `[]` inline, and the adapter never mirrors a helix egress purpose).
const CONNECTORS = [
  { name: "ga4", make: () => createGa4Connector(), events: GA4_EVENTS, egress: GA4_EGRESS_PURPOSES, eventsValue: ["*"], egressValue: ["analytics_storage"] },
  { name: "ga4-gtag", make: () => createGa4GtagConnector(), events: GA4_GTAG_EVENTS, egress: GA4_GTAG_EGRESS_PURPOSES, eventsValue: ["*"], egressValue: ["analytics_storage"] },
  { name: "google-ads", make: () => createGoogleAdsConnector(), events: GOOGLE_ADS_EVENTS, egress: GOOGLE_ADS_EGRESS_PURPOSES, eventsValue: ["page_view"], egressValue: ["ad_storage"] },
  { name: "floodlight", make: () => createFloodlightConnector(), events: FLOODLIGHT_EVENTS, egress: FLOODLIGHT_EGRESS_PURPOSES, eventsValue: ["page_view"], egressValue: ["ad_storage"] },
  { name: "alloy", make: () => createAlloyConnector(), events: ALLOY_EVENTS, egress: ALLOY_EGRESS_PURPOSES, eventsValue: ["page_view"], egressValue: ["analytics_storage", "personalization"] },
  { name: "helix-rum", make: () => createHelixRumConnector(), events: HELIX_RUM_EVENTS, egress: null, eventsValue: ["top", "error", "cwv"], egressValue: null },
];

describe("manifest-vocabulary SOT — each connector's manifest IS its exported vocab const (no mirror)", () => {
  for (const c of CONNECTORS) {
    describe(c.name, () => {
      it("manifest.events IS the exported *_EVENTS const (reference identity — a re-inlined literal fails here)", () => {
        const { manifest } = c.make();
        expect(manifest.events).toBe(c.events); // SAME reference, not merely equal
        expect(c.events).toEqual(c.eventsValue); // and the value is pinned (change = deliberate edit of the one home)
      });

      if (c.egress) {
        it("manifest.purposes.egress IS the exported *_EGRESS_PURPOSES const (reference identity)", () => {
          const { manifest } = c.make();
          expect(manifest.purposes.egress).toBe(c.egress); // SAME reference
          expect(c.egress).toEqual(c.egressValue);
        });
      }

      it("the exported vocab is FROZEN (the shared reference cannot be mutated by either consumer)", () => {
        expect(Object.isFrozen(c.events)).toBe(true);
        if (c.egress) expect(Object.isFrozen(c.egress)).toBe(true);
      });
    });
  }
});
