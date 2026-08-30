---
status: DRAFT
dependencies: [015-01]
last_verified:
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 015-02 — override availability option

**Goal:** Offer an **opt-in** softer disposition for deployments that prefer *keep-working* over *block*.
015-01 holds fail-closed on a config-integrity deviation. This slice adds an **override** option: instead
of holding, the seam **re-derives** the dispatch to the host-pinned host + tenant (`pinnedDispatchUrl`,
generalized to host + injected tenant key) and **sends** — evasion-proof (it never trusts the chamber's
value) — **still alerting** through the 009-02 seam. Override is **OFF by default** (015-01's hold
stands); turning it on is an explicit operator choice that accepts the **body-integrity trade** (the
attacker-shaped payload is forwarded to the *honest* tenant — the `orgId`/body co-vector 013-03 named).

**DoR:**
- ✅ [015-01] DONE — the generic control (host + injected tenant key), the dispatch-seam wiring, the
  fail-closed hold, and the 009-02 alert exist; the config-integrity ADR (which names override as a
  recorded option) is Accepted.

**Acceptance Criteria:**

1. **Opt-in, OFF by default.** An explicit config flag (host-owned, e.g. `configIntegrity: "override"`
   vs the default `"hold"`) selects the disposition. Observable: with no flag, a deviation **holds**
   (015-01 unchanged); the option is not on unless the operator sets it.
2. **Override re-derives + sends.** With override ON, a deviation causes the seam to dispatch the
   **re-derived** URL carrying exactly the host-pinned **host + tenant** (`pinnedDispatchUrl`),
   discarding whatever the chamber supplied — so a re-pointed / polluted / foreign-host outbound reaches
   the **host** destination. Observable: the dispatched URL's host + tenant === the pins, ≠ the
   attacker's; pollution/encoding cannot evade (never a parse-and-compare).
3. **Override still ALERTS (never silent).** An overridden dispatch emits a diagnostic
   `{ kind: "config-integrity", disposition: "overridden", reason }` (redacted) — the correction is
   **observed**, so override is never a silent rewrite. Observable: one diagnostic per overridden dispatch.
4. **The body-integrity trade is recorded, not hidden.** The ADR (015-01) + the config docs state that
   override forwards the attacker-shaped **body** into the honest tenant (a data-integrity residual);
   `hold` is the safe default; `override` is availability-over-integrity, chosen deliberately. Observable:
   the trade is documented at the config surface, not buried.

**DoD:**
- [ ] ACs 1–4 pass — override ON re-derives host + tenant + alerts; override OFF (default) holds
      (015-01 unchanged); the honest path unchanged either way. Green (targeted tests, not the
      hang-prone full suite unguarded).
- [ ] **No regression** — 015-01's fail-closed default + the full suite stay green.
- [ ] Reviews: compliance + craft recorded pass (spike-light — a disposition variant, no new arch seam).
- [ ] Deviation log + reconciliation sweep; the config-integrity ADR's "override option" reflected as
      implemented.
- [ ] **No live identifiers committed** — synthetic values; the diagnostic redacts identifier values.

**Anti-horizontal-phasing check:** after this slice, an operator can choose **availability** (override:
correct-and-send, still alerted) over **blocking** (hold) for config-integrity — an explicit,
non-default, observable trade. Observable value: with override on, a re-pointed chamber's egress is
corrected to the host destination + surfaced, not dropped.
