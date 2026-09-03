---
slice: 028-01 — the decision-stream read-layer + query
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T20:05:52Z
prompt_source: review.py frame-critique 028 spec.md 'read-layer' + deliverables
---

**Verdict: PASS** (adversarial pass returned **NEEDS-CHANGES**; all must-fixes applied → frame now sound).

The frame-critique (independent reviewer, read-only, pre-implementation) confirmed the **core premise is
sound** — the enforcement decisions really are already emitted as structured `{level, kind, disposition, ...}`
records at 21 sites, so "read-layer, zero new instrumentation" holds — but caught one **load-bearing
operational error** in how slice-01 built on it, plus a mis-prioritized residual.

**The catch (load-bearing):** `onDiagnostic` is **three separate constructor injectables**, not one —
`createAirlock` (`core/airlock.js:57`, 10 sites), `createWrappedSdkHost` (`core/wrapped-sdk-host.js:171`, 8
sites incl. **every `config-integrity` decision** + the whole alloy/wrapped-SDK egress path), and
`createDomApplyCoordinator` (`adapters/eds/dom-apply.js:89`, 3 `dom-apply-*` sites). Slice-01 AC1 wired the
collector on `createAirlock` **only** → blind to 11 of 21 sites, including all `config-integrity` (one of the
seven named teeth). That would have shipped an inspector *worse* than the console baseline and regressed the
"beats Zaraz's opacity" claim; slice-02's correlation scope and slice-03's panel inherited the blind spot.

**Secondary (verified, folded in):** the residual the spec *originally* flagged — worker-side `diagnose()`
staying console-only — is BENIGN: `core/chamber.worker.js` calls `diagnose()` zero times; drops cross via
`postMessage`→`airlock.js:268` and crashes via `worker.onerror`→`airlock.js:280`. The original Assumptions
guarded the harmless residual while missing the damaging three-seam split.

**Must-fixes applied (2026-09-03):**
1. spec.md § Overview + § Assumptions + slice-01 Goal/AC1 — the collector is **one shared instance wired as the
   `onDiagnostic` sink on all three constructors**; a `createAirlock`-only wiring is now an explicit AC1 FAIL.
2. slice-01 AC1's exercised paths now include `config-integrity` (via `wrapped-sdk-host`) and the `dom-apply-*`
   family — the previously-absent teeth are tested.
3. spec.md § Assumptions #2 + slice-02 DoR — correlation threading enumerated across **both egress hosts**
   (`createAirlock` + `createWrappedSdkHost`), not "~9 airlock sites"; `dom-apply-*` scoped out (DOM mutation,
   not a beacon).
4. The worker residual recorded as verified-benign, not an open gap.

The fix is strictly a broadening toward completeness (three grounded wire points, all enumerated) — it
introduces no new unproven premise. Core read-layer premise intact + all named gaps closed → **PASS** to
implement.
