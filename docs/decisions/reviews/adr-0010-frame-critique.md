---
adr: 0010
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T17:12:39Z
prompt_source: review.py frame-critique docs/decisions/adr-0010-roundtrip-egress-capability.md
---

## Frame-critique — ADR-0010 (round-trip egress as a declared-and-gated capability)

**Round 1 verdict: needs-changes** (general-purpose reviewer, bounded ≤6 files). One PRIMARY
block + refinements; all applied. The frame (a declared-and-gated `dispatch` capability that
refuses to collapse the two egress models) was found sound; the block was one over-claim.

- **[3] PRIMARY — "gate-able against declared endpoints" over-claimed → NARROWED.** Asserted over
  the whole egress surface but only holds for the single-hop fetch. Multi-hop-as-N-dispatches is
  already handled (per-`id` `pendingFetches`). But **browser-followed 302 redirects** reach
  endpoints the gate never checked, and **fire-and-forget DOM pixels** aren't fetches — exactly
  the paths 013-02 found shim-swallowed + lower-bounded. **Fix:** the ADR now scopes the gate
  honestly to the **fetch hops the chamber intercepts**, names redirects + pixels as a separate
  confinement residual, and adds a kill-criterion + open question (validate against a
  redirect-/pixel-firing org before the endpoint-ceiling enforcement relies on the gate as
  complete; consider `redirect:"manual"` + serialize `url`/`redirected`).
- **[1] SOUND w/ caveat → return type narrowed.** `dispatch` faithfully models what alloy
  consumes + doesn't leak the transport, but `Promise<Response>` over-promised (the chamber
  reconstructs a lossy `Response` from 4 fields). **Fix:** typed as the serialized
  `{status, statusText?, headers?, body}` shape — which the chamber's fetch-shim already
  reconstructs from, and which the 014-01 contract uses.
- **[2] folds into [3]** — "single chokepoint" ≠ "sees everything it must gate"; addressed by the
  [3] narrowing.
- **[4] SOUND, rationale thin → strengthened.** Option C (unify into `EgressRequest`) rejected on
  the real reason: a **control-flow mismatch** (completed batch return vs inline await), not a
  missing field; plus GA4's `EgressRequest[]` is load-bearing for ADR-0004's unload fast path.
- **[5] SOUND iff sequencing is a precondition → made explicit.** The surface details close
  **inside spec 014** (`req` shape at 014-01, redirect-visibility + declaration at 014-03) before
  any enforcement spec binds — stated as load-bearing in Open Questions.

### Net
The capability shape is faithful and composes with the existing `cookies.sync` / `decisions.deliver`
model; the one block (an unqualified "all egress" gate claim that MVP3's endpoint-ceiling would have
bound to) is now honestly scoped to the fetch-dispatch hops, with redirects/pixels named as the
residual the enforcement must separately close.
