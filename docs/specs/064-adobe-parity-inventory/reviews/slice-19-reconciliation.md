---
slice: 064-19 — B3: Command coverage and callbacks
pass: reconciliation
round: 1
verdict: changes-requested
reviewer: independent reviewer (Claude Opus 5.5, Copilot general-purpose sub-agent)
reviewed_at: 2026-11-20T16:52:00Z
prompt_source: review prompt, slice 064-19 (commits 6141cc57, dd909633)
---

# 064-19 reconciliation — Round 1

**Verdict: changes requested. 1 high, 3 medium, 3 low.**

Consistent: board row is `IN_PROGRESS` (`docs/specs/README.md:204`), matching the slice
frontmatter. `spec.md:62` mirrors the AC2 table. Dependents 064-20 and 064-22 are named in the
slice hand-off notes.

## Findings

- **R1 — High — `slice-19-b3-command-coverage.md:65-67`, `docs/refinement-todo.md:384`.**
  "067-03 residual: resolved ... Decision: accept" contradicts ADR-0062 point 4
  (`adr-0062-stock-default-parity.md:49`: "'Hold' means hold and flush on grant") and this
  slice's own AC4, which says the hold "depends on ... pending hold-and-flush slices". The slice
  proves the drop is reachable (`test/adobe-b3-commands.test.js:189-207`): with a stale Alloy
  cookie "in" and page consent pending, the first page view is held, then lost on grant. Stock
  sends it. That is a parity loss outside the pre-consent-hold excuse (point 5). The refinement
  entry it closes is an owner-level open question from the 020-02 architecture review; an
  implementation slice cannot accept it on the owner's behalf. Fix: mark the residual
  "characterized, owner decision pending" (not "resolved"), keep the refinement entry open with
  the new evidence, and either file the hold-and-flush follow-up or get the owner's explicit
  acceptance recorded as an ADR-0062 amendment.
- **R2 — Medium — `slice-19-b3-command-coverage.md:62`.** The `s6-out` delta (opt-out
  `set-consent` held at the seal, never reaching Adobe) is "carried for the owner", but nothing
  carries it: no entry in `docs/refinement-todo.md`, `docs/inbox.md` or the spec 064 open items.
  It is also mislabeled as "the ADR-0062 consent-hold exception working as designed" (see
  compliance M2: point 5 only excuses the pre-consent hold). The privacy angle cuts the other way
  from the hold's intent: a withdrawal of consent is not passed on to the vendor's consent
  record. Add a refinement-todo entry with the evidence (`test:157-165`), the two options
  (forward `privacy/set-consent` with `collect:n` through a seam exemption, or accept and amend
  ADR-0062), and a resolution trigger.
- **R3 — Medium — `slice-19-b3-command-coverage.md:50-56` vs `spec.md:41-49`.** The slice
  reclassifies rows without updating the frozen 2.1 table: row 3 `sendEvent` (spec `mediated`,
  slice `worker-native`), row 5 `getIdentity` (spec `mediated`, slice `worker-native`), row 8
  `setConsent` (spec `mediated`, slice `worker-native + seam hold`), row 12 (spec
  `worker-native`, AC2 note `mediated as data`). ADR-0061 point 3 freezes the table, so a class
  change needs an explicit amendment line in `spec.md`, not a silent divergence. Spec 2.2 also
  says "every row gets a one-line fixture reference"; the references live only in the slice.
- **R4 — Medium — `slice-19-b3-command-coverage.md:44-56`.** The results do not record that rows
  4-7 and 9 are reachable only through the rig (compliance H1). 064-20, 064-21 (aem-martech) and
  the B8 compatibility report will cite this table; without a "host surface: none" note they
  will inherit a parity claim the product does not have.
- **R5 — Low — `slice-19-b3-command-coverage.md:19`.** AC4 cites "spec 067 s8 check 11". Check 11
  is "Sister-spec drift". The consent backstop is check 2 ("Alloy pending today",
  `docs/specs/067-*/spec.md`, section 8). Fix the reference.
- **R6 — Low — `slice-19-b3-command-coverage.md:58`.** "Rows 1 and 2 ... are B1/B2's". Spec 2.1
  assigns both to B1.
- **R7 — Low — `slice-19-b3-command-coverage.md:67`.** "a seam hold-and-flush for Alloy needs a
  replay decouple that does not exist" is asserted without a pointer. Name the blocking code
  (`core/wrapped-sdk-host.js` held-request path) so the follow-up has a starting point.

## AC2 dispositions: soundness

- `getPlayerDetails`, `onStreamResponse`: sound. The cadence and streaming arguments hold, and
  both are routed to 064-22.
- `filterClickProperties`, `onBeforeLinkClickSend`: sound, given the chamber forces
  `clickCollectionEnabled:false`.
- `onBeforeEventSend`: sound as "incompatible as a function", but the stated equivalent is
  partial. Stock's callback sees the final event, including Alloy-added context
  (`implementationDetails`, `device`, `environment`, `identityMap`) and can cancel. Main-thread
  shaping of `params.xdm` cannot touch Alloy-added fields. Say "partial equivalent;
  `payloadDenylist` for Alloy-added fields".
- `subscribeRulesetItems.callback`: not yet a disposition (compliance M3). It depends on a
  delivery path and a command surface that do not exist.
