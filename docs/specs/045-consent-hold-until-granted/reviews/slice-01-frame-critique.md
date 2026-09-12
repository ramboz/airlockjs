---
slice: 045-01 — the core seal `holdOnDenied` opt-in mode (egressVerdict + createAirlock)
pass: frame-critique
verdict: needs-changes
reviewer: general-purpose
reviewed_at: 2026-09-12T14:46:01Z
prompt_source: review.py frame-critique 045 045-01 <slice>
---

VERDICT: needs-changes (pre-implementation). All findings folded before this record.

- **[MAJOR — folded]** The slice's *nominated* A1 (the 017-03 flush is reason-agnostic → a denied-cause hold flushes like a pending-cause hold) actually **survives** — confirmed the hold path buffers `{url,method,body}` uniformly (`core/airlock.js:419`) and `setConsent` re-runs `egressVerdict(...)==="send"` (`:666-687`), so with the flag threaded the flush fires. **The real, unflagged load-bearing flaw: reusing the flush VERBATIM does not achieve ad-conversion PARITY.** `setConsent` re-`fetch`es the **boot-time-mapped** `{url, body}` unchanged; a g-ads payload is consent-dependent — `auid` (from `_gcl_au`) is `ad_storage`-gated → omitted under denial, and `gcs`/`npa` encode the map-time denied state. So a conversion held under `ad_storage`-denied and flushed on grant fires with **no `auid` + gcs=denied + npa=1** — an unattributable "user-declined" beacon (the exact non-parity 044-02 AC3 forbids), NOT the container's re-executed granted beacon.
  **Fold (owner ruling: re-map on grant, full accept parity):** 045-01 now includes **re-map-on-grant** — the held item carries the re-map inputs (event + the connector's main-thread mapper + a ctx re-source); `setConsent` re-maps with the current (granted) consent/ctx (fresh `auid`, granted `gcs`/`npa`) before firing, not the stale payload. This resolves the deferred mid-session ctx-refresh residual for the seal path. AC2/AC3/A1 + ADR-0023 Recommended-Decision updated.
- **[SECONDARY — folded as documented limit]** The sync/unload seal site (`core/airlock.js:258-270`) can only DROP a non-send verdict, never buffer. Under `holdOnDenied` a teardown beacon under denial is dropped with nothing to flush later. Folded: AC3 documents this — correct "no ping" for the page-load family under persistent denial; the teardown-conversion case is MVP9.

Reviewer substrate: general-purpose subagent running the jig frame-critique rubric; read-only; verified against ADR-0023 + `core/consent.js`/`core/airlock.js` (egressVerdict, hold/flush, setConsent) + `connectors/google-ads/`.
