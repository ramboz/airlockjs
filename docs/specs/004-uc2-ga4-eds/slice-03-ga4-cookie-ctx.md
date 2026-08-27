---
status: DRAFT
dependencies: [004-02, adr-0003]
last_verified:
---

## Slice 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)

**Goal:** the orchestrator sources the GA4 identity context on the **main thread** —
`client_id` from the `_ga` cookie (defensive parse; generate + persist a first-party
one when absent), `session_id` from `_ga_<stream>` — and hands the connector the
**minimal ctx snapshot** (ADR-0003), so a real MP payload carries a real, GA-continuous
`client_id` / `session_id`.

**DoR:**
- ✅ 004-02 done (runtime boots + captures on the real page).

**Acceptance Criteria:**

1. **Defensive `_ga` parse.** A pure parser extracts `client_id` (the cookie's last
   two dotted segments `<random>.<unix-seconds>`) and tolerates GS1/GS2 drift +
   malformed/absent cookies (ga4-mp.md § `client_id` & `session_id`). Unit-tested
   against real-shaped and malformed inputs.
2. **Persist when absent.** When no `_ga` client_id is present, the orchestrator
   generates one and persists it via the mediated cookie capability
   (`GrantedCapabilities.cookies.set`, async, main-thread — [capability.d.ts](../../../contracts/capability.d.ts)).
3. **`session_id` from `_ga_<stream>`.** Extracted and passed as `ctx.sessionId`;
   absent/malformed degrades to a documented fallback, not a throw.
4. **Minimal ctx only (ADR-0003).** Only `client_id` / `session_id` (+ existing
   `engagement_time_msec` / optional consent) cross to the connector — no raw cookie
   string, no ambient identity. The connector requests no `document.cookie` access.
5. **Real payload conforms.** The MP payload built from the cookie-sourced ctx passes
   `ga4_mp_conformance` (schema + a golden fixture for the UC-2 event).

**DoD:**
- [ ] ACs 1–5 pass; unit tests cover the `_ga`/`_ga_<stream>` parser (valid, GS2,
      malformed, absent) and the generate-and-persist path (mocked cookie capability).
- [ ] Each new test shown capable of failing.
- [ ] Reviewed by `reviewer` subagent; implementation review passed.
- [ ] Deviation log + reconciliation sweep.

**Anti-horizontal-phasing check:** after this slice, a real interaction on the page
produces an MP payload with a real, GA-continuous `client_id` / `session_id` —
analytics that would actually attribute to a session, sourced without gtag.
