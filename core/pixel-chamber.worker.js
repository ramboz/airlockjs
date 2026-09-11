/**
 * The pixel chamber (spec 026-01 AC3) — hosts the generic, vendor-neutral
 * `connectors/pixel/connector.js`'s `createPixelConnector` through the SAME
 * `core/connector-host.js` mechanism `core/chamber.worker.js` (GA4) and
 * `connectors/alloy/alloy-chamber.worker.js` (alloy) already use. Mirrors
 * `core/chamber.worker.js`'s shape — the same first-import egress-confinement
 * guard (`./confine-pixel-chamber.js`) and host wiring — swapping only the
 * hosted factory and dropping the GA4-shaped init fields
 * (`trackers`/`workFactor`/`ctx`) the pixel connector never reads.
 *
 * WIRE PROTOCOL — same shape as `core/chamber.worker.js`'s, plus the 026-04
 * advanced-matching IDENTITY channel:
 *   IN  `{ type: "init", ...pixelConfig }`   (pixelConfig: the declarative
 *       `{ endpoint, eventMap, paramMap, [advancedMatching], … }`)
 *   IN  `{ type: "events", batch }`          (batch: descriptor[])
 *   IN  `{ type: "identity", raw }`          (026-04: raw PII set later —
 *       `{ em, ph, … }` — on a DEDICATED channel, NOT the events batch)
 *   OUT `{ ready: EgressRequest[], dropped: Array<{ index, type, reason }> }`
 *   OUT `{ type: "identity", ud }`           (026-04: the hashes as each
 *       resolves — `{ <field>: <hex> }` — posted back for the main-side cache)
 * `core/airlock.js`'s connector-selection seam
 * (`createAirlock({ connector: "pixel", connectorConfig })`) generalizes its
 * own init-message construction to post `{ type: "init", ...connectorConfig }`
 * here verbatim — no trackers/workFactor/ctx are sent (this connector never
 * reads them; it has no per-tracker fan-out).
 *
 * ADVANCED MATCHING (spec 026-04, [ADR-0022] Option C, hashed EAGERLY): raw
 * identity reaches this chamber on the DEDICATED `init`/`identity` channels
 * (never `push()`/events, so a host `payloadDenylist` never strips it before
 * hashing — safe because this chamber is egress-confined, A5). On receipt the
 * chamber EAGERLY normalizes + SHA-256-hashes each field (`connectors/pixel/
 * advanced-matching.js`), keeps the hashes in a worker-side identity map, AND
 * posts `{ type: "identity", ud }` back to main as each resolves. The RAW value
 * NEVER leaves the worker — only the hash. The pixel connector's own `handle`
 * stays identity-AGNOSTIC (026-01 AC1): it produces the base `/tr`; this glue
 * merges `ud[...]` onto the ready requests via `mergeAdvancedMatching`, so a
 * back-compat config with NO advanced matching (empty identity map) is a no-op.
 *
 * EGRESS CONFINEMENT (026-01 craft-review — security parity for an ad-vendor
 * chamber): like `core/chamber.worker.js`, this file's FIRST import
 * (`./confine-pixel-chamber.js`, above) withholds `fetch` before the connector
 * imports below evaluate. The pixel connector's own egress is the `ready`
 * postMessage, never a mediated fetch inside the worker — exactly like GA4's
 * inversion — so the SAME `withholdFetch: true` posture applies verbatim
 * (source-order + withholdFetch both regression-pinned in
 * test/egress-confinement.test.js).
 *
 * No DOM, no ambient globals (ADR-0001) — mirrors chamber.worker.js.
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (spec 016-01's load-bearing ordering
// fix, applied here for the pixel chamber — 026-01 craft-review). ES-module
// evaluation is POST-ORDER, so a statically-imported module's top-level runs
// before THIS file's body — and imports evaluate in SOURCE ORDER, so putting
// this FIRST guarantees egress confinement (withholding `fetch`, since the
// pixel connector's egress is the `ready` postMessage, not a mediated fetch)
// runs before the connector imports below can capture a live `fetch`. See
// core/confine-pixel-chamber.js for the full argument.
import "./confine-pixel-chamber.js";
import { createConnectorHost } from "./connector-host.js";
import { createPixelConnector } from "../connectors/pixel/connector.js";
import { hashField, mergeAdvancedMatching } from "../connectors/pixel/advanced-matching.js";

let host = null;
let initPromise = null;
// 026-04: the worker-side identity map — resolved `ud[...]` hashes ONLY (never
// raw). Filled EAGERLY as each field's hash resolves; merged onto every
// steady-state `ready` beacon; each field also posted back to main for the
// synchronous unload merge (core/airlock.js's cache). Empty for a config with
// no advanced matching -> mergeAdvancedMatching is a no-op (back-compat).
const identityHashes = Object.create(null);

/**
 * 026-04 EAGER hashing: for each raw identity field, normalize + SHA-256-hash
 * it (off the connector's `handle`, so `handle` stays identity-agnostic), store
 * the hash worker-side, and post it back to main as it resolves. The RAW value
 * never leaves the worker — only the hash is retained/posted. An unknown field
 * or a failed hash resolves to `undefined` and is skipped (degrade-to-omit,
 * never emit raw). `self` is captured once at call time (guarded below).
 */
function ingestIdentity(raw, post) {
  if (!raw || typeof raw !== "object") return;
  for (const field of Object.keys(raw)) {
    const value = raw[field];
    if (value === undefined || value === null) continue;
    Promise.resolve()
      .then(() => hashField(field, value))
      .then((hex) => {
        if (hex === undefined) return; // unknown field -> never cached, never emitted
        identityHashes[field] = hex;
        post({ type: "identity", ud: { [field]: hex } });
      })
      .catch(() => {
        // A hash failure degrades to OMIT (the field is simply never cached);
        // it MUST NOT surface the raw value. No diagnostic carries the value.
      });
  }
}

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard core/chamber.worker.js uses.
if (typeof self !== "undefined") {
  const post = (msg) => self.postMessage(msg);
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      // 026-04: strip BOTH the discriminant AND `advancedMatching` — the raw
      // boot identity (`external_id`) is fed to the EAGER hasher below, never to
      // the connector (its `handle` must stay identity-agnostic, 026-01 AC1).
      const { type, advancedMatching, ...config } = m;
      host = createConnectorHost(createPixelConnector, config);
      initPromise = host.init({}); // no capabilities are wired for the pixel archetype today
      if (advancedMatching) ingestIdentity(advancedMatching, post); // eager: external_id at boot
      return;
    }
    if (m.type === "identity") {
      // 026-04: the dedicated setIdentity channel — raw PII set after boot
      // (`{ em, ph, … }`). Eager-hash + post back; the raw never egresses.
      ingestIdentity(m.raw, post);
      return;
    }
    if (m.type === "events" && host) {
      Promise.resolve(initPromise)
        .then(() => host.routeBatch(m.batch))
        .then(({ ready, dropped }) => {
          // 026-04: merge the currently-resolved identity hashes onto the ready
          // beacons (per-field; an unresolved field is simply omitted). Empty
          // map -> the SAME `ready` array unchanged (back-compat). The connector
          // built the identity-agnostic base `/tr`; the `ud[...]` is added here.
          self.postMessage({ ready: mergeAdvancedMatching(ready, identityHashes), dropped });
        })
        .catch((err) => {
          // Mirrors core/chamber.worker.js's own top-level-routeBatch-failure
          // backstop — unreachable in practice (airlock.js always posts a
          // proper array batch), but no silent path.
          const reason = err && err.message != null ? err.message : String(err);
          self.postMessage({ ready: [], dropped: [{ index: -1, type: "__batch__", reason }] });
        });
    }
  };
}
