---
slice: 013-02 — egress-breadth fan-out
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T14:29:23Z
prompt_source: spike-light craft (combined reviewer) — 013-02
substrate: non-interactive
---

## Craft review — slice 013-02 (spike-light, combined pass) — **pass**

- **Classification map correct** — fetch/xhr→confined, image→shim-swallowed, sendBeacon(`ping`)→
  escaped, and the `other` fallback defaults the SAFE direction (unknown→escaped, never falsely
  "confined"). Host regex `(^|\.)…$` correctly rejects lookalikes (`adobedc.net.evil.com`).
- **should-fix [craft/5] → FIXED** — boot failure is now gated: on `boot_ok:false` the rig fails
  loud + writes NO committed fixture, so a broken run can't masquerade as a zero-fanout lower
  bound. (This capture's 2 confined POSTs are affirmative boot evidence; the gate protects
  re-runs.)
- **should-fix [craft/4] → FIXED** — the roster-stability test now asserts `toBe(true)` (pins the
  observed stable roster), not merely that the field is a boolean.
- **[craft/2] low, accepted** — networkidle(8s)+2.5s settle + 2 runs could miss a late partner
  sync, but a miss only LOWERS a lower bound (never inflates), so it's contained by the
  lower-bound framing; 2 runs is thin for roster stability (noted).
- **[craft/3] redaction PASS** — hosts are generic Adobe infra (identifiers ride in path/body/
  query, all absent from a URL-less fixture); `redactHost` + serialized-fixture leak check
  (exit 1 on any secret) are belt-and-suspenders.
- **nits accepted** — the `beacon` regex alternative is redundant (Playwright emits `ping`) but
  harmless/defensive; disposition map duplicated in rig+test (small).
