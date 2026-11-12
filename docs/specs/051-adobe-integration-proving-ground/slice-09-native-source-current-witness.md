# 051-09 current native source witness

This witness describes the native source on `fresh-pair-source`, including
the safety-close repair after candidate `c49dde8e360b70bf2e26d61337a8d3dee4a1ac9b`.
It is a draft for the remaining independent reviews. It does not replace the earlier
[stopped source](slice-09-native-source-stopped-witness.md) or
[publication-guard](slice-09-native-publication-guard-witness.md)
checkpoint records.

The [frame PASS](../../decisions/reviews/adr-0051-frame-critique.md) at
2026-11-05T01:59:57Z covers the proposed contract at
`b3fba2770ad11a1889477cdd60ccff24cf1f7906`. It is not a code review or
owner acceptance. ADR-0051 remains Proposed. Full 051-09 remains
IN_PROGRESS.

## Candidate and review state

The candidate has a fixed START and STOP interface, private job and plan
binding, a home-derived browser bundle manifest, a foreground producer and
bounded closure paths. The unconditional executable-coverage refusal from
the stopped checkpoint has been removed. The real path still requires the
accepted decision and separately bound records. Controlled tests substitute
those inputs; they do not supply physical authority.

The independent source compliance review of
`315f598a912ac3ad3984a65b0365c2e8508e8d74` returned NEEDS-CHANGES at
2026-11-05T02:45:12Z. Its
[supplemental adverse record](reviews/slice-09-fresh-native-source-compliance-adverse-315f598.md)
preserves the supplied body byte for byte. It found an ordinary close
deadline propagation gap and missing numerical inventory boundary tests.
The candidate adds a close-bound check immediately before browser-server
close and carries the same wall and monotonic limits into publication and
lock operations. It also adds the missing inventory tests and resolves six
targeted source-lint errors. The same reviewer returned
[source compliance PASS](reviews/slice-09-fresh-native-source-compliance-pass-c49dde8.md)
on `c49dde8` at 2026-11-05T14:43:31Z. The reviewer did not execute the
writer-reported tests. A separate
[craft review](reviews/slice-09-fresh-native-source-craft-adverse-c49dde8.md)
returned NEEDS-CHANGES on `c49dde8` at 2026-11-05T14:49:06Z. It found
that safety-close result publication and unlock could continue after that
close's own deadline.

The successor repair retains the safety close's wall and monotonic deadline
in the invocation guard used by result publication and lock release. Its
controlled tests cover successful and failed closes near the bound and
filesystem operations crossing it. The same reviewers passed
[compliance](reviews/slice-09-fresh-native-source-compliance-pass-4284d9e.md)
at 2026-11-05T14:57:32Z and
[craft](reviews/slice-09-fresh-native-source-craft-pass-4284d9e.md) at
2026-11-05T14:58:09Z on `4284d9e9e43f4e813ed33b8c3b58431983548bdf`.
The independent [architecture review](reviews/slice-09-fresh-native-source-arch-pass-4284d9e.md)
passed at 2026-11-05T15:07:17Z on the same candidate. These reviews did not
run the writer's checks. Documentary reconciliation and the parent
mechanical check remain open. No overall source safety PASS is claimed.

## Controlled checks

Two ordinary-close scenarios were observed failing before the repair and
passing afterward: a context close reaches the bound before the server
close, and an unresolved close reaches its own bound before qualification
ends. Synthetic clock tests also exercise the wall and monotonic close
limits on lock and publication primitives.

Six synthetic inventory tests exercise 8192 entries, 1 GiB per file and
4 GiB total, at the exact limit and one beyond it. They use filesystem and
file-hash doubles and a reused small buffer. Removing the three numerical
guards made the corresponding over-limit tests fail; the guards were
restored. No actual browser cache or large file was used.

The final focused run passed 163 tests across 13 files using one worker and
a 90-second test timeout. An earlier run concurrent with lint passed 162
and timed out one source-binding test at 20 seconds. Four source files
passed an explicit Node-globals ESLint configuration with zero errors and
warnings. The repository's normal lint configuration ignores these probe
files; this check removed that standalone ignore only for the temporary
invocation. Focused test lint, source syntax checks and the commit hook also
passed.

For the safety-close repair, twelve controlled result-publication and
unlock cases first failed against `c49dde8`: both successful and failed
close outcomes crossed the wall or monotonic close limit during a file open,
write or lock check. The expanded tests cover equality, one millisecond
after and successful completion one millisecond before the limit. They also
check the bound immediately before the close call. The final focused run
passed 191 tests across the same 13 files, using one worker and a 90-second
timeout. Explicit four-file source lint reported zero errors and warnings;
test lint, source syntax and diff checks passed.

## Source reconciliation draft

This draft is limited to the source checkpoint. It does not advance the
051-09 lifecycle or replace the full-slice reconciliation.

### Deviation log

- The initially stopped native source refused START before job reads because
  executable coverage was incomplete. A later source frame specified the
  fixed browser manifest, initial invocation bounds and finite descriptor
  cleanup. The candidate implements that direction without accepting the
  proposed decision or granting physical authority.
- Compliance on `315f598` found the ordinary-close bound and inventory test
  gaps. The `c49dde8` repair passed its scoped compliance backedge. Craft on
  `c49dde8` then found the separate safety-close bound gap. The `4284d9e`
  repair passed scoped compliance and craft backedges. The adverse verdicts
  remain part of the record for their original checkpoints.

### Reconciliation sweep

| Surface | Disposition |
|---|---|
| Native source interface and architecture | Updated for the fixed source boundary and its remaining gates. |
| Current and earlier source witnesses | Current witness updated; stopped and publication-guard records preserved as historical evidence. |
| Reviews | Actual source compliance, craft and architecture bodies retained separately; documentary reconciliation and parent mechanical check pending. Full-slice review records remain unchanged. |
| Scope and leanness | Fixed-pair source only; no generic broker, scheduler or new product runtime interface. |
| Memory | Scoped memory-sync considered session learnings. The source contracts and witnesses already record them, so no additional memory entry was added. |
| ADR and lifecycle | ADR-0051 remains Proposed; full 051-09 remains IN_PROGRESS. No acceptance or status transition. |
| Live evidence and remaining gates | Deferred: reviewed source does not establish physical authority, operator readiness, native closure, installed-browser provenance or SDK/Adobe execution. |

## Remaining boundaries

The source-only approval gives no browser, SDK, network, Adobe, deployment or
native-case allowance. Source `executionReady`, `actualEvidence` and
`provenance` remain false. Future operation still needs source safety
reviews, owner acceptance of the exact reviewed decision, a separate finite
physical and cleanup plan with the reviewed `stop_safety_scope`, and actual
external-terminal readiness. The trusted same-user coordinator can fabricate
records; the checks do not prove personal human action.

An unfinished qualification remains UNKNOWN and blocks case two. A future
approved safety-only STOP is limited to the same consumed case and an
eligible retained handle; it cannot upgrade qualification or prove
recursive closure. Node and OS completion timing remain unqualified.
The historical R1 evidence, original public run and retry refusals, old
failure records and prior UNKNOWNs remain unchanged.

The independent [source documentary reconciliation](reviews/slice-09-fresh-native-source-reconciliation-pass-d5dff2a.md)
passed at 2026-11-05T15:17:57Z on `d5dff2a28907338c2746b9515777466b192db63e`.
It covers documentary fidelity, not full 051-09 reconciliation or native
qualification. The five current source reviewer roles are used (`5/5`);
source-track usage is `19/19`, plus three earlier readiness reviewers.
This appended note and the final review record are outside that PASS. The
parent's mechanical verification remains pending.
