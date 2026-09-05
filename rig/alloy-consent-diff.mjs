// Alloy coarse-consent-split — DIFFERENTIAL Edge-safe proof — spec 034-01 AC6.
//
// Grounds the load-bearing claim that the TRUSTED seam's analytics-only interact
// (personalization stripped) is EXACTLY what alloy itself emits with
// personalization off — a valid analytics interact, not a malformed body. It is
// creds-free (no live Edge): it drives the REAL, installed @adobe/alloy@2.35.0
// query-build modules to produce a personalization-ON event and alloy's own
// personalization-OFF event, pushes the ON body through the REAL seam
// (core/wrapped-sdk-host.js), and asserts the seam-stripped body DEEP-EQUALS
// alloy's native `defaultPersonalizationEnabled:false` interact.
//
// This lives in the RIG tier (NOT the hermetic vitest suite) on purpose: the
// @adobe/alloy bundle is ADOPTER-SUPPLIED (ADR-0016) and lives ONLY under the
// gitignored, probe-local probes/alloy-worker/node_modules — it is deliberately
// NOT a root dependency, so CI's hermetic `npm test` (root-only `npm ci`) must
// not import it. Mirrors rig:alloy / rig:alloy-decisions, which likewise read
// the probe-local bundle as a file. The HERMETIC shape-only coverage (no real
// bundle) is asserted by the coarse-consent AC1/AC2 tests + the AC5 e2e.
//
// Usage: node rig/alloy-consent-diff.mjs   (exits non-zero if the differential fails)
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { join } from "node:path";
import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE = join(ROOT, "probes/alloy-worker/node_modules/@adobe");
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const XDM = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { URL: "https://airlock.example/", name: "airlock" } } };
const IDENTITY_FETCH = { identity: { fetch: ["ECID"] } }; // request-level ECID mint — identical ON/OFF (shared constant)

function fail(verdict, extra = {}) {
  console.log(JSON.stringify({ pass: false, verdict, ...extra }, null, 2));
  process.exit(1);
}
function pass(extra = {}) {
  console.log(JSON.stringify({ pass: true, ...extra }, null, 2));
  process.exit(0);
}

// --- Load the REAL alloy@2.35.0 query-build modules from the probe-local
//     (gitignored, adopter-supplied — ADR-0016) bundle. Absent -> actionable
//     message + non-zero exit, exactly like rig:alloy when the bundle is missing. ---
let createEvent, createPersonalizationDetails, mergeQuery, alloyVersion;
try {
  createEvent = (await import(pathToFileURL(join(BASE, "alloy-core/src/core/createEvent.js")).href)).default;
  createPersonalizationDetails = (await import(pathToFileURL(join(BASE, "alloy/src/components/Personalization/createPersonalizationDetails.js")).href)).default;
  ({ mergeQuery } = await import(pathToFileURL(join(BASE, "alloy-core/src/utils/event.js")).href));
  alloyVersion = JSON.parse(await readFile(join(BASE, "alloy/package.json"), "utf8")).version;
} catch (e) {
  fail("probe-local @adobe/alloy bundle absent — this rig needs it (ADR-0016 adopter-supplied)", {
    hint: "run `npm ci` (or `npm install`) inside probes/alloy-worker, then retry",
    detail: String((e && e.message) || e),
  });
}

// Drive REAL alloy@2.35.0's per-event query build: createEvent + the
// Personalization component's createQueryDetails + alloy-core's mergeQuery,
// gated exactly as createComponent.onBeforeEvent gates it (shouldFetchData).
// `defaultPersonalizationEnabled:false` on a FRESH boot (isCacheInitialized:false)
// is alloy's own analytics-off shape.
function realAlloyEventContent(personalizationConfig) {
  const event = createEvent();
  event.setUserXdm(JSON.parse(JSON.stringify(XDM)));
  const details = createPersonalizationDetails({
    getPageLocation: () => new URL("https://airlock.example/"),
    renderDecisions: false,
    decisionScopes: [],
    personalization: personalizationConfig,
    event,
    isCacheInitialized: false, // FRESH boot — shouldRequestDefaultPersonalization fires here
    logger: { info() {}, warn() {}, error() {}, logOnContentRendering() {} },
  });
  if (details.shouldFetchData()) mergeQuery(event, details.createQueryDetails()); // createComponent.onBeforeEvent gate
  event.finalize();
  return event.toJSON();
}

const onContent = realAlloyEventContent({}); // default fresh boot → personalization ON
const offContent = realAlloyEventContent({ defaultPersonalizationEnabled: false }); // native OFF

// Sanity: real alloy differs EXACTLY on the per-event personalization query.
if (!(onContent.query && onContent.query.personalization)) {
  fail("real-alloy ON did not build events[].query.personalization (alloy internals changed?)", { onContent });
}
if (Object.prototype.hasOwnProperty.call(offContent, "query")) {
  fail("real-alloy native personalization-off unexpectedly carried a per-event query", { offContent });
}

const onBody = JSON.stringify({ events: [onContent], query: IDENTITY_FETCH });
const nativeOffBody = { events: [offContent], query: IDENTITY_FETCH };

// --- Push the ON body through the REAL wired seam (personalization denied,
//     analytics granted) — the SAME core/wrapped-sdk-host.js the adapter wires. ---
let handler = null;
const chamber = { postMessage: () => {}, onMessage: (cb) => { handler = cb; } };
let dispatchedBody = null;
const caps = { egress: { dispatch: async (req) => { dispatchedBody = req.body; return { status: 200, body: "{}" }; } } };
createWrappedSdkHost({
  chamber,
  caps,
  egressPurposes: ["analytics_storage", "personalization"],
  consent: { analytics_storage: "granted", personalization: "denied" },
  onDiagnostic: () => {},
});
handler({ type: "intercepted-fetch", id: 1, url: INTERACT, method: "POST", headers: {}, body: onBody });
await new Promise((r) => setTimeout(r, 20)); // let the seam's async caps.egress.dispatch settle

if (dispatchedBody == null) fail("the seam did not dispatch the interact (unexpectedly held)");
const strippedOff = JSON.parse(dispatchedBody);

try {
  assert.deepStrictEqual(strippedOff, nativeOffBody);
} catch (e) {
  fail("seam-stripped ON does NOT deep-equal alloy's native personalization-off interact", {
    strippedOff,
    nativeOffBody,
    detail: String((e && e.message) || e),
  });
}
if (JSON.stringify(strippedOff).includes("personalization")) {
  fail("stripped body still contains the substring 'personalization'", { strippedOff });
}

pass({
  verdict: "seam-stripped personalization-ON interact deep-equals alloy's own defaultPersonalizationEnabled:false interact",
  alloyVersion,
  note: "creds-free differential — the analytics-only egress is a valid alloy analytics interact, not a malformed body. Live-Edge confirmation remains a creds-gated residual (013 pattern).",
});
