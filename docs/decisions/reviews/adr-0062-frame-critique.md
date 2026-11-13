---
adr: 0062
pass: frame-critique
reviewer: claude-opus-5.5 (fresh rubber-duck sub-agent per round)
cap: 2 rounds (owner-set, 2026-11-13)
---

Each round: a fresh sub-agent that read only the ADR-0062 draft and the ADRs it amends or cites.

## Round 1: NEEDS-CHANGES

1. (high) Cookie/storage default-deny (ADR-0006:95-98, :155-160, :221) was marked unaffected, which contradicts "stores what the stock tag stores". Folded: marked amended, default grants the stock set (point 7).
2. (high) The channel carrying real page values was unnamed (snapshot vs a new channel). Folded: a host-collected stock-context channel separate from the projection snapshot (point 2).
3. (medium) Behaviour with no consent input configured was unstated. Folded: point 4 follows ADR-0007's pending default; owner correction of 2026-11-13 made the consent hold the one named exception.
4. (medium) "Every control remains available" was false for Alloy (no input governance at the wrapped-SDK seam, no configurable `context`); `toXdm` change was vague. Folded: both named as required follow-up slices; `toXdm` forwards the site `xdm`; ADR-0013:89-93 row added.
5. (medium) Denylist row contradicted Open question 1. Folded: decided in the body, question reduced to owner confirmation.
6. (low) "Stock default" ambiguous for Google/Meta. Folded: the base-setup state (ADR-0061 points 1 and 3).
7. (low) Citation fixes (ADR-0003 kill criteria at :158-165, ADR-0013 Option C row dropped, ADR-0006 in dependencies, "Amends and partially supersedes"). Folded.

## Owner correction between rounds (2026-11-13)

"No, keep the consent hold as the one exception to the rule". Folded as point 4, 5 and 6 and the point 7 interpretation.

## Round 2: NEEDS-CHANGES (cap reached, no round 3)

1. (high) No-consent-input default differs by track (Alloy sends, GA4/Ads would hold forever). Carried: Open question 4.
2. (high) Alloy drops while pending, so the exception loses events. Carried: required hold-and-flush slice (point 4).
3. (medium) Point 3 made always-safe controls opt-in. Folded: split into two groups.
4. (medium) Opening the snapshot allowlist went beyond the rule and reversed ADR-0003:60-63, :157-159. Folded: snapshot stays default-deny.
5. (low) ADR-0004 / Q2 row muddled. Folded: names the keepalive budget (ADR-0004:114-117) and capture ring; hold ring is part of the exception.
6. (low) ADR-0013 citation fixes and missed :66-71, :92-93. Folded.
7. (low) "Always-on floor" overstated ADR-0012:115-116. Folded: "built-in default".
