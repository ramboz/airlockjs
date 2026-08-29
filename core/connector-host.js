/**
 * The connector host (spec 012-01, AC1) — the generic runtime piece that
 * turns a `ConnectorFactory` + config into a live, STATEFUL connector and
 * routes events through it, per contracts/connector.d.ts (manifest ->
 * factory -> init -> handle). This generalizes chamber.worker.js's
 * GA4-hardcoded `mapToMp` import so a wrapped-SDK connector (alloy, this
 * slice's AC2-6) and a wire-protocol connector (GA4, MVP1) can both be
 * hosted the same way.
 *
 * A NEW, PARALLEL path: core/chamber.worker.js, core/airlock.js, and
 * connectors/ga4/ are untouched by AC1 — GA4 keeps mapping via its own
 * hardcoded path. Wiring this host into a real Worker chamber
 * (importScripts bundle-load, fetch interception, sync-cookie capability)
 * is AC2-6 of this slice, not built here.
 *
 * Containment mirrors chamber.worker.js's `mapBatch`: a per-event try/catch
 * records `{ index, type, reason }` into `dropped[]` and continues the
 * batch — one bad (or malformed) event never takes the chamber down
 * (ADR-0001). `reason` is defensive against a non-Error throw, exactly like
 * `mapBatch`.
 *
 * Pure — no `self`/`postMessage`/DOM at module top level — so
 * `createConnectorHost` is directly importable/testable in Node. There is no
 * worker glue to guard yet (unlike chamber.worker.js's real
 * `if (typeof self !== "undefined")`-guarded `self.onmessage`): AC1 is the
 * host only, and there is no bundle-loaded factory to receive a message
 * until AC2 builds the chamber around it.
 *
 * @param {import("../contracts/connector").ConnectorFactory} factory
 * @param {Readonly<Record<string, unknown>>} config
 * @returns {{
 *   manifest: import("../contracts/connector").ConnectorManifest,
 *   init: (caps: import("../contracts/capability").GrantedCapabilities) => Promise<void>,
 *   routeBatch: (events: readonly import("../contracts/connector").AirlockEvent[]) => Promise<{
 *     ready: import("../contracts/connector").EgressRequest[],
 *     dropped: Array<{ index: number, type: string | undefined, reason: string }>,
 *   }>,
 * }}
 */
export function createConnectorHost(factory, config) {
  // Instantiated exactly ONCE — this is the retained instance every event
  // routes through, so connector-internal state (e.g. a wrapped SDK's own
  // identity cache) carries across events instead of being rebuilt per event.
  const connector = factory(config);

  let initStarted = false;
  let initResult;

  /**
   * Call the connector's `init(caps)` exactly once no matter how many times
   * `init` itself is invoked (idempotent). Sequencing "before the first
   * event is routed" is the caller's job; this only guarantees the
   * underlying `connector.init` never runs twice.
   */
  function init(caps) {
    if (!initStarted) {
      initStarted = true;
      initResult = Promise.resolve(connector.init(caps));
    }
    return initResult;
  }

  /**
   * Route one cycle's batch of events through the retained connector
   * instance. Mirrors `mapBatch`'s `{ ready, dropped }` shape.
   */
  async function routeBatch(events) {
    const ready = [];
    const dropped = [];
    for (const [index, event] of events.entries()) {
      try {
        if (event == null || typeof event.type !== "string") {
          throw new Error("malformed event: missing or non-string `type`");
        }
        const requests = await connector.handle(event);
        for (const req of requests) ready.push(req);
      } catch (err) {
        // Defensive against a non-Error throw yielding `undefined` — the
        // drop must be recorded, never vanished (mirrors mapBatch). The
        // `event && event.type` read is likewise safe against a null/
        // malformed event that failed the check above.
        const reason = err && err.message != null ? err.message : String(err);
        dropped.push({ index, type: event && event.type, reason });
      }
    }
    return { ready, dropped };
  }

  return { manifest: connector.manifest, init, routeBatch };
}
