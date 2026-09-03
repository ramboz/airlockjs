// adapters/eds/dom-apply.js unit tests (spec 025-02 AC4/AC5b/AC6) — the
// main-thread apply coordinator: receives op batches from the DOM chamber
// (core/worker-dom/protocol.js's wire contract) and applies them to the
// REAL DOM via an id->node map, FRAME-BUDGETED through core/scheduler.js's
// chunk (AC4) and gated by core/worker-dom/apply-policy.js's safety
// allowlist (AC6). No jsdom in this repo (deliberate — see
// core/sanitize-html.js's header) — a tiny hand-rolled element/document
// shim, mirroring test/eds-dom-reserve.test.js's `fakeEl`/`fakeDoc`
// convention.
import { describe, it, expect, vi } from "vitest";
import { createDomApplyCoordinator } from "../adapters/eds/dom-apply.js";
import { createScheduler } from "../core/scheduler.js";
import { OP, BODY_ID } from "../core/worker-dom/protocol.js";

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance(ms) { t += ms; } };
}

// A tiny element shim — records every mutation applied to it so tests can
// assert on the REAL apply outcome, not just "didn't throw".
function fakeEl(tag) {
  const attrs = {};
  const style = {};
  const classes = new Set();
  const children = [];
  return {
    __tag: tag,
    __attrs: attrs,
    style,
    children,
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    appendChild(child) { children.push(child); return child; },
    classList: {
      add: (n) => classes.add(n),
      remove: (n) => classes.delete(n),
      toggle: (n) => (classes.has(n) ? (classes.delete(n), false) : (classes.add(n), true)),
      contains: (n) => classes.has(n),
    },
    get textContent() { return this.__text || ""; },
    set textContent(v) { this.__text = v; },
    get innerHTML() { return this.__html || ""; },
    set innerHTML(v) { this.__html = v; },
  };
}

// A fakeDoc whose createElement/createTextNode calls are the "cost" hooks
// AC5b's heavy-stream tests advance a fake clock through — cost lives HERE
// (not inside dom-apply.js) so the coordinator needs no test-only hook.
function fakeDocument({ onCreate } = {}) {
  return {
    createElement(tag) {
      if (onCreate) onCreate();
      return fakeEl(tag);
    },
    createTextNode(text) {
      if (onCreate) onCreate();
      const t = fakeEl("#text");
      t.textContent = text;
      return t;
    },
  };
}

describe("createDomApplyCoordinator — applies each op kind to the real DOM (AC4)", () => {
  it("createElement + appendChild: builds a real element and links it under the pre-seeded root (BODY_ID)", async () => {
    const root = fakeEl("body");
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { root, now: () => 0, yieldToMain: () => Promise.resolve() });
    const result = await coordinator.applyOps([
      { op: OP.CREATE_ELEMENT, id: "n1", tag: "div" },
      { op: OP.APPEND_CHILD, parentId: BODY_ID, childId: "n1" },
    ]);
    expect(result).toEqual({ applied: 2, refused: 0, total: 2 });
    expect(root.children).toHaveLength(1);
    expect(root.children[0].__tag).toBe("div");
  });

  it("setAttribute: sets the attribute on the resolved node", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "span" }]);
    const { applied } = await coordinator.applyOps([{ op: OP.SET_ATTRIBUTE, id: "n1", name: "data-x", value: "1" }]);
    expect(applied).toBe(1);
    expect(coordinator.resolve("n1").getAttribute("data-x")).toBe("1");
  });

  it("setStyle: writes el.style[prop]", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }]);
    await coordinator.applyOps([{ op: OP.SET_STYLE, id: "n1", prop: "transform", value: "translateY(1px)" }]);
    expect(coordinator.resolve("n1").style.transform).toBe("translateY(1px)");
  });

  it("setText: writes textContent (works for both a createText id and a createElement id)", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_TEXT, id: "t1", text: "hi" }]);
    await coordinator.applyOps([{ op: OP.SET_TEXT, id: "t1", text: "bye" }]);
    expect(coordinator.resolve("t1").textContent).toBe("bye");
  });

  it("classAdd/classRemove/classToggle route to the resolved node's classList", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }]);
    await coordinator.applyOps([{ op: OP.CLASS_ADD, id: "n1", name: "x" }]);
    expect(coordinator.resolve("n1").classList.contains("x")).toBe(true);
    await coordinator.applyOps([{ op: OP.CLASS_REMOVE, id: "n1", name: "x" }]);
    expect(coordinator.resolve("n1").classList.contains("x")).toBe(false);
  });

  it("an op referencing an UNKNOWN id is safely skipped (never throws), diagnosed", async () => {
    const doc = fakeDocument();
    const diagnostics = [];
    const coordinator = createDomApplyCoordinator(doc, {
      now: () => 0, yieldToMain: () => Promise.resolve(), onDiagnostic: (r) => diagnostics.push(r),
    });
    const result = await coordinator.applyOps([{ op: OP.SET_ATTRIBUTE, id: "ghost", name: "id", value: "x" }]);
    expect(result).toEqual({ applied: 0, refused: 1, total: 1 });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].kind).toBe("dom-apply-unknown-id");
  });

  it("an appendChild referencing an unknown parent OR child id is safely skipped", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }]);
    const result = await coordinator.applyOps([{ op: OP.APPEND_CHILD, parentId: "ghost", childId: "n1" }]);
    expect(result.refused).toBe(1);
  });

  it("an unknown op name is refused, never throws", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    const result = await coordinator.applyOps([{ op: "eval", id: "n1" }]);
    expect(result.refused).toBe(1);
  });

  it("no diagnostics on an all-benign batch (no surfacing noise on the happy path)", async () => {
    const doc = fakeDocument();
    const diagnostics = [];
    const coordinator = createDomApplyCoordinator(doc, {
      now: () => 0, yieldToMain: () => Promise.resolve(), onDiagnostic: (r) => diagnostics.push(r),
    });
    await coordinator.applyOps([
      { op: OP.CREATE_ELEMENT, id: "n1", tag: "div" },
      { op: OP.SET_ATTRIBUTE, id: "n1", name: "id", value: "x" },
    ]);
    expect(diagnostics).toEqual([]);
  });
});

describe("createDomApplyCoordinator — DRIVES core/scheduler.js's chunk, not a hand-rolled loop (AC4)", () => {
  it("a caller-supplied `scheduler` FULLY overrides the default (mirrors adapters/eds/scheduled-dom.js's seam)", async () => {
    const chunkSpy = vi.fn(async (items, perItem) => {
      for (const [i, item] of items.entries()) perItem(item, i);
    });
    const customScheduler = { chunk: chunkSpy, mechanism: "custom" };
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { scheduler: customScheduler });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }]);
    expect(chunkSpy).toHaveBeenCalledTimes(1);
    expect(coordinator.mechanism).toBe("custom");
  });

  it("actually routes through a REAL core/scheduler.js instance (injected here; the default-construction path is covered by the first-chunk-discipline test) — not a parallel reimplementation", async () => {
    const realScheduler = createScheduler({ now: () => 0, yieldToMain: () => Promise.resolve() });
    const chunkSpy = vi.spyOn(realScheduler, "chunk");
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { scheduler: realScheduler });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }, { op: OP.CREATE_ELEMENT, id: "n2", tag: "span" }]);
    expect(chunkSpy).toHaveBeenCalledTimes(1);
  });

  it("FIRST-CHUNK DISCIPLINE: the first batch is budgeted exactly like core/scheduler.js's own chunk() would budget it", async () => {
    const clock = fakeClock();
    const yieldToMain = vi.fn(() => Promise.resolve());
    const doc = fakeDocument({ onCreate: () => clock.advance(3) }); // each apply "costs" 3ms
    const coordinator = createDomApplyCoordinator(doc, { now: clock.now, yieldToMain, budgetMs: 5 });
    const ops = [0, 1, 2, 3, 4].map((i) => ({ op: OP.CREATE_ELEMENT, id: `n${i}`, tag: "div" }));
    const p = coordinator.applyOps(ops);
    // Synchronously (before awaiting `p`): only the budgeted FIRST batch ran
    // (3ms/op, budget 5ms -> 2 items before the first yield) — no
    // capability-side un-chunked prefix ran ahead of scheduler.chunk's own
    // first-batch budgeting.
    expect(yieldToMain).toHaveBeenCalledTimes(1);
    await p;
    expect(yieldToMain.mock.calls.length).toBeGreaterThan(1); // more than one batch was needed overall
  });

  it("opts.budgetMs overrides the coordinator's own default per-call", async () => {
    const chunkSpy = vi.fn(async () => {});
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { scheduler: { chunk: chunkSpy, mechanism: "stub" }, budgetMs: 5 });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }], { budgetMs: 42 });
    expect(chunkSpy).toHaveBeenCalledWith(
      [{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }],
      expect.any(Function),
      { budgetMs: 42 },
    );
  });
});

describe("safety allowlist integration — hostile vs benign op streams (AC6)", () => {
  it("REFUSES createElement('script') — no node created, diagnosed", async () => {
    const doc = fakeDocument();
    const diagnostics = [];
    const coordinator = createDomApplyCoordinator(doc, {
      now: () => 0, yieldToMain: () => Promise.resolve(), onDiagnostic: (r) => diagnostics.push(r),
    });
    const result = await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "script" }]);
    expect(result).toEqual({ applied: 0, refused: 1, total: 1 });
    expect(coordinator.resolve("n1")).toBeNull();
    expect(diagnostics[0]).toMatchObject({ level: "warn", kind: "dom-apply-refused" });
  });

  it("REFUSES setAttribute('onclick', ...) on an otherwise-valid element — the attribute is never set", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }]);
    const result = await coordinator.applyOps([{ op: OP.SET_ATTRIBUTE, id: "n1", name: "onclick", value: "alert(1)" }]);
    expect(result.refused).toBe(1);
    expect(coordinator.resolve("n1").getAttribute("onclick")).toBeNull();
  });

  it("REFUSES createElement('style')", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    const result = await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "style" }]);
    expect(result.refused).toBe(1);
  });

  it("REFUSES a style value carrying url(...) — via BOTH setStyle and setAttribute(name:'style')", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }]);
    const r1 = await coordinator.applyOps([{ op: OP.SET_STYLE, id: "n1", prop: "background", value: "url(https://evil.example/x)" }]);
    const r2 = await coordinator.applyOps([{ op: OP.SET_ATTRIBUTE, id: "n1", name: "style", value: "background:url(https://evil.example/x)" }]);
    expect(r1.refused).toBe(1);
    expect(r2.refused).toBe(1);
    expect(coordinator.resolve("n1").style.background).toBeUndefined();
  });

  it("the BENIGN synthetic-tag-shaped stream (div/span, id/data-*/style.transform) applies FULLY — zero refused", async () => {
    const root = fakeEl("body");
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { root, now: () => 0, yieldToMain: () => Promise.resolve() });
    const ops = [
      { op: OP.CREATE_ELEMENT, id: "n1", tag: "div" },
      { op: OP.APPEND_CHILD, parentId: BODY_ID, childId: "n1" },
      { op: OP.SET_STYLE, id: "n1", prop: "transform", value: "translateY(1px)" },
      { op: OP.CREATE_ELEMENT, id: "n2", tag: "span" },
      { op: OP.APPEND_CHILD, parentId: BODY_ID, childId: "n2" },
      { op: OP.SET_ATTRIBUTE, id: "n2", name: "id", value: "wd-status" },
      { op: OP.SET_ATTRIBUTE, id: "n2", name: "data-completed", value: "0" },
      { op: OP.SET_ATTRIBUTE, id: "n2", name: "data-clicks", value: "0" },
    ];
    const result = await coordinator.applyOps(ops);
    expect(result).toEqual({ applied: ops.length, refused: 0, total: ops.length });
  });

  it("a MIXED stream applies the benign ops and refuses only the hostile ones (per-op, not all-or-nothing)", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    const result = await coordinator.applyOps([
      { op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }, // ok
      { op: OP.CREATE_ELEMENT, id: "n2", tag: "script" }, // refused
      { op: OP.SET_ATTRIBUTE, id: "n1", name: "id", value: "x" }, // ok
    ]);
    expect(result).toEqual({ applied: 2, refused: 1, total: 3 });
  });
});

describe("setInnerHTML — SANITIZED apply (spec 025-03 AC1/AC3, the innerHTML security write-path)", () => {
  it("applies via el.innerHTML = sanitize(html) — the INJECTED sanitize seam runs BEFORE the real write (hermetic wiring proof — no DOMParser in Node, see core/sanitize-html.js's own substrate note)", async () => {
    const doc = fakeDocument();
    const sanitize = vi.fn((html) => html.replace(/<script>.*?<\/script>/g, ""));
    const coordinator = createDomApplyCoordinator(doc, {
      now: () => 0, yieldToMain: () => Promise.resolve(), sanitize,
    });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "code" }]);
    const raw = '<span class="token">ok</span><script>alert(1)</script>';
    const result = await coordinator.applyOps([{ op: OP.SET_INNER_HTML, id: "n1", html: raw }]);
    expect(result).toEqual({ applied: 1, refused: 0, total: 1 });
    expect(sanitize).toHaveBeenCalledWith(raw);
    expect(coordinator.resolve("n1").innerHTML).toBe('<span class="token">ok</span>'); // sanitized, not raw
  });

  it("defaults `sanitize` to the REAL core/sanitize-html.js sanitizeHtml (no injection needed to construct the coordinator)", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "code" }]);
    // No DOMParser in Node (core/sanitize-html.js's own documented substrate
    // boundary) -> the REAL default sanitizer fails SAFE to "" here; this
    // proves the DEFAULT is actually wired (not merely documented), not that
    // it strips real HTML (that proof is the browser rig — AC3's real proof).
    const result = await coordinator.applyOps([{ op: OP.SET_INNER_HTML, id: "n1", html: "<b>hi</b>" }]);
    expect(result.applied).toBe(1);
    expect(coordinator.resolve("n1").innerHTML).toBe("");
  });

  it("an op referencing an UNKNOWN id is safely skipped, never throws", async () => {
    const doc = fakeDocument();
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve() });
    const result = await coordinator.applyOps([{ op: OP.SET_INNER_HTML, id: "ghost", html: "<b>hi</b>" }]);
    expect(result).toEqual({ applied: 0, refused: 1, total: 1 });
  });

  it("a non-string html is coerced safely (sanitizeHtml's own non-string -> \"\" contract), never throws", async () => {
    const doc = fakeDocument();
    const sanitize = vi.fn(() => "");
    const coordinator = createDomApplyCoordinator(doc, { now: () => 0, yieldToMain: () => Promise.resolve(), sanitize });
    await coordinator.applyOps([{ op: OP.CREATE_ELEMENT, id: "n1", tag: "code" }]);
    const result = await coordinator.applyOps([{ op: OP.SET_INNER_HTML, id: "n1", html: null }]);
    expect(result.applied).toBe(1);
    expect(sanitize).toHaveBeenCalledWith(null);
  });

  it("the mixed BENIGN Prism-shaped stream (createElement/appendChild/className via classAdd/setInnerHTML) applies fully — zero refused", async () => {
    const root = fakeEl("body");
    const doc = fakeDocument();
    const sanitize = (html) => html; // identity — proves the STREAM shape, not the sanitizer's own strip logic
    const coordinator = createDomApplyCoordinator(doc, { root, now: () => 0, yieldToMain: () => Promise.resolve(), sanitize });
    const ops = [
      { op: OP.CREATE_ELEMENT, id: "pre1", tag: "pre" },
      { op: OP.APPEND_CHILD, parentId: BODY_ID, childId: "pre1" },
      { op: OP.CREATE_ELEMENT, id: "code1", tag: "code" },
      { op: OP.APPEND_CHILD, parentId: "pre1", childId: "code1" },
      { op: OP.CLASS_ADD, id: "code1", name: "language-javascript" }, // className's classList-backed write
      { op: OP.SET_INNER_HTML, id: "code1", html: '<span class="token keyword">const</span> x = 1;' },
    ];
    const result = await coordinator.applyOps(ops);
    expect(result).toEqual({ applied: ops.length, refused: 0, total: ops.length });
    expect(coordinator.resolve("code1").innerHTML).toBe('<span class="token keyword">const</span> x = 1;');
  });
});

describe("AC5b — the falsifiable apply-INP proof: a HEAVY apply stream stays budget-bounded, chunked+yielding", () => {
  const PER_OP_COST_MS = 1; // deterministic fake "main-thread cost" per applied op
  const BUDGET_MS = 5;

  function heavyOpStream(n) {
    // node/attribute churn: create + append + a style write per element —
    // genuinely heavy ON THE MAIN THREAD (unlike 5a's ~400 light writes),
    // "a few thousand ops" per the AC's own floor.
    const ops = [];
    for (let i = 0; i < n; i++) {
      const id = `h${i}`;
      ops.push({ op: OP.CREATE_ELEMENT, id, tag: "div" });
      ops.push({ op: OP.APPEND_CHILD, parentId: BODY_ID, childId: id });
      ops.push({ op: OP.SET_STYLE, id, prop: "transform", value: `translateY(${i}px)` });
    }
    return ops;
  }

  it("the FRAME-BUDGETED apply produces NO batch whose cost exceeds the budget — chunked + yielding", async () => {
    const N = 2000; // 6000 ops total — comfortably "a few thousand"
    const ops = heavyOpStream(N);
    const root = fakeEl("body");
    const clock = fakeClock();
    const batchCosts = [];
    let currentBatchCost = 0;
    const yieldToMain = vi.fn(() => { batchCosts.push(currentBatchCost); currentBatchCost = 0; return Promise.resolve(); });
    const doc = fakeDocument({ onCreate: () => { clock.advance(PER_OP_COST_MS); currentBatchCost += PER_OP_COST_MS; } });
    const coordinator = createDomApplyCoordinator(doc, { root, now: clock.now, yieldToMain, budgetMs: BUDGET_MS });

    await coordinator.applyOps(ops);
    batchCosts.push(currentBatchCost); // the final (post-last-yield) batch never triggered another yield

    expect(yieldToMain.mock.calls.length).toBeGreaterThan(1); // genuinely chunked into MULTIPLE batches
    // NO single batch's cost exceeds the budget by more than one item's
    // worth (core/scheduler.js's own "always makes progress" guarantee —
    // at least 1 item/batch even under a tight budget — so the bound is
    // "at most ceil(budget/cost)+1 items", never "the whole stream").
    const maxItemsPerBudget = Math.ceil(BUDGET_MS / PER_OP_COST_MS) + 1;
    for (const cost of batchCosts) {
      expect(cost).toBeLessThanOrEqual(maxItemsPerBudget * PER_OP_COST_MS);
    }
    // decisively bounded vs the total: no batch is anywhere near the FULL cost.
    const totalCreateOps = N; // only createElement/createTextNode advance the clock (the "cost" hook)
    for (const cost of batchCosts) {
      expect(cost).toBeLessThan(totalCreateOps * PER_OP_COST_MS);
    }
  });

  it("the CONTRAST — the SAME heavy stream applied NAIVELY (one synchronous loop, no coordinator) is ONE unbounded run", () => {
    const N = 2000;
    const ops = heavyOpStream(N);
    const clock = fakeClock();
    const doc = fakeDocument({ onCreate: () => clock.advance(PER_OP_COST_MS) });
    const nodes = new Map();
    nodes.set(BODY_ID, fakeEl("body"));

    // A hand-rolled, un-chunked apply — deliberately NOT going through
    // createDomApplyCoordinator/core/scheduler.js — the "naive" baseline
    // AC5b's contrast names.
    function applyNaively(op) {
      switch (op.op) {
        case OP.CREATE_ELEMENT: nodes.set(op.id, doc.createElement(op.tag)); break;
        case OP.APPEND_CHILD: {
          const parent = nodes.get(op.parentId);
          const child = nodes.get(op.childId);
          if (parent && child) parent.appendChild(child);
          break;
        }
        case OP.SET_STYLE: {
          const el = nodes.get(op.id);
          if (el) el.style[op.prop] = op.value;
          break;
        }
        default: break;
      }
    }

    const before = clock.now();
    for (const op of ops) applyNaively(op); // ONE synchronous task, no yield
    const elapsed = clock.now() - before;

    // The ENTIRE apply cost lands in one synchronous run: exactly
    // N * PER_OP_COST_MS (one clock advance per created element), NOT
    // budget-bounded at all — the contrast AC5b's falsifiability rests on.
    expect(elapsed).toBe(N * PER_OP_COST_MS);
    expect(elapsed).toBeGreaterThan(BUDGET_MS * 10); // decisively over any reasonable frame budget
  });
});

describe("AC6 hardening — a real-DOM throw must NOT crash the batch (025-02 review, both passes)", () => {
  it("an op that throws at the real DOM (cyclic appendChild -> HierarchyRequestError, which the policy cannot predict) is refused+diagnosed, and the REST of the batch still applies", async () => {
    const diags = [];
    // A fake whose appendChild THROWS — simulating a real-DOM HierarchyRequestError
    // the allowlist cannot predict without tree state (append IS allowlisted, so
    // this exercises applyOne's try/catch, not the policy). Before the fix, this
    // throw rejected applyOps and dropped the remaining ops.
    const doc = {
      createElement(tag) {
        return {
          __tag: tag,
          style: {},
          setAttribute(k, v) { this["a_" + k] = String(v); },
          appendChild() { const e = new Error("HierarchyRequestError"); e.name = "HierarchyRequestError"; throw e; },
          classList: { add() {}, remove() {}, toggle() {} },
        };
      },
      createTextNode(text) { return { __text: text }; },
    };
    const coordinator = createDomApplyCoordinator(doc, {
      scheduler: createScheduler({ now: () => 0, yieldToMain: () => Promise.resolve() }),
      onDiagnostic: (d) => diags.push(d),
    });

    const result = await coordinator.applyOps([
      { op: OP.CREATE_ELEMENT, id: "n1", tag: "div" },
      { op: OP.CREATE_ELEMENT, id: "n2", tag: "span" },
      { op: OP.APPEND_CHILD, parentId: "n1", childId: "n2" }, // THROWS at the real DOM
      { op: OP.SET_ATTRIBUTE, id: "n1", name: "data-ok", value: "1" }, // must STILL apply
    ]);

    expect(result.applied).toBe(3); // n1, n2, the trailing setAttribute — the batch survived
    expect(result.refused).toBe(1); // the throwing append, refused not fatal
    expect(result.total).toBe(4);
    expect(diags.some((d) => d.kind === "dom-apply-threw")).toBe(true); // diagnosed, not silent
  });
});
