---
slice: 034-03 — composite/exposure refinements: `accepts(name)` + a wired emit hook
pass: craft
verdict: pass
reviewer: general-purpose (independent craft review)
reviewed_at: 2026-09-05T19:15:57Z
prompt_source: review.py craft docs/specs/034-alloy-config-followups/spec.md 034-03 <deliverables>
substrate: non-interactive
---

VERDICT: pass — craft, slice 034-03

createComposite.accepts is the pure predicate (connectors.some(acceptsEvent)); the push void-revert is safe (exposure sink was the only count reader). The deferred ref is correct: boot() mutates a const object in place so the reporter closure reads populated values lazily at deliver-time; timing watertight (deliver only fires post-boot on a page_view-returned decision) and even a pathological pre-population read degrades to drop+diagnose (never throws/misroutes). The reporter gates correctly (no-ref/accepts-false → drop, else emit) with distinct reasons; decisions-exposure.js keeps its {push} contract (absent from the diff). Tests discriminating (re-boot test asserts wired-called + swapped-NOT-called; accepts covers both branches). Nits (all cosmetic/follow-on, tracked): accepts/emit wrappers vs direct binding (defensible); compositeEmit naming; the unreachable pre-population drop-reason label.
