import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";

// Dynamic loading makes each AC fail visibly before either production file exists.
const { runStockJourney } = await import("../probes/adobe-compatibility/stock-harness.mjs")
  .catch(() => ({}));
const HTML = '<p>Local stock fixture</p><button type="button">Fixture click</button>';
const SCHEMA = "https://ns.adobe.com/personalization/html-content-item";
const METHODS = [
  "initMartech", "updateUserConsent", "sendEvent", "sendAnalyticsEvent",
  "pushEventToDataLayer", "martechLazy", "martechDelayed",
];
const CLAIMS = {
  local_fixture_only: true, sdk_execution_verified: false, product_receipt_verified: false,
  deployment_verified: false, activity_activation_performed: false,
};
const COUNT_KEYS = [
  "initializations", "consent_updates", "attempted_collection", "blocked_collection",
  "fetch_submissions", "page_submissions", "custom_submissions", "display_submissions",
  "interaction_submissions", "qualified_propositions", "render_attempts", "render_confirmed",
  "render_blocked", "click_attempts", "click_confirmed", "click_blocked",
];
const forbidden = ["SENTINEL", HTML, "synthetic-proposition", "synthetic-item", "fixture.scope",
  "https://fixture.invalid/", "airlock05105-", "invented-org", "invented-stream"];

function fixture(caseName = "positive") {
  const calls = [];
  const sdk = [];
  const proposition = {
    id: "synthetic-proposition", scope: "fixture.scope",
    scopeDetails: { decisionProvider: "TGT", activity: { id: "invented-activity" } },
    items: [{ id: "synthetic-item", schema: SCHEMA, data: { content: HTML } }],
  };
  const response = { propositions: caseName === "no-offer" ? [] : [proposition] };
  const integration = {};
  const record = (name, impl) => vi.fn((...args) => {
    calls.push({ name, args });
    return impl(...args);
  });
  let plugin;
  integration.initMartech = record("initMartech", async (web, p) => {
    sdk.push({ command: "configure", args: [web] }); plugin = p;
  });
  integration.updateUserConsent = record("updateUserConsent", async consent => {
    sdk.push({ command: "setConsent", args: [{ consent: [{
      standard: "Adobe", version: "2.0",
      value: {
        collect: { val: consent.collect ? "y" : "n" },
        personalize: { content: { val: consent.personalize ? "y" : "n" } },
        marketing: { any: { val: consent.marketing ? "y" : "n" }, preferred: "email" },
        share: { val: consent.share ? "y" : "n" },
      },
    }] }] });
  });
  integration.sendEvent = record("sendEvent", async payload => {
    sdk.push({ command: "sendEvent", args: [payload] });
    return payload.type === "decisioning.propositionFetch" ? response : {};
  });
  integration.sendAnalyticsEvent = record("sendAnalyticsEvent", async (xdm, data = {}, overrides = {}) => {
    sdk.push({ command: "sendEvent", args: [{
      documentUnloading: true, xdm, data, edgeConfigOverrides: overrides,
    }] });
    return {};
  });
  let lazy = false;
  integration.martechLazy = record("martechLazy", async () => { lazy = true; });
  integration.pushEventToDataLayer = record("pushEventToDataLayer", (event, xdm, data, overrides) => {
    expect(lazy).toBe(true);
    if (plugin.shouldProcessEvent({ event, xdm, data, configOverrides: overrides })) {
      // Pinned listener does NOT return the Analytics/SDK promise.
      void integration.sendAnalyticsEvent({ eventType: event, ...xdm }, data, overrides);
    }
  });
  integration.martechDelayed = record("martechDelayed", async () => {
    expect(plugin.launchUrls).toEqual([]);
  });
  const renderer = {
    render: record("render", async p => {
      expect(p.items[0].data.content).toBe(HTML);
      return { visible: true, content: HTML };
    }),
    click: record("click", async binding => ({
      clicked: true, target: binding.rendered ? "offer-button" : "control-button",
    })),
  };
  const input = {
    integration, case: caseName, runId: "airlock05105-" + "a".repeat(32), eventIndex: 1,
    pageUrl: "https://fixture.invalid/", decisionScope: "fixture.scope",
    config: { orgId: "invented-org", datastreamId: "invented-stream" },
    renderer, timeoutMs: 100,
  };
  return { input, calls, sdk, response, proposition, integration, renderer };
}

function assertPublic(result) {
  expect(Object.keys(result)).toEqual([
    "kind", "schema_version", "case", "overall", "exit_code", "phases", "counts", "claims",
  ]);
  expect(result.kind).toBe("airlock.adobe-stock.local-report");
  expect(result.schema_version).toBe(1);
  expect(result.claims).toEqual(CLAIMS);
  expect(Object.keys(result.phases)).toEqual(["init", "consent", "eager", "lazy", "delayed"]);
  expect(Object.keys(result.counts)).toEqual(COUNT_KEYS);
  for (const value of Object.values(result.counts)) {
    expect(Number.isInteger(value) && value >= 0).toBe(true);
  }
  const walk = value => {
    if (value && typeof value === "object") {
      expect(Array.isArray(value)).toBe(false);
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(walk);
    } else expect(["string", "number", "boolean"]).toContain(typeof value);
  };
  walk(result);
  const text = JSON.stringify(result);
  forbidden.forEach(secret => expect(text).not.toContain(secret));
}

// Real subprocesses with runtime read/network/SDK/credential tripwires. Node's module loader
// may read these two public source files; operator code may not use filesystem APIs.
function operator(argv) {
  const boot = `
    import fs from 'node:fs';
    import fsp from 'node:fs/promises';
    import http from 'node:http';
    import https from 'node:https';
    import net from 'node:net';
    import dns from 'node:dns';
    const publicModules = [
      new URL('./probes/adobe-compatibility/stock-dry-run.mjs', import.meta.url).href,
      new URL('./probes/adobe-compatibility/stock-harness.mjs', import.meta.url).href,
    ];
    const loaderRead = fsp.readFile;
    let violations = 0;
    const refuse = () => { violations++; throw new Error('SENTINEL-forbidden-capability'); };
    globalThis.fetch = refuse;
    globalThis.XMLHttpRequest = refuse;
    globalThis.window = new Proxy({}, { get: refuse });
    for (const key of ['readFile','readFileSync','open','openSync','writeFile','writeFileSync','readdir','readdirSync']) fs[key] = refuse;
    for (const key of ['readFile','open','writeFile','readdir']) fsp[key] = refuse;
    fsp.readFile = (...args) => {
      // Node 22's ESM loader uses this public API. Permit only its two fixed
      // source reads, never an operator read (even of those same sources).
      if (publicModules.includes(String(args[0]))
          && new Error().stack.includes('at getSource (node:internal/modules/esm/load:'))
        return loaderRead(...args);
      return refuse();
    };
    for (const mod of [http, https]) { mod.request = refuse; mod.get = refuse; }
    net.connect = refuse; net.createConnection = refuse; dns.lookup = refuse;
    const env = process.env;
    process.env = new Proxy(env, { get: (_o, key) => {
      if (/ADOBE|AIRLOCK|CREDENTIAL|TOKEN|SECRET/.test(String(key))) return refuse();
      return env[key];
    } });
    process.argv = [process.execPath, 'stock-dry-run.mjs', ...${JSON.stringify(argv)}];
    process.on('exit', () => { if (violations) process.exitCode = 99; });
    await import('./probes/adobe-compatibility/stock-dry-run.mjs');
  `;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", boot], {
    encoding: "utf8", env: {}, timeout: 5000,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("051-05 AC1 usable synthetic operator", () => {
  it.each([
    ["positive", 4, 1, 1, 1],
    ["no-consent", 4, 0, 0, 0],
    ["no-offer", 3, 0, 0, 0],
    ["non-render", 3, 0, 0, 1],
  ])("executes actual --case %s with meaningful immutable disclaimers", (name, attempts, display, interact, qualified) => {
    const proc = operator(["--case", name]);
    expect(proc.status).toBe(0);
    expect(proc.stderr).toBe("");
    expect(proc.stdout.trim().split("\n")).toHaveLength(1);
    const result = JSON.parse(proc.stdout);
    expect(result.case).toBe(name);
    expect(result.overall).toBe("passed");
    expect(result.claims).toEqual(CLAIMS);
    expect(result.counts).toMatchObject({
      attempted_collection: attempts, display_submissions: display,
      interaction_submissions: interact, qualified_propositions: qualified,
      page_submissions: name === "no-consent" ? 0 : 1,
      custom_submissions: name === "no-consent" ? 0 : 1,
      blocked_collection: name === "no-consent" ? 4 : 0,
    });
    expect(Object.values(result.phases)).toEqual(["complete", "complete",
      name === "no-consent" ? "blocked" : "complete", "complete", "complete"]);
    forbidden.forEach(secret => expect(proc.stdout + proc.stderr).not.toContain(secret));
  });
  it("help is static and performs no capability access", () => {
    const proc = operator(["--help"]);
    expect(proc.status).toBe(0);
    expect(proc.stderr).toBe("");
    expect(proc.stdout).toContain("--case");
    expect(proc.stdout).toContain("local");
  });
  it.each([
    [], ["--case"], ["--case", "SENTINEL"], ["--case=positive"], ["positive"],
    ["--case", "positive", "--case", "positive"], ["--help", "--case", "positive"],
    ["--transport", "SENTINEL"], ["--input", "/SENTINEL"], ["--url", "https://SENTINEL/"],
    ["--module", "SENTINEL"], ["--credential-file", "/SENTINEL"], ["--case", "__proto__"],
  ].map(args => [args]))("refuses closed CLI invocation %j without capabilities or echoes", args => {
    const proc = operator(args);
    expect(proc.status).toBe(2);
    expect(proc.stderr).toBe("invalid_invocation\n");
    const result = JSON.parse(proc.stdout);
    expect(result).toMatchObject({ case: "invalid", overall: "invalid_invocation", exit_code: 2, claims: CLAIMS });
    expect(Object.values(result.counts).every(n => n === 0)).toBe(true);
    expect(proc.stdout + proc.stderr).not.toContain("SENTINEL");
  });
});

describe("051-05 AC2 pinned stock contract fidelity", () => {
  it("initializes once, grants once, awaits host render then page DISPLAY, lazy click/custom/interact, delayed", async () => {
    const f = fixture();
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result.overall).toBe("passed");
    expect(f.calls.map(c => c.name)).toEqual([
      "initMartech", "updateUserConsent", "sendEvent", "render", "sendAnalyticsEvent",
      "martechLazy", "click", "pushEventToDataLayer", "sendAnalyticsEvent", "sendEvent", "martechDelayed",
    ]);
    expect(f.integration.initMartech).toHaveBeenCalledExactlyOnceWith({
      ...f.input.config, edgeDomain: "edge.adobedc.net", defaultConsent: "pending", debugEnabled: false,
      thirdPartyCookiesEnabled: false, idMigrationEnabled: false, targetMigrationEnabled: false,
      clickCollectionEnabled: false, autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
    }, expect.objectContaining({
      analytics: true, personalization: true, performanceOptimized: true, personalizationTimeout: 100,
      trackPageView: false, dataLayer: true, includeDataLayerState: false, launchUrls: [],
      alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer", decisionScopes: ["fixture.scope"],
      shouldProcessEvent: expect.any(Function),
    }));
    const plugin = f.integration.initMartech.mock.calls[0][1];
    expect(plugin.shouldProcessEvent({ event: "web.webinteraction.linkClicks" })).toBe(true);
    expect(plugin.shouldProcessEvent({ event: "other" })).toBe(false);
    expect(f.integration.updateUserConsent).toHaveBeenCalledExactlyOnceWith({
      collect: true, personalize: true, marketing: false, share: false,
    });
    expect(f.integration.sendEvent.mock.calls[0]).toEqual([{
      type: "decisioning.propositionFetch", renderDecisions: false, decisionScopes: ["fixture.scope"],
      personalization: { defaultPersonalizationEnabled: false, sendDisplayEvent: false },
      xdm: { web: { webPageDetails: { name: "airlock-stock-local-v1", URL: f.input.pageUrl } } },
    }]);
    const identity = { id: f.proposition.id, scope: f.proposition.scope, scopeDetails: f.proposition.scopeDetails };
    const label = `${f.input.runId}-positive-1`;
    expect(f.integration.sendAnalyticsEvent.mock.calls[0]).toEqual([{
      eventType: "web.webpagedetails.pageViews",
      web: { webPageDetails: { name: `${label}-page`, URL: f.input.pageUrl, pageViews: { value: 1 } } },
      _experience: { decisioning: { propositions: [identity], propositionEventType: { display: 1 } } },
    }, { __adobe: { analytics: { pageName: `${label}-page`, pageURL: f.input.pageUrl } } }, {}]);
    expect(f.renderer.render).toHaveBeenCalledExactlyOnceWith(f.proposition);
    expect(f.renderer.click).toHaveBeenCalledExactlyOnceWith({ rendered: true, proposition: identity });
    expect(f.integration.pushEventToDataLayer.mock.calls[0]).toEqual([
      "web.webinteraction.linkClicks",
      { web: { webInteraction: { name: `${label}-custom`, type: "other", linkClicks: { value: 1 } } } },
      { __adobe: { analytics: { linkType: "o", linkName: `${label}-custom` } } }, {},
    ]);
    expect(f.integration.sendEvent.mock.calls[1]).toEqual([{
      type: "decisioning.propositionInteract", renderDecisions: false,
      personalization: { defaultPersonalizationEnabled: false, sendDisplayEvent: false },
      xdm: { _experience: { decisioning: { propositions: [identity], propositionEventType: { interact: 1 } } } },
    }]);
    expect(f.sdk.filter(c => c.command === "configure")).toHaveLength(1);
    expect(f.sdk.filter(c => c.command === "sendEvent")).toHaveLength(4);
    expect(f.sdk[3].args[0]).toMatchObject({ documentUnloading: true, edgeConfigOverrides: {} });
    expect(result.counts).toEqual({
      initializations: 1, consent_updates: 1, attempted_collection: 4, blocked_collection: 0,
      fetch_submissions: 1, page_submissions: 1, custom_submissions: 1, display_submissions: 1,
      interaction_submissions: 1, qualified_propositions: 1, render_attempts: 1, render_confirmed: 1,
      render_blocked: 0, click_attempts: 1, click_confirmed: 1, click_blocked: 0,
    });
    expect(() => { result.claims.sdk_execution_verified = true; }).toThrow();
  });
});

describe("051-05 AC3 real non-vacuous controls", () => {
  it("denial sets consent and actually blocks all attempted collections, render and click", async () => {
    const f = fixture("no-consent");
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(f.calls.map(c => c.name)).toEqual(["initMartech", "updateUserConsent", "martechLazy", "martechDelayed"]);
    expect(f.integration.updateUserConsent).toHaveBeenCalledExactlyOnceWith({
      collect: false, personalize: false, marketing: false, share: false,
    });
    expect(f.sdk.map(c => c.command)).toEqual(["configure", "setConsent"]);
    expect(f.sdk[1].args[0].consent[0].value.collect.val).toBe("n");
    expect(result.counts).toMatchObject({
      attempted_collection: 4, blocked_collection: 4, render_blocked: 1, click_blocked: 1,
      fetch_submissions: 0, page_submissions: 0, custom_submissions: 0,
      display_submissions: 0, interaction_submissions: 0,
    });
  });
  it.each(["no-offer", "non-render"])("%s fetches and clicks the ordinary control without native notifications", async name => {
    const f = fixture(name);
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result.overall).toBe("passed");
    expect(result.counts).toMatchObject({
      fetch_submissions: 1, qualified_propositions: name === "no-offer" ? 0 : 1,
      render_attempts: 0, click_confirmed: 1, page_submissions: 1, custom_submissions: 1,
      display_submissions: 0, interaction_submissions: 0,
    });
    expect(f.renderer.render).not.toHaveBeenCalled();
    expect(f.renderer.click).toHaveBeenCalledExactlyOnceWith({
      rendered: false, proposition: name === "no-offer" ? null : {
        id: f.proposition.id, scope: f.proposition.scope, scopeDetails: f.proposition.scopeDetails,
      },
    });
    expect(f.sdk.filter(c => c.command === "sendEvent")).toHaveLength(3);
    expect(f.integration.sendAnalyticsEvent.mock.calls).toHaveLength(2);
    for (const call of f.integration.sendAnalyticsEvent.mock.calls) {
      expect(call[0]).not.toHaveProperty("_experience");
      expect(JSON.stringify(call)).not.toContain("proposition");
    }
  });
  it.each([
    [false], [{ visible: false, content: HTML }], [{ visible: true, content: "SENTINEL" }],
    [{ renderAttempted: true }], [{ visible: true, content: HTML, sdkProof: true }],
  ])("unconfirmed render %j never reaches page/display/lazy", async ack => {
    const f = fixture();
    f.renderer.render.mockImplementation(async (...args) => {
      f.calls.push({ name: "render", args }); return ack;
    });
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result).toMatchObject({ overall: "render_unconfirmed", exit_code: 1 });
    expect(f.calls.map(c => c.name)).toEqual(["initMartech", "updateUserConsent", "sendEvent", "render"]);
    expect(result.counts.display_submissions).toBe(0);
  });
  it.each([
    [false], [{ clicked: false, target: "offer-button" }], [{ clicked: true, target: "control-button" }],
    [{ clicked: true, target: "offer-button", extra: "SENTINEL" }],
  ])("unconfirmed/badly bound click %j never reaches custom/interact/delayed", async ack => {
    const f = fixture();
    f.renderer.click.mockImplementation(async (...args) => {
      f.calls.push({ name: "click", args }); return ack;
    });
    const result = await runStockJourney(f.input);
    expect(result).toMatchObject({ overall: "click_unconfirmed", exit_code: 1 });
    expect(f.calls.at(-1).name).toBe("click");
    expect(f.integration.pushEventToDataLayer).not.toHaveBeenCalled();
    expect(result.counts.interaction_submissions).toBe(0);
  });
});

describe("051-05 AC4 closed refusals and bounded failure behavior", () => {
  it.each([
    ["unknown key", f => { f.input.extra = "SENTINEL"; }],
    ["unknown case", f => { f.input.case = "SENTINEL"; }],
    ["run marker", f => { f.input.runId = "SENTINEL"; }],
    ["run marker too long", f => { f.input.runId += "a"; }],
    ...[0, 1001, 1.5, NaN, "1"].map(v => [`index ${v}`, f => { f.input.eventIndex = v; }]),
    ...[0, -1, 10001, Infinity, 1.5, "100", undefined].map(v => [`timeout ${v}`, f => { f.input.timeoutMs = v; }]),
    ...["http://fixture.invalid/", "https://fixture.invalid", "https://u:p@fixture.invalid/",
      "https://fixture.invalid:443/", "https://fixture.invalid/a", "https://fixture.invalid/?q=x",
      "https://fixture.invalid/#x", "https://FIXTURE.invalid/", "https://fixture.invalid/../",
      "https://127.0.0.1/"].map(v => [`URL ${v}`, f => { f.input.pageUrl = v; }]),
    ...["target-global-mbox", "__proto__", "constructor", "toString", "../scope", "x@y", "x y",
      "a".repeat(101)].map(v => [`scope ${v}`, f => { f.input.decisionScope = v; }]),
    ["override config", f => { f.input.config.clickCollectionEnabled = true; }],
    ["empty org", f => { f.input.config.orgId = ""; }],
    ["bad stream type", f => { f.input.config.datastreamId = {}; }],
    ["secret controls", f => { f.input.config.orgId = "SENTINEL\n"; }],
    ["bad renderer", f => { f.input.renderer = { render: () => {}, click: null }; }],
    ["renderer extra", f => { f.input.renderer.selector = "SENTINEL"; }],
    ["clock bad function", f => { f.input.clock = { setTimeout: null, clearTimeout: () => {} }; }],
    ["clock extra", f => { f.input.clock = { setTimeout, clearTimeout, extra: 1 }; }],
    ["integration extra", f => { f.input.integration.martechEager = () => {}; }],
    ...METHODS.map(name => [`missing ${name}`, f => { delete f.input.integration[name]; }]),
    ["inherited function", f => { f.input.integration = Object.create(f.integration); }],
    ["accessor", f => { Object.defineProperty(f.input, "runId", { get: () => { throw "SENTINEL"; } }); }],
    ["symbol", f => { f.input[Symbol("SENTINEL")] = 1; }],
  ])("refuses %s before any call", async (_name, change) => {
    const f = fixture(); change(f);
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result).toMatchObject({ overall: "invalid_input", exit_code: 2 });
    expect(f.calls).toEqual([]);
  });
  it.each([null, undefined, [], 1, "SENTINEL"])("refuses nonobject input %j", async input => {
    const result = await runStockJourney(input);
    assertPublic(result);
    expect(result.exit_code).toBe(2);
  });
  it.each([
    ["missing", f => { delete f.response.propositions; }],
    ["null", f => { f.response.propositions = null; }],
    ["empty positive", f => { f.response.propositions = []; }],
    ["wrong scope", f => { f.proposition.scope = "foreign"; }],
    ["wrong provider", f => { f.proposition.scopeDetails.decisionProvider = "AJO"; }],
    ["missing provider", f => { delete f.proposition.scopeDetails; }],
    ["missing id", f => { delete f.proposition.id; }],
    ["empty id", f => { f.proposition.id = ""; }],
    ["wrong schema", f => { f.proposition.items[0].schema = "https://ns.adobe.com/personalization/dom-action"; }],
    ["JSON", f => { f.proposition.items[0].data.content = {}; }],
    ["unsafe HTML", f => { f.proposition.items[0].data.content = "<script>SENTINEL</script>"; }],
    ["wrong item id", f => { f.proposition.items[0].id = "foreign"; }],
    ["empty items", f => { f.proposition.items = []; }],
    ["duplicate item", f => { f.proposition.items.push(structuredClone(f.proposition.items[0])); }],
    ["duplicate proposition", f => { f.response.propositions.push(f.proposition); }],
    ["foreign extra", f => { f.response.propositions.push({ scope: "foreign" }); }],
    ["no-offer unexpected proposition", f => { f.input.case = "no-offer"; }],
    ["SDK render flag not proof", f => { f.proposition.renderAttempted = true; f.proposition.items = []; }],
  ])("fails %s without renderer or any later submission", async (_name, change) => {
    const f = fixture(); change(f);
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result).toMatchObject({ overall: "invalid_proposition", exit_code: 1 });
    expect(f.calls.map(c => c.name)).toEqual(["initMartech", "updateUserConsent", "sendEvent"]);
  });
  const stages = [
    ["initMartech", "integration_rejected"], ["updateUserConsent", "integration_rejected"],
    ["fetch", "integration_rejected"], ["render", "renderer_rejected"],
    ["sendAnalyticsEvent", "integration_rejected"], ["martechLazy", "integration_rejected"],
    ["click", "click_rejected"], ["pushEventToDataLayer", "integration_rejected"],
    ["interact", "integration_rejected"], ["martechDelayed", "integration_rejected"],
  ];
  const order = ["initMartech", "updateUserConsent", "fetch", "render", "sendAnalyticsEvent",
    "martechLazy", "click", "pushEventToDataLayer", "interact", "martechDelayed"];
  function override(f, stage, impl) {
    if (stage === "fetch" || stage === "interact") {
      const original = f.integration.sendEvent.getMockImplementation();
      f.integration.sendEvent.mockImplementation((payload) => {
        const target = stage === "fetch" ? "decisioning.propositionFetch" : "decisioning.propositionInteract";
        if (payload.type !== target) return original(payload);
        f.calls.push({ name: "sendEvent", args: [payload] }); return impl();
      });
    } else {
      const mock = f.renderer[stage] ?? f.integration[stage];
      mock.mockImplementation((...args) => { f.calls.push({ name: stage, args }); return impl(); });
    }
  }
  it.each(stages)("rejection at %s stops all subsequent calls with safe enum", async (stage, category) => {
    const f = fixture();
    override(f, stage, () => { throw { secret: "SENTINEL", message: HTML }; });
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result).toMatchObject({ overall: category, exit_code: 1 });
    const index = order.indexOf(stage);
    const expected = order.slice(0, index + 1).map(s => ["fetch", "interact"].includes(s) ? "sendEvent" : s);
    // Successful void ACDL invokes an additional Analytics call in the listener.
    if (index > order.indexOf("pushEventToDataLayer")) expected.splice(8, 0, "sendAnalyticsEvent");
    expect(f.calls.map(c => c.name)).toEqual(expected);
    expect(f.integration.initMartech).toHaveBeenCalledTimes(1);
  });
  it.each(stages.filter(([s]) => s !== "pushEventToDataLayer"))(
    "timeout at %s stops subsequent harness calls even after late resolution", async stage => {
      vi.useFakeTimers();
      const f = fixture();
      f.input.clock = { setTimeout, clearTimeout };
      let release;
      override(f, stage, () => new Promise(resolve => { release = resolve; }));
      const pending = runStockJourney(f.input);
      await vi.advanceTimersByTimeAsync(101);
      const result = await pending;
      assertPublic(result);
      expect(result).toMatchObject({ overall: "timeout", exit_code: 1 });
      const snapshot = f.calls.slice();
      release(stage === "fetch" ? f.response : stage === "render" ? { visible: true, content: HTML }
        : stage === "click" ? { clicked: true, target: "offer-button" } : undefined);
      await vi.advanceTimersByTimeAsync(1000);
      expect(f.calls).toEqual(snapshot);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("render and click must resolve before their subsequent submissions start", async () => {
    const f = fixture();
    let renderDone, clickDone;
    f.renderer.render.mockImplementation(() => new Promise(resolve => { renderDone = resolve; }));
    f.renderer.click.mockImplementation(() => new Promise(resolve => { clickDone = resolve; }));
    const pending = runStockJourney(f.input);
    await vi.waitFor(() => expect(renderDone).toBeTypeOf("function"));
    expect(f.integration.sendAnalyticsEvent).not.toHaveBeenCalled();
    renderDone({ visible: true, content: HTML });
    await vi.waitFor(() => expect(clickDone).toBeTypeOf("function"));
    expect(f.integration.pushEventToDataLayer).not.toHaveBeenCalled();
    clickDone({ clicked: true, target: "offer-button" });
    expect((await pending).overall).toBe("passed");
  });
  it("counts void ACDL submission without awaiting asynchronous listener completion", async () => {
    const f = fixture();
    f.integration.pushEventToDataLayer.mockImplementation((...args) => {
      f.calls.push({ name: "pushEventToDataLayer", args });
      // No promise returned, even if internal vendor work remains unsettled forever.
      void new Promise(() => {});
    });
    const result = await runStockJourney(f.input);
    expect(result.overall).toBe("passed");
    expect(result.counts.custom_submissions).toBe(1);
    expect(result.claims.product_receipt_verified).toBe(false);
    expect(f.integration.martechDelayed).toHaveBeenCalledTimes(1);
  });
  it("rejects a nonvoid ACDL integration instead of inventing asynchronous acknowledgement", async () => {
    const f = fixture();
    f.integration.pushEventToDataLayer.mockReturnValue("SENTINEL");
    const result = await runStockJourney(f.input);
    expect(result).toMatchObject({ overall: "invalid_contract", exit_code: 1 });
    expect(f.integration.martechDelayed).not.toHaveBeenCalled();
    expect(result.counts.interaction_submissions).toBe(0);
  });
});

describe("051-05 AC5 secrecy and evidence boundaries", () => {
  it("ignores additive SDK secrets and preserves identity without printing any private input", async () => {
    const f = fixture();
    f.input.config = { orgId: "SENTINEL-config", datastreamId: "SENTINEL-datastream" };
    f.proposition.id = "SENTINEL-proposition";
    f.proposition.scopeDetails.activity.id = "SENTINEL-activity";
    Object.defineProperty(f.proposition, "rawSecret", { get: () => { throw "SENTINEL-getter"; } });
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result.overall).toBe("passed");
    expect(f.integration.sendAnalyticsEvent.mock.calls[0][0]._experience.decisioning.propositions[0])
      .toEqual({ id: f.proposition.id, scope: f.proposition.scope, scopeDetails: f.proposition.scopeDetails });
  });
  it("never reads thrown objects, including hostile getters/toString", async () => {
    const f = fixture();
    const hostile = new Proxy({}, { get: () => { throw new Error("SENTINEL"); } });
    f.integration.sendEvent.mockRejectedValue(hostile);
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result.overall).toBe("integration_rejected");
    expect(result.counts.fetch_submissions).toBe(1);
    expect(result.counts.page_submissions).toBe(0);
  });
  it("clock errors are safe internal failures with no fallback timer/extra invocation", async () => {
    const f = fixture();
    f.input.clock = {
      setTimeout: () => { throw { secret: "SENTINEL" }; }, clearTimeout: () => {},
    };
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result).toMatchObject({ overall: "internal_failure", exit_code: 3 });
    expect(f.calls).toEqual([]);
  });
  it("guarded execution has no browser/network capabilities even in positive case", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw "SENTINEL-network"; });
    const f = fixture();
    const result = await runStockJourney(f.input);
    assertPublic(result);
    expect(result.overall).toBe("passed");
    expect(spy).not.toHaveBeenCalled();
  });
});
