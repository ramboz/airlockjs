---
status: DRAFT
dependencies: [059-02, 059-03, 059-04, 059-10]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

> **Rescoped 2026-11 by [spec 065](../065-google-ads-parity-inventory/spec.md) (ADR-0061).** Replaced by G12 in spec 065 section 9. History kept; criteria are inputs to the new slice file.

## Slice 059-11 - Mixed-tag migration and rollback

**Goal:** An integrator deploys a pinned Ads replacement alongside retained native
services and can deliberately restore the prior owned configuration without duplicate collection.

**DoR:**
- [ ] Listed dependencies are DONE; C1-C3/058 qualify standalone and mixed cases.
- [ ] Parent supplies owned configuration/deployment snapshots, target Ads
      destinations, retained native GA4/GTM controls and explicit deployment authority.
- [ ] Investigate actual boot/suppression/queue/linker ownership through parent
      source discovery; review an adopter contract preserving ADR-0017.
- [ ] Pin explicit migration/rollback triggers, mutually exclusive producer
      ownership and artifact/configuration versions; no automatic native fallback.

**Acceptance Criteria:**

1. Standalone first/returning replacement proves no native Ads runtime or
   native-generated state dependency. Network traces alone are not enough to
   hide a cached/runtime-injected native producer; executable/dependency and
   input-to-worker evidence supports the absence claim.
2. Mixed native GA4 and GTM scenarios preserve Ads command/groups/labels,
   multiple destinations, queue naming, consent and linker/state ownership
   while leaving unrelated product traffic/host effects unchanged against
   controls. Full GA4/GTM/Floodlight implementation is not required.
3. Detect native Ads/Google tag auto-loading, duplicated installations, shared
   setting changes, split callback ownership and duplicate route/decoration.
   Retained native products cannot silently provide a missing Ads feature or
   seed identity and still count as independent chamber proof.
4. Site-owned pinned configuration and supported buildless deployment/upgrade
   procedure preserve the frozen boot entrypoints and installed handle, void
   push behavior and consent/governance boundaries. No generated runtime hand-
   editing, unreviewed configuration schema promise or release cut is implied.
5. Operator preflight reports missing evidence, resources, grants and stale
   pins before migration. Unsupported required features block a full replacement
   recommendation; a scoped success cannot be advertised as a safe global cutover.
6. Deliberate owner-controlled rollback restores the recorded prior producer/
   configuration with explicit ownership transition, consent and state handling,
   no overlapping dual sends and no implicit replay. Boot/chamber failure
   preserves page safety and visible measurement failure; it never triggers
   automatic native loading contrary to the vision.
7. Disable/enable, partial boot, wrong config pin, hidden native producer,
   extra/missing destination, lost untouched-tail event and rollback overlap
   controls fail. Application handlers/forms/navigation and privacy/CWV controls
   remain intact through both migration directions.
8. Integrator output documents actual worker, sequence, host and downstream
   evidence separately, recovery limits and required operator action. Full
   mixed-workload C3 applies; a stale assurance artifact alone does not silently
   stop live customer collection or authorize a native fallback.

**DoD:**
- [ ] Standalone, mixed and deliberate rollback journeys have witnessed controls;
      targeted tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Pinned adoption/upgrade/rollback guide is reproducible and contains no
      private selectors, site URLs or accidental authority expansion.
- [ ] Deviation/reconciliation records cover public interfaces and untouched services.

**Anti-horizontal-phasing check:** The integrator can complete a real selective
adoption and deliberate rollback while preserving the rest of the site.

## Assumptions

- Unverified: native GTM/GA4 automatic dependencies can be separated sufficiently
  to prove independent Ads replacement and untouched-tail behavior.
- Unverified: explicit producer/state handoff and pinned deployment fit current
  inspected surfaces without a stable-core break or automatic native fallback.

### Close-out (post-DONE)

- [ ] Parent checks adoption/rollback guidance, release-scope separation and board.

### Deviation log (after reconciliation)

Not implemented; no deployment, suppression or rollback behavior declared verified.

### Reconciliation sweep

Pending implementation and formal review; Adobe and unrelated vendors untouched.
