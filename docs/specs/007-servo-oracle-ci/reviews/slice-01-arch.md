---
slice: 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-27T20:49:40Z
prompt_source: review.py arch-review --richer-skill arch-review (re-review)
substrate: non-interactive
---

Arch pass (re-review after blocker fix) — VERDICT PASS. Prior BLOCKER genuinely resolved, verified against files: score_vitest (oracle.sh) invokes plain `vitest run` with NO --config, so it inherits vitest.config.js whose exclude drops test/oracle-ga4.test.js from discovery — the fixture-mutating meta-test can no longer run on the primary `bash oracle.sh` path, and recursion is closed (meta-test -> bash oracle.sh -> score_vitest -> default suite excluding the meta-test). ORACLE_GA4_TEST_GUARD fully removed (zero grep refs). vitest.oracle.config.js overrides include to exactly the one meta-test, so the gate-flip proof survives via `npm run test:oracle`. AND-gate contract intact (THRESHOLD=1.0, binary components, plus the new THRESHOLD-outside-SEED warning comment). No core/connectors coupling. STRENGTHS: exclude via configDefaults.exclude spread (least-surprising); include-override self-constrains the meta-test config to one file. NEW [nit][spec] slice-04-ci-core.md AC1: after the split the gate-flip meta-test is orphaned from CI — 07-04 runs `npm test` (now excludes it) + validate but never `npm run test:oracle`, so the gate's fail-capability loses automated CI coverage. Not 007-01's file to fix; 07-04 (still in review) must add a test:oracle CI step. RECONCILIATION NOTES: deviation log should record (a) CI wiring of test:oracle is a required follow-up in 07-04; (b) plain `npm test` no longer proves the gate can fail (moved to test:oracle) — acceptable; (c) golden-corruption-on-kill risk now confined to explicit test:oracle runs, never the primary bash oracle.sh/CI path — reasonable residual.
