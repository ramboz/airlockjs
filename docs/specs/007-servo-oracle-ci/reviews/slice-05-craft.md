---
slice: 007-05 — browser CI (Playwright rigs + Lighthouse CI)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-27T23:02:35Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

Craft — PASS (no blockers). STRENGTHS: env-overridable uc1 timeouts with original defaults preserved (clean backward-compatible robustness pass answering the frame-critique); continue-on-error correctly keeps the job green on an advisory over-budget exit while capturing output; gating steps have NO continue-on-error. NITS (all ADDRESSED post-review by one edit): (1) `> rig/out/lh-scoreboard.json` named a text report .json -> renamed cwv-report.txt. (2) redirect implicitly depended on rig/out/ existing (created by rig:uc1's mkdir) — fragile ordering coupling that continue-on-error would silently swallow if uc1 were reordered/removed -> added `mkdir -p rig/out &&`. (3) stdout redirect hid the report from the live Actions log -> `| tee` surfaces it both inline and in the artifact. CONFIRMED (no issue): env "0" fallback moot; workflow-level permissions: contents:read covers browser-oracle (checkout needs only read; upload-artifact uses the Actions runtime token), no job-level permissions needed.
