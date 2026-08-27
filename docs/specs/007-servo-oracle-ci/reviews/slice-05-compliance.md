---
slice: 007-05 — browser CI (Playwright rigs + Lighthouse CI)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T23:02:35Z
prompt_source: review.py implementation
---

Compliance — PASS. All four ACs + the env-timeout requirement met. browser-oracle is a correctly separated job (no needs: coupling; hermetic-oracle unchanged — pure append) that installs npx playwright install --with-deps chromium and runs the three rigs; the two structural asserts (rig:isolation, rig:uc1) gate (no continue-on-error) while cwv:budget is advisory (continue-on-error on that step only). rig:isolation/rig:uc1/cwv:budget are NOT oracle.sh COMPONENTS entries (only vitest + ga4_mp_conformance). rig/uc1.mjs timeouts env-configurable (UC1_BOOT_TIMEOUT_MS/UC1_BEACON_TIMEOUT_MS) with defaults = original 20000/8000 (local behavior preserved); CI sets 60000/20000. Artifacts (AC4): upload-artifact@v4 if:always uploads rig/out/ (challenger screenshot + cwv report). Orchestrator confirmed local exit codes (isolation 0, uc1 0, cwv 0), the seeded-regression demo, and uc1-challenger.png produced (42KB). NITS (ADDRESSED post-review): the advisory report was redirected to a misnamed .json and hidden from the inline log -> changed to `mkdir -p rig/out && npm run cwv:budget | tee rig/out/cwv-report.txt` (decouples the dir, .txt not .json, visible inline + uploaded; pipefail keeps the annotation). Offline: no live Actions run; first live run should confirm A2 (esp. lh-eds chromium-under---with-deps).
