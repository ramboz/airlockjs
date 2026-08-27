import { describe, it, expect, vi, beforeEach } from "vitest";
import { wireInteractions, UC2_EVENTS } from "../adapters/eds/index.js";

// Slice 004-04 AC1+AC2: the EDS adapter wires the real interaction → GA4 beacon
// paths, owning BOTH senders so the push()-XOR-pushCritical() rule holds by
// construction (ADR-0004) — each event name has exactly ONE sender:
//   - cta_engage    (AC1) via push()        — non-navigating, steady-state worker cycle
//   - outbound_click(AC2) via pushCritical()— navigating anchor leaving the page
//   - page_view     (AC2) via pushCritical()— closing beacon on pagehide
// Distinct names (so the XOR rule is not tripped) and the closing beacon carries
// the CURRENT page_location (caller-read at unload time, not the boot value).
//
// Unit-tested over tiny DOM shims (the real-page delivery is rig/e2e.mjs). No
// Worker, no network — this asserts the WIRING, not the cycle.

// A minimal EventTarget: captures listeners by type so a test can fire them.
function makeTarget() {
  const listeners = {};
  return {
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    fire(type, event) {
      (listeners[type] || []).forEach((fn) => fn(event));
    },
  };
}

// A fake element whose closest(sel) matches only the selectors it was built with,
// mirroring the delegated-listener contract (target.closest("#cta-engage") /
// target.closest("a[href]")).
function fakeEl({ matches = [], href, text = "", target, download = false } = {}) {
  const el = { href, textContent: text, target };
  el.hasAttribute = (name) => name === "download" && download;
  el.closest = (sel) => (matches.includes(sel) ? el : null);
  return el;
}

let handle;
let doc;
let win;
let loc;

beforeEach(() => {
  handle = { push: vi.fn(), pushCritical: vi.fn() };
  doc = makeTarget();
  win = makeTarget();
  loc = { href: "http://localhost:3111/", origin: "http://localhost:3111" };
});

describe("wireInteractions — AC1 non-navigating CTA (worker cycle via push)", () => {
  it("a click on #cta-engage pushes a DISTINCT `cta_engage` event via push() (not pushCritical)", () => {
    wireInteractions(handle, { doc, win, loc });

    doc.fire("click", { target: fakeEl({ matches: ["#cta-engage"], text: "See pricing" }) });

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({
      event: "cta_engage",
      link_text: "See pricing",
      page_location: "http://localhost:3111/",
    });
    // AC1 is the steady-state worker path — the CTA must NOT take the fast path.
    expect(handle.pushCritical).not.toHaveBeenCalled();
  });

  it('the AC1 event name is "cta_engage" (distinct from the AC2 names)', () => {
    expect(UC2_EVENTS.engage).toBe("cta_engage");
    expect(UC2_EVENTS.engage).not.toBe(UC2_EVENTS.outbound);
    expect(UC2_EVENTS.engage).not.toBe(UC2_EVENTS.closing);
  });
});

describe("wireInteractions — AC2 outbound-link fast path (pushCritical)", () => {
  it("a click on the /signup anchor sends a DISTINCT `outbound_click` critical beacon", () => {
    wireInteractions(handle, { doc, win, loc });

    doc.fire("click", {
      target: fakeEl({ matches: ["a[href]"], href: "http://localhost:3111/signup" }),
    });

    expect(handle.pushCritical).toHaveBeenCalledTimes(1);
    expect(handle.pushCritical).toHaveBeenCalledWith({
      event: "outbound_click",
      link_url: "http://localhost:3111/signup",
      page_location: "http://localhost:3111/",
    });
    // AC2 outbound is the fast path only — never the steady-state push.
    expect(handle.push).not.toHaveBeenCalled();
  });

  it("an OFF-ORIGIN anchor is treated as outbound and takes the fast path", () => {
    wireInteractions(handle, { doc, win, loc });

    doc.fire("click", {
      target: fakeEl({ matches: ["a[href]"], href: "https://vendor.example/checkout" }),
    });

    expect(handle.pushCritical).toHaveBeenCalledTimes(1);
    expect(handle.pushCritical.mock.calls[0][0]).toMatchObject({
      event: "outbound_click",
      link_url: "https://vendor.example/checkout",
    });
  });

  it("a same-origin, non-/signup internal link is NOT a fast-path beacon (neither sender fires)", () => {
    wireInteractions(handle, { doc, win, loc });

    doc.fire("click", {
      target: fakeEl({ matches: ["a[href]"], href: "http://localhost:3111/about" }),
    });

    expect(handle.pushCritical).not.toHaveBeenCalled();
    expect(handle.push).not.toHaveBeenCalled();
  });

  // Craft review 004-04: clicks that do NOT tear the current page down must not take
  // the synchronous fast path (they'd emit a spurious beacon + pay a main-thread map).
  it("does NOT fire for non-http(s) schemes, modified clicks, target=_blank, or download", () => {
    wireInteractions(handle, { doc, win, loc });
    const offOrigin = "https://vendor.example/checkout";

    // mailto: / tel: / javascript: — no page teardown
    doc.fire("click", { target: fakeEl({ matches: ["a[href]"], href: "mailto:x@y.z" }) });
    // modified click (cmd/ctrl/shift/alt) — opens a new context
    doc.fire("click", { metaKey: true, target: fakeEl({ matches: ["a[href]"], href: offOrigin }) });
    // target=_blank — new tab, current page stays
    doc.fire("click", { target: fakeEl({ matches: ["a[href]"], href: offOrigin, target: "_blank" }) });
    // download — no navigation
    doc.fire("click", { target: fakeEl({ matches: ["a[href]"], href: offOrigin, download: true }) });
    // already handled by an SPA router
    doc.fire("click", { defaultPrevented: true, target: fakeEl({ matches: ["a[href]"], href: offOrigin }) });

    expect(handle.pushCritical).not.toHaveBeenCalled();
    expect(handle.push).not.toHaveBeenCalled();
  });
});

describe("wireInteractions — AC2 closing pageview (pushCritical, current page_location)", () => {
  it("pagehide sends a `page_view` critical beacon carrying the CURRENT page_location (not boot)", () => {
    wireInteractions(handle, { doc, win, loc });

    // The page navigated within its life BEFORE the closing beacon fires.
    loc.href = "http://localhost:3111/pricing";
    win.fire("pagehide", {});

    expect(handle.pushCritical).toHaveBeenCalledTimes(1);
    expect(handle.pushCritical).toHaveBeenCalledWith({
      event: "page_view",
      page_location: "http://localhost:3111/pricing", // read AT CALL TIME, not the boot "/"
    });
    expect(handle.push).not.toHaveBeenCalled();
  });
});

describe("wireInteractions — robustness", () => {
  it("a click whose target cannot be resolved (no closest) never throws and sends nothing", () => {
    wireInteractions(handle, { doc, win, loc });

    expect(() => doc.fire("click", { target: null })).not.toThrow();
    expect(() => doc.fire("click", { target: {} })).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
    expect(handle.pushCritical).not.toHaveBeenCalled();
  });

  it("is idempotent-ish: wiring the same document twice does not double-send a click", () => {
    wireInteractions(handle, { doc, win, loc });
    wireInteractions(handle, { doc, win, loc }); // second boot must not add a 2nd listener

    doc.fire("click", { target: fakeEl({ matches: ["#cta-engage"], text: "See pricing" }) });

    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("no DOM (node) → no-op, never throws (boot stays safe off a real page)", () => {
    expect(() => wireInteractions(handle, {})).not.toThrow();
  });
});
