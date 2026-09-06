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
 * NOT FROZEN at 1.0 (ADR-0017) — do not rely on these being final:
 *  - Multi-chamber coherence of the synchronous cookie surface for the
 *    wrapped-SDK archetype (OQ9's remaining axis). The single-chamber
 *    sync-cache (`GrantedCapabilities.cookies.sync`, capability.d.ts, shipped
 *    012-01) is frozen; cross-chamber coherence of that cache is not.
 *  - The event-payload SCHEMA (OQ3): `AirlockEvent.payload` below is frozen as
 *    a pass-through container; its shape is site-defined and not frozen.
 *
 * RESOLVED since this interface was first pinned (present-tense as of 1.0):
 *  - How an egress request is dispatched — settled by ADR-0004 (the two-path
 *    fire-and-forget model) and ADR-0010 (the wrapped-SDK round-trip
 *    `caps.egress.dispatch`, capability.d.ts). This interface still pins only
 *    the egress REQUEST shape, not the dispatch mechanics — see the
 *    `EgressRequest` docstring below for the current state.
 *  - Event-payload read governance beyond the projection snapshot (OQ11):
 *    resolved by ADR-0012 / spec 019-01's host-owned denylist — see the
 *    `AirlockEvent.payload` docstring below.
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
   * The event payload the connector maps. A host-owned sensitive-field
   * denylist governs it before it reaches a connector (OQ11, resolved —
   * ADR-0012 / spec 019-01's `governPayload`). The payload's SHAPE remains
   * open and site-defined, and is NOT FROZEN at 1.0 (OQ3 — refinement-todo.md).
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
 * endpoint allow-list) and dispatches via the egress seam — resolved as
 * `fetch(url, { keepalive: true })` on the main thread (ADR-0004); the
 * wrapped-SDK round-trip variant is `caps.egress.dispatch` (ADR-0010,
 * capability.d.ts). The canonical unload/last-beacon path is the separate
 * `pushCritical()` fast path (push-api.md), which bypasses this
 * connector-returned request entirely.
 */
export interface EgressRequest {
  readonly url: string;
  readonly method?: "POST" | "GET";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string | ArrayBufferView;
  /**
   * Hint that this request should be delivered best-effort at page unload
   * (e.g. a closing pageview). The resolved unload strategy (ADR-0004) is a
   * distinct main-thread fast path, `pushCritical()` (push-api.md), which
   * bypasses the worker/connector `handle()` path entirely for the canonical
   * last-beacon case; this hint is declared but not read by the runtime on
   * the async `handle()`-returned path.
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
 * DECLARED AND GATED: the seal now enforces ADR-0006's `granted = declared ∩
 * host-policy ∩ consent/user-choice` law — shipped for GA4 (017-03's
 * hold-pending / strict-drop seal) and alloy (ADR-0013 / spec 020's XDM
 * governance); nothing here is "unbuilt" any more. The enforcement point
 * currently reads each caller's own `egressPurposes` config
 * (adapters/eds/index.js), which mirrors — but does not yet mechanically
 * read — this manifest's `egress` vector (a documented, unclosed
 * mirror-drift residual; refinement-todo.md). ADDED 012-04 (additive-only).
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
   * Consent-purpose annotation for the declared I/O (ADR-0007). The seal
   * enforces on it (ADR-0006's grant law) for the connectors that wire a
   * matching `egressPurposes` config — see ConnectorPurposes. Optional +
   * additive: an omitted `purposes` means no consent-purpose gate is wired
   * for that connector's I/O.
   *
   * IMPORTANT (external connector authors): enforcement today reads the
   * host-wired `egressPurposes` config, NOT this manifest field directly, so
   * declaring `purposes` here WITHOUT the host wiring the matching config
   * yields NO purpose gate on that connector's egress. Closing that mirror so
   * the manifest field gates mechanically is a tracked additive follow-on
   * (refinement-todo; a tightening within this frozen shape, no major break).
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
