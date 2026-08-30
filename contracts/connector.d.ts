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
 * A consent purpose (ADR-0007). The starter taxonomy is the Consent Mode v2
 * four, extended with `functional` / `personalization` as connectors need them.
 * The set is intentionally small and sits behind a consent-input seam, so a
 * taxonomy revision is a driver change, not a contract break — hence a widenable
 * string union rather than a closed enum. ADDED 012-04 (additive-only).
 */
export type ConsentPurpose =
  | "analytics_storage"
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization"
  | "functional"
  | "personalization"
  | (string & {});

/**
 * The purpose annotation for a connector's declared I/O (ADR-0007), tagging each
 * declared endpoint / cookie / read (and egress overall) with the consent
 * purpose(s) it serves, so a grant resolves per declared I/O — not per connector
 * (ADR-0007 Recommended Decision; kill-criterion: coarse per-connector tagging
 * moves to per-capability/per-endpoint, which this shape already permits).
 *
 * DECLARED, NOT ENFORCED in MVP2: this is disclosure only. The grant resolver
 * that reads this vector — ADR-0006's `granted = declared ∩ host-policy ∩
 * consent/user-choice` law — is MVP3 (ADR-0006 §Staging); nothing gates on it
 * yet (the seal is unbuilt). Present now so MVP3 enforcement is a switch-flip,
 * not a breaking retrofit. ADDED 012-04 (additive-only).
 */
export interface ConnectorPurposes {
  /** Purpose(s) the connector's egress serves overall. */
  readonly egress?: readonly ConsentPurpose[];
  /** Purpose(s) each declared endpoint serves, keyed by endpoint. */
  readonly endpoints?: Readonly<Record<string, readonly ConsentPurpose[]>>;
  /** Purpose(s) each declared cookie/storage capability serves, keyed by name. */
  readonly cookies?: Readonly<Record<string, readonly ConsentPurpose[]>>;
  /** Purpose(s) each declared projection read serves, keyed by read path. */
  readonly reads?: Readonly<Record<string, readonly ConsentPurpose[]>>;
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
  /**
   * Consent-purpose annotation for the declared I/O (ADR-0007). Declared, NOT
   * enforced in MVP2 — disclosure only; the grant resolver is MVP3. See
   * ConnectorPurposes. Optional + additive: pre-012-04 manifests (GA4) omit it.
   */
  readonly purposes?: ConnectorPurposes;
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
