---
status: CONCLUDED
topic: accuracy of the Partytown claim justifying AD-4 (no SharedArrayBuffer / COOP-COEP)
created: 2026-08-25
related:
  - ../architecture.md
  - ../reviews/2026-08-25-mvp1-architecture-review.md
---

# R-003: Partytown mechanism check (AD-4 justification)

## Question

Is the competitive-landscape claim accurate that Partytown's transparent DOM
proxying "needs synchronous access, forcing blocking service-worker
round-trips or SharedArrayBuffer+COOP/COEP, which breaks common embeds" — the
justification behind AD-4?

## Sources / findings

Primary sources: partytown.qwik.dev (how-does-partytown-work, atomics),
builder.io architecture post. Verified 2026-08-25 (fact-check agent, cited in
the arch-review Verification appendix C).

- Worker-hosted third-party scripts via opt-in `type="text/partytown"`:
  accurate.
- Synchronous DOM access from the worker via JS Proxies: accurate ("access
  DOM synchronously... scripts continue to work exactly how they're coded").
- Default path = **synchronous XHR intercepted by a Service Worker** (each
  DOM call blocking): accurate.
- **SharedArrayBuffer/Atomics is the optional ~10× fast path**, requiring
  `crossOriginIsolated` (COOP `same-origin` + a COEP header): accurate.
- Embed breakage: specific to `COEP: require-corp` (cross-origin
  images/scripts/iframes without CORP/`crossorigin` stop loading);
  `COEP: credentialless` is a partial mitigation with its own support
  caveats. "Breaks common embeds" is a fair real-world characterization.
- One imprecision in our doc's wording: "forcing" overstates — the service
  worker is the *default*, SAB the optional fast path, with a main-thread
  fallback if neither is available.

## Conclusion

AD-4's justification stands: the only prior art for OMT martech fakes a
synchronous DOM rather than removing it, and its fast path requires exactly
the cross-origin isolation AD-4 refuses. Keep the decision; soften "forcing"
to "defaulting to blocking service-worker round-trips, with SAB+COOP/COEP as
the fast path" whenever the competitive-landscape prose is next touched (not
worth a standalone edit).

Promoted to: n/a (validation only — confirmed AD-4 as recorded; wording
nuance noted in the arch-review Verification appendix C).
