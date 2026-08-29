---
status: DRAFT
dependencies: [012-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 012-04 — manifest declaration-shape + alloy behaviour characterization

**Goal:** Have alloy's connector **declare** its `ConnectorManifest` (reads /
endpoints / purposes) — **declared, not enforced** ([mvp2.md](../../releases/mvp2.md):
the ADR-0006/0007 enforcement teeth are MVP3) — and **characterize** alloy's
config-driven behaviour (what it auto-collects; where it egresses), producing the
input MVP3's secured-seam design consumes. This is the forward-compat scaffolding half
of MVP2, kept honest about being *scaffolding*.

**DoR:**
- ✅ 012-01/012-02 DONE — a working alloy connector exists to attach a manifest to and
  to observe egressing.
- ✅ [ADR-0006](../../decisions/adr-0006-capability-manifest.md) (manifest as
  declaration/disclosure; `endpoints` advisory — host allow-list wins) +
  [ADR-0007](../../decisions/adr-0007-consent-purpose-model.md) (purpose vector) — the
  declaration shapes to populate.
- ✅ [ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md) / R-004: alloy's
  egress is `interact` **plus** server-directed ID-sync URLs the Edge response returns —
  breadth not statically enumerable at manifest-authoring time.

**Acceptance Criteria:**

1. **alloy connector declares a manifest.** The connector ships a `ConnectorManifest`
   populating `reads` (projection fields), `capabilities` (the cookie / decisions / egress
   caps it actually uses), `endpoints` (the Adobe hosts it knows of), and purposes
   (ADR-0007). Observable: the manifest is present and type-conformant to
   `contracts/connector.d.ts`.
2. **Declared, NOT enforced.** The manifest does **not** gate egress in MVP2 — parity
   with the un-built seal (spec Assumptions). Observable: a test shows an `interact`
   egresses whether or not it matches a declared `endpoint` (enforcement is MVP3), and
   the `endpoints` field is recorded as **advisory** (ADR-0006 — host allow-list wins).
3. **Behaviour characterization artifact.** A durable artifact (under this slice's
   Findings and/or `docs/research/`) records: what alloy **auto-collects** under
   `context: []` vs a default `context` (device / web / placeContext), and **where it
   egresses** — the fixed `interact` host plus any server-directed ID-sync / demdex URLs
   observed. Observable: the artifact enumerates collected-data categories + egress hosts,
   explicitly flagging which were seen against the **stub** vs need **live-Alloy**
   confirmation (creds-gated).
4. **Framed as MVP3 input.** The characterization explicitly states which findings feed
   MVP3's seam design (authoritative endpoints, payload governance, purpose-vector
   consent), closing the MVP2→MVP3 handoff the release slate links.
5. **No regressions.** GA4 + prior alloy paths green; pinned signatures byte-identical.

**DoD:**
- [ ] ACs 1–5 pass; full suite green.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer`; compliance + craft recorded.
- [ ] Frame-critique recorded — the "declared-not-enforced" boundary and the
      stub-vs-live-Alloy egress-breadth gap are the framed premises.
- [ ] Deviation log + reconciliation sweep; reconciliation review passed.
- [ ] `docs/refinement-todo.md` + `docs/releases/mvp3.md` handoff updated with the
      characterization result.

**Anti-horizontal-phasing check:** after this slice, the alloy connector carries a real
(declared, unenforced) manifest and a characterization MVP3 can design against —
observable value is the disclosed declaration + the characterization artifact, the thing
MVP3's enforcement is built on, not internal wiring.
