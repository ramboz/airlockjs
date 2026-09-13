---
slice: 046-02 — DC opts into hold-until-granted (ad_storage-denied parity)
pass: frame-critique
verdict: needs-changes
reviewer: general-purpose
reviewed_at: 2026-09-13T04:09:35Z
prompt_source: review.py frame-critique docs/specs/046-floodlight-connector/spec.md 046-02 slice-02-denied-seal-hold.md
---

VERDICT: needs-changes (pre-implementation frame-critique). All findings folded before this record.

REASONING:
The denied-path frame is sound and well-grounded: A1 (DC held under `ad_storage`-denied) rests on the same R-009 §(b)
re-capture the shipped 044-02 stands on (`R-009:171,175-181`), and the re-map's load-bearing value — the always-available
`gcs`/`gcd`/`npa` consent-flip — is fully reused and independent of every open question. The single exposed, un-surfaced
assumption was that this slice is a "1:1 mirror" of 044-02 that "reuses 046-01's mapper mirroring `createGoogleAdsRemap`" —
presented as settled in the Goal + AC1 while entirely contingent on 046-01's still-OPEN, arch-gated §A2 endpoint pick. The
slice's `## Assumptions` carried only A1 and never named this dependency, so the frame over-stated its certainty.

SPECIFIC ISSUES:
- **The "1:1 reuse" claim is contingent on 046-01 resolving §A2 to the query-delimited `ccm/collect`.** If §A2 lands on the
  `;`-delimited `activity` form instead: (a) the re-map is no longer a `createGoogleAdsRemap`/`appendParam` mirror — it
  needs a NEW `;`-delimited encoder; and (b) a concrete un-analyzed failure in THIS slice's flush path — `core/airlock.js`
  `setConsent` re-checks the re-mapped URL via `core/endpoint-ceiling.js` (origin+**pathname**, `:52-59`), and an `activity`
  URL puts its params in the pathname (`/activity;src=…;ord=<cachebuster>`, verified with `new URL(...)`), so the
  per-request-varying pathname never matches a declared `/activity` endpoint → the granted-flush beacon is HELD at the seal
  instead of sent — the exact non-parity hold-until-granted exists to prevent, a case AW's fixed-pathname `ccm/collect`
  never faced.
- **(secondary, minor)** `auiddc` re-source (`_gcl_au` vs `_gcl_dc`) is not load-bearing here — the re-map's proof value is
  the consent-flip, and per 044-02 §A5 the linker-id re-source is synthetic-only even on a real rewired page. A note.

FOLD (2026-09-12): slice 046-02 gains **A2** naming the §A2 contingency + the `core/endpoint-ceiling.js` pathname/`ord`
break explicitly; AC1 qualified ("reusing 046-01's mapper — whatever wire encoder §A2 landed on"); AC2 extended to require
the granted-flush to actually egress (clear the ceiling re-check), with AC4 covering it in tests; the DoR + Out-of-scope
name 046-01's §A2 pick as an upstream input. Downstream cost is bounded — 046-01 hits the granted-path ceiling case first
(046-01 AC5), and sequencing lets 046-01 resolve §A2 before 046-02 implements.

Reviewer substrate: general-purpose subagent running the jig frame-critique rubric; read-only (Read/Glob/Grep); no authoring
context; grounded against R-009, `core/consent.js`, `core/airlock.js`, `core/endpoint-ceiling.js`, and
`connectors/google-ads/connector.js`.
