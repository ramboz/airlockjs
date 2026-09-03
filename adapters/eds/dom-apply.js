import { createScheduler } from "../../core/scheduler.js";
import { BODY_ID } from "../../core/worker-dom/protocol.js";
import { evaluateOp } from "../../core/worker-dom/apply-policy.js";
import { sanitizeHtml } from "../../core/sanitize-html.js";

/**
 * The main-thread mutation-APPLY coordinator (spec 025-02 AC4) — receives
 * op batches from the DOM chamber (`core/worker-dom/protocol.js`'s wire
 * contract) and applies them to the REAL DOM via an id->node map,
 * FRAME-BUDGETED through `core/scheduler.js`'s `chunk` (023's already-proven
 * primitive — this module DRIVES it, never re-implements a hand-rolled
 * yield loop; see test/dom-apply-coordinator.test.js's real-scheduler-spy
 * proof). Every op is gated through `core/worker-dom/apply-policy.js`'s
 * safety ALLOWLIST (AC6) before it touches the real DOM — the chamber
 * isolates the TAG, but this mutation channel is a WRITE SURFACE to the
 * real main-thread DOM, so a hostile/compromised op is refused + diagnosed
 * (the 009-02 sink), never silently applied.
 *
 * Mirrors `adapters/eds/dom.js` / `adapters/eds/scheduled-dom.js`'s DI'd-
 * capability-factory style: a DI'd `doc` (ambient-guarded default,
 * positional first arg — `adapters/eds/dom.js`'s own convention) + an
 * injected `opts` bag whose `scheduler` seam fully overrides the default
 * (mirrors `createScheduledDomCapability`'s own override seam), otherwise
 * one is constructed via `createScheduler(opts)`, forwarding every OTHER
 * key through unchanged.
 *
 * ID MAP: pre-seeded with `{ [BODY_ID]: opts.root }` when `opts.root` is
 * given — the real host element the worker-side `document.body` mirrors
 * onto (see `core/worker-dom/protocol.js`'s header). An op referencing an
 * id not yet in the map (never created, or refused at creation time) is
 * safely SKIPPED + diagnosed — never throws, never crashes the batch.
 *
 * `setInnerHTML` (spec 025-03 AC1/AC3 — the innerHTML SECURITY WRITE-PATH):
 * applied via `el.innerHTML = sanitize(html)` — REUSING `core/sanitize-
 * html.js`'s `sanitizeHtml` (the SAME sanitizer `adapters/eds/dom.js`'s
 * `fill()` already uses for a host-applied decision, spec 018-01), never
 * rebuilt. The sanitizer runs BEFORE the real write, completing 025-02's
 * safety story for the write surface: structured ops (createElement/
 * setAttribute/style/class) -> `core/worker-dom/apply-policy.js`'s
 * allowlist; raw HTML (from `innerHTML`) -> this sanitizer. `opts.sanitize`
 * is an injectable DI seam (default `sanitizeHtml`) mirroring `adapters/
 * eds/dom.js`'s OWN `opts.sanitize` escape hatch — mainly for tests (no real
 * `DOMParser` in Node/vitest, `core/sanitize-html.js`'s own documented
 * substrate boundary) and for a deployment needing a stricter sanitizer.
 */

const DEFAULT_BUDGET_MS = 5;

// Default diagnostics seam — mirrors core/airlock.js's own consoleDiagnostic
// (009-02): console-backed, severity-differentiated, and the SOLE sink (no
// call site below hard-codes `console` directly). A caller may inject
// `onDiagnostic` to intercept the same records.
function consoleDiagnostic(record) {
  const fn = record.level === "error" ? console.error : console.warn;
  fn("dom-apply:", record);
}

/**
 * Create the main-thread apply coordinator over a document.
 *
 * @param {Document | { createElement: Function, createTextNode: Function } | undefined} [doc]
 * @param {{
 *   root?: object,
 *   scheduler?: ReturnType<typeof createScheduler>,
 *   budgetMs?: number,
 *   onDiagnostic?: (record: object) => void,
 *   sanitize?: (html: string) => string,
 *   [schedulerDep: string]: unknown,
 * }} [opts] `root` seeds the id map's BODY_ID anchor (the real element the
 *   mirror's `document.body` writes land under). `scheduler` FULLY
 *   overrides the default; otherwise one is built via `createScheduler(opts)`
 *   (so `now`/`yieldToMain`/`schedulerYield`/etc. reach it exactly as
 *   core/scheduler.js documents). `budgetMs` is this coordinator's own
 *   default (`opts.budgetMs` per-call in `applyOps` overrides it further).
 *   `sanitize` (spec 025-03 AC1/AC3, default `sanitizeHtml` from
 *   `core/sanitize-html.js`) — the injectable seam `setInnerHTML` applies
 *   through; see the module doc comment above.
 * @returns {{
 *   applyOps: (ops: object[], opts?: { budgetMs?: number }) => Promise<{ applied: number, refused: number, total: number }>,
 *   resolve: (id: string) => object | null,
 *   nodeCount: () => number,
 *   mechanism: string,
 * }}
 */
export function createDomApplyCoordinator(
  doc = typeof document !== "undefined" ? document : undefined,
  opts = {},
) {
  const diagnose = typeof opts.onDiagnostic === "function" ? opts.onDiagnostic : consoleDiagnostic;
  const scheduler = opts.scheduler || createScheduler(opts);
  const defaultBudgetMs = typeof opts.budgetMs === "number" ? opts.budgetMs : DEFAULT_BUDGET_MS;
  const sanitize = typeof opts.sanitize === "function" ? opts.sanitize : sanitizeHtml;

  const nodes = new Map();
  if (opts.root) nodes.set(BODY_ID, opts.root);

  function resolve(id) { return nodes.has(id) ? nodes.get(id) : null; }

  function refuse(reason, extra) {
    diagnose({ level: "warn", kind: "dom-apply-refused", reason, ...extra });
    return "refused";
  }
  function refuseUnknownId(op, extra) {
    diagnose({ level: "warn", kind: "dom-apply-unknown-id", op: op && op.op, ...extra });
    return "refused";
  }

  /** Apply ONE op (already policy-checked by the caller — `applyOps` below).
   *  @returns {"applied"|"refused"} */
  function applyAllowed(op) {
    switch (op.op) {
      case "createElement": {
        const el = doc.createElement(op.tag);
        nodes.set(op.id, el);
        return "applied";
      }
      case "createText": {
        const t = doc.createTextNode(typeof op.text === "string" ? op.text : "");
        nodes.set(op.id, t);
        return "applied";
      }
      case "appendChild": {
        const parent = resolve(op.parentId);
        const child = resolve(op.childId);
        if (!parent || !child) return refuseUnknownId(op, { parentId: op.parentId, childId: op.childId });
        parent.appendChild(child);
        return "applied";
      }
      case "setAttribute": {
        const el = resolve(op.id);
        if (!el) return refuseUnknownId(op, { id: op.id });
        el.setAttribute(op.name, op.value);
        return "applied";
      }
      case "setStyle": {
        const el = resolve(op.id);
        if (!el) return refuseUnknownId(op, { id: op.id });
        el.style[op.prop] = op.value;
        return "applied";
      }
      case "setText": {
        const node = resolve(op.id);
        if (!node) return refuseUnknownId(op, { id: op.id });
        node.textContent = op.text;
        return "applied";
      }
      case "setInnerHTML": {
        // spec 025-03 AC1/AC3: the innerHTML SECURITY WRITE-PATH — the
        // sanitizer runs BEFORE the real write (never the raw op.html).
        const el = resolve(op.id);
        if (!el) return refuseUnknownId(op, { id: op.id });
        el.innerHTML = sanitize(op.html);
        return "applied";
      }
      case "classAdd": case "classRemove": case "classToggle": {
        const el = resolve(op.id);
        if (!el) return refuseUnknownId(op, { id: op.id });
        if (op.op === "classAdd") el.classList.add(op.name);
        else if (op.op === "classRemove") el.classList.remove(op.name);
        else el.classList.toggle(op.name);
        return "applied";
      }
      default:
        return refuse(`apply: unknown op "${op.op}"`, { op: op.op });
    }
  }

  /** Policy-check, then apply-or-refuse ONE op. Never throws (contract). */
  function applyOne(op) {
    const verdict = evaluateOp(op);
    if (!verdict.allow) return refuse(verdict.reason, { op: op && op.op });
    // AC6 hardening (025-02 review — both passes converged here): a real-DOM op
    // can throw on malformed-but-allowlisted input — `classList.add("a b")` ->
    // InvalidCharacterError, `""` -> SyntaxError; `setAttribute("data-x y", …)`
    // -> InvalidCharacterError; a cyclic `appendChild` -> HierarchyRequestError.
    // Such a throw must NOT reject `applyOps` and drop the rest of the batch
    // (this module's "never crashes the batch" contract, and squarely in AC6's
    // hostile-op-stream threat model: a chamber can post raw ops, and
    // confinement does not withhold `self.postMessage`). Catch -> diagnose +
    // count refused, continue. Belt-and-suspenders with the policy's own token
    // validation (apply-policy.js).
    try {
      return applyAllowed(op);
    } catch (err) {
      diagnose({
        level: "warn",
        kind: "dom-apply-threw",
        op: op && op.op,
        reason: err && err.message != null ? err.message : String(err),
      });
      return "refused";
    }
  }

  /**
   * Apply a batch of ops, FRAME-BUDGETED through scheduler.chunk (AC4).
   * @param {object[]} ops
   * @param {{ budgetMs?: number }} [applyOpts]
   * @returns {Promise<{ applied: number, refused: number, total: number }>}
   */
  async function applyOps(ops, applyOpts = {}) {
    const list = Array.isArray(ops) ? ops : [];
    let applied = 0;
    let refused = 0;
    const budgetMs = typeof applyOpts.budgetMs === "number" ? applyOpts.budgetMs : defaultBudgetMs;
    await scheduler.chunk(list, (op) => {
      if (applyOne(op) === "applied") applied++; else refused++;
    }, { budgetMs });
    return { applied, refused, total: list.length };
  }

  return { applyOps, resolve, nodeCount: () => nodes.size, mechanism: scheduler.mechanism };
}
