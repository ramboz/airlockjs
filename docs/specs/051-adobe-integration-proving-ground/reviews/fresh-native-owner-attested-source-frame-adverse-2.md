---
adr: 0046
pass: frame-critique
verdict: needs-changes
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T00:11:07Z
prompt_source: coordinator-supplied same-reviewer owner-attested source frame back-edge
reviewed_checkpoint: d6e46854a8064dcb076ba63c25d8686c1b35188c
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: d6e46854a8064dcb076ba63c25d8686c1b35188c
actual_completion_utc: 2026-11-05T00:11:07Z
model: GPT-6.1 Sol (gpt-6.1-sol)
scope: Same-task read-only FRAME backedge on the unchanged three-document candidate, limited to the newly disclosed executable-dependency coverage premise. Rechecked the frozen contract/ADR/attestation boundary, existing public source-pin validator, fixed source roster and Playwright launch seam; did not inspect the uncommitted implementation, external browser cache, private originals or historical transcripts. Own checkout clean before and after; HEAD and all three supplied document hashes unchanged.

VERDICT: needs-changes

REASONING:
The load-bearing assumption is that the declared closed relative-path source pins can cover every executable dependency of the native command using the existing source-validation boundary. The contract promises that coverage, but the cited validator only accepts files within the worktree, while the disclosed installed Chromium executable and browser-owned helper/framework bundle reside outside it; package/source hashes do not identify those executed browser bytes. No approved root/bundle representation or explicit narrower coverage boundary reconciles that mismatch. The earlier PASS therefore does not clear this newly exposed premise: implementing the promised executable coverage now requires a material framing decision, not an implicit implementation interpretation.

SPECIFIC ISSUES:
- [blocker] Source-file pinning is assumed to establish complete executable-dependency coverage. The readiness contract at `slice-09-fresh-native-readiness-contract.md:116-118` expressly includes the reviewed command and every executable dependency it uses. In contrast, `supervised-journey-operator.mjs:169-175` requires each source pin to match an exact executing path within ROOT; its fixed roster at `:77-90` names repository source/bundles and the package lock, not the external browser bundle. The launch at `:978-983` delegates browser selection to installed Playwright without binding an executable/bundle digest. On the disclosed external-cache layout, that route cannot validate the actual Chromium/helper bytes under the current boundary. Accepting JS/package hashes as sufficient would silently weaken the promise; refusing every real launch would remain blocked, not fulfill the native adapter. A new approved representation/boundary is necessary before claiming a coherent implementation of this guarantee. I found no such representation in the three frozen proposal documents or the cited public validator/launch seams; this is not a claim about every possible external mechanism.

RECONCILIATION NOTES:
- Preserve the actual 2026-11-04T23:30:11Z PASS as historical review evidence. This actual backedge changes the current assessment because the external executable-coverage mismatch is now explicit; it does not rewrite the prior result or review the incomplete implementation.
- Browser executable and browser-owned helper/framework identity are distinct from an explicitly trusted OS/Node/toolchain baseline. This finding does not demand hashing the whole host OS, kernel or system-library closure. The frozen frame needs an explicit boundary between pinned executable dependencies and trusted runtime assumptions; the current unqualified wording cannot silently supply that exclusion.
- The suggested fixed browser-bundle manifest and explicit OS/Node baseline are not approved: the reported owner response is UNAVAILABLE. This verdict authorizes no new field, root mapping, manifest scheme, platform or reduced guarantee. No browser/cache acquisition, copying, execution or probe is requested to clear this frame finding.
- The trusted human/coordinator attestation model and cooperative-stop limitation are not reopened. Exact-decision acceptance, source safety reviews, actual owner readiness and separately approved finite physical authority remain required. The expired 0/2 native allowance stays closed; the source-only deadline remains 2026-11-05T00:51:49.600Z and grants zero physical effects.
- Historical public run/retry refusals, R1, old C FAIL/UNKNOWNs and original 051-09 obligations remain untouched. This is only a frame verdict, not source-safety review or native qualification. No files, commits, tests, network/credentials, browser/SDK effects, lifecycle changes or additional agents/sessions were used.
<!-- END VERDICT -->
