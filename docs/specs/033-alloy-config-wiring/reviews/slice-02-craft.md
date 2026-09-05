---
slice: 033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`
pass: craft
verdict: pass
reviewer: general-purpose (independent craft/pr-review)
reviewed_at: 2026-09-05T02:45:57Z
prompt_source: review.py craft docs/specs/033-alloy-config-wiring/spec.md 033-02 <deliverables>
substrate: non-interactive
---

VERDICT: pass — craft (code-quality), slice 033-02

Independent craft reviewer verified all 5 scrutiny areas against source; every relevant test passes.

- **Host `configured` latch is race-free** (`core/wrapped-sdk-host.js:467-475`): JS single-threaded + each of
  `driveEvent`/`handleMessage(configured)` runs to completion → an event is either queued OR posted immediately,
  never both/neither; re-entry guard intact; pre-configure path byte-equivalent to 014-01 (no single-event regress).
- **Worker CSP fix fails closed**: the raw-string fallback engages only when TrustedTypes is absent (nothing to
  bypass) or `createPolicy` throws under a restrictive directive (raw importScripts then CSP-blocked → fatal, i.e.
  fails closed); load inside boot's try/catch.
- **Deviation #3 (runtime-assembled `data:` probe strings)** is a legitimate false-positive workaround — `DATA_URI`
  reassembles byte-identically; the two usages are adversarial egress probes (not the worker's own same-origin
  `bundleUrl` load path); mirrors the pre-existing `REMOTE_LOADER_KW` idiom; probe behavior verified unchanged.
- **build.mjs rework EXTENDS the invariants** to the 5th worker (merged metafiles, `allWorkerEntries` in both the
  specifier set + the blob/data/ajv scan) rather than weakening the ESM four; generalized out-namer identical for
  `core/`-rooted workers.
- **Tests strong + non-vacuous**: no-hang cases bounded (revert → fail-fast, not hang); serialization/fan-out/consent
  gates each fail if their feature is removed; doubles are faithful protocol stand-ins.

Nits — 2 FIXED in the security fix-up round (the denied-consent negative now uses `waitFor` not `setTimeout(60)`;
the `build.mjs:73` basename-collision latent edge noted in a comment); 2 RECORDED in the slice close-out (the
`alloy-chamber-csp.test.js` source-grep proves presence not admission — the passing `rig:alloy-csp` is the real
proof; the `CLASSIC_WORKER_ENTRIES`-declares-alloy tautology). No blockers.

Reviewer: general-purpose (independent craft / pr-review).
