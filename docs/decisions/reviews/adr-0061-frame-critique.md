---
adr: 0061
pass: frame-critique
verdict: needs-changes
reviewer: claude-opus-5.5 (rubber-duck, round 10)
reviewed_at: 2026-11-13T01:50:58Z
prompt_source: review.py frame-critique docs/decisions/adr-0061-definition-of-done-vendor-compatibility.md
---

Reviewer: independent rubber-duck sub-agent, claude-opus-5.5, fresh context, same `review.py frame-critique` prompt (adr-0061-frame-critique-prompt.md). Reviewed HEAD a58240b4 on branch adr-0061-definition-of-done. Final round per owner decision; findings carried into the vendor inventory specs.

```
VERDICT: needs-changes

REASONING:
The highest-risk premise is not the stated one (acquisition — now reasonably grounded, since past blockers were mostly self-imposed approval/qualification gates that point 6 waives). It is that a frozen inventory built from one owned test account counts as "full parity", and that the pilot will reveal if it is incomplete. That inventory toggles author-picked candidate settings one at a time, and every check the ADR adds (pilot count, held-out rules check, follow-up kill criterion) compares the corpus against the inventory, never the inventory against real customer configs, so the gap goes unmeasured until production. The production safety net (point 11, "reads each customer's live config") has no design I can find.

SPECIFIC ISSUES:
- The frozen inventory (one test account, single-toggle settings states, ADR:40) represents the configs real customers serve, and "the pilot measures that" (ADR:78). — Circular: the pilot counts "captures the slice needed beyond the corpus" (ADR:44), but slices are scoped from inventory rows, so an unlisted setting can never appear as a missing capture; the kill criterion "follow-up captures keep adding missing states" (ADR:87) has the same blind spot; the held-out check (ADR:44: second-day loads plus "one extra setup") tests rules inside the inventory, not inventory completeness. Real Google/Meta configs are shaped by data, not just switches: several destinations per tag (the reference site loads separate AW/DC/G `gtag/js?id=` runtimes, refinement-todo:1366-1370), linker domain lists, enhanced-conversion/user-provided-data selector rules, server-side or tag-gateway endpoints, Meta per-pixel plugin sets in `signals/config`, and setting combinations. Toggling one setting at a time on one account covers none of the combinations or value shapes; point 3's "read-only probe or vendor docs" only supplies candidate setting names and measures nothing. If the premise fails, ADR-0040's "full parity" quietly shrinks to a curated subset, first signalled after every slice is built, as point-11 diagnostics at the first real adopter. Point 11 is itself unsupported: a Scout search across docs/ and connectors for "live config", "remote config(uration)" and "signals/config" found only the adopter-supplied `boot(config)` path (connectors/google-ads/connector.js, adapters/eds/index.js); nothing parses a customer's served gtag.js build or `signals/config`. If that cannot be built, the diagnostic net does not exist and out-of-inventory customers silently diverge, which ADR-0040 item 8 forbids. Fix: (1) before the freeze, run a read-only probe of served `gtag/js?id=` and `signals/config/<pixel>` for a sample of public sites, including erp.intuit.com (already probed via `rig:erp-waterfall`); (2) diff the config shapes and setting combinations found against the candidate inventory; (3) make the out-of-inventory rate the completeness metric and a kill criterion, replacing "the pilot measures that"; (4) add at least one representative combined-settings state; (5) cite a design for point 11's live-config reading or scope it explicitly as a slice or ADR item.
- Agents can do the capture session, with the owner as a rare fallback (ADR:38, ADR:46). — No automated, actually delivered native Meta beacon with vendor responses has ever been recorded: spec 060 — headless sent no beacon, and headed 058-02 was an attempt under no-send controls; 063 — the HTTP-200 live sends came from the chamber, not native code, and receipt was never observed; R-014:1121-1150 — HeadlessChrome classed as bot traffic, and headed Chromium still discloses automation. If headed automation is filtered or suppressed, every Meta state falls through to the owner normal-browser try, and the variant matrix (base, repeat, viewport, locale/timezone, referrer, fresh/returning, EEA and non-EEA) becomes owner labour; point 7 also blocks every Meta slice until it is finished, and the owner was unavailable twice in R-014. The kill criteria cover "cannot be acquired" but not "acquired only by the owner", and the phase has no time limit. Fix: add a kill criterion or time-box for an owner-only capture route; let slices start on states already captured instead of waiting for the whole inventory.
```

## Owner override (2026-11-12)

Round 9, owner decision: "Fold round 9's fixes and run one more round; if it still needs changes, its findings become checks in the vendor inventory specs and you accept with a recorded override of jig's frame-critique gate".

Acceptance, owner decision: "Accept and land it: the session adds the carried checks, records your override, flips ADR-0061 to Accepted and pushes it to main".

Round 10 returned needs-changes. Acceptance bypasses the frame-critique gate on purpose (ADR-0011's deliberateness signal). Round 10's findings are carried as the checks listed in ADR-0061's "Checks carried into the inventory specs".
