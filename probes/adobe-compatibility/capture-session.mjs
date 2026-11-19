#!/usr/bin/env node
import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { attachCaptureRecorder, AlloyPinError } from "./capture-recorder.mjs";
import { buildManifest, finishFixture } from "./capture-fixture.mjs";

// Spec 064-04 capture driver (CLI). One invocation records one fixture:
//   node capture-session.mjs --id s1-base --state S1 --scenario page-view \
//     --headed|--headless [--variant viewport|locale|timezone|referrer] \
//     [--source <profile-source-id>] [--poc-commit <sha>] [--rerecord "why"]
//     [--owner-change "text" --change-at <iso> --waited "text"]
// Withheld IDs are read at runtime from the file named by AIRLOCK_PRIVATE_IDS
// (outside the repo) and scrubbed to labels; nothing about that file is stored.

const ORIGIN = "https://main--aem-eds-airlock-poc--adobe-rnd.aem.page";
const ORG = "908936ED5D35CC220A495CD4@AdobeOrg";
const DATASTREAM = "23190fa7-9e6b-4250-b87b-abcdc8ebc297";
const SCOPE = "airlock.readiness.2e2319c8";
const BOGUS_DATASTREAM = "00000000-0000-4000-8000-000000000064";
const OUT = "test/fixtures/adobe-capture";
const PROFILES = process.env.AIRLOCK_PROFILES ?? "/tmp/cap064/profiles";
const BASE = { viewport: { width: 1280, height: 800 }, locale: "en-US", timezone: "America/New_York" };
const VARIANTS = {
  viewport: { viewport: { width: 800, height: 600 } },
  locale: { locale: "de-DE" },
  timezone: { timezone: "Europe/Berlin" },
  referrer: { referrer: "https://referrer.example/start" },
};
const PV = { xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } } };
const CONSENT = value => ({ consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: value } } }] });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const call = (page, command, options) => page.evaluate(async ([c, o]) => {
  try {
    const r = await window.alloy(c, o);
    return { ok: true, result: JSON.parse(JSON.stringify(r ?? null)) };
  } catch (e) { return { ok: false, error: { name: e.name, message: e.message, code: e.code } }; }
}, [command, options]);

// Fire without waiting, so the command queues behind consent.
const queue = (page, command, options) => page.evaluate(([c, o]) => {
  window.__queued = (window.__queued ?? []);
  window.__queued.push(window.alloy(c, o).then(r => ({ ok: true, result: JSON.parse(JSON.stringify(r ?? null)) }),
    e => ({ ok: false, error: { name: e.name, message: e.message } })));
}, [command, options]);
const drain = page => page.evaluate(async () => Promise.all(window.__queued ?? []));

const configure = (page, extra = {}) => call(page, "configure", {
  datastreamId: DATASTREAM, orgId: ORG, defaultConsent: "in", clickCollectionEnabled: false, ...extra,
});

const SCENARIOS = {
  "page-view": async (page, step) => { await step("configure", configure(page)); await step("sendEvent", call(page, "sendEvent", PV)); },
  "page-view-library": async (page, step) => {
    await step("configure", configure(page));
    await step("getLibraryInfo", call(page, "getLibraryInfo"));
    await step("sendEvent", call(page, "sendEvent", PV));
  },
  "custom-xdm": async (page, step) => {
    await step("configure", configure(page));
    await step("sendEvent", call(page, "sendEvent", { xdm: { ...PV.xdm, eventMergeId: "airlock064-merge-1", _airlock064: { probe: "custom-xdm" } } }));
  },
  decisions: async (page, step) => {
    await step("configure", configure(page));
    await step("sendEvent", call(page, "sendEvent", { ...PV, decisionScopes: [SCOPE], renderDecisions: true }));
  },
  identity: async (page, step) => {
    await step("configure", configure(page));
    await step("getIdentity", call(page, "getIdentity"));
    await step("appendIdentityToUrl", call(page, "appendIdentityToUrl", { url: "https://destination.example/landing" }));
  },
  interactions: async (page, step) => {
    await step("configure", configure(page));
    await step("sendEvent:page", call(page, "sendEvent", PV));
    await step("sendEvent:link", call(page, "sendEvent", { xdm: { eventType: "web.webinteraction.linkClicks", web: { webInteraction: { name: "airlock064-link", type: "other", URL: "https://destination.example/landing", linkClicks: { value: 1 } } } } }));
    await page.evaluate(() => history.pushState({}, "", "/?spa-view=2"));
    await step("sendEvent:spa-view", call(page, "sendEvent", { renderDecisions: true, xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-view-2", viewName: "airlock064-view-2" } } } }));
  },
  "consent-out": async (page, step) => {
    await step("configure", configure(page, { defaultConsent: "pending" }));
    await step("queue", queue(page, "sendEvent", PV)); await queue(page, "sendEvent", PV);
    await step("setConsent:out", call(page, "setConsent", CONSENT("n")));
    await step("queued", drain(page));
  },
  "consent-in": async (page, step) => {
    await step("configure", configure(page, { defaultConsent: "pending" }));
    await step("queue", queue(page, "sendEvent", PV)); await queue(page, "sendEvent", PV);
    await step("setConsent:in", call(page, "setConsent", CONSENT("y")));
    await step("queued", drain(page));
  },
  "consent-pending-in": async (page, step) => {
    await step("configure", configure(page, { defaultConsent: "pending" }));
    await step("queue", queue(page, "sendEvent", PV)); await queue(page, "sendEvent", PV);
    await step("hold-pending-3s", sleep(3000));
    await step("setConsent:in", call(page, "setConsent", CONSENT("y")));
    await step("queued", drain(page));
  },
  "error-blocked": async (page, step, ctx) => {
    await ctx.route(/^https:\/\/[^/]*(adobedc\.net|demdex\.net)\//, route => route.abort("blockedbyclient"));
    await step("configure", configure(page));
    await step("sendEvent", call(page, "sendEvent", PV));
  },
  "error-non200": async (page, step) => {
    await step("configure", configure(page, { datastreamId: BOGUS_DATASTREAM }));
    await step("sendEvent", call(page, "sendEvent", PV));
  },
  fpid: async (page, step) => {
    await page.evaluate(() => { document.cookie = "airlock064_fpid=airlock064-fpid-value; path=/; SameSite=Lax"; });
    await step("configure", configure(page));
    await step("sendEvent", call(page, "sendEvent", { ...PV, decisionScopes: [SCOPE] }));
  },
  combined: async (page, step) => {
    await step("configure", configure(page));
    await step("sendEvent", call(page, "sendEvent", {
      ...PV, decisionScopes: [SCOPE],
      xdm: { ...PV.xdm, identityMap: { airlock064ns: [{ id: "airlock064-id-1", authenticatedState: "ambiguous", primary: false }] } },
    }));
  },
  "overrides-off": async (page, step) => {
    await step("configure", configure(page));
    await step("sendEvent", call(page, "sendEvent", { ...PV, edgeConfigOverrides: { com_adobe_target: { enabled: false }, com_adobe_analytics: { enabled: false } } }));
  },
};

const args = (() => {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const key = a[i].slice(2);
    out[key] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return out;
})();

function withheld() {
  try { return JSON.parse(readFileSync(process.env.AIRLOCK_PRIVATE_IDS, "utf8")); } catch { return {}; }
}

async function main() {
  const { id, state, scenario } = args;
  if (!id || !state || !scenario || !(args.headed || args.headless)) throw new Error("usage: --id --state --scenario --headed|--headless");
  const stock = scenario === "stock-no-offer";
  if (!stock && !SCENARIOS[scenario]) throw new Error(`unknown scenario ${scenario}`);
  const settings = { ...BASE, referrer: null, ...(args.variant ? VARIANTS[args.variant] : {}) };
  const returning = Boolean(args.source);
  const dir = join(PROFILES, returning ? args.source : id);
  mkdirSync(dir, { recursive: true });
  const run = randomBytes(16).toString("hex");
  const url = stock
    ? `${ORIGIN}/?airlock-stock=v1&case=no-offer&run=airlock05102-${run}&consent=decline&google-ads=off&meta-pixel=off`
    : `${ORIGIN}/?airlock-capture=v1&run=airlock064-${run}&state=${state}&google-ads=off&meta-pixel=off`;
  const context = await chromium.launchPersistentContext(dir, {
    headless: Boolean(args.headless), viewport: settings.viewport, locale: settings.locale, timezoneId: settings.timezone,
  });
  const recorder = attachCaptureRecorder(context, { pageOrigin: ORIGIN });
  const steps = [];
  try {
    if (stock) await context.addInitScript(() => { window.__airlockStockConsent = "grant"; });
    const page = context.pages()[0] ?? await context.newPage();
    const before = { cookies: await context.cookies(), localStorage: await readStorage(context), sessionStorage: {} };
    const started = Date.now();
    await page.goto(url, { referer: settings.referrer ?? undefined, waitUntil: "load" });
    const step = async (name, promise) => {
      const result = await promise;
      steps.push({ step: name, at_ms: Date.now() - started, ...(result && typeof result === "object" && "ok" in result ? result : {}) });
      return result;
    };
    if (stock) {
      const control = page.locator("#airlock-stock-control");
      await control.waitFor({ state: "visible", timeout: 30000 });
      await step("control-visible", Promise.resolve());
      await control.click();
      await sleep(4000);
    } else {
      await page.waitForFunction(() => window.__airlockCapture || window.__airlockCaptureFailure, null, { timeout: 30000 });
      if (await page.evaluate(() => window.__airlockCaptureFailure)) throw new Error("capture gate failed to start");
      await SCENARIOS[scenario](page, step, context);
    }
    await sleep(2500);
    await recorder.settle();
    const alloy = await recorder.verifyAlloy();
    const after = {
      cookies: await context.cookies(),
      ...(await page.evaluate(() => ({ localStorage: { ...localStorage }, sessionStorage: { ...sessionStorage } }))),
    };
    const ua = await page.evaluate(() => navigator.userAgent);
    const version = /(?:Headless)?Chrome\/([0-9.]+)/.exec(ua)?.[1] ?? "0";
    const manifest = buildManifest({
      capturedAt: new Date().toISOString(),
      input: {
        url: page.url(), referrer: settings.referrer, viewport: settings.viewport, locale: settings.locale,
        timezone: settings.timezone, egress: { region: "non-eea", exit_id: "default" },
        browser: { name: "chromium", version }, mode: args.headless ? "headless" : "headed",
        profileKind: returning ? "returning" : "fresh",
      },
      alloySha256: alloy.sha256, before, after,
    });
    const { requests, dropped } = await recorder.records();
    const capture = {
      recording_id: id, state, scenario, variant: args.variant ?? null,
      poc_commit: args["poc-commit"] ?? null, source_fixture: args.source ?? null,
      rerecord: args.rerecord ?? null,
      owner_change: args["owner-change"] ? { change: args["owner-change"], at: args["change-at"] ?? null, waited: args.waited ?? null } : null,
      user_agent: ua, alloy_loads: alloy.loads, dropped, steps,
    };
    const done = finishFixture({ manifest, capture, requests, withheld: withheld() });
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${id}.json`), done.text);
    const counts = {};
    for (const r of requests) { const h = new URL(r.url).host; counts[h] = (counts[h] ?? 0) + 1; }
    console.log(JSON.stringify({ id, requests: requests.length, hosts: counts, scrubbed: done.scrubbed, steps: steps.map(s => `${s.step}:${s.ok ?? "-"}`) }));
  } finally {
    await recorder.stop();
    await context.close();
  }
}

async function readStorage(context) {
  const state = await context.storageState();
  const local = {};
  for (const o of state.origins) for (const item of o.localStorage) local[item.name] = item.value;
  return local;
}

main().catch(error => {
  console.error(error instanceof AlloyPinError ? `ALLOY_PIN_ABORT: ${error.message}` : `capture failed: ${error.message}`);
  process.exit(error instanceof AlloyPinError ? 3 : 1);
});
