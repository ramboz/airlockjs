---
slice: 044-02 — g-ads opts into hold-until-granted (denied-consent parity)
pass: compliance
verdict: pass
reviewer: general-purpose (jig compliance, opus)
reviewed_at: 2026-09-12T17:33:49Z
prompt_source: review.py implementation docs/specs/044-google-ads-connector/spec.md 044-02 <deliverables>
---

VERDICT: pass

REASONING:
AC1-AC3 are fully met with non-vacuous tests: the seal mechanism (core/airlock.js:452/454/747) consumes exactly the `event`-attach (connector.js:176) and `remap` (connector.js:214-226) the connector supplies, and the AC2 grant-flush test proves RE-MAP not stale re-send by asserting the granted `gcs=G111`/`npa=0` present, the denied `G100`/`npa=1` absent, and `remap` invoked with the granted vector (test:217-218,227-230) — it would fail if the feature were deleted. The load-bearing `gcs`/`npa` flip and the in-test synthetic `auid` re-source are both correctly demonstrated per §A5. The only shortfall is a minor, non-load-bearing coverage gap (AC4's enumerated `pending→held` case), which is mechanism-redundant.

SPECIFIC ISSUES:
- test/google-ads-seal.test.js (whole file) — AC4 (slice) enumerates a `pending→held` unit case; the file exercised only `denied` (no `ad_storage: "pending"` vector). Medium confidence, non-blocking: pending-hold is base-seal 017-03/045-01 behavior and the connector has no pending-specific branch, so g-ads routes it identically to the tested denied path.

RECONCILIATION NOTES:
- Record the `pending→held` omission in the deviation log: either add a one-line pending-vector hold assertion to google-ads-seal.test.js, or note it as intentionally deferred to the mechanism's own coverage.
- The two A2-deferred edges are already named in §A2 — (a) `adapters/eds` boot threading of `holdOnDenied`+`remap` for the `google-ads` type, and (b) the real worker→main structured-clone of the attached `EgressRequest.event` (FakeWorker uses an object literal). Confirm both remain tracked against the deferred g-ads boot slice.
- Fill the `### Deviation log` and `### Reconciliation sweep` sections (currently `_(pending implementation)_`) before DONE — DoD requires reconciliation walked.

--- ORCHESTRATOR NOTE (post-verdict remediation, recorded for the reconciliation pass) ---
The single non-blocking coverage gap (pending→held) AND both craft-pass nits (gcd flip uncovered; consentDefault/landingUrl params untested) were CLOSED after this verdict, not merely logged: test/google-ads-seal.test.js now adds a pending→held case, a gcd denied→granted flip assertion in the seal re-map test, and a createGoogleAdsRemap unit test exercising consentDefault (gcd) + landingUrl (gclid re-discovery). Full suite 1604 passed / eslint 0. AC2/AC4 wording aligned to gcs/gcd/npa.

---
Reviewer substrate: general-purpose subagent (Opus), read-only, jig compliance rubric. Verified all ACs against deliverables + tests + the 045-01 seal consumption points (core/airlock.js:452/454/747) + the reused encoders/cookie-sourcing.
