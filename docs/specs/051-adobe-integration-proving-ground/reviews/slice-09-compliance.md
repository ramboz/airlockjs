---
slice: 051-09 — one focused Analytics and Target chamber journey
pass: compliance
verdict: fail
reviewer: jig:reviewer (gpt-6.1-sol; task integrated-c-compliance; reviewed commit 341aa6f060b70b3318f38a317dc5036b4b07193c)
reviewed_at: 2026-11-02T22:36:30Z
prompt_source: review.py implementation docs/specs/051-adobe-integration-proving-ground/spec.md 051-09; exact deliverables and supporting plan/ADR in generated prompt SHA-256 a7ff7a7e6e1a1ed897e95e0fdc8c5702a6ebe921489d19bab5111e6210c85875; actual summary SHA-256 02286854d77953240e6f360b146484bbc04895b84355be5c8316e20eafd5029a
---

VERDICT: fail

REASONING:
Checkpoint 341aa6f does not satisfy full C acceptance: the actual preparation producer, protected manifest/handoff, assembler and producer-to-real-inspector witness are absent; 051-09 AC6/7 and completion remain outstanding. The partial reader changes do not warrant implementation qualification, particularly with concrete safety defects and a later independent run reporting 27 failed, 1223 passed and 10 skipped across 20 files. Earlier writer GREEN logs do not resolve that validation conflict or the reported disappearance of retained root R; I performed no execution, retry, restoration or edits.

SPECIFIC ISSUES:
- c-integrated-plan.md:204-214; c-implementation-handoff.md:194-201 — **High:** C's required integrated deliverables and three new suites are missing, as independently confirmed by the named-path search. Reader-only progress does not meet the approved completion bar. Actual journey evidence also remains missing under `docs/specs/051-adobe-integration-proving-ground/slice-09-focused-chamber-journey.md:127-148`.

- probes/adobe-compatibility/supervised-journey-operator.mjs:518-527,535-536 — **High:** The retry marker has a concrete conditional parent-alias write escape. `privateFile` checks the directory by pathname, then separately opens the file; `O_NOFOLLOW` protects only the final component. If W/secrets is replaced with a symlink to R/secrets between those operations, the fixed `adobe-poc-single-retry-20261028.json` creation can land in R. No parent identity is held across creation and directory sync. This is a source-level possibility, **not evidence that it occurred or caused R's absence**.

- probes/adobe-compatibility/supervised-journey-operator.mjs:103-106,132 — **High:** Original-reference validation is not fully descriptor-safe. `SHA.test(value.sha256)` runs without requiring a primitive string, so an otherwise descriptor-valid reference can supply a digest object whose coercion invokes `Symbol.toPrimitive`, `toString` or proxy traps before rejection. The new original-reader API therefore violates the requirement to reject hostile programmatic inputs without invoking them.

- test/adobe-supervised-evidence-roots.test.js:126-132 — **High; `assertion-thin`:** Sixteen role cases assert only `toBeDefined()`. They would still pass if role-specific reading and digest/custody enforcement were replaced by a constant defined object. These cases do not meaningfully establish their claimed pinned-byte behavior or the required changed-original/custody-drift refusals.

- test/adobe-supervised-retry-once.test.js:12,21-23; test/adobe-supervised-evidence-roots.test.js:10-20 — **High:** Non-opt-in regression tests now depend on actual retained private originals, including real filesystem fall-through in the nominally controlled retry fixture. In the independent run, missing originals prevent write/sync/concurrency cases from reaching their intended predicates; those failures cannot establish reservation behavior.

- c-parent-validation.log:8-17,196-197 — **High, unresolved validation/custody gap:** The independent run fails four files, principally on retained-original ENOENT errors. The parent additionally reports the entire named R absent at 2026-11-02T22:25:46.924430Z. Execution-surface comparison and custody reconciliation remain pending; neither deletion nor responsibility is established.

RECONCILIATION NOTES:
Record this as an unqualified partial checkpoint, not successful C or full-slice approval. Preserve both validation results, missing integrated work, historical source/deployment-pin limits, unresolved W no-reset/handoff obligations and outstanding AC6/7. The stop-loss test removes only the historical **stop journal** (`test/adobe-supervised-journey-integration.test.js:561`), not the full prior-job/claim/terminal/journal set.

Bounded cleanup audit: across the 20 listed suite files and their shared preflight/import-tripwire helpers, recursive removals target W/test/.supervised-source-PID (`adobe-supervised-journey-operator.test.js:144-148`), W/test/.supervised-journal-PID (`adobe-supervised-corrections.test.js:21-30`), or newly allocated `mkdtemp` directories (`adobe-stock-wire.test.js:98-120`; `adobe-preflight-harness.js:23-25,83-84`). Inspected unlink/symlink mutations target files within those temporary fixtures; integration writes/deletions are Map-backed. No inspected cleanup explicitly targets R, and the marker-write race above is not a removal path. This bounded finding does not prove retained custody continuity or exclude relocation, execution-surface mismatch or uninspected cleanup.
