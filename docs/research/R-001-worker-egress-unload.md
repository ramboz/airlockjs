---
status: CONCLUDED
topic: fetch keepalive semantics + dedicated-worker lifetime at page unload
created: 2026-08-25
related:
  - ../decisions/adr-0002-event-descriptor-cycle-semantics.md
  - ../reviews/2026-08-25-mvp1-architecture-review.md
---

# R-001: Worker egress and the unload path

## Question

Can a dedicated Web Worker own *all* analytics egress — including the last
beacon of a session — and what are the real semantics of the `fetch`
`keepalive` limits the architecture doc cites (~64KB cap)?

## Sources / findings

Primary sources: WHATWG Fetch Standard, MDN, Chrome Page Lifecycle API docs,
HTML spec, Chromium issue tracker. Verified 2026-08-25 (fact-check agent,
cited in the arch-review Verification appendix A).

- **`fetch(..., {keepalive:true})` works in dedicated workers** (on
  `WindowOrWorkerGlobalScope`). CONFIRMED.
- **`navigator.sendBeacon` is NOT available in workers** — never on
  `WorkerNavigator`, removed from the Beacon spec, never implemented in any
  browser. The doc's claim "keepalive works from workers, unlike sendBeacon"
  is accurate. CONFIRMED (keep).
- **The 64 KiB body limit is an AGGREGATE budget**, not per-request: the spec
  sums the new request's `contentLength` with `inflightKeepaliveBytes` across
  all in-flight keepalive fetches in the fetch group. Exceeding it returns a
  network error surfacing as a `TypeError` **indistinguishable from a real
  network failure**. Chrome adds count caps: >255 keepalive requests total or
  >9 per renderer process are rejected. (fetch.spec.whatwg.org; whatwg/fetch
  #1816, #679; MDN RequestInit)
- **Unload events are main-thread-only.** `visibilitychange`→`hidden`,
  `pagehide`, `unload` fire on the main thread; a dedicated worker never
  receives them and is terminated with its owner document (HTML spec: orphaned
  dedicated workers). REFUTED: a worker cannot reliably initiate the final
  beacon.
- **In-flight keepalive survival after teardown is best-effort, not
  guaranteed**: ~30s cap; Chrome aborts once context is destroyed and the
  response received; a standing Chromium bug documents non-sent keepalive
  requests (issues.chromium.org/416091464). Anything still queued inside the
  worker at termination is lost.
- **The recommended last-moment pattern is main-thread-owned**: send at
  `visibilitychange`→`hidden` (Chrome Page Lifecycle guidance; `unload` is
  "extremely unreliable, especially on mobile").
- A dedicated worker is the wrong primitive for "survives the page"; the
  **Service Worker** is the platform context designed to outlive a document
  and perform background egress — relevant to the already-roadmapped SW
  chokepoint enhancement.
- bfcache interaction: sends at `pagehide`/`hidden` and in-flight requests
  can affect back/forward-cache eligibility; a bfcache-restored page does not
  re-run initialization.

## Open questions

- MVP1 unload-flush shape: main thread beacons directly at `hidden`, or the
  worker pre-stages ready-to-send payloads back to the main thread? (Taken up
  by ADR-0002's egress options.)
- How the inspector (OQ7) reports "sent-unknown" given keepalive failures are
  opaque `TypeError`s.

## Conclusion

The thesis one-liner ("all egress behind the airlock") cannot hold for the
end-of-session beacon: egress is a split responsibility — worker owns the
normal path, the main thread owns/triggers the final flush at
`visibilitychange`→`hidden`. Emission must bound the *concurrent in-flight*
keepalive total (aggregate 64 KiB + Chrome count caps), not just per-cycle
size. Both requirements were folded into the cycle-semantics decision.

Promoted to: [ADR-0002](../decisions/adr-0002-event-descriptor-cycle-semantics.md)
(egress Option C + backpressure); arch-review finding R2.
