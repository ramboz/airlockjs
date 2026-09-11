---
slice: 038-04 — confirm Meta advanced-matching parity (retire the `ud[...]` 026-04 gap)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-11T16:56:54Z
prompt_source: review.py frame-critique docs/specs/038-parity-harness/spec.md 'advanced-matching parity' slice-04-advanced-matching-parity.md
---

# Frame-critique — 038-04 (confirm Meta advanced-matching parity)

**Verdict: needs-changes** (pre-implementation). The central approach — presence-parity for a
redacted hashed field via redact-both-sides + an AC2 well-formedness guard, with `ud[em]`/`ph`
re-owned as capture-gated — was judged **sound and largely ADR-0020-sanctioned**, but the frame
shipped two load-bearing grounding imprecisions and one overclaim. **All findings folded into the
revised slice (v2) before this record.**

## Findings (all addressed)

1. **[major] Fixture conflation.** The v1 frame cited `redact.js:35,67`'s sentinel as the committed
   `ud[...]` value, but the field this slice confirms — `ud[external_id]` — lives in the *real-capture*
   fixture `meta-tr-pageview.redacted.json` as the literal `"REDACTED_SHA256"`, NOT the 64-zero
   `SYNTHETIC_HASH` (that is the *synthetic* fixture's `ud[em]`/`ph`). Redacting only airlock's side
   → divergent → fail. **Fold:** v2 adds a "Two fixtures — do not conflate them" block; AC1 + A1 now
   state the `maps` classification depends on re-redacting BOTH beacons at diff-time (the `/^ud\[/`
   rule maps `"REDACTED_SHA256"` + airlock's real hash to the shared sentinel).

2. **[minor] redactMetaBeacon blast radius overstated.** A2 claimed the redactor leaves `id`/`_fbp`/`fbc`
   "fully intact"; `redact.js:64-68` rewrites those too and scrubs `dl`/`dr`, so redact-both-sides makes
   `id`'s value-compare vacuous. **Fold:** A2 (v2) names the full blast radius and the retained raw-diff
   path against the synthetic fixture as the `id`/`_fbp`/`fbc` value regression guard.

3. **[major] "Advanced-matching parity confirmed" overclaim.** Presence + well-formedness proves airlock
   EMITS a well-formed `ud[external_id]`, not that it hashed the SAME `external_id` the container did
   (same-input efficacy — ADR-0020 kill-criterion #1). **Fold:** the claim is re-scoped to
   "field-**presence** parity" throughout (Goal / framing / close-out); new **AC7** + **A4** name the
   same-input efficacy residual as an MVP9 rewire/adoption property (ADR-0020 report-note precedent).

## Reconciliation notes (folded)
- `fbp` (real capture) vs `_fbp` (descriptor/redactor key) wire-name mismatch → AC4 (v2) makes the
  implementer confirm Meta's real `/tr` param and scope the `_fbp`/`fbc` guard accordingly.
- The two fixtures differ in structure (flat map vs `beacons[]`) → AC5 (v2) extracts the beacon from
  the real capture's `beacons[]` array.
