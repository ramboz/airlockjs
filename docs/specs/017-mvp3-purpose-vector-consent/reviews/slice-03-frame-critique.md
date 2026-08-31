---
slice: 017-03 — seal hold-pending + strict-drop
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T02:09:00Z
prompt_source: review.py frame-critique 017-03 (needs-changes → applied)
---

## Frame-critique — 017-03 (seal hold-pending + strict-drop) — needs-changes → applied → pass

**Primary (load-bearing):** AC2's flush-on-arrival claimed beacons flush "via the 017-01 seam" on a
pending→granted transition — but 017-01's seam is BOOT-TIME-ONLY (it explicitly deferred mid-session updates;
core/consent.js is a PURE resolver; the airlock handle has no consent-update method — grep: only
push/pushCritical/getState/flushNow/stats). So flush-on-arrival was unimplementable: a held beacon stays held
forever, and the DoD even deferred the very mechanism AC2 needed. **Applied (reviewer's fix, = my hypothesis):**
017-03 BUILDS its own main-thread consent-update path — a mutable orchestrator-owned consent vector +
setConsent(vector) handle method; held beacons are already-mapped `ready` requests, so flush = a pure
main-thread re-fetch(url, body), NO worker. This is DISTINCT from 017-01's deferred worker ctx re-send (which
governs only the reshape ① — flushed beacons carry boot-time reshape, a named residual). The DoD no longer
contradicts itself (seal flush built here; worker reshape re-send + revoke-stop stay deferred).

**Secondary (applied):** the sync/unload fast path (core/egress.js) has no "later" to flush to at teardown →
a pending beacon there is DROPPED, not held (both-sites parity honest: async = hold+flush, sync/unload = drop).
Otherwise a pending beacon egresses un-held on the unload path, violating the slice's own goal.

**Minor (applied):** DoR mis-cited 016-01's ceiling as living in core/egress.js — it's only in core/airlock.js
(corrected). AC3's strict-regime declaration: ADR-0007 leaves WHERE it's declared an open question ("pin with
the seam contract") — AC3 now names it as choosing the simplest available option (a boot property), not
reading a pinned decision.

### Net
017-03 owns the main-thread seal-hold/flush/drop (setConsent + per-purpose buffer + re-dispatch); the worker
reshape mid-session update stays deferred. Flush + sync-drop are now implementable + honestly scoped.
