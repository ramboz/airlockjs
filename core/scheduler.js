/**
 * Minimal main-thread SCHEDULER (spec 023-01 AC1) — the machinery Lever 1
 * (R-008) needs to CONTAIN a costly-DOM tag's INP hit: interleave a tag's
 * heavy per-element work with `yieldToMain()` so no single task blocks the
 * main thread past a budget, while the total work still completes across
 * frames. Pure/DI'd (every platform hook is an injected dependency with an
 * ambient-guarded default) — no ambient global is ever referenced
 * UNGUARDED, so this module is unit-testable with fully-injected/fake timing
 * fns (no real-clock flake) and degrades gracefully in an environment (e.g.
 * vitest's Node runtime — confirmed at implementation time to have NONE of
 * `scheduler`/`requestIdleCallback`/`requestAnimationFrame`) that has none
 * of the platform primitives. Mirrors adapters/eds/dom.js's DI'd-capability-
 * factory style (a `deps` bag, ambient fallback guarded by `typeof x !==
 * "undefined"`, a caller override always wins).
 *
 * *** FIRST-CHUNK DISCIPLINE (frame-critique must-fix, AC1) — the load-
 * bearing mechanical fact this module exists to encode ***
 * INP counts the interaction's FIRST task: input delay + the first
 * synchronous run of JS before the first yield back to the event loop. A
 * LATER yield cannot rescue a large FIRST chunk — by the time it runs, the
 * damage (the long first task) is already what INP measured. So `chunk`
 * below budgets the FIRST batch EXACTLY the same way it budgets every later
 * one — the same do/while loop, no special-cased "run everything up front"
 * first pass — so there is no privileged, unbounded first batch to
 * accidentally blow the budget, and no way to game the number by only
 * bounding batches AFTER the first. Because `chunk` is itself an `async`
 * function, calling it runs the FIRST batch SYNCHRONOUSLY (in the caller's
 * own call stack/task) up to the first `await yieldToMain()` — exactly
 * modeling "the first synchronous chunk before the first yield" that INP
 * counts; everything after that first `await` runs in later tasks, off the
 * interaction's own task.
 *
 * yieldToMain() resolution order (AC1, "ground the fallback at
 * implementation" — see this slice's deviation log for the probed
 * availability in the target Playwright chromium): an injected full
 * override (`deps.yieldToMain`) > the platform `scheduler.yield()` > the
 * platform `scheduler.postTask()` > a `MessageChannel` postMessage
 * round-trip > a last-resort `setTimeout(fn, 0)`. Every rung is DI'able (see
 * `createScheduler`'s JSDoc) so a test — or this slice's fixture, via its
 * `?yield=fallback` switch — can force any specific branch, including the
 * fallback, without needing a browser that genuinely lacks the platform
 * primitives. Passing `null` explicitly for `schedulerYield` /
 * `schedulerPostTask` / `createMessageChannel` DISABLES that rung (distinct
 * from omitting the key, which uses the ambient default) — the mechanism
 * that lets a caller force a lower rung of the fallback chain on demand.
 */

const DEFAULT_BUDGET_MS = 5; // a conservative "stay well inside a 16ms frame" per-batch budget

/**
 * Create a scheduler bound to the given (optional) injected platform hooks.
 *
 * @param {{
 *   now?: () => number,
 *   yieldToMain?: () => Promise<void>,
 *   schedulerYield?: (() => unknown) | null,
 *   schedulerPostTask?: ((fn: () => void, opts?: object) => unknown) | null,
 *   createMessageChannel?: (() => { port1: { onmessage: unknown, close?: () => void }, port2: { postMessage: (v: unknown) => void } }) | null,
 *   isInputPending?: () => boolean,
 *   requestIdleCallback?: (fn: (deadline: object) => void, opts?: object) => unknown,
 *   requestAnimationFrame?: (fn: (ts: number) => void) => unknown,
 *   setTimeout?: (fn: () => void, ms: number) => unknown,
 * }} [deps] every hook is OPTIONAL and DI'd; each ambient default is guarded
 *   by `typeof x !== "undefined"` (never a hard reference to a global that
 *   may not exist — see this module's header). `schedulerYield` /
 *   `schedulerPostTask` / `createMessageChannel` accept an explicit `null`
 *   to DISABLE that rung of the fallback chain (forces the next one).
 * @returns {{
 *   chunk: (items: ArrayLike<unknown>, perItem: (item: unknown, index: number) => void, opts?: { budgetMs?: number }) => Promise<void>,
 *   yieldToMain: () => Promise<void>,
 *   runWhenIdle: (fn: (deadline: object) => void, opts?: object) => unknown,
 *   runBeforePaint: (fn: (ts: number) => void) => unknown,
 *   mechanism: "override" | "scheduler.yield" | "scheduler.postTask" | "message-channel" | "timeout",
 * }}
 */
export function createScheduler(deps = {}) {
  const now = deps.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const isInputPending = deps.isInputPending
    || (typeof navigator !== "undefined" && navigator.scheduling && typeof navigator.scheduling.isInputPending === "function"
      ? () => navigator.scheduling.isInputPending()
      : () => false);
  const setTimeoutFn = deps.setTimeout || (typeof setTimeout !== "undefined" ? setTimeout : undefined);

  // Each rung: an explicit `key in deps` check so a caller can pass `null`
  // to DISABLE a rung (forcing fallthrough) — `deps.x || ambient` alone could
  // never distinguish "omitted" from "deliberately disabled" (both falsy).
  const schedulerYield = "schedulerYield" in deps
    ? deps.schedulerYield
    : (typeof scheduler !== "undefined" && typeof scheduler.yield === "function" ? () => scheduler.yield() : undefined);
  const schedulerPostTask = "schedulerPostTask" in deps
    ? deps.schedulerPostTask
    : (typeof scheduler !== "undefined" && typeof scheduler.postTask === "function"
      ? (fn, opts) => scheduler.postTask(fn, opts) : undefined);
  const createMessageChannel = "createMessageChannel" in deps
    ? deps.createMessageChannel
    : (typeof MessageChannel !== "undefined" ? () => new MessageChannel() : undefined);

  let mechanism;
  let yieldToMain;
  if (typeof deps.yieldToMain === "function") {
    mechanism = "override";
    yieldToMain = deps.yieldToMain;
  } else if (schedulerYield) {
    mechanism = "scheduler.yield";
    yieldToMain = () => Promise.resolve(schedulerYield());
  } else if (schedulerPostTask) {
    mechanism = "scheduler.postTask";
    yieldToMain = () => new Promise((resolve) => schedulerPostTask(resolve));
  } else if (createMessageChannel) {
    mechanism = "message-channel";
    yieldToMain = () => new Promise((resolve) => {
      const { port1, port2 } = createMessageChannel();
      port1.onmessage = () => { if (typeof port1.close === "function") port1.close(); resolve(); };
      port2.postMessage(null);
    });
  } else {
    mechanism = "timeout";
    yieldToMain = () => new Promise((resolve) => (setTimeoutFn ? setTimeoutFn(resolve, 0) : resolve()));
  }

  /**
   * Run `perItem` over `items` in budgeted batches, yielding between them —
   * AC1's core primitive. The FIRST batch is budgeted identically to every
   * later one (see this module's header). Always makes progress: at least
   * one item runs per batch, even under a near-zero budget or a
   * persistently-pending input signal, so the loop can never stall.
   * @param {ArrayLike<unknown>} items
   * @param {(item: unknown, index: number) => void} perItem
   * @param {{ budgetMs?: number }} [opts]
   * @returns {Promise<void>} resolves once every item has run.
   */
  async function chunk(items, perItem, opts = {}) {
    const budgetMs = typeof opts.budgetMs === "number" ? opts.budgetMs : DEFAULT_BUDGET_MS;
    const n = items.length;
    let i = 0;
    while (i < n) {
      const batchStart = now();
      do {
        perItem(items[i], i);
        i++;
      } while (i < n && (now() - batchStart) < budgetMs && !isInputPending());
      if (i < n) await yieldToMain();
    }
  }

  /** `requestIdleCallback`, DI'd + ambient-guarded (with a `setTimeout` shim
   *  fallback for an environment with neither). @returns {unknown} the
   *  underlying request id (implementation-defined; not currently cancelled
   *  by this module — no consumer needs cancellation this slice). */
  function runWhenIdle(fn, opts) {
    const ric = deps.requestIdleCallback
      || (typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback
        : (cb) => (setTimeoutFn
          ? setTimeoutFn(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 1)
          : cb({ didTimeout: true, timeRemaining: () => 0 })));
    return ric(fn, opts);
  }

  /** `requestAnimationFrame`, DI'd + ambient-guarded (with a `setTimeout`
   *  shim fallback). @returns {unknown} the underlying request id. */
  function runBeforePaint(fn) {
    const raf = deps.requestAnimationFrame
      || (typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb) => (setTimeoutFn ? setTimeoutFn(() => cb(now()), 16) : cb(now())));
    return raf(fn);
  }

  return { chunk, yieldToMain, runWhenIdle, runBeforePaint, mechanism };
}
