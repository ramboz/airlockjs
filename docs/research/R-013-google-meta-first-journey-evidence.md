---
status: OPEN
topic: A bounded native evidence route for the first Google and Meta journeys
created: 2026-11-02
related:
  - ../releases/google-meta-work-plan.md
  - ../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md
  - ../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md
---

# R-013: First-journey native evidence plan

We have local worker journeys and partial native observations. We still need a
credible route to a same-input native/replacement comparison. This brief asks
for that route before more capture infrastructure is built.

**Planning only. Research execution has not started.** The owner will review
the [work plan](../releases/google-meta-work-plan.md) and commission any session.

## Question

What is the smallest safe, independently reviewable way to obtain the complete
reference needed for one Meta PageView and one Google direct conversion on
owned resources, using the existing evidence and tools where they fit?

## Retained sources and observations

- [058](../specs/058-native-tag-evaluation-qualification/spec.md) qualifies
  specific local, attempted-request and comparison layers. Aborted attempts do
  not supply actual vendor responses or cookie behavior.
- [059-01](../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md)
  and [060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md)
  already own the complete first journeys. Their readiness remains open.
- [059-20](../specs/059-google-ads-full-compatibility/slice-20-local-browser-conversion.md)
  and [060-14](../specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md)
  retain actual local browser execution, with explicit limitations.
- [The Meta reference packet](../specs/060-meta-pixel-full-compatibility/meta-native-reference-plan.md)
  and [059-18](../specs/059-google-ads-full-compatibility/slice-18-additional-meta-authority.md)
  retain the native-acquisition blockers, consumed lineage and historical
  ownership unknowns. This brief does not resolve or bypass them.

These are starting records, not newly checked account facts or current run
qualification.

## Proposed research sessions

One read-only session per vendor, at most 60 active minutes each. Start from
the records above and the public documentation. Use private resources only if
the owner explicitly supplies and permits them for that assignment. No browser,
SDK execution, measurement request, account change, deployment or launcher
repair is part of these sessions.

Each session returns one case card:

| Required entry | Result expected |
|---|---|
| Consumer | Exact first-journey acceptance criteria the reference will satisfy. |
| Case | One explicit command sequence, intended page action and consent timeline. |
| Equivalent inputs | Required native/replacement configuration, browser and storage state; generated-value comparison rules still unknown. |
| Evidence | What is already retained, what is missing and which layer each item establishes. |
| Collection route | Reuse of an existing capture path, an owner-operated capture, or a separately reviewed bounded supervised path. Explain the rejected alternatives. |
| Safety and authority | Exact resource ownership, stop/cleanup responsibilities, allowed destinations, finite counts/window and approval still required. Use symbolic handles, not private IDs. |
| Acceptance | Complete request/response/host-effect accounting, a positive reference and loss/value/extra-request controls. Missing observations remain inconclusive. |
| Exit | A reviewable recommended route or one precise blocker and the owner action needed. |

Do not silently expand a no-send reference into a delivered-response experiment.
Intuit/customer production remains example-only with no synthetic submissions.
Delivered response and product evidence must use separately approved owned
resources.

## Options to evaluate

| Route | Benefit | Limitation to resolve |
|---|---|---|
| Reuse retained originals | No new execution; fastest if the exact evidence exists. | Retained attempts and historical smokes may not contain complete responses or equivalent state. |
| Owner-operated capture | Can avoid building another unattended execution system. | Still needs permitted inputs, complete observation, provenance and an approved stop/cleanup plan. It is not an implicit safety exception. |
| Existing bounded supervised path | Could reuse prior tools and case limits. | Current source/browser/ownership gates and relevant decisions must actually fit the case. |

A new general runner is not an output of this research. If no route fits,
return BLOCKED rather than inventing another prerequisite implementation.

## Open questions

- Which current owned-resource confirmations and legitimate product observations
  can the owner supply for each first case?
- Can an existing or owner-operated route supply the complete first-case
  reference within its safety envelope?
- Which first-case numerical performance limits can be grounded in the retained
  baseline, and which measurements need later approval?

## Conclusion

Pending research and owner review. No route has been selected or executed.

Promoted to: pending; implementation stays with 059-01 and 060-01. Use 059-15/18
for any explicitly approved native-acquisition changes, not a duplicate tool spec.
