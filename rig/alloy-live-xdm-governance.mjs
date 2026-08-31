// Spec 020-01 (creds-gated live-Edge leg) — is airlock's XDM-body STRIP Edge-safe?
//
// Models rig/alloy-live-reroute.mjs: POSTs minimal `interact` bodies to the REAL Adobe Edge
//   https://adobedc.demdex.net/ee/v1/interact?configId=<ALLOY_DATASTREAM_ID>
// reading the datastream from env, and reports ONLY: variant label, HTTP status, ok/rejected,
// and SHAPE-level observations (response `handle[].type` tokens + count — generic Adobe schema
// strings, never identifiers). This is a FEASIBILITY PROBE: the goal is EVIDENCE, not a feature.
//
// SCOPE (this rig): the STRIP half of governance only — does real Edge tolerate airlock
// stripping a host-denylisted field from `events[].xdm` at the seam?
//   1. baseline               — the control (expect Edge 200).
//   2. + synthetic sensitive  — base with a fake PII-shaped field on events[0].xdm
//                               (_airlocktest = { email, ssn }, SYNTHETIC/obviously-fake values).
//                               Does Edge tolerate an added xdm field?
//   3. governed (stripped)    — variant 2 serialized → parsed → field DELETED → re-serialized
//                               (airlock's strip mechanism). Is a field-stripped body Edge-safe?
//
// CONSENT IS OUT OF SCOPE FOR THIS RIG (correction, 2026-08-31). alloy consent is NOT an XDM
// body field, so there is nothing to POST here for it. It is the client-side `setConsent` COMMAND
// (flow: configure → setConsent → sendEvent). Characterized from the alloy@2.35.0 source
// (dist/alloy.js) + docs, the mechanism is:
//   - setConsent({ consent:[{ standard:"Adobe", version:"2.0", value:{ collect:{ val:"y"|"n" }}}] })
//     drives a client-side consent STATE MACHINE (states: in / out / pending). Every event's
//     egress is gated by `consent.awaitConsent().then(() => sendEdgeNetworkRequest(...))`:
//       • in      → resolves → the interact fires (body carries NO consent field).
//       • out     → REJECTS  → the `.then` never runs → the interact is NEVER sent to Edge.
//       • pending → queued (deferred) until resolved; on `out` the queue is discarded.
//   - setConsent ALSO issues its own SEPARATE Edge call to action `privacy/set-consent` (not
//     /ee/v1/interact); Edge's response sets the `kndctr_<orgId>_consent` cookie (general=in|out),
//     which the client reads back to flip the gate. i.e. for the Adobe standard the y/n→in/out
//     decision is made server-side + cookie-side, not by a body field.
// => The governance lever for consent is the setConsent gate / defaultConsent config (or an
//    independent egress drop at the seam), NOT body injection. A live confirmation
//    (configure → setConsent(collect:n) → sendEvent, observe the interact is suppressed) is a
//    NAMED FOLLOW-ON runnable on the 013 chamber-rig infra (rig/alloy-live-reprobe.mjs).
//
// REDACTION (non-negotiable, per spec 013): the datastream stays in env and is NEVER printed; the
// request URL (which carries configId) is NEVER printed; from RESPONSES only `handle[].type` tokens
// + counts and the generic error `type`/`title`/`status` catalog fields are read — NEVER an ECID,
// requestId, correlationID, eventToken, locationHint, or state:store key/value. Request bodies use
// SYNTHETIC values only (probe@example.invalid, fake ssn, airlock.example). This rig writes NO fixture.
//
// Usage:  set -a; . ./.env; set +a; node rig/alloy-live-xdm-governance.mjs
//         (or: ALLOY_DATASTREAM_ID=… node rig/alloy-live-xdm-governance.mjs)

const EDGE = "https://adobedc.demdex.net/ee/v1/interact";
const DS = process.env.ALLOY_DATASTREAM_ID;
if (!DS) {
  console.error("FAIL — set ALLOY_DATASTREAM_ID (source .env, gitignored). This is a creds-gated live-Edge leg.");
  process.exit(2);
}

const SENSITIVE_KEY = "_airlocktest";
const SENSITIVE_VAL = { email: "probe@example.invalid", ssn: "000-00-0000" }; // SYNTHETIC — no real PII

// A proven-minimal base (the reroute rig's body shape) + an ECID fetch so the response carries an
// identity round-trip we can diff across variants. All variants build on this.
function base() {
  return {
    events: [{
      xdm: {
        eventType: "web.webpagedetails.pageViews",
        timestamp: new Date().toISOString(),
        web: { webPageDetails: { URL: "https://airlock.example/", name: "airlock" } },
      },
    }],
    query: { identity: { fetch: ["ECID"] } },
  };
}

// Variant 2 — add the synthetic sensitive field to events[0].xdm.
function withSensitiveField() {
  const b = base();
  b.events[0].xdm[SENSITIVE_KEY] = { ...SENSITIVE_VAL };
  return b;
}

// Variant 3 — airlock's strip mechanism: serialize the sensitive body, parse it, DELETE the
// denylisted field, re-serialize. This is the exact parse→strip→re-serialize the seam would do.
function governedStripped() {
  const parsed = JSON.parse(JSON.stringify(withSensitiveField()));
  delete parsed.events[0].xdm[SENSITIVE_KEY];
  return parsed;
}

// POST one variant. Returns ONLY shape-level, non-identifying observations.
async function fire(label, bodyObj) {
  const url = `${EDGE}?configId=${DS}`; // NEVER printed — carries the datastream.
  const out = { label, status: 0, ok: false, handle_types: [], handle_count: 0 };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    out.status = r.status;
    out.ok = r.ok;
    let j = null;
    try { j = await r.json(); } catch { /* non-JSON body — leave shape empty */ }
    if (j && Array.isArray(j.handle)) {
      out.handle_count = j.handle.length;
      // handle[].type values are generic Adobe schema tokens (identity:result, state:store,
      // personalization:decisions, locationHint:result) — NOT identifiers.
      out.handle_types = [...new Set(j.handle.map((h) => h && h.type).filter(Boolean))].sort();
    }
    if (j && !r.ok) {
      // Generic RFC-7807 error catalog fields only — the Adobe error CODE + title + status.
      // Never `detail`/`report`/`requestId` (may echo request content or identifiers).
      if (typeof j.type === "string") out.error_type = j.type;
      if (typeof j.title === "string") out.error_title = j.title;
      if (typeof j.status === "number") out.error_status = j.status;
    }
  } catch (e) {
    out.status = -1;
    out.err = (e && e.name) || "fetch-error";
  }
  return out;
}

// Shape-diff between two variants' responses — a proxy for "did Edge treat these differently?".
function handlesDiffer(a, b) {
  return a.handle_count !== b.handle_count
    || JSON.stringify(a.handle_types) !== JSON.stringify(b.handle_types);
}

// --- run the strip variants sequentially (avoid hammering Edge) -----------------------------------
const baseline = await fire("1-baseline", base());
const sensitive = await fire("2-extra-sensitive-field", withSensitiveField());
const stripped = await fire("3-governed-stripped", governedStripped());

// --- derive the structured strip-safety read ------------------------------------------------------
const extraFieldAccepted = sensitive.ok;
const stripAccepted = stripped.ok;
// The strip must not change how Edge answers vs baseline (same handle shape = round-trip intact).
const stripShapePreserved = stripAccepted && !handlesDiffer(baseline, stripped);

const out = {
  question:
    "Does real Edge tolerate airlock STRIPPING a host-denylisted field from alloy's interact events[].xdm at the seam (parse→delete→re-serialize)?",
  endpoint_host: new URL(EDGE).host, // constant, public — carries no datastream
  datastream: "REDACTED (env ALLOY_DATASTREAM_ID — never printed)",
  variants: { baseline, sensitive, stripped },
  reads: {
    baseline_accepted: baseline.ok,
    extra_field_accepted: extraFieldAccepted, // does Edge tolerate an added xdm field?
    strip_mechanism_edge_safe: stripAccepted, // does Edge accept a field-STRIPPED body?
    strip_preserves_response_shape: stripShapePreserved, // same handle shape as baseline?
  },
  consent_note:
    "OUT OF SCOPE here — alloy consent is the client-side setConsent gate + a separate privacy/set-consent " +
    "Edge call + kndctr_<orgId>_consent cookie, NOT an interact body field. Characterized from " +
    "alloy@2.35.0 dist/alloy.js (consent state machine: in→send / out→REJECT-never-send / pending→queue; " +
    "every egress gated by consent.awaitConsent().then(sendEdgeNetworkRequest)). Live setConsent-flow " +
    "confirmation is a named follow-on on the 013 chamber rig (rig/alloy-live-reprobe.mjs).",
  verdict:
    `strip: added synthetic field ${extraFieldAccepted ? "ACCEPTED" : "REJECTED"} (HTTP ${sensitive.status}); ` +
    `field-stripped body ${stripAccepted ? "ACCEPTED" : "REJECTED"} (HTTP ${stripped.status}); ` +
    `response shape ${stripShapePreserved ? "PRESERVED vs baseline" : "CHANGED vs baseline"} => ` +
    `strip-at-seal is ${stripAccepted && stripShapePreserved ? "Edge-SAFE" : "NOT cleanly Edge-safe (inspect)"}.`,
};

console.log(JSON.stringify(out, null, 2));

// exit 0 only if the probe actually ran its control leg (baseline reached Edge with a real status)
process.exit(baseline.status > 0 ? 0 : 1);
