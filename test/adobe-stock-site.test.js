import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import fixture from "./fixtures/adobe-stock-site.json" with { type: "json" };

const origin = fixture.config.allowedOrigin;
const run = `airlock05102-${"a".repeat(32)}`;
const url = (name = "positive") =>
  `${origin}/?airlock-stock=v1&case=${name}&run=${run}&consent=decline`;
let browser;
let context;
let page;
let source;
let requests;
let unexpected;

beforeAll(async () => {
  // Empty namespace keeps every assertion reachable during the initial missing-module red run.
  source = await readFile(new URL("../probes/adobe-compatibility/stock-site.mjs", import.meta.url), "utf8")
    .catch(error => { if (error.code === "ENOENT") return "export {};"; throw error; });
  browser = await chromium.launch();
});
afterEach(async () => {
  await context?.close();
  expect(unexpected).toEqual([]);
});
afterAll(async () => { await browser?.close(); });

async function setup(caseName = "positive", visit = url(caseName)) {
  context = await browser.newContext();
  page = await context.newPage();
  requests = [];
  unexpected = [];
  await page.route("**/*", async route => {
    const requestUrl = route.request().url();
    requests.push(requestUrl);
    if (requestUrl === visit.split("#")[0]) {
      await route.fulfill({ contentType: "text/html", body: "<main><p>Original page</p></main>" });
    } else if (requestUrl === `${new URL(visit).origin}/stock-site.mjs`) {
      await route.fulfill({ contentType: "text/javascript", body: source });
    } else if (requestUrl === `${origin}/vendor/aem-martech/index.js`) {
      await route.fulfill({ contentType: "text/javascript", body:
        ["initMartech", "updateUserConsent", "sendEvent", "sendAnalyticsEvent",
          "pushEventToDataLayer", "martechLazy", "martechDelayed"]
          .map(name => `export const ${name} = (...args) => window.integration.${name}(...args);`).join("\n") });
    } else {
      unexpected.push(requestUrl);
      await route.abort();
    }
  });
  await page.goto(visit);
  // Browser source string is not rewritten by Vitest's server-side import transform.
  await page.addScriptTag({ type: "module",
    content: "window.api = await import('/stock-site.mjs'); window.apiReady = true;" });
  await page.waitForFunction(() => window.apiReady);
  await page.evaluate(async ({ config, html }) => {
    window.config = { ...config, enabled: true, expectedOfferHashes: [] };
    for (const content of html) {
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      window.config.expectedOfferHashes.push([...new Uint8Array(bytes)]
        .map(x => x.toString(16).padStart(2, "0")).join(""));
    }
    window.now = Date.parse("2026-10-09T23:01:00.000Z");
    window.calls = [];
    window.loads = 0;
    window.timers = new Map();
    window.tick = 0;
    window.clock = {
      now: () => window.now,
      setTimeout: (fn, ms) => { const id = ++window.tick; window.timers.set(id, { fn, ms }); return id; },
      clearTimeout: id => window.timers.delete(id),
    };
    window.response = { propositions: [{
      id: "arbitrary-bounded-proposition", scope: config.decisionScope,
      scopeDetails: { decisionProvider: "TGT", activity: { id: "invented-activity" },
        experience: { id: "invented-experience" } },
      items: [{ id: "not-local05-item", schema: "https://ns.adobe.com/personalization/html-content-item",
        data: { content: html[0] } }],
    }] };
    window.integration = Object.fromEntries(
      ["initMartech", "updateUserConsent", "sendEvent", "sendAnalyticsEvent",
        "pushEventToDataLayer", "martechLazy", "martechDelayed"].map(name => [name, (...args) => {
        window.calls.push({ name, args, visible: !!document.getElementById("airlock-stock-slot")
          ?.getBoundingClientRect().width,
        content: document.getElementById("airlock-stock-slot")?.textContent });
        if (name === "initMartech") {
          window.filter = [args[1].shouldProcessEvent({ event: "web.webinteraction.linkClicks" }),
            args[1].shouldProcessEvent({ event: "other" }), args[1].shouldProcessEvent(null)];
        }
        if (name === "sendEvent") return Promise.resolve(window.response);
        if (name !== "pushEventToDataLayer") return Promise.resolve();
      }]),
    );
    window.options = {
      config: window.config, runnerConsent: "grant", clock: window.clock,
      loadIntegration: async () => { window.loads++; return window.integration; },
    };
  }, { config: fixture.config, html: fixture.html });
  if (caseName === "no-consent") await page.evaluate(() => { window.options.runnerConsent = "deny"; });
  if (caseName === "no-offer") await page.evaluate(() => { window.response.propositions = []; });
}

async function eager() {
  return page.evaluate(async () => {
    window.entry = window.api.createStockEntry(window.options);
    await window.entry.eager();
    return window.entry.result;
  });
}
async function lazyClick() {
  await page.evaluate(() => { window.lazy = window.entry.lazy(); });
  await page.waitForFunction(() => window.entry.ready);
  await page.getByRole("button", { name: "Airlock synthetic control", exact: true }).click();
  await page.evaluate(() => window.lazy);
}
async function finish(caseName = "positive") {
  await eager();
  if (caseName === "no-consent") await page.evaluate(() => window.entry.lazy());
  else await lazyClick();
  return page.evaluate(async () => { await window.entry.delayed(); return window.entry.result; });
}

describe("051-06 deployed entry, real isolated browser DOM and stub SDK only", () => {
  it("renders approved inert readiness span but strips its attribute before DOM import", async () => {
    await setup();
    const html = '<span data-airlock-readiness="synthetic_Ready-1">Synthetic readiness</span>';
    await page.evaluate(async html => {
      window.response.propositions[0].items[0].data.content = html;
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
      window.config.expectedOfferHashes = [[...new Uint8Array(bytes)]
        .map(x => x.toString(16).padStart(2, "0")).join("")];
    }, html);
    expect((await eager()).overall).toBe("pending");
    expect(await page.locator("#airlock-stock-slot span").textContent()).toBe("Synthetic readiness");
    expect(await page.locator("#airlock-stock-slot span").getAttribute("data-airlock-readiness")).toBeNull();
    expect(await page.evaluate(() => window.entry.getObservation().renderedHTML)).toBe(html);
    await lazyClick();
    expect(await page.evaluate(async () => {
      await window.entry.delayed(); return window.entry.result.overall;
    })).toBe("sdk_submission_observed");
  });

  it("rejects unapproved spans and unsafe or out-of-contract attributes even with approved hashes", async () => {
    const contents = [
      '<span data-airlock-readiness="synthetic">unapproved</span>',
      '<span data-airlock-readiness="">x</span>',
      `<span data-airlock-readiness="${"a".repeat(101)}">x</span>`,
      '<span data-airlock-readiness="https://synthetic.invalid">x</span>',
      '<span data-airlock-readiness="safe" onclick="alert(1)">x</span>',
      '<span style="display:block">x</span>', '<span class="x">x</span>',
      '<span id="x">x</span>', '<span data-other="x">x</span>',
    ];
    for (const [index, html] of contents.entries()) {
      await setup();
      await page.evaluate(async ({ index, html }) => {
        window.response.propositions[0].items[0].data.content = html;
        if (index === 0) return; // deliberate hash mismatch
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
        window.config.expectedOfferHashes = [[...new Uint8Array(bytes)]
          .map(x => x.toString(16).padStart(2, "0")).join("")];
      }, { index, html });
      expect((await eager()).overall).toBe("invalid_proposition");
      expect(await page.evaluate(() => window.entry.result.counts.display_submissions)).toBe(0);
      expect(unexpected).toEqual([]);
      await context.close();
    }
  });

  it("exports pure eligibility/config predicates and rejects disabled before loader or DOM", async () => {
    await setup();
    expect(await page.evaluate(() => Object.keys(window.api).sort()))
      .toEqual(["createStockEntry", "isOptIn", "validateConfig"]);
    await page.evaluate(() => { window.config.enabled = false; });
    expect((await eager()).overall).toBe("notEligible");
    expect(await page.evaluate(() => [window.loads, window.calls.length, document.querySelectorAll("button").length]))
      .toEqual([0, 0, 0]);
    expect(requests).toHaveLength(2);
  });

  it.each([
    origin + "/", url().replace(origin, "https://foreign.example"),
    url().replace("/?", "/other?"), url() + "&extra=1", url() + "&case=positive",
    url().replace("v1", "v2"), url().replace("positive", "POSITIVE"),
    url().replace("consent=decline", "consent=grant"), url() + "#fragment",
    url().replace("airlock-stock", "%61irlock-stock"), url().replace(run, "invented"),
  ])("refuses URL before bootstrap config fetch / SDK: %s", async visit => {
    await setup("positive", visit);
    expect(await page.evaluate(origin => window.api.isOptIn(location.href, origin), origin)).toBe(false);
    expect((await eager()).overall).toBe("notEligible");
    expect(await page.evaluate(() => window.loads)).toBe(0);
  });

  it("rejects a bare fragment delimiter before eligibility or vendor loading", async () => {
    await setup("positive", url() + "#");
    expect(await page.evaluate(origin => window.api.isOptIn(location.href, origin), origin)).toBe(false);
    expect((await eager()).overall).toBe("notEligible");
    expect(await page.evaluate(() => [window.loads, window.calls.length])).toEqual([0, 0]);
    expect(requests).toHaveLength(2);
  });

  it("refuses invisible offer descendants despite a visible slot and positive child dimensions", async () => {
    const rules = [
      "#airlock-stock-slot > div { visibility:hidden }",
      "#airlock-stock-slot > div { opacity:0 }",
      "#airlock-stock-slot > div > p { visibility:hidden }",
      "#airlock-stock-slot > div > p { opacity:0 }",
      "#airlock-stock-slot > div > p { display:none }",
    ];
    for (const rule of rules) {
      await setup();
      await page.evaluate(async rule => {
        const html = "<div><p>Airlock synthetic offer A</p></div>";
        window.response.propositions[0].items[0].data.content = html;
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
        window.config.expectedOfferHashes = [[...new Uint8Array(bytes)]
          .map(x => x.toString(16).padStart(2, "0")).join("")];
        const style = document.createElement("style");
        style.textContent = rule;
        document.head.append(style);
      }, rule);
      const result = await eager();
      expect(result.overall, rule).toBe("render_unconfirmed");
      expect(result.counts).toMatchObject({ render_confirmed: 0, page_submissions: 0, display_submissions: 0 });
      expect(await page.evaluate(() => window.calls.some(x => x.name === "sendAnalyticsEvent"))).toBe(false);
      expect(await page.locator("#airlock-stock-slot").evaluate(node => ({
        connected: node.isConnected, width: node.getBoundingClientRect().width,
      }))).toEqual({ connected: true, width: 320 });
      expect(requests).toHaveLength(2);
      expect(unexpected).toEqual([]);
      await context.close();
    }
  });

  it("refuses fully translated/clipped offer rectangles inside the slot or clipping ancestors", async () => {
    for (const clipping of ["slot", "hidden", "clip", "auto", "scroll", "viewport"]) {
      await setup();
      await page.evaluate(clipping => {
        const style = document.createElement("style");
        style.textContent = "#airlock-stock-slot > div { transform:translateY(200px) }";
        if (clipping !== "slot") {
          const wrapper = document.createElement("div");
          const slot = document.createElement("div");
          wrapper.append(slot); document.body.append(wrapper); window.options.slot = slot;
          if (clipping === "viewport") {
            Object.assign(slot.style, { position: "fixed", top: "0px", left: `${innerWidth - 100}px` });
            style.textContent = "#airlock-stock-slot > div { transform:translateX(150px) }";
          } else {
            Object.assign(wrapper.style, { width: "320px", height: "60px", overflow: clipping });
            style.textContent = "#airlock-stock-slot > div { transform:translateY(100px) }";
          }
        }
        document.head.append(style);
      }, clipping);
      const result = await eager();
      expect(result.overall, clipping).toBe("render_unconfirmed");
      expect(result.counts).toMatchObject({ render_confirmed: 0, page_submissions: 0, display_submissions: 0 });
      expect(await page.locator("#airlock-stock-slot > div").evaluate(node =>
        node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0)).toBe(true);
      expect(await page.evaluate(() => window.calls.some(x => x.name === "sendAnalyticsEvent"))).toBe(false);
      expect(unexpected).toEqual([]);
      await context.close();
    }
  });

  it("preserves allowed nested content when its rectangles remain partly visible through clipping", async () => {
    await setup();
    await page.evaluate(async () => {
      const html = "<div><p>Airlock synthetic offer A</p></div>";
      window.response.propositions[0].items[0].data.content = html;
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(html));
      window.config.expectedOfferHashes = [[...new Uint8Array(bytes)]
        .map(x => x.toString(16).padStart(2, "0")).join("")];
      const style = document.createElement("style");
      style.textContent = "#airlock-stock-slot > div { transform:translateY(150px) }";
      document.head.append(style);
    });
    expect((await eager()).counts).toMatchObject({ render_confirmed: 1, page_submissions: 1, display_submissions: 1 });
    await lazyClick();
    expect(await page.evaluate(async () => {
      await window.entry.delayed(); return window.entry.result.overall;
    })).toBe("sdk_submission_observed");
  });

  it.each(["expired", "future", "unknown", "stringEnabled", "badHash", "duplicateHash", "badScope",
    "badPin", "badOrigin", "badDate", "getter"])("rejects config %s before loader", async mutation => {
    await setup();
    await page.evaluate(mutation => {
      const c = window.config;
      if (mutation === "expired") c.windowEnd = "2026-10-09T23:00:00.000Z";
      if (mutation === "future") c.windowStart = "2026-10-10T00:00:00.000Z";
      if (mutation === "unknown") c.moduleUrl = "/evil.js";
      if (mutation === "stringEnabled") c.enabled = "true";
      if (mutation === "badHash") c.expectedOfferHashes = ["not-a-digest"];
      if (mutation === "duplicateHash") c.expectedOfferHashes = [c.expectedOfferHashes[0], c.expectedOfferHashes[0]];
      if (mutation === "badScope") c.decisionScope = "target-global-mbox";
      if (mutation === "badPin") c.vendorPin = "alloy-new";
      if (mutation === "badOrigin") c.allowedOrigin += ":443";
      if (mutation === "badDate") c.windowStart = "tomorrow";
      if (mutation === "getter") Object.defineProperty(c, "orgId", {
        get() { window.loads++; throw new Error("Must never execute accessor"); },
      });
    }, mutation);
    expect((await eager()).overall).toBe("notEligible");
    expect(await page.evaluate(() => window.loads)).toBe(0);
  });

  it("requires explicit case-matched runner consent, rejects unknown options, and rechecks window in eager", async () => {
    await setup();
    expect(await page.evaluate(() => {
      const a = window.api.createStockEntry({ ...window.options, runnerConsent: "deny" });
      const b = window.api.createStockEntry({ ...window.options, arbitrary: true });
      return [a.result.overall, b.result.overall];
    })).toEqual(["notEligible", "notEligible"]);
    await page.evaluate(() => {
      window.entry = window.api.createStockEntry(window.options);
      window.now = Date.parse(window.config.windowEnd);
    });
    await page.evaluate(() => window.entry.eager());
    expect(await page.evaluate(() => [window.entry.result.overall, window.loads])).toEqual(["timeout", 0]);
  });

  it("loads only the fixed same-origin real export supplier after valid eager entry", async () => {
    await setup();
    await page.evaluate(() => { delete window.options.loadIntegration; });
    expect((await eager()).overall).toBe("pending");
    expect(requests.at(-1)).toBe(`${origin}/vendor/aem-martech/index.js`);
    expect(await page.evaluate(() => window.calls[0].name)).toBe("initMartech");
  });

  it("uses real browser timers with a ModuleNamespace supplier without illegal host receivers", async () => {
    await setup("no-offer");
    await page.evaluate(() => {
      delete window.options.clock;
      delete window.options.loadIntegration;
      window.config.windowStart = new Date(Date.now() - 1000).toISOString();
      window.config.windowEnd = new Date(Date.now() + 60000).toISOString();
      trustedTypes.createPolicy("default", {
        createHTML: s => s, createScriptURL: s => s, createScript: s => s,
      });
    });
    const result = await page.evaluate(async () => {
      window.entry = window.api.createStockEntry(window.options);
      try { await window.entry.eager(); }
      catch (error) { return { thrown: error.message, report: window.entry.result }; }
      return { report: window.entry.result };
    });
    expect(result.thrown).toBeUndefined();
    expect(result.report.phases.eager).toBe("complete");
    expect(result.report.counts).toMatchObject({ initializations: 1, consent_updates: 1,
      fetch_submissions: 1, page_submissions: 1 });
    expect(requests.at(-1)).toBe(`${origin}/vendor/aem-martech/index.js`);
    await context.close();
    await setup("no-offer");
    await page.evaluate(() => {
      delete window.options.clock;
      window.config.windowStart = new Date(Date.now() - 1000).toISOString();
      window.config.windowEnd = new Date(Date.now() + 60000).toISOString();
      window.integration.initMartech = async () => { throw new Error("Synthetic init refusal"); };
    });
    expect((await eager()).overall).toBe("integration_rejected");
  });

  it("orders real visible DOM, DISPLAY, trusted click, void ACDL and INTERACT with exact pinned signatures", async () => {
    await setup();
    const result = await finish();
    expect(result.overall).toBe("sdk_submission_observed");
    expect(result.counts).toMatchObject({ initializations: 1, consent_updates: 1, fetch_submissions: 1,
      page_submissions: 1, custom_submissions: 1, display_submissions: 1, interaction_submissions: 1,
      render_confirmed: 1, click_confirmed: 1 });
    const observed = await page.evaluate(() => ({
      calls: window.calls, filter: window.filter, raw: window.entry.getObservation(),
      rect: document.getElementById("airlock-stock-slot").getBoundingClientRect().toJSON(),
      frozen: Object.isFrozen(window.entry.result.counts),
    }));
    const { calls, raw } = observed;
    expect(calls.map(x => x.name)).toEqual(["initMartech", "updateUserConsent", "sendEvent",
      "sendAnalyticsEvent", "martechLazy", "pushEventToDataLayer", "sendEvent", "martechDelayed"]);
    expect(calls[0].args).toEqual([
      { orgId: fixture.config.orgId, datastreamId: fixture.config.datastreamId, edgeDomain: "edge.adobedc.net",
        defaultConsent: "pending", debugEnabled: false, thirdPartyCookiesEnabled: false,
        idMigrationEnabled: false, targetMigrationEnabled: false, clickCollectionEnabled: false,
        autoCollectPropositionInteractions: { AJO: "never", TGT: "never" } },
      { analytics: true, personalization: true, performanceOptimized: true, personalizationTimeout: 1000,
        trackPageView: false, dataLayer: true, includeDataLayerState: false, launchUrls: [],
        alloyInstanceName: "alloy", dataLayerInstanceName: "adobeDataLayer",
        decisionScopes: [fixture.config.decisionScope] },
    ]);
    expect(observed.filter).toEqual([true, false, false]);
    expect(calls[1].args).toEqual([{ collect: true, personalize: true, marketing: false, share: false }]);
    expect(calls[2].args).toEqual([{ type: "decisioning.propositionFetch", renderDecisions: false,
      decisionScopes: [fixture.config.decisionScope],
      personalization: { defaultPersonalizationEnabled: false, sendDisplayEvent: false },
      xdm: { web: { webPageDetails: { name: "airlock-stock-v1", URL: url() } } } }]);
    const identity = { id: raw.response.propositions[0].id, scope: fixture.config.decisionScope,
      scopeDetails: raw.response.propositions[0].scopeDetails };
    const decision = event => ({ _experience: { decisioning: {
      propositions: [identity], propositionEventType: { [event]: 1 },
    } } });
    expect(calls[3].args).toEqual([
      { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: {
        name: `${run}-positive-1-page`, URL: url(), pageViews: { value: 1 },
      } }, ...decision("display") },
      { __adobe: { analytics: { pageName: raw.pageName, pageURL: url() } } }, {},
    ]);
    expect(calls[3].content).toBe("Airlock synthetic offer A");
    expect(calls[3].visible).toBe(true);
    expect(calls[5].args).toEqual(["web.webinteraction.linkClicks",
      { web: { webInteraction: { name: raw.customName, type: "other", linkClicks: { value: 1 } } } },
      { __adobe: { analytics: { linkType: "o", linkName: raw.customName } } }, {},
    ]);
    expect(calls[6].args).toEqual([{ type: "decisioning.propositionInteract", renderDecisions: false,
      personalization: { defaultPersonalizationEnabled: false, sendDisplayEvent: false },
      xdm: decision("interact") }]);
    expect(raw.renderedHTML).toBe(fixture.html[0]);
    expect(observed.rect).toMatchObject({ width: 320, height: 180 });
    expect(observed.frozen).toBe(true);
    expect(result.claims).toEqual({ downstream_receipt_verified: false, deployment_verified: false,
      vendor_consent_enforcement_verified: false });
    const publicText = JSON.stringify(result);
    for (const privateValue of [origin, run, fixture.config.orgId, fixture.config.decisionScope,
      identity.id, fixture.html[0]]) expect(publicText).not.toContain(privateValue);
  });

  it.each(["no-offer", "non-render", "no-consent"])("executes %s stimuli without fake notifications/receipt", async name => {
    await setup(name);
    const result = await finish(name);
    expect(result.overall).toBe(name === "no-consent" ? "locally_guarded" : "sdk_submission_observed");
    expect(result.counts).toMatchObject({ display_submissions: 0, interaction_submissions: 0,
      render_confirmed: 0, qualified_propositions: name === "non-render" ? 1 : 0,
      page_submissions: name === "no-consent" ? 0 : 1, custom_submissions: name === "no-consent" ? 0 : 1 });
    const calls = await page.evaluate(() => window.calls);
    expect(calls[1].args[0].collect).toBe(name !== "no-consent");
    if (name === "no-consent") {
      expect(result.counts).toMatchObject({ attempted_collection: 4, blocked_collection: 4 });
      expect(calls.map(x => x.name)).toEqual(["initMartech", "updateUserConsent", "martechLazy", "martechDelayed"]);
    } else {
      expect(calls.find(x => x.name === "sendAnalyticsEvent").args[0]._experience).toBeUndefined();
      expect(await page.locator("#airlock-stock-slot").textContent()).toBe("");
    }
  });

  it.each(["hash", "scope", "provider", "duplicates", "items", "id", "schema", "no-offer-nonempty",
    "script", "handler", "link", "image", "svg", "iframe", "style", "activeAttribute", "structure"])(
    "rejects %s decision even known-hash unsafe markup before page submission", async mutation => {
    await setup(mutation === "no-offer-nonempty" ? "no-offer" : "positive");
    await page.evaluate(async ({ mutation, html }) => {
      if (mutation === "no-offer-nonempty") {
        window.response.propositions = [{ id: "unexpected" }];
        return;
      }
      const p = window.response.propositions[0];
      const bad = { script: "<script>alert(1)</script>", handler: '<div onclick="x()">x</div>',
        link: '<a href="https://bad.example">x</a>', image: '<img src="https://bad.example/x">',
        svg: "<svg></svg>", iframe: "<iframe></iframe>", style: "<style>div{}</style>",
        activeAttribute: '<div style="display:none">x</div>', structure: "<div><table>x</table></div>" }[mutation];
      if (bad) {
        p.items[0].data.content = bad;
        const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bad));
        window.config.expectedOfferHashes = [[...new Uint8Array(bytes)]
          .map(x => x.toString(16).padStart(2, "0")).join("")];
      }
      if (mutation === "hash") p.items[0].data.content = html + "unknown";
      if (mutation === "scope") p.scope = "foreign";
      if (mutation === "provider") p.scopeDetails.decisionProvider = "AJO";
      if (mutation === "duplicates") window.response.propositions.push(p);
      if (mutation === "items") p.items.push(p.items[0]);
      if (mutation === "id") p.id = "";
      if (mutation === "schema") p.items[0].schema = "dom-action";
    }, { mutation, html: fixture.html[0] });
    expect((await eager()).overall).toBe("invalid_proposition");
    expect(await page.evaluate(() => window.calls.some(x => x.name === "sendAnalyticsEvent"))).toBe(false);
    expect(await page.locator("#airlock-stock-slot").textContent()).toBe("");
    expect(requests).toHaveLength(2);
  });

  it("does not accept synthetic click or submit custom until a real host click; duplicate clicks send once", async () => {
    await setup();
    await eager();
    await page.evaluate(() => { window.lazy = window.entry.lazy(); });
    await page.waitForFunction(() => window.entry.ready);
    await page.evaluate(() => document.getElementById("airlock-stock-control").click());
    expect(await page.evaluate(() => window.entry.result.counts.custom_submissions)).toBe(0);
    await page.getByRole("button", { name: "Airlock synthetic control" }).click();
    await page.evaluate(() => window.lazy);
    await page.evaluate(() => document.getElementById("airlock-stock-control").click());
    expect(await page.evaluate(() => window.entry.result.counts.custom_submissions)).toBe(1);
  });

  it("hidden or detached host slot cannot earn DISPLAY", async () => {
    await setup();
    await page.evaluate(() => {
      const slot = document.createElement("div");
      slot.hidden = true; document.body.append(slot); window.options.slot = slot;
    });
    expect((await eager()).overall).toBe("render_unconfirmed");
    expect(await page.evaluate(() => window.entry.result.counts.display_submissions)).toBe(0);
  });

  it.each(["initMartech", "updateUserConsent", "sendEvent", "sendAnalyticsEvent", "martechLazy",
    "pushEventToDataLayer", "martechDelayed"])("stops after %s rejects without leaking raw errors", async method => {
    await setup();
    await page.evaluate(method => {
      const original = window.integration[method];
      window.integration[method] = (...args) => { original(...args); throw new Error("PRIVATE raw selector"); };
    }, method);
    await eager();
    if (["martechLazy", "pushEventToDataLayer", "martechDelayed"].includes(method)) {
      if (method === "martechLazy") await page.evaluate(() => window.entry.lazy());
      else await lazyClick();
    }
    await page.evaluate(() => window.entry.delayed());
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("integration_rejected");
    const names = await page.evaluate(() => window.calls.map(x => x.name));
    expect(names.at(-1)).toBe(method);
    expect(await page.evaluate(() => JSON.stringify(window.entry.result))).not.toContain("PRIVATE");
  });

  it("phase deadline stops late decision settlement and subsequent phases", async () => {
    await setup();
    await page.evaluate(() => {
      window.integration.sendEvent = () => new Promise(resolve => { window.resolveLate = resolve; });
      window.entry = window.api.createStockEntry(window.options);
      window.eager = window.entry.eager();
    });
    await page.waitForFunction(() => !!window.resolveLate);
    await page.evaluate(() => { for (const t of [...window.timers.values()]) t.fn(); });
    await page.evaluate(() => window.eager);
    await page.evaluate(async () => {
      window.resolveLate(window.response);
      await new Promise(resolve => setTimeout(resolve, 30));
      await window.entry.lazy(); await window.entry.delayed();
    });
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("timeout");
    expect(await page.locator("#airlock-stock-slot").textContent()).toBe("");
    expect(await page.evaluate(() => window.calls.map(x => x.name))).toEqual(["initMartech", "updateUserConsent"]);
  });

  it("click wait timeout clears ready and never resumes on later real click", async () => {
    await setup();
    await eager();
    await page.evaluate(() => { window.lazy = window.entry.lazy(); });
    await page.waitForFunction(() => window.entry.ready);
    await page.evaluate(() => { for (const t of [...window.timers.values()]) t.fn(); });
    await page.evaluate(() => window.lazy);
    expect(await page.evaluate(() => [window.entry.result.overall, window.entry.ready])).toEqual(["timeout", false]);
    expect(await page.evaluate(() => window.entry.result.counts.custom_submissions)).toBe(0);
  });

  it("single initialization guard, duplicate/out-of-order phases and whole-run expiry fail closed", async () => {
    await setup();
    await eager();
    expect(await page.evaluate(() => window.api.createStockEntry(window.options).result.overall)).toBe("duplicate_entry");
    await page.evaluate(() => window.entry.eager());
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("invalid_phase");
    expect(await page.evaluate(() => window.loads)).toBe(1);
    await context.close();
    await setup();
    await page.evaluate(() => { window.entry = window.api.createStockEntry(window.options); });
    await page.evaluate(() => window.entry.lazy());
    expect(await page.evaluate(() => [window.entry.result.overall, window.loads])).toEqual(["invalid_phase", 0]);
    await context.close();
    await setup();
    await eager();
    await page.evaluate(() => { window.now += 30001; });
    await page.evaluate(() => window.entry.lazy());
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("timeout");
    expect(await page.evaluate(() => window.calls.some(x => x.name === "martechLazy"))).toBe(false);
  });

  it("void ACDL is a submission not a promise acknowledgement, rejecting non-void contract", async () => {
    await setup();
    await page.evaluate(() => {
      window.integration.pushEventToDataLayer = () => Promise.reject(new Error("PRIVATE listener"));
    });
    await eager(); await lazyClick();
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("invalid_contract");
    expect(await page.evaluate(() => window.entry.result.counts.interaction_submissions)).toBe(0);
  });

  it("preserves bounded additive JSON scopeDetails arrays without inventing result metadata", async () => {
    await setup();
    await page.evaluate(() => {
      window.response.propositions[0].scopeDetails.characteristics = { steps: ["invented", 1] };
    });
    expect((await eager()).overall).toBe("pending");
    await lazyClick();
    expect(await page.evaluate(async () => {
      await window.entry.delayed(); return window.entry.result.overall;
    })).toBe("sdk_submission_observed");
    expect(await page.evaluate(() => window.calls[6].args[0].xdm._experience.decisioning
      .propositions[0].scopeDetails.characteristics)).toEqual({ steps: ["invented", 1] });
  });

  it("missing exports, accessors, malformed empty response and loader failure stop without SDK initialization", async () => {
    await setup();
    await page.evaluate(() => {
      delete window.integration.sendEvent;
    });
    expect((await eager()).overall).toBe("invalid_contract");
    expect(await page.evaluate(() => window.calls.length)).toBe(0);
    await context.close();
    await setup();
    await page.evaluate(() => {
      window.options.loadIntegration = () => Promise.reject(new Error("PRIVATE loader"));
    });
    expect((await eager()).overall).toBe("integration_rejected");
    expect(await page.evaluate(() => window.calls.length)).toBe(0);
    await context.close();
    await setup("no-offer");
    await page.evaluate(() => { window.response = {}; });
    expect((await eager()).overall).toBe("invalid_proposition");
    await context.close();
    await setup();
    await page.evaluate(() => {
      Object.defineProperty(window.response.propositions[0], "id", {
        get() { throw new Error("PRIVATE accessor"); },
      });
    });
    expect((await eager()).overall).toBe("invalid_proposition");
  });

  it("native INTERACT rejection stops delayed and remains one attempted submission", async () => {
    await setup();
    await page.evaluate(() => {
      const send = window.integration.sendEvent;
      window.integration.sendEvent = (...args) => {
        const response = send(...args);
        if (args[0].type === "decisioning.propositionInteract") throw new Error("PRIVATE interact");
        return response;
      };
    });
    await eager(); await lazyClick();
    await page.evaluate(() => window.entry.delayed());
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("integration_rejected");
    expect(await page.evaluate(() => window.entry.result.counts.interaction_submissions)).toBe(1);
    expect(await page.evaluate(() => window.calls.at(-1).args[0].type)).toBe("decisioning.propositionInteract");
  });

  it("configuration is snapshotted, current URL drift stops, and actual detached slot is refused", async () => {
    await setup();
    await page.evaluate(() => {
      window.options.slot = document.createElement("div");
    });
    expect((await eager()).overall).toBe("notEligible");
    await page.evaluate(() => { delete window.options.slot; });
    await eager();
    await page.evaluate(() => {
      window.config.decisionScope = "different";
      history.replaceState(null, "", "/?changed");
    });
    await page.evaluate(() => window.entry.lazy());
    expect(await page.evaluate(() => window.entry.result.overall)).toBe("invalid_phase");
    expect(await page.evaluate(() => window.calls[2].args[0].decisionScopes)).toEqual([fixture.config.decisionScope]);
  });
});
