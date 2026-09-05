---
slice: 035-01 — name-scope + name-validate the live alloy cookie grant
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (3 rounds: retarget r1, seam-grounding r2, pass r3)
reviewed_at: 2026-09-05T19:52:40Z
prompt_source: review.py frame-critique docs/specs/035-cookie-grant-wrapper/spec.md 035-01 <spec> <slice>
---

VERDICT: pass (round 3)

## Frame-critique trail (3 rounds)

The frame-critique fired because `frame_review: true` — the grounding rested on load-bearing
assumptions about a security surface. It took three adversarial rounds to land a sound frame:

**Round 1 — needs-changes (retarget).** The first draft pinned both cookie "gaps" on
`createCookieCapability` (`adapters/eds/cookies.js`) and proposed a `scopeCookieCapability(cap,
grantedNames)` wrapper over its `{get,set}`. Verified against source: that surface is **host-side
only, granted to NO connector** (its own docstring: "no connector grant flow is exercised yet, and
the chamber stays cookie-free"; used host-side for GA4-ctx sourcing at `index.js:391-395`). A
`{get,set}` wrapper there hardens a surface no connector uses, and the most serious gap — the
whole-jar READ leak — was pinned by no AC. Retargeted to the real live alloy grant seams.

**Round 2 — needs-changes (seam grounding).** Approach confirmed sound, but two grounding hints
were factually wrong (verified against source): (a) `host.init` (`wrapped-sdk-host.js:499-501`) only
`postMessage`s into the untrusted worker — the write-back handler (`:464-471`) enforces off the
`createWrappedSdkHost({...})` construction closure, so `grantedCookieNames` belongs there
(alongside `configIntegrity`/`endpointCeiling`, `index.js:1046-1063`), NOT threaded through
`host.init`; (b) the declared cookie set is NOT reachable on main today (`index.js:38` imports only
`ALLOY_INTERACT_ENDPOINT`; `createAlloyConnector` + its `capabilities.cookies` manifest is
worker-only), so AC3's single-source-of-truth needs a new static `ALLOY_COOKIE_NAMES` export from
`connector.js`. Both corrected.

**Round 3 — PASS.** Both seam corrections verified correct against source (the write-scope set
truly belongs as a `createWrappedSdkHost({...})` construction option; the manifest is genuinely
worker-only + purely declarative, so a static export is a clean SSOT). AC5's highest-risk
assumption — "a scoped seed still round-trips alloy" — is correctly de-risked as a PROVE obligation
(`readSync()` returns a whole-jar string alloy parses internally; the `com.adobe.alloy.getTld` probe
and all identity names are declared, so they survive both the seed filter and the write-back scope),
NOT asserted. No new load-bearing assumption survives.

## Non-blocking correction applied at pass

The round-3 reviewer flagged one real defect: `spec.md`'s "Grounded" declared-prefix list named
`_ga_` as an alloy prefix, but alloy's real manifest (`connector.js:117`) has no `_ga_` (that is a
GA4 cookie, and `_ga` is precisely AC1's filtered-out example). Non-blocking (the ACs derive the
SSOT from the manifest, not the prose, so the typo cannot propagate through AC3's export path), but
in a default-deny security spec an errant prefix in the grounded-claims list is worth correcting —
fixed to match `connector.js:117` before recording this pass.

## Frame (as ratified)

Harden the ONE live connector cookie grant (alloy's), host-side / on the trusted seam, on both
halves of the boundary: (1) READ scope — `scopeSeedCookies(jar, grantedNames)` filters the boot seed
to the connector's declared names BEFORE it crosses into the worker (closes the live whole-jar READ
leak); (2) WRITE scope + name-validation — on the `cookie-writeback` seam, validate the cookie name
(RFC 6265 token) + scope it to the declared names (closes the live unvalidated/unscoped write). Both
enforce ADR-0006 `granted = declared ∩ allowed` for cookies. `createCookieCapability` `{get,set}`
wrapper + the `SecurityError`→null-identity rider are named follow-ons.
