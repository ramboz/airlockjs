---
status: DRAFT
dependencies: [adr-0023]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 045-01 — the core seal `holdOnDenied` opt-in mode (egressVerdict + createAirlock)

**Goal:** Add a per-instance **`holdOnDenied`** opt-in to the core seal (implements [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md)
Option E), mirroring the existing `consentStrict` flag: when a connector's airlock instance sets `holdOnDenied: true`, a
**denied** governing egress purpose → **hold** (buffer) instead of `send`; when unset (default), the seal behaves exactly
as today (denied → send, pending → hold, granted → send, strict → drop). No connector opts in here (mechanism + unit
proof only); opt-in is grounded per vendor by the consumers (g-ads 044-02; Meta/Floodlight follow-ups). GA4 stays default
(send-cookieless).

**RE-MAP ON GRANT (folded from the 045-01 frame-critique, 2026-09-11 — the load-bearing correction).** The existing
`setConsent` flush re-`fetch`es the **boot-time-mapped** `{url, body}` verbatim (`core/airlock.js:666-687`; the residual
is named at `:660`). That is **wrong for a consent-dependent payload**: a g-ads beacon mapped under denial has **no
`auid`** (`_gcl_au` read is `ad_storage`-gated) and carries `gcs`=denied/`npa`=1, so re-sending it on grant fires an
**unattributable "user-declined" beacon** — not the container's re-executed granted beacon. So this slice makes the flush
**RE-MAP** on grant: the held item carries what's needed to rebuild (the event/descriptor + the connector's main-thread
mapper + a ctx re-source), and `setConsent` re-maps with the **current (granted) consent/ctx** before firing. This
resolves the deferred mid-session ctx-refresh residual (`docs/refinement-todo.md`) for the seal path.

**Why per-connector opt-in, not blanket-by-purpose (the ADR-0023 owner correction).** A blanket "denied `ad_storage` →
hold" would sweep in connectors whose real vendor behavior airlock has NOT captured (LinkedIn/Bing declare `["ad_storage"]`
but are not on the reference site). Fidelity means each connector opts in from its own captured behavior — so the seal
provides the mechanism, the connector chooses.

**DoR:**
- ✅ Mechanism grounded: `egressVerdict` (`core/consent.js:110`) returns send/hold/drop; `core/airlock.js` (three seal
  sites: `:260`, `:401`, `:671`) buffers a `hold` to `heldBeacons` + `setConsent` flushes on grant. Today denied → send
  (`core/consent.js:116-118`). `consentStrict` (`core/airlock.js:65`) is the existing per-instance flag to mirror.
- ✅ ADR-0023 (Option E) is the governing decision; this slice moves it Proposed → Accepted.

**Acceptance Criteria:**

1. **`egressVerdict(vector, purposes, { strict, holdOnDenied })`.** With `holdOnDenied: true`, a **denied** governing
   purpose returns **`hold`** (not `send`); `pending` → `hold`, `granted` → `send`, and `strict` (drop) are unchanged and
   take precedence over `holdOnDenied` (strict still drops). With `holdOnDenied` absent/false, the verdict is
   **byte-identical to today** (denied → send). Unit tests cover the full matrix (granted/denied/pending × strict ×
   holdOnDenied).
2. **`createAirlock({ holdOnDenied })`** (default `false`) threads to the async seal site. With `holdOnDenied: true`, a
   denied governing purpose **buffers** the held item and the inspector records the hold (`disposition: "held"`, a reason
   naming denied-hold). The held item is **extended to carry the re-map inputs** — the event/descriptor + the connector's
   main-thread mapper + a ctx re-source — not just the mapped `{url, body}`. Witnessed by a FakeWorker seal test
   (`test/consent-seal.test.js` pattern): `holdOnDenied` + denied `ad_storage` → **held, not sent**.
3. **RE-MAP on grant (the parity correction).** On a later `setConsent` grant for the held purpose, the held item is
   **re-mapped with the current consent/ctx** (via the connector's main-thread mapper + re-sourced ctx) → a **fresh**
   beacon (granted-state `gcs`/`npa`; consent-gated ctx like `auid` re-read now-granted) → then fired. It is **NOT** the
   stale buffered payload. Proven end-to-end in 044-02 (the flushed g-ads beacon carries `auid` + `gcs`=granted). The
   **sync/unload** seal site cannot buffer (no "later" to flush to), so under `holdOnDenied` it **drops** at teardown —
   correctly "no ping" for the page-load family under persistent denial; the teardown-conversion case is MVP9.
4. **Default (opt-out) behavior is unchanged.** With `holdOnDenied` unset, every existing seal/consent/GA4 test passes
   **unmodified** (denied storage → send; the flush stays the current re-send for non-opted-in held-pending beacons —
   re-map applies only to `holdOnDenied` items). **No connector opts in in this slice** — GA4/pixel/g-ads runtime
   behavior is byte-identical until a consumer sets the flag (044-02 for g-ads).
5. **Behavior-preserving + accepted.** Full `npx vitest run` green; `eslint` clean. ADR-0023 flipped Proposed → Accepted
   (this slice is its implementation). `arch_review: true` — the seal gains a new enforcement mode + the re-map-on-grant
   flush.

**DoD:**
- All ACs met; full suite green; ADR-0023 Accepted.
- Compliance + craft + **arch** passes recorded (arch ratifies the seal-mode addition + the per-connector-opt-in shape).
- Reconciliation walked; `docs/architecture.md` seal/consent description notes the `holdOnDenied` mode.

**Out of scope (explicit):**
- **Connector opt-ins** — g-ads (044-02), Meta/Floodlight (grounded follow-ups in their specs). This slice ships the
  mechanism + unit proof only.
- **alloy** — separate path (`core/wrapped-sdk-host.js`, slice 045-02).
- LinkedIn/Bing — ungrounded; never opted in here.

## Assumptions

**A1 (re-map-on-grant feasibility — folded from the 045-01 frame-critique, 2026-09-11).** The flush must **re-map** (not
re-send) a held `holdOnDenied` beacon, because a consent-dependent payload mapped under denial is stale (no `auid` —
`_gcl_au` is `ad_storage`-gated; `gcs`=denied/`npa`=1). Re-sending it on grant would fire an unattributable
"user-declined" beacon (the exact non-parity 044-02 AC3 forbids), not the container's re-executed granted beacon.
*Grounded feasible:* the connector already has a main-thread mapper (the 042 `requestMapper`/`handle` path, `core/egress.js`)
+ a consent-gated ctx re-source (`sourceGoogleAdsCtx`), which the seal can re-invoke at flush with the now-current
consent. *Risk / real work:* threading the mapper + event + ctx-source into the held item and re-sourcing on the main
thread is the substance of this slice (it resolves the deferred mid-session ctx-refresh residual). The
**persistent-denial** case (held → discarded at unload, never flushed) needs no re-map and is unaffected.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] ADR-0023 status → Accepted.
- [ ] `docs/architecture.md` notes the `holdOnDenied` seal mode.
