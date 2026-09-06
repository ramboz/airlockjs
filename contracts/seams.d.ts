/**
 * Airlock seam driver interfaces — pinned contract (drive-order step 5).
 * FROZEN at 1.0 (ADR-0017) — both driver interfaces below.
 *
 * Two seams make edge swappable from day one (AD-1); only local drivers ship
 * at 1.0, so "add edge" is a driver swap, not a rewrite.
 *
 *  - DECISION-SOURCE seam: local | edge. The in-house eager-window decisioning
 *    ships AS the local driver (clarification Q4). It runs on the main thread
 *    and must resolve before `body.appear` or it holds paint — the EDS
 *    no-flicker mechanism (R-005).
 *  - EGRESS seam: direct-keepalive (shipped) | service-worker | edge-proxied.
 *
 * The egress DISPATCH/DELIVERY model — where `fetch` runs, delivery under
 * interaction-storm load, the aggregate keepalive budget, and the
 * unload/last-beacon path — is RESOLVED (ADR-0004: a two-path model — the
 * direct-keepalive driver below, plus the `pushCritical()` main-thread fast
 * path documented in push-api.md for the canonical last-beacon case). This
 * file pins the driver INTERFACE shape.
 *
 * HONESTLY RECORDED (ADR-0017): frozen PROVEN-FOR-ONE, not proven-general —
 * no second decision-source or egress driver has ever been written against
 * either interface, so second-implementer fitness is unvalidated at 1.0.
 */

/* ---- decision-source seam ---- */

export interface DecisionSourceDriver {
  /**
   * Resolve a decision for the eager window. The MVP1 local driver runs
   * in-house logic on the main thread (Q4 / R-005). Synchronous or fast-async;
   * it must settle before `body.appear`.
   */
  decide(request: DecisionRequest): DecisionResult | Promise<DecisionResult>;
}

export interface DecisionRequest {
  /** Decision scope, e.g. an experiment/campaign id or "__view__". */
  readonly scope: string;
  /** Resolved audiences on the page, if any. */
  readonly audiences?: readonly string[];
}

export interface DecisionResult {
  readonly variant: string;
  /** Opaque apply instructions the adapter uses in the eager window. */
  readonly apply?: unknown;
}

/* ---- egress seam ---- */

export interface EgressDriver {
  /**
   * Dispatch a request that has already passed the seal. The shipped driver
   * uses `fetch(url, { keepalive: true })` on the main thread (ADR-0004).
   * `pushCritical()`'s unload fast path (push-api.md) is a separate,
   * synchronous route for the canonical last-beacon case — not a second
   * implementation of this driver interface.
   */
  dispatch(request: SealedEgressRequest): Promise<EgressResult>;
}

/** An egress request the seal has approved (consent + host allow-list passed). */
export interface SealedEgressRequest {
  readonly url: string;
  readonly method: "POST" | "GET";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | ArrayBufferView;
  readonly unloadCritical?: boolean;
}

export interface EgressResult {
  /** `sent-unknown` reflects that keepalive failures are opaque `TypeError`s
   *  indistinguishable from network errors (R-001); the inspector surfaces it
   *  (spec 028). `held` = queued at the seal pending consent. */
  readonly status: "sent" | "sent-unknown" | "held";
}
