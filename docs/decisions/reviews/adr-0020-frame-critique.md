---
adr: 0020
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T14:48:29Z
prompt_source: review.py frame-critique docs/decisions/adr-0020-parity-contract-anti-drift.md
---

Frame-critique verdict: **pass** (round 2, independent `jig:reviewer`, read-only). Round 1 returned `needs-changes` on one blocking issue — the "shrinking cohort / Chrome third-party-cookie deprecation" framing was factually wrong (Google reversed Chrome's deprecation in 2024–2025) and contradicted ADR-0018:56, which would have biased E10 toward silently dropping a parity-critical path for the Chrome majority. Corrected: commitment 3 + Assumptions now state present-tense "Chrome default still allows; Safari/Firefox block (stable)", call credentialed transport parity-critical for the Chrome-majority cohort, and hand the cohort-size/trend question to E10 rather than asserting it. Round 2 passed.

**Highest-risk load-bearing assumption:** the "drift-guarded" claim (commitment 2) — that the harness is a continuous regression guard where vendor drift surfaces as a new `dropped` field. Reality: the oracle diffs against a *stored* capture, so it autonomously catches only airlock-side regressions; vendor-side drift is caught only on re-capture, and a stale capture can false-green a drifted connector. The ADR pre-empts this in its own kill criterion ("if captures go stale, the guard reduces to point-in-time parity") and flags cadence+owner as an open question — an owned residual, not a hidden flaw.

**Grounding independently verified:** `connectors/pixel/vendors/meta.js:9-14` (omits `_fbp`/`fbc`/`ud[...]`); `core/airlock.js:48-50` (no `credentials`/`mode`); `contracts/ga4-mp.md:3-4` (versioned, machine-validatable contract); `R-007 §6` (mechanism-based exclusions). The web-platform mechanics (3p cookie unreadable by page JS; Worker `credentials:'include'`/`no-cors` attaches it where the browser allows) are sound and consistent with ADR-0018:56.

**Three non-blocking notes, all applied as wording-precision fixes (frame unchanged):**
1. Commitment 2's prose overstated autonomy (read as autonomous vendor-watching) → reworded to "only as live as its captures"; the load-bearing dependency is the capture-refresh cadence, not the harness alone; a stale capture can false-green.
2. "bounded to stable, documented beacon protocols" was loose for Google Ads AW / Floodlight DC (reverse-engineered) → reworded: bounded because beacon-not-SDK; AW/DC are reverse-engineered, mitigated by recapture not documentation.
3. Internal looseness — `_fbp`/`fbc` "dropped" (commitment 1) vs "airlock can emit" (commitment 3) → disambiguated as "architecturally reachable once the cookie-capability lands"; and "server-side CAPI" clarified as the vendor/adopter's complementary path, NOT an airlock client-side deliverable.
