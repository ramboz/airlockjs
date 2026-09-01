// core/scheduler.js unit tests (spec 023-01 AC1). Every test injects its own
// timing/yield fns — no real timers, no real-clock flake (AC1 + DoD: "via
// injected timing fns, no real-clock flake").
import { describe, it, expect, vi } from "vitest";
import { createScheduler } from "../core/scheduler.js";

// A controllable fake clock: advances only when the test tells it to, so a
// batch's "elapsed" time is fully deterministic (no real Date.now()/perf.now()).
function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance(ms) { t += ms; } };
}

describe("createScheduler().chunk — budgeted batches + yields (AC1)", () => {
  it("keeps the FIRST batch within budget — the first-chunk discipline (frame-critique must-fix)", async () => {
    const clock = fakeClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    const scheduler = createScheduler({ now: clock.now, yieldToMain });

    const order = [];
    // Each perItem call advances the fake clock by 3ms; budgetMs=5 means the
    // FIRST batch stops after 2 items (0ms->3ms ok, 3ms->6ms blows the 5ms
    // budget) — exactly like every later batch (no special-cased first pass).
    const perItem = (item) => { order.push(item); clock.advance(3); };

    const p = scheduler.chunk([0, 1, 2, 3, 4], perItem, { budgetMs: 5 });
    // Nothing has yielded yet: the WHOLE first batch already ran
    // SYNCHRONOUSLY, in the same call stack as the `chunk()` call itself —
    // the load-bearing INP fact (the first batch shares the interaction's
    // own task; a later yield cannot rescue a large first chunk).
    expect(order).toEqual([0, 1]);
    expect(yieldToMain).toHaveBeenCalledTimes(1);
    await p;
    expect(order).toEqual([0, 1, 2, 3, 4]); // all items eventually complete
  });

  it("budgets every LATER batch the same way as the first — no special-cased first pass", async () => {
    const clock = fakeClock();
    const batches = [[]];
    const yieldToMain = vi.fn(() => { batches.push([]); return Promise.resolve(); });
    const scheduler = createScheduler({ now: clock.now, yieldToMain });
    const perItem = (item) => { batches[batches.length - 1].push(item); clock.advance(3); };

    await scheduler.chunk([0, 1, 2, 3, 4, 5], perItem, { budgetMs: 5 });
    // Every batch (including the first) has AT MOST 2 items: 3ms+3ms=6ms >= 5ms budget.
    for (const b of batches) expect(b.length).toBeLessThanOrEqual(2);
    expect(batches.flat()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(yieldToMain.mock.calls.length).toBe(batches.length - 1);
  });

  it("yields BETWEEN batches — later work does not run until the yield resolves", async () => {
    let resolveYield;
    const yieldToMain = vi.fn(() => new Promise((r) => { resolveYield = r; }));
    const clock = fakeClock();
    const scheduler = createScheduler({ now: clock.now, yieldToMain });
    const order = [];
    const perItem = (item) => { order.push(item); clock.advance(10); }; // 1 item/batch @ budgetMs=5

    const p = scheduler.chunk([0, 1, 2], perItem, { budgetMs: 5 });
    expect(order).toEqual([0]); // only the first (synchronous) batch ran
    expect(typeof resolveYield).toBe("function");

    resolveYield();
    await Promise.resolve();
    await Promise.resolve(); // flush microtasks so chunk()'s continuation runs
    expect(order).toEqual([0, 1]); // second item only ran AFTER the yield resolved

    resolveYield(); // second yield
    await p;
    expect(order).toEqual([0, 1, 2]);
  });

  it("always makes progress — never stalls even under a near-zero budget", async () => {
    const clock = fakeClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    const scheduler = createScheduler({ now: clock.now, yieldToMain });
    const order = [];
    await scheduler.chunk([0, 1, 2], (item) => { order.push(item); clock.advance(1); }, { budgetMs: 0 });
    expect(order).toEqual([0, 1, 2]); // completes despite budgetMs:0 (>=1 item/batch guaranteed)
    expect(yieldToMain).toHaveBeenCalledTimes(2); // one yield between each of the 3 single-item batches
  });

  it("an isInputPending signal ends a batch early too — yields ASAP for a pending interaction", async () => {
    const clock = fakeClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    let pending = false;
    const scheduler = createScheduler({ now: clock.now, yieldToMain, isInputPending: () => pending });
    const order = [];
    // A budget so generous it would never itself stop the batch — only
    // isInputPending flipping true should end it early.
    const p = scheduler.chunk([0, 1, 2, 3], (item) => {
      order.push(item);
      if (item === 0) pending = true;
    }, { budgetMs: 1000 });
    expect(order).toEqual([0]);
    await p;
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it("resolves with every item processed exactly once, in order (index passed through too)", async () => {
    const scheduler = createScheduler({ now: () => 0, yieldToMain: () => Promise.resolve() });
    const order = [];
    await scheduler.chunk([10, 11, 12, 13], (item, i) => order.push([item, i]), { budgetMs: 5 });
    expect(order).toEqual([[10, 0], [11, 1], [12, 2], [13, 3]]);
  });
});

describe("createScheduler().yieldToMain — mechanism resolution (AC1)", () => {
  it("an injected FULL override (`deps.yieldToMain`) wins over everything else", async () => {
    const override = vi.fn(() => Promise.resolve());
    const schedulerYield = vi.fn();
    const scheduler = createScheduler({ yieldToMain: override, schedulerYield });
    await scheduler.yieldToMain();
    expect(override).toHaveBeenCalledTimes(1);
    expect(schedulerYield).not.toHaveBeenCalled();
    expect(scheduler.mechanism).toBe("override");
  });

  it("prefers the platform scheduler.yield() when available", async () => {
    const schedulerYield = vi.fn(() => Promise.resolve());
    const schedulerPostTask = vi.fn();
    const scheduler = createScheduler({ schedulerYield, schedulerPostTask });
    expect(scheduler.mechanism).toBe("scheduler.yield");
    await scheduler.yieldToMain();
    expect(schedulerYield).toHaveBeenCalledTimes(1);
    expect(schedulerPostTask).not.toHaveBeenCalled();
  });

  it("falls back to scheduler.postTask() when scheduler.yield is explicitly unavailable", async () => {
    const schedulerPostTask = vi.fn((fn) => fn());
    const scheduler = createScheduler({ schedulerYield: null, schedulerPostTask });
    expect(scheduler.mechanism).toBe("scheduler.postTask");
    await scheduler.yieldToMain();
    expect(schedulerPostTask).toHaveBeenCalledTimes(1);
  });

  it("falls back to a REAL MessageChannel round-trip when neither scheduler primitive is available — the fallback path, actually exercised (023-01 grounding)", async () => {
    // Node's own runtime has NO ambient `scheduler` global (confirmed at
    // implementation time — see this slice's deviation log), so passing
    // `null` for both scheduler-primitive deps reproduces the SAME
    // "nothing available" shape a pre-Scheduler-API browser would present.
    // It must fall through to the REAL, un-mocked global `MessageChannel`
    // (Node ships one natively) — not a stand-in — to prove the fallback
    // genuinely round-trips, not just that the right branch was taken.
    const scheduler = createScheduler({ schedulerYield: null, schedulerPostTask: null });
    expect(scheduler.mechanism).toBe("message-channel");
    await expect(scheduler.yieldToMain()).resolves.toBeUndefined();
  });

  it("falls back to setTimeout as the last resort when no channel is available either", async () => {
    const st = vi.fn((fn) => fn());
    const scheduler = createScheduler({
      schedulerYield: null, schedulerPostTask: null, createMessageChannel: null, setTimeout: st,
    });
    expect(scheduler.mechanism).toBe("timeout");
    await scheduler.yieldToMain();
    expect(st).toHaveBeenCalledTimes(1);
  });
});

describe("createScheduler().runWhenIdle / runBeforePaint — thin DI'd wrappers (AC1)", () => {
  it("runWhenIdle delegates to the injected requestIdleCallback-like fn", () => {
    const ric = vi.fn((fn) => fn({ didTimeout: false, timeRemaining: () => 10 }));
    const scheduler = createScheduler({ requestIdleCallback: ric });
    const cb = vi.fn();
    scheduler.runWhenIdle(cb, { timeout: 50 });
    expect(ric).toHaveBeenCalledWith(cb, { timeout: 50 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("runBeforePaint delegates to the injected requestAnimationFrame-like fn", () => {
    const raf = vi.fn((fn) => fn(123));
    const scheduler = createScheduler({ requestAnimationFrame: raf });
    const cb = vi.fn();
    scheduler.runBeforePaint(cb);
    expect(raf).toHaveBeenCalledWith(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("createScheduler() — no ambient globals hard-coded (AC1)", () => {
  it("a ZERO-deps construction never throws, even with none of scheduler/rIC/rAF ambiently defined (Node/vitest — confirmed at implementation time)", async () => {
    expect(() => createScheduler()).not.toThrow();
    const scheduler = createScheduler();
    await expect(scheduler.chunk([1, 2], () => {}, { budgetMs: 5 })).resolves.toBeUndefined();
  });
});
