import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncBuiltinESMExports } from "node:module";

// Missing exports still reach the defined assertions: import failure alone is not RED.
const { checkStockWire, runWireCli } = await import("../probes/adobe-compatibility/stock-wire-check.mjs")
  .catch(() => ({}));
const SCRIPT = "probes/adobe-compatibility/stock-wire-check.mjs";
const SCHEMAS = ["default-content-item", "html-content-item", "json-content-item",
  "redirect-item", "ruleset-item", "message/in-app", "message/content-card"]
  .map(s => `https://ns.adobe.com/personalization/${s}`);
const CLAIMS = Object.fromEntries(["actual_dispatch_verified", "sdk_execution_verified",
  "host_render_verified", "chamber_compatibility_verified", "downstream_receipt_verified",
  "full_wire_conformance_verified"].map(k => [k, false]));
const CHECKS = ["routing", "consent", "collection", "notifications", "order"];
const COUNTS = ["requests", "consent_updates", "fetch_events", "page_events",
  "custom_events", "display_events", "interaction_events"];
const SECRETS = ["SENTINEL", "invented-stream", "fixture.scope", "invented-page",
  "invented-custom", "https://fixture.invalid/", "invented-proposition", "invented-activity"];
const dirs = [];

function fixture(name = "positive") {
  const expected = { datastream_id: "invented-stream", decision_scope: "fixture.scope",
    page_name: "invented-page", custom_name: "invented-custom", page_url: "https://fixture.invalid/" };
  const proposition = { id: "invented-proposition", scope: expected.decision_scope,
    scopeDetails: { decisionProvider: "TGT", activity: { id: "invented-activity" },
      characteristics: [{ value: "invented" }] } };
  const consent = { consent: [{ standard: "Adobe", version: "2.0", value: {
    collect: { val: name === "no-consent" ? "n" : "y" },
    personalize: { content: { val: name === "no-consent" ? "n" : "y" } },
    marketing: { any: { val: "n" }, preferred: "email" }, share: { val: "n" },
  } }] };
  const fetch = { xdm: { eventType: "decisioning.propositionFetch",
    web: { webPageDetails: { URL: expected.page_url } } },
  query: { personalization: { schemas: [...SCHEMAS],
    decisionScopes: [expected.decision_scope], surfaces: [] } } };
  const page = { xdm: { eventType: "web.webpagedetails.pageViews",
    web: { webPageDetails: { name: expected.page_name, URL: expected.page_url, pageViews: { value: 1 } } } },
  data: { __adobe: { analytics: { pageName: expected.page_name, pageURL: expected.page_url } } } };
  const custom = { xdm: { eventType: "web.webinteraction.linkClicks",
    web: { webInteraction: { name: expected.custom_name, type: "other", linkClicks: { value: 1 },
      URL: expected.page_url } } },
  data: { __adobe: { analytics: { linkType: "o", linkName: expected.custom_name } } } };
  const interact = { xdm: { eventType: "decisioning.propositionInteract" } };
  const notification = flag => ({ decisioning: { propositions: [structuredClone(proposition)],
    propositionEventType: { [flag]: 1 } } });
  if (name === "positive") {
    page.xdm._experience = notification("display");
    interact.xdm._experience = notification("interact");
  }
  const request = (path, body) => ({ path: `/ee/v1/${path}`, config_id: expected.datastream_id, body });
  return { kind: "airlock.adobe-stock.wire-capture", schema_version: 1, sdk_pin: "alloy-2.31.1",
    case: name, expected, host: { rendered: name === "positive", clicked: name !== "no-consent" },
    proposition: ["positive", "non-render"].includes(name) ? proposition : null,
    requests: [request("privacy/set-consent", consent), ...(name === "no-consent" ? [] : [
      request("interact", { query: { identity: { fetch: ["ECID"] } }, events: [fetch] }),
      request("collect", { events: [page] }), request("collect", { events: [custom] }),
      ...(name === "positive" ? [request("interact", { events: [interact] })] : []),
    ])] };
}
const event = (v, index) => v.requests[index].body.events[0];
const analytics = (v, index) => event(v, index).data.__adobe.analytics;
const decision = (v, index) => event(v, index).xdm._experience.decisioning;

function assertPublic(r, frozenReport = true) {
  expect(Object.keys(r)).toEqual(["kind", "schema_version", "case", "overall", "exit_code",
    "checks", "counts", "claims"]);
  expect(r.kind).toBe("airlock.adobe-stock.wire-report");
  expect(r.schema_version).toBe(1);
  expect(r.claims).toEqual(CLAIMS);
  expect(Object.keys(r.checks)).toEqual(CHECKS);
  expect(Object.values(r.checks).every(v => ["passed", "failed", "not_exercised"].includes(v))).toBe(true);
  expect(Object.keys(r.counts)).toEqual(COUNTS);
  expect(Object.values(r.counts).every(n => Number.isInteger(n) && n >= 0)).toBe(true);
  function frozen(v) {
    if (v && typeof v === "object") {
      expect(Object.isFrozen(v)).toBe(true);
      Object.values(v).forEach(frozen);
    }
  }
  if (frozenReport) frozen(r);
  SECRETS.forEach(s => expect(JSON.stringify(r)).not.toContain(s));
}
function check(v, exit = 0, category) {
  expect(checkStockWire).toBeTypeOf("function");
  const r = checkStockWire(v);
  assertPublic(r);
  expect(r.exit_code).toBe(exit);
  expect(r.overall).toBe(["capture_checks_passed", "capture_checks_failed", "invalid_input",
    "internal_failure"][exit]);
  if (category) expect(r.checks[category]).toBe("failed");
  return r;
}
async function privateFile(content, mode = 0o600) {
  const dir = await mkdtemp(join(tmpdir(), "wire-SENTINEL-"));
  dirs.push(dir);
  const path = join(dir, "SENTINEL.json");
  await writeFile(path, content, { mode });
  return path;
}
function cli(argv) {
  return spawnSync(process.execPath, [SCRIPT, ...argv], { encoding: "utf8", env: {}, timeout: 5000 });
}
function cliResult(p, exit, overall) {
  expect(p.status).toBe(exit);
  expect(p.stderr).toBe(exit ? `${overall}\n` : "");
  expect(p.stdout.trim().split("\n")).toHaveLength(1);
  const r = JSON.parse(p.stdout);
  expect(r).toMatchObject({ exit_code: exit, overall, claims: CLAIMS });
  expect(Object.keys(r.counts)).toEqual(COUNTS);
  SECRETS.forEach(s => expect(p.stdout + p.stderr).not.toContain(s));
  return r;
}
afterEach(async () => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  await Promise.all(dirs.splice(0).map(p => rm(p, { recursive: true, force: true })));
});

describe("051-07 AC1 closed local CLI and private file boundary", () => {
  it("exports the pure and CLI seams and runs actual owner-only JSON", async () => {
    expect(runWireCli).toBeTypeOf("function");
    const path = await privateFile(JSON.stringify(fixture()));
    const r = cliResult(cli(["--input", path]), 0, "capture_checks_passed");
    expect(r.counts).toEqual({ requests: 5, consent_updates: 1, fetch_events: 1,
      page_events: 1, custom_events: 1, display_events: 1, interaction_events: 1 });
  });
  it.each([[], ["--input"], ["SENTINEL"], ["--input", ""], ["--input=SENTINEL"],
    ["constructor", "SENTINEL"], ["toString", "SENTINEL"], ["__proto__", "SENTINEL"],
    ["--help", "--input", "/SENTINEL"], ["--input", "/SENTINEL", "--input", "/SENTINEL"],
    ["--input", "--help"], ["--env", "SENTINEL"], ["--output", "SENTINEL"],
    ["--url", "https://SENTINEL/"], ["--credential-file", "/SENTINEL"],
  ].map(v => [v]))("refuses invocation %j without echo", argv => {
    const r = cliResult(cli(argv), 2, "invalid_invocation");
    expect(r.case).toBe("invalid");
    expect(Object.values(r.counts)).toEqual(COUNTS.map(() => 0));
  });
  it("help and import have no file/env/browser/network seams; actual CLI entry is guarded", () => {
    const boot = `
      import fs from 'node:fs';
      import fsp from 'node:fs/promises';
      import http from 'node:http'; import https from 'node:https';
      import net from 'node:net'; import dns from 'node:dns';
      let violations = 0;
      const refuse = () => { violations++; throw new Error('SENTINEL'); };
      process.on('exit', () => { if (violations) process.exitCode = 99; });
      const read = fsp.readFile;
      fsp.readFile = (...args) => {
        if (new Error().stack.includes('at getSource (node:internal/modules/esm/load:') &&
            /\\/(stock-wire-check|contract)\\.mjs$/.test(String(args[0]))) return read(...args);
        return refuse();
      };
      for (const key of ['open', 'lstat', 'writeFile']) fsp[key] = refuse;
      for (const key of ['readFileSync', 'open', 'openSync', 'writeFile']) fs[key] = refuse;
      for (const mod of [http, https]) { mod.request = refuse; mod.get = refuse; }
      net.connect = refuse; net.createConnection = refuse; dns.lookup = refuse;
      globalThis.fetch = refuse; globalThis.window = new Proxy({}, {get: refuse});
      const env = process.env;
      process.env = new Proxy(env, {get: (o,k) => /ADOBE|AIRLOCK|CREDENTIAL|SECRET/.test(String(k)) ? refuse() : o[k]});
      process.argv = [process.execPath, '/SENTINEL', '--input', '/SENTINEL'];
      const m = await import('./${SCRIPT}');
      if (typeof m.checkStockWire !== 'function') throw new Error('missing seam');
      process.exitCode = await m.runWireCli({argv: ['--help'], stdout: process.stdout, stderr: process.stderr});
    `;
    const p = spawnSync(process.execPath, ["--input-type=module", "--eval", boot],
      { encoding: "utf8", env: {}, timeout: 5000 });
    expect(p.status, p.stderr).toBe(0);
    expect(p.stderr).toBe("");
    expect(p.stdout.trim().split("\n")).toHaveLength(1);
    expect(p.stdout).toContain("--input");
    expect(p.stdout).toContain("--help");
    expect(p.stdout).not.toContain("SENTINEL");
    expect(cli(["--help"]).status).toBe(0);
  });
  it.each(["public", "symlink", "directory", "missing"])("refuses %s file explicitly", async kind => {
    let path = await privateFile(JSON.stringify(fixture()));
    if (kind === "public") await chmod(path, 0o644);
    if (kind === "symlink") { const alias = `${path}.link`; await symlink(path, alias); path = alias; }
    if (kind === "directory") path = join(path, "..");
    if (kind === "missing") path += ".missing";
    const r = cliResult(cli(["--input", path]), 2, "invalid_input");
    expect(Object.values(r.counts).every(n => n === 0)).toBe(true);
  });
  it.each([
    ["duplicate", '{"kind":"a","\\u006bind":"b"}'],
    ["prototype", '{"constructor":"SENTINEL"}'],
    ["malformed", '{"SENTINEL":'],
    ["overflow number", '{"number":1e999}'],
    ["invalid UTF8", Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x3a, 0x31, 0x7d])],
    ["oversize", " ".repeat(262145)],
    ["depth", '{"a":'.repeat(17) + "0" + "}".repeat(17)],
    ["not object", "[]"],
  ])("refuses private %s content without raw errors", async (_label, content) => {
    cliResult(cli(["--input", await privateFile(content)]), 2, "invalid_input");
  });
});

describe("051-07 AC2 exact payload, routing and returned references", () => {
  it("validates payload semantics, keeps originals intact and freezes only the report", () => {
    const v = fixture(), before = structuredClone(v);
    const r = check(v);
    expect(Object.values(r.checks)).toEqual(CHECKS.map(() => "passed"));
    expect(v).toEqual(before);
    expect(Object.isFrozen(v)).toBe(false);
    v.proposition.id = "SENTINEL";
    expect(r.claims).toEqual(CLAIMS);
  });
  const mutations = [
    ["foreign datastream", "routing", v => { v.requests[1].config_id = "SENTINEL"; }],
    ["foreign path", "routing", v => { v.requests[1].path = "/SENTINEL"; }],
    ...["/ee/v2/interact", "/ee/v1/%69nteract", "/ee/xx/v1/interact", "/ee/v1/interact/extra",
      "https://SENTINEL/ee/v1/interact", "/ee/v1/collect?x=1"].map(path =>
      [path, "routing", v => { v.requests[1].path = path; }]),
    ["consent collection route", "routing", v => { v.requests[0].path = "/ee/v1/collect"; }],
    ["collection privacy route", "routing", v => { v.requests[1].path = "/ee/v1/privacy/set-consent"; }],
    ["wrong fetch type", "collection", v => { event(v, 1).xdm.eventType = "SENTINEL"; }],
    ["wrong page type", "collection", v => { event(v, 2).xdm.eventType = "web.webPageDetails.pageViews"; }],
    ["wrong page URL", "collection", v => { event(v, 2).xdm.web.webPageDetails.URL = "https://SENTINEL/"; }],
    ["wrong fetch URL", "collection", v => { event(v, 1).xdm.web.webPageDetails.URL = "https://SENTINEL/"; }],
    ["wrong page name", "collection", v => { event(v, 2).xdm.web.webPageDetails.name = "SENTINEL"; }],
    ["wrong page counter", "collection", v => { event(v, 2).xdm.web.webPageDetails.pageViews.value = 2; }],
    ["string page counter", "collection", v => { event(v, 2).xdm.web.webPageDetails.pageViews.value = "1"; }],
    ["wrong data pageURL", "collection", v => { analytics(v, 2).pageURL = "SENTINEL"; }],
    ["wrong data pageName", "collection", v => { analytics(v, 2).pageName = "SENTINEL"; }],
    ["page with link", "collection", v => { analytics(v, 2).linkName = "SENTINEL"; }],
    ["custom XDM name", "collection", v => { event(v, 3).xdm.web.webInteraction.name = "SENTINEL"; }],
    ["custom XDM type", "collection", v => { event(v, 3).xdm.web.webInteraction.type = "download"; }],
    ["custom counter", "collection", v => { event(v, 3).xdm.web.webInteraction.linkClicks.value = 0; }],
    ["custom link type", "collection", v => { analytics(v, 3).linkType = "other"; }],
    ["custom link name", "collection", v => { analytics(v, 3).linkName = "SENTINEL"; }],
    ["custom page mapping", "collection", v => { analytics(v, 3).pageName = "SENTINEL"; }],
    ["INTERACT Analytics", "collection", v => { event(v, 4).data = structuredClone(event(v, 3).data); }],
    ["fetch Analytics", "collection", v => { event(v, 1).data = structuredClone(event(v, 2).data); }],
    ...[1, 4].flatMap(i => [
      [`stray page counter ${i}`, "collection", v => {
        event(v, i).xdm.web = { webPageDetails: { URL: v.expected.page_url, pageViews: { value: 1 } } };
      }],
      [`stray link counter ${i}`, "collection", v => {
        event(v, i).xdm.web = { webPageDetails: { URL: v.expected.page_url }, webInteraction: { linkClicks: { value: 1 } } };
      }],
      ...[null, 1, []].map(value => [`malformed data ${i} ${JSON.stringify(value)}`, "collection",
        v => { event(v, i).data = value; }]),
      [`malformed Analytics ${i}`, "collection", v => { event(v, i).data = {__adobe: {analytics: []}}; }],
      [`malformed __adobe ${i}`, "collection", v => { event(v, i).data = {__adobe: null}; }],
      [`malformed experience ${i}`, "collection", v => { event(v, i).xdm._experience = []; }],
    ]),
    ["missing XDM", "collection", v => { delete event(v, 3).xdm; }],
    ["empty events", "collection", v => { v.requests[3].body.events = []; }],
    ["extra unknown event", "collection", v => { v.requests[3].body.events.push({ xdm: { eventType: "SENTINEL" } }); }],
    ["wrong scope", "collection", v => { event(v, 1).query.personalization.decisionScopes = ["SENTINEL"]; }],
    ["extra scope", "collection", v => { event(v, 1).query.personalization.decisionScopes.push("SENTINEL"); }],
    ["foreign surface", "collection", v => { event(v, 1).query.personalization.surfaces = ["web://SENTINEL"]; }],
    ["wrong schema order", "collection", v => { event(v, 1).query.personalization.schemas.reverse(); }],
    ["missing schema", "collection", v => { event(v, 1).query.personalization.schemas.pop(); }],
    ["extra selector", "collection", v => { event(v, 1).query.personalization.enabled = true; }],
    ["extra fetch query", "collection", v => { event(v, 1).query.extra = {}; }],
    ...[2, 3, 4].map(i => [`event query ${i}`, "collection", v => { event(v, i).query = { personalization: { viewName: "SENTINEL" } }; }]),
    ["body personalization", "collection", v => { v.requests[1].body.query.personalization = { decisionScopes: ["SENTINEL"] }; }],
    ["foreign identity fetch", "collection", v => { v.requests[1].body.query.identity.fetch.push("SENTINEL"); }],
    ["body extra identity", "collection", v => { v.requests[1].body.query.identity.namespace = "SENTINEL"; }],
    ...["configOverrides", "edgeConfigOverrides", "sdkConfig"].map(key =>
      [key, "routing", v => { v.requests[2].body.meta = { nested: [{ [key]: {} }] }; }]),
    ["display flag string", "notifications", v => { decision(v, 2).propositionEventType.display = "1"; }],
    ["display flag zero", "notifications", v => { decision(v, 2).propositionEventType.display = 0; }],
    ["mixed flags", "notifications", v => { decision(v, 2).propositionEventType.interact = 1; }],
    ["extra notification flag", "notifications", v => { decision(v, 4).propositionEventType.dismiss = 1; }],
    ["extra reference", "notifications", v => { decision(v, 2).propositions.push(structuredClone(v.proposition)); }],
    ["returned id", "notifications", v => { v.proposition.id = "SENTINEL"; }],
    ["returned scope", "notifications", v => { v.proposition.scope = "SENTINEL"; }],
    ["provider", "notifications", v => { v.proposition.scopeDetails.decisionProvider = "AJO"; }],
    ["reference details", "notifications", v => { decision(v, 4).propositions[0].scopeDetails.activity.id = "SENTINEL"; }],
    ["reference scope", "notifications", v => { decision(v, 2).propositions[0].scope = "SENTINEL"; }],
    ["custom native notification", "notifications", v => { event(v, 3).xdm._experience = structuredClone(event(v, 2).xdm._experience); }],
    ["fetch native notification", "notifications", v => { event(v, 1).xdm._experience = structuredClone(event(v, 2).xdm._experience); }],
    ["unrendered positive", "notifications", v => { v.host.rendered = false; }],
    ["unclicked positive", "notifications", v => { v.host.clicked = false; }],
  ];
  it.each(mutations)("rejects %s with fixed %s category", (_label, category, mutate) => {
    const v = fixture(); mutate(v); check(v, 1, category);
  });
  it.each(["or2", "va6", "irl1", "ind1", "jpn3", "sgp3", "aus3"])("accepts documented %s path only", region => {
    const v = fixture(); v.requests.forEach(r => { r.path = r.path.replace("/ee/v1/", `/ee/${region}/v1/`); });
    check(v);
  });
  it("allows bounded additive SDK facts and structurally reordered returned scopeDetails", () => {
    const v = fixture();
    v.requests[2].body.meta = { state: { invented: ["fact", 42, null] } };
    event(v, 2).xdm.timestamp = "invented-time";
    decision(v, 4).propositions[0].scopeDetails = {
      characteristics: [{ value: "invented" }], activity: { id: "invented-activity" }, decisionProvider: "TGT",
    };
    check(v);
  });
});

describe("051-07 AC3 no-offer/non-render/no-consent recorded facts", () => {
  it.each(["no-offer", "non-render", "no-consent"])("checks actual %s CLI and pure semantics", async name => {
    const v = fixture(name), r = check(v);
    expect(r.counts).toEqual({ requests: name === "no-consent" ? 1 : 4, consent_updates: 1,
      fetch_events: name === "no-consent" ? 0 : 1, page_events: name === "no-consent" ? 0 : 1,
      custom_events: name === "no-consent" ? 0 : 1, display_events: 0, interaction_events: 0 });
    cliResult(cli(["--input", await privateFile(JSON.stringify(v))]), 0, "capture_checks_passed");
  });
  it("no-consent can have zero requests but denies all independent enforcement/provenance claims", () => {
    const v = fixture("no-consent"); v.requests = [];
    const r = check(v);
    expect(r.checks.consent).toBe("not_exercised");
    expect(r.checks.collection).toBe("not_exercised");
    expect(r.checks.order).toBe("not_exercised");
  });
  it.each([
    ["no-offer", v => { v.proposition = fixture().proposition; }],
    ["non-render", v => { v.proposition = null; }],
    ["non-render", v => { v.host.rendered = true; }],
    ["no-offer", v => { v.host.clicked = false; }],
    ["no-consent", v => { v.host.clicked = true; }],
    ["no-consent", v => { v.proposition = fixture().proposition; }],
    ["no-consent", v => { v.requests.push(fixture().requests[1]); }],
    ["no-consent", v => { v.requests.push(structuredClone(v.requests[0])); }],
    ["no-consent", v => { v.requests[0].body.consent[0].value.collect.val = "y"; }],
    ["no-offer", v => { event(v, 2).xdm._experience = event(fixture(), 2).xdm._experience; }],
    ["non-render", v => { v.requests.push(fixture().requests[4]); }],
  ])("rejects contradictory %s record", (name, mutate) => {
    const v = fixture(name); mutate(v); check(v, 1);
  });
});

describe("051-07 AC4 ordering, duplicates, retries and actual content", () => {
  it.each([
    ["grant after fetch", "order", v => { [v.requests[0], v.requests[1]] = [v.requests[1], v.requests[0]]; }],
    ["page before fetch", "order", v => { [v.requests[1], v.requests[2]] = [v.requests[2], v.requests[1]]; }],
    ["custom before fetch", "order", v => { [v.requests[1], v.requests[3]] = [v.requests[3], v.requests[1]]; }],
    ["interaction before fetch", "order", v => { [v.requests[1], v.requests[4]] = [v.requests[4], v.requests[1]]; }],
    ["duplicate grant", "consent", v => { v.requests.unshift(structuredClone(v.requests[0])); }],
    ["duplicate consent object", "consent", v => { v.requests[0].body.consent.push(structuredClone(v.requests[0].body.consent[0])); }],
    ["deny positive", "consent", v => { v.requests[0].body.consent[0].value.personalize.content.val = "n"; }],
    ["share grant", "consent", v => { v.requests[0].body.consent[0].value.share.val = "y"; }],
    ["marketing grant", "consent", v => { v.requests[0].body.consent[0].value.marketing.any.val = "y"; }],
    ["consent wrong version", "consent", v => { v.requests[0].body.consent[0].version = "1.0"; }],
    ["consent includes events", "consent", v => { v.requests[0].body.events = [event(v, 1)]; }],
    ["collection includes consent", "consent", v => { v.requests[1].body.consent = v.requests[0].body.consent; }],
    ["missing grant", "consent", v => { v.requests.shift(); }],
    ...[1, 2, 3, 4].map(i => [`retry event ${i}`, "collection", v => { v.requests.push(structuredClone(v.requests[i])); }]),
    ["extra same-request page", "collection", v => { v.requests[2].body.events.push(structuredClone(event(v, 2))); }],
    ["five events", "collection", v => { v.requests[3].body.events = Array.from({length: 5}, () => structuredClone(event(v, 3))); }],
  ])("fails %s", (_label, category, mutate) => {
    const v = fixture(); mutate(v); check(v, 1, category);
  });
  it("respects array order inside a batched request, not just request counts", () => {
    const v = fixture();
    v.requests[1].body.events.push(event(v, 2), event(v, 3), event(v, 4));
    v.requests.splice(2);
    check(v);
    v.requests[1].body.events.reverse();
    check(v, 1, "order");
  });
  it("count-only and caller success assertions never replace closed payloads", () => {
    check({ counts: { page_events: 1 }, success: true }, 2);
    const v = fixture(); v.success = true; check(v, 2);
  });
});

describe("051-07 AC5 safe pure traversal, exact failures, bounds and redaction", () => {
  it.each([
    ["null", () => null], ["array", () => []],
    ["wrong schema", v => { v.schema_version = "1"; return v; }],
    ["wrong pin", v => { v.sdk_pin = "SENTINEL"; return v; }],
    ["unknown case", v => { v.case = "constructor"; return v; }],
    ["extra host key", v => { v.host.actual_dispatch_verified = true; return v; }],
    ["missing expected", v => { delete v.expected.page_name; return v; }],
    ["same labels", v => { v.expected.custom_name = v.expected.page_name; return v; }],
    ["control label", v => { v.expected.page_name = "a\nb"; return v; }],
    ["overlong id", v => { v.proposition.id = "a".repeat(251); return v; }],
    ["foreign scope grammar", v => { v.expected.decision_scope = "a/b"; return v; }],
    ["global scope", v => { v.expected.decision_scope = "target-global-mbox"; return v; }],
    ...["http://fixture.invalid/", "https://u:p@fixture.invalid/", "https://fixture.invalid/#a",
      "https://FIXTURE.invalid/", "https://fixture.invalid", "https://fixture.invalid:443/"].map(url =>
      [url, v => { v.expected.page_url = url; return v; }]),
    ["too many requests", v => { v.requests = Array.from({length: 9}, () => v.requests[0]); return v; }],
    ["extra request key", v => { v.requests[0].method = "POST"; return v; }],
    ["Date", v => { v.requests[1].body.additive = new Date(); return v; }],
    ["NaN", v => { v.requests[1].body.additive = NaN; return v; }],
    ["Infinity", v => { v.requests[1].body.additive = Infinity; return v; }],
    ["undefined", v => { v.requests[1].body.additive = undefined; return v; }],
    ["BigInt", v => { v.requests[1].body.additive = 1n; return v; }],
    ["symbol key", v => { v.requests[1].body[Symbol("SENTINEL")] = 1; return v; }],
    ["prototype key", v => { v.requests[1].body.constructor = "SENTINEL"; return v; }],
    ["cycle", v => { v.requests[1].body.additive = v; return v; }],
    ["inherited display", v => { Object.setPrototypeOf(decision(v, 2).propositionEventType, {display: 1}); return v; }],
    ["custom array prototype", v => { Object.setPrototypeOf(v.requests, {}); return v; }],
    ["array extra key", v => { v.requests.extra = 1; return v; }],
    ["sparse array", v => { v.requests[1].body.additive = Array(1); return v; }],
    ["nonenumerable", v => { Object.defineProperty(v.host, "hidden", {value: 1}); return v; }],
    ["huge plain JSON", v => { v.requests[1].body.additive = "é".repeat(262144); return v; }],
    ["huge keys", v => { v.requests[1].body["é".repeat(262144)] = 0; return v; }],
    ["node ceiling", v => { v.requests[1].body.additive = Array(10000).fill(0); return v; }],
    ["object node ceiling", v => { v.requests[1].body.additive = Object.fromEntries(Array.from({length: 10001}, (_,i) => [i,0])); return v; }],
  ])("refuses %s as schema/input, never a semantic pass", (_label, mutate) => {
    const r = check(mutate(fixture()), 2);
    expect(r.case).toBe("invalid");
    expect(Object.values(r.counts).every(n => n === 0)).toBe(true);
  });
  it("rejects getters, array getters, and toJSON without ever invoking them", () => {
    const getter = vi.fn(() => { throw new Error("SENTINEL"); });
    for (const target of ["root", "nested", "array", "toJSON"]) {
      const v = fixture();
      if (target === "root") Object.defineProperty(v, "case", {get: getter, enumerable: true});
      if (target === "nested") Object.defineProperty(decision(v, 2).propositionEventType, "display", {get: getter, enumerable: true});
      if (target === "array") Object.defineProperty(v.requests, "0", {get: getter, enumerable: true});
      if (target === "toJSON") v.requests[1].body.toJSON = getter;
      check(v, 2);
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it("rejects proxies without running user traps", () => {
    const trap = vi.fn(() => { throw new Error("SENTINEL"); });
    check(new Proxy(fixture(), {getPrototypeOf: trap, ownKeys: trap, get: trap}), 2);
    expect(trap).not.toHaveBeenCalled();
  });
  it("accepts null-prototype plain JSON, not inherited envelope fields", () => {
    const v = fixture(); v.host = Object.assign(Object.create(null), v.host); check(v);
    const inherited = Object.create(fixture()); check(inherited, 2);
  });
  it("enforces container depth16 exactly", () => {
    // root(1), requests(2), record(3), body(4), additive(5) ... last object(16).
    const v = fixture(); let cursor = v.requests[1].body;
    for (let depth = 5; depth <= 16; depth++) { cursor.additive = {}; cursor = cursor.additive; }
    cursor.value = 0; check(v);
    cursor.value = {}; check(v, 2);
  });
  it("enforces exactly 10000 visited values including root, containers and scalars", () => {
    const v = fixture();
    function nodes(x) { return 1 + (x && typeof x === "object" ? Object.values(x).reduce((n, child) => n + nodes(child), 0) : 0); }
    v.requests[1].body.additive = [];
    v.requests[1].body.additive = Array(10000 - nodes(v)).fill(0);
    check(v);
    v.requests[1].body.additive.push(0); check(v, 2);
  });
  it("uses serialized UTF8 bytes, including escapes, at the exact 262144 limit", () => {
    const v = fixture(); v.requests[1].body.additive = "";
    const remaining = 262144 - Buffer.byteLength(JSON.stringify(v));
    v.requests[1].body.additive = "é".repeat(Math.floor(remaining / 2)) + "a".repeat(remaining % 2);
    expect(Buffer.byteLength(JSON.stringify(v))).toBe(262144);
    check(v);
    v.requests[1].body.additive += "a"; check(v, 2);
    v.requests[1].body.additive = "\n".repeat(131072); check(v, 2);
  });
  it("pure CLI malicious argv is invalid invocation and never calls an argv getter", async () => {
    const getter = vi.fn(() => "SENTINEL");
    const array = ["--input", "/SENTINEL"];
    Object.defineProperty(array, "1", {get: getter, enumerable: true});
    for (const argv of [array, ["--input", "/SENTINEL\0"], Object.create(["--help"]),
      Array(10001).fill("SENTINEL")]) {
      expect(runWireCli).toBeTypeOf("function");
      const stdout = {write: vi.fn()}, stderr = {write: vi.fn()};
      expect(await runWireCli({argv, stdout, stderr})).toBe(2);
      expect(stderr.write).toHaveBeenCalledExactlyOnceWith("invalid_invocation\n");
      const r = JSON.parse(stdout.write.mock.calls[0][0]);
      assertPublic(r, false);
      expect(r.overall).toBe("invalid_invocation");
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it("real CLI projects semantic mismatch as exit1, not invalid or success", async () => {
    const v = fixture(); analytics(v, 3).linkName = "SENTINEL";
    cliResult(cli(["--input", await privateFile(JSON.stringify(v))]), 1, "capture_checks_failed");
  });
  it("unexpected private-reader failure becomes internal3 with fixed projection", async () => {
    expect(runWireCli).toBeTypeOf("function");
    const { default: fsp } = await import("node:fs/promises");
    const stdout = { write: vi.fn() }, stderr = { write: vi.fn() };
    vi.spyOn(fsp, "lstat").mockRejectedValueOnce(new Error("SENTINEL"));
    syncBuiltinESMExports();
    // readJson deliberately converts filesystem exceptions to Failure, hence exit2.
    expect(await runWireCli({ argv: ["--input", "/SENTINEL"], stdout, stderr })).toBe(2);
    expect(stderr.write).toHaveBeenCalledWith("invalid_input\n");
    const path = await privateFile(JSON.stringify(fixture()));
    const original = fsp.open;
    vi.spyOn(fsp, "open").mockImplementationOnce(async (...args) => {
      const handle = await original(...args);
      const close = handle.close.bind(handle);
      handle.close = async () => { await close(); throw new Error("SENTINEL"); };
      return handle;
    });
    syncBuiltinESMExports();
    stdout.write.mockClear(); stderr.write.mockClear();
    expect(await runWireCli({ argv: ["--input", path], stdout, stderr })).toBe(3);
    expect(stderr.write).toHaveBeenCalledExactlyOnceWith("internal_failure\n");
    const r = JSON.parse(stdout.write.mock.calls[0][0]); assertPublic(r, false);
    expect(r).toMatchObject({case: "invalid", overall: "internal_failure", exit_code: 3});
    vi.restoreAllMocks();
    syncBuiltinESMExports();
  });
});
