/**
 * The worker-side DOM mirror (spec 025-02 AC1, extended by spec 025-03 AC1)
 * — airlock's OWN minimal `Document` / `Element` / `Text` / `Node`,
 * replacing `@ampproject/worker-dom` (ADR-0014 Option C). Implements ONLY
 * the subset the 025-01 synthetic nasty-tag exercises
 * (`rig/worker-dom-nasty-tag-author.js`) plus the small AC1-named superset
 * (`createTextNode`/`textContent`, `append`, `classList`), PLUS (025-03 AC1)
 * `innerHTML`, `className`, `nodeName`, `hasAttribute`, `parentElement`, and
 * a `matches()` stub — the additional surface an UNMODIFIED real tag
 * (Prism) needs, grounded by running it (see test/worker-dom-mirror.test.js
 * + test/dom-chamber-host.test.js). Never more: no `querySelector*`, no
 * ambient globals (`screen`/`sendBeacon`/cookie -> 025-04). See AC7 / this
 * module's own tests for the exact implemented surface — that list IS the
 * documentation.
 *
 * Every mutating op RECORDS a write into a queue (a write-record, not a
 * full re-queryable tree — `../dom-chamber-host.js` drains + flushes it to
 * the main-thread apply coordinator over `./protocol.js`'s wire contract).
 * Stable per-node ids (`__id`) — `document.body` carries the RESERVED
 * `BODY_ID` (never itself emitted as a `createElement` op; the main-thread
 * coordinator pre-seeds its id map with the real host element under that
 * same id — see `./protocol.js`'s header).
 *
 * Sync-layout-reads (`offsetHeight` / `getBoundingClientRect`) return an
 * INERT DEFAULT (0 / an all-zero rect) — never throw. This is the Tier-0
 * boundary (ADR-0014 §3/§5): a worker-side mirror cannot serve a genuine
 * live-layout read off-thread at all; matches 025-01's grounded finding
 * that worker-dom's own mirror never implements these either.
 *
 * HONEST COVERAGE BOUND (AC7, restating ADR-0014 §5 — do not gloss): this
 * mirror's off-thread win is the unmodified WRITE/COMPUTE-HEAVY slice only.
 * Because the worst and most common costly-DOM tags are sync-read/
 * measurement-driven (layout-thrash, viewability/position measurement,
 * `querySelectorAll`-heavy traversal) — exactly the Tier-0 gap this module
 * cannot serve — Tier 0 alone may contain a MINORITY of real costly tags,
 * not "most." 025-02 proved the mechanism on the synthetic write-heavy
 * fixture; 025-03 proves the minimal subset GENERALIZES to a real,
 * `innerHTML`-driven tag (Prism) — the one grounded gap (`matches()`) is a
 * lib-completeness stub, not a model limit (see `MirrorElement.matches`'s
 * own doc comment).
 */
import { OP, BODY_ID } from "./protocol.js";

function makeIdGenerator() {
  let n = 0;
  return () => `n${n++}`;
}

/** A tiny EventTarget-shaped mixin (addEventListener/removeEventListener/
 *  dispatchEvent) — applied to every node AND to the document singleton, so
 *  `document.addEventListener('click', ...)` (this fixture's only listener)
 *  and a future element-level listener both work via the SAME mechanism.
 *  @returns {{addEventListener:Function, removeEventListener:Function, dispatchEvent:Function}} */
function createEventTargetMixin() {
  const listeners = new Map(); // type -> Set<fn>
  return {
    addEventListener(type, fn) {
      if (typeof fn !== "function") return;
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    dispatchEvent(evt) {
      const type = evt && evt.type;
      const set = listeners.get(type);
      if (!set) return true;
      // snapshot: a listener that adds/removes a listener mid-dispatch must
      // not perturb THIS dispatch's own iteration.
      for (const fn of Array.from(set)) fn.call(evt.currentTarget, evt);
      return true;
    },
  };
}

class MirrorStyle {
  /** @param {{__record:(op:object)=>void, __id:string}} node */
  constructor(node) {
    const store = {};
    return new Proxy(store, {
      get(target, prop) {
        if (typeof prop !== "string") return target[prop];
        return Object.prototype.hasOwnProperty.call(target, prop) ? target[prop] : "";
      },
      set(target, prop, value) {
        if (typeof prop !== "string") return true;
        const v = value == null ? "" : String(value);
        target[prop] = v;
        node.__record({ op: OP.SET_STYLE, id: node.__id, prop, value: v });
        return true;
      },
    });
  }
}

class MirrorClassList {
  /** @param {{__record:(op:object)=>void, __id:string}} node */
  constructor(node) {
    this.__node = node;
    this.__set = new Set();
  }
  add(name) {
    if (!name || this.__set.has(name)) return;
    this.__set.add(name);
    this.__node.__record({ op: OP.CLASS_ADD, id: this.__node.__id, name });
  }
  remove(name) {
    if (!this.__set.has(name)) return;
    this.__set.delete(name);
    this.__node.__record({ op: OP.CLASS_REMOVE, id: this.__node.__id, name });
  }
  toggle(name, force) {
    const has = this.__set.has(name);
    const shouldHave = typeof force === "boolean" ? force : !has;
    if (shouldHave === has) return shouldHave;
    if (shouldHave) this.add(name); else this.remove(name);
    return shouldHave;
  }
  contains(name) { return this.__set.has(name); }
}

class MirrorNode {
  constructor(id, ctx) {
    this.__id = id;
    this.__ctx = ctx;
    // spec 025-03 AC1: Prism.highlightElement() reads `element.parentElement`
    // twice (the language-detection ancestor walk + the pre/code
    // parent-styling step) — wired by MirrorElement.appendChild below.
    // `null` before any append (matches real DOM), never undefined.
    this.__parentElement = null;
    Object.assign(this, createEventTargetMixin());
  }
  __record(op) { this.__ctx.record(op); }
  get parentElement() { return this.__parentElement; }
}

class MirrorText extends MirrorNode {
  constructor(id, text, ctx) {
    super(id, ctx);
    this.__text = text == null ? "" : String(text);
  }
  get textContent() { return this.__text; }
  set textContent(v) {
    this.__text = v == null ? "" : String(v);
    this.__record({ op: OP.SET_TEXT, id: this.__id, text: this.__text });
  }
}

class MirrorElement extends MirrorNode {
  constructor(id, tagName, ctx) {
    super(id, ctx);
    this.tagName = String(tagName || "").toUpperCase();
    this.__attrs = new Map();
    this.children = [];
    this.style = new MirrorStyle(this);
    this.classList = new MirrorClassList(this);
    this.__text = "";
    this.__html = ""; // spec 025-03 AC1 — the innerHTML backing field
  }

  get id() { return this.__attrs.get("id") || ""; }
  set id(value) { this.setAttribute("id", value); }

  // spec 025-03 AC1 — Prism's file-highlight plugin hook reads
  // `parent.nodeName.toLowerCase()`; a plain alias of tagName (real
  // Element.nodeName === Element.tagName for element nodes).
  get nodeName() { return this.tagName; }

  get textContent() { return this.__text; }
  set textContent(v) {
    this.__text = v == null ? "" : String(v);
    this.children = [];
    this.__record({ op: OP.SET_TEXT, id: this.__id, text: this.__text });
  }

  // spec 025-03 AC1 — the raw-HTML write surface a REAL tag (Prism) needs:
  // `Prism.highlightElement` finishes every pass with `element.innerHTML =
  // highlightedMarkup`. Records { op: setInnerHTML, id, html } — a plain
  // string, NEVER parsed/walked here (this mirror does not build a structured
  // subtree for it; the main-thread apply coordinator does the real DOM
  // write, sanitizer-gated — adapters/eds/dom-apply.js, spec 025-03 AC3).
  // Clears `children` (real innerHTML replaces the whole subtree) — mirrors
  // the SAME discipline `textContent`'s setter already applies above.
  get innerHTML() { return this.__html; }
  set innerHTML(html) {
    this.__html = html == null ? "" : String(html);
    this.children = [];
    this.__record({ op: OP.SET_INNER_HTML, id: this.__id, html: this.__html });
  }

  // spec 025-03 AC1 — className: a serviceable sync READ/WRITE
  // `Prism.util.getLanguage`/`setLanguage` exercise unconditionally on every
  // `Prism.highlightElement()` call. Backed by the SAME store as
  // `classList` (a Set, not the `class` ATTRIBUTE `setAttribute`/
  // `getAttribute` read/write) — real DOM's `className`/`classList` are two
  // views over ONE backing store, and Prism's own `setLanguage()` reads
  // className, strips a token via a regex REPLACE, writes className back,
  // THEN calls `classList.add()` in the SAME call; an attribute-backed (i.e.
  // classList-INDEPENDENT) className would silently LOSE the language class
  // after the first highlight pass (grounded by running Prism twice — see
  // test/worker-dom-mirror.test.js's "SURVIVES the exact Prism setLanguage()
  // sequence TWICE" + test/dom-chamber-host.test.js's two-click proof).
  // `setAttribute("class", …)`/`getAttribute("class")` stay a SEPARATE,
  // unrelated attribute store (unchanged 025-02 behavior) — Prism never
  // calls that path, so unifying it too is out of this slice's grounded need.
  get className() { return Array.from(this.classList.__set).join(" "); }
  set className(value) {
    const next = new Set(String(value == null ? "" : value).split(/\s+/).filter(Boolean));
    for (const name of Array.from(this.classList.__set)) {
      if (!next.has(name)) this.classList.remove(name);
    }
    for (const name of next) {
      if (!this.classList.__set.has(name)) this.classList.add(name);
    }
  }

  setAttribute(name, value) {
    const v = value == null ? "" : String(value);
    this.__attrs.set(String(name), v);
    this.__record({ op: OP.SET_ATTRIBUTE, id: this.__id, name: String(name), value: v });
  }
  getAttribute(name) {
    const key = String(name);
    return this.__attrs.has(key) ? this.__attrs.get(key) : null;
  }
  // spec 025-03 AC1 — Prism's file-highlight plugin hook reads
  // `parent.hasAttribute('tabindex')` before conditionally setting it.
  hasAttribute(name) { return this.__attrs.has(String(name)); }

  // spec 025-03 AC1 — a minimal INERT stub (always false), grounded by
  // running Prism: its bundled file-highlight plugin hook
  // (`Prism.hooks.add('before-sanity-check', …)`) calls `element.matches()`
  // UNCONDITIONALLY on every `highlightElement()` call, not a path this
  // fixture chose (prism.js:1847). `false` is the semantically CORRECT
  // answer for every element this mirror ever hosts (none carry the plugin's
  // `data-src` attribute) — a LIB-COMPLETENESS gap (needs zero live-layout
  // info), NOT a model-inherent one (unlike offsetHeight/
  // getBoundingClientRect above); implementing a real CSS selector engine is
  // out of this mirror's minimal-subset scope (no `querySelector*`, per this
  // module's own header).
  matches() { return false; }

  appendChild(child) {
    this.children.push(child);
    if (child && typeof child === "object") child.__parentElement = this;
    this.__record({ op: OP.APPEND_CHILD, parentId: this.__id, childId: child.__id });
    return child;
  }
  append(...items) {
    for (const item of items) {
      if (item != null && typeof item === "object" && typeof item.__id === "string") {
        this.appendChild(item);
      } else {
        const t = this.__ctx.createText(item);
        this.appendChild(t);
      }
    }
  }

  // Inert sync-layout-read defaults (the Tier-0 boundary) — never throw.
  get offsetHeight() { return 0; }
  get offsetWidth() { return 0; }
  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
}

class MirrorDocument {
  constructor() {
    const queue = [];
    const nextId = makeIdGenerator();
    const ctx = {
      record: (op) => queue.push(op),
      nextId,
      // shared so MirrorElement.append() can synthesize a text node for a
      // raw string arg without a circular import back to `document`.
      createText: (text) => {
        const id = nextId();
        const t = new MirrorText(id, text, ctx);
        ctx.record({ op: OP.CREATE_TEXT, id, text: t.textContent });
        return t;
      },
    };
    this.__ctx = ctx;
    this.__queue = queue;
    Object.assign(this, createEventTargetMixin());
    // body carries the RESERVED id — never recorded as its own createElement
    // op (see this module's header + ./protocol.js).
    this.body = new MirrorElement(BODY_ID, "body", ctx);
  }

  createElement(tagName) {
    const id = this.__ctx.nextId();
    const el = new MirrorElement(id, tagName, this.__ctx);
    this.__ctx.record({ op: OP.CREATE_ELEMENT, id, tag: el.tagName.toLowerCase() });
    return el;
  }

  createTextNode(text) {
    return this.__ctx.createText(text);
  }

  // spec 025-03 AC1 — grounded by running Prism inside a REAL Worker (NOT
  // reachable from a Node/vitest unit test — see
  // test/worker-dom-mirror.test.js's own comment on why): once
  // `globalThis.document` is assigned, Prism's own environment-detection
  // (`_self`, prism.js:9-13) resolves to the REAL worker global object
  // (`typeof WorkerGlobalScope !== 'undefined' && self instanceof
  // WorkerGlobalScope` — true in an actual Worker, unlike Node), making
  // `_self.document` truthy — which UNCONDITIONALLY runs Prism's IE11
  // `currentScript()` fallback (prism.js:226-259) on every boot, regardless
  // of `Prism.manual`. That fallback calls `document.getElementsByTagName
  // ('script')`. An INERT, always-EMPTY result is the honest answer — this
  // mirror is a write-record, not a re-queryable tree (this module's own
  // header), so it cannot serve a genuine query read at all; an empty
  // result makes the fallback's `for` loop simply not iterate, falling
  // through to its own `return null` (there genuinely is no real `<script>`
  // tag for a `new Function()`-evaluated author source).
  getElementsByTagName() { return []; }

  drainMutations() {
    return this.__queue.splice(0, this.__queue.length);
  }
}

/**
 * Create a fresh worker-side mirror document.
 * @returns {{document: MirrorDocument, drainMutations: () => object[]}}
 */
export function createMirrorDocument() {
  const document = new MirrorDocument();
  return { document, drainMutations: () => document.drainMutations() };
}
