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

  it("a fatal load error rejects calls waiting for boot and in flight, with a plain Error", async () => {
    const w = fakeWorker();
    const { command } = createHostCommandEntry({ worker: w, renderer: rendererStub() });
    const waiting = command("getIdentity");
    w.emit("message", { type: "fatal", phase: "load", message: "bundle" });
    const e = await waiting.then(() => null, (x) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(TypeError);
    expect(e.message).toMatch(/lost/);
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

  const call = (page, name, options) => page.evaluate(({ name, options }) => window.__handle.command(name, options).then((result) => ({ result }), (e) => ({ error: { name: e.name, message: e.message, isTypeError: e instanceof TypeError } })), { name, options });

  it("S5 fresh: getIdentity and appendIdentityToUrl match the recording, with the one acquire", async () => {
    const recId = (await loadFixture("s5-fresh")).capture.steps.find((s) => s.step === "getIdentity").result;
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
    expect(r.results.run.result).toBeTypeOf("object");
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
      run: async (page) => ({ a: await call(page, "sendEvent", { xdm: PV }), b: await call(page, "evaluateRulesets", {}), c: await page.evaluate(() => window.__handle.command("getIdentity", { cb() {}, el: document.body }).then(() => ({}), (e) => ({ error: { message: e.message, isTypeError: e instanceof TypeError } }))) }),
    });
    for (const k of ["a", "b"]) {
      expect(r.results.run[k].error, k).toBeDefined();
      expect(r.results.run[k].error.isTypeError, k).toBe(false);
    }
    expect(r.results.run.a.error.message).toMatch(/sendEvent/);
    expect(r.results.run.c.error.isTypeError).toBe(false);
    expect(r.results.run.c.error.message).toMatch(/cannot cross/);
    expect(edgeCalls(r)).toEqual([]);
  }, T);

  it("concurrent calls settle independently", async () => {
    const r = await replayFixture(browser, "s5-returning", {
      skipSteps: true,
      run: (page) => page.evaluate(async () => {
        const h = window.__handle;
        const out = await Promise.allSettled([h.command("getIdentity"), h.command("createEventMergeId"), h.command("getLibraryInfo"), h.command("sendEvent")]);
        return out.map((x) => x.status);
      }),
    });
    expect(r.results.run).toEqual(["fulfilled", "fulfilled", "fulfilled", "rejected"]);
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

  // The outcome of each command after `ms`, plus the settled value once the consent answer arrives.
  const STATUS = `(async (run, ms) => {
    const out = {};
    const names = ["getIdentity", "appendIdentityToUrl", "getLibraryInfo", "createEventMergeId"];
    const opts = { appendIdentityToUrl: { url: "https://destination.example/landing" } };
    await Promise.all(names.map(async (n) => {
      const p = run(n, opts[n] || {}).then(() => "resolved", (e) => "rejected:" + e.name);
      out[n] = await Promise.race([p, new Promise((r) => setTimeout(() => r("pending"), ms))]);
    }));
    return out;
  })`;

  const stockStatus = (page, consent) => page.evaluate(async ({ consent, status }) => {
    window.__alloyNS = ["stockAlloy"];
    window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
    window.stockAlloy.q = [];
    await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    window.stockAlloy("configure", { datastreamId: "12345678-1234-1234-1234-123456789012", orgId: "908936ED5D35CC220A495CD4@AdobeOrg", defaultConsent: "pending", debugEnabled: false });
    if (consent) window.stockAlloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0", value: { general: consent } }] }).catch(() => {});
    return (0, eval)(status)((n, o) => window.stockAlloy(n, o), 1500);
  }, { consent, status: STATUS });

  const ourStatus = (page) => page.evaluate(({ status }) => (0, eval)(status)((n, o) => window.__handle.command(n, o), 1500), { status: STATUS });

  it("pending consent: each command settles or stays pending as stock Alloy does (SYNTHETIC differential)", async () => {
    const stock = await replayFixture(browser, "s3-base", { event: null, run: (page) => stockStatus(page, null) });
    const ours = await replayFixture(browser, "s3-base", { event: null, bootOptions: { consentHold: null }, run: (page) => ourStatus(page) });
    // the held command is named explicitly, so an all-resolved run cannot pass vacuously
    expect(stock.results.run.getIdentity).toBe("pending");
    expect(ours.results.run).toEqual(stock.results.run);
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

  it("applyResponse with renderDecisions:true renders through the 064-20 renderer; without it nothing renders (SYNTHETIC body)", async () => {
    const body = { requestId: "00000000-0000-0000-0000-000000000026", handle: [{ type: "personalization:decisions", payload: [{ id: "p26", scope: "__view__", scopeDetails: { decisionProvider: "TGT", activity: { id: "act-26" }, characteristics: { scopeType: "view" } }, items: [{ id: "i26", schema: "https://ns.adobe.com/personalization/dom-action", data: { type: "setHtml", selector: "#z26", content: "<b>done</b>" } }] }] }] };
    const r = await replayFixture(browser, "s3-base", {
      event: null,
      bodyHtml: '<div id="z26">orig</div>',
      run: async (page) => {
        const headless = await call(page, "applyResponse", { responseBody: body });
        const domA = await page.evaluate(() => document.getElementById("z26").innerHTML);
        const rendered = await call(page, "applyResponse", { responseBody: body, renderDecisions: true });
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
    expect(ours.results.run.error.isTypeError).toBe(false);
    expect(ours.results.run.error.name).toBe(stock.results.run.name === "TypeError" ? "Error" : stock.results.run.name);
    // only the instance name in the prefix differs (`stockAlloy` here, `alloy` in the chamber)
    expect(ours.results.run.error.message.replace(/^\[alloy\]/, "")).toBe(stock.results.run.message.replace(/^\[stockAlloy\]/, ""));
  }, T);
});
