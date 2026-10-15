---
status: DRAFT
dependencies: [adr-0033]
last_verified:
frame_review: true
arch_review: true
---

## Slice 058-01 - Local recorder and no-send qualification

**Goal:** An operator runs one bounded command and receives a truthful report
showing whether a real local receiving sink, recorder and declared no-send
boundary agree.

**DoR:**
- [ ] ADR-0033 is accepted after frame review; this slice's frame is reviewed.
- [ ] Inspect existing recorder and browser-test prior art before selecting code.
- [ ] Pin supported browser, declared transport set, count/byte/time limits and
      private-output shape before implementation; do not claim untested breadth.

**Acceptance Criteria:**

1. **Real local positive.** A command starts a loopback-only sink and isolated
   browser, exercises synthetic GET/query and POST/body requests, and emits
   the spec's JSON report with exit 0 only when the sink-received method, URL
   multiplicity, original body and recorded response relationships agree.
   Qualification names `local_network`; vendor/chamber/outcome claims stay false.
2. **Pre-execution guard.** Guarding is active before fixture scripts/navigation.
   A finite declared test matrix attempts fetch, image, XMLHttpRequest and beacon
   traffic plus redirects to an unapproved destination. The command observes
   the attempts while an independent local tripwire receives zero forbidden
   requests. Only explicitly declared local resources are allowed.
3. **Unsupported transport is visible.** Declare treatment of frames, dedicated
   workers, service workers, WebSockets and browser/background requests. A surface
   not positively qualified cannot be counted as protected. The command refuses
   an invocation requesting a broader surface than it can demonstrate.
4. **No completion race.** The recorder has a finite observation cutoff and
   drains all accepted asynchronous reads before exposing an immutable snapshot.
   Delayed reads, late responses, transport aborts, unreadable bodies and a
   never-settling read are individually classified. No request vanishes because
   a new capture promise arrived during a fixed Promise.all snapshot.
5. **Complete local branches.** Include response-linked fan-out and an actual
   local HTTP redirect whose target loses its ownership marker. Record each
   request/response/redirect link and distinguish the guard's intervention from
   native behavior. Do not authorize an entire host merely to recover a marker.
6. **Non-vacuity.** An expected-positive scenario with zero observed requests,
   a removed listener, wrong body, missing response, dropped branch or failing
   tripwire cannot exit 0. Complete material mismatches are `nonconformant`;
   capture/provenance gaps are `inconclusive`. Expected-zero controls need a
   separately passing positive fixture.
7. **Safe operator output.** Invalid input is rejected visibly with exit 3.
   Public stdout/stderr never contains raw request values, cookies, identities
   or fixture secrets. Explicitly chosen private capture files are owner-only;
   existing files are not silently overwritten and no unrelated directory is read.
8. **Bounded cleanup.** Count/body/response/aggregate-byte/settle limits are
   enforced before unbounded retention. On success, error or timeout, this run's
   browser, sink and listeners close. No global browser, process or profile is
   stopped. Importing a module performs no network or browser work.

**DoD:**
- [ ] Every AC has a witnessed failing control and passing intended behavior.
- [ ] Existing targeted recorder tests, new tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Usage/elapsed-work checkpoint and exact validation receipts are retained.
- [ ] The operator guide distinguishes local qualification from vendor proof.

**Anti-horizontal-phasing check:** The operator gets a complete guarded local
request-to-sink-to-report journey, not an intermediate parser or library.

### Close-out (post-DONE)

- [ ] Regenerate/check the spec board and consolidate durable learnings.

### Deviation log (after reconciliation)

Not implemented.

### Reconciliation sweep

Pending implementation; no closed records or Adobe source/evidence changes.
