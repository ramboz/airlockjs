---
slice: 011-01 — coherency rig + concurrent two-chamber writes
pass: craft
verdict: pass
reviewer: general-purpose (jig pr-review pass)
reviewed_at: 2026-08-29T02:41:45Z
prompt_source: review.py pr-review docs/specs/011-mvp2-coherency-probe/spec.md 011-01 --richer-skill pr-review
substrate: non-interactive
---

# Craft review — slice 011-01 (pr-review pass)

**Verdict: pass.** Verified by running: 22/22 vitest cases pass and the real
chromium two-Worker rig exits 0 with a scoreboard byte-matching the slice's
Findings table. Well-scoped (broker + two real Workers + real `document.cookie`
jar + sequenced RMW + coherency/staleness/identity-fault scoreboard +
fails-both-ways controls), fails closed, no correctness or security blocker for a
throwaway measurement rig.

## Strengths
- One deterministic, side-effect-free core (`chamberIdentityStep`, `runBroker`,
  classifier) shared three ways — the in-browser Worker, the Node rig driving two
  real Workers, and the hermetic vitest suite. Real-collaborator-over-double done
  right.
- The rig's exit code encodes the fails-both-ways self-check — the kill-criterion
  is executable; the instrument validates its own discriminating power.
- AC1 jar fidelity is measured, not assumed: `jar_lives_in_real_cookie` is read
  back out of the real `document.cookie` and compared every scenario.
- Window-width ≠ correctness is demonstrated empirically — the coherent
  broker-push control carries the *wider* staleness window (2 ops) than the
  faulting run (1 op). Directly closes the spec's Assumption 3 (the load-bearing
  result).

## Nits (log-not-block → reconciliation log)
1. `rig/coherency-model.mjs` `coherence()` filters out `undefined` caches then
   `[].every(...)`, so a missing/errored cache is silently treated as "agrees" and
   an all-empty set is vacuously `coherent:true`. Inert for this slice (the
   identity verdict still gates the rig, so it fails closed), but a latent trap
   once **011-02** adds out-of-band writers that can legitimately leave a cache
   absent — tighten to treat a missing cache as incoherent.
2. The "byte-identical across two consecutive **browser** runs" determinism claim
   is a manual observation; only the in-memory two-run byte-identity is
   machine-enforced. Consider having the rig re-run the browser scenarios once to
   make the claim executable.

## Reconciliation notes
- Both nits target the 011-02 extension, not defects in this slice's measured
  result.
- The static-server block (http server + MIME map + `startsWith(ROOT)` guard) is
  now duplicated across `rig/coherency.mjs`, `rig/isolation.mjs`, `rig/e2e.mjs`.
  A shared `rig/serve.mjs` helper is worth tracking (out of scope for this slice).

Reviewer: general-purpose (jig craft / pr-review pass).
