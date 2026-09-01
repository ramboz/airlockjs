// helix-rum connector — spec 022-01 (unit-level: manifest, sampling, handle()
// shape). Mirrors test/ga4-connector.test.js's structure: the connector is
// tested standalone AND hosted via the SAME generic createConnectorHost GA4/
// alloy use (mechanism B — a native beacon reproduction, wire-protocol
// archetype, contracts/connector.d.ts). Wire contract GROUNDED against
// probes/eds-testbed/scripts/aem.js:14-135 (`sampleRUM`/`sendPing`), read
// 2026-08-31 — see connectors/helix-rum/map.js's header for the exact citation.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createHelixRumConnector,
  DEFAULT_COLLECT_BASE_URL,
  DEFAULT_WEIGHT,
} from "../connectors/helix-rum/connector.js";
import { createConnectorHost } from "../core/connector-host.js";

const ctx = { referer: "https://spike.example/some/page" };

// isSelected = weight > 0 && Math.random() * weight < 1 (grounded —
// probes/eds-testbed/scripts/aem.js:36-37). A draw of 0 always selects (0 *
// weight < 1 for any weight > 0); a draw of 0.999999 with the default weight
// (100) does NOT (0.999999 * 100 ≈ 99.9999 >= 1) — deterministic
// selected/unselected fixtures, no dependency on Math.random's real entropy.
const SELECTED_DRAW = 0;
const UNSELECTED_DRAW = 0.999999;

afterEach(() => vi.restoreAllMocks());

describe("helix-rum connector manifest (spec 022-01 AC2 — declared per ADR-0006/0007)", () => {
  it("declares name/events (top + error, 022-02 widened scope) + EMPTY reads (no projection)", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const { manifest } = createHelixRumConnector({ ctx });

    expect(manifest.name).toBe("airlock/helix-rum");
    // 022-02 AC1: widens the 022-01 top-only scope to the `error` checkpoints
    // (3 window listeners, aem.js:68-92). The CWV/interaction enhancer
    // checkpoints remain out of scope (022-04 — a new runtime capture).
    expect(manifest.events).toEqual(["top", "error"]);
    // reads = PROJECTION fields (ADR-0003). RUM reads host-sourced ctx.referer,
    // never a projection snapshot field -> reads is EMPTY, mirroring GA4.
    expect(manifest.reads).toEqual([]);
  });

  it("requests egress but NO cookie capability — the id is ephemeral/per-page, never persisted", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const { manifest } = createHelixRumConnector({ ctx });

    expect(manifest.capabilities.egress).toBe(true);
    // Contrast GA4 (_ga/_ga_) and alloy (kndctr_/AMCV_/demdex/...): RUM's `id`
    // is a fresh crypto.randomUUID() slice, never a cookie-backed identifier.
    expect(manifest.capabilities.cookies).toBeUndefined();
  });

  it("declares ONE advisory endpoint, computed exactly like the runtime URL: ot.aem.live + `.rum/${weight}` (default weight 100)", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const { manifest } = createHelixRumConnector({ ctx });

    expect(manifest.endpoints).toEqual([`${DEFAULT_COLLECT_BASE_URL}/.rum/${DEFAULT_WEIGHT}`]);
  });

  it("declares purposes.egress: [] DELIBERATELY (not omitted) — the not-consent-gated RUM governance class (spec 022 § Governance class)", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const { manifest } = createHelixRumConnector({ ctx });

    expect(manifest.purposes).toBeDefined();
    expect(manifest.purposes.egress).toEqual([]);
  });

  it("honours a custom collectBaseURL/weight in BOTH the declared endpoint and the runtime URL (ceiling-consistency)", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx, collectBaseURL: "https://rum.example", weight: 10 });

    expect(connector.manifest.endpoints).toEqual(["https://rum.example/.rum/10"]);
    const [request] = connector.handle({ type: "top", ts: 5 });
    expect(request.url).toBe("https://rum.example/.rum/10");
  });
});

describe("helix-rum connector init() (contract conformance only, mirrors GA4)", () => {
  it("is a synchronous no-op that never throws — no vendor SDK to boot", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });
    expect(() => connector.init({})).not.toThrow();
    expect(connector.init({})).toBeUndefined();
    expect(connector.init(undefined)).toBeUndefined();
  });
});

describe("helix-rum connector handle() — the grounded beacon shape (spec 022-01 AC2)", () => {
  it("shapes EXACTLY the 5-field grounded body: {weight,id,referer,checkpoint,t} — payload-hygiene BY CONSTRUCTION", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [request] = connector.handle({ type: "top", ts: 123.45 });
    const body = JSON.parse(request.body);

    expect(Object.keys(body).sort()).toEqual(["checkpoint", "id", "referer", "t", "weight"]);
    expect(body).toEqual({
      weight: DEFAULT_WEIGHT,
      id: expect.any(String),
      referer: ctx.referer,
      checkpoint: "top",
      t: 123.45,
    });
  });

  it("the id is a synthetic 9-char ephemeral value (crypto.randomUUID().slice(-9)) — no cookie/persistent identifier", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [request] = connector.handle({ type: "top", ts: 1 });
    const { id } = JSON.parse(request.body);

    // The last 9 hex chars of a UUID's final 12-char group never carry a
    // dash (the last `-` sits 12 chars from the end) — pure hex, 9 long.
    expect(id).toMatch(/^[0-9a-f]{9}$/);
  });

  it("posts to the grounded URL shape: `.rum/${weight}` on the collect base", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [request] = connector.handle({ type: "top", ts: 1 });
    expect(request.url).toBe(`${DEFAULT_COLLECT_BASE_URL}/.rum/${DEFAULT_WEIGHT}`);
  });

  it("`t` is the event's OWN main-thread capture timestamp (event.ts), never regenerated in-connector", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [r1] = connector.handle({ type: "top", ts: 42 });
    expect(JSON.parse(r1.body).t).toBe(42);
  });

  it("returns AT MOST ONE request — no GA4-style per-tracker fan-out (AC3: no duplicate emission)", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const requests = connector.handle({ type: "top", ts: 1 });
    expect(requests.length).toBe(1);
  });
});

describe("helix-rum connector handle() — the `error` checkpoint (spec 022-02 AC1)", () => {
  it("shapes the grounded 7-field error body: the 5 base fields + {source, target}, matching dataFromErrorObj's shape", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [request] = connector.handle({
      type: "error",
      ts: 55,
      // errData rides on `event.params` — the internal `{ type, params }`
      // descriptor `core/airlock.js`'s `push({ event, ...params })` produces
      // (contracts/push-api.md), the SAME channel GA4/alloy's own `handle`
      // already read per-event data from.
      params: { source: "foo@https://example.com/a.js:1:2", target: "TypeError: x is not a function" },
    });
    const body = JSON.parse(request.body);

    expect(Object.keys(body).sort()).toEqual([
      "checkpoint", "id", "referer", "source", "t", "target", "weight",
    ]);
    expect(body).toEqual({
      weight: DEFAULT_WEIGHT,
      id: expect.any(String),
      referer: ctx.referer,
      checkpoint: "error",
      t: 55,
      source: "foo@https://example.com/a.js:1:2",
      target: "TypeError: x is not a function",
    });
  });

  it("also accepts errData via event.payload (the pinned AirlockEvent contract shape) — the SAME params||payload bridge GA4/alloy use", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [request] = connector.handle({
      type: "error",
      ts: 1,
      payload: { source: "csp", target: "https://blocked.example/script.js" },
    });
    const body = JSON.parse(request.body);

    expect(body.source).toBe("csp");
    expect(body.target).toBe("https://blocked.example/script.js");
  });

  it("posts to the SAME confined endpoint as `top` — one URL for the whole page, keyed only by weight", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [request] = connector.handle({ type: "error", ts: 1, params: { source: "s", target: "t" } });
    expect(request.url).toBe(`${DEFAULT_COLLECT_BASE_URL}/.rum/${DEFAULT_WEIGHT}`);
  });

  it("returns AT MOST ONE request for an error checkpoint too — no fan-out", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const requests = connector.handle({ type: "error", ts: 1, params: { source: "s", target: "t" } });
    expect(requests.length).toBe(1);
  });
});

describe("helix-rum connector — sampling-rate fidelity (spec 022-02 AC2)", () => {
  // The grounded rate table (aem.js:27-34), asserted literally here (not
  // imported from the connector) so the test verifies the GROUNDED contract,
  // not just mirrors whatever the implementation happens to export.
  it.each([
    ["on", 1],
    ["high", 10],
    ["medium", 100],
    ["low", 1000],
    ["off", 0],
  ])("rate:'%s' resolves to weight %i in the declared endpoint (and the runtime URL)", (rate, expectedWeight) => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx, rate });

    expect(connector.manifest.endpoints).toEqual([`${DEFAULT_COLLECT_BASE_URL}/.rum/${expectedWeight}`]);
  });

  it("the resolved weight rides in the BODY too, not just the endpoint URL", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx, rate: "high" });

    const [request] = connector.handle({ type: "top", ts: 1 });
    expect(JSON.parse(request.body).weight).toBe(10);
  });

  it("an unrecognized rate name falls back to the grounded default (medium/100), mirroring aem.js's own fallback", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx, rate: "bogus-rate-name" });

    expect(connector.manifest.endpoints).toEqual([`${DEFAULT_COLLECT_BASE_URL}/.rum/${DEFAULT_WEIGHT}`]);
  });

  it("an explicit numeric `weight` OVERRIDES a `rate` name — 022-01's raw escape hatch wins over the friendlier name", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx, rate: "high", weight: 5 });

    expect(connector.manifest.endpoints).toEqual([`${DEFAULT_COLLECT_BASE_URL}/.rum/5`]);
  });

  it("rate:'off' (weight 0) never selects, regardless of the random draw — same guarantee as an explicit weight:0", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW); // would select at weight>0
    const connector = createHelixRumConnector({ ctx, rate: "off" });

    expect(connector.handle({ type: "top", ts: 1 })).toEqual([]);
  });
});

describe("helix-rum connector — one identity across top + error (spec 022-02 AC3)", () => {
  it("id AND weight are IDENTICAL across a page's `top` and `error` checkpoints (one connector instance, fixed once)", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    const [topReq] = connector.handle({ type: "top", ts: 1 });
    const [errReq] = connector.handle({ type: "error", ts: 2, params: { source: "s", target: "t" } });
    const topBody = JSON.parse(topReq.body);
    const errBody = JSON.parse(errReq.body);

    expect(errBody.id).toBe(topBody.id);
    expect(errBody.weight).toBe(topBody.weight);
  });

  it("an UNSELECTED page-load emits NOTHING for EITHER checkpoint (top AND error), from the SAME connector instance", () => {
    vi.spyOn(Math, "random").mockReturnValue(UNSELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    expect(connector.handle({ type: "top", ts: 1 })).toEqual([]);
    expect(connector.handle({ type: "error", ts: 2, params: { source: "s", target: "t" } })).toEqual([]);
  });
});

describe("helix-rum connector sampling (spec 022-01 AC2 'sampling honored')", () => {
  it("an UNSELECTED page-load emits NOTHING — handle() returns []", () => {
    vi.spyOn(Math, "random").mockReturnValue(UNSELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx });

    expect(connector.handle({ type: "top", ts: 1 })).toEqual([]);
  });

  it("weight:0 (off) never selects, regardless of the random draw", () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW); // would select at weight>0
    const connector = createHelixRumConnector({ ctx, weight: 0 });

    expect(connector.handle({ type: "top", ts: 1 })).toEqual([]);
  });

  it("isSelected is decided ONCE at construction, not re-rolled per handle() call", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(SELECTED_DRAW).mockReturnValue(UNSELECTED_DRAW);
    const connector = createHelixRumConnector({ ctx }); // consumes the FIRST (selected) draw

    // Even though every SUBSEQUENT Math.random() call would be unselected,
    // this instance stays selected for its whole lifetime (one construction-time roll).
    expect(connector.handle({ type: "top", ts: 1 }).length).toBe(1);
    expect(connector.handle({ type: "top", ts: 2 }).length).toBe(1);
  });
});

describe("helix-rum connector hosted via createConnectorHost (same mechanism as GA4/alloy)", () => {
  it("routes a batch through routeBatch, producing the {ready, dropped} shape", async () => {
    vi.spyOn(Math, "random").mockReturnValue(SELECTED_DRAW);
    const host = createConnectorHost(createHelixRumConnector, { ctx });
    await host.init({});

    const { ready, dropped } = await host.routeBatch([{ type: "top", ts: 7 }]);

    expect(dropped).toEqual([]);
    expect(ready).toHaveLength(1);
    expect(ready[0].url).toBe(`${DEFAULT_COLLECT_BASE_URL}/.rum/${DEFAULT_WEIGHT}`);
  });

  it("an UNSELECTED page-load routes to an EMPTY ready[] (no dropped either — this is not an error)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(UNSELECTED_DRAW);
    const host = createConnectorHost(createHelixRumConnector, { ctx });
    await host.init({});

    const { ready, dropped } = await host.routeBatch([{ type: "top", ts: 7 }]);

    expect(ready).toEqual([]);
    expect(dropped).toEqual([]);
  });
});
