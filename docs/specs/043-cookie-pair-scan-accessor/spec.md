---
status: DRAFT
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 043: Cookie-pair-scan accessor

> Un-parked from `docs/refinement-todo.md` OQ13 item 5 (rule-of-three on the cookie pair-scan loop). 026-04 added the
> third byte-identical copy (`adapters/eds/index.js` `readCookieValue`), tripping [ADR-0002](../../decisions/adr-0002-extract-helper-on-third-caller.md)
> (extract-helper-on-third-caller).

## Overview

Several sites open-code the same `document.cookie` pair-scan. Grounded enumeration (2026-09-11):

**True duplicates — the "read a cookie value by exact name" shape (byte-identical scan logic):**
- `adapters/eds/index.js:747` `readCookieValue(cookieString, name)` (added by 026-04).
- `adapters/eds/cookies.js:30` the mediated `get(name)` accessor's inner loop.

Both do exactly: `split(";")` → `indexOf("=")` (skip on -1) → `slice(0,eq).trim() === name` → `decodeURIComponent(slice(eq+1).trim())` with a raw-on-throw fallback. Identical, byte for byte.

**Variants — related but NOT the same accessor (deliberately left alone):**
- `connectors/ga4/cookies.js:88` `findGaStreamCookie` — **prefix** match (`_ga_<stream>`), returns the whole cookie, not a value-by-exact-name.
- `connectors/alloy/sync-cookie-cache.js:42-43` — first-pair-only (`split(";")[0]`) and a filter-out-a-name (`split("; ")`).
- `core/cookie-scope.js:107` `scopeSeedCookies` and `core/wrapped-sdk-host.js:622` — cookie **scoping**, not value lookup.

The move is the lean [ADR-0002](../../decisions/adr-0002-extract-helper-on-third-caller.md) one: extract **one** shared exact-name accessor `getCookieValue(cookieString, name)` into `core/` (importable by adapters + connectors), repoint the two byte-identical copies, and **stop there** — a generic "iterate cookie pairs" primitive that swallowed the variants too would be premature generality (the leanness sweep's target), because each variant's match/return semantics genuinely differ.

The accessor is a **pure string-parse primitive**: no `document`, no consent logic. Callers keep their own consent/governance gating (e.g. 017-02 grant-gated reads) — this refactor changes *where the parse lives*, never *whether a read is allowed*.

## Assumptions

**A1 (the collapse-safety claim). The two exact-name copies are behaviorally identical and safe to collapse.** Grounded by reading both bodies (`adapters/eds/index.js:747-756`, `adapters/eds/cookies.js:30-40`): same split, same `=`-handling, same trim, same `decodeURIComponent`-with-raw-fallback, same "absent → `undefined`/skip". The only surface difference is the input (`readCookieValue` takes a `cookieString` param; `get()` reads `doc.cookie`) — reconciled by the accessor taking `(cookieString, name)` and `get()` calling it with `doc.cookie`. *Risk if wrong:* a subtle divergence (e.g. one trims differently, or handles a duplicate-name cookie differently) would make the collapse a behavior change — AC1's edge-case unit tests + the full suite are the guard.

**A2 (scope boundary). The variants are genuinely different accessors, not lazy non-extractions.** `findGaStreamCookie` matches by prefix and returns the whole cookie; the alloy/scope/wrapped-sdk sites are first-pair / filter / scoping. Collapsing them into one accessor would either lose semantics or force a param-heavy over-general primitive. *Consequence:* they stay open-coded; this is a scope decision, not an oversight (stated so the frame-critique can test it rather than reading silence as a miss).

## Decomposition

**R — Rules/refactor, single slice.** Not a spike (the extraction is fully known); not multi-slice (one accessor, two call sites, behavior-preserving). The "value" is code-health: one governed source of the cookie-value parse, killing the 026-04-introduced triplication before a fourth copy accretes.

## Slices

- [043-01 — extract `getCookieValue` + repoint the two exact-name copies](slice-01-extract-getcookievalue.md)
