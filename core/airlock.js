/**
 * Minimal airlock runtime (spec 003) — the off-main-thread path.
 *
 * Main thread: `push()` appends a descriptor to the event log, folds a
 * synchronous projection (O(1)), and enqueues to a ring buffer — cheap, on the
 * interaction path (ADR-0002). A chunked drain on idle serializes a batch and
 * `postMessage`s it to a single Web Worker chamber (ADR-0001 plain Worker).
 *
 * Egress is ADR-0002 Option C: the worker MAPS (off-thread, INP-safe) and returns
 * ready requests; the orchestrator DISPATCHES them on the main thread via
 * `fetch` keepalive, and flushes on `visibilitychange`→`hidden` so pending egress
 * survives teardown (OQ10 / R-001). Main-thread dispatch of a prebuilt keepalive
 * body is cheap and does not touch INP (mapping stayed in the worker).
 *
 * OQ10 unload fast path (closed): a beacon GENERATED inside the unload window
 * cannot round-trip to the worker to be mapped before teardown, so those events
 * take a main-thread SYNCHRONOUS mapping path instead — `pushCritical()` for
 * caller-declared unload-critical beacons (outbound click, closing `page_view`),
 * and a synchronous flush of the not-yet-drained ring tail at
 * `visibilitychange`→hidden / `pagehide`. Both reuse the same pure `mapToMp` the
 * worker uses (byte-identical payloads) via `core/egress.js`, and never enter the
 * worker — so there is no two-sender dedup problem. Synchronous mapping is only
 * taken at unload, where there is no interaction left to protect.
 */
import { createCriticalDispatcher } from "./egress.js";
import { originPath, checkEndpointCeiling } from "./endpoint-ceiling.js";

// Default diagnostics seam: console-backed, severity-differentiated (warn for a
// per-descriptor drop, error for a chamber-level crash). Callers may inject
// `onDiagnostic` (e.g. the future OQ7 inspector) to intercept the same records;
// it is the single sink, so no call site hard-codes `console` directly.
function consoleDiagnostic(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("airlock:", record);
}

export function createAirlock({ trackers, workFactor, endpoints, ctx, unloadCritical, onDiagnostic }) {
  const diagnose = typeof onDiagnostic === "function" ? onDiagnostic : consoleDiagnostic;
  // 016-01 AC3/AC5: the endpoint ceiling, reduced ONCE from the host's
  // construction-time declared `endpoints` — never derived from a chamber's
  // `ready` request, so a compromised chamber cannot widen its own ceiling.
  // Gated below on `ceiling.length` so a caller with no declared endpoints is
  // unaffected (back-compat); a connector with declared endpoints (GA4,
  // always) gets the ceiling enforced on every dispatch.
  const ceiling = (endpoints || []).map(originPath).filter(Boolean);
  const log = [];
  // Null-prototype: event names are object keys, so a pathological name like
  // "__proto__" must land as an own key, not rewire the projection's prototype.
  const projection = Object.create(null);
  const ring = [];
  let seq = 0;
  let dispatched = 0;
  let scheduled = false;

  // OQ10 fast path: synchronous main-thread mapping+egress for unload-critical
  // beacons and the ring tail at teardown. Reuses the pure `mapToMp` (byte-for-byte
  // the same payload the worker builds) and never touches the worker.
  const criticalTypes = new Set(unloadCritical || []);
  const critical = createCriticalDispatcher({ ctx, endpoints, trackers });

  const worker = new Worker(new URL("./chamber.worker.js", import.meta.url), { type: "module" });
  worker.postMessage({ type: "init", trackers, workFactor, endpoints, ctx });

  // Orchestrator dispatch: the worker returns mapped requests; send them on the
  // MAIN thread immediately (fetch keepalive is cheap + survives page teardown).
  worker.onmessage = (e) => {
    const data = e.data;
    const ready = data && data.ready;
    if (ready) {
      for (const r of ready) {
        // 016-01 AC3/AC4: fail-closed endpoint ceiling — before dispatching,
        // hold any destination outside the connector's DECLARED endpoints
        // (origin+pathname; ADR-0006's declared-as-ceiling law). An
        // undeclared destination gets NO fetch and NO dispatched++ (the seal
        // bites); it is surfaced via the 009-02 diagnostics sink so a held
        // egress is never silently invisible.
        if (ceiling.length) {
          const c = checkEndpointCeiling(r.url, endpoints);
          if (c.verdict === "hold") {
            diagnose({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: c.destination, reason: c.reason });
            continue;
          }
        }
        fetch(r.url, { method: "POST", body: r.body, keepalive: true })
          .then(() => { dispatched++; }, () => { dispatched++; });
      }
    }
    // 009-02 AC2: surface each 009-01 per-descriptor drop — otherwise a
    // malformed event silently vanishes instead of being diagnosable.
    const dropped = data && data.dropped;
    if (dropped && dropped.length) {
      for (const d of dropped) {
        diagnose({ level: "warn", kind: "dropped", type: d.type, reason: d.reason, index: d.index });
      }
    }
  };

  // 009-02 AC1: a chamber-level worker error (NOT a caught per-descriptor
  // throw — e.g. a worker-module load error or an internal bug) is otherwise
  // silently swallowed once handled/registered. The Worker boundary already
  // keeps the page alive regardless (spec 009-02 frame-critique); this
  // registration makes the failure OBSERVED via the same diagnostics seam.
  // ErrorEvent fields degrade gracefully — never surface an empty record.
  worker.onerror = (err) => {
    diagnose({
      level: "error",
      kind: "chamber-error",
      message: err && err.message != null ? err.message : String(err),
      ...(err && err.filename != null ? { filename: err.filename } : {}),
      ...(err && err.lineno != null ? { lineno: err.lineno } : {}),
    });
  };

  const drain = () => {
    scheduled = false;
    if (!ring.length) return;
    const batch = ring.splice(0, 50); // chunk
    worker.postMessage({ type: "events", batch });
    if (ring.length) schedule();
  };
  function schedule() {
    if (!scheduled) { scheduled = true; requestIdleCallback(drain, { timeout: 50 }); }
  }

  // OQ10 backstop: at unload, map + dispatch whatever is still buffered
  // SYNCHRONOUSLY on the main thread (a worker round-trip cannot complete before
  // teardown — the old postMessage-to-worker backstop lost this tail). Declared
  // unload-critical types go first so they win the keepalive budget. Events flushed
  // here were never sent to the worker (still in the ring), so no double-send.
  const unloadFlush = () => {
    if (!ring.length) return;
    const remaining = ring.splice(0, ring.length);
    remaining.sort(
      (a, b) => (criticalTypes.has(b.type) ? 1 : 0) - (criticalTypes.has(a.type) ? 1 : 0),
    );
    for (const d of remaining) critical.dispatch({ type: d.type, params: d.params });
  };
  if (typeof addEventListener === "function") {
    addEventListener("visibilitychange", () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") unloadFlush();
    });
    addEventListener("pagehide", unloadFlush);
  }

  return {
    /**
     * Interaction-path entry: append + fold + enqueue. O(1), no mapping.
     *
     * Accepts the PINNED contract shape `push({ event: "name", ...params })`
     * (contracts/push-api.md): the reserved `event` key is the GA4 event name,
     * every other key is a param. We normalize to the internal `{ type, params }`
     * descriptor here — the log/projection/ring/worker and the golden `mapToMp` all
     * stay on `{ type, params }`, so reconciling the surface is a one-line unpack.
     */
    push(evt) {
      const { event: type, ...params } = evt || {};
      // Envelope guard (contracts/push-event.schema.json: `event` required, minLength
      // 1). Drop + warn, never throw — the interaction path must stay O(1) and must
      // not break the page on a malformed caller.
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: push() dropped — missing/empty `event` name", evt);
        return;
      }
      const descriptor = { seq: seq++, type, ts: performance.now(), params };
      log.push(descriptor);
      projection[type] = descriptor; // trivial synchronous fold (AD-3)
      ring.push(descriptor);
      schedule();
    },
    /**
     * Unload-critical entry (OQ10 fast path): map + send SYNCHRONOUSLY on the main
     * thread, right now, bypassing the worker. Call from an outbound-link click or
     * a `pagehide`/`beforeunload` handler for the canonical last beacon — the event
     * generated inside the unload window that the async worker path would lose.
     * Steady-state events MUST use `push()`; this path is INP-unsafe by design and
     * only justified when the page is going away.
     */
    pushCritical(evt) {
      const { event: type, ...params } = evt || {}; // same contract shape as push()
      if (typeof type !== "string" || type.length === 0) {
        console.warn("airlock: pushCritical() dropped — missing/empty `event` name", evt);
        return;
      }
      critical.dispatch({ type, params });
    },
    /**
     * Synchronous read (AD-3): no argument → the whole projection; a dotted path
     * (`getState("a.b.c")`, contracts/push-api.md) → the value at that path in the
     * projection, `undefined` if any hop is absent. Never throws on a missing path.
     */
    getState(path) {
      if (path == null) return projection;
      let cur = projection;
      for (const key of String(path).split(".")) {
        if (cur == null) return undefined;
        cur = cur[key];
      }
      return cur;
    },
    flushNow() { while (ring.length) worker.postMessage({ type: "events", batch: ring.splice(0, 50) }); },
    stats() { return { dispatched, logged: log.length, ...critical.stats() }; },
  };
}
