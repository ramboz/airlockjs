---
status: ABANDONED
dependencies: [060-03, 060-04, 060-06, 060-07]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

> Abandoned 2026-11-12: rescoped by spec 066 into an M-slice (see spec 066 section 8). History kept.

## Slice 060-08 - Preserve code-less event and metadata collection

**Goal:** An operator enables the owned source's automatic events and saved
setup rules, and the adopter retains their collection and site behavior.

**DoR:**
- [ ] Routing, policy and manual/automatic identity journeys 03/04/06/07 exist.
- [ ] Owner supplies independent autoConfig, automatic-event, automatic-matching
      and Event Setup Tool settings/rules with pinned native provenance.
- [ ] Safe button/form/structured-metadata fixtures and precise bounded DOM/
      configuration capabilities are reviewed; no real customer form is used.

**Acceptance Criteria:**

1. The adopter's actual replacement reproduces pinned automatic standard events,
   button-click/page metadata and Event Setup Tool rule outcomes, with
   `autoConfig`/automatic-event toggles independently tested. An explicit manual
   event emitted in place of missing automatic behavior does not pass.
2. OpenGraph/Schema.org and supported native metadata, labels, nested click
   targets, changed content, dynamic DOM and saved URL/element rules preserve
   native inputs, encoding, trigger timing and event fan-out. Discover actual
   native rules instead of inventing private selector/configuration syntax.
3. Manual plus automatic triggers for the same action preserve observed
   duplicates/suppression; CAPI deduplication is not assumed to remove repeated
   browser events. Automatic matching interactions use 060-07's value proof.
4. Approved root/element/field references and finite snapshots are captured by
   the host; rule interpretation stays in the chamber. Ordinary site callbacks,
   default actions, layout and navigation remain unchanged. No ambient DOM,
   raw-node transfer, full mutation stream or remote main-thread rules.
5. Per-Pixel remote configuration is bounded and provenance-qualified.
   Removing a rule, blocked config, unknown module/field or stale pin produces
   visible unsupported/inconclusive evidence, not an empty successful event set.
6. Revoke/deny/stale-consent and forbidden field/root controls demonstrate no
   unauthorized collection/dispatch, while separately paired positive controls
   still detect native automatic events under C1-C9.
7. Mutated labels/rules/values, missed or extra events, duplicate sends and site
   callback/DOM effects are independently discriminable. Record measured
   main-thread observer/snapshot cost for 060-12; no unmeasured broad observer
   is justified by the full-support requirement.

**DoD:**
- [ ] Each discovered automatic family/rule has native positive and failing controls.
- [ ] Targeted site-callback/browser/chamber/capability/contract tests and lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Rule/configuration provenance, feature interactions and remaining unknowns
      are operator-visible and preserved in the completeness ledger.

**Anti-horizontal-phasing check:** The operator uses real owned code-less
collection rules and sees their browser/wire outcomes, not only a DOM observer.

## Assumptions

- Unverified: native automatic-event/setup/metadata rules can be discovered and
  interpreted inside finite mediated capture without violating site behavior.
- Unverified: the required remote configuration and plugin effects can be
  reproduced without the native runtime or privileged remote code execution.

### Close-out (post-DONE)

- [ ] Parent records reviewed capability decisions, board and durable learnings.

### Deviation log (after reconciliation)

Not implemented; no Event Setup Tool, automatic event or metadata support is claimed.

### Reconciliation sweep

Pending implementation: configuration/rule and adopter docs, DOM/callback
effects, privacy policy, identity interactions, observer costs and support rows.

## Release log

- 2026-11-12 — released claim from (unclaimed): Rescoped by spec 066 (2026-11-12)
