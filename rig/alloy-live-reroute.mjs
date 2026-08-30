// Spec 013-03 AC1 — same-host tenant re-routing, LIVE (real second datastream).
//
// Fires a minimal `interact` to the REAL Edge with (a) the honest datastream, (b) the
// "attacker" second datastream, (c) a garbage configId — all on the SAME host — and reports
// Edge's status for each. This demonstrates end-to-end + live that Edge routes by `configId`
// (tenant) on a shared host, so the host/endpoint allow-list is BLIND to a re-point (the
// 013-03 threat). It also runs the seam-side config-integrity check on the re-pointed URL to
// show the mitigation HOLDS what Edge would otherwise accept.
//
// No identifiers committed: the datastreams stay in env; this rig writes NO fixture and prints
// only HTTP statuses + hosts. Usage:
//   ALLOY_DATASTREAM_ID=… ALLOY_ATTACKER_DATASTREAM_ID=… node rig/alloy-live-reroute.mjs
//
// The control now lives in core/config-integrity.js (spec 015-01, ADR-0011 — relocated +
// generalized from the rig-only prototype this rig used to import).
import { checkConfigIntegrity } from "../core/config-integrity.js";

const EDGE = "https://adobedc.demdex.net/ee/v1/interact";
const HONEST = process.env.ALLOY_DATASTREAM_ID;
const ATTACKER = process.env.ALLOY_ATTACKER_DATASTREAM_ID;
const GARBAGE = "00000000-0000-0000-0000-000000000000";
if (!HONEST || !ATTACKER) {
  console.error("FAIL — set ALLOY_DATASTREAM_ID + ALLOY_ATTACKER_DATASTREAM_ID (source .env, gitignored).");
  process.exit(2);
}
const PIN = { pinnedHost: new URL(EDGE).host, tenantKey: "configId", pinnedTenant: HONEST };

const body = JSON.stringify({
  events: [{ xdm: {
    eventType: "web.webpagedetails.pageViews",
    timestamp: new Date().toISOString(),
    web: { webPageDetails: { URL: "https://airlock.example/", name: "airlock" } },
  } }],
});

async function fire(label, configId) {
  const url = `${EDGE}?configId=${configId}&requestId=reroute-probe`;
  let host = null; try { host = new URL(url).host; } catch {}
  let status = 0, accepted = false;
  try { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body }); status = r.status; accepted = r.ok; }
  catch (e) { status = -1; }
  return { label, host, status, accepted };
}

const honest = await fire("honest", HONEST);
const attacker = await fire("attacker", ATTACKER);
const garbage = await fire("garbage", GARBAGE);

// the seam-side check on the re-pointed (attacker) URL, pinned to the honest host + datastream
const seam = checkConfigIntegrity(`${EDGE}?configId=${ATTACKER}&requestId=x`, PIN);

const sameHost = honest.host === attacker.host && attacker.host === garbage.host;
const edgeRoutesByTenant = attacker.accepted && sameHost;   // attacker datastream accepted on the SAME host
const edgeValidatesConfigId = !garbage.accepted;            // garbage rejected => Edge does check configId

const out = {
  question: "Does real Edge accept a RE-POINTED configId (a different valid datastream) on the SAME host — so the host allow-list is blind — while the seam-side check catches it?",
  honest, attacker, garbage,
  same_host: sameHost,
  edge_routes_by_tenant_on_shared_host: edgeRoutesByTenant,
  edge_validates_configId: edgeValidatesConfigId,
  seam_side_check_holds_the_reroute: seam.verdict === "hold",
  verdict: edgeRoutesByTenant
    ? `AC1 CONFIRMED — real Edge accepted the re-pointed attacker datastream (HTTP ${attacker.status}) on the SAME host (${attacker.host}) as the honest datastream (HTTP ${honest.status}); the host allow-list cannot tell them apart. Garbage configId ${garbage.accepted ? "ALSO accepted (Edge is lenient at the interact endpoint — validation is downstream)" : "was rejected (HTTP " + garbage.status + " — Edge validates configId)"}. The seam-side config-integrity check HOLDS the re-route (verdict=${seam.verdict}).`
    : `AC1 INCONCLUSIVE — attacker status ${attacker.status} (accepted=${attacker.accepted}), same_host=${sameHost}; see statuses.`,
};
console.log(JSON.stringify(out, null, 2));
process.exit(edgeRoutesByTenant ? 0 : 1);
