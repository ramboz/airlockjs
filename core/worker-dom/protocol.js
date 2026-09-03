/**
 * The WIRE CONTRACT (spec 025-02 AC3) between the worker-side DOM mirror
 * (`./mirror.js`, hosted by `../dom-chamber-host.js` / `../dom-chamber.worker.js`)
 * and the main-thread apply coordinator (`adapters/eds/dom-apply.js`) —
 * airlock's OWN bidirectional replacement for `@ampproject/worker-dom`
 * (ADR-0014 Option C).
 *
 * TWO message envelopes cross the airlock:
 *   (a) main -> worker, EVENT FORWARDING: `{ type: "event", targetId, eventType }`
 *       — a click on the decoupled main-thread target, forwarded so the
 *       tag's mirror-registered listener actually fires (the frame-critique
 *       fix: without this, nothing measurable ever runs off-thread).
 *   (b) worker -> main, MUTATION FLUSH: `{ type: "mutations", ops }` — the
 *       recorded write-ops, batched.
 *
 * PLAIN DATA ONLY (the 022-04 lesson): every op is JSON-shaped — strings /
 * numbers / plain objects — never a function or a live mirror-node
 * reference, so a batch survives a REAL `structuredClone()` round-trip and
 * `postMessage` never throws `DataCloneError`. `isStructuredCloneable`
 * below is the reusable guard (see test/worker-dom-protocol.test.js's
 * round-trip proof).
 *
 * RESERVED IDS: `DOCUMENT_ID` / `BODY_ID` are pre-agreed anchors, never
 * produced by the mirror's own per-node id generator. The worker-side mirror
 * assigns them to its `document` singleton and `document.body` respectively;
 * the main-thread coordinator PRE-SEEDS its id->node map with
 * `{ [BODY_ID]: <the real host element> }` before applying any op — so
 * `document.body.appendChild(...)` in the (byte-unmodified) tag lands, on
 * apply, as a child of a REAL element already on the page, without ever
 * being "created" via its own op (mirrors how `@ampproject/worker-dom`
 * mirrors its upgraded host element as the worker's `document.body`).
 * `DOCUMENT_ID` is the event-forwarding target for a listener registered
 * directly on `document` (this slice's fixture's only listener target).
 */

export const DOCUMENT_ID = "document";
export const BODY_ID = "body";

/** The closed set of mutation-op names the mirror emits / the apply
 *  coordinator understands (spec 025-02 AC1/AC7 — "the exact implemented
 *  DOM surface"). Frozen: both sides read this SAME contract; neither
 *  should be able to mutate it at runtime. */
export const OP = Object.freeze({
  CREATE_ELEMENT: "createElement",
  CREATE_TEXT: "createText",
  APPEND_CHILD: "appendChild",
  SET_ATTRIBUTE: "setAttribute",
  SET_STYLE: "setStyle",
  SET_TEXT: "setText", // Text.textContent= AND Element.textContent= both emit this (apply-side handling is identical)
  CLASS_ADD: "classAdd",
  CLASS_REMOVE: "classRemove",
  CLASS_TOGGLE: "classToggle",
});

/**
 * Build the main->worker event-forward message (AC3a).
 * @param {string} targetId the mirror node id to dispatch to (this slice: `DOCUMENT_ID`).
 * @param {string} eventType e.g. "click".
 * @returns {{type:"event", targetId:string, eventType:string}}
 */
export function createEventMessage(targetId, eventType) {
  return { type: "event", targetId, eventType };
}

/**
 * Build the worker->main mutation-flush message (AC3b). Defensively
 * coerces a non-array `ops` to `[]` — this module never ships a malformed
 * batch, even if a caller passes a bad value.
 * @param {unknown} ops
 * @returns {{type:"mutations", ops:Array<object>}}
 */
export function createMutationsMessage(ops) {
  return { type: "mutations", ops: Array.isArray(ops) ? ops : [] };
}

/** @param {unknown} msg @returns {boolean} */
export function isEventMessage(msg) {
  return !!msg && msg.type === "event" && typeof msg.targetId === "string" && typeof msg.eventType === "string";
}

/** @param {unknown} msg @returns {boolean} */
export function isMutationsMessage(msg) {
  return !!msg && msg.type === "mutations" && Array.isArray(msg.ops);
}

/**
 * Does `value` survive a REAL `structuredClone()` round-trip? The boundary
 * guard that catches a future op shape smuggling a function / Symbol / live
 * DOM-mirror-node reference BEFORE it ever reaches a real `postMessage` — a
 * `DataCloneError` there is a worse, later place to learn this (the 022-04
 * lesson: `docs/specs/022-helix-rum-connector/slice-04-cwv-checkpoints.md`).
 * @param {unknown} value
 * @returns {boolean} `false` on ANY clone failure — never throws. `true`
 *   (fail-open on the CHECK ITSELF, not the data) when `structuredClone` is
 *   unavailable in the current realm — this guard cannot block on a platform
 *   primitive it cannot assume.
 */
export function isStructuredCloneable(value) {
  if (typeof structuredClone !== "function") return true;
  try {
    structuredClone(value);
    return true;
  } catch {
    return false;
  }
}
