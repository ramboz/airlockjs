---
status: DONE
dependencies: [adr-0023]
last_verified: 2026-09-12
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
   **unmodified** (denied storage → send; the flush stays the current verbatim re-send for non-opted-in held beacons).
   Re-map is scoped to an **opted-in instance that wired a `remap` and whose ready beacon carried its source `event`** —
   such an instance re-maps *its* holds regardless of the denied-vs-pending cause (a pending-mapped payload is equally
   stale, so this is the leaner/more-correct choice; the held item need not record the causing state); a non-opted-in
   pending hold keeps the byte-identical verbatim re-send. **No connector opts in in this slice** — GA4/pixel/g-ads runtime
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
- **Fan-out re-map** — `remap` rebuilds **one** request per held item; a connector whose `handle` fans one event out to
  N held beacons is not supported by re-map (g-ads is 1:1 event→beacon). Named limitation ([ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) / `docs/refinement-todo.md`).

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

The slice as framed (DRAFT + the frame-critique re-map-on-grant fold) held up. What deviated or was
decided during implementation + the three review passes (all folded; suite green):

- **Held item shape (as framed).** A `holdOnDenied` hold with `remap` wired + a ready beacon carrying
  its source `event` buffers a RE-MAP item `{ event, remap:true, beaconId }`; every other hold (017-03
  pending; opted-in but missing re-map inputs) buffers the verbatim RE-SEND item
  `{ url, method, body, beaconId }`. The non-opted-in path is byte-identical to 017-03.
- **[compliance blocker → fixed] Held `reason` derives from the ACTUAL consent state** (via
  `resolveConsent` → denied vs pending), not from `canRemap` (which mislabeled a pending opted-in hold
  as "denied" and a no-remap denied hold as "pending"). AC2's "reason naming denied-hold" is now
  honored on every path; the non-opted-in reason string is unchanged.
- **[arch blocker 1 → fixed] Additive optional `EgressRequest.event` re-map channel** on the frozen
  contract (`contracts/connector.d.ts`; ADR-0017 additive). Reader = the seal; producer = a connector's
  `handle`, threaded verbatim by `createConnectorHost`. Wired-but-inactive until a consumer supplies
  `remap` + attaches `event` — 044-02 (g-ads) now owns that (ACs tightened).
- **[arch blocker 2 → fixed] Verbatim-re-send footgun made observable** at both hold time (held reason
  "NO re-map wired … will RE-SEND … verbatim") and flush time (flushed reason "flushed VERBATIM"); it
  does NOT drop (a legitimate consent-independent payload still flushes).
- **[arch nit → fixed] Endpoint-ceiling re-check on the re-mapped flush URL** (`checkEndpointCeiling`
  before the flush fetch), scoped to `b.remap` items — a connector cannot widen its declared ceiling via
  re-map (ADR-0006/AD-5). Re-send items keep pre-existing 017-03 flush behavior (only re-map newly makes
  the flushed URL connector-controlled).
- **[craft nit → fixed] Declined re-map emits a terminal `dropped` record** (beaconId-chained), no
  fetch — the held→flushed chain is never silently broken.
- **[arch nit → fixed] AC4 tightened** to match the code: re-map is scoped to an opted-in instance
  (wired `remap` + carried `event`) and re-maps its holds regardless of denied-vs-pending cause.
- **[arch nit → documented] Fan-out 1:1 limit** (`remap` rebuilds one request per held item) — named in
  the contract, ADR-0023, out-of-scope, and refinement-todo.
- **Ratified strengths (logged, not blocking):** monotone verdict escalation (send<hold<drop) preserving
  strict precedence by construction; `beaconId` minted once + carried held→flushed for both re-send and
  re-map; sync/unload drops a `holdOnDenied` hold at teardown; two-path integrity
  (`core/wrapped-sdk-host.js` untouched, 034-01 not regressed).
- **Forward note (compliance):** a verbatim RE-SEND flush still egresses without a flush-time ceiling
  check (pre-existing 017-03, consciously preserved byte-unchanged); the re-map path closes that gap on
  its own side only.

### Reconciliation sweep

- Full `npx vitest run` → **103 files / 1596 passed, 0 fail** (1578 pre-slice + **18** new 045-01
  `it()` cases — 11 in `test/consent-seal.test.js`, 7 in `test/consent.test.js`; 0 removed).
  `eslint .` → 0.
- Default (opt-out) byte-identical: every pre-existing seal/consent/GA4 test passes unmodified with
  `holdOnDenied` unset; the non-opted-in held/flushed reason strings are unchanged.
- No connector opts in in-tree (enumeration): `holdOnDenied`/`remap` are set/read only in
  `core/{airlock,consent}.js`, the two consent tests, and the `contracts/connector.d.ts` doc for the
  `event` channel (repo-wide grep); the lone `remap` hit in `adapters/eds/exposure.js` is an unrelated
  DOM-remapping comment, not the seal callback. GA4/pixel/g-ads runtime unchanged.
- `core/wrapped-sdk-host.js` untouched (two-path integrity; 034-01 not regressed).
- Changed-file dispositions (the change-set to land is the **working tree** — 11 modified + 4
  review-evidence files):
  - `core/consent.js`, `core/airlock.js`, `contracts/connector.d.ts` — the mechanism (verdict flag,
    seal threading + re-map-on-grant flush + ceiling re-check + diagnostics, additive `event` channel).
  - `test/consent.test.js` (+7 `it`), `test/consent-seal.test.js` (+11 `it`) — unit matrix + seal
    integration (hold / re-map-not-re-send / footgun / off-ceiling / declined-remap).
  - `docs/decisions/adr-0023-ad-pzn-egress-hold-until-consent.md` — Accepted + "Landed shape + scope".
  - `docs/architecture.md` — the seal `holdOnDenied` + `EgressRequest.event` note (close-out).
  - `docs/refinement-todo.md` — grant-flush residual resolved + the fan-out 1:1 limit recorded.
  - `docs/specs/044-google-ads-connector/slice-02-denied-seal-hold.md` — ACs tightened to own the
    `event`/`remap` producer (activates the re-map channel end-to-end; the g-ads consumer, still DRAFT).
  - `docs/specs/045-consent-hold-until-granted/spec.md` + `slice-01-seal-hold-mode.md` — lifecycle
    frontmatter (DRAFT→…→REVIEWED) + this reconciliation.
  - `docs/specs/045-consent-hold-until-granted/reviews/slice-01-{compliance,craft,arch,reconciliation}.md`
    — review evidence.
- Status board (`docs/specs/README.md`) still shows 045-01/044-02 as `DRAFT` — regenerated at DONE
  (deferred-to-DONE board regen, not a content change in this slice).
- ADR-0023 `status: Accepted`; its "Landed shape + scope" clause matches the code (wired-but-inactive,
  ceiling re-check, footgun diagnostic, fan-out limit).
- Review evidence recorded under `reviews/` — compliance/craft/arch/reconciliation, each initial
  verdict superseded in place by its re-verify pass (git history is the audit trail, ADR-0014).

### Close-out (post-DONE)

- [x] ADR-0023 status → Accepted (landed by the implementer; re-affirmed by the arch re-verify pass).
- [x] `docs/architecture.md` notes the `holdOnDenied` seal mode + the `EgressRequest.event` re-map channel.
