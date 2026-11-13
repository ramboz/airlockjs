---
status: ABANDONED
dependencies: [059-03]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

> **Rescoped 2026-11 by [spec 065](../065-google-ads-parity-inventory/spec.md) (ADR-0061).** Replaced by G4 in spec 065 section 9. History kept; criteria are inputs to the new slice file.

## Slice 059-04 - Returning and linked journeys

**Goal:** A visitor's permitted advertising context survives return visits and
owned checkout navigation without native boot, unsafe storage or lost form behavior.

**DoR:**
- [ ] 059-03 is DONE; C1-C3 and 058 references qualify storage/link/navigation cases.
- [ ] Parent reconciles current read-only-cookie guidance under accepted authority
      and reviews precise key/domain/path/purpose/lifetime operations against ADR-0017.
- [ ] Supply owned domain peers and approved linker/passthrough configuration;
      pin native cookie/local-storage schemas, braid precedence and linker validity.
- [ ] Review synchronous navigation-time mediation and deadline budget without
      a general DOM proxy, ambient storage or arbitrary external decoration.

**Acceptance Criteria:**

1. First chamber-only and returning chamber-only visitors create/use only the
   verified permitted native-equivalent state; no native seed/bootstrap or
   general identity-resolution store. Test independently created native/chamber
   continuity and additional controlled preseed cases.
2. gclid/wbraid/gbraid, supported companion parameters, absent/conflicting/
   malformed input, _gcl cookie families and applicable local storage preserve
   native precedence, derivation, rotation and joins. No fake click identifier
   is sent live; controlled malformed fixtures remain no-send.
3. Domain/path/prefix, expiration/update/clearing and browser caps match pinned
   native behavior. Consent revocation/denial, unavailable cookies versus local
   storage, partitioning and partially cleared state are distinguished. A supplied
   _gcl_au suffix relation cannot substitute for creation/read/lifetime evidence.
4. Native-to-chamber and chamber-to-native cross-domain navigation interoperates:
   approved domains, _gl creation/validation/expiry, accept_incoming and rejected/
   tampered inputs restore exactly the permitted state. A chamber self-round-trip
   alone cannot qualify a private native token format.
5. Link clicks, immediate navigation, GET/POST forms, existing query/fragment/
   fields, redirect hops and return navigation preserve application handlers
   and native decoration. decorate_forms and url_position combinations use
   actual supported behavior; no assumed fragment-form compatibility.
6. Same-domain denied-storage url_passthrough obeys native prerequisites and
   redaction interactions, preserving only permitted click context across pages.
   Unrelated-domain links receive no unauthorized state. Do not equate URL
   passthrough with unrestricted cross-domain linking.
7. Wrong token, lost cookie, altered lifetime/scope, duplicate decoration,
   unrelated target, stale consent, missed navigation deadline and lost form
   data all produce failed controls. Complete C1 evidence includes host state,
   requests/responses and actual worker ownership, not only a decoded token.
8. Operator diagnostics report denied/unavailable storage, invalid incoming
   tokens and incomplete continuity without exposing identifiers. All browser
   cohorts and host operations meet C3; unresolved capabilities block readiness,
   not the native feature requirement.

**DoD:**
- [ ] Positive/negative native interoperability and first/returning cases are
      retained; targeted tests and applicable lint pass.
- [ ] Compliance, craft, architecture and reconciliation reviews pass.
- [ ] Storage/linker operator guidance records exact scopes, consent and
      reference limitations with no ambient grants or private identifiers.
- [ ] Deviation/reconciliation records cover authority and public-contract impact.

**Anti-horizontal-phasing check:** The adopter gets a complete return/checkout
journey with working links/forms and attributable context, not a cookie parser.

## Assumptions

- Unverified: native token, braid and storage schemas/lifetimes are fully
  discriminable; documentation does not provide a complete stable codec.
- Unverified: bounded synchronous decoration and governed vendor-state operations
  can fit the reconciled authority, stable core and measured deadlines.

### Close-out (post-DONE)

- [ ] Parent checks storage/linker guidance, board and durable invariants.

### Deviation log (after reconciliation)

Not implemented; no identity capability or cookie policy is approved by this draft.

### Reconciliation sweep

Pending implementation; existing vision and Accepted core records are untouched.
