import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { connect as h2Connect, createSecureServer } from "node:http2";
import { connect, createServer } from "node:net";
import { resolve } from "node:path";
import { connect as tlsConnect, createServer as tlsServer } from "node:tls";
import { describe, expect, it } from "vitest";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";
import { authenticateOwnedBrowserPeer, startLocalGoogleAuthorityBypass, startLocalGoogleInspectedTransport, startLocalGoogleProtocolControl }
  from "./inspected-transport.mjs";

const request = (port, authority) => new Promise((resolve, reject) => {
  const socket = connect({ host: "127.0.0.1", port });
  let response = "";
  socket.setTimeout(3000, () => socket.destroy(Error("probe_timeout")));
  socket.on("connect", () => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`));
  socket.on("data", bytes => { response += bytes; });
  socket.on("end", () => resolve(response.split("\r\n")[0]));
  socket.on("error", reject);
});

const primary = "https://www.googleadservices.com/pagead/conversion/000000000/"
  + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
  + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
const profile = {
  schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
  document_url: "https://owned.example/inspection",
  owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
    value: 1, currency: "USD", transaction_id: "synthetic-transaction" },
  resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
    sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
  companion_authorized: true,
};
const until = async (predicate, maximum = 5000) => {
  const end = Date.now() + maximum;
  while (!predicate()) {
    if (Date.now() >= end) throw Error("fixture_timeout");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

async function localFixture({ wait = promise => promise, protocol = "h1", stallSetup = false,
  holdResponse = false, check = () => {} } = {}) {
  const dir = resolve("rig/out", `google-stop-${randomBytes(8).toString("hex")}`);
  mkdirSync(dir, { mode: 0o700 });
  let sink, transport;
  const sockets = new Set(), clients = new Set(), sessions = new Set(), arrivals = [], responses = [];
  let connections = 0;
  try {
    execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`, "-subj", "/CN=www.googleadservices.com",
      "-addext", "subjectAltName=DNS:www.googleadservices.com"], { stdio: "ignore", timeout: 10000 });
    const identity = { key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) };
    const handle = (req, res) => {
      req.on("error", () => {}); res.on("error", () => {});
      arrivals.push(req.url);
      if (holdResponse) {
        responses.push(res);
        res.writeHead(200, { "content-length": 8 });
        res.write("part");
      } else {
        res.writeHead(200, { "content-length": 2 });
        res.end("ok");
      }
    };
    if (stallSetup) sink = createServer(socket => socket.resume());
    else if (protocol === "h2") {
      sink = createSecureServer({ ...identity, ALPNProtocols: ["h2"] }, handle);
      sink.on("session", session => {
        sessions.add(session); session.on("error", () => {}); session.once("close", () => sessions.delete(session));
      });
    } else {
      const app = createHttpServer(handle);
      sink = tlsServer({ ...identity, ALPNProtocols: ["http/1.1"] }, socket => app.emit("connection", socket));
    }
    sink.on("tlsClientError", () => {});
    sink.on("connection", socket => {
      connections++;
      sockets.add(socket); socket.on("error", () => {}); socket.once("close", () => sockets.delete(socket));
    });
    await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
    const logical = [primary, `${primary}&random=1`].map((url, i) => ({
      url, method: "GET", network_id: `node-${i}`, resource_type: "XHR",
    }));
    const observer = createInspectedHttpWire({ mode: "DECLARED-GOOGLE-PROFILE", profile,
      resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method) });
    transport = await startLocalGoogleInspectedTransport({
      inspector: identity, receiver: { port: sink.address().port, certificate: identity.cert,
        logicalAuthority: () => true }, protocol, observer, check, wait,
    });
    transport.attachOwnedBrowser({ send: async () => ({ processInfo: [{ id: process.pid }] }) });
    const open = async () => {
      const client = connect({ host: "127.0.0.1", port: transport.port });
      clients.add(client); client.on("error", () => {});
      await new Promise((resolve, reject) => {
        let response = "";
        client.once("connect", () => client.write("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n"));
        client.on("data", function onData(bytes) {
          response += bytes;
          if (!response.includes("\r\n\r\n")) return;
          client.removeListener("data", onData);
          if (!response.startsWith("HTTP/1.1 200")) reject(Error(response)); else resolve();
        });
        client.once("error", reject);
        client.once("close", () => reject(Error("client_closed")));
      });
      const secure = tlsConnect({ socket: client, servername: "www.googleadservices.com",
        ca: identity.cert, ALPNProtocols: [protocol === "h2" ? "h2" : "http/1.1"] });
      clients.add(secure); secure.on("error", () => {});
      await new Promise((resolve, reject) => { secure.once("secureConnect", resolve); secure.once("error", reject); });
      if (protocol === "h1") return secure;
      const session = h2Connect("https://www.googleadservices.com", { createConnection: () => secure });
      sessions.add(session); session.on("error", () => {}); session.once("close", () => sessions.delete(session));
      return session;
    };
    const send = (secure, url) => {
      const parsed = new URL(url);
      if (protocol === "h1") secure.write(`GET ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n\r\n`);
      else {
        const stream = secure.request({ ":method": "GET", ":scheme": "https", ":authority": parsed.host,
          ":path": parsed.pathname + parsed.search });
        stream.on("error", () => {}); stream.resume(); stream.end();
      }
    };
    const cleanup = async () => {
      for (const session of sessions) session.destroy();
      for (const socket of clients) socket.destroy();
      await transport.close();
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => sink.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    };
    return { transport, arrivals, sockets, open, send, cleanup, observer, responses, connections: () => connections };
  } catch (error) {
    for (const session of sessions) session.destroy();
    for (const socket of clients) socket.destroy();
    if (transport) await transport.close();
    for (const socket of sockets) socket.destroy();
    if (sink) await new Promise(resolve => sink.close(resolve));
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

async function awaitPause(gate, opening, maximum = 5000) {
  let timer;
  try {
    await Promise.race([
      gate.paused,
      opening.then(() => { throw Error("fixture_opened_before_pause"); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error("fixture_pause_timeout")), maximum); }),
    ]);
  } finally { clearTimeout(timer); }
}

function holdAuthentication() {
  let release, ready;
  const resumed = new Promise(resolve => { release = resolve; });
  const paused = new Promise(resolve => { ready = resolve; });
  return {
    paused, release,
    async wait(promise) {
      const result = await promise;
      if (result && typeof result.stdout === "string") {
        ready();
        await resumed;
      }
      return result;
    },
  };
}

function holdUpstreamSetup() {
  let release, ready, authenticated = false;
  const resumed = new Promise(resolve => { release = resolve; });
  const paused = new Promise(resolve => { ready = resolve; });
  return {
    paused, release,
    async wait(promise) {
      const result = await promise;
      if (result && typeof result.stdout === "string") authenticated = true;
      else if (authenticated) {
        authenticated = false;
        ready();
        await resumed;
      }
      return result;
    },
  };
}

describe("SDK-free Google transport authority", () => {
  it("reports opening failure or an absent pause without waiting for the test timeout", async () => {
    const never = new Promise(() => {});
    await expect(awaitPause({ paused: never }, Promise.reject(Error("opening_failed")))).rejects.toThrow("opening_failed");
    await expect(awaitPause({ paused: never }, never, 20)).rejects.toThrow("fixture_pause_timeout");
  });

  it.each(["authentication", "setup"])("tears down owned sockets when opening fails before the %s pause", async stage => {
    let authenticated = false;
    const wait = async promise => {
      const result = await promise;
      if (result && typeof result.stdout === "string") {
        if (stage === "authentication") throw Error("fixture_auth_failure");
        authenticated = true;
      } else if (authenticated) {
        authenticated = false;
        throw Error("fixture_setup_failure");
      }
      return result;
    };
    const fixture = await localFixture({ wait });
    const gate = stage === "authentication" ? holdAuthentication() : holdUpstreamSetup();
    try {
      const opened = fixture.open();
      await expect(awaitPause(gate, opened)).rejects.toThrow(stage === "authentication" ? "client_closed" : "HTTP/1.1 403");
    } finally { gate.release(); await fixture.cleanup(); }
    await until(() => fixture.transport.snapshot().sockets_closed && fixture.sockets.size === 0);
    expect(fixture.transport.snapshot()).toMatchObject({ server_closed: true, sockets_closed: true, tasks_settled: true });
  }, 20000);

  it("releases the real authentication latch when a pause wait times out", async () => {
    const gate = holdAuthentication(), fixture = await localFixture({ wait: gate.wait });
    try {
      const opened = fixture.open();
      await awaitPause(gate, opened);
      await expect(awaitPause({ paused: new Promise(() => {}) }, opened, 20)).rejects.toThrow("fixture_pause_timeout");
    } finally { gate.release(); await fixture.cleanup(); }
    await until(() => fixture.transport.snapshot().sockets_closed);
    expect(fixture.transport.snapshot()).toMatchObject({ server_closed: true, sockets_closed: true, tasks_settled: true });
  }, 20000);

  it("settles a stopped upstream that never completes TLS setup", async () => {
    const wait = async promise => {
      let timer;
      try {
        return await Promise.race([promise, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("fixture_wait_timeout")), 2000);
        })]);
      } finally { clearTimeout(timer); }
    };
    const fixture = await localFixture({ wait, stallSetup: true });
    try {
      const opened = fixture.open().catch(() => null);
      await until(() => fixture.connections() === 1);
      fixture.transport.closeAdmission();
      await until(() => fixture.sockets.size === 0);
      await until(() => fixture.transport.snapshot().tasks_settled, 1000);
      expect(fixture.transport.snapshot()).toMatchObject({ admission_open: false, tasks_settled: true });
      expect(fixture.observer.snapshot().reason).not.toBe("upstream_tls_failed");
      await opened;
    } finally { await fixture.cleanup(); }
  }, 20000);

  it.each(["admission", "direct"])("does not construct a tunnel after %s stop during completed upstream setup", async method => {
    const control = holdUpstreamSetup(), positive = await localFixture({ wait: control.wait });
    try {
      const opened = positive.open();
      await awaitPause(control, opened);
      control.release();
      const client = await opened;
      positive.send(client, primary);
      await until(() => positive.arrivals.length === 1);
      expect(positive.transport.snapshot().tunnels).toHaveLength(1);
    } finally { control.release(); await positive.cleanup(); }

    const gate = holdUpstreamSetup(), fixture = await localFixture({ wait: gate.wait });
    try {
      const opened = fixture.open();
      await awaitPause(gate, opened);
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      expect(fixture.transport.snapshot().admission_open).toBe(false);
      if (method === "admission") expect(fixture.transport.snapshot().ipv6_guard_listening).toBe(true);
      gate.release();
      await closing;
      await expect(opened).rejects.toThrow("client_closed");
      await until(() => fixture.transport.snapshot().tasks_settled);
      expect(fixture.transport.snapshot().tunnels).toHaveLength(0);
      expect(fixture.arrivals).toHaveLength(0);
    } finally { gate.release(); await fixture.cleanup(); }
  }, 20000);

  it.each(["admission", "direct"])("blocks pending peer authentication on %s stop", async method => {
    const control = holdAuthentication(), positive = await localFixture({ wait: control.wait });
    try {
      const opened = positive.open();
      await awaitPause(control, opened);
      control.release();
      const client = await opened;
      positive.send(client, primary);
      await until(() => positive.arrivals.length === 1);
      expect(positive.connections()).toBe(1);
    } finally { control.release(); await positive.cleanup(); }

    const gate = holdAuthentication(), fixture = await localFixture({ wait: gate.wait });
    try {
      const opened = fixture.open();
      await awaitPause(gate, opened);
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      expect(fixture.transport.snapshot().admission_open).toBe(false);
      gate.release();
      await closing;
      await expect(opened).rejects.toThrow("client_closed");
      await until(() => fixture.transport.snapshot().tasks_settled && fixture.transport.snapshot().sockets_closed);
      expect(fixture.connections()).toBe(0);
      expect(fixture.transport.snapshot()).toMatchObject({ sockets_closed: true, tasks_settled: true });
    } finally { gate.release(); await fixture.cleanup(); }
  }, 20000);

  it.each(["h1", "h2"])("stops an active %s relay when its existing check expires", async protocol => {
    let expired = false;
    const fixture = await localFixture({ protocol, check() { if (expired) throw Error("case_window_inactive"); } });
    try {
      const client = await fixture.open();
      fixture.send(client, primary);
      await until(() => fixture.arrivals.length === 1);
      expired = true;
      fixture.send(client, `${primary}&random=1`);
      await until(() => fixture.sockets.size === 0);
      expect(fixture.observer.snapshot()).toMatchObject({ stopped: true, reason: "case_window_inactive" });
      expect(await request(fixture.transport.port, "www.googleadservices.com:443")).toBe("HTTP/1.1 403 Denied");
      expect(fixture.arrivals).toHaveLength(1);
      expect(fixture.transport.snapshot().ipv6_guard_listening).toBe(true);
    } finally { await fixture.cleanup(); }
  }, 20000);

  it("denies authenticated pending work when the existing check expires", async () => {
    let expired = false;
    const gate = holdAuthentication();
    const fixture = await localFixture({ wait: gate.wait,
      check() { if (expired) throw Error("case_window_inactive"); } });
    try {
      const opened = fixture.open();
      await awaitPause(gate, opened);
      expired = true;
      gate.release();
      await expect(opened).rejects.toThrow("HTTP/1.1 403");
      await until(() => fixture.transport.snapshot().tasks_settled);
      expect(fixture.connections()).toBe(0);
      expect(fixture.observer.snapshot()).toMatchObject({ stopped: true, reason: "case_window_inactive" });
      expect(fixture.transport.snapshot().ipv6_guard_listening).toBe(true);
    } finally { gate.release(); await fixture.cleanup(); }
  }, 20000);

  it("denies completed upstream setup when the existing check expires", async () => {
    let expired = false;
    const gate = holdUpstreamSetup();
    const fixture = await localFixture({ wait: gate.wait,
      check() { if (expired) throw Error("case_window_inactive"); } });
    try {
      const opened = fixture.open();
      await awaitPause(gate, opened);
      expired = true;
      gate.release();
      await expect(opened).rejects.toThrow("HTTP/1.1 403");
      await until(() => fixture.sockets.size === 0 && fixture.transport.snapshot().tasks_settled);
      expect(fixture.transport.snapshot().tunnels).toHaveLength(0);
      expect(fixture.arrivals).toHaveLength(0);
      expect(fixture.observer.snapshot()).toMatchObject({ stopped: true, reason: "case_window_inactive" });
    } finally { gate.release(); await fixture.cleanup(); }
  }, 20000);

  it.each([["h1", "admission"], ["h2", "admission"], ["h1", "direct"], ["h2", "direct"]])(
    "cancels an active %s upstream on %s stop", async (protocol, method) => {
    const fixture = await localFixture({ protocol });
    try {
      const client = await fixture.open();
      fixture.send(client, primary);
      try { await until(() => fixture.arrivals.length === 1); }
      catch { throw Error(JSON.stringify({ observer: fixture.observer.snapshot(), transport: fixture.transport.snapshot() })); }
      fixture.send(client, `${primary}&random=1`);
      await until(() => fixture.arrivals.length === 2);
      expect(fixture.sockets.size).toBe(1);
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      expect(fixture.transport.snapshot().admission_open).toBe(false);
      if (method === "admission") expect(fixture.transport.snapshot().ipv6_guard_listening).toBe(true);
      await until(() => fixture.sockets.size === 0);
      await closing;
      try { fixture.send(client, primary); }
      catch (error) {
        if (protocol !== "h2" || error.code !== "ERR_HTTP2_INVALID_SESSION") throw error;
      }
      if (method === "admission")
        expect(await request(fixture.transport.port, "www.googleadservices.com:443")).toBe("HTTP/1.1 403 Denied");
      else await expect(request(fixture.transport.port, "www.googleadservices.com:443")).rejects.toMatchObject({ code: "ECONNREFUSED" });
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(fixture.arrivals).toHaveLength(2);
      await until(() => fixture.transport.snapshot().tasks_settled && fixture.transport.snapshot().sockets_closed);
    } finally { await fixture.cleanup(); }
  }, 20000);

  it.each([["h1", "admission"], ["h2", "admission"], ["h1", "direct"], ["h2", "direct"]])(
    "keeps a held partial %s response inconclusive on %s stop", async (protocol, method) => {
    const positive = await localFixture({ protocol, holdResponse: true });
    try {
      const client = await positive.open();
      positive.send(client, primary);
      await until(() => positive.observer.originals().responses[0]?.decoded_body_bytes === 4);
      expect(positive.observer.originals().responses[0].state).toBe("streaming");
      positive.responses[0].end("tail");
      await until(() => positive.observer.originals().responses[0]?.state === "complete");
      expect(Buffer.concat(positive.observer.originals().responses[0].body).toString()).toBe("parttail");
    } finally { await positive.cleanup(); }

    const fixture = await localFixture({ protocol, holdResponse: true });
    try {
      const client = await fixture.open();
      fixture.send(client, primary);
      await until(() => fixture.observer.originals().responses[0]?.decoded_body_bytes === 4);
      const original = fixture.observer.originals().responses[0];
      expect(original.state).toBe("streaming");
      expect(Buffer.concat(original.body).toString()).toBe("part");
      expect(fixture.sockets.size).toBe(1);
      const socket = [...fixture.sockets][0];
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      await until(() => socket.destroyed && fixture.sockets.size === 0);
      await closing;
      await until(() => fixture.transport.snapshot().tasks_settled);
      expect(fixture.transport.snapshot().tunnels[0].upstream_termination).toBe("upstream_unexpected_close");
      expect(fixture.observer.originals().requests[0].response_state).toBe("inconclusive");
      expect(original).toMatchObject({ state: "inconclusive", headers: [], body: [],
        transport_error: "upstream_unexpected_close" });
    } finally { await fixture.cleanup(); }
  }, 20000);

  it("holds the same-port IPv6 loopback guard until the Google broker closes", async () => {
    const transport = await startLocalGoogleInspectedTransport({
      inspector: {}, receiver: { port: 1, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      protocol: "h1", observer: createInspectedHttpWire(), check() {}, wait: promise => promise,
    });
    const probe = async port => {
      const server = createServer();
      const outcome = await new Promise(resolve => {
        server.once("error", error => resolve(error.code));
        server.listen({ host: "::1", port, ipv6Only: true }, () => resolve("listening"));
      });
      if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      return outcome;
    };
    const { port } = transport;
    try { expect(await probe(port)).toBe("EADDRINUSE"); }
    finally { await transport.close(); }
    expect(await probe(port)).toBe("listening");
  });

  it("denies a peer when lsof reports no established socket without treating it as a relay failure", async () => {
    const cdp = { send: async () => ({ processInfo: [] }) };
    expect(await authenticateOwnedBrowserPeer(cdp, { localPort: 1, remotePort: 1 }, promise => promise, true)).toBe(false);
    await expect(authenticateOwnedBrowserPeer(cdp, { localPort: 1, remotePort: 1 }, promise => promise))
      .rejects.toThrow("Command failed");
  });

  it("keeps the fixed foreign-authority bypass loopback-only and authenticated", async () => {
    await expect(startLocalGoogleAuthorityBypass({
      inspector: {}, receiver: { port: 1 }, protocol: "h1", observer: createInspectedHttpWire(),
      check() {}, wait: promise => promise,
    })).rejects.toThrow("local_diagnostic_observer_required");
    const observer = { snapshot: () => ({ diagnostic_bypass: true }), stop() {} };
    const transport = await startLocalGoogleAuthorityBypass({
      inspector: {}, receiver: { port: 1, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      protocol: "h1", observer, check() {}, wait: promise => promise,
    });

    try {
      expect(await request(transport.port, "other.example:443")).toBe("HTTP/1.1 403 Denied");
      expect(await request(transport.port, "foreign.example:443")).toBe("HTTP/1.1 403 Denied");
      expect(transport.snapshot().denials).toMatchObject({ authority: 1, peer: 1 });
      expect(transport.snapshot().public_upstream_requests).toBe(0);
    } finally { await transport.close(); }
  });

  it("does not allow a native policy observer to enable the opposite-ALPN bypass", async () => {
    await expect(startLocalGoogleProtocolControl({
      inspector: {}, receiver: { port: 1 }, protocol: "h1", observer: createInspectedHttpWire(),
      check() {}, wait: promise => promise,
    }, true)).rejects.toThrow("local_diagnostic_observer_required");
  });

  it("denies an expired CONNECT without forwarding or disguising the deadline as a relay error", async () => {
    const observer = createInspectedHttpWire();
    const transport = await startLocalGoogleInspectedTransport({
      inspector: {}, receiver: { port: 1, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      protocol: "h1", observer, check() { throw Error("case_window_inactive"); }, wait: promise => promise,
    });
    try {
      expect(await request(transport.port, "www.googleadservices.com:443")).toBe("HTTP/1.1 403 Denied");
      expect(observer.snapshot().reason).toBe("case_window_inactive");
      expect(transport.snapshot().errors).toEqual([]);
    } finally { await transport.close(); }
  });

  it("denies unknown authorities and unauthenticated callers before the loopback receiver", async () => {
    let arrivals = 0;
    const sink = createServer(socket => { arrivals++; socket.destroy(); });
    await new Promise(resolve => sink.listen(0, "127.0.0.1", resolve));
    const transport = await startLocalGoogleInspectedTransport({
      inspector: {}, receiver: { port: sink.address().port, certificate: Buffer.alloc(0),
        logicalAuthority: () => true }, protocol: "h1", observer: createInspectedHttpWire(),
      check() {}, wait: promise => promise,
    });
    try {
      expect(await request(transport.port, "unknown.example:443")).toBe("HTTP/1.1 403 Denied");
      expect(await request(transport.port, "www.googleadservices.com:443")).toBe("HTTP/1.1 403 Denied");
      expect(transport.snapshot().denials).toMatchObject({ authority: 1, peer: 1 });
      expect(arrivals).toBe(0);
      transport.closeAdmission();
      expect(await request(transport.port, "www.googleadservices.com:443")).toBe("HTTP/1.1 403 Denied");
      expect(transport.snapshot().denials).toMatchObject({ admission_closed: 1 });
    } finally {
      await transport.close();
      await new Promise((resolve, reject) => sink.close(error => error ? reject(error) : resolve()));
    }
  });
});
