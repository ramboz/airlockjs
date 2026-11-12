# 051-09 configured positive witness

The first configured positive stock/chamber pair returned an observed result
on 2026-11-06. Both arms used the pinned official Alloy SDK against the owned
POC. This is one bounded Analytics and Target journey. The negative controls,
deployed adoption, full SDK compatibility and 051-09 remain open.

## What ran

The source was `78a58ff86e41341a454f0d8503beb64d41b1a4ab`; the served POC
source was `0d78c3a798a079773de396a41afc04585a70c672`. The job SHA-256 was
`23a4a9cfd0771f6e2ab69629334974b8043490e9cdec22396f672e3b9da0f0d6`.
The later documentation commit does not change that source or job binding.
The profile was `poc-native-collect-v1`, with comparison v3, state evidence
v2, `fresh-poc-host-cookie-v1`, and `poc-sticky-conversation-v1` in both arms.
The retained SDK bytes were Alloy 2.31.1, 152336 bytes, SHA-256
`7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`.
The staged SDK and chamber original matched the served inventory. There was no
separately named stock SDK-original file.

Entry started at `2026-11-06T04:46:22.666Z` and returned at
`04:46:50.397Z`. The original terminal SHA-256 is
`a20666815cd2ed1140a3fc7b0cd549a59aafcb115b8107bff7bc6b0ae1158013`.
It records `observed`, observed closure and `actual_evidence: true`.
The two sequential isolated arms each captured five requests, five admissions,
five boundary records, five state records and a final state. Each recorded 18
local reads started and completed, a visible render, a trusted click and
recorder exit 0. The original captured wire includes the native DISPLAY and
INTERACT required by the positive checker.

The stock arm started at `04:46:24.669Z`; its measured passive settle ran from
`04:46:27.362Z` to `04:46:37.367Z` and elapsed 10005.16575 monotonic ms.
The chamber arm started at `04:46:37.475Z`; its settle ran from
`04:46:40.264Z` to `04:46:50.266Z` and elapsed 10002.330875 monotonic ms.
Both recorded the `complete` substage with no first-guard refusal. These are
the recorded wall and monotonic observations, not reconstructed old timings.

The browser exit was observed with code 0 at `04:46:50.379Z`; context and
server close completed. The owner and recorded browser processes were absent
at the subsequent point-in-time check. The unused independent STOP was retired
without sending STOP after closure. Target was restored to Saved, its original
schedule and 50/50 allocation. The full API comparison, excluding only
`modifiedAt` and `modifiedByName`, and the disabled public config were
verified at `04:48:37.363Z`.

## Verification and limits

The parent independently checked the original private byte-exact export and
all 278 source/dependency pins. The existing per-arm capture, boundary and
state validators passed, as did pair preparation, SDK command validation and
the complete paired binder. The replay's pair and wire results matched the
original pair result. The private export manifest SHA-256 is
`ab58f0c7bf4afe8f39ae7a3c5983d46e84d5ea02b5b0f849656c5f111df06254`.
It contains private original evidence and is not committed here.

The replay used the retained browser exit as the validator time. That is an
upper bound, not the original binder invocation time. The replay was read-only
and did not start a browser or SDK. It verifies the recorded pair under that
time bound; it is not a second run.

Eight earlier consumed allocations remain UNKNOWN. The expired replacement
window created no job and consumed no SDK allocation. Its former backstop
had no completion receipt, so its execution remains UNKNOWN. The later
replacement backstop was retired after the verified inverse.

This witness does not establish a default SDK configuration, downstream
reporting, the mandatory negative controls, EDS adoption, full slice
acceptance or release readiness. The wider 051 and 051-09 stay IN_PROGRESS.
