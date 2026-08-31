// Active-markup sanitizer — spec 018-01 (refinement-todo item k / mvp3.md
// release-check security criterion). `reserveSpace().fill()`'s default write
// path is sanitize-then-write instead of raw `innerHTML` (adapters/eds/dom.js)
// because the EDS default Trusted-Types policy is COMPATIBILITY-only for the
// `Element innerHTML` sink (probes/eds-testbed/scripts/scripts.js:61-78) — it
// does not strip `on*` handlers or active markup. The sanitizer is airlock's
// own.
//
// SUBSTRATE SPLIT (DoR pillar 4, frame-critique 018-01 — load-bearing, do not
// violate): vitest runs in Node (vitest.config.js sets no `environment`),
// which has NO `DOMParser`, and this project deliberately ships no jsdom/
// happy-dom/linkedom. A sanitizer parses->walks->strips->re-serializes, so it
// cannot be faithfully shimmed the way `{ querySelector }` is — a fake parse
// would make the vector table green-but-meaningless. So:
//   - THIS FILE covers only what is genuinely hermetic: the PURE
//     strip-predicate helpers, non-string/empty -> "", the DI-parser wiring
//     (an injected parser is called and its result threads through), and the
//     "no parser available" fallback (Node has no global DOMParser).
//   - The REAL parse->strip->serialize security vector table (each vector
//     stripped against ACTUAL browser HTML parsing, mXSS-adjacent edges, the
//     "does not fire" proof under a real Trusted-Types CSP) runs in the
//     Playwright rig (rig/sanitize-boundary.mjs) — that is the meaningful
//     proof for AC2/AC3/AC5, not this file.
import { describe, it, expect, vi } from "vitest";
import {
  sanitizeHtml,
  isEventHandlerAttr,
  isDangerousUrl,
  isStrippedTag,
  ACTIVE_URL_ATTRS,
  STRIPPED_TAGS,
} from "../core/sanitize-html.js";

describe("isEventHandlerAttr — the on* attribute predicate", () => {
  it("matches on* attribute names, case-insensitively", () => {
    expect(isEventHandlerAttr("onclick")).toBe(true);
    expect(isEventHandlerAttr("onerror")).toBe(true);
    expect(isEventHandlerAttr("ONLOAD")).toBe(true);
    expect(isEventHandlerAttr("OnMouseOver")).toBe(true);
  });
  it("does not match ordinary attributes, including ones that merely contain 'on'", () => {
    expect(isEventHandlerAttr("class")).toBe(false);
    expect(isEventHandlerAttr("href")).toBe(false);
    expect(isEventHandlerAttr("data-onboarding")).toBe(false); // "on" not a prefix
    expect(isEventHandlerAttr("aria-label")).toBe(false);
    expect(isEventHandlerAttr("style")).toBe(false);
  });
  it("is defensive on non-string / empty input — never throws, returns false", () => {
    expect(() => isEventHandlerAttr(null)).not.toThrow();
    expect(isEventHandlerAttr(null)).toBe(false);
    expect(isEventHandlerAttr(undefined)).toBe(false);
    expect(isEventHandlerAttr("")).toBe(false);
    expect(isEventHandlerAttr(42)).toBe(false);
  });
});

describe("isDangerousUrl — javascript:/vbscript:/data:text/html vs benign URLs", () => {
  it("flags javascript: and vbscript: URLs, case-insensitively", () => {
    expect(isDangerousUrl("javascript:alert(1)")).toBe(true);
    expect(isDangerousUrl("JAVASCRIPT:alert(1)")).toBe(true);
    expect(isDangerousUrl("vbscript:msgbox(1)")).toBe(true);
  });
  it("flags data:text/html (an active-markup carrier), case-insensitively", () => {
    expect(isDangerousUrl("data:text/html,<script>alert(1)</script>")).toBe(true);
    expect(isDangerousUrl("DATA:TEXT/HTML;base64,PHNjcmlwdD4=")).toBe(true);
  });
  it("flags an obfuscated scheme split by control/whitespace chars (a classic denylist-evasion trick)", () => {
    expect(isDangerousUrl("jav\tascript:alert(1)")).toBe(true);
    expect(isDangerousUrl("java\nscript:alert(1)")).toBe(true);
    expect(isDangerousUrl("  javascript:alert(1)")).toBe(true); // leading whitespace
  });
  it("does not flag benign URLs — https, relative, mailto, non-html data: URIs", () => {
    expect(isDangerousUrl("https://example.test/x")).toBe(false);
    expect(isDangerousUrl("/relative/path")).toBe(false);
    expect(isDangerousUrl("mailto:test@example.test")).toBe(false);
    expect(isDangerousUrl("data:image/png;base64,AAAA")).toBe(false); // data:, but not text/html
  });
  it("is defensive on non-string input — never throws, returns false", () => {
    expect(() => isDangerousUrl(null)).not.toThrow();
    expect(isDangerousUrl(null)).toBe(false);
    expect(isDangerousUrl(undefined)).toBe(false);
    expect(isDangerousUrl(123)).toBe(false);
    expect(isDangerousUrl("")).toBe(false);
  });
});

describe("isStrippedTag — the denylisted-element predicate", () => {
  it("matches every denylisted tag, case-insensitively", () => {
    for (const tag of ["script", "iframe", "object", "embed", "base", "meta", "link"]) {
      expect(isStrippedTag(tag)).toBe(true);
      expect(isStrippedTag(tag.toUpperCase())).toBe(true);
    }
  });
  it("does not match ordinary content elements", () => {
    for (const tag of ["div", "span", "a", "img", "p", "svg"]) {
      expect(isStrippedTag(tag)).toBe(false);
    }
  });
  it("is defensive on non-string input — never throws, returns false", () => {
    expect(() => isStrippedTag(null)).not.toThrow();
    expect(isStrippedTag(null)).toBe(false);
    expect(isStrippedTag(undefined)).toBe(false);
  });
});

describe("the denylist surface itself (pins the spec's exact vectors)", () => {
  it("ACTIVE_URL_ATTRS is exactly the spec's active-URL-attribute set", () => {
    expect([...ACTIVE_URL_ATTRS].sort()).toEqual(
      ["action", "background", "formaction", "href", "poster", "src", "xlink:href"].sort(),
    );
  });
  it("STRIPPED_TAGS is exactly the spec's denylisted-element set", () => {
    expect([...STRIPPED_TAGS].sort()).toEqual(
      ["base", "embed", "iframe", "link", "meta", "object", "script"].sort(),
    );
  });
});

describe("sanitizeHtml — non-string/empty input never throws, always \"\"", () => {
  it.each([null, undefined, 123, {}, [], true, ""])("returns \"\" for %p", (input) => {
    expect(() => sanitizeHtml(input)).not.toThrow();
    expect(sanitizeHtml(input)).toBe("");
  });
});

describe("sanitizeHtml — no parser available (Node has no global DOMParser) fails SAFE, not raw", () => {
  it("returns \"\" rather than the raw input when no parser is injected and none is ambient", () => {
    expect(typeof globalThis.DOMParser).toBe("undefined"); // grounds the premise of this test
    expect(sanitizeHtml("<div>hi</div>")).toBe("");
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).toBe("");
  });
  it("never throws even though no parser exists", () => {
    expect(() => sanitizeHtml("<script>alert(1)</script>")).not.toThrow();
  });
});

describe("sanitizeHtml — the DI'd-parser seam (wiring only; NOT a real-HTML-parsing security proof — see file header)", () => {
  it("calls the injected parse() with the raw html and threads its result back out", () => {
    const fakeDoc = { querySelectorAll: () => [], body: { innerHTML: "clean-output" } };
    const parse = vi.fn(() => fakeDoc);
    const out = sanitizeHtml("<div>whatever</div>", { parse });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith("<div>whatever</div>");
    expect(out).toBe("clean-output");
  });

  it("walks the injected fake tree and strips on* attrs + denylisted-tag elements (proves the ALGORITHM's own walk/strip logic against a hand-built tree, mirroring the project's existing fakeDoc/fakeEl shim pattern — the real-parse fidelity proof is the Playwright rig)", () => {
    // A tiny fake element: real DOM shape (.attributes as {name,value} pairs,
    // getAttribute/removeAttribute, .tagName, .parentNode) — enough for
    // sanitizeHtml's walk to operate on, without a real DOM.
    function fakeElement(tagName, attrs) {
      const map = { ...attrs };
      return {
        tagName,
        parentNode: null,
        get attributes() {
          return Object.keys(map).map((name) => ({ name, value: map[name] }));
        },
        getAttribute(name) { return name in map ? map[name] : null; },
        removeAttribute(name) { delete map[name]; },
        _remainingAttrs: () => ({ ...map }),
      };
    }
    const img = fakeElement("img", { onerror: "alert(1)", src: "https://ok.test/x.png" });
    const link = fakeElement("a", { href: "javascript:alert(2)" });
    const scriptEl = fakeElement("script", { src: "https://ok.test/x.js" });
    const container = { children: [img, link, scriptEl] };
    for (const el of container.children) el.parentNode = container;
    container.removeChild = (el) => {
      container.children = container.children.filter((c) => c !== el);
    };
    const fakeDoc = {
      querySelectorAll: () => [img, link, scriptEl],
      body: {
        get innerHTML() {
          return container.children
            .map((c) => "<" + c.tagName + Object.entries(c._remainingAttrs())
              .map(([k, v]) => " " + k + "=\"" + v + "\"").join("") + ">")
            .join("");
        },
      },
    };
    const parse = vi.fn(() => fakeDoc);

    const out = sanitizeHtml(
      '<img onerror="alert(1)" src="https://ok.test/x.png"><a href="javascript:alert(2)"></a><script src="https://ok.test/x.js"></script>',
      { parse },
    );

    expect(parse).toHaveBeenCalledOnce();
    expect(out).not.toMatch(/onerror/i); // the on* attr was stripped
    expect(out).not.toMatch(/javascript:/i); // the dangerous href value was stripped
    expect(out).not.toMatch(/<script/i); // the whole <script> element was removed
    expect(out).toMatch(/img/); // the (now-clean) <img> element itself survives
    expect(out).toMatch(/src="https:\/\/ok\.test\/x\.png"/); // the benign src survives
  });

  it("recurses into a <template>'s .content — a separate fragment tree ordinary querySelectorAll does NOT reach, but that IS serialized back out via an ancestor's innerHTML (a well-known sanitizer-bypass vector)", () => {
    // A <template> element's children live in `.content` (a DocumentFragment),
    // not as ordinary children reachable from the light-DOM querySelectorAll —
    // exactly like the real DOM. If sanitizeHtml only walked the top-level
    // querySelectorAll("*") result, a <script> hidden inside a <template>
    // would survive untouched and still show up when innerHTML serializes it.
    function fakeElement(tagName, attrs) {
      const map = { ...attrs };
      return {
        tagName,
        parentNode: null,
        get attributes() { return Object.keys(map).map((name) => ({ name, value: map[name] })); },
        getAttribute(name) { return name in map ? map[name] : null; },
        removeAttribute(name) { delete map[name]; },
      };
    }
    const hiddenScript = fakeElement("script", { src: "https://evil.test/x.js" });
    const templateContentContainer = { children: [hiddenScript] };
    hiddenScript.parentNode = templateContentContainer;
    templateContentContainer.removeChild = (el) => {
      templateContentContainer.children = templateContentContainer.children.filter((c) => c !== el);
    };
    const templateContent = {
      querySelectorAll: () => [hiddenScript],
      get innerHTML() { return templateContentContainer.children.length ? "<script>" : ""; },
    };
    const templateEl = fakeElement("template", {});
    templateEl.content = templateContent; // the real DOM's template.content shape
    const bodyContainer = { children: [templateEl] };
    templateEl.parentNode = bodyContainer;
    const fakeDoc = {
      querySelectorAll: () => [templateEl], // top-level walk does NOT see hiddenScript directly
      body: {
        get innerHTML() {
          return bodyContainer.children
            .map((_c) => "<template>" + templateContent.innerHTML + "</template>")
            .join("");
        },
      },
    };
    const parse = vi.fn(() => fakeDoc);

    const out = sanitizeHtml("<template><script src=\"https://evil.test/x.js\"></script></template>", { parse });

    expect(out).not.toMatch(/<script/i); // the template's HIDDEN content was still reached and stripped
    expect(out).toContain("<template>"); // the (now-empty) template shell itself survives
  });
});

describe("sanitizeHtml — the injectable-override contract (a caller-supplied parse always wins over the ambient default)", () => {
  it("uses the injected parse even when one is supplied alongside otherwise-normal input", () => {
    const fakeDoc = { querySelectorAll: () => [], body: { innerHTML: "overridden" } };
    const parse = vi.fn(() => fakeDoc);
    expect(sanitizeHtml("<p>hi</p>", { parse })).toBe("overridden");
  });
});
