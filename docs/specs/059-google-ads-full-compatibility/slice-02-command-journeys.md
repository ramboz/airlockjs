---
status: DRAFT
dependencies: [059-01]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 059-02 - Command routing and callback journeys

**Goal:** An integrator can retain the complete supported Google Ads gtag calling
pattern while the chamber routes correct values and preserves application callbacks.

**DoR:**
- [ ] 059-01 is DONE; C1-C3 and qualified 058 layers cover the expanded cases.
- [ ] Pin native semantics for js/config/set/event/get/consent entry, argument
      forms, queue readiness/reentrancy, named data layer, mutation-after-enqueue,
      repeated config and supported Ads get fields; unknowns block their cases.
- [ ] Supply owned destination/label/group and alias configurations privately;
      review callback/queue ownership without changing frozen push/handle types.

**Acceptance Criteria:**

1. Commands queued before and after readiness, initialization date input,
   object/key-value set forms and renamed data layers produce the native
   observed state/request results. Do not overwrite an existing shared queue
   or infer every gtag ordering rule from GTM's FIFO documentation.
2. Destination config, global set and event scopes are independent; event
   overrides config which overrides global without mutating the other scopes.
   Later scope changes, arrays/objects, omission and supported invalid-input
   cases match the pinned native behavior and remain operator-observable.
3. AW/GT aliases, labels, string/array send_to, default/custom groups, command
   ordering, unconfigured targets and duplicate membership have discriminable
   target/value results. Do not assume one command equals one request or
   silently deduplicate a native-required fanout.
4. get invokes the correct host callback with actual supported value or unset
   result, timing and count. Unsupported Ads fields remain blocking discovery;
   GA4 session/client fields cannot be promised based on a shared reference table.
5. event_callback/event_timeout, multiple-destination completion, consent-
   blocked events, slow/offline transport, worker failure and immediate link/form
   navigation preserve the native application outcome. Callback handles convey
   correlation, not arbitrary serialized functions or backend-success claims.
6. Consent commands enter the same governed state/queue path and expose precise
   ordering inputs to 059-03. Unknown/reentrant calls, late data or failed
   dispatch do not silently turn into dropped measurement with a success result.
7. C1 comparisons run the actual isolated worker and all applicable host/response
   effects. Wrong precedence, missing/extra target, callback duplication, lost
   queue input and empty-reference mutations are rejected or inconclusive.
8. The integrator sees target/scenario-specific diagnostics and evidence-layer
   results without private values. Complete command/callback paths meet C3;
   standalone execution uses no native runtime or hidden GTM fallback.

**DoD:**
- [ ] Every command, scope, routing and callback case has a qualified positive
      and witnessed failing control; targeted tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Operator command-compatibility documentation records exact supported
      references and all blocking unknowns; no full-support inference from a subset.
- [ ] Deviation and reconciliation records are completed after implementation.

**Anti-horizontal-phasing check:** Existing integrator calls drive correct
end-to-end measurement and page navigation, not merely a new command parser.

## Owner-directed offline experiment - 2026-10-29

The explicit construction direction permits an opt-in experimental subset,
without advancing this DRAFT slice or its dependencies. The standalone Google
prototype can retain global and config values for three conversion parameters
and apply event-over-config-over-global precedence through its first-party
worker and loopback receiver. The exact local rules, including `undefined`,
are described in the [prototype guide](../../../connectors/google-ads/CONVERSION-PROTOTYPE.md);
they are assumptions for construction, not native observations. Native scope
and queue semantics, callbacks, routing fanout, browser behavior, complete wire,
production cutover and the acceptance criteria above remain unqualified.

## Assumptions

- Unverified: all required Ads get/queue/callback edge semantics can be
  independently distinguished under pinned native configurations.
- Unverified: callback and mixed-queue ownership can preserve synchronous
  application behavior within the reviewed mediated contract and C3.

### Close-out (post-DONE)

- [ ] Parent checks the board, command documentation and durable learnings.

### Deviation log (after reconciliation)

Not implemented; no review or deviation evidence yet.

### Reconciliation sweep

Pending implementation; shared interfaces and authorities remain unchanged.
