---
status: Accepted
dependencies: [adr-0006, adr-0007, adr-0017, adr-0047]
last_verified: 2026-11-06
frame_review: true
---

# ADR-0055: Exact local Meta referrer storage

The first PageView needs persisted referrer state that the existing cookie
permission does not cover. Give the local replacement one exact two-key
storage operation. Keep classification and lifetime decisions in its worker.
The tradeoff is a new bounded persistence permission and explicit partial-write
failures, with native behavior still unqualified.

## Status

Accepted (2026-11-06)

The canonical Meta integrator assigned ADR-0055 and slice 060-18 to
`meta-referrer-parity` after current Google/Adobe/prior-Meta noncompetition
checks at clean base `d3f624418897cbc698214705c0c05d0fee0fed9d`.
This is an explicit feature-line reservation, not an origin/main/global
helper reservation. IDs 0045/0046/0047/0048 remain occupied outside this base;
their absence here is not permission to reuse them. The packaged Jig template
is used at the confirmed ID rather than the helper's conflicting local
max-plus-one or default main/push/PR route.

The owner selected "Approve this exact capability design (Recommended)" and
then approved the session plan with autopilot. The choice explicitly excluded
acceptance of an unwritten ADR, runtime implementation before its acceptance,
and browser/SDK/live/deployment authority. The final numbered recommendation
required independent Sol framing and explicit owner acceptance.

Both fresh explicitly pinned Sol frame critiques passed and are recorded.
Final owner acceptance was requested against authoring commit
`39ba68283877fa1280c46e3711e8d6db95cb8b5c`. The input tool returned owner
unavailable, without an acceptance choice. At that checkpoint this ADR
remained Proposed and runtime work stayed blocked. The unavailable prompt
was not acceptance; preliminary design/app plan approval was preserved.

The canonical coordinator subsequently relayed the owner's actual ask_user
selection: "Accept ADR-0055 exactly as written (Recommended)". That question
bound acceptance to the Recommended Decision at
`fecc0c93328608d0405ee1c4a8b68ab93938418d`, including the nontransactional
partial-write risk and all exact local/default-off limits. This is explicit
owner acceptance, not inference from autopilot, a reminder or unavailability.
Browser/SDK/native/live/site/account/deployment execution remains excluded.

## Context

The retained official SDK 2.9.426 configuration samples last-external-referrer
state when its plugin installs. It stores a category and timestamp separately,
then its event listener returns the cached category. Same-host navigation
preserves both values; an absent or external referrer replaces them. The
source trace is C:L121-122, UTF-16 offsets 158035-159692, with lifetime/state
logic at 159059-159460. Source pins and original-role locators are preserved
by the session plan, not reconstructed from a configuration URL.

The current standalone prototype already snapshots raw context on the host,
retains connector state in the worker and mediates exact `_fbp` operations:
`adapters/meta-pixel-prototype.js:610-662,723-768,798-813` and
`connectors/meta-pixel/pageview-prototype.worker.js:33-43,110-124`.
The `_fbp` permission is a different persisted input. It grants no referrer
storage operation.

`contracts/capability.d.ts:123-128` provides asynchronous mediated
`storage.get/set/remove`, explicitly distinct from real localStorage.
ADR-0017 freezes those signatures. Use their shape in the standalone private
protocol without modifying core/contracts or assuming their presence grants
browser persistence. ADR-0006's declared/allowed/consent intersection and
ADR-0047's trusted first-party mapper remain the governing boundaries.

## Decision Options Considered

### Option A: Reuse a broad storage or cookie grant

- **Pros:** Less explicit per-operation plumbing.
- **Cons:** `_fbp` does not authorize these keys, and the frozen storage
  signature does not supply a real browser backing. A broad jar, arbitrary
  names or general localStorage would expand unrelated authority.
- **Disposition:** Reject.

### Option B: Give the standalone local path exact two-key authority

- **Pros:** Represents the source-backed state shape with one worker semantic
  owner and a small privileged host operation. Default/production paths stay
  untouched.
- **Cons:** Two writes are not atomic. Local initialization sampling and strict
  invalid-state/consent handling still need independent native qualification.
- **Disposition:** Selected by the owner's explicit final acceptance.

### Option C: Store independently named Airlock state or only an ephemeral category

- **Pros:** Avoids interaction with the vendor's named pair; ephemeral state
  avoids persistence entirely.
- **Cons:** Different persistence names need their own returning-state contract.
  Ephemeral state cannot reproduce same-host retention. Neither closes this
  persisted-referrer gap by itself.
- **Disposition:** Reject for this packet. Do not seed native state instead.

## Recommended Decision

Select Option B with all the following limits.

| Authority | Exact ceiling |
|---|---|
| Feature | `experimentalPageViewReferrer` defaults false. Enabled use requires an explicit host-owned `referrerStorageBinding` with one canonical loopback origin. A binding with the flag off rejects configuration. |
| Origin | One `http://127.0.0.1:<port>` origin, port 1-65535. Backing window and captured page must match it. No aliases, other origin/port, domain choice or worker-provided backing. |
| Names | Exactly `lastExternalReferrer` and `lastExternalReferrerTime`. No prefixes, enumeration, `clear`, other namespace or probe key. |
| Operations | `get`, `set`, and worker-detected-expiry-only `remove`. No denial-time deletion, automatic repair, migration or rollback. |
| Size/work | Each value is null or at most 16 well-formed ASCII bytes. At most eight primitive operations per installation: two initial reads, two optional expiry removals, two optional writes and two optional write-readbacks. One outstanding operation, no concurrent cookie fulfillment or egress while sampling. Existing command/transport deadlines remain bounded. |
| Raw capture | Existing bounded page URL/referrer plus at most 1024 characters of actual UA and actual XMLHttpRequest-defined boolean. No UA persistence or egress; no Storage object, callable or DOM node transfer. |
| Consent | Explicit host `ad_storage` grant at capture and immediately before each primitive access and response delivery; intersect with admitted tag permission. Missing/pending/denied/revoked permission performs no new capture, storage access or probe. |
| Consumer | Only the single synthetic-Pixel PageView experiment. Reject combinations enabling arbitrary routing, multi-Pixel or other events. Existing explicitly opted-in timing and `_fbp` controls retain their own ceilings. Live/owned factories reject this feature and binding. |

The worker validates the first local `init` command before performing one
installation sample. It commits the referrer cache only after successful
sampling/readback, then completes initialization. PageView consumes that
cache; it does not sample or refresh storage again.

Worker-owned eligibility uses the pinned source predicates. Skip Android
UA containing case-sensitive `Android` and `FB_IAB` or `Instagram` when
XMLHttpRequest is defined. Skip UA containing `AppleWebKit` plus `FBIOS`,
`Instagram` or `MessengerLiteForiOS`. No no-argument version threshold is
invented. The source detector ranges are C:L97/99, 139374-140250, and
C:L101, 140252-140696; plugin gates are C:158832-158903.

Read the pair privately. Both keys absent is fresh state. A complete pair
requires a canonical, nonnegative safe-integer epoch-millisecond timestamp
no later than the worker's sample time. Partial, malformed, future or
oversized state rejects sampling visibly. A bounded unknown category with
a valid timestamp maps to `other` in the worker, following C:159366-159460.

Worker-owned expiry is age greater than 90 days, without rounding.
Exactly 90 days is valid. Expiry removes both keys before current-referrer
processing. Absent referrer writes `empty` plus current time; external
referrer writes `fb`, `ig` or `other` plus current time. Facebook/Instagram
matching is exact host or dot-delimited subdomain. Same-host navigation
changes neither value nor time, including legitimate no-category fresh
state. State/refresh evidence is C:159059-159362.

The host captures bounded primitives and enforces origin, declaration,
names, operations, size, active-command correlation and consent generation.
It does not parse timestamps, classify referrers or duplicate worker mapping.
The worker retains all interpretation, counters, hashes and request
construction. A worker storage request cannot mark itself as a new trusted
instance or select a different backing.

Host revocation invalidates queued/prepared operations and advances an
ordered private invalidation generation. Clear worker raw/referrer state,
withhold stale responses and recheck before subsequent egress. Do not touch
persisted keys while denied. Regrant does not replay earlier events or revive
the old cache. That instance's later PageView omits `ler`; a fresh explicitly
initialized instance may sample under the new grant.

Absent/unsupported storage and ineligible platform have explicit bounded
dispositions and omit `ler`. A storage-access exception, readback mismatch,
invalid envelope, duplicate/stale response or timeout fails visibly. Preserve
issued-effect counts; do not return successful persistence, a fake `empty`
category, automatic retry or native fallback.

This is a nontransactional two-key operation. A failure between effects can
leave a partial pair. Stop and report it; this grant supplies no rollback,
repair loop, tab locking, storage-change subscription or general coherence.
Neither a passing protocol check nor the trusted mapper decision establishes
resistance to malicious semantic mapping.

## Consequences

The local replacement can exercise installation-time persisted-referrer
construction and PageView serialization independently of native-seeded state.
No general storage service, second mapper or stable-core signature is added.

The strict malformed/partial/future timestamp rejection and no-regrant-cache
rule are owner-selected local safety choices. They differ from permissive
static source handling and are not native lifetime, consent or cohort parity.
UA/source realm, sampling time, cross-tab effects, native responses and full
060-01/C1-C9 still need their original evidence. `_fbp` authority is unchanged.

## Assumptions

- The standalone private protocol can carry this bounded operation without a
  frozen-surface change. Source shows a similar cookie-message seam, not a
  demonstrated referrer implementation.
- The first successful replacement `init` is a useful local installation
  point. Its equivalence to native configuration-plugin installation remains
  unproved, as does raw document referrer versus an enabled SDK manager mode.
- The narrowed local scope can preserve both fixed serving import closures.
  This needs audited Node HTTP controls in the implementation state.

## Kill criteria

- Main performs referrer classification, lifetime arithmetic or request mapping.
- The worker gets ambient storage, arbitrary names/origins or a broad new jar.
- Denial/stale generation permits access, response delivery or replay; regrant
  resurrects state without the selected fresh-installation boundary.
- Unavailable/partial storage becomes a success-shaped result or invented
  category. Fixed guards are removed to pass closure tests.
- Synthetic controls become native/browser qualification, or this decision
  is used as SDK/browser/live/deployment permission.

## Open questions

Owner acceptance resolves the exact local authority choice only. Native sampling,
consent/lifetime/cohort behavior and the optional `ler`/`plt` comparison retain
separate source/operational review and explicit execution approval. Full
060-01 and Pixel parity stay open.
