---
slice: 013-01 — real Edge round-trip + mint-recognizability
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T14:10:31Z
prompt_source: review.py implementation docs/specs/013-mvp3-live-alloy-reprobe/spec.md 013-01 <deliverables>
---

## Compliance (implementation) review — slice 013-01

**Round 1 verdict: needs-changes** (general-purpose reviewer). One BLOCKING finding, one
minor; all applied → resolved.

- **[DoD "no live identifiers" — BLOCKING → FIXED]** The committed fixture leaked two REAL
  Target decision values — `characteristics.eventToken` + `scopeDetails.correlationID` —
  because the redactor was a fixed key-ALLOWLIST (`SENSITIVE_KEYS`) and the leak-check was
  closed-set (only the enumerated input secrets), so no scan could catch server-*assigned*
  values. **Fix:** inverted to **deny-by-default** redaction (every captured leaf value scrubbed
  unless its key is a curated shape token; identity ids tagged `REDACTED_<namespace>`), plus an
  open-set backstop that harvests server-assigned id-like values into the scrub. Re-verified:
  `eventToken`/`correlationID` now `REDACTED`; enumerated secrets + harvested values absent.
- **[DoD no-ids — minor → addressed]** `locationHint` hints (`41`/`12`/`ind1`) were kept
  verbatim (low-sensitivity cluster hints). Deny-by-default now redacts them too; the
  locationHint:result *shape* (scopes) survives via the kept `scope` token.
- **[AC1] PASS** — real POST proxied to `adobedc.demdex.net` (no minting-stub in the live path),
  stock alloy 2.35.0 chamber reused, `edge_status` 200, jar write-back evidenced; raw capture
  gitignored.
- **[AC2] PASS** — creds-free replay runs the recognizer+extractor against the committed fixture
  (5 green); catches drift (handle-type/namespace-code rename → red); non-vacuous (real negative
  control; `alloy-xdm-mint.js` untouched since 012-02).
- **[AC4 / DoD floor] PASS** — CONFIRMED verdict emitted + recorded in Findings/Outcome +
  refinement-todo OQ9; floor (i)+(ii)+(iii) genuinely met; AC3 method-gap disclosed honestly.
- **[jig conventions] PASS** — parallel-and-minimal (core/ + connectors/ untouched); new rig
  harness + test + fixture reusing 012's worker/recognizer.

### Net
Compliance core was strong (genuinely real Edge, drift-catching creds-free regression, real
recorded verdict); the one blocking redaction hole is closed by the deny-by-default inversion,
and the "leak-check clean" claim is re-scoped honestly.
