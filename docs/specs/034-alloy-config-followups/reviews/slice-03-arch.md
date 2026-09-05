---
slice: 034-03 — composite/exposure refinements: `accepts(name)` + a wired emit hook
pass: arch
verdict: pass
reviewer: general-purpose (independent arch review)
reviewed_at: 2026-09-05T19:15:58Z
prompt_source: review.py arch docs/specs/034-alloy-config-followups/spec.md 034-03 <deliverables>
substrate: non-interactive
---

VERDICT: pass — architecture, slice 034-03 (arch_review: true)

Architecturally coherent — and notably RESTORES a pinned contract: reverting push/pushCritical to void re-conforms to push-api.md/ADR-0002 ('push returns nothing meaningful; callers must not depend on a return value'), which 033-03's count-overload quietly violated (the exposure sink was the sole count reader — revert safe). accepts(name) is the right shape over an emit-result object: a pure vocabulary predicate decoupled from the write surface that dissolves the no-connector-accepted vs no-analytics-sink conflation (stays correct if a 2nd ['*'] sink boots). The deferred emit-ref genuinely fixes the reachable re-boot misroute — the reporter closes over the ref bound to the ORIGINAL composite (correct-destination-or-drop, never cross-session misroute; re-boot test proves it). The seam threads alloy-only (mirroring reservedPlacements), reads lazily, respects composite-owns-fan-out (emit→composite.push→GA4; alloy ignores → no loop). Scope proportionate (the misroute was confirmed reachable at frame-critique). 3 follow-on nits (non-blocking, tracked): disposed-composite silent-drop (untested path — consider nulling the ref on dispose); accepts widens the window.airlock surface (FLAGGED for the 037 1.0 pin); 5 positional args on bootConnector.
