---
adr: 0008
pass: frame-critique
verdict: pass
reviewer: owner authority (conclude-on-analysis; 7 frame-critique rounds)
reviewed_at: 2026-08-29T16:25:04Z
prompt_source: review.py frame-critique docs/decisions/adr-0008-oq9-coherency-sync-access.md (x7 rounds)
---

# Frame-critique verdict — ADR-0008

**Verdict: pass — recorded on owner authority** (the frame-critique evidence gate is a
deliberateness signal a human can clear; ADR-0020). This ADR was subjected to an
unusually thorough adversarial process — **seven** independent frame-critique rounds
across the ADR and its supporting spike-slice designs, each of which caught a real
over-claim and forced a correction. The owner, after reviewing that convergence, chose
to **conclude the ADR on the resulting analysis** rather than spin an eighth round or
build a demonstration rig that would only restate it.

## The seven rounds (each correction incorporated)
1. Original "GO / contract-freeze lifted" — overclaimed a boot-race the deterministic
   rig never measured.
2. "Mint arbitration required, model-independent" — conflicted with 011-01's
   frame-critiqued B-specific finding.
3. "Not a clean GO; mint arbitration; freeze held" — still asserted a model-independence
   the synchronous-mint rig could not support.
4. 011-04 design "B-specific vs model-independent" — wrong axis (the bare async fault is
   universal).
5. 011-04 "cost-of-fix asymmetry" — the op-model can't measure it, and the asymmetry may
   not exist.
6. 011-04 "broker async-coalescing" — but coalescing needs the mint request
   broker-visible; premise ungrounded.
7. "broker-proxied egress required" — mis-grounded on a superseded architecture.md
   draft; the accepted ADR-0004 already dispatches egress on the main thread, so the real
   condition is wrapped-SDK vendor-`fetch` interception + XDM mint-recognition.

## The converged, grounded result (what this ADR records)
GO on the coherency axis: the async concurrent-first-mint fault is retired by
**broker-side async request coalescing** (single-threaded broker holds the second
concurrent mint), **model-independently, no SAB** — **conditional**, for the wrapped-SDK
archetype, on (1) chamber-side interception of the vendor's `fetch` into the
orchestrator's *existing* main-thread dispatch (ADR-0004), and (2) parsing the vendor's
opaque XDM `interact` to recognize the identity mint. Wire-protocol connectors (GA4)
already satisfy it. **Contract-freeze HELD** for the wrapped-SDK until that mechanism is
designed. The result is **analytical** (the deterministic rig cannot measure a race the
broker serializes away), honestly flagged as such, with the XDM-parseability and
unmodified-bundle risks as kill-criteria and the 011-01 synchronous-mint reconciliation
surfaced for owner approval.

Recorded by: author on owner authority (conclude-on-analysis decision, 2026-08-29),
after seven independent frame-critique rounds.
