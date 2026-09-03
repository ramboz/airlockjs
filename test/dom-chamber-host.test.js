// core/dom-chamber-host.js unit tests (spec 025-02 AC2/AC3a) — the TESTABLE
// core the (thin, self-guarded) core/dom-chamber.worker.js wires to
// self.onmessage, mirroring how core/connector-host.js is the testable core
// core/chamber.worker.js wires up (chamber-isolation.test.js's own pattern —
// never import a *.worker.js file directly; test the host it delegates to).
//
// THE LOAD-BEARING PROOF: this test reads rig/worker-dom-nasty-tag-author.js
// — the SAME file 025-01's rig runs against @ampproject/worker-dom — BYTE-
// UNMODIFIED FROM DISK (no copy, no edit) and runs it against this host's
// injected mirror `document`. That IS AC2's "no per-tag code changes" claim,
// grounded directly against the real fixture file, not a paraphrase of it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createDomChamberHost } from "../core/dom-chamber-host.js";
import { OP, DOCUMENT_ID } from "../core/worker-dom/protocol.js";

const AUTHOR_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "rig", "worker-dom-nasty-tag-author.js"),
  "utf8",
);

function findOps(ops, predicate) { return ops.filter(predicate); }
function lastOp(ops, predicate) {
  const matches = findOps(ops, predicate);
  return matches[matches.length - 1];
}

describe("createDomChamberHost().boot — runs the BYTE-UNMODIFIED synthetic tag (AC2)", () => {
  it("never throws booting the real, unmodified rig/worker-dom-nasty-tag-author.js fixture", () => {
    const host = createDomChamberHost();
    expect(() => host.boot({ authorSource: AUTHOR_SOURCE, elements: 5, workUs: 0 })).not.toThrow();
  });

  it("boot-time collection creates ELEMENTS divs + one status span, all appended to document.body", () => {
    const host = createDomChamberHost();
    const ops = host.boot({ authorSource: AUTHOR_SOURCE, elements: 5, workUs: 0 });
    expect(findOps(ops, (o) => o.op === OP.CREATE_ELEMENT && o.tag === "div")).toHaveLength(5);
    expect(findOps(ops, (o) => o.op === OP.CREATE_ELEMENT && o.tag === "span")).toHaveLength(1);
    expect(findOps(ops, (o) => o.op === OP.APPEND_CHILD)).toHaveLength(6); // 5 divs + 1 status span
  });

  it("the status span is stamped with its id ('wd-status') via the PROPERTY setter path (author.js:39)", () => {
    const host = createDomChamberHost();
    const ops = host.boot({ authorSource: AUTHOR_SOURCE, elements: 3, workUs: 0 });
    const idOp = lastOp(ops, (o) => o.op === OP.SET_ATTRIBUTE && o.name === "id");
    expect(idOp.value).toBe("wd-status");
  });

  it("boot-time status attributes are initialized: data-completed=0, data-clicks=0, data-collect-ms set", () => {
    const host = createDomChamberHost();
    const ops = host.boot({ authorSource: AUTHOR_SOURCE, elements: 3, workUs: 0 });
    expect(lastOp(ops, (o) => o.name === "data-completed").value).toBe("0");
    expect(lastOp(ops, (o) => o.name === "data-clicks").value).toBe("0");
    expect(findOps(ops, (o) => o.name === "data-collect-ms")).toHaveLength(1);
  });

  it("the __ELEMENTS__/__WORK_US__ template placeholders are substituted (the same convention the existing rig uses server-side)", () => {
    const host = createDomChamberHost();
    // elements=7 -> exactly 7 divs created, proving the placeholder substitution actually took the injected count
    const ops = host.boot({ authorSource: AUTHOR_SOURCE, elements: 7, workUs: 0 });
    expect(findOps(ops, (o) => o.op === OP.CREATE_ELEMENT && o.tag === "div")).toHaveLength(7);
  });
});

describe("createDomChamberHost().dispatchEvent — the storm ACTUALLY FIRES (AC3a, the frame-critique fix)", () => {
  it("forwarding a click to DOCUMENT_ID invokes the tag's own document.addEventListener('click', ...) listener", () => {
    const host = createDomChamberHost();
    host.boot({ authorSource: AUTHOR_SOURCE, elements: 4, workUs: 0 });
    const ops = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    // one click over 4 items -> 4 style.transform writes (the storm's WRITE) + 2 status attribute updates
    expect(findOps(ops, (o) => o.op === OP.SET_STYLE && o.prop === "transform")).toHaveLength(4);
    expect(lastOp(ops, (o) => o.name === "data-completed").value).toBe("4");
    expect(lastOp(ops, (o) => o.name === "data-clicks").value).toBe("1");
  });

  it("a SECOND dispatch fires the storm again — workCompleted/clicks accumulate (mirrors a real multi-click storm)", () => {
    const host = createDomChamberHost();
    host.boot({ authorSource: AUTHOR_SOURCE, elements: 4, workUs: 0 });
    host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    const ops2 = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    expect(lastOp(ops2, (o) => o.name === "data-completed").value).toBe("8");
    expect(lastOp(ops2, (o) => o.name === "data-clicks").value).toBe("2");
  });

  it("dispatching to an unknown targetId is a harmless no-op (never throws, no storm fires)", () => {
    const host = createDomChamberHost();
    host.boot({ authorSource: AUTHOR_SOURCE, elements: 4, workUs: 0 });
    expect(() => host.dispatchEvent({ targetId: "not-a-real-id", eventType: "click" })).not.toThrow();
    const ops = host.dispatchEvent({ targetId: "not-a-real-id", eventType: "click" });
    expect(ops).toEqual([]);
  });

  it("each dispatch call DRAINS only its own newly-recorded ops (no duplication, no loss across calls)", () => {
    const host = createDomChamberHost();
    const bootOps = host.boot({ authorSource: AUTHOR_SOURCE, elements: 4, workUs: 0 });
    const clickOps = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    // boot ops (creation) and click ops (style writes + status updates) are disjoint op kinds
    expect(findOps(bootOps, (o) => o.op === OP.SET_STYLE)).toHaveLength(0);
    expect(findOps(clickOps, (o) => o.op === OP.CREATE_ELEMENT)).toHaveLength(0);
  });
});
