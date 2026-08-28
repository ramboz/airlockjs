---
adr: 0007
pass: frame-critique
verdict: pass
reviewer: claude (independent frame-critique subagent, jig prompt)
reviewed_at: 2026-08-28T21:42:52Z
prompt_source: review.py frame-critique docs/decisions/adr-0007-consent-purpose-model.md
---

# Frame-critique verdict — ADR-0007

**Verdict: pass** (final verification; independent fresh-eyes reviewer, after two
revision rounds — the hold-vs-reshape enforcement correction, then the
gcs/gcd→MP-`consent`-field transport correction).

The load-bearing bet — that GA4's four Consent Mode signals partition cleanly
across three enforcement points, with *data-use* signals
(`ad_user_data`/`ad_personalization`) reshaped-and-sent at the mapper via the MP
`consent` body field and *storage* signals enforced at the cookie capability — is
**grounded, not asserted**. The reviewer found stronger grounding than the ADR
cited: `contracts/ga4-mp-request.schema.json` pins the MP `consent` object to
exactly those two keys with `additionalProperties: false`, from Google's official
docs (the ADR pointed only at `connectors/ga4/map.js:74`). The frame survives the
strongest attack.

## Residual notes (folded into the ADR; not blocking)

1. **Delegation posture, now stated explicitly.** "Reshape and send" for GA4 does
   not withhold at the seal — it sets `consent=DENIED` and POSTs the full payload,
   *delegating* data-use-denial enforcement to Google's server-side honoring. This
   is lawful/Consent-Mode-correct for GA4 and the only MP mechanism, but a
   deliberate departure from the seal thesis. Added as an explicit "Posture" note in
   the data-use bullet; a future connector with no server-side consent flag falls to
   kill-criterion #4 (partial-payload/drop), not this path.
2. **Storage-denied needs an ephemeral client_id.** The pinned schema requires
   `client_id` (a null-id beacon fails `ga4_mp_conformance`), so storage denial
   means an *ephemeral, non-persisted* id, which is identity-ctx sourcing — a
   *storage* denial therefore touches two places (cookie write + identity sourcing),
   a small qualification to "one signal → one enforcement point." Corrected in the
   storage bullet.
3. **Reshape must land at both mapper sites** (worker `mapBatch` + main-thread
   unload fast path, ADR-0004/OQ16), or unload-critical data-use-denied beacons
   egress without the consent flag. OQ16 already tracks fast-path mapper parity;
   noted in Open questions.

Reviewer: claude (independent frame-critique subagent, jig prompt).
