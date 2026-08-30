---
status: DONE
dependencies: [015-01]
last_verified: 2026-08-30
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
- [x] ACs 1–4 pass — override ON re-derives host + tenant + alerts; override OFF (default) holds
      (015-01 unchanged); the honest path unchanged either way. _(Targeted run:
      `test/wrapped-sdk-host.test.js` 23/23, `test/alloy-config-integrity.test.js` 11/11,
      `test/core-boundary.test.js` 1/1 — 35/35, 490ms, no hang.)_
- [x] **No regression** — 015-01's fail-closed default is unchanged (explicit `disposition:"hold"` +
      the incomplete-pin-holds cases prove it); the override branch is inert unless
      `disposition:"override"`, so back-compat (no disposition) is byte-identical. Full suite left un-run
      by design (the nested worktree's oracle/conformance tests hang); the changed module's own suite green.
- [x] Reviews: compliance + craft recorded pass (spike-light — a disposition variant, no new arch seam).
- [x] Deviation log + reconciliation sweep; the config-integrity ADR's "override option" (ADR-0011 §7)
      reflected as implemented; mvp3.md updated (spec 015 complete).
- [x] **No live identifiers committed** — synthetic values only (`11111111`/`99999999`); the diagnostic
      emits only `reason` (the param *name*, never the value).

**Anti-horizontal-phasing check:** after this slice, an operator can choose **availability** (override:
correct-and-send, still alerted) over **blocking** (hold) for config-integrity — an explicit,
non-default, observable trade. Observable value: with override on, a re-pointed chamber's egress is
corrected to the host destination + surfaced, not dropped.

### Deviation log

- **AC2 pollution-evasion coverage is split across two test files (deliberate, not a gap).** The
  seam-level override tests cover a same-host re-point + a foreign host; the *pollution*-evasion claim
  is proven by the control-unit `pinnedDispatchUrl` case in `test/alloy-config-integrity.test.js`
  (015-01) that feeds a `?configId=honest&configId=attacker` URL and asserts exactly one pinned
  `configId` out. The seam test proves the seam *invokes* `pinnedDispatchUrl` under
  `disposition:"override"`; composed, AC2's pollution claim holds without a redundant seam case.
- **Incomplete-pin-under-override HOLDS** — a design refinement made during implementation (not in the
  original ACs): a misconfiguration can't be re-derived to a valid destination, so override falls back
  to hold. Guarded (`pinComplete`) + tested. Strictly safer than the ACs required.
- **Config-integrity is protocol-blind — a TRACKED residual (015-02 review), not "negligible".**
  `checkConfigIntegrity` keys on `.host` (not the scheme) and `pinnedDispatchUrl` preserves the
  chamber's scheme, so an `http://` downgrade to the honest host+tenant PASSES the check, and an
  override re-derives over `http://` — forwarding the honest tenant/identity over cleartext. This is
  **outside config-integrity's host+tenant surface by design** (ADR-0011 §2 scopes this control to
  *which tenant*, not the transport); transport pinning (require `https`) belongs to the egress
  allow-list (ADR-0004). Filed in [refinement-todo](../../refinement-todo.md), not dismissed.
- **Contradictory-alert defect (015-02 review, FIXED before DONE).** The detector's `reason` strings
  originally baked in hold-language ("held at the seal" / "fail closed"), so an *overridden* dispatch
  emitted `{ disposition: "overridden", reason: "…held at the seal" }` — an operator would read "held"
  and think egress was blocked when it was actually *sent*. Fixed: `reason` is now disposition-neutral
  (names only the deviation; the `disposition` field carries the verb); the override tests now assert
  the `reason` and that it does **not** say "held".

### Reconciliation sweep

- ADR-0011 §7 (override a named opt-in) is now **implemented** — the seam's `disposition:"override"`
  branch re-derives host+tenant via `pinnedDispatchUrl` and sends, still alerting.
- Reviews recorded: compliance + craft (spike-light; no arch — a disposition variant of 015-01's
  already-arch-reviewed seam, no new boundary).
- `docs/releases/mvp3.md`: config-integrity row + Risk-First/JIG notes updated to **spec 015 COMPLETE**
  (both dispositions landed; the body-`orgId` residual remains the one tracked follow-up).
- Tests: 35/35 targeted (23 in the changed module's own suite), no live ids. Back-compat unchanged
  (the override branch is inert without `disposition:"override"`).
- No inbox items; the body-`orgId` + GA4-async residuals stay tracked in ADR-0011 + refinement-todo.
