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
**denied** governing egress purpose → **hold** (buffer + flush-on-grant) instead of `send`; when unset (default), the
seal behaves exactly as today (denied → send, pending → hold, granted → send, strict → drop). This is the **mechanism
only** — no connector opts in here; opt-in is grounded per vendor by the consumers (g-ads 044-02; Meta/Floodlight
follow-ups). GA4 stays default (send-cookieless). Reuses 017-03's existing `heldBeacons`/`setConsent` buffer+flush
verbatim.

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
2. **`createAirlock({ holdOnDenied })`** (default `false`) threads to all three `egressVerdict` seal sites. With
   `holdOnDenied: true`, a denied governing purpose **buffers** to `heldBeacons` (with the existing `beaconId`/`method`
   capture) and **flushes on a later `setConsent` grant** — reusing the 017-03 mechanism unchanged; the hold is recorded
   by the inspector seam (`disposition: "held"`, a reason naming denied-hold vs pending). Witnessed by a FakeWorker seal
   test (the `test/consent-seal.test.js` pattern): `holdOnDenied` instance + denied `ad_storage` → **held, not sent**;
   `setConsent({ ad_storage: "granted" })` → **flushed**.
3. **Default (opt-out) behavior is unchanged.** With `holdOnDenied` unset, every existing seal/consent/GA4 test passes
   **unmodified** (denied storage → send). **No connector opts in in this slice** — GA4/pixel/g-ads runtime behavior is
   byte-identical until a consumer sets the flag (044-02 for g-ads).
4. **Behavior-preserving + accepted.** Full `npx vitest run` green; `eslint` clean. ADR-0023 flipped Proposed → Accepted
   (this slice is its implementation). `arch_review: true` — the seal gains a new enforcement mode.

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

**A1 (the flush reuse is exact).** The 017-03 `heldBeacons`/`setConsent` flush already handles a `hold` verdict from any
cause; a denied-cause hold flushes identically to a pending-cause hold. *Risk:* if the flush is entangled with the
"pending" reason specifically, a denied-hold might not flush — guarded by AC2's flush test. Grounded by reading
`core/airlock.js:412-429` (the hold path captures url/method/body/beaconId uniformly; the flush is consent-resolution
driven, not reason-specific).

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] ADR-0023 status → Accepted.
- [ ] `docs/architecture.md` notes the `holdOnDenied` seal mode.
