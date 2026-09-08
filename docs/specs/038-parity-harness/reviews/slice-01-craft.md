---
slice: 038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T16:39:44Z
prompt_source: review.py craft docs/specs/038-parity-harness/spec.md 'Meta Pixel' <deliverables>
substrate: non-interactive
---

VERDICT: **pass** (independent `jig:reviewer`, read-only). Full capture→replay→oracle→report pipeline with clean vendor/pipeline separation; the oracle carries zero Meta-specific code (proven descriptor-driven by an unrelated "widgetco" descriptor). Verified against source: `meta.js` bare `value`/`currency`, `connector.js:149` GET array, `package.json` `parity:meta`, the committed fixture classifies green end-to-end, no vacuous deliverable-exercising tests.

Non-blocking [nit] findings (→ reconciliation log):
- [nit] redact.js:49 — scrubs only `id`/`_fbp`/`fbc`/`ud[...]`; every other field (notably `dl`, the full document-location URL) passes through. A real Meta `/tr` `dl` routinely carries `?fbclid=<live click id>` — the identifier `fbc` encodes — so the primitive scrubs the cookie form but leaves the raw click id in `dl`; docstring (redact.js:11-12) "redaction targets identity only" overclaims. AC1's enumerated shapes are met + the committed fixture's `dl` is synthetic (no block), but **a genuine hole to close before anyone redacts an actual local capture.**
- [nit] oracle.js:95 — the `wireNameMap[name] || name` branch is delivered but no shipped descriptor/test uses a non-empty map → the one delivered branch with no coverage.
- [nit] oracle.js:19-37 — `ParityDescriptor` typedef omits `endpoint` + `deriveLogicalEvent` (consumed by report.js:38 / run-meta.mjs:27).
- [nit] test/parity-meta.test.js:42-48 — the "OLD loader pattern doesn't match" case reconstructs the matcher inline rather than importing `capture-patterns.js` (asserts a grounding fact, exercises none of the deliverable).

Strengths: present-but-unequal is always `divergent` even for gap-map members (correct, non-obvious, tested); `REVERSE_EVENT_MAP` derived from the shipped connector (anti-drift); AC6 negative proven mutate→red end-to-end via a real `execFileSync` exit code; belt-and-suspenders stringify+substring leak scan.
Reconciliation: log the AC4(b) `id`-vs-`currency` deviation (sound); `cd[...]` classified as owned gaps ("026 wire-fidelity"), no `connectors/**` touched; **carry the redaction `dl`/`fbclid` gap forward as a follow-up before real local captures are redacted.**
