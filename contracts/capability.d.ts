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
 *    archetype (renderDecisions:false — R-004): sketched as `decisions` below,
 *    FINALIZED in slice 012-03 (push `deliver` reconciled with the `fetch` sketch;
 *    `reserveSpace` / `DomHandle.fill` host-apply implemented — adapters/eds/dom.js).
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
    /**
     * SYNCHRONOUS cookie surface for the wrapped-SDK archetype (OQ9 / R-004),
     * ADDED in slice 012-01 AC3 — the async `get`/`set` above are unchanged
     * (additive-only; AC6 signature stability). A stock vendor SDK (alloy) reads
     * `document.cookie` synchronously (the getApexDomain/getTld apex probe at
     * first command, then identity reads); a worker has no `document.cookie`, so
     * the chamber serves those from a synchronous in-worker string cache seeded
     * at boot and reconciled to the broker's authoritative jar asynchronously
     * (no SharedArrayBuffer — AD-4). The chamber's `document.cookie` shim
     * delegates here.
     *
     *  - `readSync()` returns the full cookie string (the `document.cookie`
     *    getter shape).
     *  - `writeSync(setCookie)` takes a `name=value; attrs` string (the
     *    `document.cookie` setter shape), updates the cache synchronously, and
     *    queues the async write-back.
     *
     * Multi-chamber coherence of this cache is the remaining OQ9 axis (011 /
     * 012-02), not resolved by exposing the surface.
     */
    readonly sync?: {
      readSync(): string;
      writeSync(setCookie: string): void;
    };
    /**
     * The async write-back SINK (main thread), ADDED in slice 014-01: receives the
     * Set-Cookie string the chamber's `sync.writeSync` queued (012-01 AC3) and
     * reconciles it into the broker's authoritative jar. Co-equal to
     * `egress.dispatch` — an orchestrator-provided method the wrapped-SDK host
     * (`core/wrapped-sdk-host.js`) calls on the main thread; documented here so it is
     * not an undocumented parallel (014-01 arch-review). NOTE: origin-incompatible
     * attribute handling is the **origin's** concern — a localhost/http rig strips
     * `Secure`/`SameSite=None`/`Domain` (a plain-http jar rejects them), whereas a
     * **production https** jar PRESERVES them (stripping `Secure` on https is a
     * downgrade — tracked as a 014 production-cookie-semantics follow-up).
     */
    reconcile?(setCookie: string): void;
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
   * construction. CORRECTION (spec 018-01): the EDS boilerplate's default
   * Trusted-Types policy makes the write COMPATIBLE (it does not throw under
   * `require-trusted-types-for 'script'`, R-005) — that is a compatibility
   * property, not a sanitization one (the default policy does not strip
   * `on*` handlers or active markup for the `Element innerHTML` sink,
   * probes/eds-testbed/scripts/scripts.js:61-78). The mediated
   * implementation (`adapters/eds/dom.js`) therefore runs its OWN sanitizer
   * before the write, then assigns the result through a Trusted-Types
   * policy — conservative defense-in-depth, not a complete XSS guarantee.
   */
  readonly dom?: {
    reserveSpace(spec: ReserveSpaceSpec): Promise<DomHandle>;
    insertAfterInteraction(spec: InsertSpec): Promise<DomHandle>;
  };
  /** Personalization decisions delivered as data for the host to apply.
   *  FINALIZED in slice 012-03 (the MVP2 wrapped-SDK connector): the deferred
   *  `fetch(scopes)` PULL sketch is reconciled with alloy's actual flow. alloy
   *  (renderDecisions:false — R-004) does not answer a separate fetch; it PUSHES
   *  the propositions on the `sendEvent` interact response. So the connector calls
   *  `deliver(decisions)` from inside the chamber and the orchestrator hands them
   *  to the host (which applies them via `dom.reserveSpace`). `fetch` is retained
   *  (additive-only; existing shape byte-identical) for a future pull consumer. */
  readonly decisions?: {
    fetch(scopes: readonly string[]): Promise<readonly Decision[]>;
    /** ADDED 012-03: push the decisions alloy returned across the chamber
     *  boundary as DATA (the chamber has no DOM — the host applies them). */
    deliver(decisions: readonly Decision[]): void;
  };
  /**
   * Round-trip egress dispatch for the wrapped-SDK archetype — ADDED in slice
   * 014-01 ([ADR-0010](../docs/decisions/adr-0010-roundtrip-egress-capability.md):
   * "Wrapped-SDK round-trip egress as a declared-and-gated capability"),
   * additive-only; the pinned MVP1 fire-and-forget model (`Connector.handle()`
   * returning `EgressRequest[]`, response never read — see connector.d.ts) is
   * UNCHANGED and coexists with this surface. The two egress models do NOT
   * unify (ADR-0010 Option C, rejected): `EgressRequest` carries no response
   * channel, and the wrapped SDK must read one.
   *
   * A stock vendor SDK (alloy, R-004) issues its OWN worker-side `fetch`; the
   * chamber INTERCEPTS it (chamber-internal transport, unchanged by this
   * slice) and the orchestrator must post the RESPONSE back so the SDK can
   * read it synchronously (e.g. persist a server-assigned identity) — a shape
   * `EgressRequest` cannot carry. `dispatch` is the documented, contract-home
   * capability surface for that round-trip: declared here (this ADR) AND
   * gate-able — the orchestrator's OWN implementation of `dispatch` is the
   * single chokepoint a future seal gates `req` against the connector
   * manifest's declared `endpoints` / `purposes` (declared-AND-gated, not
   * either/or). This slice lands the gate-able surface, NOT the teeth — the
   * seal itself is unbuilt (a later MVP3 enforcement spec).
   */
  readonly egress?: {
    dispatch(req: EgressDispatchRequest): Promise<EgressDispatchResponse>;
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
  /** ADDED 012-03: fill the PRE-RESERVED box with the decision content. The box
   *  was sized at reserve-time (before paint), so a fill of content <= the reserve
   *  causes no reflow (UC-1 no-flicker). Optional (additive-only): a handle from a
   *  future insert path need not implement it. */
  fill?(content: string): void;
}

/** A personalization decision (data, not applied). Deferred detail. */
export interface Decision {
  readonly scope: string;
  readonly content: unknown;
}

/**
 * The round-trip egress request descriptor (ADR-0010 / slice 014-01) — a
 * plain, structured-clone-safe object (not a WHATWG `Request`), settled
 * during 014-01 implementation against what the chamber's fetch-interception
 * actually hands over (ADR-0010 Open questions).
 */
export interface EgressDispatchRequest {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

/**
 * The round-trip egress response descriptor (ADR-0010 / slice 014-01) — the
 * wrapped SDK reads this synchronously (e.g. to persist a server-assigned
 * identity), unlike the fire-and-forget `EgressRequest` model, which never
 * reads a response.
 */
export interface EgressDispatchResponse {
  readonly status: number;
  readonly statusText?: string;
  readonly headers?: Record<string, string>;
  readonly body: string;
}
