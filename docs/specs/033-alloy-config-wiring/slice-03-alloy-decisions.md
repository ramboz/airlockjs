---
status: DRAFT
dependencies: [033-02]
last_verified:
arch_review: true  # extends the wrapped-SDK host message contract + the decisions→reserveSpace delivery path.
frame_review: true  # rests on 033-02's config-boot design; the {type:"decisions"} path is genuinely un-built today.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions — never assert an unverified claim as fact. -->

## Slice 033-03 — build: config-boot alloy (the personalization vertical) — decisions-as-data → `reserveSpace`

> **The follow-on vertical to [033-02](slice-02-alloy-config-build.md)** (the SPIDR-Path split). 033-02 delivers
> config-booted alloy for **analytics** (`sendEvent` → intercepted interact). This slice adds **Target
> personalization**: the chamber's `{type:"decisions"}` message — **un-consumed by `createWrappedSdkHost` today**
> (`core/wrapped-sdk-host.js` `handleMessage` handles phase / intercepted-fetch / cookie-writeback / result / fatal
> only; a rig harness is the only current listener) — delivered through the composite handle to `reserveSpace`
> (spec 012-03 built the mechanism headless; 018 is the sanitizer boundary). **Gated on 033-02 DONE.**

**Goal:** config-booted alloy (`{type:"alloy"}`) renders **Target personalization as data**: the host consumes the
chamber's `{type:"decisions"}` message and delivers propositions via `caps.decisions.deliver` → the composite handle
→ `reserveSpace` (headless, `renderDecisions:false` — decisions-as-data, R-004/012-03), gated by the
`personalization` consent purpose. Closes the personalization half of MVP6's alloy config-surface support.

**DoR:**
- ⏳ **033-02 DONE** (config-bootable alloy: `bootAlloy` + the composite handle + the served worker + the strict
  consent gate). This slice does not start until then.
- ✅ The mechanism exists headless (012-03 — decisions-as-data + `reserveSpace`); 018 hardened the `reserveSpace`
  sanitizer boundary. This slice **wires it through the config-boot adapter + composite**, it does not invent it.

**Acceptance Criteria (provisional — refine at this slice's own frame-critique, after 033-02 lands):**

1. **Host consumes `{type:"decisions"}`.** `createWrappedSdkHost`'s message handling consumes the chamber's
   `{type:"decisions"}` message (un-consumed today) and delivers the propositions via `caps.decisions.deliver`
   (rather than only a rig harness listening).
2. **`bootAlloy` wires decisions delivery** into the composite handle so config-booted alloy delivers propositions to
   the page's `reserveSpace` (018 sanitizer boundary) — headless (`renderDecisions:false`).
3. **Consent.** The `personalization` purpose gates decisions delivery (already in alloy's egress vector — no new
   purpose); a `personalization`-denied config suppresses decisions.
4. **End-to-end proof.** A headless rig/test config-boots alloy, drives a `sendEvent` that returns Target
   propositions, and asserts the decisions are delivered + applied via `reserveSpace`.

**DoD:** all ACs pass; TDD red→green; reviewed (compliance + craft + **arch** [`arch_review: true`] + **frame-critique**
[`frame_review: true`]); deviation log + reconciliation sweep; reconciliation review; `docs/refinement-todo.md` alloy
entry fully CLOSED (analytics [033-02] + personalization [033-03] both landed); board synced.

_Created 2026-09-04 as the personalization half of the 033-02 SPIDR-Path split. Its ACs are provisional until 033-02
lands and this slice takes its own frame-critique._
