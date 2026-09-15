---
adr: 0027
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2-round)
reviewed_at: 2026-09-15T01:53:46Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/fc-adr-0027-v2.txt
---

# Frame-critique — ADR-0027 · VERDICT: pass (after 1 needs-changes → schema fix landed)
The ADR's load-bearing frame (composite is the SOLE OneTrust subscriber BY CONSTRUCTION — don't-thread + strip — not via the identity-keyed driver guard which cannot express precedence) is fully grounded in landed code: composite.setConsent fans to every member (adapters/eds/index.js:1828); the guard is first-writer-wins by object identity (drivers/consent/onetrust.js:248-256) so Option A's precedence-via-guard is genuinely unachievable; sub-boots run before createComposite (index.js:2274-2291), composite subscription wired after (2303-2310); the strip discards per-connector onetrust (index.js:2129); deps adr-0007/0023/0026 apt.
Round 1 needs-changes (timing race): the ADR's Option-B con claimed the schema "enumerates onetrust — done, with a cross-check" while the schema fix was still in flight. Now TRUE: schema top-level onetrust property + onetrustConfig $def (contracts/instrumentation-config.schema.json:30,33-49); top-level-drift cross-check (test/instrumentation-config-contract.test.js:441-449). Round 2: pass.
Metadata nit (self-resolving): frontmatter status:Proposed vs body Accepted — flips to Accepted on adr.py accept (below).
