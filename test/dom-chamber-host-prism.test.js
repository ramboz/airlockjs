// core/dom-chamber-host.js x REAL Prism (spec 025-03 AC1/AC2) — THE
// load-bearing grounding proof: the UNMODIFIED `prismjs` package (read
// fresh from node_modules, byte-unmodified — never copied/forked into this
// repo, AC8) runs against airlock's OWN mirror via the SAME host
// test/dom-chamber-host.test.js already proves the synthetic nasty-tag
// against. A fast, hermetic (Node/vitest) iteration loop for AC1's "ground
// by running Prism" discipline — any DOM-surface gap Prism needs surfaces
// HERE first, before the (much slower) browser rig
// (rig/airlock-mirror-prism.mjs).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { createDomChamberHost } from "../core/dom-chamber-host.js";
import { OP, DOCUMENT_ID } from "../core/worker-dom/protocol.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRISM_JS = readFileSync(join(ROOT, "node_modules/prismjs/prism.js"), "utf8");
const AUTHOR_SOURCE = readFileSync(join(ROOT, "rig/airlock-mirror-prism-author.js"), "utf8")
  .replaceAll("__REPEAT__", "10"); // a small REPEAT for a fast unit test — the browser rig uses the real scale (60)

// The SAME concatenation shape rig/airlock-mirror-prism-harness.html builds
// for the worker: a prefix (see PREFIX's own comment below) + the REAL,
// UNMODIFIED prism.js + the author glue.
//
// PREFIX, grounded by running Prism against this host (not assumed):
//  (1) `Prism.manual = true` — a DOCUMENTED public config Prism reads off a
//      pre-existing global BEFORE its own auto-highlight-on-load path runs
//      (prism.js:34-56) — a supported integration mode, not a code change.
//  (2) a minimal `Element` global STUB — prism.js's BUNDLED file-highlight
//      component carries an IE11-era polyfill guard
//      (`if (!Element.prototype.matches) { Element.prototype.matches = …
//      }`, prism.js:1759) that runs UNCONDITIONALLY at Prism's own top-level
//      load (component bundles execute top-to-bottom regardless of
//      `Prism.manual` — that flag only gates the LATER auto-highlight-call,
//      not this earlier top-level guard). It references the BARE GLOBAL
//      `Element` — present in a real browser main-thread `window`, but
//      ABSENT from a Worker's global scope too (not just this mirror's —
//      Worker realms expose no DOM constructors at all) and from Node.
//      Axis-classified LIB-COMPLETENESS (an environment-assumption gap in a
//      bundled IE-compat shim, needing zero live-layout info), NOT
//      model-inherent — the SAME class of gap 025-01 found for
//      `.matches()` itself (there, `@ampproject/worker-dom` DOES install an
//      ambient `self.Element`, so 025-01 patched ITS `.prototype.matches`
//      directly; airlock's OWN mirror deliberately installs NO ambient
//      globals beyond `document`, ADR-0001/025-02's own design — so the
//      minimal stub lives HERE, in the glue-level prefix, never in
//      core/worker-dom/mirror.js itself, keeping that design intact). The
//      stub's own `.matches` is never actually CALLED (env.element/pre in
//      Prism's own hook are MirrorElement instances, whose `.matches()`
//      spec 025-03 AC1 already added — see core/worker-dom/mirror.js); this
//      stub exists SOLELY to make the top-level `if (!Element.prototype.
//      matches)` guard's CONDITION referenceable without throwing.
const PREFIX = "globalThis.Prism = { manual: true };\n"
  + "globalThis.Element = function () {};\n"
  + "globalThis.Element.prototype.matches = function () { return false; };\n";
const COMBINED_AUTHOR_SOURCE = PREFIX + PRISM_JS + "\n" + AUTHOR_SOURCE;

function findOps(ops, predicate) { return ops.filter(predicate); }
function lastOp(ops, predicate) {
  const matches = findOps(ops, predicate);
  return matches[matches.length - 1];
}

describe("createDomChamberHost().boot — runs UNMODIFIED real prismjs (spec 025-03 AC1/AC2)", () => {
  it("never throws booting the real, unmodified prismjs + author glue", () => {
    const host = createDomChamberHost();
    expect(() => host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 })).not.toThrow();
  });

  it("boot-time construction creates the <pre><code> pair + a status span, all appended to document.body", () => {
    const host = createDomChamberHost();
    const ops = host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 });
    expect(findOps(ops, (o) => o.op === OP.CREATE_ELEMENT && o.tag === "pre")).toHaveLength(1);
    expect(findOps(ops, (o) => o.op === OP.CREATE_ELEMENT && o.tag === "code")).toHaveLength(1);
    expect(findOps(ops, (o) => o.op === OP.CREATE_ELEMENT && o.tag === "span")).toHaveLength(1);
  });

  it("the code element's className is set via the classList-backed op (AC1)", () => {
    const host = createDomChamberHost();
    const ops = host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 });
    expect(findOps(ops, (o) => o.op === OP.CLASS_ADD && o.name === "language-javascript")).toHaveLength(1);
  });
});

describe("createDomChamberHost().dispatchEvent — REAL Prism tokenizes + sets innerHTML (spec 025-03 AC1/AC2)", () => {
  it("a forwarded click runs Prism.highlightElement — records a setInnerHTML op whose html is LONGER than the raw code (real tokenization, matches 025-01's own correctness signal)", () => {
    const host = createDomChamberHost();
    host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 });
    const ops = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    const htmlOps = findOps(ops, (o) => o.op === OP.SET_INNER_HTML);
    expect(htmlOps).toHaveLength(1);
    expect(htmlOps[0].html).toMatch(/<span class="token/);
    expect(htmlOps[0].html.length).toBeGreaterThan(0);
  });

  it("growth check: highlighted markup is LONGER than the raw source (real tokenization, not a silent no-op)", () => {
    const host = createDomChamberHost();
    const bootOps = host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 });
    const rawLen = Number(lastOp(bootOps, (o) => o.name === "data-raw-len").value);
    const ops = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    const htmlOp = findOps(ops, (o) => o.op === OP.SET_INNER_HTML)[0];
    expect(rawLen).toBeGreaterThan(0);
    expect(htmlOp.html.length).toBeGreaterThan(rawLen);
  });

  it("TWO click cycles both tokenize correctly — className stays readable across repeated highlightElement() passes (the grounded classList-backed-className fix, see test/worker-dom-mirror.test.js)", () => {
    const host = createDomChamberHost();
    host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 });
    const ops1 = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    const ops2 = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    const html1 = findOps(ops1, (o) => o.op === OP.SET_INNER_HTML)[0].html;
    const html2 = findOps(ops2, (o) => o.op === OP.SET_INNER_HTML)[0].html;
    // Both passes must produce REAL tokenized markup (language correctly
    // detected both times) — a degraded pass 2 (className lost -> "none"
    // grammar -> plain HTML-escaped text, no <span class="token"> wraps) is
    // exactly the bug a classList/className desync would cause.
    expect(html1).toMatch(/<span class="token/);
    expect(html2).toMatch(/<span class="token/);
  });

  it("a SECOND dispatch's status attributes accumulate (mirrors a real multi-click storm)", () => {
    const host = createDomChamberHost();
    host.boot({ authorSource: COMBINED_AUTHOR_SOURCE, elements: 0, workUs: 0 });
    host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    const ops2 = host.dispatchEvent({ targetId: DOCUMENT_ID, eventType: "click" });
    expect(lastOp(ops2, (o) => o.name === "data-clicks").value).toBe("2");
  });
});
