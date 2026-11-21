---
slice: 064-21 — aem-martech, ACDL and Launch (B5)
pass: craft
round: follow-up 1
verdict: approved
reviewer: independent reviewer (Claude Opus 5.5, Copilot jig:reviewer sub-agent)
reviewed_at: 2026-11-20 (time not recorded)
prompt_source: review prompts for slice 064-21 (commits 3be50885, 1a5058a3, 1f751acd; follow-up round 1 reviewed a15457ec, findings fixed in the next pushed commit)
---

# 064-21 craft

The author saved this text (a summary of the reviewer's reports; fresh reviewers each round). Rounds are capped at 3.

Round 1 changes-requested (medium: a per-call `personalization` without the boolean dropped the `__view__` suppression, and a test locked that output in; low: fixed sleeps, missing diagnostics for a throwing hook, an unmappable consent and both overrides, queue drain ordering, an empty `surfaces` list). Fixed in 1a5058a3 with tests (the suppression test expectation, the explicit-boolean test, the diagnostics test); the wait now polls for the four edge calls. Round 2 changes-requested (medium: `renderDecisions` fell back to the host default, which renders, while stock defaults to false; low: silent `configure` options, a throwing hook resolves instead of rejecting, `__alloyNS` not read, wait loop and CI download notes). Fixed in 1f751acd with the hermetic test "sendEvent never renders unless the page asks"; the rest is accepted or owned by 064-31 AC5, AC6 and AC7. Round 3 approved (low: a page-requested `__view__` on the first call still gets the suppression, owner 064-31 AC7; the `page_view` event name assumes a `bootAlloy` handle, now stated in the bridge header; the AC3 host-count check is weak but the Edge-host check carries it, acceptable for a `live-only` row).

## Follow-up round 1 (owner-directed: no shipped page global)

Fresh Opus 5.5 reviewer on a15457ec; verdict was changes-requested, with small findings, all fixed in the following commit (the author saved this text):

- Garbled `alloy-bridge.js` header: rewritten (no capability, no page global, no command beyond the ADR-0063 allowlist, site installs its own global).
- `architecture.md` lacked the product-path clause: added.
- No-global test too thin: now plants a sentinel `globalThis.alloy`, runs configure, sendEvent, setConsent, applyPropositions and a default command, and asserts the sentinel and the global key set are untouched.
- Shim injection via `toString()` fragile under coverage: noted in `rig/alloy-queue-shim.mjs`.
- Test comment wording and spec s12 parenthetical: fixed. The unissued ADR number was dropped; the ADR and slice are created separately.

Verdict after fixes: approved (fixes are comment, doc and test only; no production logic changed).
