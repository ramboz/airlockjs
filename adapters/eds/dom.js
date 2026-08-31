import { sanitizeHtml } from "../../core/sanitize-html.js";

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

// Lazily-created, MEMOIZED Trusted-Types policy whose `createHTML` runs the
// (injected or default) sanitizer — spec 018-01 AC5. Sanitize + TT-stringify
// are ONE atomic step this way: there is no window where an *un*sanitized
// string is trusted. Memoized at module scope because a NAMED policy can
// only be created ONCE per page under a `trusted-types` CSP directive — a
// second `createPolicy` call with the same name throws "already exists"
// unless the directive allows duplicates (the EDS boilerplate's CSP,
// R-005:79, does not) — so every `fill()` after the first must REUSE this
// policy, never attempt to recreate it (a per-call create would swallow
// every write after the first the moment TT is available).
let ttPolicyCache; // undefined = not yet attempted this module/page load
function sanitizingTrustedTypesPolicy(sanitize) {
  if (ttPolicyCache !== undefined) return ttPolicyCache;
  ttPolicyCache = null;
  try {
    const tt = typeof trustedTypes !== "undefined"
      ? trustedTypes
      : (typeof window !== "undefined" ? window.trustedTypes : undefined);
    if (tt && typeof tt.createPolicy === "function") {
      ttPolicyCache = tt.createPolicy("airlock-sanitize", { createHTML: (input) => sanitize(input) });
    }
  } catch {
    // Policy creation blocked (e.g. a restrictive `trusted-types` CSP
    // policy-name allowlist that does not include "airlock-sanitize") —
    // sanitize-anyway fallback below; best-effort, never a hard dependency
    // (grounding-honest: R-005:79 does not pin the policy-name allowlist).
    ttPolicyCache = null;
  }
  return ttPolicyCache;
}

/**
 * Create the host-side DOM-injection capability over a document.
 *
 * @param {Document | { querySelector: Function } | undefined} [doc]
 * @param {{
 *   now?: () => number,
 *   schedule?: (fn: () => void, ms: number) => unknown,
 *   setContent?: (el: object, content: string) => void,
 *   sanitize?: (html: string) => string,
 * }} [opts] `now` (default performance.now), `schedule` (default setTimeout —
 *   the anti-flicker reveal backstop).
 *
 *   `setContent` — the write seam; DEFAULT is SANITIZE-then-write, not raw
 *   `innerHTML` (spec 018-01 AC1). CORRECTION to the prior (012-03) framing:
 *   the EDS default Trusted-Types policy "accepting" the write
 *   (probes/eds-testbed/scripts/scripts.js:61-78) is a COMPATIBILITY
 *   property for the `Element innerHTML` sink (it does not strip `on*` or
 *   `<script>` there) — NOT a sanitization property, so relying on it alone
 *   would leave the `on*`-handler / `javascript:`-URL surface open. The
 *   default now runs `sanitize` (see below) and assigns the result through a
 *   Trusted-Types policy when one is available, else as a plain string — the
 *   whole write stays inside a try/catch (never breaks the page, even the
 *   edge case of an active `require-trusted-types-for 'script'` CSP with no
 *   registered `default` policy and a blocked named-policy creation, where a
 *   plain-string assignment would itself throw). A caller-supplied
 *   `setContent` FULLY OVERRIDES this default (unchanged contract) — a
 *   deployment hosting genuinely untrusted content can slot a stricter
 *   sanitizer (e.g. DOMPurify) + a dedicated TT policy here. The shipped
 *   default is conservative defense-in-depth, NOT a complete XSS guarantee
 *   (mutation-XSS / parser-differential bypasses are the injectable seam's
 *   job, not this denylist's).
 *
 *   `sanitize` (default: `sanitizeHtml` from `core/sanitize-html.js`) — an
 *   INTERNAL DI seam for just the sanitize step the default `setContent` (and
 *   its Trusted-Types policy's `createHTML`) both call. Mainly for tests: no
 *   real `DOMParser` exists in Node/vitest, so injecting a stand-in here lets
 *   the write-path WIRING be asserted (sanitize runs; its result — not the
 *   raw content — is what gets written) without a real parse. The real
 *   parse->strip->serialize proof runs in the Playwright rig
 *   (rig/sanitize-boundary.mjs), not against this seam.
 * @returns {{ reserveSpace: Function, insertAfterInteraction: Function }}
 */
export function createDomCapability(
  doc = typeof document !== "undefined" ? document : undefined,
  opts = {},
) {
  const now = opts.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const schedule = opts.schedule || ((fn, ms) => (typeof setTimeout !== "undefined" ? setTimeout(fn, ms) : undefined));
  const sanitize = typeof opts.sanitize === "function" ? opts.sanitize : sanitizeHtml;
  const setContent = typeof opts.setContent === "function"
    ? opts.setContent
    : (el, content) => {
      try {
        const policy = sanitizingTrustedTypesPolicy(sanitize);
        el.innerHTML = policy ? policy.createHTML(content) : sanitize(content);
      } catch {
        // TT policy rejected the value, or — the pathological edge — a
        // plain-string assignment itself threw under a restrictive
        // trusted-types CSP with no registered `default` policy. Swallow,
        // never break the page (unchanged posture from 012-03).
      }
    };
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
    //     CLIP BY DEFAULT (018-02 AC1 — supersedes the 012-03 "honest boundary"
    //     this comment used to document): "layout-stable by construction" no
    //     longer depends on the host sizing `minHeight >= decision height`. An
    //     over-tall fill now CLIPS instead of growing the box and reflowing
    //     surrounding content — the CLIP enforces layout-stability, not host
    //     sizing discipline. `spec.grow === true` opts a specific reserve OUT
    //     of the clip (a host that legitimately wants a growable box and
    //     accepts the reflow risk for that reserve).
    const style = target.style || (target.style = {});
    style.minHeight = n.minHeight + "px";
    if (spec.grow !== true) {
      // `min-height` alone is a FLOOR, not a ceiling — an `auto`-height box
      // still grows past it for taller content regardless of `overflow`, so
      // `overflow` alone (with no height ceiling) would clip nothing. Pinning
      // `max-height` to the SAME reserve caps growth; `overflow: clip` then
      // hides whatever does not fit, so the box's occupied geometry never
      // changes between reserve-time and fill-time.
      style.maxHeight = n.minHeight + "px";
      style.overflow = "clip";
    }
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
      /** Undo the reservation (release the min-height + the clip cap + markers,
       *  reveal). Symmetric with reserve: clears EVERY style reserve set —
       *  `minHeight` AND the `maxHeight`/`overflow:clip` the clip default adds
       *  (018-02 review) — so an un-reserved box is not left permanently
       *  height-capped + clipping later natural content. Blanking a property
       *  reserve never set (grow mode) is a harmless no-op. */
      release() {
        target.removeAttribute(RESERVED_ATTR);
        if (target.style) {
          target.style.minHeight = "";
          target.style.maxHeight = "";
          target.style.overflow = "";
        }
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
