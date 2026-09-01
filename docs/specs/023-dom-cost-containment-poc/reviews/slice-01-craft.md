---
slice: 023-01 — costly tag contained + measured (the INP scoreboard)
pass: craft
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T20:13:29Z
prompt_source: review.py craft
substrate: non-interactive
---

Craft (023-01) — PASS (orchestrator-scrutinized in depth — this is the headline proof). The MEASUREMENT is honest + rigorous, which matters most: (1) FAIRNESS — the fixture runs the IDENTICAL nastyStep over the IDENTICAL pre-collected items both modes; the harness CHECKS same_total_work (naive.workCompleted === airlock.workCompleted, 6000/6000 observed, not asserted). (2) CORRECT INSTRUMENT — raw Event-Timing PerformanceObserver (verbatim from harness.html), NOT onINP; inp_p75 = pct(latencies,75). (3) POISON AVOIDED — querySelectorAll runs ONCE at load (collectMs measured 0.2ms, <0.15% of naive), off the interaction path — confirmed, not asserted (AC3 must-fix). (4) HONEST — N=3+median+band, fresh browser/run, pinned cadence, a TRANSPARENT "decisive" threshold (airlock<=200ms AND >=2x), rig exits non-zero on falsification; airlock's numbers are a conservative upper bound (many clicks under the 16ms Event-Timing floor). FIRST-CHUNK DISCIPLINE genuinely enforced: scheduler.chunk budgets every batch (incl. the first) identically by construction (async → the first batch runs synchronously up to the first await = the INP-counted first task), progress-guaranteed (>=1 item/batch), isInputPending early-yield; the capability adds NO un-chunked prefix; the 16ms airlock result ~= the 10ms budget proves it. The breakdown grouping-by-interactionId (mirroring web-vitals' onINP) is a real bug the implementer caught + fixed. Fallback chain exercised for real (Node MessageChannel unit + a browser ?yield=fallback run). SCOREBOARD: naive p75=200ms -> airlock 16ms (12.5x, 184ms delta); containment visibly from shrinking the long task (processing 200->11ms). 24/24 unit, lint clean. Thesis HELD — honestly scoped to this chunkable layout-thrash fixture (querySelectorAll-heavy / monolithic = Lever 2/POC-B, named). No over-engineering.
