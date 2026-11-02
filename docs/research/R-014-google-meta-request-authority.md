---
status: OPEN
topic: Request integrity without main-thread mapping or an assumed Node sandbox
created: 2026-11-02
related:
  - ../releases/google-meta-work-plan.md
  - ../decisions/adr-0033-reframe-onto-full-google-meta-compatibility.md
  - ../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md
  - ../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md
---

# R-014: Google and Meta request authority

The prototypes can accept altered mediated requests from a fake worker. Some
Google checks address particular fields by repeating mapping on the host.
Before adding another worker, we need to decide what must be trusted and which
guarantee the product needs.

**Planning only. Research execution has not started.** Unfinished verifier code
is preserved in the paused vendor sessions. It is not the selected design.

## Question

What is the smallest request-authority design that preserves the required
data, destination and consent boundary while keeping mapping off the main
thread, and does it need an independent runtime verifier?

## Retained sources and observations

- [Meta characterization](../../test/meta-prototype-request-correlation.test.js)
  shows event, target and data substitution, added fields and duplicate events
  reaching a mock transport under selected modes. The separate consent
  controls still hold denied requests without replay.
- [Google characterization](../../test/google-ads-prototype-request-correlation.test.js)
  shows changed conversion fields reaching a mock transport under the tested
  default/remarketing modes without the separate suppression command.
- [Google prototype notes](../../connectors/google-ads/CONVERSION-PROTOTYPE.md)
  disclose the current host-side serialization and expected-field mapping.
- Both fixed Node bridges explicitly disclaim adversarial sandboxing:
  [Google](../../rig/google-ads-conversion-prototype-node.worker.mjs) and
  [Meta](../../rig/meta-pageview-prototype-node.worker.mjs). Withholding ambient
  `fetch` does not establish confinement of Node module capabilities.
- [ADR-0033](../decisions/adr-0033-reframe-onto-full-google-meta-compatibility.md)
  requires governed privileges and off-main-thread interpretation.

These observations concern local prototypes. They do not establish native
incompatibility, a production exploit or full browser confinement.

## Proposed research session

One source/design-only session, at most 90 active minutes. No implementation,
test execution, new worker, sandbox framework or browser acquisition. Do not
continue either vendor's paused draft.

The deliverable is a short design recommendation with:

1. The threat model: trusted host/loader/first-party mapper, separately
   untrusted modules, accidental protocol divergence and native correctness.
   State which guarantees are required for the real browser product and which
   the Node test bridge cannot supply.
2. Existing boundary reuse and concrete source citations. Identify whether the
   right fix is capability enforcement, first-party mapper tests, runtime
   semantic correspondence, or a combination. Do not assume every test oracle
   must become a runtime worker.
3. Alternatives for mapping, request authority and dispatch. Include startup,
   message-copy, memory and latency costs, not just field checks.
4. The chosen design's complete command/state/request/result protocol:
   initialization, agent/config/identity changes, zero requests, branch counts,
   order, failure, stale/duplicate replies, timeouts, disposal and readiness.
5. Live consent checks at each actual dispatch after any asynchronous wait.
   Revocation cannot recall a send; a later grant must not introduce unintended
   replay. Native consent semantics remain a separate evidence question.
6. A bounded later validation proposal with real-browser confinement separated
   from Node plumbing. Include mutation and fault controls and identify any
   authority or stable-contract decision needed before code.

Stop with a recommendation or one unresolved decision. Do not turn a missing
confinement proof into an automatic sandbox or verifier project.

## Alternatives to compare

| Alternative | Benefit | Cost or unresolved guarantee |
|---|---|---|
| Existing host-side expected-field checks | Simple for a small local schema. | Duplicates mapping on main; partial checks do not meet the architectural target. |
| Independent trusted verifier worker | Can compare complete mediated bytes without host mapping. | Adds a second stateful worker, identity/lifecycle/copy costs and common-mapper failure. Does not confine malicious Node code. |
| Trusted mapping authority with mediated host operations | Gives request construction an explicit trusted owner. | Needs a clear isolation model and a decision about which code may request data and egress. |
| Browser capability enforcement plus independent evaluation | Could keep runtime smaller if semantic correspondence is a test obligation. | Must establish the actual browser boundary and why its guarantees satisfy the first journeys. An endpoint ceiling alone does not bind event values. |

## Open questions

- Which semantic integrity obligations belong at runtime versus in the
  independent native/replacement evaluator?
- Can the required browser boundary be met without duplicating vendor mapping
  or granting an unrestricted worker transport?
- Is the extra verifier's cost justified by the guarantee it adds?

## Conclusion

Pending research and owner review. No architecture option is accepted.

Promoted to: pending. A concrete trust/module-boundary choice requires a
Proposed ADR through the ADR workflow before implementation under 059-01/060-01.
