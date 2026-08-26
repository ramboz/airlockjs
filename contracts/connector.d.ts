/**
 * Airlock connector interface — pinned contract (drive-order step 5).
 *
 * A connector runs inside a chamber in the worker runtime (ADR-0001). It
 * consumes typed events that crossed the airlock, reads only the projection
 * fields it declared (ADR-0003 default-deny), requests mediated capabilities,
 * and produces egress requests. It NEVER touches the DOM, the network, cookies,
 * or ambient globals directly — everything is mediated by the capability API
 * (AD-2, AD-5). See ./capability.d.ts.
 *
 * Two archetypes must fit this interface (AD-7): a wire-protocol connector
 * (GA4, MVP1 — builds a payload from scratch) and a wrapped-SDK connector
 * (alloy, MVP2 — hosts a vendor lib). R-004 validated that stock alloy can run
 * in a chamber IF the capability API exposes mediated cookie/storage, async
 * context injection, and decisions-as-data. This interface is shaped for both.
 *
 * DEFERRED — do not rely on these being final:
 *  - Synchronous host-call semantics for the wrapped-SDK archetype in a
 *    multi-chamber MVP2 world (OQ9). MVP1's single first-party connector uses a
 *    simple per-worker sync-cache; multi-chamber coherence is unproven.
 *  - How an egress request is actually dispatched — worker vs orchestrator,
 *    delivery-under-load, the unload/last-beacon path (OQ10). This interface
 *    pins the egress REQUEST shape, not the dispatch.
 *  - Event-payload read governance beyond the projection snapshot (OQ11 / OQ3).
 *    For MVP1 (first-party GA4, no compromised-connector threat) the payload
 *    crosses as-is.
 */

import type { CapabilityRequest, GrantedCapabilities } from "./capability";

/** A typed event as it reaches a connector, after the airlock. */
export interface AirlockEvent {
  /** Monotonic sequence number; total order across cycles (ADR-0002). */
  readonly seq: number;
  /** Event type, e.g. "page_view", "click", or a site-defined custom name. */
  readonly type: string;
  /** High-resolution capture timestamp (performance.now() time origin). */
  readonly ts: number;
  /**
   * The event payload the connector maps. Open, site-defined shape (OQ3).
   * Read governance for this channel is OQ11 — pinned as pass-through for MVP1
   * only; a broad/compromised connector threat model is deferred to MVP2.
   */
  readonly payload: Readonly<Record<string, unknown>>;
  /**
   * The projection snapshot slice: only the fields the connector declared in
   * `manifest.reads` AND the host policy allows, filtered to declared values
   * (ADR-0003). Default empty. Field-name allowlisting is necessary but not
   * sufficient — value-level PII in an approved field is host-policy-governed
   * (ADR-0003), so the runtime may deliver sanitized values here.
   */
  readonly snapshot: Readonly<Record<string, unknown>>;
}

/**
 * An egress request a connector produces. The connector does NOT send it: it
 * returns it to the runtime, which applies the seal (consent + host-owned
 * endpoint allow-list) and dispatches via the egress seam. Dispatch mechanism,
 * delivery, and the unload path are OQ10.
 */
export interface EgressRequest {
  readonly url: string;
  readonly method?: "POST" | "GET";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | ArrayBufferView;
  /**
   * Hint that this request should be delivered best-effort at page unload
   * (e.g. a closing pageview). How the runtime honors it — and whether such
   * events even reach the connector in time to be mapped — is OQ10.
   */
  readonly unloadCritical?: boolean;
}

/**
 * A connector's static declaration, read by the orchestrator before any event
 * is routed. Default-deny: the connector receives only what it declares and the
 * host policy allows. The declared `endpoints` are advisory; the authoritative
 * allow-list is host-owned (the seal) and a connector cannot widen it.
 */
export interface ConnectorManifest {
  /** Registry id, e.g. "airlock/ga4". */
  readonly name: string;
  /** Event types to route to this connector. */
  readonly events: readonly string[];
  /** Projection snapshot fields this connector reads (ADR-0003). */
  readonly reads: readonly string[];
  /** Mediated capabilities requested (granted subset per host policy). */
  readonly capabilities: CapabilityRequest;
  /** Endpoints the connector intends to emit to (advisory; host allow-list wins). */
  readonly endpoints?: readonly string[];
}

/** The connector implementation. One instance per chamber. */
export interface Connector {
  readonly manifest: ConnectorManifest;
  /** Called once with the mediated capabilities the orchestrator granted. */
  init(caps: GrantedCapabilities): void | Promise<void>;
  /**
   * Map one event to zero or more egress requests. Side effects only through
   * the granted capabilities — never the DOM/network/globals directly. May be
   * async (the wrapped-SDK archetype).
   */
  handle(event: AirlockEvent): EgressRequest[] | Promise<EgressRequest[]>;
}

/** A connector module's default export: a factory the runtime instantiates. */
export type ConnectorFactory = (config: Readonly<Record<string, unknown>>) => Connector;
