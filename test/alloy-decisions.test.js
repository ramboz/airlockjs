// Decisions-as-data parse — spec 012-03, AC1/AC2 (pure piece).
//
// alloy `sendEvent({ renderDecisions: false })` resolves to a result carrying
// `propositions` (Target headless, R-004). This module turns that result into the
// contract's `Decision[]` (`{ scope, content }`, capability.d.ts) for a scope
// (default `__view__`), and pulls the renderable HTML out of a decision. Pure +
// null-safe so the connector can call it in the chamber without a DOM — the
// decision crosses the boundary as DATA, never applied in the worker (AC2).
import { describe, it, expect } from "vitest";
import { extractDecisions, htmlOfDecision, contentOf, VIEW_SCOPE } from "../connectors/alloy/decisions.js";

// A grounded alloy sendEvent result for renderDecisions:false: `propositions` is
// an array of Personalization propositions (id/scope/scopeDetails/items), the
// items carrying an html-content-item whose data.content is the HTML the HOST
// applies (the worker never renders it — renderDecisions:false).
const HTML = '<div class="hero">Personalized</div>';
const viewProposition = (over = {}) => ({
  id: "AT:prop-1",
  scope: "__view__",
  scopeDetails: {
    decisionProvider: "TGT",
    activity: { id: "activity-9" },
    experience: { id: "experience-3" },
  },
  items: [
    {
      id: "item-1",
      schema: "https://ns.adobe.com/personalization/html-content-item",
      data: { id: "data-1", format: "text/html", content: HTML },
    },
  ],
  renderAttempted: false,
  ...over,
});
const resultWith = (...props) => ({ propositions: props });

describe("extractDecisions — alloy result.propositions → Decision[] (AC1/AC2)", () => {
  it("returns one Decision { scope, content } per proposition in the __view__ scope by default", () => {
    const decisions = extractDecisions(resultWith(viewProposition()));
    expect(decisions).toHaveLength(1);
    expect(decisions[0].scope).toBe("__view__");
    // content is the proposition itself (data), so the host can read items/scopeDetails.
    expect(decisions[0].content.id).toBe("AT:prop-1");
    expect(decisions[0].content.items[0].data.content).toBe(HTML);
  });

  it("VIEW_SCOPE is the default __view__ personalization scope (R-004)", () => {
    expect(VIEW_SCOPE).toBe("__view__");
  });

  it("filters to the requested scope — a non-__view__ proposition is excluded by default", () => {
    const other = viewProposition({ scope: "some-mbox", id: "AT:prop-2" });
    const decisions = extractDecisions(resultWith(viewProposition(), other));
    expect(decisions).toHaveLength(1);
    expect(decisions[0].content.id).toBe("AT:prop-1");
  });

  it("can select a different scope explicitly", () => {
    const other = viewProposition({ scope: "some-mbox", id: "AT:prop-2" });
    const decisions = extractDecisions(resultWith(viewProposition(), other), { scope: "some-mbox" });
    expect(decisions).toHaveLength(1);
    expect(decisions[0].scope).toBe("some-mbox");
  });

  it("returns [] when the result has no propositions (non-personalized response)", () => {
    expect(extractDecisions({ propositions: [] })).toEqual([]);
    expect(extractDecisions({})).toEqual([]);
  });

  it("is null-safe — undefined/null/garbage result never throws, returns []", () => {
    expect(() => extractDecisions(undefined)).not.toThrow();
    expect(extractDecisions(undefined)).toEqual([]);
    expect(extractDecisions(null)).toEqual([]);
    expect(extractDecisions({ propositions: "nope" })).toEqual([]);
    expect(extractDecisions({ propositions: [null, 42, "x"] })).toEqual([]);
  });
});

describe("htmlOfDecision — the renderable HTML the host fills the box with", () => {
  it("returns the first html-content-item's data.content string", () => {
    const [decision] = extractDecisions(resultWith(viewProposition()));
    expect(htmlOfDecision(decision)).toBe(HTML);
  });

  it("returns null when the proposition carries no html-content item", () => {
    const noHtml = viewProposition({ items: [{ id: "i", schema: "https://ns.adobe.com/personalization/json-content-item", data: { content: { k: 1 } } }] });
    const [decision] = extractDecisions(resultWith(noHtml));
    expect(htmlOfDecision(decision)).toBeNull();
  });

  it("is null-safe on a missing/empty decision (never throws)", () => {
    expect(() => htmlOfDecision(undefined)).not.toThrow();
    expect(htmlOfDecision(undefined)).toBeNull();
    expect(htmlOfDecision({})).toBeNull();
    expect(htmlOfDecision({ content: {} })).toBeNull();
  });
});

// 018-02 AC2: `contentOf` is the SHARED Decision/proposition content-unwrap
// accessor, extracted out of htmlOfDecision's former inline ternary so
// `adapters/eds/decisions-exposure.js` can use the same base unwrap instead of
// a third private re-narrowing (rule-of-three). `htmlOfDecision` above must
// keep behaving byte-identically through this refactor — the tests above stay
// unchanged and green; this block additionally pins `contentOf` itself.
describe("contentOf — shared Decision/proposition content-unwrap accessor (018-02 AC2)", () => {
  it("unwraps a Decision's object content", () => {
    expect(contentOf({ content: { a: 1 } })).toEqual({ a: 1 });
  });

  it("passes a bare (non-Decision) value through unchanged", () => {
    const bare = { items: [] };
    expect(contentOf(bare)).toBe(bare);
  });

  it("is null-safe on garbage input (never throws)", () => {
    expect(() => contentOf(undefined)).not.toThrow();
    expect(contentOf(undefined)).toBeUndefined();
    expect(contentOf(null)).toBeNull();
    expect(contentOf(42)).toBe(42);
  });

  it("is what htmlOfDecision uses internally to unwrap a Decision wrapper (same reference, not a copy)", () => {
    const [decision] = extractDecisions(resultWith(viewProposition()));
    expect(contentOf(decision)).toBe(decision.content);
    expect(htmlOfDecision(decision)).toBe(HTML);
  });
});
