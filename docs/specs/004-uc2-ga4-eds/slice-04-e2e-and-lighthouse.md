---
status: DRAFT
dependencies: [004-03, adr-0004]
last_verified:
---

## Slice 004-04 — end-to-end GA4 + before/after Lighthouse

**Goal:** close the UC-2 loop on the real page — a real interaction delivers an
MP-conformant GA4 beacon end-to-end (capture → cycle → map → egress), the
unload-critical outbound-link / closing-pageview beacon takes the ADR-0004
`pushCritical` fast path, and a **real before/after Lighthouse** on the testbed page
shows ~zero CWV cost. This is the UC-2 punchline (the before/after scoreboard,
product-vision § Use cases).

**DoR:**
- ✅ 004-03 done (real cookie-sourced ctx → conformant payload).

**Acceptance Criteria:**

1. **End-to-end delivery.** A real interaction on the testbed page (the hero CTA
   click → a GA4 event) results in an MP-conformant beacon reaching the collect
   endpoint (stubbed/intercepted in the harness; optionally the live
   `/debug/mp/collect` reports no `validationMessages`, non-blocking).
2. **Unload-critical fast path wired (ADR-0004).** The outbound-link click
   (`/signup`) and the closing `page_view` are dispatched via `pushCritical` — the
   `adapters/eds/` outbound-link delegation + `pagehide` hook the ADR calls for —
   and delivered within a teardown window (reuse `rig/teardown.mjs`'s method on the
   real page).
3. **Before/after Lighthouse.** A real Lighthouse run on the testbed page with the
   runtime **off** vs **on** (bundled + lazy) reports the performance score and the
   CWV deltas (LCP/TBT/CLS) as concrete numbers — target: ~0 delta (the spike's
   prediction, now tested on the real page).
4. **Honest scoreboard.** The before/after numbers are recorded with the run
   conditions (throttling, cold/warm); if the LCP delta is not ~0, it is
   characterized (not hidden) — jig-supervised, human-read.

**DoD:**
- [ ] ACs 1–4 pass; the end-to-end flow and the Lighthouse run are reproducible
      (documented commands).
- [ ] `ga4_mp_conformance` green for the UC-2 event (hermetic).
- [ ] Reviewed by `reviewer` subagent; implementation review passed.
- [ ] Deviation log + reconciliation sweep; spec 004 Findings + Outcome filled;
      mvp1 release plan's UC-2 row updated to reflect the demo landing.

**Anti-horizontal-phasing check:** after this slice, UC-2 is a believable demo on a
real EDS page — a captured interaction becomes an MP-conformant GA4 beacon at ~zero
CWV cost, with the last beacon rescued — exactly the "demo a skeptical EDS
practitioner believes" the release appetite asks for.
