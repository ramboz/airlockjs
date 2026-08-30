---
status: DONE
dependencies: [012-01]
last_verified: 2026-08-29
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
   populating `reads` (projection fields), `capabilities` (cookie / decisions / egress),
   `endpoints` (the Adobe hosts it knows of), and **`purposes`** (ADR-0007). **Note —
   additive contract edit:** `ConnectorManifest` has **no `purposes` field today**
   (verified: `contracts/connector.d.ts:80` declares only name / events / reads /
   capabilities / endpoints; ADR-0007 says the manifest is *to* carry the purpose
   annotation). So 012-04 **adds** a `purposes` annotation shape to `ConnectorManifest` —
   **additive** (existing fields byte-identical; the `contract-stability` guard stays
   green). Observable: the manifest is present and type-conformant to
   `contracts/connector.d.ts`.
2. **Declared, NOT enforced — a boundary sentinel.** The manifest does **not** gate egress
   in MVP2 (no egress gate exists in `core/` at all yet — the seal is unbuilt, spec
   Assumptions). Observable: a **sentinel** test shows an `interact` egresses whether or not
   it matches a declared `endpoint` — framed as a sentinel that **fails the moment MVP3
   enforcement is *added*** (it asserts an *absence* of gating, so it does **not** map to
   "fail on feature-removal"). `endpoints` recorded as **advisory** (ADR-0006 — host
   allow-list wins). Honest limit: the sentinel cannot distinguish "manifest deliberately
   non-enforcing" from "seal simply unbuilt" — both hold in MVP2; it guards the
   declared-not-enforced boundary until MVP3.
3. **Behaviour characterization artifact — grounding split by axis.** A durable artifact
   (under this slice's Findings and/or `docs/research/`) records alloy's config-driven
   behaviour along **two axes with distinct grounding** (do **not** conflate them into one
   "stub-vs-live" bucket):
   - **Egress-breadth** — the fixed `interact` host plus any server-directed ID-sync /
     demdex URLs the Edge *response* directs. Grounding: **stub (faked net) vs live-Alloy
     (real Edge, creds-gated)** — the demdex / ID-sync breadth is deferred to MVP3's
     Risk-First live-Alloy probe (R-004 open question).
   - **Collection-breadth** — what alloy auto-collects under `context: []` (headless — what
     *this chamber* sees) vs a **default `context`** (device / web / placeContext).
     Grounding: **chamber-observable (`context:[]`) vs NOT chamber-observable *by design*.**
     The default-context modules read ambient globals (`window` / `screen` / `navigator` /
     `Intl`) the chamber **shims away** — so default-context collection is **invisible in
     any chamber run, stub _or_ live** (`context:[]` is used *because* the chamber is
     headless, R-004). It is grounded by **documentation (R-004 / Adobe docs) or a real-DOM
     main-thread run — NOT creds-gated.**
   Observable: the artifact enumerates collected-data categories + egress hosts, tagging each
   with its correct axis + grounding — so MVP3 does not (a) plan a live-in-chamber run
   expecting default-context collection to appear (it won't) nor (b) misread "the chamber
   collected nothing under default context" as alloy being minimal (it is headless).
4. **Framed as MVP3 input — a consolidation-for-handoff, not new investigation.** The
   characterization is largely a **consolidation** of existing R-004 + ADR-0006/0007
   findings plus this chamber's stub observations (deep breadth is MVP3-deferred, per
   mvp2.md's forward-compat scaffolding scope). It explicitly states which findings feed
   MVP3's seam design (authoritative endpoints, payload governance, purpose-vector consent),
   closing the MVP2→MVP3 handoff the release slate links.
5. **No regressions.** GA4 + prior alloy paths green; pinned signatures byte-identical.

**DoD:**
- [x] ACs 1–5 pass; full suite green. *307 vitest (31 files); GA4 + 012-01/02/03 green;
      contract-stability additive (purposes + endpoints byte-identical). No browser rig.*
- [x] Each new test shown to fail when its feature is removed *(manifest field assertions;
      the AC2 sentinel's red-condition companion — an applied MVP3 ceiling holds the
      undeclared host).*
- [x] Reviewed by `reviewer`; **compliance + craft** recorded — both pass
      (`reviews/slice-04-{compliance,craft}.md`). *Craft banner nit fixed.*
- [x] Frame-critique recorded (1 round → the AC3 two-axis split + AC2 sentinel framing +
      the additive `purposes` confirm-ask, corrected) (`reviews/slice-04-frame-critique.md`).
- [x] Deviation log + reconciliation sweep produced (below); reconciliation review recorded.
- [x] `docs/refinement-todo.md` + `docs/releases/mvp3.md` handoff updated with the
      characterization result (the two axes + the three MVP3 seam-design inputs).

**Findings:** — alloy config-driven behaviour characterization (AC3/AC4)

A **consolidation** of the existing grounding — R-004's executed probe, the
012-01/012-02 chamber runs, and ADR-0006/0007/0008 — **not** new investigation
(deep breadth is MVP3-deferred, per [mvp2.md](../../releases/mvp2.md)'s forward-compat
scope). Every row is tagged with its **axis** and its **grounding**; the two axes have
*distinct* grounding and must **not** be collapsed into one "stub-vs-live" bucket.

**Axis 1 — Egress-breadth (where alloy posts).** Grounding split: **stub (faked net)
vs live-Alloy (real Edge, creds-gated)**.

| Egress host | What | Grounding | Status |
|---|---|---|---|
| `adobedc.demdex.net/ee/v1/interact` | the fixed Edge `interact` endpoint (Analytics event + personalization query + `identity.fetch`) | **stub-observed** — R-004 executed probe + the 012-01 chamber captured exactly this one `fetch` | KNOWN — declared as advisory `endpoints` (ADR-0006) |
| server-directed ID-sync / `demdex` / Audience-Manager URLs | third-party sync URLs the Edge *response* returns and alloy then fires | **live-Alloy ONLY — NOT stub-observable** (R-004 faked the Edge response, suppressing the fan-out); **creds-gated** to MVP3 Risk-First | **MEASURED live** ([013-02](../013-mvp3-live-alloy-reprobe/slice-02-egress-fanout.md), 2026-08-30): the real-DOM reference run fired **2 Adobe-first-party origins, ZERO 3rd-party fan-out** = a **LOWER BOUND** (no AAM destinations — not narrowness); manifest stays a **FLOOR, not a complete map** (ADR-0006 Consequences / ADR-0008) |

Honest limit: the stub's single-host result is a **probe artifact**, not evidence of
narrowness — Alloy endpoint-narrowness is an **open question gated on a live-Alloy
breadth probe**, not established fact (ADR-0006 Recommended Decision / kill-criterion).

**Axis 2 — Collection-breadth (what alloy collects).** Grounding split:
**chamber-observable (`context:[]`) vs NOT chamber-observable *by design* (default
context)**. This axis is **NOT creds-gated** — grounded by R-004 / Adobe docs or a
real-DOM main-thread run.

| Data category | Collected when | Grounding | Chamber-observable? |
|---|---|---|---|
| host-supplied XDM (pageView URL/name) + `timestamp` + `implementationDetails` | always (non-removable; need no browser globals) | **chamber-observable** — R-004 + the 012-01 chamber captured this XDM | **YES** — all this headless chamber emits |
| identity cookies (`kndctr_*`, `AMCV_*`, `demdex`, `s_ecid`, `com.adobe.alloy.getTld`) | always (synchronous `document.cookie`) | **chamber-observable** — R-004 counted 33 reads / 5 writes, served by the sync-cache shim | **YES** |
| device / web / placeContext / environment (screen, viewport, `navigator`, `Intl` locale, referrer, …) | ONLY under a **default `context`** (device/web/placeContext modules) | **NOT chamber-observable BY DESIGN** — these modules read ambient globals (`window`/`screen`/`navigator`/`Intl`) the chamber **shims away**; grounded by R-004 / Adobe docs (or a real-DOM main-thread run), NOT by *any* chamber run | **NO** — invisible in **any** chamber run, stub *or* live (the chamber runs `context:[]` *because* it is headless, R-004) |

Two traps this split closes (AC3): MVP3 must **not** (a) plan a live-in-chamber run
expecting default-context collection to appear — it won't (the chamber is headless);
nor (b) misread "the chamber collected nothing under default context" as alloy being
minimal — it is `context:[]`, not minimal alloy.

**MVP3 seam-design inputs (AC4 — the handoff).** This characterization is the input
MVP3's secured-seam design consumes ([mvp3.md](../../releases/mvp3.md) Risk-First). It feeds:
- **Authoritative endpoints (ADR-0006 ceiling).** The declared `interact` host is a
  FLOOR; the server-directed sync breadth (Axis 1, live-only) must be measured by
  MVP3's live-Alloy endpoint-breadth probe before an endpoint ceiling can bite for the
  CDP — whether server-directed destinations can be ceiling'd at all (vs a dynamic
  host-mediated sync allowlist) is open (ADR-0006 kill-criterion).
- **Payload governance (ADR-0006 / OQ11).** The vendor builds the XDM body inside the
  chamber (Axis 2, chamber-observable = host-supplied XDM + identity), so strip-at-seal
  is archetype-fragile — MVP3 probes feasibility ([mvp3.md](../../releases/mvp3.md)
  Split) against the collected categories above.
- **Purpose-vector consent (ADR-0007).** The `purposes` annotation this slice declared
  (`analytics_storage` / `personalization` / `functional` / `ad_storage`) is the vector
  MVP3's grant resolver reads; the shared-identity cookies (`AMCV_`/`kndctr_` →
  analytics **and** personalization) are the "one I/O, several purposes" case its
  per-declared-I/O enforcement must handle.

**Anti-horizontal-phasing check:** after this slice, the alloy connector carries a real
(declared, unenforced) manifest and a characterization MVP3 can design against —
observable value is the disclosed declaration + the characterization artifact, the thing
MVP3's enforcement is built on, not internal wiring.

### Deviation log (after reconciliation)

1. **Tightened at frame-critique** (1 round): AC3 split into two distinctly-grounded axes
   (egress-breadth = stub vs live-Alloy/creds-gated; collection-breadth =
   chamber-observable `context:[]` vs NOT-chamber-observable-by-design → docs/real-DOM,
   **not** creds) — the primary fix, avoiding an MVP3 misread; AC2 re-framed as an
   absence-of-gating **sentinel**; AC1 **named** the additive `purposes` contract edit;
   AC4 framed as consolidation.
2. **`purposes` is a new additive `ConnectorManifest` field** (`ConsentPurpose` +
   `ConnectorPurposes`, ADR-0007) — existing fields byte-identical (contract-stability
   guard green).
3. **`endpoints` declared as a FLOOR** (the one `interact` host), not a complete map —
   server-directed demdex / ID-sync breadth is creds-gated MVP3 (documented in the
   connector + characterization).
4. **Craft-flagged for the MVP3 handoff:** `ad_storage` surfaces on the `demdex` cookie but
   not on overall `purposes.egress` (the ad-sync host is the deferred floor-gap, not yet an
   enumerable endpoint) — MVP3 reconciles whether `egress` gains `ad_storage` once those
   sync endpoints are enumerable.
5. **`ConsentPurpose` is open (`string & {}`)** per ADR-0007 ("widenable, not a closed
   enum") — the "no invented purposes" invariant is runtime-enforced, by design.
6. **`contract-stability` header fixed** (was "012-01 AC6 ONLY"); the 012-04 additions also
   pin `decisions.fetch`/`deliver`, **partially closing 012-03 tracked-debt (f)**.
7. **`tsc` not installed locally / not in the CI gate** — the `.d.ts` change is validated by
   runtime shape tests + reasoning (consistent with how the repo tests manifests).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `contracts/connector.d.ts` | `updated` | **Additive** `ConsentPurpose` + `ConnectorPurposes` + `ConnectorManifest.purposes?` (ADR-0007); existing fields byte-identical. |
| `connectors/alloy/connector.js` | `updated` | Populated manifest `endpoints` (advisory floor) + `purposes`; pre-012-04 fields untouched. |
| `test/alloy-manifest-declaration.test.js` | `created` | AC1 declaration + AC2 sentinel with a red-condition companion (applied ceiling → held at the seal). |
| `test/contract-stability.test.js` | `updated` | `purposes`/`endpoints` additive pins + `decisions.fetch`/`deliver` pins (partly closes debt (f)); header fixed. |
| `docs/specs/012-…/slice-04-manifest-characterize.md` (§Findings) | `updated` | The two-axis characterization artifact (AC3/AC4). |
| `docs/releases/mvp3.md` | `updated` | JIG Handoff pointer to the characterization + the three seam-design inputs. |
| `docs/refinement-todo.md` | `updated` | MVP3-input note (012-04). |
| `core/**`, `connectors/ga4/` | `no-op` | Declaration + characterization only — untouched + green. |
| `docs/architecture.md` | `no-op` | No boundary change (additive declaration; no enforcement built). |
| `docs/specs/README.md` | `updated` | Status board regenerated. |
| Primer `CLAUDE.md` / `docs/memory/**` | `no-op` | Recorded in the slice + handoff docs. |
