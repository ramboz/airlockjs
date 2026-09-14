---
adr: 0026
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-14T03:35:44Z
prompt_source: review.py frame-critique docs/decisions/adr-0026-onetrust-consent-input-source.md (3 rounds)
---

VERDICT: needs-changes (map contract not yet groundable) — ADR stays Proposed; accept after 047-01 grounds the map.

Three adversarial frame-critique rounds, each caught a real load-bearing over-claim; all addressed:
- R1: asserted GetDomainData().Status = resolved user consent. Ungrounded + unsafe.
- R2: asserted a "coarse" per-group map from a single degraded all-at-once RejectAll.
- R3 (this): (a) assumed a static per-group {groupId: purposes[]} map shape when the site's
  OneTrust->purpose logic is Tealium-side/uninspected and may be combinational/region-conditional
  (BG394 flipped in lockstep with group 4); (b) BUG — spec Overview + 047-01 decomposition still
  cited GetDomainData().Status (the rejected surface) after the pivot.

Final state (grounded):
- GROUNDED (degradation-independent opt-out differential): OnetrustActiveGroups / OptanonConsent
  cookie flags carry resolved consent (flip on opt-out); GetDomainData().Status is configured-default
  (does not flip) and is rejected as the grant signal (used for taxonomy/names only). The ADR's
  recorded decision (read ActiveGroups/cookie, Option A over B) rests ONLY on this.
- DEFERRED, honestly marked UNVERIFIED: the host-map's shape + granularity. Grounded before 047-01
  freezes the contract by (i) a non-degraded per-group-toggle experiment AND (ii) cross-validating
  the driver's output against the site's own resolved Consent Mode vector (google_tag_data.ics) across
  states — the available ground truth. Kill criterion widened: if the mapping is not a static
  per-group function, Option A's map is insufficient -> fall to Option B (parity-correct by construction).
- BUG fixed: spec Overview + 047-01 decomposition now cite OnetrustActiveGroups/cookie, not Status.

Disposition: ADR-0026 remains Proposed. The surface decision is grounded and sound; the host-map is
deferred to 047-01 grounding. Do NOT stamp Accepted (immutable) until the 047-01 experiments validate
the map is expressible (else the kill-criterion routes to Option B). Accept then.
