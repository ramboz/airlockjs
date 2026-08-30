/**
 * Generic push → ring → beacon capture — spec 012-03, AC5 (pure, browser-safe).
 *
 * A minimal, CONNECTOR-AGNOSTIC capture runtime that mirrors core/airlock.js's
 * shape — `push` appends a descriptor to a ring (O(1), interaction-path-cheap),
 * `flush` drains the ring and dispatches each as a beacon — WITHOUT editing core
 * (parallel-and-minimal, per the slice; the alloy rigs mirror the main-thread
 * dispatch in the harness exactly as core/airlock.js does, rather than booting the
 * GA4-wired real runtime with its Worker). The proposition→exposure reporter
 * (adapters/eds/decisions-exposure.js) pushes into this, so an exposure rides the
 * SAME generic path any airlock event takes — the rig then proves the beacon
 * actually fires on the real page (the "→ beacon" half).
 *
 * NO node builtins / `self` — imported directly by the browser harness AND the
 * Node unit tests (the rig/coherency-model.mjs pattern).
 */

/**
 * @param {{ beacon?: (evt: object) => void }} [opts] `beacon` dispatches one
 *   drained descriptor (a real keepalive fetch in the browser; a spy in tests).
 * @returns {{ push(evt: object): void, flush(): void, ringLength(): number, sent: object[] }}
 */
export function createGenericCapture({ beacon } = {}) {
  const ring = [];
  const sent = [];
  return {
    /** Interaction-path enqueue — append to the ring, no mapping/beacon yet. */
    push(evt) { ring.push(evt); },
    /** Drain the ring in FIFO order and dispatch each as a beacon. */
    flush() {
      while (ring.length) {
        const evt = ring.shift();
        sent.push(evt);
        if (typeof beacon === "function") beacon(evt);
      }
    },
    ringLength() { return ring.length; },
    sent,
  };
}
