---
slice: 013-01 — real Edge round-trip + mint-recognizability
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T04:48:42Z
prompt_source: review.py frame-critique docs/specs/013-mvp3-live-alloy-reprobe/spec.md 013-01 slice-01-edge-roundtrip.md
---

## Frame-critique — slice 013-01 (real Edge round-trip + mint-recognizability)

**Round 1 verdict: needs-changes** (general-purpose reviewer, bounded ≤7-file context:
ADR-0008, 012-02, alloy-chamber.worker.js, alloy-coalescing.mjs, R-004). Five findings —
two load-bearing; **all five applied**, so the resolved framing passes. No new premise
introduced by the fixes.

### Findings + resolution

- **[1] over-claimed (minor) — reconciled.** spec.md's "request-side mint-recognition
  already established — do not re-probe" contradicted the slice's own AC2, which *does*
  re-check the live request (correctly: a real datastream's consent/provisioning can add
  request `query` fields the stub-config never exercised). **Fix:** spec.md reworded to
  "expected to hold (same stock bundle); cheaply **re-confirmed live** in 013-01 AC2" — the
  do-not-re-probe line is gone.

- **[2] over-claimed (LOAD-BEARING) — restructured.** The all-or-nothing "every slice
  credential-gated" frame hid that the single most decision-relevant output — does the real
  *response* shape satisfy `extractEcidFromInteractResponse` (the ADR-0008 kill-criterion
  axis) — needs creds only **once**. **Fix:** AC2 restructured to **one-time-capture → redact
  identifier _values_ (shape is not secret) → hermetic replay** against the pure
  recognizer/extractor `rig/alloy-xdm-mint.js` (relocated import-clean in 012-02 for exactly
  this) as a **durable `test/` fixture**. The kill-criterion evidence is decoupled from
  standing creds; the DoR + spec.md Assumptions now scope creds to the *live-traffic* ACs
  (AC1 round-trip, AC3 timing) and leave a creds-free regression behind.

- **[3] sound — no change.** Genuine timeboxed spike with an articulated downstream fork
  (CONFIRMED clears the mint-axis freeze condition / FAILED opens the host-seeded-identity
  superseding ADR ADR-0008 already named). Not research-then-build.

- **[4] over-claimed (mild) — clarified.** The Goal over-read a green 013-01 as clearing "the
  wrapped-SDK contract-freeze." **Fix:** Goal + spec.md decomposition now state a green
  013-01 clears ADR-0008's **mint axis** — the last of its three freeze-hold conditions
  (interception + mint-recognition + coalescing; the second kill-criterion,
  unmodified-bundle interception, is live-invariant and already cleared in 012-01, not
  re-probed) — **necessary, not sufficient**: the broader contract-freeze still awaits
  013-02 (fan-out) + 013-03 (config-integrity).

- **[5] over-broad hedge (LOAD-BEARING) — floored.** The DoD's "ACs pass … or the deviation
  is honestly recorded" blanketed the spike's own floor — applied to AC1 it would let 013-01
  be DONE having never captured a real response (never answering its Question). **Fix:** DoD
  now carries an **un-waivable floor** — (i) AC1 real round-trip + response captured; (ii)
  AC2 recognizer/extractor run + boolean/drift recorded (FAILED is valid, "didn't check" is
  not); (iii) AC4 CONFIRMED/FAILED verdict — none waivable by "characterize honestly." Only
  AC3's *live determinism* stays best-effort, and the DoD now **names the method gap**: 012's
  determinism came from a gate-able stub (hold response 1 until mint 2 arrives); real Edge is
  un-gateable, so a deterministic live window may be unconstructable — lean on 012-02's
  hermetic coalescing-correctness proof, use live only to confirm the mechanism doesn't break.

### Net
The frame was fundamentally sound (a real, well-shaped spike with a pre-named fallback); the
two load-bearing fixes were cheap at authoring time and materially change both what a green
013-01 *means* (mint-axis, not the whole freeze) and how it is *run* (capture-once → creds-free
replay; a hard floor under AC1/AC2/AC4). Slices 013-02/03 unchanged this round.
