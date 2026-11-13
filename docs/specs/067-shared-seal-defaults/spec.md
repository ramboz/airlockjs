---
status: IN_PROGRESS
skill:
use_cases: [UC-2, UC-6]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 067: Shared seal defaults (ADR-0062)

> **Implements the shared follow-up work of [ADR-0062](../../decisions/adr-0062-stock-default-parity.md) (Accepted, 2026-11-13).**
> Definition of done for vendor work: [ADR-0061](../../decisions/adr-0061-definition-of-done-vendor-compatibility.md) (Accepted).
> This spec lands on `main` once. The coordinator later merges `main` into `vendor-adobe`, `vendor-google-ads` and `vendor-meta-pixel`.

## 0. Summary for the owner

**What changes.** Out of the box, every vendor track sends what the stock tag sends, reads what it reads and stores what it stores. Today the shared seal and the Alloy connector start narrower than stock. This spec moves the shared defaults on `main` to the stock baseline and keeps two privacy-first exceptions on: the consent hold, and the credentials denylist. Sites turn the narrower controls on.

**Why it matters.** Vendor slices (Adobe 064, Google 065, Meta 066) cannot close their parity rows until these shared defaults exist. Without this spec each vendor branch would invent its own version.

**Main tradeoff.** The chamber sees more page data by default. The egress confinement, endpoint ceiling, consent hold and denylist still bound where data goes and when.

**What needs you.** Nothing open. The owner answered D1 to D4 on 2026-11-13 (section 7). This spec implements ADR-0062 and does not re-open it.

## 1. Scope

In scope: the shared mechanisms on `main` that ADR-0062 points 2 to 7 require, plus the docs rewording its "Existing decisions" table asks for.

Out of scope (each stays on its vendor branch):

- Each vendor's actual stock destination list, stock cookie and storage set, and per-field fidelity. Vendor inventory slices fill them: spec 064 (Adobe), 065 (Google), 066 (Meta).
- Per-field Alloy environment fidelity against the pinned 2.31.1 bytes, and storage seeding. That is [064-17](#boundary-with-064-17), which depends on slices here.
- Credentialed cross-site egress (ADR-0020 E10). Still deferred (ADR-0062 Owner answers, 2).
- Spec 060's "approved forms" and owner-registered roots (Meta). See [Meta opt-ins](#meta-opt-ins-approved-forms-and-owner-registered-roots).

## 2. Grounded facts (read from `main`, 2026-11-13)

These are the starting points each slice re-verifies in its own DoR.

| Fact | Where |
|---|---|
| The Alloy code default is `context = []`, and the chamber config is `configure({ datastreamId, orgId, context: [] })`. | `connectors/alloy/connector.js:60,104` |
| `toXdm` forwards a 2-field mapping, not the site-supplied `xdm`. | `connectors/alloy/connector.js:227,290` |
| The core seal folds a beacon's `purposes.egress` against the consent vector. A missing vector becomes `{}`, and `resolveConsent` returns `pending` for any missing purpose, but the EDS adapters set `egressPurposes: consent ? X : []` (`adapters/eds/index.js:513,792,893,1038,1150`). With no consent input `egressPurposes` is empty, the seal is skipped and every track sends today. There is no diagnostic that no input is wired. The real change site is those adapter gates. | `core/airlock.js:184,304,464`; `adapters/eds/index.js:513,792,893,1038,1150`; `core/consent.js:60-67,110-121` |
| Held beacons sit in `heldBeacons`, which has no cap in code, although ADR-0004 and architecture.md Q2 describe a capped ring that drops the oldest. | `core/airlock.js:185,782-785`; `docs/architecture.md:193` |
| The wrapped-SDK seam drops on pending (strict verdict) and is gated on `egressPurposes.length`. With a consent vector but empty `egressPurposes` the seam logs a diagnostic and does not gate. Alloy's pending hold is chamber-native (`defaultConsent:"pending"`, spec 045-02), and a missing consent vector means no `defaultConsent`, so Alloy sends. | `core/wrapped-sdk-host.js:101-115,205-215,325-341`; `connectors/alloy/consent.js:106-152` |
| The endpoint ceiling is built once from the connector's declared `endpoints`. It is gated on `ceiling.length`, so a caller that declares none has no ceiling. Matching is origin+path, with an opt-in `;` prefix mode for Floodlight. | `core/airlock.js:164-185`; `core/endpoint-ceiling.js:1-60` |
| Cookie grants are name-scoped: `matchesGrantedName` (exact name, or `prefix_` match), applied on read (`scopeSeedCookies`) and on write-back. | `core/cookie-scope.js:59-104`; `core/wrapped-sdk-host.js:516-528` |
| The unload keepalive budget is `KEEPALIVE_BUDGET_BYTES = 64 * 1024`, and `createCriticalDispatcher` drops a per-tracker send once `used + bytes > budgetBytes`. | `core/egress.js:33,94,137` |
| The built-in `DEFAULT_DENYLIST` is merged with the host's `payloadDenylist` at construction. The host list only extends it. There is no way to override or disable the built-in list today. | `core/payload-governance.js:88-100`; `core/airlock.js:130-146` |
| No shared mechanism for "approved forms" or owner-registered roots exists on `main`. A search of `core/`, `connectors/` and `adapters/` finds none. | n/a |

## 3. Decomposition

SPIDR, rules first. Each slice is sized for one fresh session and ships observable behavior. Slice 01 is docs-only and is implemented with this spec. The others wait for owner approval, then the coordinator dispatches each to a fresh session.

Order: 01 (docs) first, then 11 (the measurement purpose), then 02. 04, 05, 06 and 09 are independent of each other. 03 follows 02. 07 precedes 08. 09 precedes 10. 08 follows 07, 09 and 10 (the wider default context must not ship before input governance and the denylist override). The storage grant (05 AC5) is a new mechanism: carried check 7.

| Slice | ADR-0062 point | One line |
|---|---|---|
| [067-01](slice-01-adr-status-and-docs-rewording.md) | table | ADR status lines and the docs rewording (docs only) |
| [067-11](slice-11-measurement-purpose-helix-rum.md) | 4 (D4) | A privacy-safe measurement purpose, granted by default, that governs helix-rum |
| [067-02](slice-02-consent-hold-no-input-warning.md) | 4 | Consent hold on every track, a no-consent-input diagnostic warning, and the explicit override |
| [067-03](slice-03-alloy-hold-and-empty-purposes.md) | 4 | Alloy: empty `egressPurposes` holds and warns, and pending holds and flushes instead of dropping |
| [067-04](slice-04-default-endpoint-ceiling.md) | 7 | Default egress allowlist = the connector's stock destination set; sites narrow it |
| [067-05](slice-05-default-cookie-storage-grant.md) | 7 | Default cookie and storage grant = the stock set; name-scoping becomes an opt-in narrowing |
| [067-06](slice-06-limits-do-not-drop-stock.md) | 6 | Caps, queue and retention limits and the keepalive budget never drop or delay stock output by default |
| [067-07](slice-07-stock-context-channel.md) | 2 | The host-collected stock-context channel, separate from the projection snapshot |
| [067-08](slice-08-alloy-context-option.md) | 2, 3 | Alloy `context` defaults to the stock list and is fed by the channel |
| [067-09](slice-09-denylist-default-and-override.md) | 4b | The credentials denylist stays on by default, an explicit override exists, and a test pins both |
| [067-10](slice-10-seam-input-governance.md) | 3 | Input governance at the wrapped-SDK seam (ADR-0012's deferred second placement) |

## 4. Boundaries

### Boundary with 064-17

[064-17](https://github.com/ramboz/airlockjs/blob/vendor-adobe/docs/specs/064-adobe-parity-inventory/slice-17-b1-environment-storage.md) (B1, on `vendor-adobe`) reads: `context` defaults to the stock list and is fed by real host values; hard-coded shims are gone; replay seeds recorded cookies and storage; fixtures S1, S2 and S5 compare clean. It depends on this spec.

| Concern | Owner |
|---|---|
| The generic main-thread-to-chamber stock-context channel (collection API, message shape, transport, consent and governance treatment, no snapshot widening) | **067-07** |
| The configurable Alloy `context` option, defaulting to `[web, device, environment, placeContext]`, wired to the channel; removing the code default `context = []` | **067-08** |
| Which fields each Alloy context group yields, byte-for-byte against pinned Alloy 2.31.1 (`web`, `device`, `environment`, `placeContext`), the apex (`getTld`) probe, client hints, the RulesEngine globals, recorded before-state seeding and the S1, S2, S5 comparisons | **064-17** |

067-08 ships the option and a minimal collector that is good enough to prove the plumbing. 064-17 then makes each field match the corpus. 067-08 must not claim per-field fidelity, and 064-17 must not rebuild the channel.

### Meta opt-ins: approved forms and owner-registered roots

Spec 066 section 1.1 names spec 060's "approved forms" and owner-registered roots as opt-in restrictions, not defaults. This spec found no shared seal mechanism for either on `main` (section 2). So they stay with Meta: M7 (automatic matching) builds the opt-in on `vendor-meta-pixel`, and its default follows the pixel's served settings, as stock does. If M7 later needs a shared hook in the seal, it files a new slice here. 067 does not pre-build it.

### Input governance at the wrapped-SDK seam

Included as slice 067-10. ADR-0012 deferred this second placement, ADR-0062 point 3 names it a required follow-up, and the seam lives in `core/wrapped-sdk-host.js` on `main`. It is the same denylist as 067-09, applied to the SDK's own input before the chamber sees it, so it is shared work, not Adobe-only. With the context channel on by default (067-08), input governance is what keeps the credentials denylist honest for the wider default.

## 5. Consumers

Vendor slices that depend on each shared slice. Rows are read from the sister specs' slice lists (`git show origin/<branch>:<path>`).

| Shared slice | Adobe (`vendor-adobe`, spec 064) | Google (`vendor-google-ads`, spec 065 section 9) | Meta (`vendor-meta-pixel`, spec 066 section 9) |
|---|---|---|---|
| 067-01 docs | none (reading aid) | none | none |
| 067-11 measurement purpose | none (EDS RUM only) | none | none |
| 067-02 hold and warn | 064-18 onward | G3 | M4; D1 |
| 067-03 Alloy hold and empty purposes | 064-18 onward | none (Alloy only) | none (Alloy only) |
| 067-04 default endpoint ceiling | 064-18 (AC5), 064-19 onward | G12 | M9; D1 |
| 067-05 default cookie and storage grant | 064-17, 064-18 onward | G4 | D1 (M5 reads it through M4) |
| 067-06 limits | 064-18 onward | G12 | M9; D1 |
| 067-07 stock-context channel | 064-17 | none named today | none named today |
| 067-08 Alloy `context` | 064-17, 064-18 onward | none | none |
| 067-09 denylist default and override | 064-18 onward | G3, G12 | D1 |
| 067-10 seam input governance | 064-17, 064-18 onward | none (Alloy only) | none (Alloy only) |

The Meta "D1 (dependency, on main)" row in spec 066 section 9 is satisfied by 067-02, 067-04, 067-05, 067-06 and 067-09 together. D1 names the default egress allowlist, caps, queue and retention limits, the hold warning and the denylist. Meta M7 is listed against D1 in spec 066 and so reads 067-06 and 067-09 through it.

## 6. Definition of done for every slice

- `npm test && npm run lint` pass, and the servo quality-gate passes (`/servo:quality-gate`; `.servo/` exists on `main`).
- Known flake: `rig/chamber-capture.test.mjs` AC3 times out under load when several suites run at once. Rerun once quietly before treating it as a failure.
- Each slice that changes a default adds a test for the stock-default path and a separate test for the opt-in control, per ADR-0062 point 8 (the opt-in is its own tested state, not the baseline).
- Every parity-style comparison in a test supplies a consent state that matches the recording, so the hold never counts as a parity failure (ADR-0062 point 5).
- Commit to `main` with Conventional Commits.

## 7. Decisions for the owner

All four answered on 2026-11-13.

- **D1. Approve this spec and its slice order.** Approved.
- **D2. Shape of the consent-hold override.** Answered: a per-connector switch, not the recommended site-level option. Each track's wiring options take `consentHold: false`. It logs a one-time `warn` per connector. 067-02 and 067-03 follow this.
- **D3. Shape of the denylist override.** Answered: per-connector `payloadDenylistOverride`, either `false` (off) or an explicit array that replaces the defaults, with a one-time `warn`. It threads per track the way `payloadDenylist` does today (`adapters/eds/index.js`). 067-09 follows this.
- **D4. Governing purpose for connectors with empty purposes.** Answered:
  - Ad pixels are governed by `ad_storage`.
  - helix-rum gets a new privacy-safe measurement purpose, granted by default. RUM sends with no consent input, as stock EDS does. A site's consent input can still deny it explicitly.
  - A connector qualifies for that purpose only if it sets no cookies or storage, sends no user, device or click identifiers and no personal data, and a test checks its payload. Only helix-rum qualifies now. Adding any other connector needs owner approval.
  - It is recorded as dated amendment lines on ADR-0007 (the new purpose) and ADR-0062 (RUM sits outside the hold, matching stock EDS). New slice 067-11 does this and runs before 067-02, so 067-02 never holds helix-rum without the purpose in place.

## 8. Carried checks (listed, not blocking)

Each is a check a slice DoR runs, not an open decision.

1. **Hold ring cap.** ADR-0004 and architecture.md Q2 describe a capped ring that drops the oldest. `heldBeacons` has no cap on `main` (section 2). 067-02 must ground this first. It adds the cap if it is absent, because ADR-0062 point 6 keeps the oldest-dropped cap as part of exception (a). The cap value is a slice design choice, recorded in that slice.
2. **Alloy pending today.** The seam drops on pending, but Alloy's native `defaultConsent:"pending"` queue holds when a consent vector is wired (spec 045-02). ADR-0062 says Alloy "drops while pending" (from ADR-0023:71). 067-03 re-grounds which path actually drops, and fixes only the real gaps (no consent vector, empty `egressPurposes`, and the seam strict drop as a backstop).
3. **Capture ring.** The descriptor `ring` in `core/airlock.js` has no cap in the code read for this spec. 067-06 greps every cap, drop and budget before changing any, so it changes only what actually drops stock output today. The known drop is the unload keepalive budget (`core/egress.js:137`).
4. **Google and Meta stock-context.** Neither vendor lists a stock-context need today. If their capture sessions find the stock tag reads page values the chamber cannot see, they use channel 067-07 and file a slice.
5. **Stock destination lists and cookie sets.** The shared slices ship the mechanism and a test vendor list. The real lists arrive with 064, 065 and 066 inventory slices. Until then the vendor tracks on `main` keep their existing declared endpoints.
6. **Main-thread cost.** ADR-0062 assumes collection is O(1) on the interaction path and calls it unprobed (Assumptions). 067-07 must measure it and report INP and LCP impact, per the ADR's kill criterion.

7. **Storage grant is new.** No localStorage/sessionStorage grant exists in `core/`; 067-05 AC5 adds one. If 067-05 proves too large for one session, split the storage grant into its own slice.
8. **Tightening, not widening, for undeclared callers.** With no `grantedCookieNames` cookie scoping is off today, and with no `endpoints` there is no ceiling. 067-04/05 set vendor stock defaults for connectors that declare a vendor list; a migration test pins that callers declaring nothing keep today's behavior until a vendor list exists.
9. **Unload drops held events.** `criticalDispatchGated` drops on any non-send verdict at teardown (`core/airlock.js:303-315`). With the hold on by default, events held at unload are lost: the hold is per page and not persisted. 067-02 states this; persistence is out of scope.
10. **Browser keepalive limit.** The 64 KiB limit covers all in-flight keepalive requests together, so splitting at unload adds no capacity. 067-06 AC2 means "drops nothing stock would deliver under the same browser limit".
11. **Sister-spec drift (low).** 066 D1 says approved forms become site opt-ins (left to Meta M7 here). D1 does not name cookies. 066 section 1.1 ties limits to M12 as well as M9. Google G1 (needs the 067-02 recorded-consent helper) and G10 (transport) consume 067-02 and 067-06. 064-17 `dependencies` must gain 067-05, 067-07, 067-08 and 067-10 on vendor-adobe. Shim removal is owned by 064-17 (the pinned-bytes fidelity); 067-08 only changes the default `context`. The coordinator amends the sister specs when merging.

## 9. Review log

- 2026-11-13: owner answered D1 to D4. D2 and D3 become per-connector options, D4 adds slice 067-11. Spec and slices 02 to 11 are READY_FOR_IMPLEMENTATION.
- 2026-11-13: review round done, findings applied (section 10).
- 2026-11-13: drafted from ADR-0062, the three sister specs' consumer rows, and the code read in section 2. One fresh review round follows (section 10).

## 10. Review round and findings

One round, Opus 5.5 (`reviews/spec-review.md`): 2 high, 6 medium, 3 low. All fixed in this spec and the slices, or carried as checks 7-11 in section 8. No second round.
