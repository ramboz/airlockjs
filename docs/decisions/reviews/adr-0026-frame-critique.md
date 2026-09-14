---
adr: 0026
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-14T01:54:13Z
prompt_source: review.py frame-critique docs/decisions/adr-0026-onetrust-consent-input-source.md
---

VERDICT: needs-changes

FINDING (load-bearing assumption most likely wrong): the ADR asserted that
`GetDomainData().Groups[].Status` (active/inactive) reflects the USER's resolved
per-group consent. The 2026-09-13 probe cannot support that: it is read-only,
never clicks the banner, and ran on an opt-out / US-default-granted page
pre-interaction, where configured-default and resolved-consent both read
"granted" by construction — zero observations discriminate "Status tracks the
user's choice" from "Status is the configured default." GetDomainData() is
domain CONFIGURATION. If Status is config-default, the driver reports denied ad
purposes as granted and 045's hold/flush releases beacons against denied consent
— the unsafe failure the seal exists to prevent.

SECONDARY: the surface-ranking that rejected OnetrustActiveGroups rests on a
divergence the evidence does not cleanly support (the run's surfaces disagreed
bidirectionally: cookie/ActiveGroups {1,BG394,4} vs Status ~all-active vs CM
all-granted). The OptanonConsent cookie groups=<id>:1/0 flags — OneTrust's
persisted resolved-consent record, already captured by the probe — were never
weighed as the source read.

CHEAP FIX (reviewer): one click-through re-capture that opts out of a single ad
group and checks whether that group's flag flips to denied — discriminates
resolved-consent from config-default before implementation.

DISPOSITION (this session): ADR-0026 revised. The A-over-B decision (read
OneTrust's own resolved surface, not the gtag CM signals) is retained. The EXACT
resolved-consent surface is no longer asserted — it is gated on the
discriminating click-through re-capture (leading candidate: OptanonConsent
cookie flags; GetDomainData().Status explicitly rejected as the grant signal,
used for taxonomy/names only). Added a Kill criterion (no surface flips on
opt-out -> fall back to the gtag/host-callback driver). slice-01 DoR now BLOCKS
READY_FOR_IMPLEMENTATION on that experiment. ADR remains Proposed (not accepted)
pending it.
