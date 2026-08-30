---
slice: 012-02 — concurrent-chamber mint coalescing (lift ADR-0008's hold)
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T01:00:09Z
prompt_source: review.py frame-critique
---

**Verdict: pass** — one adversarial frame-critique round (independent general-purpose reviewer); all five load-bearing premises sound. The reviewer traced the real mechanism end-to-end (worker fetch-shim → postMessage → main-thread dispatch → stub) before adjudicating.

- **[1] The measurability trap (011-04) is NOT repeated — sound.** The slice claims *deterministic construction* of fault + fix, not *measuring an emergent race*. It escapes the op-model's limit for two concrete reasons: (a) 012-01's worker fetch-shim does no real worker fetch — the real async network round-trip runs on **main**, creating a genuine in-flight window; (b) each chamber has its **own** sync-cookie cache seeded once at boot with no mid-flight reseed, so two chambers booted from an empty jar **both reliably read empty and both mint**. Single-threaded-broker serialization is the *enabler* of deterministic coalescing, not a defeater of measurement.
- **[2] No coalescing gap — sound.** Main is single-threaded and request A registers in the in-flight table synchronously inside A's handler (before the awaited real fetch), so B's handler always sees A. "Both dispatched before the table sees the second" is structurally impossible. Invariant: register synchronously before awaiting dispatch.
- **[3] XDM mint-recognition feasible — sound, better-grounded than claimed.** 012-01 already parses real alloy-emitted XDM (`query.identity.fetch` includes "ECID"); only the Edge *response* is stubbed, the *request* is genuine unmodified-alloy output. Live residual (multi-event bundling, exact array, real response shape) carried forward, matching ADR-0008's re-probe kill-criterion.
- **[4] No SAB / model-independent — sound.** postMessage-based interception; coalescing at the main-thread broker; inherited from accepted ADR-0008.
- **[5] "Lifts the freeze" scoped — sound, two tightenings.** Live-Alloy gap honestly bounded (creds-gated).

**Four tightenings the reviewer named — all applied before implementation:**
1. **[1] Name the response-timing-control dependency** behind AC2/AC5's determinism — AC5 now states the minting stub is **gate-able** (holds the first response until the second mint has arrived), so the in-flight window is *constructed*, not raced-for.
2. **[2] The synchronous-register invariant** — AC2 now states the broker registers the mint synchronously inside the handler before awaiting dispatch.
3. **[1/2] The completed-mint association** — AC2 now suppresses a *late* B (arrived after A completes but before B minted) via a retained completed-mint association, not only the in-flight hold.
4. **[5a] "hold lifted" ≠ "contract frozen"** — Goal + AC6 now state 012-02 lifts the *hold* (demonstrates the mechanism) but does **not** authorize the step-5 freeze, which still awaits the creds-gated live-Alloy re-probe. **[5b]** Goal now notes 012-02 **chooses** intercept-and-coalesce over ADR-0008's flagged host-seeded-identity alternative.

Recorded by: author, after one independent frame-critique round (pass), with the four tightenings applied.
