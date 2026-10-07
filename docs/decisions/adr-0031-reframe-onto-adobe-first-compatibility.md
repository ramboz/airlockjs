---
status: Accepted
dependencies: [ADR-0017]
last_verified: 2026-10-06
frame_review: true
---

# ADR-0031: Reframe: Adobe-first compatibility is the v1.0 adoption gate

## Status

Accepted (2026-10-06)
Supersedes ADR-0018

## Context

Adobe-first compatibility replaces the third-party rewire as the next release gate.

The owner explicitly chose this direction on 2026-10-06: investigate an Airlock-backed
[`adobe-rnd/aem-martech`](https://github.com/adobe-rnd/aem-martech) adoption path, then build toward
full stock Alloy.js compatibility and the Adobe Web SDK-connected product stack. In response to the
release-gate question, the owner selected **"Make Adobe-first compatibility the new v1.0 gate."**
This named product-positioning reference is authoritative on acceptance of this ADR.

The superseded premise is [ADR-0018](adr-0018-reframe-onto-adoptable-one-point-oh.md)'s
**MVP9/four-vendor real-site rewire is the mandatory v1.0 gate**, including its fixed release ladder.
The Intuit trial's implementation and observations remain valid; its missing production evidence
does not become solved or disappear. The new route uses an Adobe environment whose configuration
and reporting access we can obtain, rather than depending on a customer's third-party container.
That environment is **not available yet**: the owner needs an API-led setup with minimal product expertise.

The reference integration is pinned for the initial investigation to
[`aem-martech` commit 1aa3dee3c4791636efa9ad2994342f861c8e149b](https://github.com/adobe-rnd/aem-martech/tree/1aa3dee3c4791636efa9ad2994342f861c8e149b).
Its general `sendEvent`/XDM/data, ACDL, callbacks, personalization and reporting surface is substantially
broader than Airlock's current page-view/HTML-placement Alloy adapter.
The [investigation note](../research/R-012-adobe-first-compatibility.md) distinguishes inspected source,
official documentation, proposed experiments, and unverified access/API capabilities.

## Decision Options Considered

### Option A: Keep MVP9 as the mandatory gate and schedule Adobe compatibility afterward
- **Pros:** Retains the existing ladder and preserves the strongest real-site third-party ambition.
- **Cons:** Makes the next release depend on access the owner does not control; does not follow the
  owner's chosen Adobe-first adoption route. Rejected by the owner.

### Option B: Cut v1.0 from the existing Alloy chamber proof
- **Pros:** The worker mechanism and supported subset already exist.
- **Cons:** Confuses SDK boot with product support; leaves event breadth, Adobe display reporting,
  Launch compatibility, identity, lifecycle, live acceptance and performance unproven. Rejected.

### Option C: Investigate first, then gate v1.0 on Adobe-first compatibility and adoption evidence
- **Pros:** Keeps the official SDK; uses an owned test route; exposes compatibility and permission
  gaps before implementation; preserves third-party work as an explicit follow-on.
- **Cons:** Product entitlements and some admin/UI setup remain external dependencies; full SDK
  semantics may conflict with restricted capabilities or performance goals. Chosen.

## Recommended Decision

Adopt **Option C**. The next major release is **Adobe Compatibility & Adoption, targeting v1.0.0**,
starting with the [committed release plan](../releases/adobe-compatibility.md)'s investigation checkpoint.
No release is cut by this decision.

1. **Replace the gate, not the evidence.** MVP9 is no longer a prerequisite for v1.0.
   Its booted TBT, vendor-console receipt, untouched-tail goldens, real-site consent transition and
   live-attribution residuals remain open, with pointers to [Vendor Parity & Adoption Assurance](../releases/vendor-parity-assurance.md).
   The optional v0.9.0 cut is not automatic and no longer implies completion of v1.0.
2. **Keep the official SDK.** Aim for the documented public command/options/results/events surface of
   a pinned Alloy version through the chamber and safe host-side bridges. Establish the full inventory
   first; do not substitute the current page-view adapter for that surface.
   Direct page DOM behavior, rendering, callbacks and synchronous page state require explicit design.
3. **Define "full" before building.** The target is full compatibility for the inventory, not unrestricted
   DOM/global/network authority. Every command and relevant option must have a tested implementation
   or an explicit incompatibility. A matrix containing exclusions can describe scoped support, but
   cannot justify a **full Alloy support** claim. If full compatibility proves infeasible, the owner
   must approve a revised release bar; the investigation alone cannot shrink it.
4. **Separate SDK and product evidence.** Analytics, Target, Journey Optimizer, Customer Journey
   Analytics and Real-Time CDP need distinct scenarios, configuration and receipt/outcome evidence.
   Missing licenses or permissions are blockers, not passing tests. Supporting shared Edge transport
   does not certify every Adobe product, outbound channel, or legacy SDK.
5. **Preserve controls.** No silent loosening of confinement, consent, tenant/endpoint controls,
   sanitization, or declared input boundaries to imitate page-native Alloy behavior. The broader
   [Granular Chamber Policy](../releases/granular-chamber-policy.md) work is a candidate follow-on;
   controls needed for the Adobe release itself cannot be deferred merely by assigning them there.
6. **Keep the stable core.** ADR-0017's frozen surfaces and experimental carve-outs remain in force.
   Any break still needs a separate superseding decision and migration notice. Carry forward
   ADR-0018 R1's pre-1.0 rule: a 0.x break uses a minor bump with the superseding ADR and CHANGELOG
   notice; the literal major-version rule resumes at v1.0.0.
7. **Carry the surviving constraints.** ADR-0018 R2's generic-vendor scope and customer-custom
   validation-only rule survive. Its R3 principle (performance and functional fidelity are co-equal)
   survives with Adobe-native evidence. Its R5 local/redacted input discipline survives.
   R4's MVP9-specific gate/ladder is replaced, not the historical v0.6-v0.8 cuts.
8. **Automate setup without assuming access.** Prefer supported admin APIs after read-only entitlement
   discovery. Developer Console credentials do not provision product licenses. Require an explicitly
   authorized test org and product-specific test resources; an AEP sandbox alone does not isolate
   Analytics or Target. No production publication, paid provisioning, or deletion of existing resources
   is authorized by this planning decision.

### Re-baselining manifest

No `retire-draft` disposition is needed: there is no substantive active draft on the former gate;
spec 002 is a scaffold placeholder, and deferred 022-03/039-04 are unrelated/historical.

| Existing artifact | Disposition | Execution |
|---|---|---|
| ADR-0018 | `supersede` | Accept this ADR through its frame-critique gate, then use `adr.py supersede 0018 0031`; retain the old body. |
| ADR-0017; ADR-0020; ADR-0029; ADR-0030 | `reaffirm` | Frozen core, scoped parity harness and suppression mechanics survive; retain immutable bodies. This ADR overrides their historical MVP9 release framing, not their technical decisions. |
| Other ADR-0001-0030 | `reaffirm` | Technical/history records stay unchanged; no new runtime/security decision is accepted here. |
| `docs/releases/README.md` | `rewrite` | Prioritize Adobe; link the two candidate follow-ons and carried MVP9 work. |
| `docs/releases/mvp9.md` | `amend` | Dated current-direction note: former gate and unclosed evidence preserved; no longer the v1.0 gate. |
| `docs/releases/mvp1.md` through `mvp8.md` | `reaffirm` | Shipped scopes and historical release framing remain; the slate supplies current authority. |
| `docs/product-vision.md` | `rewrite` | Update current direction, scope and release success criterion, retaining the stable UC-1-UC-14 catalog. |
| `docs/architecture.md` | `rewrite` | Separate built v0.8 surfaces from the Adobe compatibility target and cite the new gate. |
| Root `README.md`; `CLAUDE.md` | `rewrite` | Replace old active-gate/focus guidance with Adobe-first; disclose unknown access. |
| `docs/memory/glossary.md` | `rewrite` | Update release-sensitive parity/rewire/stable-core/container definitions; distinguish scoped reports from full parity. |
| `contracts/README.md` | `rewrite` | Cite the carried stable-core/versioning rule without changing any contract artifact. |
| Specs 037 and 050 | `amend` | Append dated release-framing notes only; keep lifecycle states, original scope and review evidence. |
| Specs 012, 013, 014, 020, 033, 034, 035, 036, 038, 041, 044-049 | `reaffirm` | Existing bounded capabilities remain reusable evidence, not proof of complete Adobe or third-party compatibility. |
| Other specs/slices/review records | `reaffirm` | Keep implementation history and deferred/abandoned states; no coverage-based promotion. |
| `docs/real-site-validation.md`; `docs/adoption/rewire-a-container.md` | `rewrite` | Add current-route pointers; the existing harness/procedure remains supported without claiming completed live evidence. |
| `docs/refinement-todo.md`; `docs/inbox.md` | `rewrite` | Add compact routing pointers; preserve original residuals and their triggers. |
| Research R-001-R-011 and their index | `reaffirm` | Historical measurements/reference framing survive; add R-012 and current direction in the index. |
| Other live-prose guides, workflow/conventions and tooling notes | `reaffirm` | No changed workflow, legal guarantee, or runtime behavior; no unrelated cleanup. |

No existing shipped behavior is invalidated by this prioritization change, so there is **no `retrofit`
disposition** and no mechanically minted retrofit spec. New command/product support is emergent work,
to be specified after the investigation establishes an executable contract and access.

### Coverage floor

**Level 1:**

| Authority-bearing class | Coverage |
|---|---|
| `docs/decisions/` | Scanned: all ADR paths/index; release-premise search; detailed gate and relevant boundary records. |
| `docs/specs/` | Scanned: all 50 spec headings/statuses and spec/slice release-premise matches; detailed relevant specs from this session. |
| Live prose/release/research/memory docs | Scanned: path inventory and release-premise search; detailed current guidance, release slate/MVP8/MVP9, residuals and glossary. |
| Project `skills/*/SKILL.md`, `.github/skills/`, `.claude/skills/` | Excused: none present; installed skills are tools, not this project's release authority. |
| Root primer | Scanned: `CLAUDE.md`; no root `AGENTS.md` present. |
| Root `README.md` and `contracts/README.md` | Scanned: current release and contract/version guidance. |

**Level 2:** The touched artifacts are named in the manifest above. Within decisions, all ADR-0001-0030
were enumerated; the index and literal searches for `MVP9`, `1.0`, `intuit-class` and Alloy release residuals
selected detailed reads of ADR-0018 and related contracts/governance. Within specs, every spec's heading/status
was inspected; matches separated current claims from historical slices/reviews. Specs 037/050 get explicit
amendments; prior reviews are not rewritten. Within live prose, the current gate appears in the slate,
MVP9, vision, architecture, root guides, glossary and validation guidance; those are the rewrite set.
MVP1-8 and R-001-R-011 are retained as dated historical evidence, not current prioritization authority.

This was a targeted authority read, **not** a full-text reread of every historic review or a runtime audit.
Lexical searches can miss indirect premises; an incorrectly judged untouched artifact may survive.
The floor makes those limits visible, not nonexistent. A later discovery of contradictory *current*
guidance reopens reconciliation; it does not permit silently rewriting accepted records.

## Emergent work

| Work | Route |
|---|---|
| API/entitlement discovery, pinned SDK/API matrix, first live Adobe vertical proof | R-012 and Adobe release's investigation checkpoint; author a bounded spike spec before executing provisioning/probes. |
| General event/XDM/data and command bridge; Adobe display/interaction reporting | Build specs after matrix review; do not expose unrestricted RPC or modify frozen contracts without an ADR. |
| `aem-martech`/Launch compatibility; product scenarios; measured rollout | Vertical implementation/validation specs, gated by test resources and the phased stock baseline. |
| Third-party report honesty, identity/conversion/transport/attribution evidence | Candidate Vendor Parity & Adoption Assurance release. |
| Per-input/per-capability purpose policies, revocation, retention and confinement posture | Candidate Granular Chamber Policy release; prerequisites for Adobe pulled forward when demonstrated. |

## Consequences

**Becomes easier:**
- One controlled Adobe adoption path can preserve official SDK behavior while progressively replacing
  expensive third-party tags; the vendor-neutral architecture remains.
- Access and automation limitations become explicit first-pass deliverables rather than late surprises.

**Becomes harder:**
- A whole SDK's documented surface is much broader than the current connector. Every exclusion and
  product entitlement gap must be visible, and full compatibility may need an owner-approved scope revision.
- Keeping legacy guidance and current authority distinguishable requires a corpus reconciliation.

## Assumptions

- **Access is obtainable, not obtained.** The owner can arrange appropriate Adobe entitlements and
  test permissions; no authenticated call has confirmed them. Developer Console alone is insufficient
  ([official guide](https://developer.adobe.com/developer-console/docs/guides/apis-and-services)).
- **Compatibility is feasible without weakening the boundary.** Current page-view/HTML proofs support
  investigating this, not assuming every SDK feature works. R-012's inventory and live scenarios test it.
- **The phased baseline leaves meaningful value to gain.** Off-thread work does not remove decision-network
  latency, host rendering, or remaining Launch/GTM cost; measure against stock phased `aem-martech`.

## Kill criteria

- Required test entitlements cannot be obtained: pause live execution and return an access request,
  not fabricated receipt evidence or an unbounded implementation loop.
- Required compatibility demands unrestricted authority or material frozen-core changes: return
  alternatives for a separate decision, rather than weakening controls in this release plan.
- Full compatibility or useful performance improvement fails: retain the evidence and ask the owner
  to reshape the gate. A partial matrix or SDK-boot demonstration does not automatically cut v1.0.

## Open questions

- Which entitled org, Analytics test suite, Target workspace/environment, and AEP sandbox can we use?
- Which pinned Alloy version and product scenario matrix survives the initial compatibility review?
- Which datastream, Analytics, AJO and Assurance setup steps have supported automation APIs for that org?
- What measured performance bands will the investigation establish before implementation specs are approved?
