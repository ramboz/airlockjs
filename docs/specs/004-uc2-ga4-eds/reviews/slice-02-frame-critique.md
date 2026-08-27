---
slice: 004-02 — bundle + lazy-phase boot + `push()` contract
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (adversarial frame-critique)
reviewed_at: 2026-08-27T01:14:50Z
prompt_source: review.py frame-critique docs/specs/004-uc2-ga4-eds/spec.md bundle slice-02-bundle-lazy-boot.md
---

# 004-02 frame-critique — VERDICT: PASS

An independent reviewer ran the ADR-0020 adversarial frame-critique on slice 004-02.
The frame is sound; the two stated assumptions were subjected to the strongest attack.

## Key finding (incorporated before READY_FOR_REVIEW)

**esbuild 0.21.5 has NO automatic Web-Worker bundling** — auto-rewriting
`new Worker(new URL(..., import.meta.url))` into a self-resolving chunk is a
Vite/Rollup-plugin behavior, not esbuild's. The optimistic "single-file bundle" form
of assumption 1 was likely wrong, but the frame did not rest on it: it was hedged
verified-by-building with the correct two-entry-point fallback pinned as a
kill-criterion. Incorporated: the slice now leads with the **two-entry-point +
co-located sibling worker** plan as PRIMARY (Assumption 1 + AC1), and asserts the
emitted worker stays a **same-origin file URL** (never blob:/data:) so 004-01's
retired CSP envelope transfers unbroken — the reviewer's one pre-implementation ask.

## Assumption 2 (push reconciliation) — sound

The contract is already pinned to `push({event, ...params})` (push-api.md); bringing
the `{type, params}` spike code to it while keeping `{type, params}` internal changes
code, not contract. The one real risk (reserved `event` key / name extraction) is
honestly flagged as a contract-amendment trigger.

## AD-8 lazy-phase boot target — independently confirmed

architecture.md AD-8 pins analytics=lazy; `loadLazy` is provably reached
(scripts.js loadPage → loadLazy, body:appear marked earlier in loadEager). The empty
loadDelayed is reserved for third-party, not a sign analytics belongs there.

Verdict PASS reflects the sound frame; the esbuild finding was a hedge made primary.
