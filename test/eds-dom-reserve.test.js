// CWV-safe DOM-injection capability (`reserveSpace`) — spec 012-03, AC3/AC4.
//
// The AD-5 host-side capability: reserve a layout box up front (before paint) by
// `minHeight`, prehide it (main-thread anti-flicker), then FILL the pre-reserved
// box with the decision content — so nothing around it reflows. Mirrors how
// adapters/eds/cookies.js implements the cookie capability host-side (DI'd `doc`).
//
// The real geometry proof (getBoundingClientRect unchanged) is the browser rig
// (rig/alloy-decisions.mjs); here we unit-test the PURE spec/style/rect logic and
// the capability's mediated-write + prehide behaviour over a tiny element shim.
import { describe, it, expect, vi } from "vitest";
import {
  createDomCapability,
  normalizeReserveSpec,
  reservedBoxStyle,
  rectsEqual,
} from "../adapters/eds/dom.js";

const rect = (o) => ({ top: 0, left: 0, width: 0, height: 0, ...o });

describe("normalizeReserveSpec — eager/config-sourced spec validation (AC3)", () => {
  it("accepts { selector, minHeight } and trims the selector", () => {
    expect(normalizeReserveSpec({ selector: " #hero ", minHeight: 300 })).toEqual({ selector: "#hero", minHeight: 300 });
  });
  it("coerces a numeric-string minHeight", () => {
    expect(normalizeReserveSpec({ selector: "#hero", minHeight: "240" })).toEqual({ selector: "#hero", minHeight: 240 });
  });
  it("rejects a missing/empty selector or a negative/NaN minHeight → null", () => {
    expect(normalizeReserveSpec({ selector: "", minHeight: 10 })).toBeNull();
    expect(normalizeReserveSpec({ minHeight: 10 })).toBeNull();
    expect(normalizeReserveSpec({ selector: "#x", minHeight: -1 })).toBeNull();
    expect(normalizeReserveSpec({ selector: "#x", minHeight: "abc" })).toBeNull();
    expect(normalizeReserveSpec(null)).toBeNull();
  });
});

describe("reservedBoxStyle — the up-front reserved layout box (AC3)", () => {
  it("reserves minHeight in px so a later fill of content <= minHeight causes no reflow", () => {
    expect(reservedBoxStyle({ selector: "#hero", minHeight: 300 })).toEqual({ minHeight: "300px" });
  });
  it("returns null for an invalid spec", () => {
    expect(reservedBoxStyle({ minHeight: 5 })).toBeNull();
  });
});

describe("rectsEqual — deterministic geometry compare (AC3 leg b)", () => {
  it("true when top/left/width/height match", () => {
    expect(rectsEqual(rect({ top: 100, height: 300 }), rect({ top: 100, height: 300 }))).toBe(true);
  });
  it("false when the surrounding content moved (a reflow)", () => {
    expect(rectsEqual(rect({ top: 100 }), rect({ top: 400 }))).toBe(false);
  });
  it("false on a missing rect (never throws)", () => {
    expect(() => rectsEqual(null, rect({}))).not.toThrow();
    expect(rectsEqual(null, rect({}))).toBe(false);
  });
});

// A tiny element/document shim (no jsdom) — mirrors the exposure test's approach.
function fakeEl() {
  const attrs = {};
  let inner = "";
  return {
    style: {},
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    get innerHTML() { return inner; },
    set innerHTML(v) { inner = v; },
  };
}
const fakeDoc = (map) => ({ querySelector: (sel) => map[sel] || null });

describe("createDomCapability.reserveSpace — the mediated CWV-safe injection (AC3/AC4)", () => {
  it("reserves the box up front: sets min-height + a reserved marker on the target", async () => {
    const hero = fakeEl();
    const caps = createDomCapability(fakeDoc({ "#hero": hero }), { now: () => 42 });
    const handle = await caps.reserveSpace({ selector: "#hero", minHeight: 300 });

    expect(hero.style.minHeight).toBe("300px");
    expect(hero.getAttribute("data-airlock-reserved")).toBeTruthy();
    expect(typeof handle.id).toBe("string");
    expect(handle.reservedAt).toBe(42);
  });

  it("PREHIDES the reserved region (main-thread anti-flicker) until fill (AC4)", async () => {
    const hero = fakeEl();
    const caps = createDomCapability(fakeDoc({ "#hero": hero }));
    const handle = await caps.reserveSpace({ selector: "#hero", minHeight: 300 });
    expect(hero.style.visibility).toBe("hidden"); // prehidden

    handle.fill("<p>x</p>");
    expect(hero.style.visibility).toBe("visible"); // revealed on fill
  });

  it("fill() is the ONLY mediated write — it sanitizes then fills the pre-reserved box + marks it filled (018-01: default write path runs through sanitize)", async () => {
    const hero = fakeEl();
    // Node has no DOMParser (018-01 DoR pillar 4 — vitest runs in Node, no
    // jsdom/happy-dom/linkedom is shipped) — inject a passthrough `sanitize`
    // so this test can assert the WRITE-PATH WIRING (the sanitize step runs
    // and its RESULT is what gets written) without needing a real parse. The
    // real parse->strip->serialize proof (an actual onerror stripped by a
    // real DOMParser) is the Playwright rig's job (rig/sanitize-boundary.mjs),
    // not this file's (018-01 DoD).
    const sanitize = vi.fn((html) => html);
    const caps = createDomCapability(fakeDoc({ "#hero": hero }), { sanitize });
    const handle = await caps.reserveSpace({ selector: "#hero", minHeight: 300 });

    handle.fill('<div class="hero">Personalized</div>');
    expect(sanitize).toHaveBeenCalledWith('<div class="hero">Personalized</div>');
    expect(hero.innerHTML).toBe('<div class="hero">Personalized</div>');
    expect(hero.getAttribute("data-airlock-filled")).toBe("1");
    // the box height was reserved BEFORE the fill, so min-height is still in force
    expect(hero.style.minHeight).toBe("300px");
  });

  it("the default write path routes content through sanitize BEFORE writing — the WRITTEN bytes are sanitize's result, not the raw input (018-01 AC1)", async () => {
    const hero = fakeEl();
    // A Node-safe stand-in sanitize (string-regex-based) — NOT the real
    // parser-based strip algorithm (core/sanitize-html.js, proven against a
    // real DOMParser only in the Playwright rig). This test's job is only to
    // prove the SEAM: the default `setContent` calls `sanitize(content)` and
    // writes ITS return value, never the raw content directly.
    const sanitize = vi.fn((html) => html.replace(/ onerror="[^"]*"/gi, ""));
    const caps = createDomCapability(fakeDoc({ "#hero": hero }), { sanitize });
    const handle = await caps.reserveSpace({ selector: "#hero", minHeight: 300 });

    const malicious = '<img src="x" onerror="alert(1)">';
    handle.fill(malicious);

    expect(sanitize).toHaveBeenCalledWith(malicious);
    expect(hero.innerHTML).not.toBe(malicious); // NOT a raw passthrough of the dangerous string
    expect(hero.innerHTML).toBe('<img src="x">'); // sanitize's result is what was actually written
  });

  it("a caller-supplied setContent still fully overrides the default sanitize-then-write (AC4 — the seam stays injectable)", async () => {
    const hero = fakeEl();
    const sanitize = vi.fn(() => "SHOULD-NOT-BE-CALLED");
    const setContent = vi.fn((el, content) => { el.innerHTML = content; }); // a caller's own (raw) write
    const caps = createDomCapability(fakeDoc({ "#hero": hero }), { sanitize, setContent });
    const handle = await caps.reserveSpace({ selector: "#hero", minHeight: 300 });

    const raw = '<img src="x" onerror="alert(1)">';
    handle.fill(raw);

    expect(setContent).toHaveBeenCalledWith(hero, raw);
    expect(hero.innerHTML).toBe(raw); // the override's own (unsanitized) write wins, byte-for-byte
    expect(sanitize).not.toHaveBeenCalled(); // the default sanitize step never ran — full override, not a wrapper
  });

  it("the TRUE default (no injected sanitize/setContent) fails SAFE in this no-DOMParser (Node) env — writes \"\", never leaks the raw dangerous content (documents the Node-specific fallback; the real strip proof is the Playwright rig)", async () => {
    const hero = fakeEl();
    const caps = createDomCapability(fakeDoc({ "#hero": hero })); // zero opts — the REAL production default
    const handle = await caps.reserveSpace({ selector: "#hero", minHeight: 300 });

    handle.fill('<img src="x" onerror="alert(1)">');
    expect(hero.innerHTML).toBe(""); // sanitizeHtml fails SAFE (no DOMParser in Node) — never the raw dangerous string
    expect(hero.getAttribute("data-airlock-filled")).toBe("1"); // fill() still completes — never breaks the page
  });

  it("the prehide TIMEOUT reveals the box even if no decision ever fills it (backstop)", async () => {
    const hero = fakeEl();
    const timers = [];
    const schedule = (fn) => { timers.push(fn); };
    const caps = createDomCapability(fakeDoc({ "#hero": hero }), { schedule });
    await caps.reserveSpace({ selector: "#hero", minHeight: 300, timeout: 3000 });
    expect(hero.style.visibility).toBe("hidden");
    expect(timers).toHaveLength(1);
    timers[0](); // fire the anti-flicker timeout
    expect(hero.style.visibility).toBe("visible");
  });

  it("prehide:false reserves the box without hiding it", async () => {
    const hero = fakeEl();
    const caps = createDomCapability(fakeDoc({ "#hero": hero }));
    await caps.reserveSpace({ selector: "#hero", minHeight: 300, prehide: false });
    expect(hero.style.visibility).not.toBe("hidden");
  });

  it("rejects an invalid spec or a selector that matches nothing (never a silent no-op)", async () => {
    const caps = createDomCapability(fakeDoc({}));
    await expect(caps.reserveSpace({ selector: "", minHeight: 1 })).rejects.toThrow(/spec/i);
    await expect(caps.reserveSpace({ selector: "#missing", minHeight: 1 })).rejects.toThrow(/#missing/);
  });

  it("insertAfterInteraction is DECLARED-NOT-BUILT this slice — it rejects loudly", async () => {
    const caps = createDomCapability(fakeDoc({ "#hero": fakeEl() }));
    await expect(caps.insertAfterInteraction({ selector: "#hero", html: "x", position: "after" })).rejects.toThrow(/declared-not-built|not built/i);
  });
});
