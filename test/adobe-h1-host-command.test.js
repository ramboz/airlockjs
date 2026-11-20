// Spec 064-26 (ADR-0063): the host command entry, `handle.command(name, options)`.
// The hermetic half drives the main-thread entry with a fake worker. The real-browser half calls the five
// allowlisted commands through the REAL chamber in real Chromium (`window.__handle.command`, never the rig's
// `window.__command`) and compares against the recorded corpus, or against pinned stock Alloy 2.31.1 itself on
// the same page where the corpus has no recording (labelled SYNTHETIC). Gated: `AIRLOCK_REAL_CHROMIUM=1`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { createHostCommandEntry } from "../adapters/eds/host-command.js";
import { ALLOY_HOST_COMMANDS, errorEnvelope, errorFromEnvelope, plainDataProblem } from "../connectors/alloy/host-commands.js";
import { loadFixture, replayFixture } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 60000;
const PV = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const posts = (fixture) => fixture.requests.filter((r) => r.method === "POST");
const edgeCalls = (r) => r.network.filter((n) => /adobedc|edge\./.test(n.url));

function fakeWorker() {
  const listeners = {};
  const sent = [];
  return {
    sent,
    postMessage: (m) => sent.push(m),
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    emit: (t, data) => (listeners[t] || []).forEach((fn) => fn({ data })),
  };
}
const configured = (w, settled = "resolved") => w.emit("message", { type: "phase", name: "configured", configureSettled: settled });
const rendererStub = () => ({ calls: [], async render(p) { this.calls.push(p); return { propositions: p.map((x) => ({ ...x, renderAttempted: true })) }; } });

describe("064-26 the allowlist and the error envelope (hermetic)", () => {
  it("allows exactly the five commands", () => {
    expect([...ALLOY_HOST_COMMANDS].sort()).toEqual(["appendIdentityToUrl", "applyResponse", "createEventMergeId", "getIdentity", "getLibraryInfo"]);
  });

  it("rebuilds an error as a plain Error and never a TypeError", () => {
    const e = errorFromEnvelope(errorEnvelope(Object.assign(new TypeError("bad"), { code: "X1" })));
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(TypeError);
    expect(e.name).not.toBe("TypeError");
    expect(e.message).toBe("bad");
    expect(e.code).toBe("X1");
  });

  it("flags functions, symbols and class instances as non-data", () => {
    expect(plainDataProblem({ a: [1, { b: "x" }] })).toBeFalsy();
    expect(plainDataProblem({ cb() {} })).toBeTruthy();
    expect(plainDataProblem({ s: Symbol("x") })).toBeTruthy();
    expect(plainDataProblem({ n: new (class Foo {})() })).toBeTruthy();
  });
});

describe("064-26 the main-thread entry (hermetic)", () => {
  it("refuses a name off the allowlist with a plain Error and posts nothing", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    for (const name of ["sendEvent", "setConsent", "configure", "evaluateRulesets", "nope"]) {
      const e = await command(name, {}).then(() => null, (x) => x);
      expect(e, name).toBeInstanceOf(Error);
      expect(e).not.toBeInstanceOf(TypeError);
    }
    expect(w.sent).toEqual([]);
  });

  it("rejects an empty or non-string name with a plain Error", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    for (const name of ["", undefined, 7, {}]) {
      const e = await command(name).then(() => null, (x) => x);
      expect(e, String(name)).toBeInstanceOf(Error);
      expect(e).not.toBeInstanceOf(TypeError);
    }
    expect(w.sent).toEqual([]);
  });

  it("rejects non-data options with a plain Error before posting", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    const e = await command("getIdentity", { cb() {} }).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(TypeError);
    expect(w.sent).toEqual([]);
  });

  it("holds calls until the chamber is configured, then posts them in call order", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    const a = command("getIdentity");
    const b = command("createEventMergeId");
    expect(w.sent).toEqual([]);
    configured(w);
    expect(w.sent.map((m) => m.command)).toEqual(["getIdentity", "createEventMergeId"]);
    // answered out of order: each settles by its own id
    w.emit("message", { type: "command-result", id: w.sent[1].id, result: { eventMergeId: "m" } });
    w.emit("message", { type: "command-result", id: w.sent[0].id, result: { identity: {} } });
    await expect(b).resolves.toEqual({ eventMergeId: "m" });
    await expect(a).resolves.toEqual({ identity: {} });
    // a late duplicate for a settled id is ignored
    w.emit("message", { type: "command-result", id: w.sent[0].id, result: { late: true } });
  });

  it("rejects an error answer as a plain Error", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    const p = command("getIdentity");
    w.emit("message", { type: "command-result", id: w.sent[0].id, error: { name: "TypeError", message: "boom" } });
    const e = await p.then(() => null, (x) => x);
    expect(e.message).toBe("boom");
    expect(e).not.toBeInstanceOf(TypeError);
  });

  it("rejects waiting calls when configure fails, and later calls", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    const p = command("getIdentity");
    configured(w, "rejected: bad config");
    await expect(p).rejects.toThrow(/configure/);
    await expect(command("getIdentity")).rejects.toThrow(/configure/);
  });

  it("rejects in-flight calls on a lost chamber but not on a sendEvent fatal", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    const p = command("getIdentity");
    w.emit("message", { type: "fatal", phase: "sendEvent", message: "x" });
    w.emit("message", { type: "command-result", id: w.sent[0].id, result: { ok: 1 } });
    await expect(p).resolves.toEqual({ ok: 1 });
    const q = command("getIdentity");
    w.emit("error", {});
    await expect(q).rejects.toThrow(/lost/);
  });

  it("a fatal load error rejects a call waiting for boot, with a plain Error", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    const waiting = command("getIdentity");
    w.emit("message", { type: "fatal", phase: "load", message: "bundle" });
    const e = await waiting.then(() => null, (x) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(TypeError);
    expect(e.message).toMatch(/lost/);
  });

  it("a fatal load error after the call was posted rejects it in flight, with a plain Error", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    const inFlight = command("getIdentity");
    expect(w.sent).toHaveLength(1);
    w.emit("message", { type: "fatal", phase: "load", message: "bundle" });
    const e = await inFlight.then(() => null, (x) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(TypeError);
    expect(e.message).toMatch(/lost/);
    await expect(command("getIdentity")).rejects.toThrow(/lost/);
  });

  it("a renderer failure rejects applyResponse with a plain Error", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: { render: async () => { throw new TypeError("x"); } } });
    configured(w);
    const p = command("applyResponse", { renderDecisions: true });
    w.emit("message", { type: "command-result", id: w.sent[0].id, result: { propositions: [{ id: "p" }] } });
    const e = await p.then(() => null, (x) => x);
    expect(e).not.toBeInstanceOf(TypeError);
    expect(e.message).toMatch(/rendering/);
  });

  it("dispose rejects pending calls and later calls", async () => {
    const w = fakeWorker();
    const entry = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    configured(w);
    const p = entry.command("getIdentity");
    entry.dispose();
    await expect(p).rejects.toThrow(/disposed/);
    await expect(entry.command("getLibraryInfo")).rejects.toThrow(/disposed/);
  });

  it("applyResponse renders on the main thread only when renderDecisions is true", async () => {
    const w = fakeWorker();
    const renderer = rendererStub();
    const { command } = createHostCommandEntry({ worker: w, renderer });
    configured(w);
    const plain = command("applyResponse", { responseBody: {} });
    w.emit("message", { type: "command-result", id: w.sent[0].id, result: { propositions: [{ id: "p" }] } });
    expect(await plain).toEqual({ propositions: [{ id: "p" }] });
    expect(renderer.calls).toEqual([]);
    const rendered = command("applyResponse", { responseBody: {}, renderDecisions: true });
    w.emit("message", { type: "command-result", id: w.sent[1].id, result: { propositions: [{ id: "p" }] } });
    expect(await rendered).toEqual({ propositions: [{ id: "p", renderAttempted: true }] });
    expect(renderer.calls).toHaveLength(1);
  });
});

describe.runIf(real)("064-26 the five commands through the real chamber (real Chromium)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, T);
  afterAll(async () => { await browser?.close(); });

  const call = (page, name, options) => page.evaluate(({ name, options }) => window.__handle.command(name, options).then((result) => ({ result }), (e) => ({ error: { name: e.name, message: e.message, code: e.code, isTypeError: e instanceof TypeError } })), { name, options });

  it("S5 fresh: getIdentity and appendIdentityToUrl match the recording, with the one acquire", async () => {
    const steps5 = (await loadFixture("s5-fresh")).capture.steps;
    const recId = steps5.find((s) => s.step === "getIdentity").result;
    const recUrl = steps5.find((s) => s.step === "appendIdentityToUrl").result;
    const r = await replayFixture(browser, "s5-fresh", {
      skipSteps: true,
      run: async (page) => ({ id: await call(page, "getIdentity", {}), url: await call(page, "appendIdentityToUrl", { url: "https://destination.example/landing" }) }),
    });
    const { id, url } = r.results.run;
    expect(id.error).toBeUndefined();
    expect(id.result.identity.ECID).toMatch(/^\d{38}$/);
    expect(id.result.edge).toEqual(recId.edge);
    expect(Object.keys(id.result)).toEqual(Object.keys(recId));
    const u = new URL(url.result.url);
    expect(u.origin + u.pathname).toBe("https://destination.example/landing");
    expect(Object.keys(url.result)).toEqual(Object.keys(recUrl));
    expect(u.searchParams.get("adobe_mc")).toMatch(/^TS=\d+\|MCMID/);
    expect(u.searchParams.get("adobe_mc")).toContain(`MCMID=${id.result.identity.ECID}`);
    expect(edgeCalls(r).map((n) => new URL(n.url).pathname)).toEqual(["/ee/v1/identity/acquire"]);
  }, T);

  it("S5 returning: nothing is sent, the stored ECID is the identity", async () => {
    const rec = (await loadFixture("s5-returning")).capture.steps.find((s) => s.step === "getIdentity").result;
    const r = await replayFixture(browser, "s5-returning", { skipSteps: true, run: (page) => call(page, "getIdentity", {}) });
    expect(r.results.run.result.identity.ECID).toBe(rec.identity.ECID);
    expect(r.results.run.result.edge).toEqual({});
    expect(edgeCalls(r)).toEqual([]);
  }, T);

  it("S3: applyResponse on a recorded body returns the stock-shaped result headless", async () => {
    const fixture = await loadFixture("s3-base");
    const body = JSON.parse(posts(fixture)[0].response_body);
    const event = { event: "page_view", xdm: { ...PV, eventMergeId: "airlock064-merge-1" } };
    const r = await replayFixture(browser, "s3-base", { event, run: (page) => call(page, "applyResponse", { renderDecisions: false, responseBody: body }) });
    expect(r.results.run.error).toBeUndefined();
    const recKeys = Object.keys(fixture.capture.steps.find((st) => st.step === "sendEvent").result);
    expect(Array.isArray(r.results.run.result.propositions)).toBe(true);
    for (const k of Object.keys(r.results.run.result)) expect(recKeys).toContain(k);
    expect(edgeCalls(r)).toHaveLength(1);
  }, T);

  it("SYNTHETIC differential vs stock 2.31.1: getLibraryInfo and createEventMergeId have the stock shape", async () => {
    const stock = await replayFixture(browser, "s3-base", {
      event: null,
      run: async (page) => page.evaluate(async () => {
        window.__alloyNS = ["stockAlloy"];
        window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
        window.stockAlloy.q = [];
        await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        window.stockAlloy("configure", { datastreamId: "12345678-1234-1234-1234-123456789012", orgId: "908936ED5D35CC220A495CD4@AdobeOrg", defaultConsent: "in", debugEnabled: false });
        return JSON.parse(JSON.stringify({ lib: await window.stockAlloy("getLibraryInfo"), merge: await window.stockAlloy("createEventMergeId") }));
      }),
    });
    const ours = await replayFixture(browser, "s3-base", {
      event: null,
      run: async (page) => ({ lib: await call(page, "getLibraryInfo", {}), merge: await call(page, "createEventMergeId", {}) }),
    });
    const s = stock.results.run;
    const o = ours.results.run;
    expect(o.lib.result.libraryInfo.version).toBe(s.lib.libraryInfo.version);
    expect(Object.keys(o.lib.result.libraryInfo)).toEqual(Object.keys(s.lib.libraryInfo));
    expect(Object.keys(o.merge.result)).toEqual(Object.keys(s.merge));
    expect(o.merge.result.eventMergeId).toMatch(UUID);
    expect(edgeCalls(ours)).toEqual([]);
  }, T);

  it("a name off the allowlist rejects with a plain Error and sends nothing", async () => {
    const r = await replayFixture(browser, "s5-returning", {
      skipSteps: true,
      run: async (page) => ({ a: await call(page, "sendEvent", { xdm: PV }), b: await call(page, "evaluateRulesets", {}), c: await page.evaluate(() => window.__handle.command("getIdentity", { cb() {} }).then(() => ({}), (e) => ({ error: { message: e.message, isTypeError: e instanceof TypeError } }))), d: await page.evaluate(() => window.__handle.command("getIdentity", { el: document.body }).then(() => ({}), (e) => ({ error: { message: e.message, isTypeError: e instanceof TypeError } }))) }),
    });
    for (const k of ["a", "b"]) {
      expect(r.results.run[k].error, k).toBeDefined();
      expect(r.results.run[k].error.isTypeError, k).toBe(false);
    }
    expect(r.results.run.a.error.message).toMatch(/sendEvent/);
    expect(r.results.run.c.error.isTypeError).toBe(false);
    expect(r.results.run.c.error.message).toMatch(/cannot cross/);
    expect(r.results.run.d.error.isTypeError).toBe(false);
    expect(r.results.run.d.error.message).toMatch(/options\.el/);
    expect(edgeCalls(r)).toEqual([]);
  }, T);

  it("concurrent calls settle independently and share one Alloy instance", async () => {
    const r = await replayFixture(browser, "s5-fresh", {
      skipSteps: true,
      run: (page) => page.evaluate(async () => {
        const h = window.__handle;
        const out = await Promise.allSettled([h.command("getIdentity"), h.command("getIdentity"), h.command("createEventMergeId"), h.command("getLibraryInfo"), h.command("sendEvent")]);
        return { statuses: out.map((x) => x.status), ecids: [out[0].value?.identity?.ECID, out[1].value?.identity?.ECID] };
      }),
    });
    expect(r.results.run.statuses).toEqual(["fulfilled", "fulfilled", "fulfilled", "fulfilled", "rejected"]);
    expect(r.results.run.ecids[0]).toMatch(/^\d{38}$/);
    expect(r.results.run.ecids[1]).toBe(r.results.run.ecids[0]);
    // the second request is Alloy's regional-endpoint retry, not a second instance; both are acquires
    expect(edgeCalls(r).every((n) => /\/identity\/acquire$/.test(new URL(n.url).pathname))).toBe(true);
  }, T);

  it("a command on a disposed handle rejects", async () => {
    const r = await replayFixture(browser, "s5-returning", {
      skipSteps: true,
      run: (page) => page.evaluate(async () => {
        await window.__handle.dispose();
        return window.__handle.command("getIdentity").then(() => "resolved", (e) => e.message);
      }),
    });
    expect(r.results.run).toMatch(/disposed/);
  }, T);

  // The outcome of each command after `ms`; applyResponse gets a recorded S3 body.
  const STATUS = `(async (run, ms, body) => {
    const out = {};
    const names = ["getIdentity", "appendIdentityToUrl", "getLibraryInfo", "createEventMergeId", "applyResponse"];
    const opts = { appendIdentityToUrl: { url: "https://destination.example/landing" }, applyResponse: { responseBody: body } };
    const calls = Object.fromEntries(names.map((n) => [n, run(n, opts[n] || {}).then(() => "resolved", (e) => "rejected:" + e.name)]));
    // only getIdentity can park, so the others are awaited without a timer and a slow runner cannot flip them to "pending"
    for (const n of names.filter((x) => x !== "getIdentity")) out[n] = await calls[n];
    out.getIdentity = await Promise.race([calls.getIdentity, new Promise((r) => setTimeout(() => r("pending"), ms))]);
    return out;
  })`;

  const stockStatus = (page, { defaultConsent, consent, body }) => page.evaluate(async ({ defaultConsent, consent, status, body }) => {
    window.__alloyNS = ["stockAlloy"];
    window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
    window.stockAlloy.q = [];
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    window.stockAlloy("configure", { datastreamId: "12345678-1234-1234-1234-123456789012", orgId: "908936ED5D35CC220A495CD4@AdobeOrg", defaultConsent, debugEnabled: false });
    if (consent) window.stockAlloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0", value: { general: consent } }] }).catch(() => {});
    return (0, eval)(status)((n, o) => window.stockAlloy(n, o), 1500, body);
  }, { defaultConsent, consent, status: STATUS, body });

  const ourStatus = (page, body) => page.evaluate(({ status, body }) => (0, eval)(status)((n, o) => window.__handle.command(n, o), 1500, body), { status: STATUS, body });

  // Edge answers replayed from the recordings, so a consent answer or an acquire resolves for stock and for the handle alike.
  const droppedHeaders = /^(content-encoding|content-length|set-cookie|date|server|via|strict-transport-security)$/i;
  const recordedAnswer = async (name, url) => {
    const rec = posts(await loadFixture(name)).find((r) => url.test(r.url));
    return { status: rec.status, headers: Object.fromEntries(Object.entries(rec.response_headers || {}).filter(([k]) => !droppedHeaders.test(k))), body: rec.response_body };
  };
  const edgeAnswers = async () => {
    const consent = await recordedAnswer("s6-in", /set-consent/);
    const acquire = await recordedAnswer("s5-fresh", /identity\/acquire/);
    return (req) => (/set-consent/.test(req.url()) ? consent : /identity\/acquire/.test(req.url()) ? acquire : null);
  };

  const s3Body = async () => JSON.parse(posts(await loadFixture("s3-base"))[0].response_body);
  const staleCookie = async () => ({ name: "kndctr_908936ED5D35CC220A495CD4_AdobeOrg_consent", value: "general=in", domain: new URL((await loadFixture("s5-fresh")).manifest.input_state.url).hostname });

  const SAME_AS_STOCK = [
    { state: "pending", stock: { defaultConsent: "pending" }, boot: { consent: { analytics_storage: "pending", personalization: "pending" } }, parked: true, requests: 0 },
    { state: "denied", stock: { defaultConsent: "pending", consent: "out" }, boot: { consent: { analytics_storage: "denied", personalization: "denied" } }, parked: false, requests: 1 },
    { state: "granted", stock: { defaultConsent: "pending", consent: "in" }, boot: { consent: { analytics_storage: "granted", personalization: "granted" } }, parked: false, requests: 1 },
    { state: "stale in cookie on a pending page", stock: { defaultConsent: "pending" }, boot: { consent: { analytics_storage: "pending", personalization: "pending" } }, cookie: true, parked: true, requests: 0 },
  ];

  it.each(SAME_AS_STOCK)("consent $state: each command settles or stays pending as stock Alloy does (SYNTHETIC differential)", async ({ stock: stockCfg, boot, cookie, parked, requests }) => {
    const respond = await edgeAnswers();
    const body = await s3Body();
    const extraCookies = cookie ? [await staleCookie()] : [];
    const stock = await replayFixture(browser, "s5-fresh", { skipSteps: true, event: null, respond, extraCookies, run: (page) => stockStatus(page, { ...stockCfg, body }) });
    const ours = await replayFixture(browser, "s5-fresh", { skipSteps: true, event: null, respond, extraCookies, bootOptions: boot, run: (page) => ourStatus(page, body) });
    // named explicitly, so an all-resolved run cannot pass vacuously
    expect(stock.results.run.getIdentity).toBe(parked ? "pending" : "resolved");
    expect(ours.results.run).toEqual(stock.results.run);
    expect(edgeCalls(ours)).toHaveLength(requests);
    expect(edgeCalls(stock)).toHaveLength(requests);
  }, T);

  it("no consent input (hold on, no vector): the labelled ADR-0062 hold difference, with a warning and a later command still settling", async () => {
    const respond = await edgeAnswers();
    const body = await s3Body();
    const stock = await replayFixture(browser, "s5-fresh", { skipSteps: true, event: null, respond, run: (page) => stockStatus(page, { defaultConsent: "in", body }) });
    const ours = await replayFixture(browser, "s5-fresh", { skipSteps: true, event: null, respond, bootOptions: { consentHold: null /* undoes the harness default of no hold */ }, run: (page) => ourStatus(page, body) });
    // stock has no hold: its default consent lets every command through and the identity is fetched
    expect(Object.values(stock.results.run).every((v) => v === "resolved")).toBe(true);
    // the handle parks only getIdentity, as it would a push, and tells the site why
    expect(ours.results.run).toEqual({ ...stock.results.run, getIdentity: "pending" });
    expect(edgeCalls(ours)).toEqual([]);
    expect(ours.diagnostics.filter((d) => d.kind === "consent" && d.disposition === "held" && /no consent input wired/.test(d.reason ?? ""))).toHaveLength(1);
  }, T);

  it("a command parked under pending consent stays pending, then resolves once consent is granted", async () => {
    const r = await replayFixture(browser, "s6-in", {
      event: null,
      bootOptions: { consentHold: null },
      skipSteps: true,
      run: async (page) => {
        await page.evaluate(() => { window.__held = window.__handle.command("getIdentity").then((x) => ({ ok: !!x.identity }), (e) => ({ err: e.message })); });
        const before = await page.evaluate(() => Promise.race([window.__held, new Promise((res) => setTimeout(() => res("pending"), 1000))]));
        await page.evaluate(() => window.__handle.setConsent({ analytics_storage: "granted", personalization: "granted" }));
        const after = await page.evaluate(() => window.__held);
        return { before, after };
      },
    });
    expect(r.results.run.before).toBe("pending");
    expect(r.results.run.after).toEqual({ ok: true });
  }, T);

  const DOM_ACTION_BODY = { requestId: "00000000-0000-0000-0000-000000000026", handle: [{ type: "personalization:decisions", payload: [{ id: "p26", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-26" }, characteristics: { scopeType: "view" } }, items: [{ id: "i26", schema: "https://ns.adobe.com/personalization/dom-action", data: { type: "setHtml", selector: "#z26", content: "<b>done</b>" } }] }] }] };

  it("applyResponse with renderDecisions:true renders through the 064-20 renderer; without it nothing renders (SYNTHETIC body)", async () => {
    const r = await replayFixture(browser, "s3-base", {
      event: null,
      bodyHtml: '<div id="z26">orig</div>',
      run: async (page) => {
        const headless = await call(page, "applyResponse", { responseBody: DOM_ACTION_BODY });
        const domA = await page.evaluate(() => document.getElementById("z26").innerHTML);
        const rendered = await call(page, "applyResponse", { responseBody: DOM_ACTION_BODY, renderDecisions: true });
        const domB = await page.evaluate(() => document.getElementById("z26").innerHTML);
        return { headless, domA, rendered, domB };
      },
    });
    const { headless, domA, rendered, domB } = r.results.run;
    expect(headless.error).toBeUndefined();
    expect(Array.isArray(headless.result.propositions)).toBe(true);
    expect(domA).toBe("orig");
    expect(rendered.error).toBeUndefined();
    expect(domB).toContain("done");
    expect(rendered.result.propositions[0].renderAttempted).toBe(true);
  }, T);

  // Reduces a value to its keys and types, so a stock result and ours compare without volatile ids and tokens.
  const SHAPE = `(function shape(v) {
    if (Array.isArray(v)) return v.map(shape);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape(v[k])]));
    return v === null ? "null" : typeof v;
  })`;

  const stockApplyResponse = (page, options) => page.evaluate(async ({ options, shape }) => {
    window.__alloyNS = ["stockAlloy"];
    window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
    window.stockAlloy.q = [];
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    window.stockAlloy("configure", { datastreamId: "12345678-1234-1234-1234-123456789012", orgId: "908936ED5D35CC220A495CD4@AdobeOrg", defaultConsent: "in", debugEnabled: false });
    const result = await window.stockAlloy("applyResponse", options);
    await new Promise((r) => setTimeout(r, 800));
    return { shape: (0, eval)(shape)(result), renderAttempted: result.propositions.map((p) => p.renderAttempted), dom: document.getElementById("z26")?.innerHTML ?? null };
  }, { options, shape: SHAPE });

  const ourApplyResponse = (page, options) => page.evaluate(async ({ options, shape }) => {
    const result = await window.__handle.command("applyResponse", options);
    return { shape: (0, eval)(shape)(result), renderAttempted: result.propositions.map((p) => p.renderAttempted), dom: document.getElementById("z26")?.innerHTML ?? null };
  }, { options, shape: SHAPE });

  it("SYNTHETIC differential vs stock 2.31.1: applyResponse on the recorded S3 body has stock's keys and types throughout", async () => {
    const body = await s3Body();
    const stock = await replayFixture(browser, "s3-base", { event: null, run: (page) => stockApplyResponse(page, { responseBody: body }) });
    const ours = await replayFixture(browser, "s3-base", { event: null, run: (page) => ourApplyResponse(page, { responseBody: body }) });
    expect(Object.keys(stock.results.run.shape)).toEqual(["decisions", "destinations", "propositions"]);
    expect(ours.results.run.shape).toEqual(stock.results.run.shape);
    expect(ours.results.run.renderAttempted).toEqual(stock.results.run.renderAttempted);
    expect(edgeCalls(ours)).toEqual([]);
    expect(edgeCalls(stock)).toEqual([]);
  }, T);

  it.each([
    ["with no personalization configured (the option is not even wired)", {}],
    ["with personalization configured, where the boot option is wired", { placements: [{ scope: "__view__", selector: "#v", minHeight: 0 }] }],
  ])("a boot-level renderDecisions:true does not change applyResponse %s: omitted renders nothing and sends nothing (SYNTHETIC body)", async (_label, extra) => {
    const html = '<div id="v"></div><div id="z26">orig</div>';
    const stock = await replayFixture(browser, "s3-base", { event: null, bodyHtml: html, run: (page) => stockApplyResponse(page, { responseBody: DOM_ACTION_BODY }) });
    const ours = await replayFixture(browser, "s3-base", { event: null, bodyHtml: html, bootOptions: { renderDecisions: true, ...extra }, run: (page) => ourApplyResponse(page, { responseBody: DOM_ACTION_BODY }) });
    expect(stock.results.run.dom).toBe("orig");
    expect(ours.results.run.dom).toBe("orig");
    expect(ours.results.run.renderAttempted).toEqual([false]);
    expect(ours.results.run.renderAttempted).toEqual(stock.results.run.renderAttempted);
    expect(edgeCalls(ours)).toEqual([]);
    expect(edgeCalls(stock)).toEqual([]);
  }, T);

  it("applyResponse with renderDecisions:true: two recorded gaps against stock: no display notification, and `decisions` keeps the rendered proposition", async () => {
    const stock = await replayFixture(browser, "s3-base", {
      event: null,
      bodyHtml: '<div id="z26">orig</div>',
      run: async (page) => {
        const notified = page.waitForRequest((req) => /propositionDisplay/.test(req.postData() || ""), { timeout: 10000 });
        const out = await stockApplyResponse(page, { responseBody: DOM_ACTION_BODY, renderDecisions: true });
        await notified;
        return out;
      },
    });
    const ours = await replayFixture(browser, "s3-base", { event: null, bodyHtml: '<div id="z26">orig</div>', run: (page) => ourApplyResponse(page, { responseBody: DOM_ACTION_BODY, renderDecisions: true }) });
    expect(stock.results.run.dom).toContain("done");
    expect(ours.results.run.dom).toContain("done");
    expect(Object.keys(ours.results.run.shape)).toEqual(Object.keys(stock.results.run.shape));
    expect(ours.results.run.shape.propositions).toEqual(stock.results.run.shape.propositions);
    // a second gap: stock drops a rendered proposition from `decisions`, the handle keeps it
    expect(stock.results.run.shape.decisions).toEqual([]);
    expect(ours.results.run.shape.decisions).toHaveLength(1);
    expect(edgeCalls(stock)).toHaveLength(1);
    expect(edgeCalls(stock)[0].body).toMatch(/decisioning\.propositionDisplay/);
    // the gap: the handle's renderer does not send the display notification stock sends
    expect(edgeCalls(ours)).toEqual([]);
  }, T);

  it("the production worker refuses a raw command message for an unlisted name or evaluateRulesets and never calls Alloy", async () => {
    const r = await replayFixture(browser, "s3-base", {
      event: null,
      run: async (page) => {
        await page.evaluate(() => window.__rigMessage("rig-spy"));
        const raw = (name) => page.evaluate((command) => new Promise((resolve) => {
          const id = "raw-" + command;
          const on = (e) => { if (e.data?.type === "command-result" && e.data.id === id) { window.__worker.removeEventListener("message", on); resolve(e.data); } };
          window.__worker.addEventListener("message", on);
          window.__worker.postMessage({ type: "command", id, command, options: {} });
        }), name);
        const answers = { sendEvent: await raw("sendEvent"), evaluateRulesets: await raw("evaluateRulesets"), bogus: await raw("bogus") };
        const callsAfterRefused = (await page.evaluate(() => window.__rigMessage("rig-spy-calls"))).result;
        const control = await raw("getLibraryInfo");
        const callsAfterControl = (await page.evaluate(() => window.__rigMessage("rig-spy-calls"))).result;
        return { answers, callsAfterRefused, control, callsAfterControl };
      },
    });
    const { answers, callsAfterRefused, control, callsAfterControl } = r.results.run;
    for (const a of Object.values(answers)) {
      expect(a.error).toBeDefined();
      expect(a.result).toBeUndefined();
    }
    expect(callsAfterRefused).toEqual([]);
    // positive control: the raw path does reach Alloy for an allowlisted name
    expect(control.error).toBeUndefined();
    expect(callsAfterControl).toEqual(["getLibraryInfo"]);
  }, T);

  it("an Alloy validation error crosses as a plain Error with stock's name and message", async () => {
    const stock = await replayFixture(browser, "s3-base", {
      event: null,
      run: (page) => page.evaluate(async () => {
        window.__alloyNS = ["stockAlloy"];
        window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
        window.stockAlloy.q = [];
        await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        window.stockAlloy("configure", { datastreamId: "12345678-1234-1234-1234-123456789012", orgId: "908936ED5D35CC220A495CD4@AdobeOrg", defaultConsent: "in", debugEnabled: false });
        return window.stockAlloy("appendIdentityToUrl", { url: 5 }).then(() => null, (e) => ({ name: e.name, message: e.message, code: e.code }));
      }),
    });
    const ours = await replayFixture(browser, "s3-base", { event: null, run: (page) => call(page, "appendIdentityToUrl", { url: 5 }) });
    expect(stock.results.run).not.toBeNull();
    expect(ours.results.run.error.code ?? null).toBe(stock.results.run.code ?? null);
    expect(ours.results.run.error.isTypeError).toBe(false);
    expect(ours.results.run.error.name).toBe(stock.results.run.name === "TypeError" ? "Error" : stock.results.run.name);
    // only the instance name in the prefix differs (`stockAlloy` here, `alloy` in the chamber)
    expect(ours.results.run.error.message.replace(/^\[alloy\]/, "")).toBe(stock.results.run.message.replace(/^\[stockAlloy\]/, ""));
  }, T);
});
