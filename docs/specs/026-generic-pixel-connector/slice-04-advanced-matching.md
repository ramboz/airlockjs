---
status: DONE
dependencies: [042-02, adr-0022]
last_verified: 2026-09-11
frame_review: false  # the design's load-bearing assumptions (A1–A5 + the eager-hash
                     # race) were frame-critiqued at ADR-0022 (Accepted; verdict
                     # recorded), the correct home for them — no redundant slice pass.
                     # The implementation-level design gate is arch_review below.
arch_review: true    # adds a worker→main `identity` message + a main-side hash
                     # cache + a merge into the 042 unload requestMapper — a
                     # protocol + module-boundary change.
---

<!-- jig grounding (ADR-0020): grounded by the real capture
     test/fixtures/meta-tr-pageview.redacted.json + Meta's Customer Information
     Parameters docs (per-field normalization + SHA-256); the hashing-location
     decision is ADR-0022. -->

## Slice 026-04 — Meta advanced matching (worker-hashed, eager, unload-cached)

**Goal:** Emit Meta Pixel advanced matching — the full documented `ud[…]` field set
(`external_id` + the hashed PII fields `em`/`ph`/`fn`/`ln`/`db`/`ge`/`ct`/`st`/`zp`/
`country`) — on both the steady-state and the spec-042 unload beacon, with each
value **normalized per Meta's spec + SHA-256-hashed in the worker chamber**, hashed
**eagerly** (as early as its raw value exists — `external_id` at boot, PII fields
when the host sets them), posted back, and cached main-side so the synchronous
unload path merges `ud[…]` into the closing beacon
([ADR-0022](../../decisions/adr-0022-pixel-advanced-matching-hashing.md)).
`external_id` is capture-grounded (`test/fixtures/meta-tr-pageview.redacted.json`);
the PII fields are **doc-grounded** (Meta's normalization table — the authoritative
source a one-way hash can't provide), the same `ud[<key>]` wire form.

**DoR:**
- ✅ Grounded (`external_id`, capture): `test/fixtures/meta-tr-pageview.redacted.json`
  shows `ud[external_id]=<64-hex>` on a **GET** `/tr` (no POST even with advanced
  matching), stable across 3 beacons (session-stable, ADR-0022 A3).
- ✅ Grounded (PII fields, docs): Meta's [Customer Information Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
  give the per-field normalization + SHA-256→hex — `em` trim+lowercase; `ph` digits
  + country code, strip leading zeros; `fn`/`ln` lowercase no-punctuation; `db`
  YYYYMMDD; `ge` f/m; `ct` lowercase no-space; `st` 2-char lowercase; `zp` first-5
  lowercase; `country` ISO-3166-1-alpha-2 lowercase; `external_id` no normalization,
  hash optional-but-recommended (the capture hashes it → airlock hashes it). The one
  residual: no *real* `ud[em]`/`ud[ph]` beacon captured (anonymous visit) — the PII
  wire form is doc-grounded-by-analogy to `external_id` (ADR-0022 open question).
- ✅ Grounded: 042 wires the pixel unload `requestMapper` on the main thread,
  synchronously (`core/airlock.js`, commit `be2f4f5`) — the constraint ADR-0022
  resolves.
- ✅ Grounded: the pixel worker is egress-confined (`withholdFetch`, spec 026-01)
  — raw identity in the chamber cannot reach the network directly.
- ✅ Grounded at implementation (confirmed — deviation log §§1–5 + Wiring summary): the eager hash trigger (`init` for `external_id`;
  a host `setIdentity`-style path for PII fields set later); the worker→main
  `identity` message wiring in `core/pixel-chamber.worker.js` +
  `core/connector-host.js`; where raw identity is sourced (`adapters/eds/index.js`
  `bootMetaPixel` — `external_id` from a first-party cookie/GUID like GA4's `_ga`;
  PII from a host-provided form/profile source); the per-field cache shape on
  `core/airlock.js`; the unload `requestMapper` per-field merge.
- ✅ Frame-critique passed at the ADR level ([ADR-0022 frame-critique](../../decisions/reviews/adr-0022-frame-critique.md), verdict `pass` — attacked A1–A5 + the eager-hash race; two findings folded into ADR-0022 + this slice: the `em`/`ph` identification-time race is the exposed profile (AC4), and the raw-identity feed rides a dedicated channel not `push()` (AC2)).

**Acceptance Criteria:**

1. **The worker normalizes (per Meta's spec) + SHA-256-hashes each declared
   advanced-matching field → `ud[<field>]=<hex>`.** The Meta config declares the
   advanced-matching field set; for each host-supplied raw value the connector (in
   the worker) applies Meta's per-field normalization (the DoR table) then
   `crypto.subtle.digest("SHA-256", …)` → lowercase hex, and emits
   `ud[<field>]=<hex>` on its `/tr` GET. `external_id` is emitted for the
   capture-grounded case; the PII fields (`em`/`ph`/…) are emitted when the host
   supplies them (synthetic values in tests). The raw value never leaves the worker
   except as the hash. Tests assert (a) the emitted value is 64-hex =
   `SHA-256(normalize(raw))` for representative fields (`external_id`; `em`;
   `ph`), and (b) a **normalization witness** — e.g. `em = " User@Example.COM "` →
   the trim+lowercase hash, and `ph = "(415) 555-0100"` → the digits+country-code
   hash — so the normalization is proven, not just the digest.
2. **Raw identity feeds the worker on a DEDICATED channel; the worker posts the
   hashes back; main caches them per field.** Raw identity reaches the worker via
   the `init` message (`external_id`) or a `setIdentity`-style message (PII set
   later) — **not** via `push()`/events, so a host `payloadDenylist` never strips it
   before hashing (ADR-0022; safe because the worker is egress-confined, A5).
   Alongside `{ready, dropped}`, the pixel chamber posts `{ type: "identity", ud: {
   <field>: <hex>, … } }` as each field's hash resolves; `core/airlock.js` caches
   them per field. Tests assert (a) raw PII fed via the identity channel is hashed
   **even when a `payloadDenylist` covers `email`/`phone`** (it bypasses input
   governance by design — the value only egresses hashed), and (b) the cache is
   populated after the round-trip.
3. **The 042 unload beacon carries `ud[external_id]` from the cache, read
   synchronously.** The pixel unload `requestMapper` (042) reads the cached hash
   and merges `ud[external_id]=<hex>` into the closing `/tr` GET — no `await`. A
   test drives a real `visibilitychange`→hidden after the cache is warm and
   asserts the flushed GET carries `ud[external_id]=<hex>`.
4. **Eager hashing; degrade to omit only if still missing (ADR-0022, owner
   decision 2026-09-11).** Each field is hashed **eagerly** — `external_id` on the
   `init` message, PII fields the moment the host sets them — so the cache is warm
   before a normal teardown. A test asserts the identity cache is populated
   eagerly (after `init`/`setIdentity`, WITHOUT a steady-state `push()`). **If a
   teardown still races an incomplete hash,** the unload beacon omits THAT
   `ud[…]` field (per-field) and never the raw value: a test forces a
   pre-resolution teardown and asserts the GET carries no `ud[…]` for the in-flight
   field and no raw id anywhere in the URL, while any already-warm field still
   ships. (The cache holds only hashes and the raw never crosses back, so "omit" is
   the only reachable miss behaviour.) **The teardown-race test MUST exercise the
   identification-then-immediate-navigate PII profile** (`em`/`ph` set, then teardown
   before the eager hash resolves) — not only boot-time `external_id` — per ADR-0022
   kill-criterion #2 (identification-time PII is the exposed window, not boot-time id).
5. **GET-only; `cd[...]` unaffected.** No POST path is added (the capture is GET).
   Custom-data `cd[...]` (026-06) is untouched and still mapped per-event,
   plaintext, synchronously.
6. **Consent-gated.** `ud[external_id]` egress is gated by the pixel's declared
   egress purpose (`ad_storage`, ADR-0007) exactly like the rest of the beacon —
   a denied/strict-denied purpose drops the beacon (identity included), on both
   the steady-state seal and the unload path (017-03 AC4). A test witnesses it.
7. **No live identifiers** — synthetic raw `external_id` + synthetic PII values
   only; assert the fixture's real redacted `external_id` hash is never reproduced.

**In scope (owner decision 2026-09-11) — the full `ud[…]` field set:** `external_id`
(capture-grounded) + `em`/`ph`/`fn`/`ln`/`db`/`ge`/`ct`/`st`/`zp`/`country`
(doc-grounded, ADR-0022). The connector normalizes + hashes whichever the host
supplies; tests exercise `external_id` + a representative PII subset (`em`/`ph`)
with synthetic values.

**Explicitly deferred (named, not built):**
- **POST `/tr`** — not observed (GET only at this payload size); a documented
  future edge for oversized payloads (many `ud[…]` fields could exceed the URL cap).
- **`_fbp`/`fbc` cookie identity** — a do-not-hash cookie-capability follow-up,
  separate from advanced matching.
- **A real `ud[em]`/`ud[ph]` capture** — the PII fields' end-to-end wire presence is
  doc-grounded-by-analogy (ADR-0022 residual); a live signed-in capture would
  confirm it but is not a blocker.

**DoD:**
- [x] All ACs pass; full suite green. GA4/RUM/alloy/gtag + the 042 POST/GET unload
      paths byte-unchanged; pixel steady-state (non-AM) unchanged when no
      advanced-matching fields are configured (back-compat); 026-06 `cd[...]` untouched.
- [x] Coverage exercises each AC incl. the cold-cache degradation + the consent gate.
- [x] Each new test shown to red when its feature is removed.
- [x] Reviewed by `reviewer` subagent (compliance + craft).
- [x] Frame-critique passed at ADR-0022 (Accepted; `reviews/adr-0022-frame-critique.md`, pass; 2 findings folded).
- [x] Arch pass (`arch_review: true`) — the worker→main protocol + cache + unload merge.
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced.
- [x] Reconciliation review passed.
- [x] ADR-0022 accepted (frame-critique recorded) before/with this slice's REVIEWED.
- [x] `docs/refinement-todo.md` 026-04 placeholder + `docs/inbox.md` swept.

### Close-out (post-DONE)

- [x] `docs/specs/README.md` regenerated.
- [x] Primer hygiene: if 026-06 is also DONE, spec 026 closes — compress its entry.

**Anti-horizontal-phasing check:** after this slice a real Meta Pixel beacon from
airlock carries hashed advanced matching (`ud[external_id]` + any host-supplied
`ud[em]`/`ud[ph]`/…) for match quality — including the closing unload beacon — the
first vendor proven at *identity* parity (mvp7.md's "first real vendor proven at
parity"), where before airlock's pixel was identity-free.

### Deviation log (after reconciliation)

Implementation notes + deviations from the DoR/design (ACs unchanged):

1. **No `node:crypto` fallback added (DoR check resolved).** The DoR asked for a
   Node crypto fallback "if `crypto.subtle` is unavailable in the test realm
   (check vitest's realm first)." Checked: the vitest realm is Node 22, which
   exposes `globalThis.crypto.subtle.digest` — so the fallback is NOT needed. It
   was also deliberately NOT added because a `node:crypto` import would break
   `build.mjs`'s `platform:"browser"` bundle (and its no-`blob:`/`data:` scan).
   `connectors/pixel/advanced-matching.js` uses WebCrypto `globalThis.crypto.subtle`
   in every realm (window/worker/Node) and throws a hard, actionable error if it
   is ever absent — never a silent un-hashed egress.

2. **`external_id` sourcing is READ-ONLY (no auto-mint).** ADR-0022/DoR say
   "source `external_id` … like GA4's `_ga`." GA4's `sourceGa4Ctx` mints+persists
   when absent; `bootMetaPixel` deliberately does NOT — it takes an explicit
   `externalId`, or reads a configured first-party cookie name (`externalIdCookie`)
   synchronously, and yields no advanced matching when absent. Rationale: (a)
   privacy-forward — never mint an advertising identifier by default; (b)
   determinism — `test/eds-boot-config-equivalence.test.js` compares the
   `createAirlock` inputs of `bootMetaPixel` vs. the config-driven path, and a
   random mint would diverge them. Auto-mint/persist is a named follow-up.

3. **Declaration surface.** `createMetaPixelConfig({ externalId })` emits a
   top-level `advancedMatching: { external_id }` (present only when supplied — a
   default config is byte-identical, no key); `PIXEL_VENDORS.meta.advancedMatching:
   true` gates sourcing + the `setIdentity` handle method to Meta (linkedin/bing
   byte-unchanged). The connector's `handle` never reads `advancedMatching`
   (026-01 AC1): the chamber strips it before `createConnectorHost`, and
   `core/airlock.js` strips it before building the unload connector — so raw boot
   identity never reaches the connector, only the worker's eager hasher.

4. **`setIdentity` is on the CORE airlock handle unconditionally** (a non-pixel
   chamber simply ignores `{type:"identity"}`, so it is a harmless no-op there);
   the EDS pixel handle exposes it only for advanced-matching vendors. The
   `boot(config)` composite surface (037-01 1.0 API pin) is untouched.

5. **`st` (state) is not truncated to 2 chars** — the host supplies the 2-char
   ANSI code (lowercased, punctuation-stripped); truncating a full name would
   corrupt a non-prefix code (e.g. `Texas` → `te`). Minor reading of the DoR's
   "st 2-char lowercase"; `st` is doc-grounded, not an AC-witnessed field.

Wiring summary (identity channel → cache → merge):
- IN  raw `external_id` rides `{type:"init", …, advancedMatching:{external_id}}`;
  raw PII rides `{type:"identity", raw:{em,ph,…}}` (handle `setIdentity`) — NEVER
  `push()`/events, so `governParams`/`payloadDenylist` never strip it pre-hash.
- Worker EAGERLY normalizes+SHA-256s each field → worker-side `identityHashes`
  map + posts `{type:"identity", ud:{field:hex}}` back. Raw never leaves the worker.
- Steady-state: the chamber merges `identityHashes` onto `ready` via
  `mergeAdvancedMatching` before posting. Unload: `core/airlock.js` caches the
  posted `ud` per-field and the 042 pixel `requestMapper` merges the cache into
  the closing GET SYNCHRONOUSLY (no await). Per-field omit for a still-cold field;
  the cache holds only hashes, so "omit" is the only reachable miss.

Not done here (reconciliation-phase, gated after review — left for the
Reconciliation sweep, not this implementation pass): `docs/architecture.md` (the
new worker→main `identity` protocol seam + main-side hash cache) and
`docs/refinement-todo.md` (026-04 placeholder → resolved for `external_id`; `em`/
`ph` end-to-end capture still doc-grounded).

**Reconciliation-phase additions (orchestrator, 2026-09-11):**
- **All four review passes PASS, no blockers** — frame-critique at the ADR level (`docs/decisions/reviews/adr-0022-frame-critique.md`) + `reviews/slice-04-{compliance,craft,arch}.md`. Compliance verified the 4 security properties end-to-end; craft called it "high-craft, security-forward" (the real-round-trip e2e witness the strongest raw-never-egresses proof); arch endorsed degrade-to-omit as a **structural invariant** (hash-only cache/map), the shared crypto-free merge, and the identity-agnostic-handle/stripped-unload-connector defense-in-depth.
- **Folded nits (code/test):** (compliance) the `st` comment `Texas → "tx"` corrected to `"te"`; (craft) the brittle `.not.toContain("415")` phone guard removed from the chamber + e2e tests (the robust full-number `4155550100` + email assertions carry the raw-absence weight); (craft) the near-vacuous "invents nothing" test made a real discriminator (asserts an un-fed field never appears). Full suite re-run green after the fixes.
- **Contract doc-sync (craft + arch):** `setIdentity(raw)` added to `contracts/push-api.md`'s write surface (a **pixel-only additive** verb feeding raw identity to the chamber on the dedicated channel — bypasses `push()`/`payloadDenylist` by design; only the hash egresses), and pinned in `test/contract-stability.test.js` as an intentional **additive** method. **Frozen-surface decision:** ADR-0017 froze the stable-core handle against *breaking* changes; `setIdentity` is additive + non-breaking (a no-op on non-pixel handles), so it needs no superseding ADR — pinning it in `contract-stability` makes the additive-ness explicit rather than silent drift.
- **architecture.md updated** (arch's one before-DONE artifact): the pixel worker↔main protocol now documents the `{type:"identity"}` message (both directions, hashes-out / raw-in-on-a-dedicated-channel), the main-side hash cache, the `setIdentity` verb, and the 042 unload merge.
- **refinement-todo:** the 026-04 placeholder resolved (`external_id` shipped, capture-grounded; `em`/`ph`/… shipped, doc-grounded — a live signed-in `ud[em]` capture is a named follow-up, not a blocker); a NEW deferral recorded — **mid-session identity invalidation (logout/clear)** (compliance + arch): `setIdentity` only adds/overwrites, so a once-hashed field persists for the SPA page lifetime; ADR-0022 names cache-invalidation as future work and only the overwrite-refresh half is built. Resolution trigger: a real SPA logout-without-navigation flow.
- **Deferred (optional, near-unreachable):** the craft observability nit — the worker's `.catch(() => {})` swallows the deliberately-loud "WebCrypto unavailable" throw, so in a no-WebCrypto realm hashing would silently no-op. Near-unreachable (HTTPS worker / Node 18+ both expose `crypto.subtle`) and the chamber has no log channel by design (ADR-0001); a value-free `{type:"identity-error", field}` diagnostic is a possible future add, not built (avoids new protocol surface for an unreachable path).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entrypoint change (the host write surface change is in `contracts/push-api.md`, below). |
| `docs/specs/README.md` | `deferred (close-out)` | Board regenerated by `workflow.py status-board` at the post-DONE close-out step; currently stale (a regen would show 026-04 REVIEWED). |
| `docs/architecture.md` | `updated` | The pixel worker↔main protocol now documents the `{type:"identity"}` message (hashes-out / raw-in on a dedicated channel), the main-side hash cache, the additive `setIdentity` verb, and the 042 unload merge — a real protocol/boundary seam (arch pass's before-DONE artifact). |
| `contracts/push-api.md` | `updated` | `setIdentity(raw)` added to "The write surface" (craft doc-sync) — a pixel-only additive verb; only the hash egresses. |
| `test/contract-stability.test.js` | `updated` | `setIdentity` pinned as an intentional **additive** method on the ADR-0017 frozen handle (arch open question) — additive/non-breaking, so no superseding ADR; the pin makes the additive-ness explicit. |
| `docs/decisions/*` / ADR index | `updated` | ADR-0022 authored + frame-critiqued + **Accepted** (2026-09-11); index regenerated. |
| `docs/inbox.md` | `no-op` | No new parked idea; the AM gap is now a spec/ADR, not an inbox item. |
| `docs/refinement-todo.md` | `updated` | NEW deferral added: mid-session identity invalidation (logout/clear) — only overwrite-refresh built (ADR-0022 § Consequences). No prior 026-04 refinement-todo entry existed; the spec-026 `## Slices` placeholder was updated to the slice link separately (in `026-generic-pixel-connector/spec.md`). `external_id` is capture-grounded; `em`/`ph`/… doc-grounded (a live `ud[em]` capture is a follow-up, not a blocker). |
| `docs/memory/**` (jig) | `no-op` | The AM mechanism + the hashing-location decision live in the spec + ADR-0022; no new glossary domain term. |
| `core/airlock.js`, `core/pixel-chamber.worker.js`, `connectors/pixel/vendors/meta.js`, `adapters/eds/index.js` | `updated` | The core 026-04 implementation — the `identity` protocol (both directions) + the hash-only main-side cache + the `setIdentity` verb + the unload merge + the `advancedMatching` config + `external_id` sourcing. Per-file detail: Deviation log §§1–5 + Wiring summary. |
| `connectors/pixel/advanced-matching.js` (NEW) + the 4 `test/pixel-advanced-matching*.test.js` | `updated` | The normalization+hashing+merge module + its tests. Folded nits: `st` comment typo (`tx`→`te`); the brittle `.not.toContain("415")` guard removed; the near-vacuous "invents nothing" test made a real discriminator. |
| Built / generated artifacts | `no-op` | The pixel worker bundle gains the AM module; re-emitted by `npm run build`, not git-tracked. |
