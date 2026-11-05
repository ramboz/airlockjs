import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { connect as netConnect } from "node:net";
import { resolve } from "node:path";
import { connect as tlsConnect, createServer as tlsServer } from "node:tls";
import { describe, expect, it, vi } from "vitest";
import { createLocalGoogleController, prepareNativeGoogleStock, reserveLocalGoogleSlot } from "./inspected-google-controller.mjs";

const primary = "https://www.googleadservices.com/pagead/conversion/000000000/"
  + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
  + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
const companion = "https://ad.doubleclick.net/ccm/s/collect?auid=synthetic-auid";
const observation = (url, network_id, extra = {}) => ({ network_id, url, method: "GET",
  resource_type: url === primary ? "XHR" : "Image", ...extra });
const request = url => {
  const parsed = new URL(url);
  return Buffer.from(`GET ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n\r\n`);
};
const ready = options => {
  const c = createLocalGoogleController(options);
  for (const name of ["initialize", "configure", "conversion"]) c.command(name);
  return c;
};
const syncState = vi.hoisted(() => ({ parent: null, synced: false, fail: false }));
vi.mock("node:fs", async load => {
  const fs = await load();
  return { ...fs, fsyncSync(fd) {
    const stat = fs.fstatSync(fd);
    if (syncState.parent && stat.isDirectory() && `${stat.dev}:${stat.ino}` === syncState.parent) {
      syncState.synced = true;
      if (syncState.fail) throw Error("synthetic_parent_fsync_failed");
    }
    return fs.fsyncSync(fd);
  } };
});

describe("SDK-free Google controller", () => {
  it("enforces exactly one ordered initialization, configuration and conversion", () => {
    const controller = createLocalGoogleController();
    expect(() => controller.command("conversion")).toThrow("google_command_sequence");
    const valid = createLocalGoogleController();
    valid.command("initialize");
    valid.command("configure");
    valid.command("conversion");
    expect(() => valid.command("conversion")).toThrow("google_command_sequence");
    expect(valid.snapshot()).toMatchObject({ commands: ["initialize", "configure", "conversion"],
      native_sdk_executed: false, native_execution_qualified: false, public_upstream_requests: 0 });
    const extra = ready();
    expect(() => extra.command(undefined)).toThrow("google_command_sequence");
    const reordered = createLocalGoogleController();
    reordered.command("initialize");
    expect(() => reordered.command("conversion")).toThrow("google_command_sequence");
    expect(() => reordered.command("configure")).toThrow("google_command_sequence");
  });

  it("never turns a local or caller-authored plan into native admission", () => {
    expect(() => prepareNativeGoogleStock(createLocalGoogleController())).toThrow("google_native_admission_closed");
    expect(() => prepareNativeGoogleStock({ qualification: true, cleanup: true })).toThrow("google_native_admission_closed");
  });

  it("uses the canonical slot namespace only for a newly created synthetic authority", () => {
    const root = resolve("rig/out", `google-slot-${randomBytes(8).toString("hex")}`);
    try {
      const reserved = reserveLocalGoogleSlot(root);
      expect(reserved).toMatchObject({ case_name: "google-stock", reserved: true,
        network_authorized: false, execution_prerequisites_proved: false });
      expect(reserved.canonical_record_path).toBe(`${root}/native-stock-slots-synthetic-only-grant/google-stock.reserved`);
      expect(JSON.parse(readFileSync(reserved.canonical_record_path)).state).toBe("spent");
      expect(statSync(reserved.canonical_record_path).mode & 0o777).toBe(0o600);
      expect(() => reserveLocalGoogleSlot(root)).toThrow();
      expect(() => reserveLocalGoogleSlot("/outside/authority")).toThrow("nonlocal_google_fixture");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("syncs the parent after creating a synthetic output directory and propagates sync failures", () => {
    const root = resolve("rig/out", `google-slot-${randomBytes(8).toString("hex")}`);
    const parent = statSync(resolve("rig/out"));
    syncState.parent = `${parent.dev}:${parent.ino}`;
    syncState.synced = false;
    syncState.fail = true;
    try {
      expect(() => reserveLocalGoogleSlot(root)).toThrow("synthetic_parent_fsync_failed");
      expect(syncState.synced).toBe(true);
      expect(() => statSync(`${root}/synthetic-authority.json`)).toThrow();
    } finally {
      syncState.parent = null;
      syncState.fail = false;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes an exclusive private incomplete result when no capture completed", async () => {
    const root = resolve("rig/out", `google-result-${randomBytes(8).toString("hex")}`);
    const c = ready();
    try {
      const report = await c.finish(root);
      expect(report).toMatchObject({ outcome: "inconclusive", native_sdk_executed: false,
        native_execution_qualified: false, public_upstream_requests: 0 });
      expect(JSON.parse(readFileSync(`${root}/result.json`))).toMatchObject(report);
      expect(statSync(`${root}/result.json`).mode & 0o777).toBe(0o600);
      await expect(c.finish(root)).rejects.toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it("does not overwrite an existing result or synthesize an unfinished response", async () => {
    const root = resolve("rig/out", `google-result-${randomBytes(8).toString("hex")}`);
    const existing = resolve("rig/out", `google-result-${randomBytes(8).toString("hex")}`);
    const failure = resolve("rig/out", `google-failure-${existing.slice(-16)}.json`);
    mkdirSync(existing, { mode: 0o700 });
    writeFileSync(`${existing}/result.json`, "preserve", { mode: 0o600 });
    try {
      await expect(ready().finish(existing)).rejects.toThrow();
      expect(readFileSync(`${existing}/result.json`, "utf8")).toBe("preserve");
      expect(JSON.parse(readFileSync(failure))).toMatchObject({ complete: false, reason: "google_output_unavailable" });
      const c = ready();
      c.observe(observation(primary, "one"));
      c.connection("h1").request(request(primary));
      const report = await c.finish(root);
      expect(report).toMatchObject({ outcome: "inconclusive", errors: ["google_capture_incomplete"] });
      expect(report.originals.responses).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(existing, { recursive: true, force: true });
      rmSync(failure, { force: true });
    }
  });

  it("closes a live broker before rejecting an existing result directory", async () => {
    const id = randomBytes(8).toString("hex"), dir = resolve("rig/out", `google-node-${id}`);
    const existing = resolve("rig/out", `google-result-${id}`);
    const failure = resolve("rig/out", `google-failure-${id}.json`);
    mkdirSync(dir, { mode: 0o700 });
    mkdirSync(existing, { mode: 0o700 });
    writeFileSync(`${existing}/result.json`, "preserve", { mode: 0o600 });
    let sink, transport;
    try {
      execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`, "-subj", "/CN=www.googleadservices.com",
        "-addext", "subjectAltName=DNS:www.googleadservices.com"], { stdio: "ignore", timeout: 10000 });
      const credentials = { key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) };
      sink = tlsServer({ ...credentials, ALPNProtocols: ["http/1.1"] });
      await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
      const c = ready();
      c.observe(observation(primary, "one"));
      transport = await c.startLocalTransport({ inspector: credentials,
        receiver: { port: sink.address().port, certificate: credentials.cert }, protocol: "h1" });
      await expect(c.finish(existing)).rejects.toThrow();
      expect(transport.snapshot().server_closed).toBe(true);
      expect(readFileSync(`${existing}/result.json`, "utf8")).toBe("preserve");
    } finally {
      if (transport) await transport.close();
      if (sink) await new Promise(resolve => sink.close(resolve));
      rmSync(dir, { recursive: true, force: true });
      rmSync(existing, { recursive: true, force: true });
      rmSync(failure, { force: true });
    }
  }, 20000);

  it("does not publish a success result when publication completes after the deadline", async () => {
    const root = resolve("rig/out", `google-result-${randomBytes(8).toString("hex")}`);
    const c = ready(), connection = c.connection("h1");
    c.observe(observation(primary, "one"));
    connection.request(request(primary));
    await connection.response(Buffer.from("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"));
    const baseline = performance.now();
    let calls = 0;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => baseline + (++calls >= 3 ? 61000 : 0));
    try {
      await expect(c.finish(root)).rejects.toThrow("google_output_deadline");
      const result = JSON.parse(readFileSync(`${root}/result.json`));
      expect(result.outcome).not.toBe("synthetic-complete");
      expect(JSON.parse(readFileSync(`${root}/publication-failure.json`)))
        .toMatchObject({ complete: false, reason: "google_output_deadline" });
    } finally {
      spy.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses the real Google policy and bounded logical observations for physical bytes", () => {
    const c = ready();
    c.observe(observation(primary, "primary"));
    const bytes = request(primary);
    expect(c.connection("h1").request(bytes)).toEqual(bytes);
    expect(c.snapshot().physical).toMatchObject({ observed: 1, forwarded: 1,
      policy: { execution_authority: false } });
    const missing = ready();
    expect(missing.connection("h1").request(bytes)).toEqual(Buffer.alloc(0));
    expect(missing.snapshot().physical.reason).toBe("missing_or_ambiguous_logical_observation");
    const ambiguous = ready();
    ambiguous.observe(observation(primary, "one"));
    ambiguous.observe(observation(primary, "two"));
    expect(ambiguous.connection("h1").request(bytes)).toEqual(Buffer.alloc(0));
    expect(ambiguous.snapshot().physical.reason).toBe("missing_or_ambiguous_logical_observation");
  });

  it("fails closed on malformed observations and a changed reused logical identity", () => {
    const malformed = ready();
    expect(() => malformed.observe({})).toThrow("invalid_google_observation");
    expect(malformed.snapshot().physical).toMatchObject({ stopped: true, reason: "invalid_google_observation" });
    const changed = ready(), first = changed.connection("h1");
    changed.observe(observation(primary, "same"));
    expect(first.request(request(primary))).toEqual(request(primary));
    changed.observe(observation(companion, "same"));
    expect(changed.connection("h1").request(request(companion))).toEqual(Buffer.alloc(0));
    expect(changed.snapshot().physical.reason).toBe("changed_logical_observation");
  });

  it("only accepts response-linked requests after the actual parent completes", async () => {
    const c = ready(), first = c.connection("h1");
    c.observe(observation(primary, "one"));
    c.observe(observation(companion, "two", { response_parent: 1 }));
    first.request(request(primary));
    const body = JSON.stringify({ url: companion });
    await first.response(Buffer.from(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`));
    expect(c.connection("h1").request(request(companion))).toEqual(request(companion));
    const incomplete = ready(), parent = incomplete.connection("h1");
    incomplete.observe(observation(primary, "one"));
    incomplete.observe(observation(companion, "two", { response_parent: 1 }));
    parent.request(request(primary));
    await parent.response(Buffer.from(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n${body.slice(0, -1)}`));
    expect(incomplete.connection("h1").request(request(companion))).toEqual(Buffer.alloc(0));
    expect(incomplete.snapshot().physical.reason).toBe("unverified_parent_url");
  });

  it("binds redirects to the completed physical parent and matching logical chain", async () => {
    const child = `${primary}&random=1`, c = ready(), first = c.connection("h1");
    c.observe(observation(primary, "same", { fetch_id: "first" }));
    c.observe(observation(child, "same", { fetch_id: "second", resource_type: "XHR", redirect_from: 1 }));
    first.request(request(primary));
    await first.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 3\r\n\r\nabc`));
    expect(c.connection("h1").request(request(child))).toEqual(request(child));
    const incomplete = ready(), parent = incomplete.connection("h1");
    incomplete.observe(observation(primary, "same", { fetch_id: "first" }));
    incomplete.observe(observation(child, "same", { fetch_id: "second", resource_type: "XHR", redirect_from: 1 }));
    parent.request(request(primary));
    await parent.response(Buffer.from(`HTTP/1.1 302 Found\r\nLocation: ${child}\r\nContent-Length: 3\r\n\r\na`));
    expect(incomplete.connection("h1").request(request(child))).toEqual(Buffer.alloc(0));
    expect(incomplete.snapshot().physical.reason).toBe("uncompleted_redirect_parent");
  });

  it("stops oversized observations and response bodies instead of reporting a complete capture", async () => {
    const tooLong = ready();
    expect(() => tooLong.observe(observation(primary + "a".repeat(2048), "too-long")))
      .toThrow("invalid_google_observation");
    const c = ready(), connection = c.connection("h1");
    c.observe(observation(primary, "one"));
    connection.request(request(primary));
    await connection.response(Buffer.concat([
      Buffer.from("HTTP/1.1 200 OK\r\nContent-Length: 2097153\r\n\r\n"), Buffer.alloc(2097153),
    ]));
    expect(c.snapshot().physical).toMatchObject({ stopped: true, reason: "response_overflow" });
  });

  it("enforces the real global 20-attempt limit across connections", () => {
    const c = ready();
    c.observe(observation(primary, "one"));
    for (let i = 0; i < 21; i++) {
      expect(c.connection("h1").request(request(primary)))
        .toEqual(i < 20 ? request(primary) : Buffer.alloc(0));
    }
    expect(c.snapshot().physical).toMatchObject({ observed: 21, forwarded: 20, reason: "physical_request_limit" });
  });

  it("stops on observation overflow and reserves time for settlement", () => {
    let time = 0;
    const c = ready({ clock: () => time, durationMs: 10000, settlementMs: 2000 });
    for (let i = 0; i < 64; i++) c.observe(observation(primary, `id-${i}`));
    expect(() => c.observe(observation(primary, "overflow"))).toThrow("google_observation_limit");
    time = 0;
    const deadline = ready({ clock: () => time, durationMs: 10000, settlementMs: 2000 });
    time = 8000;
    expect(() => deadline.observe(observation(primary, "late"))).toThrow("case_window_inactive");
  });

  it("sends a synthetic request through the real loopback broker, observer and raw TLS relay", async () => {
    const dir = resolve("rig/out", `google-node-${randomBytes(8).toString("hex")}`);
    const resultDir = resolve("rig/out", `google-result-${randomBytes(8).toString("hex")}`);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const key = `${dir}/key.pem`, cert = `${dir}/cert.pem`;
    execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", key, "-out", cert, "-subj", "/CN=www.googleadservices.com",
      "-addext", "subjectAltName=DNS:www.googleadservices.com"], { stdio: "ignore", timeout: 10000 });
    const credentials = { key: readFileSync(key), cert: readFileSync(cert) };
    let received = "";
    const sink = tlsServer({ ...credentials, ALPNProtocols: ["http/1.1"] }, socket => {
      socket.on("data", bytes => {
        received += bytes.toString();
        socket.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok");
      });
    });
    sink.on("tlsClientError", () => {});
    await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
    const c = ready();
    c.observe(observation(primary, "one"));
    let transport;
    try {
      transport = await c.startLocalTransport({ inspector: credentials,
        receiver: { port: sink.address().port, certificate: credentials.cert }, protocol: "h1" });
      const socket = netConnect({ host: "127.0.0.1", port: transport.port });
      const status = await new Promise((resolve, reject) => {
        socket.setTimeout(5000, () => socket.destroy(Error("local_fixture_timeout")));
        socket.once("error", reject);
        socket.once("connect", () => socket.write("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n"));
        socket.once("data", bytes => resolve(bytes.toString()));
      });
      expect(status).toContain("200 Connection Established");
      const secure = tlsConnect({ socket, servername: "www.googleadservices.com", ca: credentials.cert,
        ALPNProtocols: ["http/1.1"] });
      const response = await new Promise((resolve, reject) => {
        let output = "";
        secure.once("error", reject);
        secure.once("secureConnect", () => secure.write(request(primary)));
        secure.on("data", bytes => { output += bytes; });
        secure.once("end", () => resolve(output));
      });
      expect(response).toContain("\r\n\r\nok");
      expect(received).toBe(request(primary).toString());
      expect(c.snapshot().physical).toMatchObject({ forwarded: 1, stopped: false });
      expect(transport.snapshot().public_upstream_requests).toBe(0);
      const report = await c.finish(resultDir);
      expect(report).toMatchObject({ outcome: "inconclusive", capture_complete: true, errors: [],
        native_sdk_executed: false, public_upstream_requests: 0 });
      expect(readFileSync(`${resultDir}/${report.originals.responses[0].body.file}`).toString()).toBe("ok");
      expect(readFileSync(`${resultDir}/${report.originals.wire[0].request.file}`)).toEqual(request(primary));
      expect(() => c.observe(observation(primary, "after-finish"))).toThrow("google_fixture_already_finished");
    } finally {
      if (transport) await transport.close();
      await new Promise(resolve => sink.close(resolve));
      rmSync(dir, { recursive: true, force: true });
      rmSync(resultDir, { recursive: true, force: true });
    }
  }, 20000);

  it.each(["changed-input", "ambiguous"])("denies %s before the real loopback receiver", async kind => {
    const dir = resolve("rig/out", `google-node-${randomBytes(8).toString("hex")}`);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const key = `${dir}/key.pem`, cert = `${dir}/cert.pem`;
    execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", key, "-out", cert, "-subj", "/CN=www.googleadservices.com",
      "-addext", "subjectAltName=DNS:www.googleadservices.com"], { stdio: "ignore", timeout: 10000 });
    const credentials = { key: readFileSync(key), cert: readFileSync(cert) };
    let arrivals = 0;
    const sink = tlsServer({ ...credentials, ALPNProtocols: ["http/1.1"] }, socket => {
      socket.on("error", () => {});
      socket.on("data", () => { arrivals++; socket.destroy(); });
    });
    sink.on("tlsClientError", () => {});
    await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
    const c = ready(), url = kind === "changed-input" ? primary.replace("synthetic-transaction", "other") : primary;
    c.observe(observation(url, "first", { resource_type: "XHR" }));
    if (kind === "ambiguous") c.observe(observation(url, "second", { resource_type: "XHR" }));
    let transport;
    try {
      transport = await c.startLocalTransport({ inspector: credentials,
        receiver: { port: sink.address().port, certificate: credentials.cert }, protocol: "h1" });
      const socket = netConnect({ host: "127.0.0.1", port: transport.port });
      const status = await new Promise((resolve, reject) => {
        socket.setTimeout(5000, () => socket.destroy(Error("local_fixture_timeout")));
        socket.once("error", reject);
        socket.once("connect", () => socket.write("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n"));
        socket.once("data", bytes => resolve(bytes.toString()));
      });
      expect(status).toContain("200 Connection Established");
      const secure = tlsConnect({ socket, servername: "www.googleadservices.com", ca: credentials.cert,
        ALPNProtocols: ["http/1.1"] });
      await new Promise(resolve => {
        secure.on("error", () => {});
        secure.once("secureConnect", () => secure.write(request(url)));
        secure.once("close", resolve);
      });
      expect(arrivals).toBe(0);
      expect(c.snapshot().physical).toMatchObject({ forwarded: 0, stopped: true,
        reason: kind === "ambiguous" ? "missing_or_ambiguous_logical_observation" : "owned_input_mismatch" });
    } finally {
      if (transport) await transport.close();
      await new Promise(resolve => sink.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20000);

  it("counts 20 and denies physical request 21 across real loopback tunnels", async () => {
    const dir = resolve("rig/out", `google-node-${randomBytes(8).toString("hex")}`);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const key = `${dir}/key.pem`, cert = `${dir}/cert.pem`;
    execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", key, "-out", cert, "-subj", "/CN=www.googleadservices.com",
      "-addext", "subjectAltName=DNS:www.googleadservices.com"], { stdio: "ignore", timeout: 10000 });
    const credentials = { key: readFileSync(key), cert: readFileSync(cert) };
    let arrivals = 0;
    const sink = tlsServer({ ...credentials, ALPNProtocols: ["http/1.1"] }, socket => {
      socket.on("error", () => {});
      socket.on("data", () => { arrivals++; socket.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"); });
    });
    sink.on("tlsClientError", () => {});
    await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
    const c = ready();
    c.observe(observation(primary, "same-logical"));
    let transport;
    try {
      transport = await c.startLocalTransport({ inspector: credentials,
        receiver: { port: sink.address().port, certificate: credentials.cert }, protocol: "h1" });
      for (let index = 0; index < 21; index++) {
        const socket = netConnect({ host: "127.0.0.1", port: transport.port });
        const status = await new Promise((resolve, reject) => {
          socket.setTimeout(5000, () => socket.destroy(Error("local_fixture_timeout")));
          socket.once("error", reject);
          socket.once("connect", () => socket.write("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n"));
          socket.once("data", bytes => resolve(bytes.toString()));
        });
        expect(status).toContain("200 Connection Established");
        const secure = tlsConnect({ socket, servername: "www.googleadservices.com", ca: credentials.cert,
          ALPNProtocols: ["http/1.1"] });
        let response = "";
        await new Promise(resolve => {
          secure.on("error", () => {});
          secure.once("secureConnect", () => secure.write(request(primary)));
          secure.on("data", bytes => { response += bytes; });
          secure.once("close", resolve);
        });
        expect(response.endsWith("\r\n\r\nok")).toBe(index < 20);
      }
      expect(arrivals).toBe(20);
      expect(c.snapshot().physical).toMatchObject({ observed: 21, forwarded: 20,
        stopped: true, reason: "physical_request_limit" });
      expect(transport.snapshot().public_upstream_requests).toBe(0);
    } finally {
      if (transport) await transport.close();
      await new Promise(resolve => sink.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
