---
status: DONE
dependencies: []
last_verified: 2026-11-13
---

## Slice 066-02: MT2, candidate settings list and completeness-probe protocol

**Goal:** The candidate pixel-settings list (spec 066 section 3) is extended from public Meta documentation and the retained config, and the completeness-probe protocol (6.1) names its exact public site list and method, so the owner's settings window (O2) and the approved probe (O4) are ready to run.

**DoR:**
- Spec 066 approved by the owner as amended (O1, 2026-11-13).
- O4 approved (dated in spec 066 10.1): crawl data first, plain-GET fallback.

**Acceptance Criteria:**

1. Section 3 lists SET1 to SET9 and any further candidate found in public Meta docs or the retained config. Each has its triggering page input and its owning M-slice. Each carries the three no-effect conditions (propagation wait, served config bytes checked, triggering input present).
2. The settings window plan states the number of states (SET1 to SET7, SET8 capped at 3, SET9, plus the restore), the one-change-per-step order, and the per-change wait. It fits the O2 answer (about 2.5 hours, same day as the Adobe window, overlapping waits).
3. The probe protocol names the public crawl-data source and, for the fallback, the public site list. It states the 60 homepage GETs cap, the one config GET per pixel found, the 30-pixel sample, the 10% threshold (4 of 30) and the metric (6.1). The site list name replaces the placeholder in 10.1.
4. The protocol is written but not run. It runs only inside 066-04 or after, using the O4 approval.
5. No network call to Meta or to any site. Reading public documents is allowed.

**DoD:**
- Sections 3, 6.1 and 10.1 of spec 066 updated with a dated note. `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** 066-04 (CAP) runs the settings window and the completeness probe from this slice's output.

**Anti-horizontal-phasing check:** A read-only planning task with a reviewable list as its end state.

### Deviation log

1. **Review-driven protocol changes (2026-11-13).** The independent review (Opus 5.5) found five points, all fixed in spec 066: redirects are not followed in the fallback (keeps the hard 60-GET cap); the EEA split applies only to configs fetched by GET; a rate above 10% fails at any sample size and a lower rate under 30 samples is `inconclusive`; the window plan states elapsed time as changes x (wait + recording + change) with a count derived from the measured first wait; a pre-window Events Manager check fixes the SET8 state count.
2. **EEA and non-EEA pairs.** 6.1 had "ten configs fetched from both exits". O4 allows one config GET per pixel, so the pairs are out unless the owner extends O4. Recorded as the one open owner question.
3. **SET8 list is provisional.** It comes from module names in `pageview-disposition.json` and spec 062, not from the config bytes, because MT1 is blocked on the private bytes. Stated in section 3.
4. **No public-doc setting beyond SET1 to SET7** was found in the two Meta pages read. The AC allows "any further candidate", so this is a finding, not a gap.

### Reconciliation sweep

- `docs/specs/066-meta-parity-inventory/spec.md` sections 3, 3.1, 6.1, 10.1: updated (dated 2026-11-13). Section 12 log: updated.
- Slice 066-03 DoR line about 064-03: corrected by the coordinator's instruction.
- Slice 066-04 AC5 and spec sections 3.1, 5.1 and O2 (window model, round-2 review): aligned to 3.1.
- `docs/specs/README.md` board: regenerated at the DONE transition.
- ADR-0061 and ADR-0062: not touched.
- No other doc, glossary or refinement-todo entry needed (no new term, no deferred decision beyond the open question above, which lives in 6.1).
