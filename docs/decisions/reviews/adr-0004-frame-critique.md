---
adr: 0004
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (adversarial frame-critique)
reviewed_at: 2026-08-27T00:35:33Z
prompt_source: review.py frame-critique docs/decisions/adr-0004-egress-dispatch-delivery.md
---

# ADR-0004 frame-critique — VERDICT: PASS

An independent reviewer (jig:reviewer) ran the ADR-0020 adversarial frame-critique
against ADR-0004. The load-bearing premise — **sole-sender by construction, so no
worker ack/dedup protocol** — was subjected to the strongest attack (is there an
internal path where one logical event reaches both the worker and the fast path?)
and **survived**: `drain()` splices a batch out of the ring before `postMessage`
(`core/airlock.js`), and `unloadFlush()` reads only the ring, so a `push()` event
is in-ring XOR handed-to-worker, and a `pushCritical()` event touches neither. The
decision is grounded in spec 003's measurements and re-measured for the ADR
(`rig/teardown.mjs`, `test/egress-fastpath.test.js`).

## Non-blocking findings — all incorporated into the ADR before acceptance

1. **"Dissolves by construction" was overstated for the cross-API case.** The
   `push()`-XOR-`pushCritical()` contract is unenforced and silently double-counts
   if a site mixes a generic `push` tracker with the adapter's outbound-link
   `pushCritical` (ring-tail flush re-sends the ring copy). → Tightened the
   framing; disclosed the silent-double-count mode in Consequences; parked a cheap
   main-thread idempotency guard (viable because all dispatch is main-thread) in
   Open questions.
2. **Teardown evidence is a proxy** ("issued-within-window on a live page"), and the
   keepalive-survives-teardown half is the standard browser contract, not
   separately re-measured. → Acknowledged in Assumption 2 + kill-criterion #3.
3. **Consent-cost asymmetry imprecise** — ADR-0003 already crosses `consent_state`
   into the worker, so the advantage is send-time *freshness*, not a unique saving.
   → Corrected.
4. **Live projection snapshot not threaded** — the fast path maps with the static
   `ctx`, not the ADR-0003 per-event snapshot; invisible in the spike, load-bearing
   with real projection-fed mapping (the projection is main-thread-held, so
   reachable). → Added as Assumption + Open question.

Verdict PASS reflects the sound frame; the four notes were tightenings, now applied.
