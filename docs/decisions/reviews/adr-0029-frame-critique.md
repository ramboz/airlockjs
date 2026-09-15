---
adr: 0029
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T15:03:25Z
prompt_source: review.py frame-critique docs/decisions/adr-0029-mvp9-developer-side-after-arm.md
---

Frame-critique pass on **ADR-0029** — two rounds, reviewer `jig:reviewer`, prompt built via
`review.py frame-critique docs/decisions/adr-0029-mvp9-developer-side-after-arm.md`.

**Round 1 (cold read) — verdict: needs-changes.** The reviewer verified the core grounding against the actual
`intuit-erp` repo and found it sound: the repo owns the utag injection seam (`plugins/tealium-martech/src/index.js`
`loadUtag`, `document.createElement('script')`); the four vendor runtimes are separate, interceptable `<script>`s (perf
report); and the `?tealium-tags=` allowlist provably does not stop template/runtime init (`MARTECH.md`). It flagged ONE
load-bearing over-claim beyond that grounding: the draft asserted the **production live-attribution window** was
developer-reachable via an EDS deploy "subject only to org sign-off." That is wrong — a query-gated `?martech=airlock` arm
collects zero natural-traffic attribution, and defaulting it for real users suppresses their live conversion tracking,
which is a **container-owner revenue decision** regardless of who holds the deploy keys. Reconciliation notes: "CWV win"
over-claims a field improvement (the site's ad tags are TBT-dominant and INP/CLS-neutral, LCP already ~1.4s), and "provable
locally" overstates (localhost/preview resolve to the *dev* Tealium profile).

**Resolution applied:** the Recommended Decision, Option B (Cons), Consequences, Assumptions, and Open questions now state
the production live-attribution leg **re-inherits ADR-0018's container-owner gate** — the two-party dependency is removed
only for the developer-provable subset (Lighthouse/TBT win + event-level lab parity + scripted path). "CWV win" reframed to
"**Lighthouse/TBT (lab) win**" with the no-INP/CLS-change caveat; the honest test arena corrected to a **prod-Tealium-profile
host** (stage VPN-gated / production).

**Round 2 (confirmation) — substantive findings RESOLVED; residual mechanical only.** The reviewer confirmed both
substantive fixes landed and consistent, and found no new load-bearing flaw. The only residual was mechanical: three
surviving "host-scoped" tokens contradicting the corrected "pattern-scoped" decision (and ADR-0030), plus a "prod-profile
preview" precision nit (AEM previews resolve to the dev profile; no query-string escalates a host to prod). **Swept:** all
three tokens → "pattern-scoped"; the arena corrected (localhost AND AEM preview → dev profile; stage VPN-gated / production
are the clean prod-profile arenas).

**Final:** frame sound, mechanical residual cleared. VERDICT: **pass**.
