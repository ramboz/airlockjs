---
slice: 013-01 — real Edge round-trip + mint-recognizability
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T14:10:32Z
prompt_source: review.py pr-review docs/specs/013-mvp3-live-alloy-reprobe/spec.md 013-01 --richer-skill none <deliverables>
substrate: non-interactive
---

## Craft (pr-review) pass — slice 013-01

**Round 1 verdict: needs-changes** (general-purpose reviewer, base craft rubric). Two
should-fix on the highest-value axes + nits; all substantive applied → resolved.

- **[1 redaction completeness — should-fix → FIXED]** Real Target `eventToken`/`correlationID`
  survived the key-allowlist with zero shape-fidelity cost, and the leak assertion was a
  closed-set check (only the input secrets it already knew — structurally blind to
  server-assigned values). **Fix:** deny-by-default redaction + an open-set harvest of
  server-assigned id-like values into the scrub, so the leak assertion now catches assigned
  values, not just enumerated inputs.
- **[2 vacuous extract test — should-fix → FIXED]** ECID + CORE ids were both redacted to the
  same `"REDACTED"`, so `expect(ecid).toBeTruthy()` couldn't distinguish "extractor selected the
  ECID entry" from "returned any id" — it failed only on a total-null regression. **Fix:**
  namespace-tagged placeholders (`REDACTED_ECID` vs `REDACTED_CORE`) + the test now asserts
  `toBe("REDACTED_ECID")`, proving ECID-path-correctness.
- **[3b fixture-write unconditional — nit → FIXED]** The committed fixture write was gated only
  by the leak-check, so a future FAILED/leak-clean run could clobber the good regression.
  **Fix:** the fixture write is now gated on `CONFIRMED`.
- **[3 FAILED-honesty — strength]** A FAILED verdict is genuinely reachable + honestly reported
  (`CONFIRMED = edgeOk && isMint && ecid`; `exit(CONFIRMED?0:1)`; non-200/throw/non-JSON all →
  FAILED); no hang risk (timeout-bounded `waitForFunction`; `server.close()` in `finally`).
- **[3a proxy headers — nit, left]** The proxy forwards only `content-type` (auth is the query
  `configId`; 200 returned) — not byte-faithful but not a correctness issue; left as-is.
- **[5 dead keyHint param — nit → resolved]** The old `structuralRedact`'s unused `keyHint` is
  gone; the new `redactByDefault` genuinely reads the key to decide keep-vs-redact.
- **[4 reuse/minimality — strength]** Clean minimal variant of `alloy-chamber-harness.html`
  (egress-probe dropped; config-from-server keeps creds out of the committed file); real ids only
  ever hit gitignored `rig/out/`.

### Net
Control flow, FAILED-honesty, and creds-isolation were solid; the two should-fixes (redaction
completeness + a path-correctness test) are closed by the deny-by-default inversion and the
namespace-tagged placeholders — a clean pass after the fixes.
