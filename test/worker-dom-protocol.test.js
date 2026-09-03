// core/worker-dom/protocol.js unit tests (spec 025-02 AC3) — the WIRE
// CONTRACT both the worker-side mirror and the main-thread apply coordinator
// agree on: the two message envelopes, the reserved node ids, the mutation-op
// vocabulary, and a structuredClone() round-trip guard (the 022-04 lesson —
// a batch that carries a function/DOM ref throws DataCloneError at the real
// postMessage; this test catches that BEFORE it ever reaches one).
import { describe, it, expect } from "vitest";
import {
  DOCUMENT_ID,
  BODY_ID,
  OP,
  createEventMessage,
  createMutationsMessage,
  isEventMessage,
  isMutationsMessage,
  isStructuredCloneable,
} from "../core/worker-dom/protocol.js";

describe("reserved ids (AC3) — the pre-seeded anchors both sides agree on", () => {
  it("DOCUMENT_ID and BODY_ID are distinct, non-empty strings", () => {
    expect(typeof DOCUMENT_ID).toBe("string");
    expect(typeof BODY_ID).toBe("string");
    expect(DOCUMENT_ID.length).toBeGreaterThan(0);
    expect(BODY_ID.length).toBeGreaterThan(0);
    expect(DOCUMENT_ID).not.toBe(BODY_ID);
  });
});

describe("OP — the mutation-op vocabulary (AC3/AC7)", () => {
  it("is frozen (both sides read it, neither should be able to mutate the shared contract)", () => {
    expect(Object.isFrozen(OP)).toBe(true);
  });

  it("names every op this slice's mirror emits", () => {
    expect(OP).toMatchObject({
      CREATE_ELEMENT: "createElement",
      CREATE_TEXT: "createText",
      APPEND_CHILD: "appendChild",
      SET_ATTRIBUTE: "setAttribute",
      SET_STYLE: "setStyle",
      SET_TEXT: "setText",
      CLASS_ADD: "classAdd",
      CLASS_REMOVE: "classRemove",
      CLASS_TOGGLE: "classToggle",
    });
  });
});

describe("createEventMessage / isEventMessage — main->worker event forwarding (AC3a)", () => {
  it("builds the { type: 'event', targetId, eventType } envelope", () => {
    expect(createEventMessage(DOCUMENT_ID, "click")).toEqual({
      type: "event", targetId: DOCUMENT_ID, eventType: "click",
    });
  });

  it("isEventMessage recognizes a well-formed message and rejects everything else", () => {
    expect(isEventMessage(createEventMessage("n1", "click"))).toBe(true);
    expect(isEventMessage({ type: "mutations", ops: [] })).toBe(false);
    expect(isEventMessage(null)).toBe(false);
    expect(isEventMessage({ type: "event", targetId: 1, eventType: "click" })).toBe(false); // targetId must be a string
  });
});

describe("createMutationsMessage / isMutationsMessage — worker->main mutation flush (AC3b)", () => {
  it("builds the { type: 'mutations', ops } envelope", () => {
    const ops = [{ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" }];
    expect(createMutationsMessage(ops)).toEqual({ type: "mutations", ops });
  });

  it("defensively coerces a non-array ops to an empty array (never ships a malformed batch)", () => {
    expect(createMutationsMessage(null)).toEqual({ type: "mutations", ops: [] });
    expect(createMutationsMessage(undefined)).toEqual({ type: "mutations", ops: [] });
  });

  it("isMutationsMessage recognizes a well-formed message and rejects everything else", () => {
    expect(isMutationsMessage(createMutationsMessage([]))).toBe(true);
    expect(isMutationsMessage({ type: "event", targetId: "n1", eventType: "click" })).toBe(false);
    expect(isMutationsMessage({ type: "mutations", ops: "not-an-array" })).toBe(false);
    expect(isMutationsMessage(null)).toBe(false);
  });
});

describe("isStructuredCloneable — the DataCloneError boundary guard (AC3, the 022-04 lesson)", () => {
  it("true for a realistic PLAIN op batch (strings/numbers only)", () => {
    const ops = [
      { op: OP.CREATE_ELEMENT, id: "n1", tag: "div" },
      { op: OP.SET_ATTRIBUTE, id: "n1", name: "id", value: "wd-status" },
      { op: OP.SET_STYLE, id: "n1", prop: "transform", value: "translateY(1px)" },
      { op: OP.APPEND_CHILD, parentId: BODY_ID, childId: "n1" },
    ];
    expect(isStructuredCloneable(ops)).toBe(true);
    // the round-trip itself must not throw and must deep-equal the input —
    // the actual proof, not just a boolean.
    expect(structuredClone(ops)).toEqual(ops);
  });

  it("false for a batch carrying a function (would DataCloneError at a real postMessage)", () => {
    const hostile = [{ op: OP.SET_ATTRIBUTE, id: "n1", name: "onclick", value: () => {} }];
    expect(isStructuredCloneable(hostile)).toBe(false);
  });

  it("false for a batch carrying a Symbol value (another genuinely non-cloneable case, distinct from a function)", () => {
    const withSymbol = [{ op: OP.SET_ATTRIBUTE, id: "n1", name: "id", value: Symbol("nope") }];
    expect(isStructuredCloneable(withSymbol)).toBe(false);
  });

  it("never throws, even on a malformed / already-broken input", () => {
    expect(() => isStructuredCloneable(undefined)).not.toThrow();
    expect(() => isStructuredCloneable(function () {})).not.toThrow();
  });
});
