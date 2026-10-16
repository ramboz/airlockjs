---
slice: 058-01 - Local recorder and no-send qualification
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-16T01:02:00Z
prompt_source: review.py implementation spec058 058-01; staged runner sha2569e00599d
---

VERDICT: needs-changes

REASONING:
The implementation meaningfully exercises matched per-transport loopback controls, preserves private wire evidence, and keeps vendor/chamber claims false. However, AC4’s asynchronous classifications, AC5/6’s per-hop falsification coverage, and AC8’s hard wall-time bound remain incomplete; the supplied successful run does not establish these failure behaviors.

SPECIFIC ISSUES:
- `rig/native-tag-qualification.mjs:329–349` — **High, AC4:** `stop()` detaches response and terminal listeners before settling accepted work. Responses or aborts arriving during settlement are discarded and collapse into generic `incomplete_capture`, rather than being individually classified. The tests lack witnessed delayed-read, late-response and non-guard-abort controls. Add bounded classification of these cases and corresponding controls.
- `rig/native-tag-qualification.test.mjs:73–90` — **High, AC5/6; assertion-thin:** Link assertions require only one redirect and one fan-out link anywhere. Deleting an enforced-leg link would still pass, and `dropped-request` drops the first GET—not a redirect/fan-out branch. Assert the expected relationships for every leg and add a dropped-branch failing control; the grader at `rig/native-tag-qualification.mjs:425–440` currently validates only branch roots present in the receiver observations.
- `rig/native-tag-qualification.mjs:580–610` — **High, AC8:** The wall timer is cancelled before recorder settlement and context/CDP/browser/server cleanup. Those awaited operations have no shared remaining deadline; elapsed overruns are only detected afterward. Enforce the declared run bound through cleanup and output, and witness timeout cleanup without stopping unrelated resources.

RECONCILIATION NOTES:
The late-response handling and wall-limit behavior are unresolved departures from the pinned requirements, not approved relaxations. Reconcile task/deviation records after correction while retaining all explicit local-only and unsupported-surface limitations.

Provenance: independent jig:reviewer compliance pass against the staged candidate
whose runner SHA-256 is 9e00599d076c8ef3596c77977884cf678331b811b1efb8f6a0ffc208f3639000.
