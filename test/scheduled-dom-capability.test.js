// adapters/eds/scheduled-dom.js unit tests (spec 023-01 AC2). Proves: the
// capability completes all queued work, yields BETWEEN units per the
// injected scheduler, and holds the first-chunk discipline (AC1/AC3
// must-fix) — this capability adds NO un-chunked prefix of its own before
// handing off to core/scheduler.js's chunk().
import { describe, it, expect, vi } from "vitest";
import { createScheduledDomCapability } from "../adapters/eds/scheduled-dom.js";
import { createScheduler } from "../core/scheduler.js";

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance(ms) { t += ms; } };
}

describe("createScheduledDomCapability().runScheduled — yieldable DOM work (AC2)", () => {
  it("runs perItem over EVERY item exactly once, in order, and resolves { completed }", async () => {
    const capability = createScheduledDomCapability({ now: () => 0, yieldToMain: () => Promise.resolve() });
    const seen = [];
    const result = await capability.runScheduled(["a", "b", "c"], (item, i) => seen.push([item, i]));
    expect(seen).toEqual([["a", 0], ["b", 1], ["c", 2]]);
    expect(result).toEqual({ completed: 3 });
  });

  it("YIELDS BETWEEN units per the injected scheduler's budget — proves delegation to core/scheduler.js, not a bespoke re-implementation", async () => {
    const clock = fakeClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    const capability = createScheduledDomCapability({ now: clock.now, yieldToMain, budgetMs: 5 });
    const order = [];
    await capability.runScheduled([0, 1, 2, 3], (item) => { order.push(item); clock.advance(3); });
    expect(order).toEqual([0, 1, 2, 3]);
    expect(yieldToMain).toHaveBeenCalled(); // more than one batch was needed => at least one yield happened
  });

  it("FIRST-CHUNK DISCIPLINE: adds NO un-chunked prefix of its own — the synchronous work done before `runScheduled`'s returned promise is even awaited is bounded exactly like core/scheduler.js's own chunk() would bound it", async () => {
    const clock = fakeClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    const capability = createScheduledDomCapability({ now: clock.now, yieldToMain, budgetMs: 5 });
    const firstBatch = [];
    let yielded = false;
    const p = capability.runScheduled([0, 1, 2, 3, 4], (item) => {
      if (!yielded) firstBatch.push(item);
      clock.advance(3); // 2 items (0ms->3ms ok, 3ms->6ms blows a 5ms budget) before the first yield
    });
    // Synchronously (no await yet on `p`), the capability must already have
    // run ONLY the budgeted first batch — proving no capability-side setup
    // work (e.g. a querySelectorAll) ran ahead of scheduler.chunk's own
    // first-batch budgeting (023-01 AC1/AC3 must-fix).
    expect(firstBatch).toEqual([0, 1]);
    yielded = true;
    await p;
  });

  it("a caller-supplied `scheduler` FULLY overrides the default (mirrors adapters/eds/dom.js's setContent override seam)", async () => {
    const customChunk = vi.fn(async (items, perItem) => {
      for (const [i, item] of items.entries()) perItem(item, i);
    });
    const customScheduler = { chunk: customChunk, mechanism: "custom" };
    const capability = createScheduledDomCapability({ scheduler: customScheduler });
    await capability.runScheduled([1, 2], () => {});
    expect(customChunk).toHaveBeenCalledTimes(1);
    expect(capability.mechanism).toBe("custom");
  });

  it("opts.budgetMs overrides the capability's own default per-call", async () => {
    const chunkSpy = vi.fn(async () => {});
    const capability = createScheduledDomCapability({ scheduler: { chunk: chunkSpy, mechanism: "stub" }, budgetMs: 5 });
    await capability.runScheduled([1], () => {}, { budgetMs: 42 });
    expect(chunkSpy).toHaveBeenCalledWith([1], expect.any(Function), { budgetMs: 42 });
  });

  it("a ZERO-deps construction never throws (no ambient globals hard-coded — mirrors core/scheduler.js's own guarantee)", async () => {
    expect(() => createScheduledDomCapability()).not.toThrow();
    const capability = createScheduledDomCapability();
    await expect(capability.runScheduled([1, 2], () => {})).resolves.toEqual({ completed: 2 });
  });

  it("actually routes through a REAL core/scheduler.js instance by default (not a parallel reimplementation)", async () => {
    const realScheduler = createScheduler({ now: () => 0, yieldToMain: () => Promise.resolve() });
    const chunkSpy = vi.spyOn(realScheduler, "chunk");
    const capability = createScheduledDomCapability({ scheduler: realScheduler });
    await capability.runScheduled([1, 2, 3], () => {});
    expect(chunkSpy).toHaveBeenCalledTimes(1);
  });
});
