---
slice: 048-03 — `onetrust` as a `boot(config)` governance field → composite consent fan-out (end-to-end accept-flow)
pass: arch
verdict: pass
reviewer: jig:reviewer (arch, re-run)
reviewed_at: 2026-09-15T01:55:05Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/arch-048-03-v2.txt
substrate: non-interactive
---

# Arch — 048-03 · VERDICT: pass (re-run after schema fix)
Prior [blocker] (pinned schema rejected config.onetrust) FIXED + verified: schema top-level onetrust property + $defs/onetrustConfig (groupPurposeMap required, activeGroups? optional; win/onetrust DI seams intentionally unpinned — non-serializable test seams); accepts valid / rejects malformed; a top-level governance-field cross-check now guards the drift; validateConfig gives a loud onetrust shape-check. Governance-surface change is additive/back-compat (schema is the experimental NOT-frozen surface, no ADR-0017 amendment). Precedence-by-construction sound (strip + never-thread + single post-createComposite subscription), mutation-provable.
Nit (log, non-blocking): the new governance-field cross-check is ONE-SIDED (hand-maintained BOOT_CONFIG_TOP_LEVEL_FIELDS list vs schema — can't catch a field added to boot() but not the list; disclosed in-comment). Consider exporting the field set from the adapter to make it two-sided later.
By-design note (deviation log): $defs/onetrustConfig additionalProperties:false excludes the win/onetrust DI seams the runtime reads — defensible (test-only, non-serializable, absent from any real JSON config).
ADR recommended → written + accepted: ADR-0027 (composite-vs-per-connector precedence, rejected per-connector-via-guard alternative).
