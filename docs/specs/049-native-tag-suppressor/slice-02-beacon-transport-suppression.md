---
status: DRAFT
dependencies: [049-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 049-02 — direct-beacon-transport suppression (egress-parity completeness)

**Goal:** Extend 049-01's suppressor to also block the migrated vendors' **beacon transports** — `<img>` (pixel), `fetch`,
`navigator.sendBeacon`, and `XMLHttpRequest` — by the SAME URL/query matchers, still carving out airlock's own egress, so a
container tag that fires a **bare pixel or a direct beacon without a heavy runtime** (which 049-01's runtime-`<script>`
block does not catch) is also suppressed. This makes airlock's arm the **sole emitter** for beacon parity, and covers the
pixel-style generic-adopter case beyond the four runtime-based trial vendors.

**Why no `arch_review`.** Reuses 049-01's ratified matcher/carve-out/diagnostic contract — no new public surface, no new
module boundary. It adds transport coverage behind the same config. (`arch_review` omitted → default off.)

**DoR:**
- ✅ 049-01 DONE — the matcher shape, the airlock-egress carve-out (allow-set), the diagnostic, and the dist entry exist;
  this slice binds the same matchers to the transport seams.
- ✅ The Playwright real-browser rig (`rig/tag-suppressor.mjs`) exists — extend it with the transport cases.

**Acceptance Criteria:**

1. **The four beacon transports are suppressed by the same matchers.** With the suppressor installed, a `suppress`-matching
   beacon sent via `new Image().src=` / `fetch()` / `navigator.sendBeacon()` / `XMLHttpRequest.open()+send()` is **dropped**
   (no network request), while a non-matching beacon on any transport goes through untouched. Proven in the real-browser rig
   (network-0 for the matched beacon per transport), Node/vitest-ineligible (real transports + network).
2. **The airlock-egress carve-out holds across transports.** airlock's OWN arm beacon (e.g. the GA4 `/mp/collect` `fetch`,
   the pixel `/tr` `<img>`, the ad `ccm/collect` GET) is NEVER dropped even under an over-broad adopter `suppress` matcher —
   the allow-set wins on every transport, not just `<script>`. Tested per transport (remove the carve-out → airlock's own
   beacon is dropped → red).
3. **The pixel-without-a-runtime case is covered end-to-end.** A container template that fires a bare `<img>`/`sendBeacon`
   beacon directly (no blockable runtime `<script>` — the case 049-01 alone misses) is suppressed by this slice, and the
   per-suppression diagnostic (049-01) names the matched beacon URL + transport.
4. **Idempotent / order-safe with 049-01.** Installing the suppressor patches the transport seams once (no double-wrap on a
   re-install), and the transport block composes with the runtime-`<script>` block from one `installTagSuppressor` call
   (one config, both target classes) — a single install covers runtimes AND beacons.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC; the per-transport carve-out (AC2) and the bare-pixel case (AC3) are
      explicit; AC1 is the GATING real-browser rig extension (network-0 per transport), wired into CI's browser-oracle job.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore) — especially the per-transport
      carve-out and the network-0 per-transport assertions.
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass (no arch — reuses 049-01's contract).
- [ ] Deviation log + reconciliation sweep produced under this slice heading. If this slice closes spec 049 (049-01 + 049-02
      DONE), run the close-out (compress the primer's active-spec entry; memory-sync the suppressor primitive).
- [ ] `docs/refinement-todo.md` updated if any transport/vector residuals are deferred (e.g. WebSocket, or a beacon fired
      from inside a Worker the page can't gate — the ADR-0030 kill-criterion class).

**Anti-horizontal-phasing check:** after this slice lands, an EDS adopter's suppressor also drops container tags that fire
**bare pixels / direct beacons without a runtime** (not just runtime-based tags), so airlock's arm is the sole emitter for
beacon parity — end-to-end, on all four transports, with airlock's own egress protected. A usable capability, not
intermediate state.

## Assumptions

- **The four transports (`<img>`/`fetch`/`sendBeacon`/`XHR`) are the container's beacon surface.** Grounded that these are
  the standard tag beacon transports; a WebSocket / EventSource / Worker-internal beacon is a named residual (ADR-0030
  kill-criterion class), out of scope. Confirmed against the reference site's captured beacons (`martech.golden.json` —
  `<img>`/`fetch`-shaped) during implementation.

### Deviation log (after reconciliation)

_TODO at reconciliation._

### Reconciliation sweep

_TODO at reconciliation._
