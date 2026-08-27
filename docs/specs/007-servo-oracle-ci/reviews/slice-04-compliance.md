---
slice: 007-04 — hermetic CI on GitHub Actions (vitest + contracts)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T22:37:53Z
prompt_source: review.py implementation
---

Compliance — PASS. All four ACs met by .github/workflows/ci.yml. AC1: triggers push+pull_request; runs npm ci -> npm test -> npm run test:oracle (the 07-01 gate-flip proof, present as its own step), then contracts npm ci + npm run validate (working-directory: contracts). All four script names resolve to real package.json entries (root test, test:oracle; contracts validate). AC2: no || true / exit-code masking on any gating step, so a real failure fails the job; orchestrator confirmed the seeded-failure demo (delete client_id from a golden -> validate exit 1 + test:oracle fail -> restored, git clean). AC3: zero ${{ secrets.* }} interpolation; measurement_id/api_secret appear only in the header comment as prose explaining why no secrets are needed; mp-live-check.mjs not invoked. AC4: setup-node@v4 pins node-version "22" + cache: npm; both npm ci use committed lockfiles (root + contracts, both lockfileVersion 3, present). NEW file, separate from jig-governance.yml. Offline-verification adequate: no matrix/conditional/secret logic that only surfaces in a live runner; act -n validated structure to the Docker boundary. NIT: node "22" pins major only. RECONCILIATION: record the offline-verification constraint + seeded-failure demo.
