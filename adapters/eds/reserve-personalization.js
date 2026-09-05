/**
 * Eager pre-paint personalization reserve — spec 033-03 AC2 (the no-flicker fix,
 * AD-8 / UC-1).
 *
 * THE SEPARATE, LIGHTWEIGHT EAGER ENTRYPOINT. `eds.js`/`boot(config)`/`bootAlloy`
 * are dynamically imported + run in `loadLazy`, AFTER `body.appear` (paint) — a
 * reserve there is the POST-PAINT flicker case the 012-03 rig gates as a failure.
 * So the reserve of a personalization box must run from `loadEager`, BEFORE paint,
 * decoupled from the lazy fill. This module is that entrypoint — and it MUST NOT be
 * reachable from `eds.js`: an eager `import(eds.js)` before paint pulls the full
 * runtime (`createAirlock` + every connector + web-vitals) onto the critical path,
 * regressing LCP against the very AD-8 lazy discipline this fix invokes. So this is
 * its OWN separately-importable dist module, importing ONLY `createDomCapability`
 * (the reserve mechanism) + the pure placement parser (build.mjs asserts the emitted
 * eager chunk carries no `createAirlock`).
 *
 * SYNCHRONOUS reserve, ASYNC hand-off: `reserveSpace(spec)` sizes the box
 * synchronously (min-height + max-height/overflow:clip + prehide visibility:hidden)
 * BEFORE its handle Promise resolves (adapters/eds/dom.js) — so calling it here, in
 * `loadEager` before `body.appear`, reserves pre-paint even though the fill is lazy.
 * `reserveSpace` is NOT idempotent-by-selector (each call re-reserves with a fresh
 * id), so the lazy fill cannot re-derive the handle — it must be HANDED OFF. We
 * return the reserve handle PROMISE(s) as `{ reservedPlacements: { "<scope>": <p> } }`;
 * the loader passes them to `boot(config, { reservedPlacements })` and `bootAlloy`
 * awaits before `.fill()`. NOT via `window.airlock` (disposed+replaced at lazy boot)
 * and NOT a module store (esbuild inlines a SEPARATE copy of this module vs eds.js —
 * no shared instance across the two dist entries).
 *
 * Never throws synchronously: an invalid/absent placement or no document is a no-op
 * (`{ reservedPlacements: {} }`), and a selector that matches nothing yields a
 * REJECTED handle promise (bootAlloy drops + diagnoses it — the reserve's own
 * prehide-timeout backstop still reveals the box). A `.catch` is attached here so
 * that rejection is never an unhandled-rejection warning in the eager window.
 */
import { createDomCapability } from "./dom.js";
import { parseViewPlacement } from "./placements.js";

/**
 * Synchronously initiate the reserve of the configured `__view__` personalization
 * box, returning the reserve handle promise(s) for the lazy fill to hand off to.
 *
 * @param {{ connectors?: Array<object> }} config the boot(config) project config
 *   (the SAME config the lazy `boot(config)` consumes — it carries the alloy
 *   connector's `placements`).
 * @param {{ document?: Document | { querySelector: Function } }} [opts] test/SSR seam:
 *   the document to reserve against (default the ambient `document`; absent -> no-op).
 * @returns {{ reservedPlacements: Record<string, Promise<{ id: string, fill: Function, release: Function }>> }}
 *   scope -> the reserve handle promise, for `boot(config, { reservedPlacements })`.
 */
export function reservePersonalization(config, opts = {}) {
  const doc = opts.document || (typeof document !== "undefined" ? document : undefined);
  const spec = parseViewPlacement(config);
  if (!spec || !doc) return { reservedPlacements: {} };

  // reserveSpace SIZES the box synchronously (before the returned Promise resolves),
  // so this reserve is pre-paint when called from loadEager before body.appear.
  const handlePromise = createDomCapability(doc).reserveSpace(spec);
  // Swallow a rejection HERE (selector matched nothing) so it is never an unhandled
  // rejection in the eager window — bootAlloy attaches its OWN await+catch on the
  // same promise later (drop + diagnose), so both consumers are covered.
  handlePromise.catch(() => {});

  return { reservedPlacements: { [spec.scope]: handlePromise } };
}
