---
slice: 038-02 — semantic field-map oracle (GA4)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T18:19:09Z
prompt_source: review.py frame-critique docs/specs/038-parity-harness/spec.md 'field-map oracle (GA4)' <slice>
---

Frame-critique verdict: **pass** (round 2, independent `jig:reviewer`, read-only). Round 1 returned needs-changes on the load-bearing gap that the slice never said where `mapToMp`'s `ctx` (cid/sid/_et) comes from — harness-supplied (no live cookies, R5), so that choice, not airlock's fidelity, decides the identity-core verdict (back-feed → tautological false-green; default → `sid`/`_et` false-red). Fixed and round-2-verified against source:

1. **ctx-sourcing (AC1):** airlock's `ctx` comes from `sourceGa4Ctx` (`cookies.js:146`) reading the fixture's redacted `_ga`/`_ga_<stream>` — `parseGaClientId` yields exactly the beacon's `cid` grammar, so `cid`/`sid` map via the REAL shared-cookie coupling, non-tautological by construction.
2. **flatten contract (AC2/AC3):** a flatten adapter turns `mapToMp`'s nested POST-JSON body into a flat field-set; the `wireNameMap` RHS is keyed to it (`client_id`/`event_name`/`session_id`/`page_*`), so `wireNameMap[name]||name` never false-`dropped`s a present field.
3. **`_et` → `normalised-out`** (`map.js:65` defaults `engagement_time_msec` to 100 — field maps, value isn't a parity check; more honest than R-009's naive "maps").
4. **ecommerce out of scope:** `wireNameMap` is `Record<string,string>` and structurally cannot express `pr<n>=id~nm~pr` → `items[]`; the slice is honestly bounded to `page_view`-shaped events (a representational limit, not a missing row).
5. **session continuity = scope residual** owned by ADR-0020 kill-criteria (`adr-0020:118-120`) + spec 039; surfaced as a report note, not a per-field bucket.

Round-2 non-blocking notes, both folded as wording precision:
- **`tid`/`measurement_id`** lives in the collect-URL query (`mpUrl`, `map.js:79-85`), not the body — the flatten adapter now surfaces it, and the descriptor treats it as the destination property (`tid`→`measurement_id`), so `parity:ga4` doesn't false-fail on field one.
- **`ep.<k>`→`<k>`** clarified as *shorthand* — one enumerated `wireNameMap` row per observed param, never a wildcard-strip (the static `Record<string,string>` can't wildcard).

Minor carried item (NOT amended — accepted ADR, owner approval needed): ADR-0020 kill-criterion #1's parenthetical "(038-02 models `partial`)" is stale now that 038-02 retires `partial` for the residual framing; the ADR's substance still holds.
