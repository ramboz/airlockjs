/**
 * The TESTABLE core of the DOM chamber (spec 025-02 AC2/AC3a) — mirrors how
 * `core/connector-host.js` is the testable core `core/chamber.worker.js`
 * (GA4) / `core/pixel-chamber.worker.js` wire to `self.onmessage`
 * (chamber-isolation.test.js NEVER imports a `*.worker.js` file directly;
 * it tests the host those files delegate to). `core/dom-chamber.worker.js`
 * is the thin, `self`-guarded glue over THIS module.
 *
 * `boot()` executes the (byte-unmodified) synthetic tag's author source as
 * a CLASSIC, non-module script — `new Function(source)()` — with the
 * mirror `document` bound onto `globalThis` for the duration of that call,
 * so the tag's bare `document.createElement(...)` identifier resolves via
 * the normal scope-chain-to-global-object lookup, EXACTLY how a real Worker
 * resolves a bare `document` once `self.document = mirrorDoc` is assigned
 * (`self` IS the global object in a Worker realm — assigning a property on
 * it is indistinguishable, to a later bare-identifier read, from a real
 * global). `dispatchEvent()` re-establishes the SAME binding for the
 * duration of the listener invocation too (defensive: a general author
 * script's event HANDLER, not just its boot-time top-level, could
 * reference bare `document` again — this fixture's handler doesn't, but
 * the mechanism should not assume that).
 *
 * `withGlobalDocument` saves/restores whatever `globalThis.document` was
 * before the call (`undefined` in Node/vitest, never touched in a real
 * Worker beyond this module's own use) — so this module behaves IDENTICALLY
 * whether it runs inside a real Worker or a Node/vitest unit test, and
 * never leaks a fake `document` binding across unrelated code.
 */
import { createMirrorDocument } from "./worker-dom/mirror.js";
import { DOCUMENT_ID } from "./worker-dom/protocol.js";

function withGlobalDocument(doc, fn) {
  const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const prev = globalThis.document;
  globalThis.document = doc;
  try {
    return fn();
  } finally {
    if (hadOwn) globalThis.document = prev; else delete globalThis.document;
  }
}

/**
 * @returns {{
 *   boot: (msg: { authorSource: string, elements: number, workUs: number }) => object[],
 *   dispatchEvent: (msg: { targetId: string, eventType: string }) => object[],
 * }}
 */
export function createDomChamberHost() {
  const { document: doc, drainMutations } = createMirrorDocument();

  /** Run the byte-unmodified author source once (AC2). Substitutes the
   *  SAME __ELEMENTS__/__WORK_US__ template placeholders the existing
   *  rig/worker-dom-nasty-tag.mjs already substitutes server-side (the
   *  worker has no location.search of its own to read) — same convention,
   *  applied here since this host may run inside a worker with no query
   *  string of its own either. */
  function boot({ authorSource, elements, workUs }) {
    const src = String(authorSource)
      .replaceAll("__ELEMENTS__", String(elements))
      .replaceAll("__WORK_US__", String(workUs));
    withGlobalDocument(doc, () => {
      // Executing the byte-unmodified synthetic tag's CLASSIC (non-module)
      // source is the point (see this module's header): the tag resolves
      // the bare `document` identifier via the GLOBAL scope, exactly like a
      // real worker's `self.document` bind. (`no-new-func` is not part of
      // this repo's eslint baseline — @eslint/js recommended — so no
      // disable directive is needed here.)
      new Function(src)();
    });
    return drainMutations();
  }

  /** Forward a main-thread event to the mirror-registered listener (AC3a —
   *  the frame-critique fix: without this, the storm never fires). This
   *  slice's fixture only ever registers on `document` (DOCUMENT_ID); an
   *  unknown targetId is a harmless no-op (never throws). */
  function dispatchEvent({ targetId, eventType }) {
    withGlobalDocument(doc, () => {
      if (targetId === DOCUMENT_ID) {
        doc.dispatchEvent({ type: eventType, target: doc, currentTarget: doc });
      }
      // A future slice could route to an arbitrary element id via an id->node
      // map; out of THIS slice's scope (the fixture only listens on document).
    });
    return drainMutations();
  }

  return { boot, dispatchEvent };
}
