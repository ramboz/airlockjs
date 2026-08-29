---
slice: 011-02 — out-of-band write coherency
pass: craft
verdict: pass
reviewer: general-purpose (jig pr-review pass)
reviewed_at: 2026-08-29T03:33:20Z
prompt_source: review.py pr-review docs/specs/011-mvp2-coherency-probe/spec.md 011-02 --richer-skill pr-review
substrate: non-interactive
---

# Craft review — slice 011-02 (pr-review pass)

**Verdict: pass.** Extends the 011-01 rig exactly as scoped (three out-of-band
sources + per-source scoreboard), no drift into runtime code, server-side/CNAME
Set-Cookie correctly out of scope. Rig green (exit 0, `pass:true`, 34/34 vitest,
all self-check legs). The load-bearing negative result (`cookieStore` `change`
does not fire for `document.cookie` writes → detection degrades to polling) is
defended against the broken-probe alternative — the single best decision in the
slice.

## Strengths
- `validateCookieStoreListener` proves the `change` listener fires (via
  `cookieStore.set()`, 0ms) BEFORE concluding it misses `document.cookie`/cross-tab
  writes — converts a would-be broken-probe negative into a defensible platform
  finding (`listenerValidated:true` while `change_fired:false`).
- The same-origin `Set-Cookie` negative is non-vacuous: it asserts a *different*
  cell was actually written (`otherCookieWritten===true`) alongside the identity
  cell untouched; readable-header check grounds R-006 F4
  (`set_cookie_header_readable:false`).
- `oobDecomposition.reconciledToOobValue` is the sharp disambiguator: coherent +
  window-closed is still a FAULT when it closed to the chamber's own duplicate
  rather than the foreign identity. Captures window/coherence ≠ correctness for the
  oob case.
- New tests non-vacuous (absent-cache cases fail under the old `filter+every`
  behavior; identities-preference case fails if removed); determinism pinned
  hermetically + across two browser loads.

## Nits (log-only → reconciliation)
1. `foreignScriptDetectable`/`secondTabDetectable` are near-tautological pass-gate
   legs (`pollingDetected` for a synchronous same-document write is always true);
   the real content (`detection_mechanism==='document.cookie-polling'`) is recorded
   but not gated. Defensible (matches DoD intent), but gating on the expected
   mechanism would make the leg discriminate — **carry to 011-03 if reused**.
2. File banners read "(spec 011-01)" though both carry 011-02 code. Trivial drift.
3. `detectionLagOps` is a function of step position, not measured latency;
   disclosed but easy to conflate (empirical latency is separately
   `cookieStoreChangeLatencyMs`).
4. `foreignScriptWrite` and `writeAmcvCookie` byte-identical (only provenance
   differs); a "deliberately identical" note would preempt a dead-dup reading.

## Reconciliation notes
- All log-only; none block REVIEWED. Every finding self-classifies `[impl]`, none
  `[spec]` — the frame-critique paid off.
- Rig robustness: timing-bounded polls fail RED (exit 1) never false-GREEN; the
  load-bearing verdicts live in the deterministic model scenarios (hermetic vitest).

Reviewer: general-purpose (jig craft / pr-review pass).
