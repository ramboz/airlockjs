---
status: DONE
dependencies: [026-04, adr-0020, adr-0022]
last_verified: 2026-09-11
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 038-04 — confirm Meta advanced-matching parity (retire the `ud[...]` 026-04 gap)

**Goal:** Now that [026-04](../026-generic-pixel-connector/slice-04-advanced-matching.md) ships Meta advanced
matching (airlock emits `ud[external_id]` + hashed `ud[em]`/`ph`/…), reconcile the Meta parity descriptor so the harness
**confirms `ud[external_id]` field-presence parity** — a real `maps` classification proven by the oracle against the
redacted real capture — instead of silently excusing it as an owned gap. Per [ADR-0020](../../decisions/adr-0020-parity-contract-anti-drift.md)
commitment 1, a gap is **removed** from `gapMap` when its owner artifact ships (never left as a `gap-closed` marker —
the 026-06 `cd[...]` precedent, `rig/parity/descriptors/meta.js:66-69`), so 026-04 shipping is exactly the event that
must flip `ud[external_id]` from *excused gap* to *confirmed presence*. This is the MVP7 release-check step that turns
"026-04 built" into "Meta advanced-matching **field-presence** parity confirmed" — with the same-identity-input
*efficacy* residual named, not hand-waved (AC7).

**What a `pass` here proves — and what it does NOT.** A `ud[...]` value is a per-user, identity-input-dependent SHA-256
and both committed fixtures carry a synthetic placeholder, so byte-equality is the *wrong* parity test for a hashed field
(`oracle.js:113` value-compares — correct for `id`/`ev`/`cd[...]`, meaningless for `ud[...]`). This slice confirms
**presence**: airlock attaches a well-formed `ud[external_id]` where the container does. It deliberately does **not**
prove airlock hashed the *same* `external_id` the container did (same input → same hash → Meta actually matches the
user) — that **same-input efficacy** is an MVP9 wiring/adoption property, owned outside this harness (AC7 / `## Assumptions`
A4). Hash *correctness* (well-formed SHA-256 of airlock's own input) is 026-04's witness concern; **AC2** re-checks it
here so presence-parity can't be satisfied by a malformed value.

**Two fixtures — do not conflate them (frame-critique correction).** The confirmation runs against the **real-capture**
fixture `test/fixtures/meta-tr-pageview.redacted.json` — a `beacons[]`-array PageView whose `ud[external_id]` is the
literal string `"REDACTED_SHA256"` (**not** `redact.js:35`'s 64-zero `SYNTHETIC_HASH`). The **synthetic** fixture
`test/fixtures/parity-meta-tr.redacted.json` (038-01, flat field map, `ud[em]`/`ph` = `SYNTHETIC_HASH`) stays the
`id`/`_fbp`/`fbc` **raw-diff regression guard** (AC4). Because the two placeholders differ, `ud[external_id]` classifies
`maps` **only when both beacons pass through `redactMetaBeacon` at diff-time** — its `/^ud\[/` rule maps the container's
`"REDACTED_SHA256"` *and* airlock's real hash to the shared `SYNTHETIC_HASH`, so the existing value-equality path sees
equal sentinels (AC1). Redacting only airlock's side would diverge (`SYNTHETIC_HASH` vs `"REDACTED_SHA256"`) → `fail`.

**Scope guard.** `_fbp`/`fbc` are **untouched** — owned by the chamber cookie-capability follow-up (`meta.js:71-72`), a
different artifact from 026-04. The `fr` cross-site cookie stays E10's (transport, invisible to the beacon oracle). No
change to `oracle.js`'s public shape (`## Assumptions` A2 — the rejected oracle-field-class alternative).

**DoR:**
- ✅ 026-04 is DONE — `createMetaPixelConfig({externalId})` emits `advancedMatching:{external_id}` only when supplied
  (`connectors/pixel/vendors/meta.js`); `createPixelConnector(config).handle(evt)` projects it onto `ud[external_id]` on
  the GET `/tr` beacon. The default (no `externalId`) is byte-identical to pre-026-04 — so the confirmation run replays
  with an `externalId`-bearing config (the capture carries `ud[external_id]`; reaching presence parity against it
  requires airlock to be given *an* identity input).
- ✅ Two fixtures, distinct roles (see above): `meta-tr-pageview.redacted.json` (real capture, `beacons[]` array,
  `ud[external_id]="REDACTED_SHA256"`, PageView, `cd[region]=us`, `fbp` **without** underscore) is the confirmation
  input; `parity-meta-tr.redacted.json` (synthetic, flat, `ud[em]`/`ph`) is the `id`/`_fbp`/`fbc` regression guard. The
  real capture carries **no `ud[em]`/`ud[ph]`** (anonymous visit — see AC3 + A3), and its variant namespaces
  `aud`/`cud`/`ncud[external_id]` (AC4).
- ✅ `redactMetaBeacon` (`rig/parity/redact.js:60`) maps **any** `ud[...]` field → `SYNTHETIC_HASH`, **and also**
  rewrites `id`→`SYNTHETIC_META_PIXEL_ID`, `_fbp`→`SYNTHETIC_FBP`, `fbc`→`SYNTHETIC_FBC`, and scrubs `dl`/`dr` (its full
  blast radius — A2). `replayPixelBeacon` (`rig/parity/replay.js:41`) returns airlock's **raw** field-set (not redacted).
- ✅ ADR-0020 (accepted) commitment 1 + kill-criterion #1 ("field presence is too coarse … present/equal yet value
  semantics diverge", `adr-0020:117-120`) — the rules this slice applies (retire the gap; name the efficacy residual).

**Acceptance Criteria:**

1. **`ud[external_id]` confirmed `maps` via redact-both-sides at diff-time.** `ud[external_id]` is added to the Meta
   descriptor's `attributionFields`. The confirmation path passes **both** the container beacon (extracted from the real
   capture's `beacons[]`) **and** airlock's replayed beacon through `redactMetaBeacon` before `diffParity`, so both
   `ud[external_id]` values become `SYNTHETIC_HASH` and the field classifies **`maps`** (present both sides,
   sentinel-equal) — not `dropped`, not `divergent`. `ud[external_id]` is **not** added to `gapMap` (confirmed, not owned).
2. **Well-formedness guard (redaction cannot mask a bad hash).** Because `redactMetaBeacon` sentinelizes any `ud[...]`
   value regardless of shape, the confirmation additionally asserts airlock's **raw** (pre-redaction) `ud[external_id]`
   is a well-formed SHA-256 (64 lowercase hex). This preserves identity *well-formedness* while redaction normalizes
   identity *noise* — without it, presence parity (AC1) could be satisfied by a malformed or empty value.
3. **`ud[em]`/`ud[ph]` re-owned, never falsely mapped.** The `gapMap` entries for `ud[em]`/`ud[ph]` are re-owned from
   `"026-04"` to a capture-gated owner (the signed-in `ud[em]`/`ph` live-capture follow-up): 026-04 shipped the
   *capability* to emit them, but presence confirmation needs a signed-in capture that carries them, which is
   un-obtainable in-repo (`## Assumptions` A3). They remain owned `gapMap` members (green `expected-dropped` when the
   capture omits them); the false-shim prohibition (ADR-0020) forbids marking them `maps` with no capture to confirm
   against. A descriptor comment + a first-class `docs/refinement-todo.md` entry record the rationale.
4. **`_fbp`/`fbc` unchanged; variants + the `fbp` wire-name resolved.** The `_fbp`/`fbc` `gapMap` entries (owner: chamber
   cookie-capability follow-up) are byte-unchanged, regression-guarded against the **synthetic** fixture (which uses
   `_fbp`). The `aud`/`cud`/`ncud[external_id]` variant namespaces (alternate Meta hash encodings of the *same*
   external-id identity, which airlock does not emit) are **deliberately excluded** from `attributionFields` with a
   descriptor comment stating why. **Wire-name check (frame-critique note):** the real capture's first-party cookie param
   is `fbp` (no underscore) while the descriptor keys on `_fbp` — confirm Meta's real `/tr` query-param spelling and
   either reconcile the descriptor key or explicitly scope the `_fbp`/`fbc` guard to the synthetic fixture, so AC4's
   regression claim is not silently vacuous against the real capture.
5. **End-to-end witness (positive + negative), against the real `beacons[]` capture.** A test extracts the container
   beacon from `meta-tr-pageview.redacted.json`'s `beacons[]`, replays airlock's Meta beacon with an `externalId`-bearing
   config, redacts both sides, and asserts `diffParity` → **`pass`** with `ud[external_id]` in `maps` and **no**
   advanced-matching field in `dropped`. A **negative** witness proves the guard is not vacuous: a config emitting **no**
   `external_id` while the capture carries one yields `ud[external_id]` → **`dropped`** → `fail`.
6. **Report reflects the confirmed classification.** `buildParityReport` (`rig/parity/report.js`) renders
   `ud[external_id]` as confirmed presence (`maps`), `ud[em]`/`ph` + `_fbp`/`fbc` as owned gaps with their (updated)
   owners; the verdict / `verdictExitCode` contract is preserved, and no `gap-closed`-flagged field is left dangling.
7. **Name the same-input efficacy residual (ADR-0020 kill-criterion #1).** The slice records — in the report notes / a
   first-class `docs/refinement-todo.md` entry — that harness confirmation is **field-presence**, and that
   *same-`external_id`-input efficacy* (airlock's `external_id` source resolving to the identifier the container hashed →
   Meta actually matches the user) is an **MVP9 real-site rewire / adoption** property, owned there, **not** confirmed by
   this harness. Mirrors ADR-0020's GA4 session-continuity report-note-residual precedent (`adr-0020:135-143`).

**DoD:**
- All ACs met; `npx vitest run test/parity-meta.test.js test/parity-oracle.test.js` green, plus the new witness file.
- `rig/parity/descriptors/meta.js` reconciled (026-04 owner retired for `ud[external_id]`; `ud[em]`/`ph` re-owned;
  `_fbp`/`fbc` intact; variants + `fbp` wire-name commented) with grounding comments; the redact-both-sides normalization
  is wired in the confirmation path (test or a small harness helper), not hand-waved.
- `docs/refinement-todo.md` carries first-class entries for (a) the signed-in `ud[em]`/`ph` capture follow-up and (b) the
  same-input efficacy residual (AC7); the MVP7 release-check records "field-presence parity confirmed", not unqualified.
- Review passes recorded (compliance + craft + arch, since `arch_review: true`); reconciliation walked.

**Out of scope (explicit):**
- Confirming `ud[em]`/`ph` parity (capture-gated — AC3 re-owns, does not confirm).
- Confirming same-input *efficacy* (AC7 names it as an MVP9 residual — this harness proves presence only).
- Any `oracle.js` field-class addition (`## Assumptions` A2 — rejected in favour of reusing `redactMetaBeacon`).
- Emitting the `aud`/`cud`/`ncud` variant namespaces from airlock (not distinct attribution — AC4 excludes them).
- The `_fbp`/`fbc` first-party cookie path (chamber cookie-capability follow-up) and `fr` cross-site transport (E10).

## Assumptions

**A1 (load-bearing — the methodology claim). A hashed `ud[...]` value is not a parity property; presence is.** Parity for
a hashed identity field is "airlock attaches `ud[external_id]` where the container does," because the value is an
identity-input-dependent, per-user SHA-256 and **both** committed fixtures carry a synthetic placeholder — so there is no
meaningful byte-value to match, by construction. *Grounded:* `oracle.js:111-129` value-compares with `String(a)===String(b)`;
the real capture's `ud[external_id]` is the literal `"REDACTED_SHA256"` (`meta-tr-pageview.redacted.json`) and the
synthetic fixture's `ud[em]`/`ph` are `redact.js:35`'s 64-zero `SYNTHETIC_HASH` — **two different placeholders**, which is
exactly why AC1's `maps` classification depends on re-redacting **both** beacons through `redactMetaBeacon` at diff-time
(its `/^ud\[/` rule collapses either placeholder + airlock's real hash to the one sentinel). *Risk if wrong:* if a
reviewer holds that value-equality *is* required for a `ud[...]` parity claim, a hashed field can never be confirmed by
this oracle and AC1/AC5 reduce to AC3's re-own.

**A2 (design choice with a rejected alternative). Redacting airlock's own replay output through `redactMetaBeacon`
before the diff is a legitimate oracle-input normalization, not a false shim.** *Blast radius (grounded, `redact.js:64-68`):*
`redactMetaBeacon` rewrites not only `ud[...]`→`SYNTHETIC_HASH` but also `id`→`SYNTHETIC_META_PIXEL_ID`,
`_fbp`→`SYNTHETIC_FBP`, `fbc`→`SYNTHETIC_FBC`, and scrubs `dl`/`dr` — so redacting both sides makes the value-comparison
of `id` (an `attributionField`) *vacuous* too. This is defensible: `id`/`_fbp`/`fbc` are themselves redacted identity
fields whose values can't be byte-matched against any committed fixture, and their **presence / `dropped`** guard
survives redaction. The `id`/`_fbp`/`fbc` **value** regression guard is retained via the **raw-diff** path against the
synthetic `parity-meta-tr.redacted.json` (AC4), which is not double-redacted. *Rejected alternative:* add an
`opaque`/`presence` field-class to `oracle.js` — "purer" but changes the oracle's public descriptor contract for one
field-shape; redact-both-sides reuses the primitive that already exists for identity normalization. *Risk if wrong:* if
redact-both-sides is judged to erode ADR-0020's anti-false-shim invariant, fall back to the field-class — the ACs move
onto `oracle.js` and `arch_review` becomes load-bearing there.

**A3 (scoping fact). The signed-in `ud[em]`/`ph` capture is un-obtainable in-repo.** The intuit-class parity reference
page (`stage.erp.intuit.com`) is an anonymous visit carrying no PII, and captures are local-only (R5 / ADR-0020) — so no
committed fixture can carry `ud[em]`/`ph`. AC3 re-owns them to a capture-gated follow-up rather than confirming them —
a real scope boundary, not a dodge. *Grounded:* the 026-04 reconciliation already logged `em`/`ph` as Meta-doc-grounded
pending a signed-in capture.

**A4 (the claim boundary — presence ≠ efficacy). Confirming presence does not confirm same-input efficacy.** Airlock
emitting a well-formed `ud[external_id]` (AC1+AC2) does not establish that airlock's `external_id` source resolves to the
*same* identifier the container hashed — the property that makes advanced matching actually match a user. That is an
MVP9 real-site rewire/adoption concern (does the adopter wire airlock's identity source to the container's?), owned
there, and is precisely ADR-0020 kill-criterion #1's "present/equal yet value semantics diverge." AC7 names it as a
report-note residual (the GA4 session-continuity precedent, `adr-0020:135-143`) so the MVP7 release-check does not
overclaim. *Risk if ignored:* an unqualified "advanced-matching parity confirmed" gates v0.7.0 on a coarser property
than it states.

### Deviation log (after reconciliation)

1. **Advanced-matching replay is a local test helper, not a `replay.js` export.** `handle()` is identity-free by
   construction (026-01 AC1), so `replayPixelBeacon` never emits `ud[...]`. The confirmation uses a local
   `replayWithAdvancedMatching()` in the test file that reuses production's **pure** `hashField` + `mergeAdvancedMatching`
   (`connectors/pixel/advanced-matching.js`) — verified faithful to `core/airlock.js:208` (config strip), the worker
   `ingestIdentity` skip-undefined loop, and `core/airlock.js:247` (merge). Chosen over adding a Meta-specific branch to
   the vendor-generic `replay.js` (DoD's "test **or** a small harness helper" → test). It confirms the merge **output** +
   field parity; the real orchestration (requestMapper / `identityCache` / worker) stays guarded by 026-04's e2e
   (`test/pixel-advanced-matching-e2e.test.js`), so an orchestration drift surfaces there (red), not silently here.
2. **AC4 `_fbp`/`fbp` wire-name — scoped, not reconciled.** The descriptor keys on `_fbp` (cookie name) but the real `/tr`
   wire param is `fbp` (no underscore). Took AC4's "scope + name" branch: the `_fbp`/`fbc` raw-diff regression guard runs
   against the **synthetic** fixture (`test/parity-meta.test.js`); against the real capture `_fbp` is skipped ("never
   sent"), so that owned gap is under-reported there. A pre-existing **038-01** descriptor-modeling gap — named in the
   descriptor comment + a refinement-todo follow-up, deliberately **not** fixed in this slice.
3. **AC7 efficacy residual via refinement-todo, not the report `SCOPE_NOTE`.** AC7's either/or is satisfied by the
   first-class refinement-todo entry; `report.js`'s `SCOPE_NOTE` is shared across all vendors, so widening it for a
   Meta-only presence-weakening was left as a follow-up (arch nit → "report-note coherence", logged in refinement-todo).
4. **Craft-nit hardening applied here:** the AC5(b) negative witness now also asserts the base beacon (`ev=PageView`)
   still emits, isolating "`ud[external_id]` specifically dropped" from "airlock emitted nothing at all" (still 11/11).

### Reconciliation sweep

- **`rig/parity/descriptors/meta.js`** — `updated`: `ud[external_id]` added to `attributionFields` (not `gapMap`);
  `ud[em]`/`ph` gap re-owned "026-04" → "signed-in ud[em]/ph live-capture follow-up"; `_fbp`/`fbc` byte-unchanged;
  `aud`/`cud`/`ncud` exclusion + `fbp`/`_fbp` wire-name comments added.
- **`rig/parity/oracle.js` / `redact.js` / `replay.js` / `report.js`** — `no-op`: public shapes unchanged (A2's leaner
  path — redact-both-sides reuses `redactMetaBeacon` as-is; no oracle field-class added).
- **`docs/refinement-todo.md`** — `updated`: AC3 signed-in `em`/`ph` cross-ref (Landed 2026-09-11) + AC7 same-input
  efficacy residual; plus (this reconciliation) the report-note-coherence follow-up, the ADR-0020 kill-criterion-#1
  accumulation signal, and the `_fbp`/`fbp` wire-name residual (AC4) — five 038-related entries total.
- **`docs/releases/mvp7.md`** (release-check) — `updated` (prior session, verified consistent): reads "Meta
  advanced-matching `ud[external_id]` field-presence parity via 038-04" with the `em`/`ph`-capture + efficacy residuals
  named — satisfies the DoD close-out wording.
- **`docs/architecture.md`** — `no-op`: no module-boundary or public-contract change (descriptor is data; no `oracle.js`
  change), so no architecture update and no ADR warranted for the slice itself.
- **Existing witnesses + full suite** — `no-op` (behavior-preserving): `test/parity-{meta,oracle,ga4,transport}.test.js`
  66/66 unchanged; full suite **1538** green; lint clean.
- **ADR-0020 kill-criterion #1 accumulation** — `deferred`: two "present/equal yet value-semantics diverge" residuals now
  exist (GA4 session-continuity `adr-0020:135-143` + this slice's Meta `ud[external_id]` efficacy). 038-04 follows the
  established report-note precedent faithfully; whether the accumulation crosses ADR-0020's amendment threshold is an
  **owner call**, logged as a refinement-todo signal (not blocking).

### Close-out (post-DONE)

- [ ] Spec 038 rolls back to DONE once 038-04 is DONE (slices 01–04 complete); regenerate the board.
- [ ] Primer hygiene: 038 has no active-spec primer entry (spec-close compress is a no-op) — confirm at close.
- [ ] MVP7 release-check: record `ud[external_id]` advanced-matching **field-presence** parity as confirmed (this slice);
      the signed-in `ud[em]`/`ph` capture and the same-input efficacy residual (AC7) remain the named, non-blocking
      residuals.
