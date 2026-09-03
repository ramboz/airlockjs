/**
 * The DOM chamber (spec 025-02 AC2/AC3) — hosts airlock's OWN worker-side
 * DOM mirror (`./worker-dom/mirror.js`, via the testable
 * `./dom-chamber-host.js`) and runs an UNMODIFIED write/compute-heavy tag
 * off the main thread (ADR-0014 Option C), replacing
 * `@ampproject/worker-dom` (025-01's probe library — devDependency-only,
 * AC8). Mirrors `core/chamber.worker.js` / `core/pixel-chamber.worker.js`'s
 * shape: a first-import egress-confinement guard
 * (`./confine-dom-chamber.js`) + thin `self.onmessage` glue over a
 * separately-testable host — no logic lives in THIS file beyond wiring
 * (see `core/dom-chamber-host.js`'s own header for why the testable core is
 * a separate module).
 *
 * WIRE PROTOCOL (`./worker-dom/protocol.js`):
 *   IN  `{ type: "init", authorSource, elements, workUs }` — boot the tag.
 *   IN  `{ type: "event", targetId, eventType }` — forward a main-thread
 *       event to the tag's mirror-registered listener (AC3a).
 *   OUT `{ type: "mutations", ops }` — the recorded write-ops, batched; one
 *       flush after `init` (the boot-time DOM construction) and one after
 *       each forwarded `event` (that click's storm).
 *
 * No ambient globals beyond the injected mirror `document` (ADR-0001) —
 * `fetch` and every other network-capable primitive are withheld by
 * `./confine-dom-chamber.js`, imported FIRST (see that module's header).
 */
// CONFINEMENT MUST BE THE FIRST IMPORT (spec 016-01's load-bearing ordering
// fix, applied here for the DOM chamber). ES-module evaluation is
// POST-ORDER, so a statically-imported module's top-level runs before THIS
// file's body — and imports evaluate in SOURCE ORDER, so putting this FIRST
// guarantees egress confinement runs before the host/mirror imports below
// can capture a live `fetch`. See core/confine-dom-chamber.js for the full
// argument.
import "./confine-dom-chamber.js";
import { createDomChamberHost } from "./dom-chamber-host.js";
import { createMutationsMessage } from "./worker-dom/protocol.js";

// Guarded so this module stays importable outside a real Worker (vitest has
// no `self`) — the same guard the other chamber worker files use.
if (typeof self !== "undefined") {
  const host = createDomChamberHost();
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") {
      const ops = host.boot({ authorSource: m.authorSource, elements: m.elements, workUs: m.workUs });
      self.postMessage(createMutationsMessage(ops));
      return;
    }
    if (m.type === "event") {
      const ops = host.dispatchEvent({ targetId: m.targetId, eventType: m.eventType });
      self.postMessage(createMutationsMessage(ops));
    }
  };
}
