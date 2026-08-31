import { mapToMp } from "./map.js";

/**
 * GA4 wire-protocol connector — spec 014-03 (converge connector-hosting).
 *
 * Expresses GA4 (MVP1) as a `ConnectorFactory` (contracts/connector.d.ts:
 * manifest -> factory -> init -> handle), so it is hosted by the SAME generic
 * `core/connector-host.js` the wrapped-SDK alloy connector uses (012-01) —
 * retiring `core/chamber.worker.js`'s hardcoded `mapToMp` import (MVP2 arch
 * flag 3 / this slice's AC1/AC4). `mapToMp` itself is NOT modified — it is
 * imported and called exactly as `core/chamber.worker.js`'s old `mapBatch`
 * called it (AC2 byte-identity).
 *
 * BRIDGE (AC1 impedance b): `mapToMp` reads the legacy `{ type, params }`
 * descriptor shape, but the pinned `AirlockEvent` contract is
 * `{ type, payload, snapshot, ... }`. `handle` bridges with
 * `event.params || event.payload` — the SAME fallback
 * `connectors/alloy/connector.js`'s `toXdm` already uses — so a real batch
 * descriptor (`{ type, params }`, what `core/airlock.js`'s ring carries) and a
 * contract-shaped `AirlockEvent` (`{ type, payload }`) both map correctly,
 * and `mapToMp` never sees anything but the `{ type, params }` shape it always
 * expected.
 *
 * PER-TRACKER FAN-OUT (AC1 impedance c): `core/chamber.worker.js`'s old
 * `mapBatch` called `mapToMp` once per tracker (not hoisted — `workFactor` is
 * a synthetic per-tracker cost knob the INP rigs use, so each tracker
 * redoing the "mapping work" is the intended simulation, not redundant code)
 * then spun `busy(workFactor)` before pushing `{ url: endpoints[t], body }`.
 * That loop is re-homed here, byte-for-byte, with no change to its
 * observable output shape.
 *
 * CONTAINMENT: isolation granularity is PER EVENT, not per (event, tracker) —
 * `mapToMp`'s result depends on `event + ctx`, not the tracker, so a throw on
 * an event recurs for every tracker. `handle` does NOT catch internally: a
 * throw propagates out of `handle` whole, so `core/connector-host.js`'s
 * `routeBatch` (which wraps the whole `connector.handle(event)` call per
 * event) records the ONE drop and no partial requests are pushed for that
 * event — exactly `mapBatch`'s old per-descriptor containment (ADR-0001).
 *
 * MANIFEST (AC1 impedance a — `connectors/ga4/` had no manifest before this
 * slice): mirrors `connectors/alloy/connector.js`'s manifest shape (ADR-0006
 * declaration frame + ADR-0007 purpose annotation). Two channels, NOT conflated
 * (014-03 arch-review):
 *  - `events: ["*"]` — GA4 is the analytics CATCH-ALL: it maps every event type
 *    to MP and accepts arbitrary custom event names by design (contracts/ga4-mp.md),
 *    so enumeration is impossible; the wildcard declares "all event types route
 *    here." The event PAYLOAD crosses ungoverned (ADR-0006 §"the event payload
 *    crosses ungoverned"), so there is no per-field payload declaration to make.
 *  - `reads: []` — `reads` is the PROJECTION snapshot channel (ADR-0003
 *    default-deny), a DIFFERENT thing from the payload. GA4's `handle` reads the
 *    event payload + host-sourced `ctx`, and NEVER `event.snapshot`, so it reads
 *    ZERO projection fields. (A `["*"]` here would violate ADR-0003's default-deny.)
 * Declared, NOT enforced — the MVP3 grant resolver this feeds is a later spec.
 *
 * IDENTITY (AC1 impedance a — capabilities): `client_id`/`session_id` are
 * sourced from the `_ga`/`_ga_<stream>` cookies (`connectors/ga4/cookies.js`,
 * unchanged, unwired here). The manifest DECLARES the cookie capability GA4's
 * identity model needs (disclosure, MVP3 grant-resolver food); `ctx` itself
 * keeps arriving host-sourced via `config.ctx` (today: `adapters/eds/index.js`
 * calls `sourceGa4Ctx` before `createAirlock`), unchanged by this slice —
 * `init(caps)` accepts `caps` for contract conformance only, mirroring
 * alloy's "the connector itself needs no capability to boot" note.
 *
 * Pure — no `self`/`postMessage`/DOM — directly importable/testable in Node,
 * exactly like `connectors/alloy/connector.js`.
 *
 * @param {Readonly<Record<string, unknown>>} [config] host-owned GA4 config:
 *   `{ trackers, workFactor, endpoints, ctx }` — the same fields
 *   `core/chamber.worker.js`'s old `cfg` carried.
 * @returns {import("../../contracts/connector").Connector}
 */
export function createGa4Connector(config = {}) {
  const {
    endpoints = [],
    trackers = endpoints.length,
    workFactor = 0,
    ctx,
  } = config;

  const manifest = {
    name: "airlock/ga4",
    // GA4 is the analytics CATCH-ALL: it maps every event type to MP and accepts
    // arbitrary custom event names by design (contracts/ga4-mp.md), so enumeration
    // is impossible — `["*"]` declares "all event types route here" (declared, NOT
    // enforced). Contrast alloy's fixed single-event MVP2 proof scope.
    events: ["*"],
    // `reads` = PROJECTION snapshot fields (ADR-0003 default-deny). GA4's handle
    // maps the event PAYLOAD (event.params) + host-sourced ctx — it reads NO
    // projection snapshot fields (never touches event.snapshot) — so `reads` is
    // EMPTY. (The open param set GA4 forwards is the event PAYLOAD, which crosses
    // ungoverned per ADR-0006 — a DIFFERENT channel from `reads`.)
    reads: [],
    capabilities: {
      // client_id (_ga) / session_id (_ga_<stream>) persistence — declared for
      // MVP3 disclosure; connectors/ga4/cookies.js is the (unwired-here) source.
      // "_ga_" is a PREFIX (the real name carries a dynamic per-stream suffix),
      // mirroring alloy's own prefix-style dynamic-suffix cookie declarations
      // ("kndctr_", "AMCV_").
      cookies: ["_ga", "_ga_"],
      // it emits one MP request per tracker (the ready EgressRequest[] below).
      egress: true,
    },
    // 012-04-style ADVISORY endpoints (ADR-0006 — host allow-list wins): the
    // per-tracker MP collect URLs this instance was configured with.
    endpoints: [...new Set(endpoints)],
    // ADR-0007 consent-purpose annotation: GA4 is analytics-only (no ads/
    // personalization signal it emits) — the Consent Mode `analytics_storage`
    // purpose tags every declared endpoint/cookie and egress overall. `reads` is
    // OMITTED because `reads` is EMPTY (GA4 reads no projection fields — nothing to
    // purpose-tag); the event payload it forwards crosses ungoverned (ADR-0006),
    // outside the per-field purpose model.
    purposes: {
      egress: ["analytics_storage"],
      endpoints: Object.fromEntries(
        [...new Set(endpoints)].map((e) => [e, ["analytics_storage"]]),
      ),
      cookies: {
        _ga: ["analytics_storage"],
        _ga_: ["analytics_storage"],
      },
    },
  };

  /**
   * GA4 is a wire-protocol connector — there is no vendor SDK to boot (unlike
   * alloy's `configure`), and `ctx`/`endpoints`/`trackers`/`workFactor` all
   * arrive via `config` at construction (mirrors the old `cfg` set once on
   * the chamber's "init" message). Accepted for contract conformance only.
   * @param {import("../../contracts/capability").GrantedCapabilities} caps
   */
  function init(_caps) {
    // no-op — see doc comment above.
  }

  /**
   * Map one event to one `EgressRequest` per tracker — `mapBatch`'s old
   * per-descriptor work, re-homed. `mapToMp` is untouched (AC2); `handle`
   * only bridges the event shape and re-homes the per-tracker loop (AC1).
   * @param {import("../../contracts/connector").AirlockEvent} event
   * @returns {import("../../contracts/connector").EgressRequest[]}
   */
  function handle(event) {
    const legacyEvent = {
      type: event && event.type,
      params: (event && (event.params || event.payload)) || {},
    };
    const requests = [];
    for (let t = 0; t < trackers; t++) {
      const body = mapToMp(legacyEvent, ctx); // map (contract-shaped) — byte-identical to mapBatch
      busy(workFactor); // complex per-tracker logic — OFF the main thread
      requests.push({ url: endpoints[t], body: JSON.stringify(body) });
    }
    return requests;
  }

  return { manifest, init, handle };
}

/**
 * Busy-spin for `micros` microseconds — the synthetic per-tracker cost knob
 * the INP-measurement rigs drive via `workFactor` (re-homed verbatim from
 * `core/chamber.worker.js`'s old module-scoped `busy`; production always
 * passes `workFactor: 0` — `adapters/eds/index.js`).
 * @param {number} micros
 */
function busy(micros) {
  if (micros <= 0) return;
  const end = performance.now() + micros / 1000;
  while (performance.now() < end) {} // eslint-disable-line no-empty
}
