import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootAlloy } from "../adapters/eds/index.js";

// Slice 067-10 — the credentials denylist at the wrapped-SDK seam, through the real boot
// path (bootAlloy -> createWrappedSdkHost -> egress) with a self-reacting chamber Worker that
// emits the interact body under test. Honest boundary (ADR-0012): renamed fields and
// value-level PII in a benign-named field are out of a field-name denylist's reach.
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const DS = "12345678-1234-1234-1234-123456789012";
const entry = (extra = {}) => ({ type: "alloy", bundleUrl: "https://airlock.example/alloy.js", datastreamId: DS, orgId: "ORG@AdobeOrg", consentHold: false, ...extra });
let nextBody;

class BodyWorker {
  constructor() { this.handlers = []; BodyWorker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() {}
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  postMessage(m) {
    if (m.type === "init") setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    else if (m.type === "event") setTimeout(() => this.emit({ type: "intercepted-fetch", id: "s1", url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body: nextBody }), 0);
    else if (m.type === "intercepted-fetch-response") setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
  }
}

const wait = async (pred) => { for (let i = 0; i < 200 && !pred(); i++) await new Promise((r) => setTimeout(r, 5)); if (!pred()) throw new Error("timeout"); };

async function run(body, opts = {}) {
  nextBody = body;
  const diags = [];
  const h = await bootAlloy(entry({ ...opts, onDiagnostic: (d) => diags.push(d) }));
  h.push({ event: "page_view", page_location: "https://site/p" });
  await wait(() => globalThis.fetch.mock.calls.length >= 1);
  return { sent: globalThis.fetch.mock.calls[0][1].body, diags: diags.filter((d) => d.kind === "payload-governance") };
}

describe("067-10 seam input governance (wire level, bootAlloy)", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", BodyWorker);
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" })));
  });
  afterEach(() => vi.unstubAllGlobals());

  const dirty = () => JSON.stringify({
    events: [{ xdm: { eventType: "x", password: "p1" }, data: { cvv: "123", ok: 1 }, query: { personalization: { surfaces: ["s"] }, ssn: "9" } }],
    meta: { cc_number: "4111", keep: true },
    query: { identity: { fetch: ["ECID"] }, passwd: "z" },
  });

  it("AC1/AC6: strips credentials from xdm, data, query and meta by default, one warn per field, never the value", async () => {
    const { sent, diags } = await run(dirty());
    const b = JSON.parse(sent);
    expect(b.events[0].xdm).toEqual({ eventType: "x" });
    expect(b.events[0].data).toEqual({ ok: 1 });
    expect(b.events[0].query.ssn).toBeUndefined();
    expect(b.meta).toEqual({ keep: true });
    expect(b.query).toEqual({ identity: { fetch: ["ECID"] } });
    const fields = diags.filter((d) => d.disposition === "stripped").map((d) => d.field).sort();
    expect(fields).toEqual(["cc_number", "cvv", "passwd", "password", "ssn"]); // once each, no double-strip
    expect(JSON.stringify(diags)).not.toMatch(/p1|4111|123/);
  });

  it("AC2/AC5: a stock body with no credential fields dispatches byte-identical", async () => {
    const clean = JSON.stringify({ events: [{ xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { URL: "https://site/p" } } } }], query: { identity: { fetch: ["ECID"] } }, meta: { a: 1 } });
    const { sent, diags } = await run(clean);
    expect(sent).toBe(clean);
    expect(diags).toEqual([]);
  });

  it("AC3: an unparseable body passes through with one error diagnostic and no throw", async () => {
    const { sent, diags } = await run("not-json{{");
    expect(sent).toBe("not-json{{");
    expect(diags).toEqual([{ level: "error", kind: "payload-governance", disposition: "skipped", reason: "unparseable-body" }]);
  });

  it("AC4: payloadDenylist extends; override false is its own state; override array replaces", async () => {
    const ext = await run(JSON.stringify({ events: [{ xdm: { password: "a", email: "e" } }] }), { payloadDenylist: ["email"] });
    expect(JSON.parse(ext.sent).events[0].xdm).toEqual({});
    globalThis.fetch.mockClear();
    const off = await run(dirty(), { payloadDenylistOverride: false });
    expect(off.sent).toBe(dirty());
    expect(off.diags.filter((d) => d.disposition === "stripped")).toEqual([]);
    expect(off.diags.filter((d) => d.disposition === "denylist-overridden")).toHaveLength(1);
    globalThis.fetch.mockClear();
    const rep = await run(dirty(), { payloadDenylistOverride: ["cvv"] });
    const b = JSON.parse(rep.sent);
    expect(b.events[0].data).toEqual({ ok: 1 });
    expect(b.events[0].xdm.password).toBe("p1");
  });
});
