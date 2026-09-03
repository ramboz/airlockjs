// core/worker-dom/apply-policy.js unit tests (spec 025-02 AC6/AC7) — the
// mutation-apply safety ALLOWLIST: safe element tag names, safe attribute
// names, and a style-VALUE token guard. Allowlist, not a denylist (AC6): a
// name/tag not explicitly allowed is refused BY CONSTRUCTION, not by an
// enumerated "known-bad" list.
import { describe, it, expect } from "vitest";
import {
  isAllowedTag,
  isAllowedAttributeName,
  isSafeStyleValue,
  evaluateOp,
  ALLOWED_TAGS,
} from "../core/worker-dom/apply-policy.js";
import { OP } from "../core/worker-dom/protocol.js";

describe("isAllowedTag — the element-tag ALLOWLIST (AC6)", () => {
  it("allows the layout/text elements the subset needs", () => {
    for (const tag of ["div", "span", "p", "ul", "li", "a", "button"]) {
      expect(isAllowedTag(tag)).toBe(true);
    }
  });

  it("allows pre/code (spec 025-03 AC1 — Prism's real, canonical <pre><code> shape, grounded by running it)", () => {
    expect(isAllowedTag("pre")).toBe(true);
    expect(isAllowedTag("code")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAllowedTag("DIV")).toBe(true);
    expect(isAllowedTag("Span")).toBe(true);
  });

  it("NEVER allows script/iframe/object/embed/style/link/base/meta/svg (AC6/AC7's named-forbidden set)", () => {
    for (const tag of ["script", "iframe", "object", "embed", "style", "link", "base", "meta", "svg"]) {
      expect(isAllowedTag(tag)).toBe(false);
    }
  });

  it("refuses anything not explicitly named (allowlist, not a denylist) — an arbitrary unknown tag is refused", () => {
    expect(isAllowedTag("marquee")).toBe(false);
    expect(isAllowedTag("x-custom-element")).toBe(false);
  });

  it("never throws on a non-string / empty input", () => {
    expect(isAllowedTag(null)).toBe(false);
    expect(isAllowedTag(undefined)).toBe(false);
    expect(isAllowedTag("")).toBe(false);
    expect(isAllowedTag(123)).toBe(false);
  });

  it("ALLOWED_TAGS is exported for AC7's documentation obligation (the exact implemented surface)", () => {
    expect(ALLOWED_TAGS.has("div")).toBe(true);
    expect(ALLOWED_TAGS.has("script")).toBe(false);
  });
});

describe("isAllowedAttributeName — the attribute-name ALLOWLIST (AC6)", () => {
  it("allows class / id / style, and any data-* attribute", () => {
    expect(isAllowedAttributeName("class")).toBe(true);
    expect(isAllowedAttributeName("id")).toBe(true);
    expect(isAllowedAttributeName("style")).toBe(true);
    expect(isAllowedAttributeName("data-completed")).toBe(true);
    expect(isAllowedAttributeName("data-collect-ms")).toBe(true);
  });

  it("is case-insensitive on the fixed names and the data- prefix", () => {
    expect(isAllowedAttributeName("CLASS")).toBe(true);
    expect(isAllowedAttributeName("DATA-x")).toBe(true);
  });

  it("NEVER allows an on* event-handler attribute (AC6's named-forbidden case)", () => {
    expect(isAllowedAttributeName("onclick")).toBe(false);
    expect(isAllowedAttributeName("onerror")).toBe(false);
    expect(isAllowedAttributeName("ONCLICK")).toBe(false);
  });

  it("NEVER allows a URL-bearing / hijack attribute (href/src/formaction/xlink:href) — absent from the allowlist, refused by construction", () => {
    for (const name of ["href", "src", "formaction", "xlink:href", "action", "poster", "background"]) {
      expect(isAllowedAttributeName(name)).toBe(false);
    }
  });

  it("refuses an arbitrary unknown attribute name", () => {
    expect(isAllowedAttributeName("data")).toBe(false); // "data" alone, not "data-*"
    expect(isAllowedAttributeName("title")).toBe(false);
  });

  it("refuses a name with whitespace / structural chars — else setAttribute THROWS InvalidCharacterError (025-02 review, defense-in-depth)", () => {
    expect(isAllowedAttributeName("data-x y")).toBe(false); // space -> real DOM throws
    expect(isAllowedAttributeName("data-a\tb")).toBe(false); // tab
    expect(isAllowedAttributeName("data-x=y")).toBe(false); // structural char
    // valid hyphenated data-* names STILL pass (hyphen is legitimate)
    expect(isAllowedAttributeName("data-track-id")).toBe(true);
  });

  it("never throws on a non-string input", () => {
    expect(isAllowedAttributeName(null)).toBe(false);
    expect(isAllowedAttributeName(undefined)).toBe(false);
  });
});

describe("isSafeStyleValue — the style-VALUE token guard (AC6/AC7 — a minimal, honestly-bounded check)", () => {
  it("allows benign values", () => {
    expect(isSafeStyleValue("translateY(1px)")).toBe(true);
    expect(isSafeStyleValue("red")).toBe(true);
    expect(isSafeStyleValue("10px solid black")).toBe(true);
  });

  it("rejects a value containing url( — the CSS-exfil vector (AC6)", () => {
    expect(isSafeStyleValue("background:url(https://evil.example/track.gif)")).toBe(false);
    expect(isSafeStyleValue("URL(https://evil.example/x)")).toBe(false); // case-insensitive
  });

  it("rejects a value containing expression( (legacy IE CSS-injection vector)", () => {
    expect(isSafeStyleValue("width:expression(alert(1))")).toBe(false);
  });

  it("rejects a value containing /* (a comment-based injection/obfuscation vector)", () => {
    expect(isSafeStyleValue("color:red;/*x*/")).toBe(false);
  });

  it("never throws on a non-string input", () => {
    expect(isSafeStyleValue(null)).toBe(false);
    expect(isSafeStyleValue(undefined)).toBe(false);
  });
});

describe("evaluateOp — the per-op verdict the apply coordinator drives (AC6)", () => {
  it("createElement: allow for a safe tag, refuse+reason for an unsafe one", () => {
    expect(evaluateOp({ op: OP.CREATE_ELEMENT, id: "n1", tag: "div" })).toEqual({ allow: true });
    const verdict = evaluateOp({ op: OP.CREATE_ELEMENT, id: "n1", tag: "script" });
    expect(verdict.allow).toBe(false);
    expect(typeof verdict.reason).toBe("string");
  });

  it("setAttribute: allow for a safe name, refuse for onclick", () => {
    expect(evaluateOp({ op: OP.SET_ATTRIBUTE, id: "n1", name: "data-x", value: "1" })).toEqual({ allow: true });
    expect(evaluateOp({ op: OP.SET_ATTRIBUTE, id: "n1", name: "onclick", value: "alert(1)" }).allow).toBe(false);
  });

  it("setAttribute with name='style': ALSO value-guarded (a name-level allowlist of style is not enough — AC6)", () => {
    expect(evaluateOp({ op: OP.SET_ATTRIBUTE, id: "n1", name: "style", value: "color:red" })).toEqual({ allow: true });
    expect(evaluateOp({ op: OP.SET_ATTRIBUTE, id: "n1", name: "style", value: "background:url(evil)" }).allow).toBe(false);
  });

  it("setStyle: value-guarded the same way", () => {
    expect(evaluateOp({ op: OP.SET_STYLE, id: "n1", prop: "transform", value: "translateY(1px)" })).toEqual({ allow: true });
    expect(evaluateOp({ op: OP.SET_STYLE, id: "n1", prop: "background", value: "url(evil)" }).allow).toBe(false);
  });

  it("classAdd/Remove/Toggle: a valid token is allowed, but an empty/whitespace token is REFUSED — else classList.* THROWS (025-02 review, defense-in-depth)", () => {
    expect(evaluateOp({ op: OP.CLASS_ADD, id: "n1", name: "wd-el" })).toEqual({ allow: true });
    expect(evaluateOp({ op: OP.CLASS_TOGGLE, id: "n1", name: "is-active" })).toEqual({ allow: true });
    expect(evaluateOp({ op: OP.CLASS_ADD, id: "n1", name: "a b" }).allow).toBe(false); // space -> InvalidCharacterError
    expect(evaluateOp({ op: OP.CLASS_ADD, id: "n1", name: "" }).allow).toBe(false); // empty -> SyntaxError
    expect(evaluateOp({ op: OP.CLASS_REMOVE, id: "n1", name: "x\ty" }).allow).toBe(false); // tab
  });

  it("structural/text/class ops carry no injection surface here — always allowed", () => {
    for (const op of [
      { op: OP.CREATE_TEXT, id: "n1", text: "hi" },
      { op: OP.SET_TEXT, id: "n1", text: "hi" },
      { op: OP.APPEND_CHILD, parentId: "body", childId: "n1" },
      { op: OP.CLASS_ADD, id: "n1", name: "x" },
      { op: OP.CLASS_REMOVE, id: "n1", name: "x" },
      { op: OP.CLASS_TOGGLE, id: "n1", name: "x" },
    ]) {
      expect(evaluateOp(op)).toEqual({ allow: true });
    }
  });

  // spec 025-03 AC3: setInnerHTML is allowed AT THIS LAYER unconditionally —
  // the raw-HTML STRING content is gated by the sanitizer at apply time
  // (adapters/eds/dom-apply.js), not by this element/attribute-name
  // allowlist (which has no way to inspect markup INSIDE an HTML string).
  it("setInnerHTML carries no name/tag injection surface at THIS layer — always allowed (the sanitizer gates the content)", () => {
    expect(evaluateOp({ op: OP.SET_INNER_HTML, id: "n1", html: "<span>ok</span>" })).toEqual({ allow: true });
    expect(evaluateOp({ op: OP.SET_INNER_HTML, id: "n1", html: '<script>alert(1)</script>' })).toEqual({ allow: true });
  });

  it("an unknown op name is refused (fail-closed on anything outside the wire contract)", () => {
    expect(evaluateOp({ op: "eval", id: "n1" }).allow).toBe(false);
  });

  it("a malformed op (no `op` string) is refused, never throws", () => {
    expect(() => evaluateOp(null)).not.toThrow();
    expect(evaluateOp(null).allow).toBe(false);
    expect(evaluateOp({}).allow).toBe(false);
  });
});
