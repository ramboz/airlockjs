---
slice: 007-04 — hermetic CI on GitHub Actions (vitest + contracts)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T19:52:29Z
prompt_source: review.py frame-critique
---

Frame-critique verdict PASS. All three directed attacks refuted by evidence: a committed root package-lock.json (lockfileVersion 3) exists and is not gitignored (.gitignore excludes only node_modules/), so `npm ci` from committed lockfiles at root + contracts/ is grounded; the two-project structure (root + contracts/, each with its own lockfile) is real; hermetic/credential-free holds — contracts/validate.mjs only readFileSync's local fixtures and the vitest suite mocks all egress (vi.stubGlobal fetch, FakeWorker, mocked requestIdleCallback), no browser/URL. Reviewer's own strongest attack (root npm ci pulling playwright/lighthouse devDeps -> chromium into the hermetic job) refuted: playwright 1.62.1 carries no hasInstallScript flag, so npm ci runs no browser-download script; the 04/05 split is sound. NON-BLOCKING notes for implementation: (a) root npm ci still installs the full devDep tree (playwright-core, lighthouse, esbuild) the hermetic core doesn't exercise — consider --omit=optional / leaner install; (b) adding .github/workflows/ci.yml touches a governance-protected path (jig-governance.yml:28) so the governance job self-flags — expected/inert until branch protection is armed, flag in deviation log; (c) DoR gates on 07-01/02 DONE — implementation must confirm `npm test` actually includes the isolation assert before starting.
