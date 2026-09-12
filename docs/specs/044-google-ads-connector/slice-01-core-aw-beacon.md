---
status: DONE
dependencies: [adr-0019, 039-02, 039-05, 026-01, 038-01]
last_verified: 2026-09-11
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

1. **A new `connectors/google-ads/` connector emits the AW page-load beacon as a governed GET.** Given a
   granted-consent vector + an `AW-…` conversion id, the connector's `handle()` returns the parity-significant
   page-load beacon as a `{ method: "GET" }` `EgressRequest[]` — the same `contracts/connector.d.ts` contract
   `core/airlock.js` already dispatches for the pixel/gtag connectors (verified end-to-end by the 038 parity replay,
   AC4). No `api_secret`; auth is `tid`/`AW-id` + origin (ADR-0019 model). **Boot/worker wiring is out of scope** (see
   Out of scope) — this slice ships the connector contract + parity, mirroring 039-01 (whose boot landed later, spec 041).
2. **Consent Mode v2 carriage via the reused 039 encoders.** The beacon carries `gcs` (state) + `gcd` (defaults) + `npa`,
   produced by spec 039's existing `gcs`/`gcd` encoders (imported/reused, **not** re-authored) — asserted byte-equal to
   the captured granted-state carriage (`gcs=G111`, the observed `gcd`, `npa=0`). Because the encoders live under
   `connectors/ga4/`, extract to a shared module rather than duplicating (the extract-on-third-caller convention,
   `docs/conventions.md` § Code) — and, since `gcs`/`gcd` are Google-specific wire-shape, that home is **connector-side**
   (`connectors/consent-mode.js`), never `core/` (which carries no vendor coupling — `docs/architecture.md`).
3. **First-party linker id + inbound click ids — read-when-present, NEVER minted.** `auid` is sourced host-side from the
   `_gcl_au` cookie **when it exists** (`ad_storage`-gated), and **omitted when absent — airlock does NOT mint
   `_gcl_au`.** This deliberately diverges from `sourceGa4Ctx`'s `_ga`→`cid` (which mints an arbitrary-but-valid client
   id when absent): `_gcl_au` encodes a real Google-Ads click signal that a fabricated value would corrupt (polluting
   remarketing audiences), so airlock forwards it or omits it, never invents it (see **A3** — the `_gcl_au`-writer gap
   on a rewired page). An inbound `gclid`/`wbraid`/`gbraid` in `document.location` is forwarded as the corresponding
   param when present, omitted otherwise (a direct load carries none — R-009 §(c)). Unit tests cover present→forwarded
   and absent→omitted for both `auid` and the click ids.
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
- `arch_review: true` pass recorded (the connector-shape decision) alongside compliance + craft; the shape decision is
  recorded as a **lightweight decision** + the `docs/conventions.md` § Code extract-on-third-caller convention (owner
  ruled convention-not-ADR, 2026-09-11), not an ADR.
- Reconciliation walked; `docs/architecture.md` connectors section updated to name `connectors/google-ads/` +
  `connectors/consent-mode.js`.

**Out of scope (explicit):**
- The `ad_storage`-**denied** path — seal-hold (slice 044-02).
- The true AW **conversion** ping with enhanced-match hashes — MVP9 (spec 044 §A3).
- The **cross-site DMP-sync** pixel (`cm.g.doubleclick`) — E10 (spec 044 §A4).
- Console-level attribution parity — MVP9.
- The **Floodlight** (`DC-…`) connector — its own sibling spec.
- **Boot / worker wiring** — a `core/airlock.js` branch + a `google-ads` chamber worker + adapter/config selection. A
  future 041-style boot slice for `connectors/google-ads/` (mirrors GA4-gtag: 039-01 shipped the connector, spec 041
  wired the boot). This slice delivers the connector contract + the 038 parity replay only (compliance-review reconciliation, 2026-09-11).

## Assumptions

**A1 (parity-significant endpoint subset).** The AW tag fires several page-load endpoints (`viewthroughconversion` +
`rmkt/collect` appear to be mirror pairs; `ccm/collect` is the Consent-Mode collect); which carry attribution *value* vs
are redundant remarketing mirrors is decided against the 038 oracle during implementation, not assumed. *Risk if wrong:*
reproducing a redundant mirror (or missing the significant one) shows as an oracle gap, caught by AC4. See spec 044 §A1.

**A2 (Consent-Mode encoder reuse is clean).** 039's `gcs`/`gcd` encoders are **gtag-family** (Google Consent Mode v2)
wire-shapers, reusable across the family (GA4-gtag, Google Ads, Floodlight) without `/g/collect`-specific coupling. They
are **not** vendor-neutral (they emit Google wire strings like `G111`), so their shared home is **connector-side**
(`connectors/consent-mode.js`), NOT `core/` — the extract-on-third-caller convention applied to a vendor wire-shape
(`docs/conventions.md` § Code; corrected from the 044-01 arch review). Grounded: the captured AW `gcs`/`gcd` are
byte-identical to GA4's on the same page (a pure function of the consent vector + declared default).

**A3 (the `_gcl_au`-writer gap — NAMED, not assumed away; folded from the 044-01 frame-critique 2026-09-11).** `_gcl_au`
is written by the Google **conversion-linker runtime** — the container tag airlock replaces (repo-wide search: **zero**
`_gcl_au` writers in airlock). R-009 §(c) read `_gcl_au` only because the capture ran on the live *container-driven*
`erp.intuit.com` page (linker present); on a fully-rewired, container-removed page nothing writes it, so a pure read
yields **no `auid`** and the remarketing beacon loses first-party identity. This is the strict analogue of GA4's
`_ga_<stream>` no-writer gap (**OQ13-2**, `docs/refinement-todo.md`). **Disposition (AC3): read-when-present /
omit-when-absent / never-mint** — a fabricated `_gcl_au` is a garbage remarketing-audience key (unlike an arbitrary
`_ga` cid). The "who writes `_gcl_au` after the container is removed, and is airlock ever justified minting one?"
question is a **named residual** ([refinement-todo](../../refinement-todo.md), MVP9-triggered), *not* silently deferred.
*Consequence for AC4:* the 038 oracle diffs a **synthetic** `auid` on both sides → it confirms `auid` **shape/position**
parity, **not identity presence**; identity-presence (does a real remarketing key reach the vendor on a rewired page) is
an MVP9 live-rewire question. This slice claims the former, explicitly not the latter.

### Deviation log (after reconciliation)

Implemented as framed, with three review-driven corrections (all folded before REVIEWED; no scope change):

- **Consent-Mode encoder home corrected (arch review).** AC2 said "extract to a neutral module"; the arch pass caught
  that `gcs`/`gcd` emit Google-specific wire strings, so the home is **connector-side** `connectors/consent-mode.js`
  (reused by ga4-gtag + google-ads), NOT `core/` (which carries no vendor coupling). The generic `appendParam` builder
  DID go to a vendor-neutral core leaf `core/query-params.js`. Both extractions are verbatim + behavior-preserving
  (gtag's tests stay green). Recorded as the `docs/conventions.md` § Code extract-on-third-caller convention.
- **Phantom "ADR-0002" de-cited (arch review; owner ruled convention-not-ADR).** 039/043/044 mis-cited a nonexistent
  airlock `adr-0002-extract-helper-on-third-caller.md` (that's the jig *plugin's* ADR-0002; airlock's ADR-0002 is
  event-descriptor-cycle-semantics). De-cited across code + the 039/043/044 specs + refinement-todo → the new
  convention; the connector-shape is a **lightweight decision**, not an ADR (owner call 2026-09-11). airlock's real
  ADR-0002 citations untouched.
- **AC1 softened to contract-level (compliance review).** The slice ships the connector contract (`handle()` → GET
  `EgressRequest[]`) + the 038 parity replay only; boot/worker wiring is an explicit Out-of-scope item owned by a
  future 041-style boot slice (mirrors 039-01→041).
- **A1 endpoint decision:** `ccm/collect` (full `gcs`/`gcd`/`npa` + clean `tid`/`en`/`dl`/`dt`/`auid`), over the
  `viewthroughconversion`/`rmkt` mirror pair (only `gcd`, opaque `data=event…`, device-noise-dominated) and the
  `ccm/form-data` enhanced-conversions channel (hashes egress only on a conversion event — MVP9). Grounded on R-009.
- **auid is shape-parity only** (§A3): identity-presence on a rewired page is the named OQ13-b residual (MVP9).
- Craft nits (npa-under-pending integration assertion; redactor cookie-scrub doc; `readClickIds` empty-value edge) are
  logged as non-blocking follow-ups.

### Reconciliation sweep

Drift-prone surfaces (`updated` / `no-op` / `deferred`):

- **`docs/architecture.md`** — `updated`: connectors section names `connectors/google-ads/` + the shared
  `connectors/consent-mode.js`; the registry namespace gains `airlock/google-ads`. (Module boundary changed — a new
  connector + a shared gtag-family module; recorded as a lightweight decision + the `docs/conventions.md` § Code
  convention, not an ADR, per the owner ruling.)
- **`docs/conventions.md`** — `updated`: new § Code extract-on-third-caller + core-vs-connector home convention (owner
  approved). **`docs/decisions/lightweight-decisions.md`** — `updated`: the gtag-family connector-shape decision.
- **`docs/refinement-todo.md`** — `updated`: OQ13-b (`_gcl_au`-writer gap, MVP9) added; phantom ADR-0002 de-cited.
- **Closed-spec drift (ADR-0010; owner-approved)** — `updated`: the phantom extract-concept "ADR-0002" citations in the
  DONE specs **039** + **043** de-cited to the convention — **all forms**: the broken `adr-0002-extract-helper` links,
  the plain-text "ADR-0002 is the governing decision" / "inline-mirror budget" references, AND the 043 slice frontmatter
  `dependencies: [adr-0002]` (dropped — the extraction rule is a convention, not a dep-able ADR). airlock's **real**
  ADR-0002 (event-descriptor-cycle-semantics) citations across core/connectors/ADRs/003/006/014/037 are left intact
  (verified by a full classify-each grep). Historical `reviews/*.md` records left as-is (point-in-time).
- **Primer (`CLAUDE.md`/`AGENTS.md`)** — `no-op`: no 044 primer entry; spec-close compress waits (slice 044-02 remains).
- **`docs/inbox.md`** — `no-op`: nothing surfaced (the DC-1996823 Floodlight id pre-existing in R-007 belongs to the
  sibling Floodlight spec).
- **Leanness** — `no-op`: arch ratified the shape; the `core/query-params.js` vs pixel-inline-copy question is a logged
  nit (refactor-pixel-or-reword), not over-build.
- **Use-case coverage (advisory)** — `no-op`: 044 traces UC-2; non-blocking.
- **Memory-sync** — the reference-page URL switch + ad-family recon technique were persisted this session; the
  phantom-ADR-0002 confusion is now canon in `conventions.md`.

### Close-out (post-DONE)

- [x] `docs/architecture.md` connectors section names `connectors/google-ads/` + `connectors/consent-mode.js`.
- [x] Connector-shape recorded as a **lightweight decision** + the `docs/conventions.md` § Code convention (owner ruled
  convention-not-ADR, 2026-09-11) — supersedes the earlier conditional-ADR plan.
- [x] Namespace `airlock/google-ads` declared in the connector manifest + listed in `docs/architecture.md`; runtime boot
  registration lands with the deferred boot slice.
- [ ] Spec 044 closes when slice 044-02 (denied-path seal-hold) is also DONE; regenerate the board then.
