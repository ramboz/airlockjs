---
slice: 007-05 — browser CI (Playwright rigs + Lighthouse CI)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T19:52:29Z
prompt_source: review.py frame-critique
---

Frame-critique verdict PASS. All three central attacks fail against the actual code: (a) all four rigs resolve chromium through Playwright — measure/teardown/uc1.mjs `import { chromium } from "playwright"`, lh-eds.mjs launches via chrome-launcher but points chromePath at chromium.executablePath() — so `npx playwright install --with-deps chromium` is correct/sufficient; (b) no rig hits a live EDS site — each spins up a local http.createServer on localhost and stubs /collect* via page.route (harness endpoints use the reserved t{i}.example TLD, never dialed) so headless CI needs no external network; (c) the gating-vs-reporting split is real at exit-code level — uc1.mjs ends `process.exit(pass?0:1)` (gating) while measure/teardown/lh-eds are print-only (advisory), pinned-budget comparison correctly deferred to the 07-03 cwv_budget component. NON-BLOCKING notes: (1) lh-eds.mjs:85 uses chrome-launcher driving Playwright's chromium with --headless=new --no-sandbox (not Playwright's own launcher) — the genuinely fragile point of A2 under --with-deps on a CI runner; focus the per-slice re-grounding there. (2) uc1.mjs:112-125,161 gating verdict depends on a full airlock boot within 20s waitForFunction + 8s beacon poll AND gates on exposure-beacon MP-conformance, not the flicker invariant alone (AC2 describes it as only the no-flicker structural assertion) — spurious-failure risk on slow shared runners; robustness pass at implementation. RECONCILIATION: tighten the slice-goal "reported, non-gating" wording (the browser job does carry one gating assertion); record whether the flicker gate registers as its own COMPONENTS entry or only gates the CI-job exit (reads as a 07-03 routing concern).
