---
round: 1
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T18:17:35Z
prompt_source: "the slice diff 75bf23c7..344134f6 (squashed into the commit that carries these files), saved at a scratch path and read by the reviewer from disk"
scope: spec compliance of slice 069-02 (generic data layer and opt-in adobeDataLayer proxy) against its acceptance criteria, Definition of Done and ADR-0065
---

# Slice 069-02 compliance review (round 1)

The author saved this text from the reviewer's output. The reviewer returned `needs-changes`, recorded here as `changes-requested`. "This commit" is the round-1 fix commit that carries this file. No round-2 re-review has run.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Med | A revoked Proxy pushed to `push` (or through the patched `push`) makes `Array.isArray` throw into the page. | Fixed in this commit: the check moved inside the `try`; a revoked Proxy (object or array, nested, or on the instance name at install) is dropped with `datalayer-bad-push` or treated as foreign. Test with `Proxy.revocable`; revert-checked. |
| 2 | Med | AC3 asks for the measured cost on the S10 state and the Findings record none. | Fixed in this commit: a real-Chromium measurement on the recorded S10 state and a 100x copy; the numbers are in the Findings. |
| 3 | Med | The AC9 test is vacuous (`not.toEqual(arrayContaining(4 keys))` passes for almost any object). | Fixed in this commit: it asserts the exact key list and that none of the capability names is present. |
| 4 | Med | AC9's `dataLayer: false` / `pushToDataLayer` throw clause is deferred to 069-03 without changing the AC. | Fixed in this commit: AC9 reworded with an arrow to 069-03 AC5, which now owns the clause. |
| 5 | Low | The AC1 global test sees only property reads on stubbed values, not `typeof window.x` or `in` reads. | Fixed in this commit: a `window` guard Proxy (get, has, set, ownKeys, descriptor, define) is added; it must see no access. |
| 6 | Low | AC2's "may run once" is imprecise, and the owner's approval of the AC2 rewrite is not recorded. | Fixed in this commit: AC2, slice 069-04 and the module header now say "during one validation walk (`getOwnPropertyDescriptor` once per own key, and a nested Proxy's traps too)"; the original AC2 wording is in the deviation log. Carried: the owner's approval of the AC2 rewrite goes to the coordinator (owner: coordinator). |
| 7 | Low | The forward to core is gated by attach, `analytics !== false` and `shouldProcessEvent`, and a hook shares the nested `xdm` with what is forwarded. | Fixed in this commit: AC8 states the gating and the deviation log records it; hooks and the forward now get copies (tests). |
| 8 | Low | `installAdobeDataLayerProxy` twice on one name reports the module's own array as foreign; a second name drops the first proxy's drain-time detection. | Fixed in this commit: idempotent install, and the drain-time checks are a list. Tests for both; revert-checked. |
| 9 | Info | Public hygiene is clean. | No action. |
