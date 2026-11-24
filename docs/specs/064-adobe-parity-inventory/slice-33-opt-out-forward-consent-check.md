---
status: DONE
dependencies: [064-30, 068-03, ADR-0062, ADR-0064]
last_verified: 2026-11-23
---

## Slice 064-33 — the opt-out forward carries only the consent the page gave

**Goal:** After an explicit refusal, the seam forwards the `consent` part of Alloy's set-consent request only when it is the consent the page gave, so an untrusted chamber cannot send other data through the 068-02 opt-out exemption.

**DoR:**
- ✅ ADR-0062 amendment (068-02) built; the opt-out forward exists.
- ✅ 064-30 built (the page's full object now travels through the forward; ADR-0064 point 6).

**Acceptance Criteria:**

The core half moved to [068-03](../068-seam-consent-follow-up/slice-03-opt-out-consent-check.md) (main, DONE 2026-11-23), which owns: the vendor-neutral host method `expectOptOutConsent` and the deep compare (old AC1 core half), the ADR-0062 amendment "opt-out forward is checked (2026-11-23)" (old AC2), the vector registration on main's paths, and the `meta` decision (old AC4: recorded as a remaining risk, not constrained). This slice keeps:

1. The adapter registers the `consent` the chamber may put on the wire for the opt-out forward, on the paths only vendor-adobe has: when the page's Adobe 2.0 object is posted to the chamber (064-30), the object plus the vector-shaped consent the chamber's one retry sends; on the 064-30 fallback or a failed post, the vector-shaped consent only; a later `handle.setConsent` drops the object (superseded by 064-34: the object's generation is consumed once a request carrying its consent, or a newer update's, has left). Shown by hermetic tests where a tampered object or vector body is held on the boot, direct, object and fallback paths.
2. The 068-02 opt-out tests and the 064-30 full-object opt-out test stay green, and refusals with no page object (boot-denied, CMP, fallback) and a retry-shaped request still forward (hermetic tests).

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests, if any, run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check (met):** Vertical: a refusal from the page's `setConsent` through the chamber's set-consent to the forwarded request on the wire, with a tampered body held.

## Findings (2026-11-23)

All tests are hermetic (Vitest, fake chamber Worker in `test/alloy-adobe-consent.test.js`, describe "064-33"); none is real-Chromium, so no `browser-oracle` step is added. `core/` is untouched by this slice (`git diff <merge>.. -- core/` empty).

| AC | Test |
|---|---|
| 1 | "a boot-time denial forwards the vector-shaped refusal, and a tampered one is held"; "a direct handle.setConsent denial forwards the vector refusal and holds a tampered one" (end-to-end proof deferred from 068-03 AC4); "the page's object forwards on the object path and a tampered object is held"; "the 064-30 fallback registers the vector, not the unreadable object"; "a later handle.setConsent drops the page object from the registration". |
| 2 | The 064-30 full-object opt-out test (red from the merge commit until this slice's commit, by design) and the 068-02/068-01 tests; "the chamber's one retry with the vector-shaped consent still forwards after the object path". |
| fix | "an object the chamber never received (postMessage throws) is not registered" (round-1 finding); "a falsy handle.setConsent leaves the registration and the page object as they were". |

Revert-checks (code broken on purpose, test red, code restored): without the object registration the full-object, object-path and retry tests fail; without the vector registration five tests fail; without the clear in `handle.setConsent` the later-`setConsent` test fails; `sent ? r.consent : null` weakened to `r.kind === "send"` fails the failed-post test; core's compare removed (on main's code) fails the tampered-held tests. The falsy-`setConsent` clear is an equivalent mutant (both `applyVector` callers reset the variable), so its test pins behaviour only.

Deviations and accepted edges: CMP `onChange` has no test of its own (it calls `handle.setConsent`, as 068-03 records); the retry is a retry-shaped request in the fake chamber, not a real Alloy rejection; registration is not call-order asserted but runs before `host.setConsent` in `applyVector`; the page object stays registered until a request carrying its consent, or a newer update's, leaves (a `none` classification leaves it), harmless because it is the page's own value; that real Alloy puts the page's object on the wire unchanged rests on 064-30's grant-path real-Chromium test, not a refusal capture. The overlap of back-to-back updates (an in-flight request for a superseded registration was held; the newer one forwarded) and the real-browser refusal check were closed by 064-34, where both forward and the page object stays registered until a request carrying its consent leaves.

Reviews: three fresh Opus 5.5 reviews, 2 rounds, all approved; see `reviews/slice-33-*.md`.

## Notes

Found by the ADR-0064 review: the 068-02 forward sends the `consent` subtree unchecked. Pre-existing, but 064-30 routes the page's richer object through it. The core part moved to 068-03 on main (named in the ADR-0062 amendment); this slice is adapter-only.
