---
slice: 042-02 — generalize the GET-critical unload flush to pixel
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique subagent, Opus)
reviewed_at: 2026-09-10T19:42:30Z
prompt_source: review.py frame-critique
---

VERDICT: pass

REASONING:
The single load-bearing assumption — main-thread `createPixelConnector(connectorConfig).handle`
produces byte-identical `EgressRequest[]` to the pixel worker chamber (the pixel analog of the
parent's A1) — is grounded in source and strictly STRONGER than gtag's already-arch-reviewed A1.
Pixel's `handle` reads no `ctx` (only the frozen declarative `{endpoint,eventMap,paramMap}` config,
threaded verbatim by `bootPixelConnector` with `ctx:{}`), so gtag's ctx-frozen-snapshot /
017-01-ctx-resend divergence bound structurally cannot apply. The three secondary candidates
(config threading, empty-`[]` no-op, gate retirement) are each settled by grounded evidence
(`core/pixel-chamber.worker.js:55-56`, `connectors/pixel/connector.js:113-115,125-150`,
`core/egress.js:120-133`, the three `workerMappedGetEgress` uses at airlock.js :517/:524/:593).
The frame survives.

SPECIFIC ISSUES:
- Primary assumption (main-thread handle byte-parity with the worker chamber) survives — both
  sides construct createPixelConnector from the identical connectorConfig and invoke a pure,
  ctx-free, stateless handle; no post-init transform, no mutation vector. Unconditional parity.
- Note (NOT blocking) — AC5 parity-test input must be governed consistently: the unload path maps
  AFTER governParams (airlock.js:234) while the raw routeBatch witness does not, so the test must
  feed BOTH paths the same params (use a clean descriptor with no denylisted fields, as 042-01
  AC5 did, so governance is a no-op). A test-construction detail, not an exposed frame.
