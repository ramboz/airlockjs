---
slice: 038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T15:36:51Z
prompt_source: review.py frame-critique docs/specs/038-parity-harness/spec.md 'Meta Pixel' <slice>
---

Frame-critique verdict: **pass** (round 5, independent `jig:reviewer`, read-only). Five adversarial rounds; the frame now survives the strongest attack and every residual is owned in an accepted ADR or capture-gated at implementation.

**Rounds (each caught a distinct load-bearing defect, all fixed):**
- r1 → the oracle was mis-modelled as same-protocol **equality**; airlock's Meta connector is identity-free by construction, so equality either silently excludes identity (false pass) or always-diffs. Fixed: one **classified-diff engine** with a first-class `dropped` bucket; reference set grounded in the **container's** beacon, not airlock's connector.
- r2 → the capture claim was wrong (`rig/lh-r010.mjs` matches Meta's `fbevents.js` *loader*, not the `/tr` beacon — verified `lh-r010.mjs:43-48,80-83`); `real` vs R5 local-only. Fixed: `/tr` beacon pattern is new work; **real-shaped** fixtures; **beacon-field parity ≠ full Meta parity** (the `fr` cross-site cookie is owned by ADR-0020 / E10 / 038-03).
- r3 → `pass = no dropped` saturates an identity-free connector red and drowns a real airlock-side regression; the owners-landed test was unbuildable welded to replay. Fixed: verdict consumes **ADR-0020's gap map** (`pass` = no divergent AND no field dropped *outside* the gap map); oracle input = two field-sets, airlock **substitutable**; AC4 = a 3-fixture two-way guard.
- r4 → "same-protocol = pure identity translation (no table)" mis-modelled Meta's `cd[...]` namespace vs airlock's bare `value`/`currency` (verified `meta.js:74-81`). Fixed: same-protocol is identity-**heavy** with a **minimal wire-name table**; a non-wire-faithful `meta.js` is owned at the capture.
- r5 → **pass**, with one non-blocking note (applied): the wire-name-map resolution is valid only if the vendor accepts both spellings; where Meta reads only `cd[...]`, a bare-name field must be a **026 fix or gap-map entry, never a descriptor "map"** (else a false pass — the false-shim ADR-0020 forbids). Folded into spec.md + the slice DoR.

**Grounding independently verified (r5):** `rig/lh-r010.mjs:43-48,80-83` (capture pattern misses `/tr`); `connectors/pixel/vendors/meta.js:74-81` (bare `value`/`currency`, not `cd[...]`); `connectors/pixel/connector.js:127,149` (`[]` for unmapped, `[{url,method:"GET"}]` otherwise). Residuals owned: the `fr` transport cookie → ADR-0020 / E10 / 038-03; the `cd[...]` wire-fidelity gap → capture-gated in the DoR.

**Byproduct of the ceremony:** the harness design surfaced a probable real wire-fidelity bug in the shipped 026 Meta connector (bare `value` vs Meta's `cd[value]`) *before any harness code was written*.
