// Config-boot alloy — spec 033-02 (the analytics vertical). `boot({ connectors:
// [{ type: "alloy", bundleUrl, … }] })` boots Adobe/alloy through the wrapped-SDK
// path: bootAlloy constructs airlock's CLASSIC alloy chamber Worker (adopter-owns the
// Worker), loads the ADOPTER-SUPPLIED stock bundle via `bundleUrl` (ADR-0016), wires
// core/wrapped-sdk-host.js, and returns a COMPOSITE-COMPATIBLE handle. Behavioral
// tests over a FakeWorker (mirrors test/eds-boot-config.test.js) — the real-Worker +
// real-bundle browser boot is the deploy/creds-gated residual (slice § Residual);
// rig/alloy-csp.mjs proves the CSP-load mechanism.
//
//   AC2 — bootAlloy: Worker construction (classic, adopter-owned + torn down),
//         caps wiring, a composite-compatible handle, push serialized through the
//         host's single-slot driveEvent.
//   AC3 — {type:"alloy"} dispatch in boot(config): KNOWN_CONNECTOR_TYPES, entry
//         validation (bundleUrl required), the strict consent seam gate, and the
//         composite fan-out gate (alloy sees page_view only).
//   AC6 — end-to-end: boot alloy from a config → drive page_view → the intercepted
//         interact is dispatched via the seam (+ ECID write-back); a SECOND page_view
//         ALSO reaches the seam (witnesses the AC2 host extension — no hang on #2).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { boot, bootAlloy } from "../adapters/eds/index.js";
import { reservePersonalization } from "../adapters/eds/reserve-personalization.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));

const BUNDLE_URL = "https://airlock.example/scripts/airlock/vendor/alloy.js";
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const ECID = "07430525002133203327640620273122850896";
const DATASTREAM_ID = "12345678-1234-1234-1234-123456789012"; // the honest, host-pinned datastream (configId)
const ATTACKER_DS = "99999999-9999-9999-9999-999999999999"; // a re-tenant attacker's datastream
const alloyEntry = (extra = {}) => ({ type: "alloy", bundleUrl: BUNDLE_URL, datastreamId: DATASTREAM_ID, orgId: "ORG@AdobeOrg", ...extra });

// The interact URL the (round-trip) chamber emits. Default (null) is the HONEST interact —
// the real Edge routes by `configId` (013-03), so it carries `?configId=<the configured
// datastreamId>`. A security test overrides this to model a re-tenant (attacker configId)
// or an off-floor destination; reset to null (honest) in each RoundTrip describe's beforeEach.
let interactUrlFor = null;

// A plain recording Worker: records postMessage + lets the test emit() chamber
// messages (mirrors test/wrapped-sdk-host.test.js's makeFakeChamber, in Worker shape).
class RecordingWorker {
  constructor(url, opts) {
    RecordingWorker.instances.push(this);
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.handlers = [];
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  addEventListener(type, fn) { if (type === "message") this.handlers.push(fn); }
  removeEventListener(type, fn) { this.handlers = this.handlers.filter((h) => h !== fn); }
  terminate() { this.terminated++; }
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
}
RecordingWorker.instances = [];

// A self-reacting chamber Worker for the AC6 round-trip: init→configured; each event
// →intercepted-fetch(interact); on the host's response→cookie-writeback(ECID)+result.
// Each hop is scheduled on a macrotask so the host's async caps.egress.dispatch settles.
class RoundTripAlloyWorker {
  constructor(url, opts) {
    RoundTripAlloyWorker.instances.push(this);
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.handlers = [];
    this.terminated = 0;
    this.seq = 0;
  }
  addEventListener(type, fn) { if (type === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() { this.terminated++; }
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") {
      this.datastreamId = (m.config && m.config.datastreamId) || null; // the chamber's configured datastream
      setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    } else if (m.type === "event") {
      const id = "af-" + (++this.seq);
      const body = JSON.stringify({ events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }], query: { identity: { fetch: ["ECID"] } } });
      // Honest interact carries the configured datastream as ?configId (013-03: the Edge routes
      // by configId); a security test overrides interactUrlFor to model a re-tenant / off-floor URL.
      const url = interactUrlFor ? interactUrlFor(this.datastreamId) : `${INTERACT}?configId=${this.datastreamId}`;
      setTimeout(() => this.emit({ type: "intercepted-fetch", id, url, method: "POST", headers: { "content-type": "application/json" }, body }), 0);
    } else if (m.type === "intercepted-fetch-response") {
      setTimeout(() => {
        this.emit({ type: "cookie-writeback", value: `AMCV_TEST@AdobeOrg=MCMID|${ECID}; Domain=airlock.example; Path=/; Secure; SameSite=None` });
        this.emit({ type: "result", summary: { booted: true }, ready: [] });
      }, 0);
    }
  }
}
RoundTripAlloyWorker.instances = [];

// 033-03: a self-reacting chamber Worker that, on a SUCCESSFUL interact (status 200),
// emits a `{type:"decisions"}` message carrying a __view__ Target proposition as DATA
// (the real chamber's `granted.decisions.deliver` path) BEFORE `result` — then the host
// applies it host-side via reserveSpace (the worker touches no DOM). On a HELD interact
// (status 0 — the consent/config-integrity/ceiling seam bit), it emits NO decisions
// (all-or-nothing, AC6).
const DECISION_HTML = '<div class="airlock-hero" style="height:180px">Personalized above the fold</div>';
class DecisionsAlloyWorker {
  constructor(url, opts) {
    DecisionsAlloyWorker.instances.push(this);
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.handlers = [];
    this.terminated = 0;
    this.seq = 0;
    this.proposition = {
      id: "AT:airlock-1",
      scope: "__view__",
      scopeDetails: { decisionProvider: "TGT", activity: { id: "act-1" }, experience: { id: "exp-0" } },
      items: [{ id: "i1", schema: "https://ns.adobe.com/personalization/html-content-item", data: { format: "text/html", content: DECISION_HTML } }],
    };
  }
  addEventListener(type, fn) { if (type === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() { this.terminated++; }
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") {
      this.datastreamId = (m.config && m.config.datastreamId) || null;
      setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    } else if (m.type === "event") {
      const id = "af-" + (++this.seq);
      const body = JSON.stringify({ events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }] });
      const url = interactUrlFor ? interactUrlFor(this.datastreamId) : `${INTERACT}?configId=${this.datastreamId}`;
      setTimeout(() => this.emit({ type: "intercepted-fetch", id, url, method: "POST", headers: {}, body }), 0);
    } else if (m.type === "intercepted-fetch-response") {
      setTimeout(() => {
        // A SUCCESSFUL interact → alloy returned Target propositions as DATA (renderDecisions:false),
        // which the chamber posts as `{type:"decisions"}`. A HELD interact (status 0) → nothing.
        if (m.status === 200) this.emit({ type: "decisions", decisions: [{ scope: "__view__", content: this.proposition }] });
        this.emit({ type: "result", summary: { booted: true }, ready: [] });
      }, 0);
    }
  }
}
DecisionsAlloyWorker.instances = [];

const alloyWorker = () => RecordingWorker.instances.find((w) => w.url.includes("alloy-chamber.worker.js"));

// A fake document driving the real reserveSpace sizing path (no DOM in node/vitest).
function makeReserveDoc({ present = true } = {}) {
  const el = { style: {}, _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; } };
  return { el, querySelector: () => (present ? el : null) };
}
const initOf = (w) => w.messages.find((m) => m.type === "init");
const eventsOf = (w) => w.messages.filter((m) => m.type === "event");

const waitFor = async (pred, { timeout = 1000, interval = 5 } = {}) => {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, interval));
  }
};

describe("boot(config) — AC2: bootAlloy owns a classic chamber Worker + a composite-compatible handle", () => {
  beforeEach(() => {
    RecordingWorker.instances = [];
    vi.stubGlobal("Worker", RecordingWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("constructs a CLASSIC alloy chamber Worker (NOT { type: 'module' }) at the sibling specifier", async () => {
    await boot({ connectors: [alloyEntry()] });
    const w = alloyWorker();
    expect(w).toBeTruthy();
    expect(w.url).toMatch(/alloy-chamber\.worker\.js$/); // the same-origin sibling
    expect(w.opts).toBeUndefined(); // classic worker — NO { type: "module" } (importScripts route)
  });

  it("posts init with the ADOPTER-SUPPLIED bundleUrl + the alloy config (ADR-0016)", async () => {
    await boot({ connectors: [alloyEntry()] });
    const init = initOf(alloyWorker());
    expect(init).toBeTruthy();
    expect(init.bundleUrl).toBe(BUNDLE_URL);
    expect(init.config).toMatchObject({ datastreamId: DATASTREAM_ID, orgId: "ORG@AdobeOrg" });
  });

  it("returns a composite-compatible handle (push / pushCritical / setConsent / getState / dispose)", async () => {
    const handle = await bootAlloy(alloyEntry());
    for (const m of ["push", "pushCritical", "setConsent", "getState", "dispose"]) {
      expect(typeof handle[m]).toBe("function");
    }
  });

  it("dispose() terminates the owned Worker (021-01 no-leak) and is idempotent", async () => {
    const handle = await bootAlloy(alloyEntry());
    const w = alloyWorker();
    handle.dispose();
    handle.dispose(); // idempotent
    expect(w.terminated).toBe(1);
  });

  it("serializes push through the host's single-slot driveEvent — the second event waits for the first (no re-entry throw)", async () => {
    const handle = await bootAlloy(alloyEntry());
    const w = alloyWorker();
    w.emit({ type: "phase", name: "configured" });

    handle.push({ event: "page_view", page_location: "https://site/a" });
    handle.push({ event: "page_view", page_location: "https://site/b" });

    // Event #1 posts; #2 is queued behind it in the sequential chain (not posted until #1 resolves).
    await waitFor(() => eventsOf(w).length >= 1);
    expect(eventsOf(w).length).toBe(1);
    w.emit({ type: "result", summary: {}, ready: [] }); // settle #1
    await waitFor(() => eventsOf(w).length >= 2);
    expect(eventsOf(w).length).toBe(2); // #2 dispatched only after #1 settled — serialized, no hang
  });

  it("maps a composite site event to the chamber descriptor { type, params } the alloy connector reads", async () => {
    const handle = await bootAlloy(alloyEntry());
    const w = alloyWorker();
    w.emit({ type: "phase", name: "configured" });
    handle.push({ event: "page_view", page_location: "https://site/x", page_title: "X" });
    await waitFor(() => eventsOf(w).length >= 1);
    expect(eventsOf(w)[0].event).toEqual({ type: "page_view", params: { page_location: "https://site/x", page_title: "X" } });
  });
});

describe("boot(config) — AC3: {type:'alloy'} dispatch, validation, consent + fan-out gate", () => {
  beforeEach(() => {
    RecordingWorker.instances = [];
    vi.stubGlobal("Worker", RecordingWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("boots alloy and installs the composite on window.airlock", async () => {
    const handle = await boot({ connectors: [alloyEntry()] });
    expect(handle).toBe(window.airlock);
    expect(alloyWorker()).toBeTruthy();
  });

  it("a MISSING bundleUrl rejects loud + actionable (the ADR-0016 prerequisite), naming the connector", async () => {
    await expect(boot({ connectors: [{ type: "alloy", datastreamId: DATASTREAM_ID }] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*bundleUrl/i);
  });

  it("a MISSING datastream id rejects — alloy can't configure() AND config-integrity needs it to pin the tenant", async () => {
    await expect(boot({ connectors: [{ type: "alloy", bundleUrl: BUNDLE_URL, orgId: "ORG@AdobeOrg" }] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*datastream/i);
  });

  it("accepts the datastream alias (datastream / edgeConfigId) in place of datastreamId", async () => {
    await expect(boot({ connectors: [{ type: "alloy", bundleUrl: BUNDLE_URL, datastream: DATASTREAM_ID }] })).resolves.toBeTruthy();
  });

  it("the composite fan-out gate delivers page_view to alloy but NOT an arbitrary site event", async () => {
    await boot({ connectors: [alloyEntry()] });
    const w = alloyWorker();
    w.emit({ type: "phase", name: "configured" });

    window.airlock.push({ event: "newsletter_signup" }); // NOT in alloy's vocabulary (["page_view"])
    window.airlock.push({ event: "page_view", page_location: "https://site/p" });

    await waitFor(() => eventsOf(w).length >= 1);
    const crossed = eventsOf(w).map((m) => m.event.type);
    expect(crossed).toContain("page_view");
    expect(crossed).not.toContain("newsletter_signup"); // no arbitrary site event leaks to the Edge interact
  });

  it("a partial-boot: a malformed LATER alloy entry tears down an earlier connector (no orphan, no window install)", async () => {
    await expect(boot({ connectors: [alloyEntry(), { type: "alloy", datastreamId: "no-bundle" }] }))
      .rejects.toThrow(/connectors\[1\].*bundleUrl/i);
    expect(alloyWorker().terminated).toBe(1); // the first alloy Worker was disposed on the reject path
    expect(typeof window.airlock).toBe("undefined");
  });
});

describe("boot(config) — AC3/AC6: the strict consent seam gate holds a denied interact", () => {
  beforeEach(() => {
    RoundTripAlloyWorker.instances = [];
    interactUrlFor = null; // honest interact (?configId=<datastreamId>)
    vi.stubGlobal("Worker", RoundTripAlloyWorker);
    vi.stubGlobal("window", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a DENIED governing purpose HOLDS the interact — zero real egress (fetch never called)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await boot({ connectors: [alloyEntry()], consent: { analytics_storage: "denied", personalization: "granted" } });
    window.airlock.push({ event: "page_view", page_location: "https://site/held" });

    // Deterministic: wait for the strict seam gate to register the HOLD, then confirm it dropped
    // BEFORE caps.egress.dispatch (fetch never called) — not a fixed sleep.
    await waitFor(() => window.airlock.getState().consentHeld >= 1);
    expect(fetchMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ALL governing purposes granted lets the interact reach the seam (fetch called)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);

    await boot({ connectors: [alloyEntry()], consent: { analytics_storage: "granted", personalization: "granted" } });
    window.airlock.push({ event: "page_view", page_location: "https://site/ok" });

    await waitFor(() => fetchMock.mock.calls.length >= 1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${INTERACT}?configId=${DATASTREAM_ID}`);
  });
});

describe("boot(config) — AC3 (security): the config-integrity + endpoint-ceiling seam gates are wired", () => {
  // The seam MUST bite even though ADR-0016 permits a cross-origin/untrusted adopter bundle: a
  // compromised bundle can re-`configure` alloy or craft its own interact fetch. config-integrity
  // pins the TENANT (configId == the configured datastreamId — 013-03 confirmed the live Edge
  // routes by it); the endpoint-ceiling pins the grounded interact FLOOR (016-02 AC3/AC5).
  beforeEach(() => {
    RoundTripAlloyWorker.instances = [];
    interactUrlFor = null;
    vi.stubGlobal("Worker", RoundTripAlloyWorker);
    vi.stubGlobal("window", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a RE-TENANT interact (attacker configId on the pinned host) is HELD by config-integrity — zero real egress", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);
    interactUrlFor = () => `${INTERACT}?configId=${ATTACKER_DS}`; // re-tenant to an attacker's Adobe org

    await boot({ connectors: [alloyEntry()] });
    window.airlock.push({ event: "page_view", page_location: "https://site/retenant" });

    await waitFor(() => window.airlock.getState().held >= 1); // config-integrity HOLD (not ceiling, not consent)
    expect(fetchMock).not.toHaveBeenCalled(); // the re-tenant attack never reached the network
    expect(window.airlock.getState().held).toBe(1);
    expect(window.airlock.getState().ceilingHeld).toBe(0);
  });

  it("an OFF-FLOOR destination (a foreign host/path) is HELD by the endpoint-ceiling — zero real egress", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);
    interactUrlFor = () => `https://evil.example/collect?configId=${DATASTREAM_ID}`; // honest tenant, foreign host

    await boot({ connectors: [alloyEntry()] });
    window.airlock.push({ event: "page_view", page_location: "https://site/offfloor" });

    await waitFor(() => window.airlock.getState().ceilingHeld >= 1); // endpoint-ceiling HOLD
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.airlock.getState().ceilingHeld).toBe(1);
  });

  it("regression: the HONEST interact (grounded floor + pinned tenant) still dispatches with both caps wired", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);

    await boot({ connectors: [alloyEntry()] });
    window.airlock.push({ event: "page_view", page_location: "https://site/honest" });

    await waitFor(() => fetchMock.mock.calls.length >= 1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${INTERACT}?configId=${DATASTREAM_ID}`);
    expect(window.airlock.getState().held).toBe(0);
    expect(window.airlock.getState().ceilingHeld).toBe(0);
  });
});

describe("boot(config) — AC6: end-to-end boot → page_view → interact dispatched via the seam + ECID write-back, and a SECOND page_view too", () => {
  let cookieWrites;
  beforeEach(() => {
    RoundTripAlloyWorker.instances = [];
    interactUrlFor = null; // honest interact (?configId=<datastreamId>)
    cookieWrites = [];
    vi.stubGlobal("Worker", RoundTripAlloyWorker);
    vi.stubGlobal("window", {});
    // A cookie jar sink so the ECID write-back (caps.cookies.reconcile) is observable.
    vi.stubGlobal("document", { get cookie() { return ""; }, set cookie(v) { cookieWrites.push(v); } });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => JSON.stringify({ handle: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("drives page_view → the interact is dispatched via the seam, and the ECID write-back reconciles into the jar", async () => {
    await boot({ connectors: [alloyEntry()] }); // no consent wired -> gate off (back-compat)
    window.airlock.push({ event: "page_view", page_location: "https://site/1" });

    await waitFor(() => globalThis.fetch.mock.calls.length >= 1);
    expect(String(globalThis.fetch.mock.calls[0][0])).toBe(`${INTERACT}?configId=${DATASTREAM_ID}`); // intercepted interact reached the seam
    // ECID write-back reconciled (Domain/Secure/SameSite dropped) into the real jar.
    await waitFor(() => cookieWrites.length >= 1);
    const written = cookieWrites[cookieWrites.length - 1];
    expect(written).toContain(`MCMID|${ECID}`);
    expect(written).not.toMatch(/domain=/i);
    expect(written).not.toMatch(/secure/i);
  });

  it("a SECOND page_view ALSO reaches the seam — the AC2 host extension, no hang on event #2", async () => {
    await boot({ connectors: [alloyEntry()] });
    window.airlock.push({ event: "page_view", page_location: "https://site/1" });
    await waitFor(() => globalThis.fetch.mock.calls.length >= 1);

    window.airlock.push({ event: "page_view", page_location: "https://site/2" }); // the soft-nav case
    await waitFor(() => globalThis.fetch.mock.calls.length >= 2); // would hang pre-033-02 (event #2 never dispatched)
    expect(globalThis.fetch.mock.calls.length).toBe(2);
  });
});

describe("boot(config) — AC5: the alloy GOLDEN config fixture boots through the config surface", () => {
  beforeEach(() => {
    RecordingWorker.instances = [];
    vi.stubGlobal("Worker", RecordingWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("boots alloy from the pristine contracts golden JSON (bundleUrl + datastreamId + orgId)", async () => {
    const golden = JSON.parse(readFileSync(join(REPO, "contracts/fixtures/instrumentation-config-alloy.golden.json"), "utf8"));
    const handle = await boot(golden);
    expect(handle).toBe(window.airlock);
    const w = alloyWorker();
    expect(w).toBeTruthy();
    const init = initOf(w);
    expect(init.bundleUrl).toBe(golden.connectors[0].bundleUrl);
    expect(init.config).toMatchObject({ datastreamId: golden.connectors[0].datastreamId, orgId: golden.connectors[0].orgId });
  });
});

// ---- spec 033-03: personalization / decisions-as-data → reserveSpace ----
const alloyEntryWithPlacement = (extra = {}) =>
  alloyEntry({ placements: [{ scope: "__view__", selector: "#hero", minHeight: 300, prehide: true }], ...extra });

describe("boot(config) — AC5: single __view__ placement; a non-__view__ scope is rejected (multi-scope deferred)", () => {
  beforeEach(() => {
    RecordingWorker.instances = [];
    vi.stubGlobal("Worker", RecordingWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a single __view__ placement", async () => {
    await expect(boot({ connectors: [alloyEntryWithPlacement()] })).resolves.toBeTruthy();
  });

  it("REJECTS a non-__view__ placement scope with a clear multi-scope-follow-on message, naming the connector", async () => {
    await expect(boot({ connectors: [alloyEntry({ placements: [{ scope: "products", selector: "#p", minHeight: 100 }] })] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*(__view__|multi-scope|follow-on)/i);
  });

  it("REJECTS a placement missing its selector", async () => {
    await expect(boot({ connectors: [alloyEntry({ placements: [{ scope: "__view__", minHeight: 100 }] })] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*selector/i);
  });

  it("REJECTS a placement with a MISSING minHeight (schema-parity — else reserveSpace NaN-rejects and silently no-ops)", async () => {
    await expect(boot({ connectors: [alloyEntry({ placements: [{ scope: "__view__", selector: "#hero" }] })] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*minHeight/i);
  });

  it("REJECTS a placement with a NON-numeric minHeight", async () => {
    await expect(boot({ connectors: [alloyEntry({ placements: [{ scope: "__view__", selector: "#hero", minHeight: "tall" }] })] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*minHeight/i);
  });

  it("REJECTS a placements field that is not an array", async () => {
    await expect(boot({ connectors: [alloyEntry({ placements: { scope: "__view__" } })] }))
      .rejects.toThrow(/connectors\[0\].*alloy.*placements.*array/i);
  });
});

describe("boot(config) — AC3: bootAlloy fills the eagerly-reserved box + reports the exposure", () => {
  beforeEach(() => {
    DecisionsAlloyWorker.instances = [];
    interactUrlFor = null; // honest interact
    vi.stubGlobal("Worker", DecisionsAlloyWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => JSON.stringify({ handle: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fills the HANDED-OFF reserved box via reserveSpace's handle.fill(html) — never a raw write, worker touches no DOM", async () => {
    const fillSpy = vi.fn();
    const reservedPlacements = { __view__: Promise.resolve({ id: "r1", fill: fillSpy, release() {} }) };
    const pushSpy = vi.fn(() => 1); // a composite that delivered the exposure to 1 analytics connector
    window.airlock = { push: pushSpy };

    const h = await bootAlloy(alloyEntryWithPlacement({ reservedPlacements }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => fillSpy.mock.calls.length >= 1);
    expect(fillSpy).toHaveBeenCalledWith(DECISION_HTML); // the pre-reserved box, filled with the decision html
    void h;
  });

  it("reports a proposition_display exposure (scope + proposition_id + activity/experience) through the composite", async () => {
    const reservedPlacements = { __view__: Promise.resolve({ id: "r1", fill() {}, release() {} }) };
    const pushSpy = vi.fn(() => 1);
    window.airlock = { push: pushSpy };

    await bootAlloy(alloyEntryWithPlacement({ reservedPlacements })).then((h) => h.push({ event: "page_view", page_location: "https://site/x" }));

    await waitFor(() => pushSpy.mock.calls.length >= 1);
    expect(pushSpy.mock.calls[0][0]).toMatchObject({ event: "proposition_display", scope: "__view__", proposition_id: "AT:airlock-1", activity_id: "act-1", experience_id: "exp-0" });
  });

  it("a decision with NO handed-off handle is DROPPED + diagnosed (never lazily reserved — the flicker invariant), never thrown", async () => {
    const diags = [];
    window.airlock = { push: vi.fn(() => 1) };
    // The mis-wire case (AC3): a PLACEMENT is CONFIGURED, but the loader skipped/mis-wired the
    // eager reservePersonalization — so decisions are expected, yet no handle was handed off.
    const h = await bootAlloy(alloyEntryWithPlacement({ onDiagnostic: (r) => diags.push(r) }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => diags.some((d) => d.kind === "decisions" && d.disposition === "dropped"));
    const drop = diags.find((d) => d.kind === "decisions" && d.disposition === "dropped");
    expect(drop.reason).toMatch(/no reserved placement/i);
    expect(String(h)).toBeTruthy(); // did not throw
  });

  it("analytics-only alloy (NO placements) IGNORES {type:decisions} — NO diagnostic (033-02 byte-parity, arch #3)", async () => {
    const diags = [];
    window.airlock = { push: vi.fn(() => 1) };
    // No placements AND no reservedPlacements: personalization is not configured, so the host
    // must IGNORE {type:decisions} exactly as 033-02 did — NOT wire caps.decisions and emit a
    // per-decision drop warn (which would break the "analytics-only alloy byte-unchanged" claim).
    const h = await bootAlloy(alloyEntry({ onDiagnostic: (r) => diags.push(r) }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => globalThis.fetch.mock.calls.length >= 1); // interact 200 -> chamber posts {type:decisions}
    await new Promise((r) => setTimeout(r, 30)); // let the decisions message settle
    expect(diags.some((d) => d.kind === "decisions")).toBe(false); // host ignored it — no drop diagnostic
  });

  it("a reserved handle that REJECTED (selector matched nothing at reserve time) is dropped + diagnosed, never thrown", async () => {
    const diags = [];
    window.airlock = { push: vi.fn(() => 1) };
    const reservedPlacements = { __view__: Promise.reject(new Error("reserveSpace: selector matched nothing: #hero")) };
    reservedPlacements.__view__.catch(() => {}); // pre-handle so the test env sees no unhandled rejection
    const h = await bootAlloy(alloyEntryWithPlacement({ reservedPlacements, onDiagnostic: (r) => diags.push(r) }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => diags.some((d) => d.kind === "decisions" && d.disposition === "dropped"));
    expect(diags.find((d) => d.kind === "decisions").reason).toMatch(/matched nothing|rejected/i);
  });
});

describe("boot(config) — AC4: exposure routes to the analytics sink, NOT alloy (no loop)", () => {
  beforeEach(() => {
    DecisionsAlloyWorker.instances = [];
    RecordingWorker.instances = [];
    interactUrlFor = null;
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => JSON.stringify({ handle: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("composite.push RETURNS the fan-out count: page_view -> 1 (alloy accepts), proposition_display -> 0 (alloy ignores, no loop)", async () => {
    vi.stubGlobal("Worker", RecordingWorker);
    await boot({ connectors: [alloyEntry()] });
    alloyWorker().emit({ type: "phase", name: "configured" });

    expect(window.airlock.push({ event: "page_view", page_location: "https://site/x" })).toBe(1);
    // alloy's vocabulary is ["page_view"], so a proposition_display exposure is NOT delivered to
    // alloy (no second interact / no proposition loop) — and in an alloy-only boot it lands nowhere.
    expect(window.airlock.push({ event: "proposition_display", scope: "__view__", proposition_id: "p1" })).toBe(0);
  });

  it("window.airlock ABSENT (standalone bootAlloy) — the DISPLAY still fills, the exposure is dropped + diagnosed, never thrown", async () => {
    vi.stubGlobal("Worker", DecisionsAlloyWorker);
    const diags = [];
    const fillSpy = vi.fn();
    const reservedPlacements = { __view__: Promise.resolve({ id: "r1", fill: fillSpy, release() {} }) };
    // window has no .airlock (standalone bootAlloy never installOnWindow).
    const h = await bootAlloy(alloyEntryWithPlacement({ reservedPlacements, onDiagnostic: (r) => diags.push(r) }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => fillSpy.mock.calls.length >= 1); // the DISPLAY still works
    await waitFor(() => diags.some((d) => d.disposition === "exposure-dropped"));
    expect(diags.find((d) => d.disposition === "exposure-dropped").reason).toMatch(/absent or push-less|no analytics sink/i);
  });

  it("alloy-only composite (delivered to 0) — the exposure is dropped + diagnosed (documented limitation)", async () => {
    vi.stubGlobal("Worker", DecisionsAlloyWorker);
    const diags = [];
    const reservedPlacements = { __view__: Promise.resolve({ id: "r1", fill() {}, release() {} }) };
    window.airlock = { push: () => 0 }; // a composite that accepted the exposure NOWHERE (no ["*"] sink)
    const h = await bootAlloy(alloyEntryWithPlacement({ reservedPlacements, onDiagnostic: (r) => diags.push(r) }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => diags.some((d) => d.disposition === "exposure-dropped"));
    expect(diags.find((d) => d.disposition === "exposure-dropped").reason).toMatch(/no analytics.*sink|alloy-only/i);
  });
});

describe("boot(config) — AC6: consent all-or-nothing (personalization denied HOLDS the whole interact)", () => {
  beforeEach(() => {
    DecisionsAlloyWorker.instances = [];
    interactUrlFor = null;
    vi.stubGlobal("Worker", DecisionsAlloyWorker);
    vi.stubGlobal("window", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("personalization DENIED -> no interact (fetch never called) -> no fill, no proposition_display (inherited 020-02 strict gate)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => JSON.stringify({ handle: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fillSpy = vi.fn();
    const pushSpy = vi.fn(() => 1);
    const reservedPlacements = { __view__: Promise.resolve({ id: "r1", fill: fillSpy, release() {} }) };
    window.airlock = { push: pushSpy };

    const h = await bootAlloy(alloyEntryWithPlacement({ reservedPlacements, consent: { analytics_storage: "granted", personalization: "denied" } }));
    h.push({ event: "page_view", page_location: "https://site/held" });

    await waitFor(() => h.getState().consentHeld >= 1); // the strict gate HELD the whole interact
    expect(fetchMock).not.toHaveBeenCalled(); // no real egress at all
    // let the (held) round-trip settle — the worker emits NO decisions on a status:0 held interact.
    await new Promise((r) => setTimeout(r, 30));
    expect(fillSpy).not.toHaveBeenCalled(); // no decisions -> no fill (personalization got nothing)
    expect(pushSpy).not.toHaveBeenCalled(); // and no proposition_display exposure either
    warnSpy.mockRestore();
  });
});

describe("boot(config) — AC7: end-to-end two-phase (eager reserve -> lazy fill -> exposure captured by a GA4-vocab sink)", () => {
  beforeEach(() => {
    DecisionsAlloyWorker.instances = [];
    interactUrlFor = null;
    vi.stubGlobal("Worker", DecisionsAlloyWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => JSON.stringify({ handle: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reservePersonalization (eager) sizes the box before 'appear', then bootAlloy fills it + a GA4-vocab sink captures proposition_display (alloy ignores it)", async () => {
    // PHASE 1 (eager, pre-paint): the REAL reservePersonalization sizes the box synchronously.
    const doc = makeReserveDoc();
    const config = { connectors: [alloyEntryWithPlacement()] };
    const { reservedPlacements } = reservePersonalization(config, { document: doc });
    const appearMark = doc.el.style.minHeight; // captured "at appear" — the reserve already happened
    expect(appearMark).toBe("300px"); // reserved BEFORE appear (the no-flicker order)

    // A faithful composite stand-in: alloy vocab (["page_view"]) IGNORES proposition_display;
    // a GA4 vocab (["*"]) CAPTURES it. (The real createComposite gate is covered by the fan-out
    // tests above + the GA4 ["*"] catch-all; the full browser geometry/CWV proof is rig/alloy-decisions.)
    const ga4Captured = [];
    const fanout = [
      { events: ["page_view"], push: () => {} }, // alloy: ignores proposition_display
      { events: ["*"], push: (e) => ga4Captured.push(e) }, // GA4: catch-all, captures
    ];
    const accepts = (voc, name) => voc.includes("*") || voc.includes(name);
    window.airlock = { push: (evt) => { let n = 0; for (const c of fanout) if (accepts(c.events, evt.event)) { c.push(evt); n++; } return n; } };

    // PHASE 2 (lazy): bootAlloy with the handed-off reservedPlacements, drive page_view.
    const filled = [];
    reservedPlacements.__view__ = reservedPlacements.__view__.then((hnd) => ({ ...hnd, fill: (html) => filled.push(html) }));
    const h = await bootAlloy(alloyEntryWithPlacement({ reservedPlacements }));
    h.push({ event: "page_view", page_location: "https://site/x" });

    await waitFor(() => filled.length >= 1);
    expect(filled[0]).toBe(DECISION_HTML); // the box filled with the decision (reserve -> fill, same box)
    await waitFor(() => ga4Captured.length >= 1);
    expect(ga4Captured[0]).toMatchObject({ event: "proposition_display", scope: "__view__" }); // GA4 captured
  });
});
