---
status: DRAFT
dependencies: [042-02, adr-0022]
last_verified:
frame_review: true   # security-critical identity hashing + a new worker→main
                     # protocol + the 042 unload seam; A1–A5 + the cold-cache race
                     # (ADR-0022) are load-bearing assumptions to attack.
arch_review: true    # adds a worker→main `identity` message + a main-side hash
                     # cache + a merge into the 042 unload requestMapper — a
                     # protocol + module-boundary change.
---

<!-- jig grounding (ADR-0020): grounded by the real capture
     test/fixtures/meta-tr-pageview.redacted.json + Meta's Customer Information
     Parameters docs (per-field normalization + SHA-256); the hashing-location
     decision is ADR-0022. -->

## Slice 026-04 — Meta advanced matching: `ud[external_id]` (worker-hashed, unload-cached)

**Goal:** Emit Meta Pixel advanced matching — `ud[external_id]=<SHA-256 hex>` — on
both the steady-state and the spec-042 unload beacon, with the hash computed **in
the worker chamber** and cached main-side for the synchronous unload path
([ADR-0022](../../decisions/adr-0022-pixel-advanced-matching-hashing.md)). Grounded
by a real erp.intuit.com `/tr` capture (`ud[external_id]` present, GET) + Meta's
published normalization/hashing spec. `external_id` is the first (and only
capture-grounded) advanced-matching field; the hashed PII fields
(`em`/`ph`/`fn`/…) are an explicit deferred extension on the same mechanism.

**DoR:**
- ✅ Grounded: the capture (`test/fixtures/meta-tr-pageview.redacted.json`) shows
  `ud[external_id]=<64-hex>` on a **GET** `/tr` (no POST even with advanced
  matching), stable across 3 beacons (session-stable, ADR-0022 A3). Meta's
  [Customer Information Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters)
  document SHA-256→hex + `external_id` hashing optional-but-recommended.
- ✅ Grounded: 042 wires the pixel unload `requestMapper` on the main thread,
  synchronously (`core/airlock.js`, commit `be2f4f5`) — the constraint ADR-0022
  resolves.
- ✅ Grounded: the pixel worker is egress-confined (`withholdFetch`, spec 026-01)
  — raw identity in the chamber cannot reach the network directly.
- ☐ Grounded at implementation: the exact `init`-vs-first-`handle` hash point;
  the worker→main message wiring in `core/pixel-chamber.worker.js` +
  `core/connector-host.js`; where the raw `external_id` is sourced
  (`adapters/eds/index.js` `bootMetaPixel` — a first-party cookie/GUID, like GA4's
  `_ga`); the cache shape on `core/airlock.js`; the unload `requestMapper` merge.
- ☐ Frame-critique passed (attacks ADR-0022 A1–A5 + the cold-cache race).

**Acceptance Criteria:**

1. **The worker normalizes + SHA-256-hashes `external_id` → `ud[external_id]=<hex>`.**
   The Meta config declares `external_id` as an advanced-matching field; the
   connector (in the worker) hashes the host-sourced raw value with
   `crypto.subtle.digest("SHA-256", …)` → lowercase hex, and emits
   `ud[external_id]=<hex>` on its `/tr` GET (matching the capture's shape). The
   raw value never leaves the worker except as the hash. A test asserts the
   emitted value is 64-hex and equals `SHA-256(raw)` for a synthetic raw id.
2. **The worker posts the hash back to main on a new `identity` channel; main
   caches it.** Alongside `{ready, dropped}`, the pixel chamber posts
   `{ type: "identity", ud: { external_id: <hex> } }` once the hash is computed;
   `core/airlock.js` caches it on the instance. A test asserts the cache is
   populated after the worker round-trip.
3. **The 042 unload beacon carries `ud[external_id]` from the cache, read
   synchronously.** The pixel unload `requestMapper` (042) reads the cached hash
   and merges `ud[external_id]=<hex>` into the closing `/tr` GET — no `await`. A
   test drives a real `visibilitychange`→hidden after the cache is warm and
   asserts the flushed GET carries `ud[external_id]=<hex>`.
4. **Degradation guarantee (cache miss → omit, never raw).** With a COLD cache
   (hash not yet round-tripped), the unload beacon omits `ud[external_id]`
   entirely — it never emits the raw value. A test forces a cold-cache teardown
   and asserts the GET has NO `ud[...]` and NO raw id anywhere in the URL. (The
   cache holds only hashes and the raw never crosses back, so "omit" is the only
   reachable miss behaviour — ADR-0022.)
5. **GET-only; `cd[...]` unaffected.** No POST path is added (the capture is GET).
   Custom-data `cd[...]` (026-06) is untouched and still mapped per-event,
   plaintext, synchronously.
6. **Consent-gated.** `ud[external_id]` egress is gated by the pixel's declared
   egress purpose (`ad_storage`, ADR-0007) exactly like the rest of the beacon —
   a denied/strict-denied purpose drops the beacon (identity included), on both
   the steady-state seal and the unload path (017-03 AC4). A test witnesses it.
7. **No live identifiers** — synthetic raw `external_id`; assert the fixture's real
   redacted hash is never reproduced.

**Explicitly deferred (named, not built):**
- **Hashed PII fields** `em`/`ph`/`fn`/`ln`/`db`/`ge`/`ct`/`st`/`zp`/`country` —
  same worker-hash → cache path + Meta's per-field normalization (ADR-0022 A4
  table), but need a signed-in/form PII source not present on the captured
  anonymous visit. A config-declared extension on this slice's mechanism.
- **POST `/tr`** — not observed (GET only at this payload size); a documented
  future edge for oversized payloads.
- **`_fbp`/`fbc` cookie identity** — a do-not-hash cookie-capability follow-up,
  separate from advanced matching.

**DoD:**
- [ ] All ACs pass; full suite green. GA4/RUM/alloy/gtag + the 042 POST/GET unload
      paths byte-unchanged; pixel steady-state (non-AM) unchanged when no
      `external_id` is configured (back-compat).
- [ ] Coverage exercises each AC incl. the cold-cache degradation + the consent gate.
- [ ] Each new test shown to red when its feature is removed.
- [ ] Reviewed by `reviewer` subagent (compliance + craft).
- [ ] Frame-critique passed (ADR-0022 assumptions + cold-cache race).
- [ ] Arch pass (`arch_review: true`) — the worker→main protocol + cache + unload merge.
- [ ] Implementation review passed.
- [ ] Deviation log + Reconciliation sweep produced.
- [ ] Reconciliation review passed.
- [ ] ADR-0022 accepted (frame-critique recorded) before/with this slice's REVIEWED.
- [ ] `docs/refinement-todo.md` 026-04 placeholder + `docs/inbox.md` swept.

### Close-out (post-DONE)

- [ ] `docs/specs/README.md` regenerated.
- [ ] Primer hygiene: if 026-06 is also DONE, spec 026 closes — compress its entry.

**Anti-horizontal-phasing check:** after this slice a real Meta Pixel beacon from
airlock carries `ud[external_id]=<hash>` for match quality — including the closing
unload beacon — the first vendor proven at *identity* parity (mvp7.md's "first real
vendor proven at parity"), where before airlock's pixel was identity-free.

### Deviation log (after reconciliation)

_TODO (implementer)._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | _TODO._ |
| `docs/specs/README.md` | `deferred (close-out)` | _TODO._ |
| `docs/architecture.md` | `updated` | _TODO: the pixel worker→main `identity` channel + main-side hash cache is a new protocol seam._ |
| `docs/decisions/*` / ADR index | `updated` | _TODO: ADR-0022 accepted + indexed._ |
| `docs/inbox.md` | `no-op` | _TODO._ |
| `docs/refinement-todo.md` | `updated` | _TODO: 026-04 placeholder resolved (external_id); em/ph noted deferred._ |
| `docs/memory/**` | `no-op` | _TODO._ |
| Built / generated artifacts | `no-op` | _TODO: rebuilt by `npm run build`._ |
