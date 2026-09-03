---
slice: 026-03 — the config contract (`PixelVendorConfig`): pin + validate + conformance
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T01:46:32Z
prompt_source: review.py implementation
---

Compliance (026-03) — PASS. All 7 ACs substantively met (independently verified field-by-field). AC1's type
captures exactly the 7 fields connector.js:74-82 destructures (no missing/extra); eventMap Record<string,string|null>
+ PixelParamSpec {from:static,value}|{from:event}|{from:params,key} match handle()'s reads (:139-142) verbatim;
every JSDoc line-citation checks out (grounded per ADR-0020). The validator is non-vacuous (each reject test names
the offending field, defeating a no-op/blanket-false validator), never throws (null/non-object guarded), and the 3
shipped configs conform incl. LinkedIn's page_view:null. AC5 zero interpreter/core change confirmed (additive new
files; validatePixelVendorConfig imported only by the test; connector.js/core/pinned-contracts diffs empty). AC6
fossils fixed (no 026-03 remains in vendors/; all say 026-04). Two non-blocking nits (both applied in remediation):
the type↔validator gap on static value (validator now rejects non-string|number, closing the value:{} footgun) +
the JSDoc "every config uses number" overstatement (corrected). The AC5 git-diff test's standing-guard weakness
noted in the deviation log (the additive structure + grep + orchestrator confirmation is the real guard).
