---
slice: 025-03 — a real tag (Prism) through the mirror: `innerHTML` + a sanitized apply, INP-measured
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T04:45:41Z
prompt_source: review.py craft docs/specs/025-worker-dom-mirror/spec.md 'real tag'
substrate: not-shown
applied_skill: none
---

**Verdict: PASS.**

Craft pass over slice 025-03 — the load-bearing question is *is the governed-vs-naive rig FAIR?*, because an
unfair rig would make the net-regression verdict (governed ~2× naive) either a false alarm or a false green.
The rig is fair; the two residual asymmetries are sub-millisecond and partially offsetting, and neither can
flip a 12.6ms gap.

- **Both sides do the SAME visible work.** Naive writes Prism's `innerHTML` on the main thread; governed
  routes the identical highlight output through the mirror's sanitized `setInnerHTML` apply. Same fixture
  (`SAMPLE_LINES`), same Prism, same output DOM. The comparison is like-for-like on the tag's actual behavior.
- **The measurement window is the right one.** Both measure the apply-window p75 (023's within-storm method),
  NOT the async-decoupled click-p75 that 025-02 established is a false-green for the apply. `governedClickP75
  = 0ms` is reported alongside precisely to show the decoupling empirically — the honest move.
- **Residual asymmetry #1 (governed biased WORSE):** governed's window also includes a sub-ms `SET_TEXT`
  reset + 3 status `setAttribute` ops that naive's window excludes. This makes governed look *slightly worse*
  than a strict apples-to-apples — i.e. it can only *shrink* the real gap, never manufacture it. <1ms vs the
  12.6ms gap. Disclosed in the Deviation log.
- **Residual asymmetry #2 (drift risk, not current unfairness):** `SAMPLE_LINES` is hand-duplicated across
  the naive harness and the governed author with no sync-assertion. Current copies verified byte-identical, so
  the present run is fair; a byte-identity assertion is the right follow-up to keep it fair when next touched.
- **The causal story holds under inspection.** The regression is the sanitize round-trip (main-thread
  `DOMParser` parse + whole-tree walk + reserialize over the 148KB *output*) exceeding the off-thread
  tokenization savings on the 12KB *input*. That is inherent to blob-`innerHTML`, not a rig artifact — which
  is exactly why the finding generalizes to the innerHTML-heavy tag class, not just this one fixture.

**Doc nit (non-blocking):** the connector-selection seam doc notes the `onmessage` takeover but not that
`onerror`-diagnostic ownership transfers to the adapter once it reassigns `worker.onerror`. Captured in the
Deviation log. No code change owed.

The rig earns the verdict it produces. The net-regression is a real property of the tag class, honestly measured.
