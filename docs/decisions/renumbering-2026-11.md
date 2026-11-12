# Renumbering, 2026-11

> Status: Draft. One-time consolidation of ADR, research (R) and bug numbers across the `foundation`, `adobe`, `google`, `meta` and `personalization` branches, which had colliding numbers. Machine-readable twin: [renumbering-2026-11.json](./renumbering-2026-11.json).

## How the sequence was built

- Scope: ADR >= 0031, R >= 012, and all bugs. ADR <= 0030 and R <= 011 are identical on all sources, except ADR-0018 (see below).
- A document is one distinct (number, slug). The same slug on several branches is one document.
- New numbers follow the earliest commit that added the file on any source branch (ties: old number). ADR 0031 starts the sequence, R 012 and bug 001 likewise.
- Review files (`docs/decisions/reviews/adr-NNNN-*`) take their ADR's new number. Review files are matched to their ADR per source branch, because `adr-0031-frame-critique.md` etc. exist with different content on `personalization-planning`.
- Classification: `project` (shared, lives on foundation), `adobe`, `google`, `meta`, `google-meta` (on both vendor branches), `personalization`.
- Documents already on `origin/main` (ADR-0031 Adobe-first reframe, ADR-0032 boundary acceptance, R-012) stay on foundation, renumbered. Vendor children rename their own copies from the JSON.
- ADR-0039 (old ADR-0032) is the only project-level ADR found; every other post-0030 ADR is single-vendor.

## Source-state notes

- ADR-0018 differs on `personalization-planning` (blob 650eb39) from all other sources (bbd5323). Foundation keeps the `origin/main` version; personalization must reconcile on its own branch.
- R-012 Adobe-first (new R-014): `adobe-adoption-goal` carries a newer revision than `origin/main`/google/meta. Foundation keeps the `origin/main` text; the adobe branch keeps its newer text.
- Bug 001 `meta-fbp-wire-redaction` also appears on the google branch; classified `meta` by slug. Old ADR number 0039 is referenced by old ADR-0040 as a dependency but exists on no source; it has no new id.

## Table

| Old id | Slug | Source branches | Classification | New id | Where it will live | Review files |
|---|---|---|---|---|---|---|
| BUG-001 | stock-bootstrap-query-isolation | adobe | adobe | BUG-001 | adobe |  |
| BUG-001 | meta-fbp-wire-redaction | google, meta | meta | BUG-002 | meta |  |
| BUG-002 | local-fixture-import-closure | google, meta | google-meta | BUG-003 | google+meta |  |
| BUG-003 | shared-host-live-consent | google, meta | google-meta | BUG-004 | google+meta |  |
| BUG-002 | admission-ledger-capacity | adobe | adobe | BUG-005 | adobe |  |
| ADR-0031 | flicker-by-construction-invariant | personalization | personalization | ADR-0031 | personalization | 1 |
| ADR-0032 | eager-paint-policy-and-flag | personalization | personalization | ADR-0032 | personalization | 1 |
| ADR-0033 | proposition-contract-placement-registry | personalization | personalization | ADR-0033 | personalization | 1 |
| ADR-0034 | eager-decision-landing-head-fetch | personalization | personalization | ADR-0034 | personalization |  |
| ADR-0035 | prerender-seal-hold-speculative-prefetch | personalization | personalization | ADR-0035 | personalization |  |
| ADR-0036 | per-site-composition | personalization | personalization | ADR-0036 | personalization |  |
| ADR-0037 | config-builder-hosting-github-write-path | personalization | personalization | ADR-0037 | personalization |  |
| ADR-0031 | reframe-onto-adobe-first-compatibility | main, adobe, google, meta | adobe | ADR-0038 | foundation (already on origin/main) | 1 |
| ADR-0032 | airlock-boundary-acceptance | main, adobe, google, meta | project | ADR-0039 | foundation (already on origin/main) | 1 |
| ADR-0033 | reframe-onto-full-google-meta-compatibility | google, meta | google-meta | ADR-0040 | google+meta | 1 |
| ADR-0034 | inspected-meta-stock-reference | google, meta | google-meta | ADR-0041 | google+meta | 1 |
| ADR-0035 | additional-one-shot-meta-authority | google, meta | google-meta | ADR-0042 | google+meta | 1 |
| ADR-0038 | supervised-native-meta-resource-lifecycle | google, meta | google-meta | ADR-0043 | google+meta | 1 |
| ADR-0040 | isolated-linux-qualification-boundary | adobe | adobe | ADR-0044 | adobe | 2 |
| ADR-0041 | owner-supervised-proving-run | adobe | adobe | ADR-0045 | adobe | 2 |
| ADR-0042 | google-meta-product-delivery-gates | google, meta | google-meta | ADR-0046 | google+meta | 2 |
| ADR-0043 | google-meta-request-authority | google, meta | google-meta | ADR-0047 | google+meta | 2 |
| ADR-0044 | google-ads-consent-wait | google, meta | google-meta | ADR-0048 | google+meta |  |
| ADR-0044 | fixed-supervised-original-evidence-reads | adobe | adobe | ADR-0049 | adobe | 1 |
| ADR-0045 | evidence-independent-05109-source-checkpoint | adobe | adobe | ADR-0050 | adobe | 1 |
| ADR-0046 | fresh-native-only-admission | adobe | adobe | ADR-0051 | adobe | 10 |
| ADR-0045 | inspected-google-reference | google | google | ADR-0052 | google | 1 |
| ADR-0047 | google-manual-residual-cleanup | google | google | ADR-0053 | google | 2 |
| ADR-0048 | google-retained-local-reject-guard | google | google | ADR-0054 | google | 1 |
| ADR-0049 | meta-local-referrer-storage | meta | meta | ADR-0055 | meta | 1 |
| ADR-0050 | google-browser-operations | google | google | ADR-0056 | google | 1 |
| ADR-0051 | google-local-manual-helper-cleanup | google | google | ADR-0057 | google | 2 |
| ADR-0052 | google-local-known-case-stop | google | google | ADR-0058 | google | 10 |
| ADR-0042 | remaining-adobe-baseline-execution | adobe | adobe | ADR-0059 | adobe |  |
| ADR-0043 | governed-adobe-sdk-command-bridge | adobe | adobe | ADR-0060 | adobe |  |
| R-012 | personalization-experimentation-runtime | personalization | personalization | R-012 | personalization |  |
| R-013 | per-site-chunked-dist-feasibility | personalization | personalization | R-013 | personalization |  |
| R-012 | adobe-first-compatibility | main, adobe, google, meta | adobe | R-014 | foundation (already on origin/main) |  |
| R-013 | google-meta-first-journey-evidence | google, meta | google-meta | R-015 | google+meta |  |
| R-014 | google-meta-request-authority | google, meta | google-meta | R-016 | google+meta |  |
| R-013 | supervised-adobe-proving-feasibility | adobe | adobe | R-017 | adobe |  |
