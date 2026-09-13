// Alloy wrapped-SDK connector — spec 012-01, AC2 (connector command shape).
//
// The alloy connector is a ConnectorFactory (config -> { manifest, init,
// handle }) hosted by createConnectorHost exactly like GA4 (AC1). Per R-004,
// `init` = alloy `configure` and `handle` = alloy `sendEvent`; the alloy
// command function is injected (in the real chamber it is the `self.alloy`
// global the bundle installs). These unit tests pin the R-004 command SHAPE
// with a fake alloy; the browser rig (rig/alloy-chamber.mjs) proves the real
// stock bundle boots + resolves in a classic worker.
//
// SCOPE: AC2/AC3 only. `handle` returns [] (no EgressRequest to the
// orchestrator) because in this slice alloy's own worker-side fetch is
// captured by an in-chamber stub. Routing that fetch to the orchestrator's
// main-thread dispatch + ECID mint/write-back is AC4 — the NEXT stage — and is
// deliberately NOT built here.
import { describe, it, expect, vi } from "vitest";
import { createAlloyConnector, ALLOY_COOKIE_NAMES } from "../connectors/alloy/connector.js";
import { createConnectorHost } from "../core/connector-host.js";

/** A fake alloy command fn (R-004 shape: `alloy(command, options) -> Promise`). */
function fakeAlloy() {
  const calls = [];
  const fn = vi.fn((command, options) => {
    calls.push({ command, options });
    return Promise.resolve();
  });
  fn.calls = calls;
  return fn;
}

const baseConfig = () => ({
  datastreamId: "00000000-0000-0000-0000-000000000000",
  orgId: "SPIKE@AdobeOrg",
  alloy: fakeAlloy(),
});

const pageView = (overrides = {}) => ({
  seq: 1,
  type: "page_view",
  ts: 10,
  params: { page_location: "https://airlock.example/", page_title: "airlock" },
  payload: {},
  snapshot: {},
  ...overrides,
});

describe("alloy connector (spec 012-01 AC2)", () => {
  it("manifest declares name/events/reads and requests the sync-cookie + egress capabilities", () => {
    const { manifest } = createAlloyConnector(baseConfig());

    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(Array.isArray(manifest.events)).toBe(true);
    expect(manifest.events.length).toBeGreaterThan(0);
    expect(Array.isArray(manifest.reads)).toBe(true);
    // alloy persists first-party identity + the getTld apex probe cookie
    // synchronously (R-004) -> it must request cookie access...
    expect(Array.isArray(manifest.capabilities.cookies)).toBe(true);
    expect(manifest.capabilities.cookies.length).toBeGreaterThan(0);
    // ...and egress (it emits one interact request).
    expect(manifest.capabilities.egress).toBe(true);
  });

  it("init() calls alloy `configure` with the host-owned datastreamId/orgId and context:[] (R-004 shape)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({
      datastreamId: "DS-123",
      orgId: "ORG@AdobeOrg",
      alloy,
    });

    await connector.init({});

    expect(alloy).toHaveBeenCalledTimes(1);
    const [command, options] = alloy.calls[0] && [alloy.calls[0].command, alloy.calls[0].options];
    expect(command).toBe("configure");
    expect(options.datastreamId).toBe("DS-123");
    expect(options.orgId).toBe("ORG@AdobeOrg");
    // context:[] disables ambient auto-collection — the chamber has no real
    // DOM to collect from (R-004; ADR-0008 headless).
    expect(options.context).toEqual([]);
  });

  it("handle() calls alloy `sendEvent` with renderDecisions:false + an XDM payload, and returns [] (no orchestrator egress this slice)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy });
    await connector.init({});
    alloy.mockClear();

    const out = await connector.handle(pageView());

    expect(alloy).toHaveBeenCalledTimes(1);
    const { command, options } = alloy.calls[alloy.calls.length - 1];
    expect(command).toBe("sendEvent");
    // headless personalization: propositions come back as data (R-004 / ADR-0008).
    expect(options.renderDecisions).toBe(false);
    expect(options.xdm).toBeTruthy();
    expect(options.xdm.eventType).toBe("web.webpagedetails.pageViews");
    expect(options.xdm.web.webPageDetails.URL).toBe("https://airlock.example/");
    // AC4 (routing alloy's own fetch to the orchestrator) is the NEXT stage:
    // the connector returns NO EgressRequest here.
    expect(out).toEqual([]);
  });

  it("boots via createConnectorHost: configure runs exactly once, sendEvent runs per event, on ONE persisted instance", async () => {
    const alloy = fakeAlloy();
    // createConnectorHost calls the factory; pass config carrying the fake alloy.
    const host = createConnectorHost(createAlloyConnector, {
      datastreamId: "DS-1",
      orgId: "ORG@AdobeOrg",
      alloy,
    });
    await host.init({});
    await host.init({}); // idempotent — configure must still be once

    const { ready, dropped } = await host.routeBatch([
      pageView({ seq: 1 }),
      pageView({ seq: 2 }),
    ]);

    const commands = alloy.calls.map((c) => c.command);
    expect(commands.filter((c) => c === "configure")).toHaveLength(1);
    expect(commands.filter((c) => c === "sendEvent")).toHaveLength(2);
    expect(dropped).toEqual([]);
    expect(ready).toEqual([]); // no orchestrator EgressRequests this slice
  });

  it("a missing alloy command function throws a diagnosable error (mis-wired chamber), contained by the host", async () => {
    // No `alloy` in config and no global — init must fail loudly, not silently.
    const connector = createAlloyConnector({ datastreamId: "DS", orgId: "ORG", alloy: null });
    await expect(connector.init({})).rejects.toThrow(/alloy/i);
  });

  // spec 045-02 (ADR-0023): the chamber's boot glue threads alloy's native
  // `defaultConsent` (from shapeAlloyBoot — "pending" under unresolved consent) into
  // the connector config; it must reach alloy `configure` (through configureExtras) so
  // alloy QUEUES its sendEvents natively under pending consent.
  it("threads a `defaultConsent` config option through to alloy `configure` (the native-queue boot posture)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy, defaultConsent: "pending" });
    await connector.init({});
    expect(alloy.calls[0].command).toBe("configure");
    expect(alloy.calls[0].options.defaultConsent).toBe("pending");
  });

  it("byte-parity: NO `defaultConsent` in config → alloy `configure` carries no defaultConsent key (back-compat, alloy's default window)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy }); // no defaultConsent
    await connector.init({});
    expect(alloy.calls[0].command).toBe("configure");
    expect("defaultConsent" in alloy.calls[0].options).toBe(false);
  });
});

// Spec 012-03 AC1/AC2: `sendEvent({ renderDecisions:false })` returns Target
// decisions as DATA; the connector delivers the __view__ propositions to the host
// through the granted `decisions` capability. The chamber touches no DOM.
describe("alloy connector — decisions-as-data delivery (spec 012-03 AC1/AC2)", () => {
  /** A fake alloy whose sendEvent resolves to a result carrying __view__ propositions. */
  function fakeAlloyWithDecisions(propositions) {
    return vi.fn((command) =>
      Promise.resolve(command === "sendEvent" ? { propositions } : undefined),
    );
  }
  const viewProp = { id: "AT:p1", scope: "__view__", scopeDetails: {}, items: [{ schema: "https://ns.adobe.com/personalization/html-content-item", data: { content: "<b/>" } }] };

  it("delivers the __view__ decisions through caps.decisions.deliver (crossed as data)", async () => {
    const alloy = fakeAlloyWithDecisions([viewProp]);
    const deliver = vi.fn();
    const connector = createAlloyConnector({ ...baseConfig(), alloy });
    await connector.init({ decisions: { deliver } });

    const out = await connector.handle(pageView());

    expect(deliver).toHaveBeenCalledTimes(1);
    const delivered = deliver.mock.calls[0][0];
    expect(delivered).toHaveLength(1);
    expect(delivered[0].scope).toBe("__view__");
    expect(delivered[0].content.id).toBe("AT:p1");
    expect(out).toEqual([]); // still no orchestrator EgressRequest
  });

  it("does NOT deliver when the response carries no propositions (no spurious call)", async () => {
    const alloy = fakeAlloyWithDecisions([]);
    const deliver = vi.fn();
    const connector = createAlloyConnector({ ...baseConfig(), alloy });
    await connector.init({ decisions: { deliver } });
    await connector.handle(pageView());
    expect(deliver).not.toHaveBeenCalled();
  });

  it("is a no-op (never throws) when NO decisions capability is granted — 012-01/012-02 unaffected", async () => {
    const alloy = fakeAlloyWithDecisions([viewProp]);
    const connector = createAlloyConnector({ ...baseConfig(), alloy });
    await connector.init({}); // no decisions capability granted
    await expect(connector.handle(pageView())).resolves.toEqual([]);
  });

  it("manifest requests the `decisions` capability (declares it produces decisions data)", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    expect(manifest.capabilities.decisions).toBe(true);
  });
});

// Spec 034-02 (multi-scope personalization): the connector learns the decision
// scopes from its config and CARRIES them on the interact so alloy fetches EVERY
// declared scope (grounded: sendEvent accepts a top-level `decisionScopes[]`;
// `renderDecisions:false` does NOT gate the fetch). It then delivers ALL returned
// scopes (`extractDecisions(result,{scope:null})`), so the host can map each to its
// placement by scope. Absent scopes → the __view__ default, byte-unchanged (033-03).
describe("alloy connector — multi-scope decisionScopes on the interact (spec 034-02 AC1)", () => {
  function fakeAlloyWithDecisions(propositions) {
    return vi.fn((command) =>
      Promise.resolve(command === "sendEvent" ? { propositions } : undefined),
    );
  }
  const prop = (scope, id) => ({ id, scope, scopeDetails: {}, items: [{ schema: "https://ns.adobe.com/personalization/html-content-item", data: { content: `<b>${scope}</b>` } }] });

  it("carries the configured decisionScopes on the sendEvent interact (deduped)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy, decisionScopes: ["__view__", "products", "products"] });
    await connector.init({});
    alloy.mockClear();

    await connector.handle(pageView());

    const { command, options } = alloy.calls[alloy.calls.length - 1];
    expect(command).toBe("sendEvent");
    expect(options.renderDecisions).toBe(false);
    expect(options.decisionScopes).toEqual(["__view__", "products"]); // both scopes fetched, deduped
  });

  it("delivers ALL returned scopes (not just __view__) — the host maps each by scope", async () => {
    const alloy = fakeAlloyWithDecisions([prop("__view__", "AT:v"), prop("products", "AT:p")]);
    const deliver = vi.fn();
    const connector = createAlloyConnector({ ...baseConfig(), alloy, decisionScopes: ["__view__", "products"] });
    await connector.init({ decisions: { deliver } });

    await connector.handle(pageView());

    const delivered = deliver.mock.calls[0][0];
    expect(delivered).toHaveLength(2);
    expect(delivered.map((d) => d.scope).sort()).toEqual(["__view__", "products"]);
  });

  it("ABSENT decisionScopes → sendEvent options byte-unchanged (no decisionScopes / no personalization key — the __view__ default)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy }); // no decisionScopes configured
    await connector.init({});
    alloy.mockClear();

    await connector.handle(pageView());

    const { options } = alloy.calls[alloy.calls.length - 1];
    expect(options.decisionScopes).toBeUndefined();
    expect(options.personalization).toBeUndefined();
    expect(Object.keys(options).sort()).toEqual(["renderDecisions", "xdm"]); // exactly the 033-02 shape
  });

  it("NO __view__ scope configured → sets personalization.defaultPersonalizationEnabled:false (the live-Alloy caveat — no auto-added __view__)", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy, decisionScopes: ["products", "cart"] });
    await connector.init({});
    alloy.mockClear();

    await connector.handle(pageView());

    const { options } = alloy.calls[alloy.calls.length - 1];
    expect(options.decisionScopes).toEqual(["products", "cart"]);
    expect(options.personalization).toEqual({ defaultPersonalizationEnabled: false });
  });

  it("a __view__ scope AMONG the configured scopes → NO defaultPersonalizationEnabled suppression", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy, decisionScopes: ["__view__", "products"] });
    await connector.init({});
    alloy.mockClear();

    await connector.handle(pageView());

    const { options } = alloy.calls[alloy.calls.length - 1];
    expect(options.personalization).toBeUndefined(); // __view__ requested → real alloy won't auto-add it
  });

  it("merges config.personalization.decisionScopes with the top-level (deduped) — faithful to alloy's own merge", async () => {
    const alloy = fakeAlloy();
    const connector = createAlloyConnector({ ...baseConfig(), alloy, decisionScopes: ["__view__"], personalization: { decisionScopes: ["products", "__view__"] } });
    await connector.init({});
    alloy.mockClear();

    await connector.handle(pageView());

    const { options } = alloy.calls[alloy.calls.length - 1];
    expect(options.decisionScopes).toEqual(["__view__", "products"]);
  });
});

// spec 035-01 AC3 — the granted cookie-name set has ONE source of truth. The
// declared list used to live inline in the manifest only (worker-only
// reachability — see the slice's design focus); ALLOY_COOKIE_NAMES is now a
// static, module-level export (mirroring ALLOY_INTERACT_ENDPOINT) that BOTH
// the manifest AND main-thread bootAlloy (adapters/eds/index.js) import, so
// the read-filter seed and the write-back scope can never drift from the
// manifest's own declaration.
describe("alloy connector (spec 035-01 AC3): ALLOY_COOKIE_NAMES is the manifest's single source of truth", () => {
  it("manifest.capabilities.cookies deep-equals the exported ALLOY_COOKIE_NAMES — not a hard-coded copy", () => {
    const { manifest } = createAlloyConnector(baseConfig());
    expect(manifest.capabilities.cookies).toEqual(ALLOY_COOKIE_NAMES);
    // the SAME array reference — the manifest is built FROM the export, not a
    // parallel literal that could silently diverge from it.
    expect(manifest.capabilities.cookies).toBe(ALLOY_COOKIE_NAMES);
  });

  it("names alloy's real declared set (exact + prefix mix, grounded 2026-09-05)", () => {
    expect(ALLOY_COOKIE_NAMES).toEqual(["com.adobe.alloy.getTld", "kndctr_", "AMCV_", "demdex", "s_ecid"]);
  });
});
