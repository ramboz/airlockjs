/**
 * CWV-safe DOM-injection capability (`reserveSpace`) — spec 012-03, AC3/AC4.
 *
 * The AD-5 host-side DOM path from contracts/capability.d.ts, implemented here on
 * the MAIN thread — mirroring how adapters/eds/cookies.js implements the cookie
 * capability host-side (a DI'd `doc`, null-safe, no ambient reach). This is the
 * ONLY DOM path a host-applied decision takes; a connector never writes the DOM.
 *
 * Layout-stable BY CONSTRUCTION (UC-1 no-flicker): `reserveSpace` reserves the
 * layout box up front (before paint) by `minHeight`, so a later `fill` of content
 * whose height is <= that reserve causes NO reflow of surrounding content. The
 * reserve _spec_ (selector + minHeight) is eager / config-sourced — known before
 * paint — and decoupled from the lazy, async decision that fills it (airlock boots
 * lazy, AD-8: the Target decision arrives AFTER first paint). Between reserve-time
 * and fill-time the reserved box's geometry — and the position of everything
 * around it — is unchanged (the browser rig proves this via getBoundingClientRect).
 *
 * Prehiding / anti-flicker is MAIN-THREAD and lives HERE, out of the chamber
 * (AC4 / mvp2.md): the reserved region's CONTENT is hidden (the box still occupies
 * its reserved space, so hiding causes no reflow) until the decision fills it or a
 * timeout backstop reveals it — so a slow/failed decision never leaves a
 * permanently blank box.
 *
 * `insertAfterInteraction` stays DECLARED-NOT-BUILT this slice (AC3 scope): there
 * is no deferred-injection consumer yet, so it rejects loudly rather than shipping
 * speculative, untested surface.
 */

/** Attribute markers the capability stamps on a reserved/filled box — the proof
 *  (rig AC3 leg a) that content went through the mediated helper, not a raw write. */
export const RESERVED_ATTR = "data-airlock-reserved";
export const FILLED_ATTR = "data-airlock-filled";
const DEFAULT_PREHIDE_TIMEOUT_MS = 3000;

/**
 * Validate + normalize an eager/config-sourced reserve spec.
 * @param {{ selector?: unknown, minHeight?: unknown } | null | undefined} spec
 * @returns {{ selector: string, minHeight: number } | null} null on an invalid spec.
 */
export function normalizeReserveSpec(spec) {
  if (!spec || typeof spec !== "object") return null;
  const selector = typeof spec.selector === "string" ? spec.selector.trim() : "";
  const minHeight = Number(spec.minHeight);
  if (!selector) return null;
  if (!Number.isFinite(minHeight) || minHeight < 0) return null;
  return { selector, minHeight };
}

/**
 * The style the reserved box carries so a later fill causes no layout shift.
 * @param {object} spec a ReserveSpaceSpec.
 * @returns {{ minHeight: string } | null}
 */
export function reservedBoxStyle(spec) {
  const n = normalizeReserveSpec(spec);
  if (!n) return null;
  return { minHeight: n.minHeight + "px" };
}

/**
 * Deterministic geometry compare (AC3 leg b) — is `after` in the same place as
 * `before`? `getBoundingClientRect` is deterministic in headless (unlike paint
 * timestamps, R-005), so this is a reliable no-reflow gate.
 * @param {{ top:number,left:number,width:number,height:number } | null} a
 * @param {{ top:number,left:number,width:number,height:number } | null} b
 * @param {number} [epsilon=0]
 * @returns {boolean}
 */
export function rectsEqual(a, b, epsilon = 0) {
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) <= epsilon
    && Math.abs(a.left - b.left) <= epsilon
    && Math.abs(a.width - b.width) <= epsilon
    && Math.abs(a.height - b.height) <= epsilon;
}

/**
 * Create the host-side DOM-injection capability over a document.
 *
 * @param {Document | { querySelector: Function } | undefined} [doc]
 * @param {{
 *   now?: () => number,
 *   schedule?: (fn: () => void, ms: number) => unknown,
 *   setContent?: (el: object, content: string) => void,
 * }} [opts] `now` (default performance.now), `schedule` (default setTimeout —
 *   the anti-flicker reveal backstop), `setContent` (the Trusted-Types-safe write
 *   seam; default `innerHTML`, which the EDS default TT policy accepts — R-005).
 * @returns {{ reserveSpace: Function, insertAfterInteraction: Function }}
 */
export function createDomCapability(
  doc = typeof document !== "undefined" ? document : undefined,
  opts = {},
) {
  const now = opts.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const schedule = opts.schedule || ((fn, ms) => (typeof setTimeout !== "undefined" ? setTimeout(fn, ms) : undefined));
  const setContent = typeof opts.setContent === "function"
    ? opts.setContent
    : (el, content) => { try { el.innerHTML = content; } catch { /* TT policy rejected — swallow, never break the page */ } };
  let seq = 0;

  function reserveSpace(spec) {
    const n = normalizeReserveSpec(spec);
    if (!n) return Promise.reject(new Error("reserveSpace: invalid spec — { selector, minHeight>=0 } required"));
    if (!doc || typeof doc.querySelector !== "function") return Promise.reject(new Error("reserveSpace: no document"));
    let target;
    try {
      target = doc.querySelector(n.selector);
    } catch {
      // A malformed selector throws `SyntaxError` synchronously — keep the failure
      // surface consistent (every reserveSpace failure is a rejected Promise, so a
      // `.catch()` caller never eats an unexpected synchronous throw).
      return Promise.reject(new Error("reserveSpace: invalid selector: " + n.selector));
    }
    if (!target) return Promise.reject(new Error("reserveSpace: selector matched nothing: " + n.selector));

    // --- reserve the layout box UP FRONT (before paint): min-height holds the
    //     space so a later fill of content <= minHeight reflows nothing around it.
    //     HONEST BOUNDARY (012-03 arch review): "layout-stable by construction" is
    //     CONDITIONAL on the host sizing `minHeight >= decision height` — an over-tall
    //     fill grows the box and reflows surrounding content (a host-config error; the
    //     rig proves only the content-fits case). Production-hardening option (tracked):
    //     overflow-clip the box so an over-tall fill clips rather than reflows.
    const style = target.style || (target.style = {});
    style.minHeight = n.minHeight + "px";
    const id = "reserve-" + (++seq) + "-" + Math.random().toString(36).slice(2, 8);
    target.setAttribute(RESERVED_ATTR, id);
    const reservedAt = now();

    // --- prehide (main-thread anti-flicker): hide the reserved region's CONTENT
    //     (visibility:hidden keeps the box in flow — no reflow) until fill/timeout.
    const prehide = spec.prehide !== false;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      if (target.style) target.style.visibility = "visible";
    };
    if (prehide) {
      style.visibility = "hidden";
      const timeoutMs = typeof spec.timeout === "number" ? spec.timeout : DEFAULT_PREHIDE_TIMEOUT_MS;
      schedule(reveal, timeoutMs); // backstop: a decision that never arrives still reveals
    }

    return Promise.resolve({
      id,
      reservedAt,
      /** Fill the PRE-RESERVED box with the decision content — the only mediated
       *  write path, and the box is already sized, so nothing around it moves. */
      fill(content) {
        if (typeof content === "string") setContent(target, content);
        target.setAttribute(FILLED_ATTR, "1");
        reveal();
      },
      /** Undo the reservation (release the min-height + markers, reveal). */
      release() {
        target.removeAttribute(RESERVED_ATTR);
        if (target.style) target.style.minHeight = "";
        reveal();
      },
    });
  }

  function insertAfterInteraction() {
    // AC3 scope: no deferred-injection consumer in this slice — declared-not-built.
    return Promise.reject(new Error("insertAfterInteraction: declared-not-built (no consumer in slice 012-03)"));
  }

  return { reserveSpace, insertAfterInteraction };
}
