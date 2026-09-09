---
slice: 039-03 — session-state reproduction + `_ga_<stream>` writer (closes OQ13-2)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T22:20:20Z
prompt_source: review.py frame-critique <spec> 'session-state' <slice> (round 2)
---

Frame-critique verdict: **pass** (round 2, independent jig:reviewer, read-only, pre-implementation).

Round 1 (needs-changes) is genuinely resolved. The three session-state regimes (first-visit / same-session
continuation / >30-min new session) are now DIRECTLY OBSERVED live on the reference page (2026-09-08) rather than
inferred from a single-page capture; the redacted multi-page fixture (test/fixtures/parity-ga4-collect-multipage.redacted.json)
encodes those observed VALUES; DoR/AC1 now name the `_ga_<stream>` read-modify-write as new work (not a seam extension);
AC3/AC4 assert transition VALUES against the observed fixture (not "advanced" / a self-referential simulation).

Reviewer's page-by-page fixture trace confirmed internal consistency with the GS2 grammar (sid<-s, sct<-o, seg<-g;
_ss/_nsi iff new session; _fv iff new client) across all three pages. Residuals correctly bound remaining risk to
engaged-session mis-attribution (seg threshold documented-not-timed; j/l/h opaque), not session-identity/attribution drift.

Non-blocking residuals folded into the slice/fixture at reconciliation:
1. Fixture `gcd` = synthetic `13p3p3p2p1p1` contradicts the observed `13r3r3r3r5l1`/`13q3q3q3q5l1`; reconcile or drop gcd
   from the session-state fixture before AC4's field-for-field bakes it in (overlaps 039-02's gcd rework).
2. The 30-min boundary is "documented GA4 default, one-point-confirmed" (observed bracket ~[5min,33min]) — soften
   "observed" wording accordingly.
3. GA4 session timeout is a per-property Admin setting (default 30min, CONFIGURABLE). The connector should take the
   timeout as config (default 30min), not hardcode, or it diverges on targets that customized it. Added as a residual.
