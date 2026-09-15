---
slice: 049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T19:30:37Z
prompt_source: review.py arch-review docs/specs/049-native-tag-suppressor/spec.md runtime- --richer-skill arch-review
substrate: non-interactive
---

Arch pass on slice **049-01** — reviewer `jig:reviewer`, richer-skill `arch-review`; two rounds.

**Round 1 (verdict needs-changes):** core architecture sound (correctly homed in `adapters/eds/` per the code-home
rule; the global prototype-patch is reversible — marker-guarded idempotent install + `uninstall` restoring saved natives;
safe against non-migrated scripts by construction; clean pure/DOM-free testability seam). One **[blocker]**: the diagnostic
record nested a `matcher` object (with nested `query`), violating spec-028's collector FLAT-RECORD INVARIANT
(`core/inspector/collector.js:53-60`) — wiring it into a 028 collector (the AC5-invited composition) would make the
suppressor the first nested-value emitter and alias `matcher.query` across the ring buffer. Three [nit]s (string-injection
absent from the ADR-0030 kill criterion; `evaluateCandidate` hot-path overhead unmeasured; DocumentFragment/`append`-on-
Element-prototype-only refinement) → routed to the deviation log. Two [strength]s (the carve-out precedence pinned in unit +
rig; the dual network-0 + sentinel rig under a byte-identical CSP).

**Round 2 (verdict PASS):** the flat-record blocker is resolved correctly — `suppressionDiagnostic` now returns a
primitive-only record `{ level, kind, disposition, url, matcherHost, matcherPathname, matcherQuery(string) }`, no nested
value, no aliasing spread; `diagnose` passes the flat return straight to `onDiagnostic`. No regression from the
compile-once refactor (state-field rename consistently wired across install/evaluate/uninstall; the AC3 carve-out
precedence survived extraction into `shouldSuppressCompiled`; null-matcher safety preserved). The hot-path-overhead nit is
now addressed in code (matchers compile once per install). Reconciliation note: the flat diagnostic shape is the INITIAL
public contract (049-01 first ships the suppressor; nothing broken) — record it in the deviation log; `matcherQuery` is a
human-facing `&`-joined label (fine for AC5).

**VERDICT: pass.**
