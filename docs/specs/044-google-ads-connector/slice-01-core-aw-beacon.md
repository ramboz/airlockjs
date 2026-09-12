---
status: DRAFT
dependencies: [adr-0019, 039-02, 039-05, 026-01, 038-01]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 044-01 — core AW page-load beacon off-thread (Consent-Mode + auid, parity-confirmed)

**Goal:** Stand up a new `connectors/google-ads/` connector that reproduces the reference site's **Google Ads (`AW-…`)
page-load remarketing/conversion-linker beacon** off-thread as a **governed GET**, **granted-consent**, carrying Consent
Mode v2 (`gcs`/`gcd`) via the **reused spec-039 encoders** and the host-sourced first-party linker id (`_gcl_au` →
`auid`), forwarding an inbound `gclid`/`wbraid`/`gbraid` when present in the landing URL. Parity is a **same-protocol
beacon diff** under the [038 harness](../038-parity-harness/spec.md) on a **redacted AW capture** (ADR-0019 model). This
is the first vertical of MVP8's ad-conversion offloading — the page-load family only (the true conversion ping is MVP9,
spec 044 §A3).

**The connector-shape decision (why `arch_review: true`).** Google Ads sits between airlock's two connector shapes: it
carries gtag-family **Consent Mode** + a seal-hold rule (unlike a plain 026 pixel config) but has **no** GA4-style
session state (unlike the 039 gtag connector). The recommended shape — **a dedicated `connectors/google-ads/` connector
that reuses 039's Consent-Mode encoders + 026's governed GET egress** — is the arch pass's decision to ratify or redirect
(rejected alternatives, spec 044 §Overview: pixel-config; 039-extension). If ratified as load-bearing with rejected
alternatives, it warrants an ADR at reconciliation (the gtag-family analogue of ADR-0019).

**DoR:**
- ✅ Wire shape GROUNDED (spec 044 §A1): the AW page-load beacon family + `gcs`/`gcd`/`npa` + first-party `auid` are on a
  real redacted `erp.intuit.com` capture (R-009 §(b), 2026-09-11). The raw capture is local-only (R5); the committed
  fixture is redacted (real-*shaped* synthetic values).
- ✅ Reuse is real, not aspirational: 039's `gcs` (039-02) + `gcd` (039-05) encoders emit the exact carriage the AW pings
  showed; 026's worker GET egress is the dispatch path; 038's same-protocol oracle + `rig/parity/` is the verifier.
- ✅ Additive — no stable-core (ADR-0017) surface touched; a new connector module, exactly as 039 was additive to the MP
  path.

**Acceptance Criteria:**

1. **A new `connectors/google-ads/` connector emits the AW page-load beacon as a governed GET off-thread.** Given a
   granted-consent vector + an `AW-…` conversion id, the connector produces the parity-significant page-load beacon
   (`googleads.g.doubleclick.net/pagead/viewthroughconversion/<id>/` and/or its `rmkt`/`ccm` peers — the subset the 038
   oracle confirms carries attribution, A1) with `method: "GET"`, dispatched through `core/airlock.js` egress from the
   worker exactly as the pixel connector does. No `api_secret`; auth is `tid`/`AW-id` + origin (ADR-0019 model).
2. **Consent Mode v2 carriage via the reused 039 encoders.** The beacon carries `gcs` (state) + `gcd` (defaults) + `npa`,
   produced by spec 039's existing `gcs`/`gcd` encoders (imported/reused, **not** re-authored) — asserted byte-equal to
   the captured granted-state carriage (`gcs=G111`, the observed `gcd`, `npa=0`). If reuse needs a shared home (the
   encoders live under `connectors/ga4/`), extract to a neutral module rather than duplicating (ADR-0002).
3. **First-party linker id + inbound click ids.** `auid` is sourced host-side from the `_gcl_au` cookie
   (`analytics_storage`/`ad_storage`-gated, mirroring `sourceGa4Ctx`'s `_ga`→`cid`, 017-02); an inbound
   `gclid`/`wbraid`/`gbraid` present in `document.location` is forwarded as the corresponding param, absent otherwise (a
   direct load carries none — R-009 §(c)).
4. **Parity-confirmed by the 038 same-protocol oracle on a redacted AW capture.** A new AW redactor (`rig/parity/`,
   mirroring `redactMetaBeacon`/the GA4 redactor: synthetic-shaped `AW-id`/`auid`/`gclid`, scrub URL-embedded click ids)
   produces a committed `test/fixtures/parity-google-ads-*.redacted.json`; the connector's replayed beacon classifies as
   a **match** under the 038 oracle (field-level semantic diff, never raw URL equality; `_p`/`rnd`/`fst`/cachebusters
   normalized out). No live identifier is committed (CLAUDE.md security-MUST / ADR-0018 R5).
5. **Additive + behavior-preserving.** `npx vitest run` green (full suite); no existing connector (GA4/pixel/alloy/RUM)
   or the stable-core contract changes. New unit tests cover the AW beacon build (granted-state), the `gcs`/`gcd` reuse,
   and the `_gcl_au`/click-id sourcing edges.

**DoD:**
- All ACs met; full `npx vitest run` green; the AW redactor + redacted fixture committed; the 038 oracle reports a match.
- `arch_review: true` pass recorded (the connector-shape decision) alongside compliance + craft; if the shape decision is
  ratified as load-bearing with rejected alternatives, an ADR is authored at reconciliation.
- Reconciliation walked; `docs/architecture.md` connectors section updated to name `connectors/google-ads/`.

**Out of scope (explicit):**
- The `ad_storage`-**denied** path — seal-hold (slice 044-02).
- The true AW **conversion** ping with enhanced-match hashes — MVP9 (spec 044 §A3).
- The **cross-site DMP-sync** pixel (`cm.g.doubleclick`) — E10 (spec 044 §A4).
- Console-level attribution parity — MVP9.
- The **Floodlight** (`DC-…`) connector — its own sibling spec.

## Assumptions

**A1 (parity-significant endpoint subset).** The AW tag fires several page-load endpoints (`viewthroughconversion` +
`rmkt/collect` appear to be mirror pairs; `ccm/collect` is the Consent-Mode collect); which carry attribution *value* vs
are redundant remarketing mirrors is decided against the 038 oracle during implementation, not assumed. *Risk if wrong:*
reproducing a redundant mirror (or missing the significant one) shows as an oracle gap, caught by AC4. See spec 044 §A1.

**A2 (Consent-Mode encoder reuse is clean).** 039's `gcs`/`gcd` encoders are vendor-neutral enough to reuse for AW
without GA4-specific coupling. *Risk:* if they carry `/g/collect`-specific assumptions, AC2's ADR-0002 extract applies
(shared neutral module). Grounded by: the captured AW `gcs`/`gcd` are byte-identical to GA4's on the same page.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] `docs/architecture.md` connectors section names `connectors/google-ads/`.
- [ ] If the connector-shape decision is ratified load-bearing, its ADR is authored + linked here.
- [ ] Register namespace `airlock/google-ads` (mirroring `airlock/ga4-gtag` etc.).
