---
slice: 028-02 — per-beacon correlation
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T20:50:01Z
prompt_source: review.py implementation 028 'correlation'
---

**Verdict: PASS** (independent reviewer, Opus). All six ACs met, tested non-vacuously.

- **AC1** held→flushed share one `beaconId` + `destination` — minted ONCE at the consent hold (`airlock.js`),
  stored on `heldBeacons`, reused at the real `setConsent` flush; test drives a real flush and asserts the shared
  id + the `["held","flushed"]` ordered chain.
- **AC2** wrapped-sdk-host records carry `beaconId = <tag>#<m.id>` at endpoint-ceiling / config-integrity
  (held+overridden) / consent; test asserts `endsWith("#cf-77")` (robust — the base-36 tag can't contain `#`).
- **AC3** `query({ beaconId })` returns the chain in emission order.
- **AC4/AC5 (load-bearing)** two co-wired instances mint DIFFERENT ids (fresh per-instance random tag,
  `beaconSeq=0` each) and `query({ beaconId })` does not conflate — EVEN with byte-identical destinations. The
  reviewer confirmed non-vacuity: an instance-local (un-namespaced) id reds ONLY this test (orchestrator verified
  the mutate→red→restore: AC4 red, other 16 green).
- **AC6** additive — `git diff` confirms no existing record field removed/renamed; records without `beaconId`
  (e.g. `dropped`, carrying `d.type`) still collect + query; flat-record invariant preserved. Full suite 923 green,
  every affected host suite green (no regression). Synthetic identifiers only; the id is a synthetic
  `tag#seq`/`tag#fetchId`, never user identity.
