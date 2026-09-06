---
slice: 037-01 — the capstone 1.0-API-pin ADR + contract-stability enforcement
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (6 rounds: OQ10 r1, field-docstrings r2, header/README r3, bare-deferred r4, seal-staging r5, read-through mechanism PASS r6)
reviewed_at: 2026-09-06T00:29:40Z
prompt_source: review.py frame-critique docs/specs/037-one-point-oh-api-pin/spec.md 037-01 <spec> <slice>
---

VERDICT: pass (round 6)

## Frame-critique trail (6 rounds — the most intensive of the program, all substantive)

frame_review:true on the capstone 1.0 freeze. The airlock contracts accreted MVP-relative staging
language across 30+ specs; freezing them requires reconciling EVERY stale disclaimer, and each round
exposed a new form/location — proving a phrase-blocklist is structurally incomplete, driving a mechanism
reframe:

- **r1 — needs-changes.** Freezing seams.d.ts contradicted its own "provisional on OQ10" note (OQ10
  RESOLVED, ADR-0004). Fixed: reconcile-before-guard.
- **r2 — needs-changes.** Same defect in connector.d.ts/capability.d.ts/push-api.md FIELD docstrings
  (OQ11 resolved ADR-0012/019-01; the OQ9 "sync intentionally absent" contradiction vs the shipped sync
  surface). + carve out the genuinely-open OQ3.
- **r3 — needs-changes.** Same in the file-HEADER "DEFERRED" blocks + README index rows. Reframed AC2 to
  a grep-gated sweep.
- **r4 — needs-changes.** A bare-"deferred" escaper the OQ-grep missed (capability.d.ts:55 decisions-as-
  data, FINALIZED 012-03). Added a complementary deferred/sketch classification pass.
- **r5 — needs-changes.** A THIRD form both passes missed — the seal-staging family ("the seal is
  unbuilt / NOT ENFORCED in MVP2 / grant resolver is MVP3", stale: the seal shipped + enforces 017-03/
  020-02/022). Reframed the MECHANISM from phrase-enumeration (structurally incomplete) to a POSITIVE
  per-file READ-THROUGH that classifies every forward-looking claim regardless of wording; greps demoted
  to backstops.
- **r6 — PASS.** The read-through + classify over a CLOSED file set (the frozen prose surfaces, correctly
  excluding the unfrozen pixel-connector.d.ts + the shape-guarded code) is approach-complete — it does
  not depend on enumerating disclaimer phrasings. The strip-vs-carve-out rule is a clean binary; the 2b
  carve-outs (OQ3 payload schema; multi-chamber sync-coherence) are correct. No structural hole.

## Non-blocking r6 notes — all APPLIED
- Grep backstops scoped to EXACTLY the frozen file set (else pixel-connector.d.ts / the config PRE-1.0
  self-declaration / spec+test MVP refs would false-fire).
- Corrected the overstatement: the greps prove no KNOWN strip-form slipped; the 2b carve-outs are
  "NOT FROZEN" prose the read-through verifies (the OQ3 carve-out isn't in the OQ-grep family at all).
- Over-stripping caution: when unclear whether something shipped, CARVE OUT — never strip (over-claiming
  stability is the more dangerous error).
- The AC2 rewords are confirmed DISJOINT from the existing contract-stability pinned substrings (pins
  target type/grant-law text, not disclaimer comments).

## Frame (as ratified)
Pin the 1.0 API: a capstone ADR recording the FROZEN surface (the five documented contract surfaces +
the adopter boot layer / window.airlock handle shape), the EXPERIMENTAL carve-out (instrumentation-config
schema, per-connector handle variance, composite.accepts, host-internal reconcile), and the rulings
(accepts INTERNAL via clean physical removal; reconcile host-internal; read-namespacing/sampled unfrozen).
BEFORE guarding, reconcile every frozen file to present-tense-as-of-1.0 by a complete read-through (greps
as backstops); carve out the genuinely-open OQ3 (payload schema) + multi-chamber sync-coherence. THEN add
contract-stability guards for the net-new frozen surfaces (seams.d.ts, the boot/handle shape). No release cut.
