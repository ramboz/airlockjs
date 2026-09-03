// Enforcement inspector dev panel — spec 028-03 (closes 028).
//
// A pure view-model (`inspectorModel`) + a thin DOM mount (`renderInspectorPanel`)
// over the 028-01 collector / 028-02 beacon chains. Tested with a hand-rolled
// fakeEl/fakeDoc shim (no jsdom — mirrors test/dom-apply-coordinator.test.js /
// test/eds-dom-reserve.test.js). Synthetic content only.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { inspectorModel, renderInspectorPanel } from "../core/inspector/panel.js";
import { createInspectorCollector } from "../core/inspector/collector.js";

// A fakeEl rich enough for the panel: children + replaceChildren + textContent
// (setting text clears children, real-DOM semantics) + setAttribute.
function fakeEl(tag) {
  const el = {
    tag,
    children: [],
    attrs: {},
    __text: "",
    appendChild(c) { el.children.push(c); return c; },
    replaceChildren() { el.children.length = 0; },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    get textContent() { return el.__text; },
    set textContent(v) { el.__text = String(v); el.children.length = 0; },
  };
  return el;
}
const fakeDoc = { createElement: (t) => fakeEl(t) };
// recursively collect all text + tags in the rendered tree
function allText(el) {
  let t = el.__text || "";
  for (const c of el.children || []) t += "\n" + allText(c);
  return t;
}
function allTags(el, acc = []) {
  for (const c of el.children || []) { acc.push(c.tag); allTags(c, acc); }
  return acc;
}

const CHAIN_RECORDS = [
  { level: "warn", kind: "consent", disposition: "held", purpose: "analytics_storage", reason: "purpose pending", beaconId: "abc123#1", destination: "https://t0.example/collect" },
  { level: "warn", kind: "consent", disposition: "flushed", purpose: "analytics_storage", reason: "purpose granted", beaconId: "abc123#1", destination: "https://t0.example/collect" },
  { level: "warn", kind: "dropped", type: "page_view", reason: "malformed", index: 0 }, // no beaconId -> loose
];

describe("inspectorModel (AC1) — groups records into per-beacon chains + loose + counts", () => {
  it("groups by beaconId into an ordered chain; lists un-correlated records; counts by disposition", () => {
    const m = inspectorModel(CHAIN_RECORDS);
    expect(m.beacons).toHaveLength(1);
    expect(m.beacons[0].beaconId).toBe("abc123#1");
    expect(m.beacons[0].destination).toBe("https://t0.example/collect");
    expect(m.beacons[0].chain.map((s) => s.disposition)).toEqual(["held", "flushed"]); // emission order
    expect(m.loose).toHaveLength(1);
    expect(m.loose[0].kind).toBe("dropped");
    expect(m.counts.total).toBe(3);
    expect(m.counts.byDisposition).toEqual({ held: 1, flushed: 1, "(none)": 1 });
  });

  it("accepts a collector and delegates filtering to query()", () => {
    const c = createInspectorCollector();
    for (const r of CHAIN_RECORDS) c.onDiagnostic(r);
    const held = inspectorModel(c, { disposition: "held" });
    expect(held.counts.total).toBe(1);
    expect(held.beacons[0].chain).toEqual([{ kind: "consent", disposition: "held", reason: "purpose pending" }]);
  });

  it("empty / non-collector source -> an empty model, never throws", () => {
    expect(inspectorModel(null).counts.total).toBe(0);
    expect(inspectorModel([]).beacons).toEqual([]);
  });
});

describe("renderInspectorPanel (AC2/AC5) — DOM mount, XSS-safe, graceful", () => {
  it("renders a counts header, a beacon chain section, and a loose list", () => {
    const c = createInspectorCollector();
    for (const r of CHAIN_RECORDS) c.onDiagnostic(r);
    const el = fakeEl("div");
    const model = renderInspectorPanel(el, c, { doc: fakeDoc });

    const text = allText(el);
    expect(text).toContain("airlock inspector — 3 decision(s)");
    expect(text).toContain("beacon abc123#1 → https://t0.example/collect");
    expect(text).toContain("consent held");
    expect(text).toContain("consent flushed");
    expect(text).toContain("un-correlated (1)");
    expect(model.counts.total).toBe(3); // returns the model too
    expect(allTags(el)).toContain("section"); // structured, not one text blob
  });

  it("AC2 — a `reason` carrying markup renders as INERT text, never as an element (XSS-safe)", () => {
    const c = createInspectorCollector();
    c.onDiagnostic({ kind: "endpoint-ceiling", disposition: "held", reason: "<script>alert(1)</script>", beaconId: "x#1", destination: "https://evil.example/x" });
    const el = fakeEl("div");
    renderInspectorPanel(el, c, { doc: fakeDoc });

    expect(allText(el)).toContain("<script>alert(1)</script>"); // present as LITERAL text
    expect(allTags(el)).not.toContain("script"); // ...and NOT as a created <script> element
  });

  it("AC5 — an empty collector renders an empty-state view (no error)", () => {
    const el = fakeEl("div");
    renderInspectorPanel(el, createInspectorCollector(), { doc: fakeDoc });
    expect(allText(el)).toContain("no enforcement decisions this session");
  });

  it("AC5 — a missing element or document is a no-op, never throws", () => {
    expect(() => renderInspectorPanel(null, createInspectorCollector(), { doc: fakeDoc })).not.toThrow();
    expect(renderInspectorPanel(null, createInspectorCollector(), { doc: fakeDoc })).toBeNull();
    expect(renderInspectorPanel(fakeEl("div"), createInspectorCollector(), { doc: null })).toBeNull(); // no document available
  });
});

describe("renderInspectorPanel (AC3/AC4) — pull-only, off the hot path, no network", () => {
  it("AC3 — rendering READS via query() and never writes the collector (pull, on demand)", () => {
    const c = createInspectorCollector();
    c.onDiagnostic({ kind: "consent", disposition: "held", beaconId: "a#1", destination: "d" });
    const querySpy = vi.spyOn(c, "query");
    const diagSpy = vi.spyOn(c, "onDiagnostic");
    renderInspectorPanel(fakeEl("div"), c, { doc: fakeDoc });
    expect(querySpy).toHaveBeenCalled(); // pull
    expect(diagSpy).not.toHaveBeenCalled(); // never captures during render — off the hot path

    // pull semantics: a new decision after render does NOT auto-update a previously rendered element.
    const el = fakeEl("div");
    renderInspectorPanel(el, c, { doc: fakeDoc });
    const before = allText(el);
    c.onDiagnostic({ kind: "dropped", disposition: "x", type: "extra" });
    expect(allText(el)).toBe(before); // unchanged until the caller re-renders (on demand)
  });

  it("AC4 — drop-in/local: rendering makes no network call, and the module references no network API", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderInspectorPanel(fakeEl("div"), createInspectorCollector(), { doc: fakeDoc });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();

    const src = readFileSync(new URL("../core/inspector/panel.js", import.meta.url), "utf8");
    // bare identifiers (not `fetch(`) so an ALIASED global (`const f = fetch`) can't evade the grep.
    for (const net of ["fetch", "XMLHttpRequest", "WebSocket", "sendBeacon"]) {
      expect(src).not.toContain(net); // no remote backend / no account by construction
    }
  });

  it("AC5 — a missing collector (not just a missing el/doc) renders the empty state, never throws", () => {
    const el = fakeEl("div");
    expect(() => renderInspectorPanel(el, null, { doc: fakeDoc })).not.toThrow();
    expect(allText(el)).toContain("no enforcement decisions this session");
  });

  it("AC1 — a beacon's destination backfills from a later record when the first carries none", () => {
    const m = inspectorModel([
      { kind: "consent", disposition: "held", beaconId: "b#1" }, // no destination yet
      { kind: "consent", disposition: "flushed", beaconId: "b#1", destination: "https://t0.example/collect" },
    ]);
    expect(m.beacons[0].destination).toBe("https://t0.example/collect"); // backfilled
    expect(m.counts.total).toBe(2);
  });

  it("AC1 — counts.total counts only valid records, not raw input length (a direct-array caller may pass nulls)", () => {
    const m = inspectorModel([null, 42, { kind: "dropped", disposition: "x" }]);
    expect(m.counts.total).toBe(1); // the two junk entries are skipped, not counted
  });
});
