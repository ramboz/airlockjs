---
slice: 047-01 — OneTrust boot consent vector → the seam's `consent` param
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-14T04:44:47Z
prompt_source: review.py implementation (047-01)
---

VERDICT: pass
All five ACs of slice 047-01 are met with meaningful, non-vacuous tests (each verified to fail if its feature is removed). The driver reads only OneTrust's resolved surface via an injected read (a decoy GetDomainData().Status:"active" fixture still resolves DENIED when OnetrustActiveGroups is opted-out), maps through the host map with correct granted/denied/omitted semantics to core/consent.js's exact vocabulary, and feeds the existing consent boot param without touching any seal codepath. Fail-to-pending direction correct throughout (empty vector is truthy so egressPurposes engages -> seal holds). Import-free, egress-free, never throws on malformed input.
Reconciliation notes: (1) the redacted A5 captures are inline test constants, not a separate committed fixture file (faithful to both states; minor deviation from DoD literal wording). (2) AC3's "denied ad purpose holds" is inherited from spec 045 (reused, not re-demonstrated via the boot path; boot integration covers granted->send + pending->hold).
