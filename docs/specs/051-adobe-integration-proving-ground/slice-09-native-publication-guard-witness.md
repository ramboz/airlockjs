# 051-09 publication-guard checkpoint

This is a narrow source checkpoint. The native source remains incomplete
and unqualified. The current frame verdict is NEEDS-CHANGES, and real
START still refuses before reading a job or acquiring a browser.

The candidate is `46bffba5c1290e440195595dfef6e23db5059281`, based on
`898050bfd7d94806814cfd519cb5d2f6b145cb73`. It changes only:

| File | SHA-256 |
|---|---|
| `probes/adobe-compatibility/fresh-native-io.mjs` | `c2337c85f1d21b2fa7c0efea15499313db881e349ae9185804b9b70133b8da32` |
| `test/adobe-fresh-native-deadline.test.js` | `6a5e12d360b5b19e0a25b7266c14f1d4568313ef3cf0407a359a7bc8b6f458e5` |
| `test/adobe-fresh-native-storage.test.js` | `5b33f5a31cd824caf72421a57fd344174988b4794250bc85bc456b9f3367bbcb` |

The patch adds checks against the existing wall-clock hard stop around
record publication and lock transitions. The checks prevent a later
write, sync or lock removal from starting after a preceding awaited step
is observed to cross that deadline. The lock and job must carry the same
hard stop. An observed deadline crossing reports UNKNOWN. The storage test
fixture now uses the job's actual lock deadline.

The focused deadline tests use controlled filesystem and clock doubles.
They cover the record open, write, sync, close and directory-sync
boundaries, lock transitions, deadline mismatch, failures and the
before/at/after threshold. Across the five focused files, 55 tests passed
using synthetic records, controlled doubles and temporary local storage.
Focused lint and syntax checks passed. None of these checks launched a
browser or exercised SDK, Adobe or network effects.

The causal red logs in the writer's session files are:

| Log | SHA-256 |
|---|---|
| `native-mutation-deadline-red.log` | `14ea399c3d42eaf99da734f6d769f7f7a5787a51bf19f48e0af3954c6648aca6` |
| `native-lock-deadline-red.log` | `0e74916ab944f4b4fff2e1ffc3214a229c28429afe07614747648c68ce9a74d1` |
| `native-lock-failure-red.log` | `ba1b9c340cfb7668c610f8ce2523ed5438f6934141d2da585433e0d428cf1472` |

The final focused green log `native-mutation-final-green.log` has SHA-256
`2b6c6e72dc3e4c73942b9e83431ff52fb1bf28ca2d10ce72582eff0cbf9824dd`.

File-descriptor cleanup remains unqualified. The existing `finally` close
behavior is unchanged, and no decision was captured on post-deadline close
or descriptor retention. Node garbage collection and OS completion timing
are not qualified. This patch does not prove that no filesystem effect
occurs after the deadline, or qualify the complete record writer, monotonic
clock handling, source safety, STOP, browser executable pins or native
operation. The owner clarification was unavailable, not approval.

No ADR, contract, pinning boundary or previous review record changed.
No native, browser, SDK, Adobe or network effects were authorized or
performed. The old physical allowance remains closed. The source-only
hard stop remains 2026-11-05T00:51:49.600Z.

The [narrow publication-guard compliance review](reviews/fresh-native-publication-guard-compliance-pass.md)
passed at 2026-11-05T00:40:43Z on the exact candidate. It covers the
publication-step checks and lock/job deadline binding only. The reviewer
did not run the writer-reported tests. The additional reviewer count is
`3/5` and source-track count is `13/15`; the three earlier readiness
sessions remain charged. Documentary reconciliation and the parent
mechanical check are pending.

The [documentary-fidelity reconciliation](reviews/fresh-native-publication-guard-documentary-reconciliation-pass.md)
passed at 2026-11-05T00:44:28Z on
`6539137fd718d1717142f24d48b3e7da9cd660e5`. It covers the two-document
recording only. Counts are now `4/5` additional reviewers and `14/15`
source-track sessions, with three earlier readiness sessions still charged.
This final record and note are outside that pass; the parent mechanical
check is pending. The source and native limitations above remain open.
