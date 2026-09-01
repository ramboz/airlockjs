import { createScheduler } from "../../core/scheduler.js";

/**
 * Scheduled-DOM-op capability (spec 023-01 AC2) — a connector/tag expresses
 * heavy DOM work as YIELDABLE UNITS (a per-element step + the item set)
 * through this capability; it runs them via core/scheduler.js's chunk+yield
 * so the total work completes ACROSS FRAMES, interleaved with interactions,
 * instead of blocking the main thread in one task. Mirrors
 * adapters/eds/dom.js's DI'd-capability-factory style (an injected `deps`
 * bag, a caller-supplied override always wins, ambient defaults guarded) —
 * see that file's header for the convention this one follows.
 *
 * *** FIRST-CHUNK DISCIPLINE (AC1/AC3 must-fix) — this capability's OWN
 * OBLIGATION ***
 * core/scheduler.js's `chunk` keeps every batch (including the first) within
 * budget BY CONSTRUCTION (see that module's header). This capability must
 * not UNDO that guarantee by doing its own un-chunked setup work (a
 * `querySelectorAll`, a DOM traversal, anything) BEFORE handing off to
 * `chunk` — so `runScheduled` below does nothing but compute the effective
 * budget and call straight into `scheduler.chunk()`. The CALLER (spec
 * 023-01 AC3's fixture) is responsible for handing over an ALREADY-collected
 * item set; collecting it is deliberately NOT this capability's job (a
 * `querySelectorAll` over a large set is itself a monolithic-sync prefix the
 * scheduler cannot chunk — out of Lever 1's reach by construction, per the
 * spec's Assumptions).
 */

const DEFAULT_BUDGET_MS = 5;

/**
 * Create the scheduled-DOM-op capability.
 *
 * @param {{
 *   scheduler?: ReturnType<typeof createScheduler>,
 *   budgetMs?: number,
 *   [schedulerDep: string]: unknown,
 * }} [deps] a caller-supplied `scheduler` FULLY overrides the default
 *   (mirrors dom.js's `setContent` override seam); otherwise one is
 *   constructed via `createScheduler(deps)`, forwarding every OTHER key
 *   through unchanged — so `now`, `schedulerYield`, `schedulerPostTask`,
 *   etc. still reach the default scheduler exactly as core/scheduler.js
 *   documents them. `budgetMs` is this capability's OWN default budget
 *   (DEFAULT_BUDGET_MS if omitted), overridable per-call via
 *   `runScheduled`'s own `opts.budgetMs`.
 * @returns {{
 *   runScheduled: (items: ArrayLike<unknown>, perItem: (item: unknown, index: number) => void, opts?: { budgetMs?: number }) => Promise<{ completed: number }>,
 *   mechanism: string,
 * }}
 */
export function createScheduledDomCapability(deps = {}) {
  const scheduler = deps.scheduler || createScheduler(deps);
  const defaultBudgetMs = typeof deps.budgetMs === "number" ? deps.budgetMs : DEFAULT_BUDGET_MS;

  /**
   * Run heavy per-element DOM work as yieldable units (AC2).
   * @param {ArrayLike<unknown>} items the PRE-COLLECTED item set (never
   *   collected here — see this module's header + AC3).
   * @param {(item: unknown, index: number) => void} perItem the per-element
   *   step (e.g. a layout-read/style-write pair).
   * @param {{ budgetMs?: number }} [opts]
   * @returns {Promise<{ completed: number }>} resolves once every item ran.
   */
  async function runScheduled(items, perItem, opts = {}) {
    let completed = 0;
    const budgetMs = typeof opts.budgetMs === "number" ? opts.budgetMs : defaultBudgetMs;
    await scheduler.chunk(items, (item, index) => {
      perItem(item, index);
      completed++;
    }, { budgetMs });
    return { completed };
  }

  return { runScheduled, mechanism: scheduler.mechanism };
}
