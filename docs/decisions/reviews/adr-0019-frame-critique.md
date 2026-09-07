---
adr: 0019
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-07T23:58:44Z
prompt_source: review.py frame-critique docs/decisions/adr-0019-ga4-gtag-protocol-connector.md
---

Frame-critique verdict: **pass** (on ADR-0019 as drafted at commit `a2717e2`; the two non-blocking notes below were then applied as wording-precision fixes without changing the frame — the decision is still Option B, the additive off-thread `/g/collect` gtag-protocol connector).

Reviewer: independent `jig:reviewer` subagent, fresh context, read-only (Read/Glob/Grep).

**Highest-risk load-bearing assumption:** "MP-only egress is unfit for a public-web GA4 rewire, settled capture-independently by the `api_secret` blocker, so committing now to an additive `/g/collect` gtag-protocol connector is correct."

**Verdict reasoning:** The frame survives its strongest attack. The assumption is grounded in-repo, and the decision is over-determined independently of the `api_secret` argument — the container emits `/g/collect` and ADR-0018 defines GA4 parity as same-protocol fidelity, so speaking the container's own protocol is the natural path regardless of the secret. Every genuinely unconfirmed element (the `/g/collect` wire shape, off-thread reproducibility, cookie-write / session-writer governance, coexistence policy) is explicitly labelled documented-not-measured and gated behind kill criteria scoped to MVP7 — disclosed residuals, not smuggled assumptions.

**Grounding the reviewer independently confirmed:**
- `api_secret` in browser-side config — `connectors/ga4/map.js:82-84` (`mpUrl` always appends `&api_secret=`); `contracts/instrumentation-config.schema.json:47`.
- MP `consent` carries only the two data-use purposes — `connectors/ga4/consent.js:11-14,27`.
- Per-page session minting on a gtag-free MPA — `connectors/ga4/cookies.js:118-119,179` (`parseGaSessionId(...) ?? String(bootSeconds)`).
- Off-thread governed GET beacon is a shipped capability — `connectors/pixel/connector.js:149` (`{ url, method: "GET" }`); `core/airlock.js:48-50`.
- Additive path leaves the frozen MP schema (surface 1) untouched — `adr-0017:60-61`.
- ADR-0018 GA4 kill-criterion exits (a)/(b) — `adr-0018:197`.

**Two non-blocking notes (both applied to the ADR as wording-precision fixes, frame unchanged):**
1. **Un-named alternative — a first-party server-side MP proxy** (server-side tagging) would also close the `api_secret` exposure without a new client-side connector. Ruled out by airlock's client-side / off-main-thread frame (no server tier), so a note, not a defeater. → Added as **Option D** and explicitly ruled out by airlock's architecture.
2. **Overclaim — "closes all three MP gaps _by construction_"** understates the work: speaking `/g/collect` yields the *fields* by construction, but the session (`sid`/`sct`/`seg`) and Consent-Mode (`gcs`/`gcd`) *values* are computed by gtag.js's stateful on-page runtime; the connector must reimplement that state machine and become a `_ga_<stream>` writer — "not another pixel vendor". Already caught by the ADR's own open question + kill criterion #1, so non-blocking. → **Recommended Decision, Option B pros/cons, and Consequences** reworded to size the stateful connector work honestly for the MVP7 connector spec.

**Carried into the MVP7 connector spec (from the notes):** size the session / Consent-Mode state machine + `_ga_<stream>` cookie-write governance as real implementation work (not a GET-beacon config); confirm the `/g/collect` wire shape on a redacted R5 capture before freezing it.
