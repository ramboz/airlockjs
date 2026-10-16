---
slice: 058-02 - Pinned native attempted-request reference
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-10-16T16:24:57Z
prompt_source: review.py implementation spec058 058-02; initial native-reference compliance pass
---

VERDICT: needs-changes

REASONING:
The implementation supports the narrow pinned Meta PageView/off/value profile and correctly distinguishes attempted requests from vendor delivery. However, a permissive favicon exception leaves a dependency-closure false-positive path, and blocking input acquisition can defeat the CLI's wall-time bound. The headless negative test also does not establish that it observed genuine native execution.

SPECIFIC ISSUES:
- `rig/native-tag-reference.mjs:336-337` - [High] Any same-origin `/favicon.ico` request is exempted before unknown-script classification, regardless of query, resource type, method or body. An unexpected dependency/auxiliary can therefore be aborted yet silently accepted in a `dependency_closed` run. Restrict this exception to the exact expected browser favicon GET; classify other variants as unknown.
- `rig/native-tag-reference.mjs:100-104` - [High] `open(O_RDONLY | O_NOFOLLOW)` can block indefinitely on a FIFO before `stat()` rejects non-regular files. The deadline race returns, but the outstanding filesystem operation can keep Node alive after the CLI merely sets `process.exitCode`. Use nonblocking acquisition before the regular-file check, and cover a stalled FIFO input; uncancellable acquisition must not retain the command indefinitely.
- `rig/native-tag-reference.test.mjs:308-315` - [Medium; assertion-thin] The genuine headless no-beacon test checks only inconclusive state, missing_positive_reference, and mode. It would also pass if that cohort stopped loading/executing the SDK. Require pinned-resource fulfillment, dependency closure, bootstrap execution and zero measurement attempts from the retained capture.

RECONCILIATION NOTES:
Record partial AC4 coverage explicitly: the disabled control is linked to a positive reference, but consent-negative behavior is neither implemented nor qualified. Its honest not_proved disclosure is not consent-negative evidence or full AC4 completion. Preserve the one-profile scope, missing-Google blocker, separate headed/headless cohorts, and false vendor/full-support claims.

Author follow-up in progress: narrowed favicon classification, switched to
nonblocking regular-file acquisition, strengthened actual headless execution
assertions, and added a real native revoke-before-init control plus a
revoke-removal failing mutation. No blanket negative or consent coverage is inferred.
