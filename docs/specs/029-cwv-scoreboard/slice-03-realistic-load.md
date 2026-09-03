---
status: DONE
dependencies: [029-01, 029-02]
last_verified: 2026-09-03
---

<!-- jig grounding (ADR-0020): R-007 (docs/research/R-007) classified ~21 real
     prod-stack tools; many are excluded-by-mechanism (session-replay, chat,
     identity), leaving ~10-15 INP-relevant wire-protocol/pixel/wrapped-SDK tags.
     rig/measure.mjs already takes TRACKERS + WORK env (uniform work per tracker). -->

## Slice 029-03 — a realistic martech load (the honest synthetic-representative version)

**Goal:** Raise the scoreboard's fidelity from the 5-tracker micro-fixture to a **grounded, heavier synthetic
load** — a `PROFILE=realistic` run reflecting R-007's ~10–15 INP-relevant real-stack tags — so the punchline is
measured against a load closer to what a real site carries. Honestly bounded: the realistic profile is
**synthetic + uniform-work** (not a varied real mix), and the **real customer stack stays DEFERRED** (creds /
availability-gated, per `mvp5.md`, which marks this slice "flexes on the customer stack being available").

**Explicitly NOT in this slice (deferred, honest):** (a) **varied per-tracker cost** — `rig/measure.mjs`'s
harness runs uniform `WORK` per tracker; a real stack has a spread (5–50ms) — the uniform load is a representative
average, not the true distribution; (b) the **real customer stack** — creds/availability-gated, the true
adoption-credible load; (c) the **RUM-subsume** (a separate MVP5 spec). This slice ships the grounded synthetic
heavier load + the honest bounding; it does not claim to be the real stack.

**No unproven load-bearing premise** (risk-gated): reuses the 029-01/02 engine + `rig/measure.mjs`'s existing
`TRACKERS`/`WORK` env; the ~12-tracker count is grounded in R-007; the real stack is explicitly deferred, not
asserted. Frame-critique is a formality unless a reviewer surfaces a hidden premise.

**DoR:**
- ✅ 029-01 + 029-02 DONE (the scoreboard + full before/after exist to parameterize).
- ✅ Grounded: R-007's ~10–15 INP-relevant tags; `rig/measure.mjs` respects `TRACKERS`/`WORK`.

**Acceptance Criteria:**

1. **A `resolveProfile(env)` maps a load profile to a grounded fixture.** `PROFILE=micro` (default) → the
   5-tracker / 30000µs micro-fixture; `PROFILE=realistic` → a grounded heavier load (~12 trackers, reflecting
   R-007's INP-relevant count). `TRACKERS`/`WORK` env still override either. A pure test asserts the mapping +
   the override.
2. **The scoreboard records + labels the profile.** The model's `fixture` carries `profile` (+ trackers/work_us);
   `PROFILE=realistic npm run cwv:scoreboard` runs the heavier load and the artifact/card label it "realistic".
   `main()` passes the resolved trackers/work to `rig/measure.mjs`. A test asserts the model carries the profile.
3. **Honest bounding — no "real stack" overclaim.** The card + `docs/scoreboard.md` state that the realistic
   profile is **synthetic + uniform-work** (a representative average, not a varied real mix) and that the **real
   customer stack is DEFERRED** (creds/availability-gated). A test asserts the card/docs disclose the synthetic
   limit + the deferral (never presents the realistic profile AS the real customer stack).
4. **`docs/scoreboard.md` documents the realistic profile** (how to run it + the honest limits + the deferred
   real stack), so the durable card reflects the fidelity ladder.
5. **No live identifiers**; the realistic profile is a synthetic tracker count, no live vendor endpoints/ids.

**DoD:**
- [x] All ACs pass; full real-repo suite green (**954**, worktree excluded; then +2 = 956 after the craft-fix
      tests). Additive to the 029 rig. `PROFILE=realistic INP_N=1 npm run cwv:scoreboard` verified end-to-end
      (12 trackers → naive p75=240ms, airlock below the floor, ~15× headline).
- [x] Coverage exercises each AC (resolveProfile mapping/override/NaN-fallback; profile-in-model; the
      honest-bounding disclosures in card + docs, with a note-only assertion).
- [x] Each new test shown to fail when its feature is removed — a `resolveProfile`-always-micro mutation redded 3.
- [x] Reviewed by independent reviewer; **compliance PASS + craft PASS** (the honesty crux confirmed; 2 nits fixed).
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [x] Primer hygiene on spec close: **OQ6 scoreboard-surface residual RESOLVED by spec 029** in `refinement-todo`
      (the architecture OQ6 line already credits spec 007/ADR-0005 for the measurement contract); board Notes on
      029-01's row carry the load-bearing invariant.

**Anti-horizontal-phasing check:** after this slice `PROFILE=realistic npm run cwv:scoreboard` measures the
punchline against a grounded heavier load, honestly labeled synthetic — the fidelity ladder's next rung, with the
creds-gated real stack cleanly deferred. Closes spec 029.

### Deviation log (after reconciliation)

1. **Synthetic-representative, not the real stack (honest by design).** `resolveProfile(env)` adds a `realistic`
   profile (~12 uniform trackers, R-007's INP-relevant count) reusing `rig/measure.mjs`'s `TRACKERS`/`WORK` env;
   the artifact labels the profile + discloses the SYNTHETIC + uniform-work limit and the **deferred** real
   customer stack (creds-gated). Verified end-to-end: 12 trackers → naive p75=240ms, airlock below the floor.
2. **The ~15× is honest, not gamed (craft crux).** The naive arm mechanically scales with load
   (`INP ≈ trackers × work`), airlock's O(1) capture stays flat — the vision's "wins-heavy-load" thesis. The
   multiplier is **floored** (240/16 → 15, under-claiming vs the ~30× at 240/8), disclosed ("naive scales with the
   load"), and the per-tracker work was **lowered** 30→20µs vs micro (conservative). `work_us=20000` is a
   slice-authored representative average of R-007's 5–50ms spread (R-007 classifies by archetype/count, not per-tag
   INP cost) — defensible + below both the ~27.5ms mean and micro's 30ms.
3. **Two craft nits fixed inline.** (a) A non-numeric `TRACKERS`/`WORK` override now falls back to the profile
   base (`Number(x) || base`) instead of passing `"NaN"` to the harness. (b) The AC3-card test gained a note-only
   assertion (`/representative average/i`) so the disclosure block has independent teeth (the reviewer noted the
   other strings are also satisfied by the provenance line).
4. **`runMeasure` signature change** (now takes a `fixture`) has exactly one caller (`main()`); `cwv-budget.mjs`'s
   own single-arg `runMeasure` is a separate function in another file — no collision. Additive; no runtime code.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entrypoint change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (029-03 → DONE; **spec 029 complete**). |
| `docs/product-vision.md` | `no-op` | The scoreboard validates the vision's punchline; the prose is unchanged. |
| `docs/architecture.md` | `no-op` | OQ6's measurement-contract line already credits spec 007/ADR-0005; the scoreboard-artifact resolution is recorded in refinement-todo. No module boundary changed. |
| `docs/refinement-todo.md` | `updated` | **OQ6 scoreboard-surface residual RESOLVED by spec 029** (the punchline is now a first-class reproducible output). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `checked` | 029 is not in CLAUDE.md's Active specs (only 001) — nothing to compress; a DONE spec needs no primer entry. |
| `docs/scoreboard.md` | `updated` | The committed card gained the load-profiles (fidelity ladder) note. |
| `docs/inbox.md` | `no-op` | The lh-eds banner item (029-02) stands; nothing new. |
| `docs/memory/**` / `docs/decisions/**` | `no-op` | Nothing cross-session; routing rides ADR-0005. |

**Reconciliation review — PASS (self-recorded, jig:reviewer prompt-source).** 029-03 adds the grounded realistic
load profile, honestly bounded (synthetic + deferred real stack), closing spec 029 — the CWV scoreboard is now a
first-class, reproducible, honestly-hedged before/after (INP triple + load-CWV + a fidelity ladder). The honesty
crux (the ~15× scaling) is confirmed sound; both gating passes PASS; the two craft nits fixed. Spec-close hygiene
done (OQ6 scoreboard residual resolved). Additive, suite green. No orphans. Ready RECONCILED → DONE.
