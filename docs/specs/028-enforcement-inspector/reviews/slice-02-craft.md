---
slice: 028-02 — per-beacon correlation
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T20:50:01Z
prompt_source: review.py implementation 028 'correlation'
substrate: not-shown
applied_skill: none
---

**Verdict: PASS** (independent reviewer, Opus; two low-severity notes, both dispositioned).

- Correctness sound: `(beaconSeq += 1)` mints exactly once per hold (starts at 1, reused not re-minted at flush —
  no off-by-one/double-mint). All added values are strings (`inspectorTag`, `beaconSeq`/`m.id`, `r.url`/`b.url`/
  `hostOf(m.url)`) → flat-record invariant preserved. No non-test code consumes `.beaconId`/`.destination`;
  `contracts/*.d.ts` doesn't type these fields; every existing host-suite assertion on these records is
  `toMatchObject` (subset), so the added fields break nothing.
- **Note 1 (HARDENED):** the reviewer flagged `Math.random().toString(36).slice(2,8)` could theoretically yield a
  short/empty tag (`0 → ""`, `0.5 → "i"`, prob ~2^-53) — not a real bug (nothing splits `beaconId` on `#`; it's
  only equality/`endsWith`-compared), but hardened anyway to a fixed 6-char pad-then-slice
  (`(…slice(2) + "000000").slice(0,6)`) in both hosts, removing the theoretical case entirely.
- **Note 2 (as-designed scope boundary, recorded):** the `config-integrity unpinned-declared-origin` disclosure
  and the payload-governance `stripped`/`skipped` records have `m.id` in scope but intentionally OMIT `beaconId`
  — consistent with AC2's enumerated set (config-integrity held/overridden, consent, endpoint-ceiling); the AC6
  test even pins the payload-governance record to a `beaconId`-free shape. A future slice can extend the strip
  chain if wanted.
