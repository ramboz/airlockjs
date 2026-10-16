import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync,
  symlinkSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

// Deliberately loaded per test: the pre-implementation run witnesses individual
// failing tests, rather than an uncollected suite with a missing static import.
const load = () => import("./first-journey-admission.mjs");
const execute = promisify(execFile);
const limits = {
  observed_requests: 64, google_dispatches: 20, meta_dispatches: 8,
  url_bytes: 2048, request_bytes: 65536, response_bytes: 2097152,
  retained_bytes: 8388608, duration_ms: 60000,
};
const roots = [];
const servers = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function fixture(caseName = "google-stock") {
  const { reserveCase } = await load();
  const root = mkdtempSync(join(tmpdir(), "airlock-admission-"));
  roots.push(root);
  const time = { mono: 100, wall: 1000000 };
  const scope = {
    id: "initial", url: "http://127.0.0.1:1/receive?dup=one&dup=two&encoded=%2f",
    method: "POST", transport: "fetch", resource: "Fetch", mode: "dispatch",
    parent_scope: null, required_response: true,
  };
  const authority = {
    schema_version: 1, status: "approved", evidence_layer: "local-control",
    authority_id: "private-synthetic-authority", source_revision: "a".repeat(40),
    expires_at_ms: time.wall + 3600000, journal_dir: join(root, "journal"),
    limits: { ...limits },
    cases: ["google-stock", "google-chamber", "meta-stock", "meta-chamber"].map(name => ({
      case_name: name, input_digest: "b".repeat(64), ownership_marker: "private-marker",
      scopes: [structuredClone(scope)],
    })),
  };
  const options = {
    authority, case_name: caseName, source_revision: authority.source_revision,
    input_digest: "b".repeat(64), prerequisites: caseName.endsWith("-chamber")
      ? { stock_completed: true, candidate_eligible: true } : null,
    clock: { monotonic: () => time.mono, wall: () => time.wall },
  };
  return {
    reserve: (overrides = {}) => reserveCase({ ...options, ...overrides }),
    options, authority, root, time,
    scope: authority.cases.find(c => c.case_name === caseName).scopes[0],
  };
}
function observation(scope, overrides = {}) {
  return {
    url: scope.url, method: scope.method, transport: scope.transport, resource: scope.resource,
    ownership_marker: "private-marker", parent_ordinal: null,
    headers: Buffer.from("Cookie: private-cookie\r\nX-Control-Marker: private-marker\r\n"),
    body: Buffer.from("private-body"), ...overrides,
  };
}
const response = (ordinal, overrides = {}) => ({
  ordinal, headers: Buffer.alloc(0), body: Buffer.from("received"),
  complete: true, ...overrides,
});
const cleanup = () => ({
  observers_removed: true, pending_requests_settled: true, owned_resources_closed: true,
});
function positive(gate, scope) {
  const permission = gate.admit(observation(scope));
  expect(permission.allowed).toBe(true);
  expect(gate.complete(response(permission.ordinal)).state).not.toBe("failed");
  return permission;
}
function denied(gate, category) {
  expect(gate.report()).toMatchObject({ state: "failed", category });
  expect(gate.admit({}).allowed).toBe(false);
  expect(gate.terminate(cleanup()).state).toBe("failed");
}
async function sink() {
  const arrivals = [];
  let redirect = null;
  const server = createServer((req, res) => {
    arrivals.push(req.url);
    req.resume();
    req.on("end", () => {
      if (req.url.startsWith("/redirect")) {
        res.writeHead(302, { Location: redirect });
        res.end("redirect");
      } else res.end("received");
    });
  });
  servers.push(server);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`, arrivals,
    redirectTo: url => { redirect = url; },
  };
}
function send(observed) {
  const parsed = new URL(observed.url);
  if (parsed.hostname !== "127.0.0.1" || parsed.protocol !== "http:")
    throw new Error("test sender permits literal IPv4 loopback only");
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(observed.headers.toString().trim().split("\r\n")
      .filter(Boolean).map(line => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon), line.slice(colon + 1).trim()];
      }));
    const req = httpRequest(observed.url, { method: observed.method, headers, agent: false }, res => {
      const chunks = [];
      res.on("data", bytes => chunks.push(bytes));
      res.on("error", reject);
      res.on("end", () => resolve({
        status: res.statusCode, location: res.headers.location,
        headers: Buffer.from(res.rawHeaders.join("\r\n")), body: Buffer.concat(chunks),
      }));
    });
    req.on("error", reject);
    req.end(observed.body);
  });
}
async function guardedSend(gate, observed) {
  const permission = gate.admit(observed);
  if (!permission.allowed) return null;
  expect(permission.action).toBe("dispatch");
  const received = await send(observed); // No automatic redirect following.
  gate.complete(response(permission.ordinal, { headers: received.headers, body: received.body }));
  return { ...received, ordinal: permission.ordinal };
}

describe("AC1: closed, explicitly bounded trusted operator attestations", () => {
  it("reserves a local-control authority without asserting live approval", async () => {
    const f = await fixture();
    const gate = f.reserve();
    expect(gate.report()).toMatchObject({
      state: "reserved", evidence_layer: "local-control", live_guard_qualified: false,
    });
    positive(gate, f.scope);
    expect(gate.terminate(cleanup()).state).toBe("succeeded");
  });

  it.each([
    ["missing", f => { f.options.authority = null; }],
    ["proposed", f => { f.authority.status = "proposed"; }],
    ["unversioned", f => { delete f.authority.schema_version; }],
    ["unknown version", f => { f.authority.schema_version = 2; }],
    ["unknown root key", f => { f.authority.cookie = "secret"; }],
    ["unknown case key", f => { f.authority.cases[0].extra = true; }],
    ["unknown scope key", f => { f.scope.extra = true; }],
    ["unknown limits key", f => { f.authority.limits.extra = 1; }],
    ["unknown case", f => { f.authority.cases[0].case_name = "google-retry"; }],
    ["fifth case", f => { f.authority.cases.push(structuredClone(f.authority.cases[0])); }],
    ["empty cases", f => { f.authority.cases = []; }],
    ["duplicate case", f => { f.authority.cases[1].case_name = "google-stock"; }],
    ["duplicate scope", f => { f.authority.cases[0].scopes.push(structuredClone(f.scope)); }],
    ["missing parent definition", f => { f.scope.parent_scope = "absent"; }],
    ["malformed URL", f => { f.scope.url = "not a URL"; }],
    ["non-loopback local authority", f => { f.scope.url = "https://collector.invalid/"; }],
    ["nonliteral IPv4", f => { f.scope.url = "http://2130706433/"; }],
    ["URL whitespace", f => { f.scope.url = "http://127.0.0.1/\nsecret"; }],
    ["URL backslash", f => { f.scope.url = "http://127.0.0.1/\\secret"; }],
    ["bad source revision", f => { f.authority.source_revision = "not-pinned"; }],
    ["bad input digest", f => { f.authority.cases[0].input_digest = "not-a-digest"; }],
    ["relative directory", f => { f.authority.journal_dir = "relative"; }],
    ["bad expiry", f => { f.authority.expires_at_ms = Infinity; }],
    ["missing marker", f => { f.authority.cases[0].ownership_marker = ""; }],
    ["missing response policy", f => { delete f.scope.required_response; }],
  ])("rejects %s before creating the journal", async (_name, change) => {
    const f = await fixture();
    change(f);
    const gate = f.reserve();
    expect(gate.report()).toMatchObject({ state: "failed", category: "authority_invalid" });
    expect(() => lstatSync(join(f.root, "journal"))).toThrow();
  });

  it.each(Object.keys(limits))("rejects a wider %s limit", async key => {
    const f = await fixture();
    f.authority.limits[key]++;
    denied(f.reserve(), "authority_invalid");
  });

  it.each([
    ["source_revision", "c".repeat(40)], ["input_digest", "c".repeat(64)],
    ["case_name", "unknown"], ["journal_dir", "/private/override"],
  ])("rejects mismatched/unknown admission option %s", async (key, value) => {
    const f = await fixture();
    denied(f.reserve({ [key]: value }), "authority_invalid");
  });
});

describe("AC2: durable one-shot slots and explicit candidate prerequisites", () => {
  it.each(["google-stock", "meta-stock", "google-chamber", "meta-chamber"])(
    "reserves each fixed case once: %s", async name => {
      const f = await fixture(name);
      const gate = f.reserve();
      expect(gate.report().state).toBe("reserved");
      const path = join(f.authority.journal_dir, `${name}.reserved`);
      expect(lstatSync(f.authority.journal_dir).mode & 0o777).toBe(0o700);
      expect(lstatSync(path).mode & 0o777).toBe(0o600);
      expect(JSON.parse(readFileSync(path, "utf8").trim())).toEqual({
        schema_version: 1, case_name: name, state: "spent",
      });
      denied(f.reserve(), "slot_spent");
      gate.terminate(cleanup());
      denied(f.reserve(), "slot_spent");
    });

  it("does not reuse a successful disk snapshot, failure, or interrupted reservation", async () => {
    const f = await fixture();
    const gate = f.reserve();
    positive(gate, f.scope);
    expect(gate.terminate(cleanup()).state).toBe("succeeded");
    denied(f.reserve(), "slot_spent");
    writeFileSync(join(f.authority.journal_dir, "google-chamber.reserved"),
      JSON.stringify({ state: "succeeded", candidate_eligible: true }), { mode: 0o600 });
    denied(f.reserve({ case_name: "google-chamber", prerequisites: null }), "candidate_prerequisite");
    denied(f.reserve({ case_name: "google-chamber",
      prerequisites: { stock_completed: true, candidate_eligible: true } }), "slot_spent");
    f.reserve({ case_name: "meta-stock" }).admit({});
    denied(f.reserve({ case_name: "meta-stock" }), "slot_spent");
  });

  it("admits only one concurrent instance", async () => {
    const f = await fixture();
    const gates = await Promise.all(Array.from({ length: 8 }, () => Promise.resolve().then(() => f.reserve())));
    expect(gates.filter(g => g.report().state === "reserved")).toHaveLength(1);
    expect(gates.filter(g => g.report().category === "slot_spent")).toHaveLength(7);
  });

  it("rejects reuse from an external Node process", async () => {
    const f = await fixture();
    f.reserve(); // Simulates interruption: no termination, but slot stays spent.
    const moduleUrl = new URL("./first-journey-admission.mjs", import.meta.url).href;
    const input = { ...f.options };
    delete input.clock;
    input.authority.expires_at_ms = Date.now() + 3600000;
    const program = `import { reserveCase } from ${JSON.stringify(moduleUrl)};
      const gate = reserveCase(JSON.parse(process.argv[1]));
      console.log(gate.report().category);`;
    const result = await execute(process.execPath, ["--input-type=module", "-e", program, JSON.stringify(input)]);
    expect(result.stdout.trim()).toBe("slot_spent");
  });

  it("allows exactly one simultaneous external process to reserve", async () => {
    const f = await fixture();
    const input = { ...f.options };
    delete input.clock;
    input.authority.expires_at_ms = Date.now() + 3600000;
    const moduleUrl = new URL("./first-journey-admission.mjs", import.meta.url).href;
    const program = `import { reserveCase } from ${JSON.stringify(moduleUrl)};
      console.log(reserveCase(JSON.parse(process.argv[1])).report().category);`;
    const outputs = await Promise.all(Array.from({ length: 4 }, () => execute(process.execPath,
      ["--input-type=module", "-e", program, JSON.stringify(input)])));
    expect(outputs.map(output => output.stdout.trim()).sort()).toEqual([
      "reserved", "slot_spent", "slot_spent", "slot_spent",
    ]);
  });

  it.each([
    null, {}, { stock_completed: false, candidate_eligible: true },
    { stock_completed: true, candidate_eligible: false },
    { stock_completed: "true", candidate_eligible: true },
    { stock_completed: true, candidate_eligible: 1 },
    { stock_completed: true, candidate_eligible: true, disk_report: "success" },
  ])("requires strict, complete external candidate attestations: %j", async prerequisites => {
    const f = await fixture("meta-chamber");
    denied(f.reserve({ prerequisites }), "candidate_prerequisite");
    expect(f.reserve().report().state).toBe("reserved");
  });

  it.each(["directory symlink", "directory file", "public directory", "file symlink", "file directory",
    "public file"])("rejects unsafe ledger target: %s", async kind => {
    const f = await fixture();
    const dir = f.authority.journal_dir;
    const file = join(dir, "google-stock.reserved");
    if (kind === "directory symlink") symlinkSync(f.root, dir);
    else if (kind === "directory file") writeFileSync(dir, "");
    else {
      mkdirSync(dir, { mode: 0o700 });
      if (kind === "public directory") chmodSync(dir, 0o755);
      if (kind === "file symlink") symlinkSync(join(f.root, "missing"), file);
      if (kind === "file directory") mkdirSync(file);
      if (kind === "public file") {
        writeFileSync(file, "", { mode: 0o600 });
        chmodSync(file, 0o644);
      }
    }
    denied(f.reserve(), "journal_invalid");
  });

  it("snapshots all trusted policy and invocation inputs before returning permission", async () => {
    const f = await fixture();
    const original = structuredClone(f.scope);
    const gate = f.reserve();
    f.scope.url = "http://127.0.0.1:1/expanded";
    f.scope.mode = "local";
    f.scope.required_response = false;
    f.authority.limits.google_dispatches = 1000;
    f.authority.expires_at_ms = 0;
    f.authority.journal_dir = join(f.root, "override");
    f.authority.cases[0].ownership_marker = "changed";
    f.options.case_name = "meta-stock";
    const permission = positive(gate, original);
    expect(permission.action).toBe("dispatch");
    expect(gate.admit(observation(f.scope)).allowed).toBe(false);
    denied(f.reserve({ authority: null }), "authority_invalid");
  });

  it("does not let mutation remove required response evidence", async () => {
    const f = await fixture();
    const gate = f.reserve();
    gate.admit(observation(f.scope));
    f.scope.required_response = false;
    expect(gate.terminate(cleanup()).category).toBe("response_missing");
  });

  it("does not retain mutable observation Buffers or caller clock-provider objects", async () => {
    const f = await fixture(), gate = f.reserve();
    const r = observation(f.scope);
    const retained = Buffer.byteLength(r.url) + r.headers.byteLength + r.body.byteLength;
    const permission = gate.admit(r);
    r.url = "http://127.0.0.1:1/changed";
    r.headers.fill(0);
    r.body = Buffer.alloc(8388609);
    f.options.clock.monotonic = () => Infinity;
    f.options.clock.wall = () => Infinity;
    expect(gate.report().counts.retained_bytes).toBe(retained);
    gate.complete(response(permission.ordinal));
    expect(gate.terminate(cleanup()).state).toBe("succeeded");
  });
});

describe("AC3: exact scope, parent linkage, synchronous byte and count budgets", () => {
  it("includes original URL bytes in the aggregate retained-request budget", async () => {
    const f = await fixture(), gate = f.reserve();
    const request = observation(f.scope);
    expect(gate.admit(request).allowed).toBe(true);
    expect(gate.report().counts.retained_bytes).toBe(
      Buffer.byteLength(request.url) + request.headers.byteLength + request.body.byteLength);
  });
  it.each([
    ["query order", r => { r.url = r.url.replace("dup=one&dup=two", "dup=two&dup=one"); }],
    ["query duplicate", r => { r.url = r.url.replace("dup=one&", ""); }],
    ["encoding", r => { r.url = r.url.replace("%2f", "%2F"); }],
    ["unknown destination", r => { r.url += "&extra=yes"; }],
    ["method", r => { r.method = "GET"; }],
    ["transport", r => { r.transport = "beacon"; }],
    ["resource", r => { r.resource = "Image"; }],
    ["marker loss", r => { r.ownership_marker = null; }],
    ["marker change", r => { r.ownership_marker = "other"; }],
    ["caller fulfillment", r => { r.mode = "local"; }],
    ["caller size counter", r => { r.body_bytes = 0; }],
    ["body coercion", r => { r.body = { length: 0, toString: () => "" }; }],
    ["header coercion", r => { r.headers = "Cookie: private"; }],
  ])("fails closed on %s", async (_name, change) => {
    const f = await fixture();
    const gate = f.reserve(), r = observation(f.scope);
    change(r);
    expect(gate.admit(r).allowed).toBe(false);
    expect(gate.report().counts.observed_requests).toBe(1);
    denied(gate, gate.report().category);
  });

  it("declares local fulfillment in policy, counting observations but not dispatches", async () => {
    const f = await fixture();
    f.scope.mode = "local";
    f.scope.required_response = false;
    const gate = f.reserve();
    for (let i = 0; i < 64; i++) expect(gate.admit(observation(f.scope))).toMatchObject({
      allowed: true, action: "local", ordinal: i,
    });
    expect(gate.report().counts).toMatchObject({
      observed_requests: 64, dispatches: 0, local_fulfillments: 64,
    });
    expect(gate.admit(observation(f.scope)).allowed).toBe(false);
    denied(gate, "observed_limit");
  });

  it("can finish successfully at exactly 64 observations", async () => {
    const f = await fixture();
    const local = { ...f.scope, id: "local", url: f.scope.url + "&local=1",
      mode: "local", required_response: false };
    f.authority.cases[0].scopes.push(local);
    const gate = f.reserve();
    positive(gate, f.scope);
    for (let i = 0; i < 63; i++) expect(gate.admit(observation(local)).action).toBe("local");
    expect(gate.terminate(cleanup())).toMatchObject({
      state: "succeeded", counts: { observed_requests: 64, admitted_requests: 64 },
    });
  });

  it.each([["google-stock", 20], ["meta-stock", 8]])(
    "reserves the %s dispatch boundary synchronously, then rejects one over", async (name, maximum) => {
      const f = await fixture(name);
      const gate = f.reserve();
      for (let i = 0; i < maximum; i++) expect(gate.admit(observation(f.scope)).allowed).toBe(true);
      expect(gate.report().counts.dispatches).toBe(maximum);
      expect(gate.admit(observation(f.scope)).allowed).toBe(false);
      denied(gate, "dispatch_limit");
    });

  it.each([2048, 2049])("measures exact URL bytes: %i", async bytes => {
    const f = await fixture();
    const base = "http://127.0.0.1:1/";
    f.scope.url = base + "a".repeat(bytes - Buffer.byteLength(base));
    const gate = f.reserve();
    if (bytes === 2048) expect(gate.admit(observation(f.scope)).allowed).toBe(true);
    else denied(gate, "authority_invalid");
  });

  it("checks observed overlong URLs and uses UTF-8 bytes, not string length", async () => {
    const f = await fixture();
    const gate = f.reserve();
    expect(gate.admit(observation(f.scope, { url: "http://127.0.0.1/" + "é".repeat(1024) })).allowed)
      .toBe(false);
    denied(gate, "url_limit");
  });

  it.each([65536, 65537])("checks combined actual request Buffer bytes: %i", async size => {
    const f = await fixture();
    const gate = f.reserve();
    const result = gate.admit(observation(f.scope, {
      headers: Buffer.from("é".repeat(50)), body: Buffer.alloc(size - 100),
    }));
    expect(result.allowed).toBe(size === 65536);
    if (size > 65536) denied(gate, "request_limit");
    else expect(gate.report().counts.retained_bytes).toBe(size + Buffer.byteLength(f.scope.url));
  });

  it("does not trust an overridden Buffer byteLength on a request", async () => {
    const f = await fixture(), gate = f.reserve();
    const body = Buffer.alloc(65537);
    Object.defineProperty(body, "byteLength", { value: 0 });
    expect(gate.admit(observation(f.scope, { headers: Buffer.alloc(0), body })).allowed).toBe(false);
    denied(gate, "request_limit");
  });

  it.each([2097152, 2097153])("checks combined response Buffer bytes: %i", async size => {
    const f = await fixture();
    const gate = f.reserve();
    const p = gate.admit(observation(f.scope));
    const result = gate.complete(response(p.ordinal, {
      headers: Buffer.alloc(5), body: Buffer.alloc(size - 5),
    }));
    expect(result.state === "failed").toBe(size > 2097152);
    if (size > 2097152) denied(gate, "response_limit");
    else expect(gate.terminate(cleanup()).state).toBe("succeeded");
  });

  it("does not trust an overridden Buffer byteLength on a response", async () => {
    const f = await fixture(), gate = f.reserve();
    const p = gate.admit(observation(f.scope));
    const body = Buffer.alloc(2097153);
    Object.defineProperty(body, "byteLength", { value: 0 });
    expect(gate.complete(response(p.ordinal, { body })).category).toBe("response_limit");
  });

  it.each([8388608, 8388609])("checks aggregate retention at %i bytes", async total => {
    const f = await fixture();
    const gate = f.reserve();
    for (let i = 0; i < 4; i++) {
      const p = gate.admit(observation(f.scope, { headers: Buffer.alloc(0), body: Buffer.alloc(0) }));
      const size = i === 3 ? total - gate.report().counts.retained_bytes : 2097152;
      gate.complete(response(p.ordinal, { body: Buffer.alloc(size) }));
    }
    if (total > 8388608) {
      denied(gate, "retained_limit");
    } else {
      expect(gate.report().counts.retained_bytes).toBe(8388608);
      expect(gate.terminate(cleanup()).state).toBe("succeeded");
    }
  });

  it.each([0, 1])("checks request-side aggregate URL/body retention at limit + %i", async extra => {
    const f = await fixture();
    const gate = f.reserve();
    const urlBytes = Buffer.byteLength(f.scope.url);
    for (let i = 0; i < 4; i++) {
      const p = gate.admit(observation(f.scope, { headers: Buffer.alloc(0), body: Buffer.alloc(0) }));
      const size = i === 3 ? 8388608 - 3 * 2097152 - 5 * urlBytes : 2097152;
      gate.complete(response(p.ordinal, { body: Buffer.alloc(size) }));
    }
    const p = gate.admit(observation(f.scope, { headers: Buffer.alloc(0), body: Buffer.alloc(extra) }));
    expect(p.allowed).toBe(extra === 0);
    if (extra) denied(gate, "retained_limit");
    else {
      expect(gate.report().counts.retained_bytes).toBe(8388608);
      gate.complete(response(p.ordinal, { body: Buffer.alloc(0) }));
      expect(gate.terminate(cleanup()).state).toBe("succeeded");
    }
  });

  it.each(["missing", "future", "wrong-scope", "fraction", "valid"])(
    "requires an admitted earlier parent ordinal: %s", async kind => {
      const f = await fixture();
      f.authority.cases[0].scopes.push({
        ...f.scope, id: "child", url: f.scope.url + "&child=1", parent_scope: "initial",
      }, { ...f.scope, id: "other", url: f.scope.url + "&other=1" });
      const child = f.authority.cases[0].scopes[1];
      const gate = f.reserve();
      const parent = gate.admit(observation(kind === "wrong-scope" ? f.authority.cases[0].scopes[2] : f.scope));
      const ordinal = { missing: null, future: 5, "wrong-scope": parent.ordinal,
        fraction: 0.5, valid: parent.ordinal }[kind];
      const result = gate.admit(observation(child, { parent_ordinal: ordinal }));
      expect(result.allowed).toBe(kind === "valid");
      if (kind !== "valid") denied(gate, "parent_invalid");
    });
});

describe("AC4: deadlines, evidence, and irreversible terminal failures", () => {
  it.each([60000, 60001])("bounds the absolute case clock through termination: %i ms", async elapsed => {
    const f = await fixture(), gate = f.reserve();
    positive(gate, f.scope);
    f.time.mono += elapsed;
    expect(gate.terminate(cleanup()).state).toBe(elapsed === 60000 ? "succeeded" : "failed");
    if (elapsed > 60000) denied(gate, "deadline");
  });

  it("includes durable reservation time, not just dispatch time", async () => {
    const f = await fixture();
    let ticks = 0;
    const gate = f.reserve({ clock: {
      monotonic: () => ticks++ < 2 ? 100 : 60101, wall: () => f.time.wall,
    } });
    denied(gate, "deadline");
    denied(f.reserve(), "slot_spent");
  });

  it("includes durable termination time, not just pre-write validation", async () => {
    const f = await fixture();
    let terminal = false, ticks = 0;
    const gate = f.reserve({ clock: {
      monotonic: () => terminal && ++ticks > 1 ? 60101 : 100, wall: () => f.time.wall,
    } });
    positive(gate, f.scope);
    terminal = true;
    expect(gate.terminate(cleanup()).category).toBe("deadline");
  });

  it.each(["admit", "complete", "terminate", "report"])("enforces continuing authority expiry on %s", async op => {
    const f = await fixture(), gate = f.reserve();
    const p = gate.admit(observation(f.scope));
    f.time.wall = f.authority.expires_at_ms;
    if (op === "admit") gate.admit(observation(f.scope));
    if (op === "complete") gate.complete(response(p.ordinal));
    if (op === "terminate") gate.terminate(cleanup());
    if (op === "report") gate.report();
    denied(gate, "authority_expired");
  });

  it("rejects already expired authority without spending a slot", async () => {
    const f = await fixture();
    f.authority.expires_at_ms = f.time.wall;
    denied(f.reserve(), "authority_expired");
    expect(() => lstatSync(f.authority.journal_dir)).toThrow();
  });

  it("can finish exactly one millisecond before authority expiry", async () => {
    const f = await fixture(), gate = f.reserve();
    positive(gate, f.scope);
    f.time.wall = f.authority.expires_at_ms - 1;
    expect(gate.terminate(cleanup()).state).toBe("succeeded");
  });

  it("enforces the deadline during response completion without recovering at termination", async () => {
    const f = await fixture(), gate = f.reserve();
    const p = gate.admit(observation(f.scope));
    f.time.mono += 60001;
    expect(gate.complete(response(p.ordinal)).category).toBe("deadline");
    f.time.mono = 100;
    expect(gate.complete(response(p.ordinal)).state).toBe("failed");
    denied(gate, "deadline");
  });

  it.each([
    ["monotonic rollback", t => { t.mono--; }],
    ["wall rollback", t => { t.wall--; }],
    ["monotonic NaN", t => { t.mono = NaN; }],
    ["monotonic infinity", t => { t.mono = Infinity; }],
    ["wall NaN", t => { t.wall = NaN; }],
    ["wall infinity", t => { t.wall = Infinity; }],
    ["coercible clock", t => { t.mono = "100"; }],
  ])("stops permanently for %s", async (_name, change) => {
    const f = await fixture(), gate = f.reserve();
    change(f.time);
    gate.admit(observation(f.scope));
    f.time.mono = 100;
    f.time.wall = 1000000;
    denied(gate, "clock_invalid");
  });

  it("sanitizes a throwing clock instead of exposing its exception", async () => {
    const f = await fixture();
    const gate = f.reserve({ clock: {
      monotonic: () => { throw new Error("private-clock-secret"); }, wall: () => f.time.wall,
    } });
    denied(gate, "clock_invalid");
    expect(JSON.stringify(gate.report())).not.toContain("private-clock");
  });

  it.each([
    ["missing cleanup", null], ["empty cleanup", {}],
    ["unfinished pending requests", { ...cleanup(), pending_requests_settled: false }],
    ["resources still open", { ...cleanup(), owned_resources_closed: false }],
    ["observers still installed", { ...cleanup(), observers_removed: false }],
    ["truthy cleanup", { ...cleanup(), observers_removed: 1 }],
    ["unknown cleanup", { ...cleanup(), extra: true }],
  ])("requires strict cleanup: %s", async (_name, evidence) => {
    const f = await fixture(), gate = f.reserve();
    positive(gate, f.scope);
    expect(gate.terminate(evidence).category).toBe("cleanup_invalid");
    denied(gate, "cleanup_invalid");
  });

  it("rejects a nonenumerable false cleanup attestation", async () => {
    const f = await fixture(), gate = f.reserve();
    positive(gate, f.scope);
    const evidence = cleanup();
    Object.defineProperty(evidence, "observers_removed", { value: false, enumerable: false });
    expect(gate.terminate(evidence).category).toBe("cleanup_invalid");
  });

  it("rejects a ledger permission change through durable termination without exposing paths", async () => {
    const f = await fixture(), gate = f.reserve();
    positive(gate, f.scope);
    chmodSync(join(f.authority.journal_dir, "google-stock.reserved"), 0o644);
    const result = gate.terminate(cleanup());
    expect(result.category).toBe("journal_invalid");
    expect(JSON.stringify(result)).not.toContain(f.root);
  });

  it.each(["empty", "local-only", "optional-uncompleted-dispatch"])(
    "never treats %s as a positive stock run", async kind => {
      const f = await fixture();
      if (kind === "local-only") f.scope.mode = "local";
      f.scope.required_response = false;
      const gate = f.reserve();
      if (kind !== "empty") {
        const p = gate.admit(observation(f.scope));
        if (kind === "local-only") gate.complete(response(p.ordinal));
      }
      expect(gate.terminate(cleanup()).category).toBe("empty_case");
    });

  it("requires every scope-declared required response, even after a complete dispatch", async () => {
    const f = await fixture(), gate = f.reserve();
    positive(gate, f.scope);
    gate.admit(observation(f.scope));
    expect(gate.terminate(cleanup()).category).toBe("response_missing");
  });

  it.each([
    { ordinal: 5 }, { ordinal: 0.5 }, { complete: false }, { complete: "true" },
    { body: "not-bytes" }, { headers: new Uint8Array(1) }, { response_bytes: 0 },
  ])("rejects invalid response evidence %j", async patch => {
    const f = await fixture(), gate = f.reserve();
    const p = gate.admit(observation(f.scope));
    expect(gate.complete(response(p.ordinal, patch)).category).toBe("response_invalid");
    denied(gate, "response_invalid");
  });

  it("cannot recover from duplicate completion or repeated termination", async () => {
    const f = await fixture(), gate = f.reserve();
    const p = positive(gate, f.scope);
    expect(gate.complete(response(p.ordinal)).category).toBe("response_duplicate");
    denied(gate, "response_duplicate");
    const other = f.reserve({ case_name: "meta-stock" });
    positive(other, f.scope);
    expect(other.terminate(cleanup()).state).toBe("succeeded");
    expect(other.terminate(cleanup()).category).toBe("already_terminated");
    expect(other.terminate(cleanup()).state).toBe("failed");
  });
});

describe("AC5: actual literal-loopback receiver controls, not a mock sender", () => {
  it("receives one positive dispatch and no enforced-denied traffic", async () => {
    const receiver = await sink(), f = await fixture();
    f.scope.url = receiver.url + "/receive?dup=1&dup=2&encoding=%2f";
    const gate = f.reserve();
    await guardedSend(gate, observation(f.scope));
    expect(receiver.arrivals).toEqual(["/receive?dup=1&dup=2&encoding=%2f"]);
    expect(gate.terminate(cleanup()).state).toBe("succeeded");
    const deniedGate = f.reserve({ case_name: "meta-stock" });
    await guardedSend(deniedGate, observation(f.scope, { url: receiver.url + "/denied" }));
    expect(receiver.arrivals.filter(path => path === "/denied")).toHaveLength(0);
    expect(deniedGate.report().counts.dispatches).toBe(0);
    expect(deniedGate.terminate(cleanup()).state).toBe("failed");
  });

  it("detects deliberate sender bypass as nonzero receiver arrivals, NOT guard containment", async () => {
    const receiver = await sink(), f = await fixture();
    const gate = f.reserve();
    const disallowed = observation(f.scope, { url: receiver.url + "/bypass" });
    expect(gate.admit(disallowed).allowed).toBe(false);
    await send(disallowed); // Deliberate sensitivity control, ignoring the failed gate.
    expect(receiver.arrivals).toEqual(["/bypass"]);
    expect(gate.report()).toMatchObject({
      state: "failed", live_guard_qualified: false, counts: { dispatches: 0 },
    });
  });

  it("manually re-admits each redirect hop with its exact parent", async () => {
    const receiver = await sink(), f = await fixture();
    f.scope.url = receiver.url + "/redirect";
    const child = { ...f.scope, id: "redirect-hop", url: receiver.url + "/final?dup=1&dup=2",
      parent_scope: "initial" };
    f.authority.cases[0].scopes.push(child);
    receiver.redirectTo(child.url);
    const gate = f.reserve();
    const first = await guardedSend(gate, observation(f.scope));
    expect(first.status).toBe(302);
    expect(receiver.arrivals).toEqual(["/redirect"]); // The sender did NOT follow automatically.
    await guardedSend(gate, observation(child, { url: first.location, parent_ordinal: first.ordinal }));
    expect(receiver.arrivals).toEqual(["/redirect", "/final?dup=1&dup=2"]);
    expect(gate.report().counts.dispatches).toBe(2);
    expect(gate.terminate(cleanup()).state).toBe("succeeded");
  });

  it("aborts an out-of-scope redirect before any hop arrival", async () => {
    const receiver = await sink(), f = await fixture();
    f.scope.url = receiver.url + "/redirect";
    receiver.redirectTo(receiver.url + "/not-approved");
    const gate = f.reserve();
    const first = await guardedSend(gate, observation(f.scope));
    await guardedSend(gate, observation(f.scope, { url: first.location, parent_ordinal: first.ordinal }));
    expect(receiver.arrivals).toEqual(["/redirect"]);
    expect(gate.report().state).toBe("failed");
  });

  it("aborts on ownership marker loss after the first real arrival", async () => {
    const receiver = await sink(), f = await fixture();
    f.scope.url = receiver.url + "/receive";
    const gate = f.reserve();
    await guardedSend(gate, observation(f.scope));
    await guardedSend(gate, observation(f.scope, { ownership_marker: null }));
    expect(receiver.arrivals).toEqual(["/receive"]);
    expect(gate.terminate(cleanup()).state).toBe("failed");
  });
});

describe("AC6: public privacy and explicit unproved claims", () => {
  it("returns only fixed categories/counts/state and no private values or their digests", async () => {
    const f = await fixture(), gate = f.reserve();
    const outputs = [gate.report()];
    const p = gate.admit(observation(f.scope));
    outputs.push(p, gate.complete(response(p.ordinal)), gate.terminate(cleanup()));
    const serialized = JSON.stringify(outputs);
    for (const secret of [f.root, f.scope.url, f.authority.authority_id,
      f.authority.source_revision, f.options.input_digest, "private-cookie", "private-marker", "private-body"]) {
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain(createHash("sha256").update(secret).digest("hex"));
    }
    expect(gate.report()).toMatchObject({
      live_guard_qualified: false, vendor_dispatch_proved: false, vendor_receipt_proved: false,
      chamber_compatibility_proved: false, attribution_proved: false, candidate_eligibility_proved: false,
    });
    expect(Object.keys(gate.report()).sort()).toEqual([
      "schema_version", "case_name", "evidence_layer", "state", "category", "counts",
      "live_guard_qualified", "vendor_dispatch_proved", "vendor_receipt_proved",
      "chamber_compatibility_proved", "attribution_proved", "candidate_eligibility_proved",
    ].sort());
    const changed = gate.report();
    changed.counts.dispatches = 9999;
    expect(gate.report().counts.dispatches).toBe(1);
  });

  it("has no network/browser/SDK imports and no CLI dispatch mode", async () => {
    await load();
    const source = readFileSync(new URL("./first-journey-admission.mjs", import.meta.url), "utf8");
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1]);
    expect(imports.every(name => ["node:fs", "node:path", "node:buffer", "node:perf_hooks"].includes(name))).toBe(true);
    expect(source).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|process\.argv)\s*\(/);
    const guide = readFileSync(new URL("./first-journey-admission.md", import.meta.url), "utf8");
    for (const nonclaim of ["local-control", "authenticated owner", "live_guard_qualified",
      "Servo", "C2/C3", "bypass", "tampering"]) expect(guide).toContain(nonclaim);
  });
});
