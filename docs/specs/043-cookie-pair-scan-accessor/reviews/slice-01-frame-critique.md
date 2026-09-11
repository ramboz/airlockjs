---
slice: 043-01 — extract `getCookieValue` + repoint the two exact-name copies
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-09-11T20:27:49Z
prompt_source: review.py frame-critique docs/specs/043-cookie-pair-scan-accessor/spec.md getCookieValue slice-01
---

# Frame-critique — 043-01 (extract getCookieValue)

**Verdict: needs-changes** (pre-implementation). All findings folded before this record.

- **[MAJOR]** A1's "byte-identical / behavior-preserving" is wrong at the absent sentinel: `readCookieValue`
  returns `undefined` (index.js:748,760), `get()` returns `null` (cookies.js:31,43, its `Promise<string|null>`
  contract). AC2's naive pass-through would redden `test/eds-cookies.test.js:48-51` (`.toBeNull()`), or prime a
  "fix" that silently changes the capability contract. **Fold:** AC2 now specifies `get()` wraps `?? null`;
  Overview/A1/DoR corrected to name the sentinel + the per-call-site reconciliation.
- **[MINOR]** DoR overstated `core/` as "dependency-free" — only the new *leaf* `core/cookie-parse.js` is
  import-free (core/ composition roots import from connectors). **Fold:** DoR narrowed to the leaf module.
- Confirmed holding (reviewer): duplicate-name first-match, `=`-in-value, trim, malformed-%→raw, sync/async
  seam, and A2's variant exclusions are all genuine.
