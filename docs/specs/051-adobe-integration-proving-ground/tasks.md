# Tasks: Adobe integration proving ground

> 051-01 implementation is hermetically validated (278 preflight tests plus 36 frozen-core tests).
> Independent implementation reviews passed; reconciliation remains pending. The parent-owned real
> preflight returned unverified, and R-012 distinguishes that result from hermetic tests and
> prior ad-hoc access/setup evidence.
> Only spec 051 is sliced; specs 052-057 remain outlines. Owner execution grant: strictly below
> 10,000 credits overall; 051-03 separately eight active hours. No boxes clear from this grant.

## 051-01 — read-only access preflight

- [x] Independently review implementation compliance/craft/architecture against the reviewed v1
      private input/public report and evidence contract (frame/input review already passed);
      confirm required/optional preparation checks do not clear later live/write gates.
- [x] Confirm direct `ADOBE_CREDENTIAL_FILE` handoff for the uppercase Adobe export, exact org/
      company/Target/site selectors and scoped owner evidence. Parent alone normalizes private
      historical evidence, retaining original timestamps; renew stale observations honestly.
- [x] Review pinned official schemas and every allowlisted request/media type, including the fixed
      nonmutating Analytics totals POST and its partial/error response fixtures.
- [x] Write failing `adobe-preflight-cli`, `adobe-preflight-transport`, `adobe-preflight-evidence`
      suites through the CLI test-only transport seam; cover all named cases in 051-01, immutable
      shape, echoed/malformed/thrown-secret paths, unknown input, routing provenance/freshness,
      resource mismatches, redirects/mutations, stream/deadline limits and partial enumeration.
- [x] Implement the bounded preflight utility and operator instructions.
- [x] Record hermetic validation and the real unverified CLI result in R-012, without product claims.
- [x] Parent runs/records the real scoped preflight after input/frame review and scoped live approval;
      11 required checks ready, workspace snapshot unverified, stock baseline still blocked.
- [ ] Complete required reviews and reconciliation through Jig; do not infer baseline readiness.

Witnessed red-to-green commands/counts and the additional shared test harness are recorded in
[the slice implementation note](slice-01-access-preflight.md#implementationtdd-witness--2026-10-08).
No DoD/live/review completion or readiness for 051-02 is inferred.
Same-slice timestamp, approved dotted-scope and five compliance corrections are implemented with
witnessed red-to-green regressions. The parent reran live validation and implementation reviews
passed; the reconciliation/lifecycle gate must still clear.

## 051-02 — reproducible test setup and stock baseline

- [ ] Require a fresh real preparation report and owner-approved product-specific resource/mutation/
      deployment plan; optional unexercised diagnostics do not verify required live capabilities.
- [ ] Reuse/recheck R-012's exact owned saved activity/offers and UI routing evidence; do not recreate
      fixtures on friendly-name matches or retry the unavailable management API.
- [ ] Verify stock provenance pins (Alloy 2.31.1, ACDL 3.0.1); use the exact official Alloy artifact
      in both arms, not a claimed byte-identical reference copy. Pin deployment/configuration.
- [ ] Confirm receipt/report correlation and waiting windows before writing assertions.
- [ ] Write failing plan/apply/reuse/ownership-conflict/redaction/refusal tests.
- [ ] Implement supported setup APIs and precise guided steps where supported APIs are unavailable.
- [ ] Execute stock Analytics page/custom and Target HTML/display journeys with negative controls.
- [ ] Record redacted resource ownership, evidence and baseline measurements in R-012.
- [ ] Complete required reviews/reconciliation; leave unobserved product outcomes unfinished.

## 051-03 — bounded SDK compatibility decision

- [ ] Record the owner's granted eight-active-hour budget and overall credit ceiling; independently
      review representative probes and remaining readiness gates before execution.
- [ ] Enumerate/document the pinned public SDK and reference integration inventory.
- [ ] Probe callback/page-state, DOM and identity/consent/lifetime boundaries using the approved baseline.
- [ ] Attempt the complete chamber Analytics/Target/display journey without production fallback.
- [ ] Record established/divergent/incompatible/blocked results and measurement noise.
- [ ] Propose numeric build/release constraints and assign inventory rows to 052-057 or explicit decisions.
- [ ] Record proceed/reshape/stop and the required Outcome; request scope/ADR approval when necessary.
- [ ] Complete required reviews/reconciliation and audit dependent drafts before any readiness change.
