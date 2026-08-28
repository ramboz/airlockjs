---
slice: 009-01 — per-descriptor isolation in the chamber
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:05:18Z
prompt_source: review.py frame-critique
---

Frame-critique 009-01 — VERDICT PASS. Load-bearing A1 (throw is per-descriptor, tracker-independent) is airtight against the code: chamber.worker.js:32 passes a single shared cfg.ctx (not indexed by tracker t); endpoints applied post-map (line 34); the only throw path (validatePurchase in map.js) reads only event.params. No tracker-specific state can flip a descriptor between success and throw, so per-descriptor drop is not lossy. Message-protocol change {ready}->{ready,dropped} is additive — sole consumer airlock.js:48 does `const ready = e.data && e.data.ready; if(!ready) return;` (no shape check). Failure model complete: in-loop JSON.stringify caught per-descriptor; post-loop postMessage/busy assigned to 09-02. NON-BLOCKING notes folded into the slice: (1) chamber.worker.js has NO existing test and isn't importable in the Node/vitest env (side-effecting self.onmessage) -> extract a testable exported mapBatch(batch,cfg)->{ready,dropped} and delegate onmessage to it (added as an impl note). (2) DoD "no regression in worker/egress tests" overstated coverage (the onmessage handler is untested) -> DoD reworded.
