/**
 * Airlock seam driver interfaces — pinned contract (drive-order step 5).
 *
 * Two seams make edge swappable from day one (AD-1); only local drivers ship in
 * MVP1, so "add edge" is a driver swap, not a rewrite.
 *
 *  - DECISION-SOURCE seam: local | edge. MVP1 ships the in-house eager-window
 *    decisioning AS the local driver (clarification Q4). It runs on the main
 *    thread and must resolve before `body.appear` or it holds paint — the EDS
 *    no-flicker mechanism (R-005).
 *  - EGRESS seam: direct-keepalive (MVP) | service-worker | edge-proxied.
 *
 * DEFERRED: the egress DISPATCH/DELIVERY model — where `fetch` runs, delivery
 * under interaction-storm load, the aggregate keepalive budget, and the
 * unload/last-beacon path — is OQ10. This file pins the driver INTERFACE shape;
 * a driver's internal dispatch semantics are settled empirically at the
 * risk-retirement spike. The `dispatch` signature below is therefore
 * provisional on OQ10.
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
   * Dispatch a request that has already passed the seal. The MVP driver uses
   * `fetch(url, { keepalive: true })`. Whether this runs worker-side or
   * orchestrator-side, how it behaves under load, and how the unload flush
   * works are OQ10 — this signature is provisional on that resolution.
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
   *  (OQ7). `held` = queued at the seal pending consent. */
  readonly status: "sent" | "sent-unknown" | "held";
}
