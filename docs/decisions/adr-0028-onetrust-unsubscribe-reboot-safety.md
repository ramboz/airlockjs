---
status: Accepted
dependencies: [adr-0007, adr-0026, adr-0027]
last_verified: 2026-09-14
frame_review: false
---

# ADR-0028: OneTrust driver unsubscribe primitive + re-boot-safe subscription

## Status

Accepted (2026-09-14)

Resolves the **re-boot unsubscribe** open question left by [ADR-0027](./adr-0027-onetrust-composite-governance-field.md)
(§ Open questions) and the matching residual in `docs/refinement-todo.md` (§ Spec 047 — inherited from 047-02, extended to
the composite by 048-03).

## Context

The OneTrust driver's `subscribeOnetrustConsentChanges` (`drivers/consent/onetrust.js`, spec 047-02) registered a
consent-change subscription through two grounded surfaces (`OneTrust.OnConsentChanged` + a wrapped `OptanonWrapper`), guarded
against double-registration by a **permanent, first-writer-wins marker** on the passed `onetrust` / `win` objects — and
returned nothing. There was no way to tear a subscription down.

That left a real defect on **re-`boot()`** (a SPA-style re-init, or any second `boot(config)` / `bootEdsAnalytics`). The
adapter's `installOnWindow` (`adapters/eds/index.js`) disposes the prior composite's connectors (021-01), but the prior
OneTrust subscription stayed installed and its markers stayed tripped. So the **new** composite's subscription — which
`boot(config)` registers on the same ambient `window` / `window.OneTrust` — silently **no-op'd** (the markers were already
set), and a subsequent OneTrust accept fanned only to the *disposed* composite's `setConsent` (a benign no-op). The **live**
composite's Google Ads + Floodlight held beacons **stranded** across the re-boot — the exact accept-flow 048-03 exists to
guarantee. Benign only because nothing threw; functionally, consent changes stopped reaching the live page.

The fix must (a) give the driver a real unsubscribe primitive, and (b) be correct under the adapter's actual dispose
**ordering**: `boot(config)` registers the new subscription **before** `installOnWindow` disposes the prior composite (the
prior is deliberately kept alive until the new one has fully booted, so a failed re-boot never leaves the page with no
airlock). So a naive "clear the markers on unsubscribe" is not enough — the old teardown runs *after* the new setup and
shares state on the same `window` object.

## Decision Options Considered

### Option A: hoist "dispose the prior" to the START of boot() (before the new subscription)
Dispose `window.airlock` at the top of `boot()` / `bootEdsAnalytics`, so the prior subscription (and its markers) are gone
before the new subscription registers; a plain marker-clearing unsubscribe then suffices.
- **Pros:** minimal driver change (unsubscribe just clears markers).
- **Cons:** **breaks failure semantics.** The current design keeps the prior composite alive until the new one is fully
  booted, so a re-boot that throws partway (an unknown connector type in the new config) leaves the *working* prior installed
  (`adapters/eds/index.js` partial-boot cleanup + "installOnWindow unreached"). Disposing the prior first means a failed
  re-boot destroys the working airlock and leaves the page with none. Rejected.

### Option B: a stable one-time trampoline + a mutable "active handler" slot, torn down by compare-and-clear (chosen)
Each surface is still wired **exactly once** per host object (marker-guarded), but what is registered is a **stable
trampoline** that dispatches to a single mutable `__onetrustActiveHandler` slot on that object. A (re-)subscription **swaps**
the slot to its own handler; `subscribeOnetrustConsentChanges` **returns an idempotent `unsubscribe()`** that clears the slot
**only while it still holds THIS subscription's handler** (compare-and-clear). The adapter folds that unsubscribe into the
handle's / composite's `dispose()`.
- **Pros:** re-boot-safe **regardless of dispose ordering** — the new subscription takes the slot over, and the old teardown
  (running last, via the prior composite's `dispose`) sees the slot already holds the newer handler and does nothing, so it
  **cannot strand** the live composite. Preserves failure semantics (the prior stays alive until the new boots). Preserves
  every documented 047-02 behavior: one-time registration (no double-register / no double-wrap), the both-fire belt-and-
  suspenders count, the re-read-on-fire, and a preserved pre-existing host `OptanonWrapper`. Additive: direct callers that
  ignore the return value are unaffected.
- **Cons:** the one-time trampoline (and the `OptanonWrapper` wrap) stay installed permanently as a **harmless no-op** when no
  handler is active — they are not removed on the last unsubscribe. Leak-free (installed once per object, guarded), so this is
  residue, not accumulation.

### Option C: refcount the surfaces and fully restore on the last unsubscribe
Track subscriber count per surface; on the last unsubscribe, remove the trampoline and restore the original `OptanonWrapper`.
- **Pros:** fully restores the host globals.
- **Cons:** over-engineered for no observable pre-1.0 benefit — the Option-B residue is a leak-free no-op, and `OnConsentChanged`
  has no unregister API anyway (the trampoline must persist), so "full restore" is only partial in practice. Rejected (leanness).

## Recommended Decision

**Option B.** `subscribeOnetrustConsentChanges` returns an idempotent, compare-and-clear `unsubscribe()`; the adapter
(`bootGa4Core` per-connector handle + `boot(config)` composite) folds it into `dispose()`, which a re-boot already calls on
the prior instance. Re-boot no longer strands the live composite's held beacons.

## Consequences

**Becomes easier:**
- A re-`boot()` / SPA re-init keeps the live composite receiving OneTrust changes (held ad beacons flush on accept as
  intended); the disposed composite stops receiving them.
- The driver now has a general teardown seam any future consent-input caller (or an explicit `dispose`) can use.

**Becomes harder:**
- The subscription now carries a small amount of per-object trampoline state (`__onetrustActiveHandler` + the two wiring
  markers) rather than a single write; the compare-and-clear invariant (only clear while the slot is still mine) is
  load-bearing and test-pinned — a blind clear would re-introduce the strand.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe. -->

- **The adapter registers the new subscription before disposing the prior** — verified (`adapters/eds/index.js`: `boot()`
  subscribes after `createComposite`, then `installOnWindow` disposes the prior last; `bootGa4Core` subscribes before its
  handle is installed). This ordering is why compare-and-clear (not marker-clearing) is required.
- **`OneTrust.OnConsentChanged` has no unregister API** — the driver already only ever *adds* a callback (ADR-0026 / §A2), so
  a real "remove the listener" is not available; neutralizing via the active-handler slot is the teardown mechanism.

## Kill criteria

- If a host needs the OneTrust globals **fully restored** on teardown (the trampoline + `OptanonWrapper` wrap removed) — e.g.
  a strict test-isolation or micro-frontend unmount requirement — revisit with Option C's refcounting.
