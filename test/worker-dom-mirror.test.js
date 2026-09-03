// core/worker-dom/mirror.js unit tests (spec 025-02 AC1) — the minimal
// worker-side Document/Element/Text/Node implementing EXACTLY the subset
// AC1 names: createElement, createTextNode/textContent, appendChild/append,
// setAttribute, the `.id =` property setter, style writes, classList, and
// addEventListener. Every mutating op records a write into the queue;
// sync-layout-reads (offsetHeight/getBoundingClientRect) return an inert
// default, never throw (the Tier-0 boundary).
import { describe, it, expect } from "vitest";
import { createMirrorDocument } from "../core/worker-dom/mirror.js";
import { OP, BODY_ID, isStructuredCloneable } from "../core/worker-dom/protocol.js";

describe("createMirrorDocument — shape", () => {
  it("returns { document, drainMutations }", () => {
    const { document, drainMutations } = createMirrorDocument();
    expect(document).toBeTruthy();
    expect(typeof drainMutations).toBe("function");
  });

  it("document.body exists and is the reserved-id anchor (never itself recorded as a createElement op)", () => {
    const { document, drainMutations } = createMirrorDocument();
    expect(document.body).toBeTruthy();
    expect(document.body.tagName).toBe("BODY");
    expect(drainMutations()).toEqual([]); // constructing the document/body emits NO ops
  });
});

describe("document.createElement / appendChild — records ops, stable ids (AC1)", () => {
  it("createElement('div') records { op: createElement, id, tag: 'div' } and returns an element with tagName DIV", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    expect(el.tagName).toBe("DIV");
    const ops = drainMutations();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: OP.CREATE_ELEMENT, tag: "div" });
    expect(typeof ops[0].id).toBe("string");
  });

  it("appendChild(document.body, el) records { op: appendChild, parentId: BODY_ID, childId }", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    document.body.appendChild(el);
    const ops = drainMutations();
    expect(ops).toEqual([{ op: OP.APPEND_CHILD, parentId: BODY_ID, childId: el.__id }]);
  });

  it("two elements get DIFFERENT stable ids; the SAME element's id is referenced consistently across ops", () => {
    const { document, drainMutations } = createMirrorDocument();
    const a = document.createElement("div");
    const b = document.createElement("span");
    expect(a.__id).not.toBe(b.__id);
    drainMutations();
    a.setAttribute("data-x", "1");
    const ops = drainMutations();
    expect(ops[0].id).toBe(a.__id);
  });

  it("appendChild returns the appended child (real-DOM-like ergonomics)", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(document.body.appendChild(el)).toBe(el);
  });
});

describe("setAttribute / getAttribute (AC1)", () => {
  it("setAttribute records { op: setAttribute, id, name, value }; getAttribute reads it back", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("span");
    drainMutations();
    el.setAttribute("data-completed", "0");
    expect(drainMutations()).toEqual([{ op: OP.SET_ATTRIBUTE, id: el.__id, name: "data-completed", value: "0" }]);
    expect(el.getAttribute("data-completed")).toBe("0");
  });

  it("coerces a non-string value to a string (matches real setAttribute)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("span");
    drainMutations();
    el.setAttribute("data-clicks", 3);
    expect(drainMutations()[0].value).toBe("3");
  });
});

describe("the `.id =` PROPERTY setter (AC1 — distinct code path from setAttribute, same recorded op)", () => {
  it("el.id = 'x' records the SAME { op: setAttribute, name: 'id', value } shape setAttribute('id', 'x') would", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("span");
    drainMutations();
    el.id = "wd-status";
    expect(drainMutations()).toEqual([{ op: OP.SET_ATTRIBUTE, id: el.__id, name: "id", value: "wd-status" }]);
  });

  it("el.id getter reads back the value set via the property setter", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("span");
    el.id = "wd-status";
    expect(el.id).toBe("wd-status");
  });

  it("el.id getter also reads back a value set via setAttribute('id', ...) (both paths converge)", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("span");
    el.setAttribute("id", "abc");
    expect(el.id).toBe("abc");
  });
});

describe("style writes (AC1) — el.style.PROP = value", () => {
  it("records { op: setStyle, id, prop, value } and reads back via the SAME proxy", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    el.style.transform = "translateY(1px)";
    expect(drainMutations()).toEqual([{ op: OP.SET_STYLE, id: el.__id, prop: "transform", value: "translateY(1px)" }]);
    expect(el.style.transform).toBe("translateY(1px)");
  });

  it("an unset style property reads back as '' (matches real CSSStyleDeclaration), never undefined", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(el.style.color).toBe("");
  });

  it("multiple style writes each record their own op, in order", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    el.style.transform = "translateY(1px)";
    el.style.transform = "translateY(2px)";
    const ops = drainMutations();
    expect(ops).toHaveLength(2);
    expect(ops.map((o) => o.value)).toEqual(["translateY(1px)", "translateY(2px)"]);
  });
});

describe("classList (AC1)", () => {
  it("add() records { op: classAdd, id, name } and contains() reflects it", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    el.classList.add("active");
    expect(drainMutations()).toEqual([{ op: OP.CLASS_ADD, id: el.__id, name: "active" }]);
    expect(el.classList.contains("active")).toBe(true);
  });

  it("adding the SAME class twice does not double-record (idempotent, no redundant mutation)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    el.classList.add("active");
    el.classList.add("active");
    expect(drainMutations()).toHaveLength(1);
  });

  it("remove() records { op: classRemove, id, name }", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    el.classList.add("active");
    drainMutations();
    el.classList.remove("active");
    expect(drainMutations()).toEqual([{ op: OP.CLASS_REMOVE, id: el.__id, name: "active" }]);
    expect(el.classList.contains("active")).toBe(false);
  });

  it("toggle() adds when absent, removes when present, and returns the resulting state", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    expect(el.classList.toggle("x")).toBe(true);
    expect(drainMutations()).toEqual([{ op: OP.CLASS_ADD, id: el.__id, name: "x" }]);
    expect(el.classList.toggle("x")).toBe(false);
    expect(drainMutations()).toEqual([{ op: OP.CLASS_REMOVE, id: el.__id, name: "x" }]);
  });
});

describe("createTextNode / textContent (AC1)", () => {
  it("createTextNode(text) records { op: createText, id, text }", () => {
    const { document, drainMutations } = createMirrorDocument();
    const t = document.createTextNode("hi");
    expect(drainMutations()).toEqual([{ op: OP.CREATE_TEXT, id: t.__id, text: "hi" }]);
    expect(t.textContent).toBe("hi");
  });

  it("Text.textContent = '...' records { op: setText, id, text }", () => {
    const { document, drainMutations } = createMirrorDocument();
    const t = document.createTextNode("hi");
    drainMutations();
    t.textContent = "bye";
    expect(drainMutations()).toEqual([{ op: OP.SET_TEXT, id: t.__id, text: "bye" }]);
  });

  it("Element.textContent = '...' ALSO records { op: setText, id, text } (same op, apply-side handling is identical)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("span");
    drainMutations();
    el.textContent = "hello";
    expect(drainMutations()).toEqual([{ op: OP.SET_TEXT, id: el.__id, text: "hello" }]);
    expect(el.textContent).toBe("hello");
  });
});

describe("append (AC1) — variadic, auto-wraps a raw string as a text node", () => {
  it("append('hi', childEl) creates+appends a text node for the string, and appends the element directly", () => {
    const { document, drainMutations } = createMirrorDocument();
    const child = document.createElement("span");
    drainMutations();
    document.body.append("hi", child);
    const ops = drainMutations();
    // a createText for "hi", an appendChild for the text, and an appendChild for `child`
    expect(ops.filter((o) => o.op === OP.CREATE_TEXT)).toHaveLength(1);
    expect(ops.filter((o) => o.op === OP.APPEND_CHILD)).toHaveLength(2);
    expect(ops.some((o) => o.op === OP.APPEND_CHILD && o.childId === child.__id)).toBe(true);
  });
});

describe("sync-layout-reads are INERT DEFAULTS, never throw (AC1 — the Tier-0 boundary)", () => {
  it("offsetHeight reads 0", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(() => el.offsetHeight).not.toThrow();
    expect(el.offsetHeight).toBe(0);
  });

  it("getBoundingClientRect() returns an all-zero rect, never throws", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(() => el.getBoundingClientRect()).not.toThrow();
    expect(el.getBoundingClientRect()).toEqual({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
    });
  });

  it("a sync-layout-read is NOT itself recorded as a mutation (it's a read, not a write)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    void el.offsetHeight;
    void el.getBoundingClientRect();
    expect(drainMutations()).toEqual([]);
  });
});

describe("addEventListener / dispatchEvent on document (AC1/AC2 — the event sink the click listener registers on)", () => {
  it("a listener registered via document.addEventListener fires on document.dispatchEvent", () => {
    const { document } = createMirrorDocument();
    let fired = 0;
    document.addEventListener("click", () => { fired++; });
    document.dispatchEvent({ type: "click" });
    expect(fired).toBe(1);
  });

  it("multiple listeners for the same type all fire", () => {
    const { document } = createMirrorDocument();
    const calls = [];
    document.addEventListener("click", () => calls.push("a"));
    document.addEventListener("click", () => calls.push("b"));
    document.dispatchEvent({ type: "click" });
    expect(calls).toEqual(["a", "b"]);
  });

  it("dispatching an unregistered event type is a harmless no-op", () => {
    const { document } = createMirrorDocument();
    expect(() => document.dispatchEvent({ type: "mouseover" })).not.toThrow();
  });

  it("addEventListener also works on an Element (a small, cheap generalization beyond this fixture's own use)", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("button");
    let fired = false;
    el.addEventListener("click", () => { fired = true; });
    el.dispatchEvent({ type: "click" });
    expect(fired).toBe(true);
  });
});

describe("drainMutations — queue semantics", () => {
  it("clears the queue: a second drain call (with no new writes) returns []", () => {
    const { document, drainMutations } = createMirrorDocument();
    document.createElement("div");
    expect(drainMutations()).toHaveLength(1);
    expect(drainMutations()).toEqual([]);
  });

  it("returns ops in RECORDED ORDER", () => {
    const { document, drainMutations } = createMirrorDocument();
    const a = document.createElement("div");
    const b = document.createElement("span");
    document.body.appendChild(a);
    document.body.appendChild(b);
    const ops = drainMutations();
    expect(ops.map((o) => o.op)).toEqual([OP.CREATE_ELEMENT, OP.CREATE_ELEMENT, OP.APPEND_CHILD, OP.APPEND_CHILD]);
  });
});

// spec 025-03 AC1: innerHTML — the raw-HTML write surface a REAL tag
// (Prism) needs beyond 025-02's structured subset. Records a { op:
// setInnerHTML, id, html } — a plain string, gated by the SANITIZER on
// apply (adapters/eds/dom-apply.js), not by this mirror.
describe("innerHTML (spec 025-03 AC1)", () => {
  it("the setter records { op: setInnerHTML, id, html }", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("code");
    drainMutations();
    el.innerHTML = '<span class="token keyword">const</span>';
    expect(drainMutations()).toEqual([
      { op: OP.SET_INNER_HTML, id: el.__id, html: '<span class="token keyword">const</span>' },
    ]);
  });

  it("the getter reads back the LAST value the setter recorded", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("code");
    el.innerHTML = "<b>hi</b>";
    expect(el.innerHTML).toBe("<b>hi</b>");
  });

  it("an unset innerHTML reads back as '' (matches real Element), never undefined", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(el.innerHTML).toBe("");
  });

  it("coerces a non-string value to a string (matches real innerHTML)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    el.innerHTML = 42;
    expect(drainMutations()[0].html).toBe("42");
    expect(el.innerHTML).toBe("42");
  });

  it("setting innerHTML clears any prior `children` (real innerHTML replaces the whole subtree) — a stale child is not left dangling", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    const child = document.createElement("span");
    el.appendChild(child);
    expect(el.children).toHaveLength(1);
    el.innerHTML = "<p>new</p>";
    expect(el.children).toHaveLength(0);
  });

  it("repeated innerHTML writes each record their OWN op, in order (a re-highlight pass, e.g. Prism on a second click)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("code");
    drainMutations();
    el.innerHTML = "<span>pass1</span>";
    el.innerHTML = "<span>pass2</span>";
    const ops = drainMutations();
    expect(ops.map((o) => o.html)).toEqual(["<span>pass1</span>", "<span>pass2</span>"]);
  });
});

// spec 025-03 AC1: className — a serviceable sync READ/WRITE Prism's
// Prism.util.getLanguage/setLanguage exercise unconditionally on every
// Prism.highlightElement() call. Backed by the SAME store as `classList`
// (not the `class` ATTRIBUTE store `setAttribute`/`getAttribute` use) —
// real DOM's className/classList are two views of ONE backing store, and
// Prism's own setLanguage() reads className, strips a token via a regex
// REPLACE, writes className back, THEN calls classList.add() in the SAME
// call — if className and classList were independent (as
// setAttribute("class",...) already is, unchanged by this slice), that
// sequence would silently LOSE the language class after the first
// highlight pass (grounded by running Prism twice — see
// test/dom-chamber-host.test.js's two-click proof).
describe("className (spec 025-03 AC1) — classList-backed, matches real DOM's className/classList unification", () => {
  it("the setter records classList ops (via the SAME CLASS_ADD op classList.add emits) and the getter reads the space-joined result", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("code");
    drainMutations();
    el.className = "language-javascript";
    const ops = drainMutations();
    expect(ops).toEqual([{ op: OP.CLASS_ADD, id: el.__id, name: "language-javascript" }]);
    expect(el.className).toBe("language-javascript");
  });

  it("an unset className reads back as '' (matches real Element), never undefined/null", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(el.className).toBe("");
  });

  it("classList.add() (not className) is ALSO reflected by the className getter — one shared backing store", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    el.classList.add("x");
    expect(el.className).toBe("x");
  });

  it("re-assigning className DIFFS against the current classList (only the delta is recorded, matching real DOM's own no-op-preserving behavior)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    el.className = "a b";
    drainMutations();
    el.className = "b c"; // drop "a", keep "b", add "c"
    const ops = drainMutations();
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: OP.CLASS_REMOVE, id: el.__id, name: "a" },
        { op: OP.CLASS_ADD, id: el.__id, name: "c" },
      ]),
    );
    expect(ops).toHaveLength(2); // "b" is unchanged -> no redundant op
    expect(el.className.split(" ").sort()).toEqual(["b", "c"]);
  });

  it("SURVIVES the exact Prism setLanguage() sequence TWICE — className stays readable after a strip-then-readd cycle (the grounded bug this design fixes)", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("code");
    el.className = "language-javascript";
    // Pass 1: Prism.util.setLanguage — strip any existing `language-xxxx`/`lang-xxxx`
    // token via regex-replace, then classList.add() the fresh one back.
    const lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
    el.className = el.className.replace(RegExp(lang, "gi"), "");
    el.classList.add("language-javascript");
    expect(el.className).toBe("language-javascript");
    // Pass 2 (a second highlightElement() call, e.g. a second click): getLanguage()
    // must still find it — this is exactly what broke under an attribute-backed
    // (rather than classList-backed) className.
    expect(lang.exec(el.className)[1]).toBe("javascript");
    el.className = el.className.replace(RegExp(lang, "gi"), "");
    el.classList.add("language-javascript");
    expect(el.className).toBe("language-javascript");
  });

  it("setAttribute('class', ...) / getAttribute('class') remain a SEPARATE, unrelated attribute store (unchanged 025-02 behavior — Prism never calls this path)", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    el.setAttribute("class", "z");
    expect(el.className).toBe(""); // classList-backed className is untouched by setAttribute("class", …)
    expect(el.getAttribute("class")).toBe("z");
  });
});

describe("nodeName (spec 025-03 AC1) — Prism's file-highlight hook reads parent.nodeName.toLowerCase()", () => {
  it("aliases tagName (uppercase, matches real Element.nodeName)", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("pre");
    expect(el.nodeName).toBe("PRE");
    expect(el.nodeName).toBe(el.tagName);
  });
});

describe("hasAttribute (spec 025-03 AC1) — Prism's file-highlight hook reads parent.hasAttribute('tabindex')", () => {
  it("false before the attribute is set, true after", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("pre");
    expect(el.hasAttribute("tabindex")).toBe(false);
    el.setAttribute("tabindex", "0");
    expect(el.hasAttribute("tabindex")).toBe(true);
  });

  it("never throws on a missing/unknown attribute name", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("div");
    expect(() => el.hasAttribute("data-ghost")).not.toThrow();
  });
});

describe("parentElement (spec 025-03 AC1) — Prism's highlightElement() walks element.parentElement (getLanguage's ancestor walk + the pre/code parent-styling step)", () => {
  it("null before any append", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("code");
    expect(el.parentElement).toBeNull();
  });

  it("appendChild sets the child's parentElement to the real parent (Element parent)", () => {
    const { document } = createMirrorDocument();
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    pre.appendChild(code);
    expect(code.parentElement).toBe(pre);
  });

  it("appendChild onto document.body sets parentElement to document.body", () => {
    const { document } = createMirrorDocument();
    const pre = document.createElement("pre");
    document.body.appendChild(pre);
    expect(pre.parentElement).toBe(document.body);
  });

  it("append() (the variadic helper) also wires parentElement", () => {
    const { document } = createMirrorDocument();
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.append(child);
    expect(child.parentElement).toBe(parent);
  });
});

describe("matches (spec 025-03 AC1) — a minimal INERT stub (Prism's bundled file-highlight plugin hook calls element.matches() unconditionally on every highlightElement() call)", () => {
  it("always returns false, never throws — a lib-completeness stub (needs zero live-layout info), not a model-inherent gap", () => {
    const { document } = createMirrorDocument();
    const el = document.createElement("code");
    expect(() => el.matches("pre[data-src]")).not.toThrow();
    expect(el.matches("pre[data-src]")).toBe(false);
    expect(el.matches("*")).toBe(false);
  });

  it("is NOT itself recorded as a mutation (it's a read, not a write)", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    drainMutations();
    el.matches("div");
    expect(drainMutations()).toEqual([]);
  });
});

describe("document.getElementsByTagName (spec 025-03 AC1) — grounded by running Prism in a REAL Worker: WorkerGlobalScope makes Prism's own `_self` resolve to the REAL worker global once `globalThis.document` is assigned (unlike Node/vitest, where it stays `{}`), so Prism's IE11 currentScript() fallback unconditionally calls document.getElementsByTagName('script') on every boot", () => {
  it("always returns an empty, iterable, array-like result — an HONEST inert default (this mirror is a write-record, not a re-queryable tree, per this module's own header) — never throws", () => {
    const { document } = createMirrorDocument();
    expect(() => document.getElementsByTagName("script")).not.toThrow();
    const result = document.getElementsByTagName("script");
    expect(Array.from(result)).toEqual([]);
    expect(result.length).toBe(0);
  });

  it("is NOT recorded as a mutation (it's a read, not a write)", () => {
    const { document, drainMutations } = createMirrorDocument();
    drainMutations();
    document.getElementsByTagName("div");
    expect(drainMutations()).toEqual([]);
  });
});

describe("every recorded op is structured-cloneable (AC1 <-> AC3 tie-in)", () => {
  it("a representative drained batch survives a real structuredClone round-trip", () => {
    const { document, drainMutations } = createMirrorDocument();
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.setAttribute("data-x", "1");
    el.id = "y";
    el.style.transform = "translateY(1px)";
    el.classList.add("z");
    el.className = "z w"; // spec 025-03 AC1
    el.innerHTML = '<span class="token">hi</span>'; // spec 025-03 AC1
    const t = document.createTextNode("hi");
    el.appendChild(t);
    t.textContent = "bye";
    const ops = drainMutations();
    expect(ops.length).toBeGreaterThan(0);
    expect(isStructuredCloneable(ops)).toBe(true);
  });
});
