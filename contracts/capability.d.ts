/**
 * Airlock capability API — pinned contract (drive-order step 5).
 *
 * The orchestrator grants a connector a bounded set of mediated capabilities. A
 * connector has NO ambient authority (AD-5); it can only do what it was granted,
 * default-deny throughout. See ./connector.d.ts.
 *
 * PINNED for MVP1 (grounded):
 *  - mediated cookie get/set (GA4 needs client_id persistence — R-002)
 *  - mediated egress REQUEST via Connector.handle()'s return value; the seal
 *    (consent + host-owned endpoint allow-list) gates it (AD-9)
 *  - CWV-safe DOM injection (reserveSpace / insertAfterInteraction — AD-5)
 *  - projection snapshot declaration + default-deny filtering (ADR-0003)
 *
 * DEFERRED — sketched here, finalized with the resolving open question:
 *  - SYNCHRONOUS cookie/storage semantics for the wrapped-SDK archetype across
 *    chambers, and whether that needs SharedArrayBuffer (OQ9). The async
 *    get/set below serves MVP1's single first-party connector; a stock vendor
 *    SDK that reads document.cookie synchronously (R-004) needs a sync-cache
 *    shim whose multi-chamber coherence is unproven — NOT exposed here yet.
 *  - The egress DISPATCH mechanism (OQ10): this API pins the request + the
 *    seal, not the send.
 *  - Event-payload read governance (OQ11): the payload reaches the connector via
 *    AirlockEvent.payload; a denylist model is deferred, coupled to OQ3.
 *  - decisions-as-data / host-applied personalization for the wrapped-SDK
 *    archetype (renderDecisions:false — R-004): sketched as `decisions` below.
 */

/** What a connector requests in its manifest (default-deny; host grants a subset). */
export interface CapabilityRequest {
  /** Cookie names it may read/write (e.g. GA4's client_id cookie). */
  readonly cookies?: readonly string[];
  /** In-chamber key/value persistence. */
  readonly storage?: boolean;
  /** May produce egress requests (subject to the seal). */
  readonly egress?: boolean;
  /** May request CWV-safe DOM injection. */
  readonly dom?: boolean;
  /** May request personalization decisions as data (wrapped-SDK; deferred). */
  readonly decisions?: boolean;
}

/** The mediated capabilities actually granted, passed to Connector.init(). */
export interface GrantedCapabilities {
  /**
   * Mediated cookie access. MVP1: ASYNC get/set backed by the orchestrator on
   * the main thread. A synchronous variant for stock vendor SDKs is OQ9 and is
   * intentionally absent here so no connector is written against an unproven
   * shape.
   */
  readonly cookies?: {
    get(name: string): Promise<string | null>;
    set(name: string, value: string, opts?: CookieOptions): Promise<void>;
  };
  /** In-chamber mediated key/value storage (not real localStorage). */
  readonly storage?: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  /**
   * CWV-safe DOM injection — the ONLY DOM path (AD-5). Fulfilled by the
   * orchestrator on the main thread so injected content is layout-stable by
   * construction. Trusted-Types-compatible (the EDS boilerplate ships a
   * default TT policy — R-005), so injection flows through it.
   */
  readonly dom?: {
    reserveSpace(spec: ReserveSpaceSpec): Promise<DomHandle>;
    insertAfterInteraction(spec: InsertSpec): Promise<DomHandle>;
  };
  /** Personalization decisions delivered as data for the host to apply.
   *  Deferred shape — finalized with the MVP2 wrapped-SDK connector. */
  readonly decisions?: {
    fetch(scopes: readonly string[]): Promise<readonly Decision[]>;
  };
}

export interface CookieOptions {
  readonly maxAge?: number;
  readonly path?: string;
  readonly domain?: string;
  readonly sameSite?: "strict" | "lax" | "none";
  readonly secure?: boolean;
}

/** CWV-safe injection shapes. Finalized with UC-1 / the eager-window work (R-005). */
export interface ReserveSpaceSpec {
  readonly selector: string;
  /** Reserve height up front so the later insert causes no layout shift. */
  readonly minHeight: number;
}
export interface InsertSpec {
  readonly selector: string;
  readonly html: string;
  readonly position: "before" | "after" | "append";
}
export interface DomHandle {
  readonly id: string;
  release(): void;
}

/** A personalization decision (data, not applied). Deferred detail. */
export interface Decision {
  readonly scope: string;
  readonly content: unknown;
}
