---
slice: 042-01 — GET-critical dispatcher + ga4-gtag unload flush
pass: compliance
verdict: pass
reviewer: general-purpose (independent-review, Opus)
reviewed_at: 2026-09-10T19:04:56Z
prompt_source: review.py implementation
---

VERDICT: pass

REASONING:
All 7 acceptance criteria for slice 042-01 are met by the four deliverables and exercised by
meaningful, non-vacuous tests (24/24 green). egress.js gains an additive `requestMapper` GET
path that leaves the legacy POST per-tracker path byte-unchanged (AC1/AC2); airlock.js wires
`requestMapper: createGa4GtagConnector(connectorConfig||{}).handle` for connector==="ga4-gtag"
and narrows the unload gate to `workerMappedGetEgress = connector === "pixel"` so gtag now
wires visibilitychange/pagehide and its pushCritical no longer drops (AC3/AC4); the GET/POST
fetchInit shape is genuinely shared (moved to egress.js, imported by airlock.js). AC5
(witnessed hazard + cross-path parity) and AC6 (governance-strip + consent-drop) are real
witnesses; each new test reds if the feature is removed. No code correctness bugs, no
design-principle violations (extends the blessed OQ10 teardown fast path; consent seal +
governParams still run), no new untracked debt.

SPECIFIC ISSUES:
- (Reconciliation, not a deliverable defect) slice sweep marks refinement-todo.md / inbox.md /
  architecture.md disposition "updated" but rationale cells are "_TODO:_" and the files are
  unchanged — to be executed at reconciliation.
- (Reconciliation) architecture.md:18 now actively stale: still states ga4-gtag "shares
  pixel's workerMappedGetEgress unload posture (ring tail dropped at teardown; correct
  GET-critical-flush deferred)". After this slice gtag flushes its ring tail as a /g/collect
  GET. The four reviewed deliverables contain NO defects.

RECONCILIATION NOTES:
- refinement-todo.md GET-critical item not yet narrowed to pixel-only; inbox.md:17 030-01
  method-option follow-on not yet triaged for the gtag half; architecture.md:18 + OQ16 framing
  need reconciling; rig/parity/transport-report.js fetchInit attribution stale (all deviation-
  log-flagged). AC6 consent-drop relies on consentStrict:true+denied (documented); a pending-
  purpose case would be a stronger witness but is not AC-required.
