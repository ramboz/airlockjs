---
slice: 017-02 — storage consent deny (cookie capability + ephemeral id)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T01:48:46Z
prompt_source: review.py frame-critique 017-02 (needs-changes → applied)
---

## Frame-critique — 017-02 (storage consent deny) — needs-changes → applied → pass

**Finding (load-bearing):** the draft gated the persistent WRITE (skip cookies.set), but sourceGa4Ctx READS
the existing _ga FIRST (cookies.js:138) and short-circuits the generate+write on `if (clientId === null)`.
So a valid persisted _ga already in the jar is used+returned — the beacon carries the persisted, cross-page
client_id UNDER denial (a persistent-id leak, the exact thing analytics_storage:denied prevents), while the
write-gate is a no-op and the empty-jar E2E greens falsely. ADR-0007 says "drop the persistent client_id"
(stronger than a write-gate). Two valid secondaries: (a) the write does NOT live in adapters/eds/ — read +
parse-and-use + write are all INSIDE sourceGa4Ctx, so the gate must be threaded there, not at the adapter
(downstream of the read); (b) session_id also reads persisted _ga_<stream> under denial, and the slice was
silent on it. (Survived: analytics_storage IS the right signal; ephemeral premise correct; per-page-ephemeral
honestly bounded.)

**Applied:** reframe from gate-the-WRITE to gate-the-READ-AND-USE, INSIDE sourceGa4Ctx, threaded from the
adapter. Denied → mint a FRESH ephemeral client_id unconditionally (ignore any existing _ga, don't read it),
don't write; session_id forced to the per-page fallback (don't read _ga_<stream>). Added AC3 (the
pre-existing-_ga leak case, explicit) + AC4 (session_id ephemeral) + the E2E pre-existing case. pending uses
the same non-granted branch as denied.

### Net
The gate moved from the write to the read-and-use inside sourceGa4Ctx — closing the persistent-id leak a
write-only gate would have shipped (and that the empty-jar test missed).
