import { execFileSync } from "node:child_process";
import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { connect as h2Connect, createSecureServer } from "node:http2";
import { connect, createServer } from "node:net";
import { networkInterfaces } from "node:os";
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
const spki = certificate => createHash("sha256").update(new X509Certificate(certificate).publicKey
  .export({ type: "spki", format: "der" })).digest("hex");
const googleConnect = Buffer.from("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n");
const bounded = async (promise, maximum = 5000) => {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("fixture_timeout")), maximum);
    })]);
  } finally { clearTimeout(timer); }
};

function replacementIdentity(dir, name, hostname) {
  const key = `${dir}/${name}-key.pem`, cert = `${dir}/${name}-cert.pem`;
  execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-keyout", key, "-out", cert, "-subj", `/CN=${hostname}`,
    "-addext", `subjectAltName=DNS:${hostname}`], { stdio: "ignore", timeout: 10000 });
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

async function nodeProxySurrogate({ port, hostname, caseCertificate, ca, defeat = false, ready }) {
  // Node's supplied test CA is not Chrome's trust store.
  const socket = tlsConnect({ host: "127.0.0.1", port, servername: hostname,
    ca, rejectUnauthorized: false, ALPNProtocols: ["http/1.1"] });
  socket.on("error", () => {});
  try {
    await bounded(new Promise((resolve, reject) => {
      socket.once("secureConnect", resolve); socket.once("error", reject);
      socket.once("close", () => reject(Error("proxy_socket_closed")));
    }));
    await ready();
    const matchesCaseKey = spki(socket.getPeerCertificate().raw) === spki(caseCertificate);
    const facts = { authorized: socket.authorized, matchesCaseKey, alpn: socket.alpnProtocol };
    if (!socket.authorized && !matchesCaseKey && !defeat)
      throw Object.assign(Error("node_proxy_certificate_rejected"), facts);
    const response = new Promise((resolve, reject) => {
      let bytes = "";
      socket.on("data", chunk => {
        bytes += chunk.toString("latin1");
        if (bytes.includes("\r\n\r\n")) resolve(bytes);
      });
      socket.once("error", reject);
      socket.once("close", () => reject(Error("proxy_socket_closed")));
    });
    socket.write(googleConnect);
    expect(await bounded(response)).toBe("HTTP/1.1 200 Connection Established\r\n\r\n");
    return facts;
  } finally { socket.destroy(); }
}

async function localFixture({ wait = promise => promise, protocol = "h1", stallSetup = false,
  holdResponse = false, tlsProxy = false, peerPids = [process.pid], check = () => {} } = {}) {
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
    const start = tlsProxy ? (await import("./inspected-transport.mjs")).startLocalGoogleTlsInspectedTransport
      : startLocalGoogleInspectedTransport;
    transport = await start({
      inspector: identity, receiver: { port: sink.address().port, certificate: identity.cert,
        logicalAuthority: () => true }, protocol, observer, check, wait,
    });
    transport.attachOwnedBrowser({ send: async () => ({ processInfo: peerPids.map(id => ({ id })) }) });
    const open = async () => {
      const client = tlsProxy ? tlsConnect({ host: "127.0.0.1", port: transport.port,
        servername: transport.host_mapping.hostname, ca: identity.cert, rejectUnauthorized: false,
        ALPNProtocols: ["http/1.1"] }) : connect({ host: "127.0.0.1", port: transport.port });
      clients.add(client); client.on("error", () => {});
      await new Promise((resolve, reject) => {
        let response = "";
        client.once(tlsProxy ? "secureConnect" : "connect", () => {
          if (tlsProxy && (client.alpnProtocol !== "http/1.1"
            || !client.authorized && spki(client.getPeerCertificate().raw) !== spki(identity.cert))) {
            reject(Error("proxy_certificate_rejected")); client.destroy(); return;
          }
          client.write("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n");
        });
        client.on("data", function onData(bytes) {
          response += bytes;
          if (!response.includes("\r\n\r\n")) return;
          client.removeListener("data", onData);
          if (!response.startsWith("HTTP/1.1 200")) { client.destroy(); reject(Error(response)); }
          else resolve();
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
        return stream;
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
    return { transport, arrivals, sockets, clients, open, send, cleanup, observer, responses, identity, dir,
      connections: () => connections };
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
  it.each(["h1", "h2"])("relays a matched %s request through an experimental outer TLS broker", async protocol => {
    const fixture = await localFixture({ protocol, tlsProxy: true });
    try {
      expect(fixture.transport.host_mapping).toMatchObject({ address: "127.0.0.1" });
      expect(fixture.transport.host_mapping.hostname).toMatch(/^broker\.[a-f0-9]{32}\.localhost$/);
      expect(fixture.transport.proxy_url)
        .toBe(`https://${fixture.transport.host_mapping.hostname}:${fixture.transport.port}`);
      const client = await fixture.open();
      const outer = [...fixture.clients][0];
      expect(outer.alpnProtocol).toBe("http/1.1");
      expect(outer.authorized).toBe(false);
      expect(spki(outer.getPeerCertificate().raw)).toBe(spki(fixture.identity.cert));
      fixture.send(client, primary);
      await until(() => fixture.arrivals.length === 1 && fixture.observer.snapshot().forwarded === 1
        && fixture.observer.originals().responses[0]?.state === "complete");
      expect(fixture.transport.snapshot().tunnels).toMatchObject([{ protocol, upstream_authorized: true }]);
      expect(fixture.transport.snapshot().public_upstream_requests).toBe(0);
    } finally { await fixture.cleanup(); }
  }, 20000);

  it("denies an unowned Node peer at the experimental TLS broker", async () => {
    const fixture = await localFixture({ tlsProxy: true, peerPids: [] });
    try {
      await expect(bounded(fixture.open())).rejects.toThrow("HTTP/1.1 403");
      await until(() => fixture.transport.snapshot().tasks_settled);
      expect(fixture.transport.snapshot().denials.peer).toBe(1);
      expect(fixture.arrivals).toHaveLength(0);
      expect(fixture.observer.snapshot().forwarded).toBe(0);
    } finally { await fixture.cleanup(); }
  }, 20000);

  it("refuses a connection without the H1 proxy ALPN", async () => {
    const fixture = await localFixture({ tlsProxy: true });
    const socket = tlsConnect({ host: "127.0.0.1", port: fixture.transport.port,
      servername: fixture.transport.host_mapping.hostname, ca: fixture.identity.cert,
      rejectUnauthorized: false, ALPNProtocols: ["h2"] });
    let closed = false;
    socket.on("error", () => {}); socket.once("close", () => { closed = true; });
    try {
      await expect(bounded(new Promise((resolve, reject) => {
        socket.once("secureConnect", resolve); socket.once("error", reject);
      }))).rejects.toMatchObject({ code: "ERR_SSL_TLSV1_ALERT_NO_APPLICATION_PROTOCOL" });
      await until(() => closed);
      await until(() => fixture.transport.snapshot().sockets_closed);
      expect(fixture.transport.snapshot().connect_attempts).toBe(0);
      expect(fixture.arrivals).toHaveLength(0);
    } finally { socket.destroy(); await fixture.cleanup(); }
  }, 20000);

  it("generates a different fixed-format local broker name for each case", async () => {
    const first = await localFixture({ tlsProxy: true });
    let second;
    try {
      second = await localFixture({ tlsProxy: true });
      expect(first.transport.host_mapping.hostname).not.toBe(second.transport.host_mapping.hostname);
      expect(second.transport.host_mapping).toMatchObject({ address: "127.0.0.1" });
      expect(second.transport.host_mapping.hostname).toMatch(/^broker\.[a-f0-9]{32}\.localhost$/);
    } finally { if (second) await second.cleanup(); await first.cleanup(); }
  }, 20000);

  it.each([["h1", "admission"], ["h2", "admission"], ["h1", "direct"], ["h2", "direct"]])(
    "closes outer and inner sockets for active %s work on %s stop", async (protocol, method) => {
    const fixture = await localFixture({ protocol, tlsProxy: true });
    try {
      const client = await fixture.open();
      if (protocol === "h1") client.resume();
      fixture.send(client, primary);
      await until(() => fixture.arrivals.length === 1 && fixture.observer.originals().responses[0]?.state === "complete");
      const outer = [...fixture.clients][0];
      expect(outer.destroyed).toBe(false);
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      expect(fixture.transport.snapshot().admission_open).toBe(false);
      try { await until(() => outer.destroyed && fixture.sockets.size === 0); }
      catch (error) { throw Error(JSON.stringify({ outerDestroyed: outer.destroyed,
        receiverSockets: fixture.sockets.size, transport: fixture.transport.snapshot() }), { cause: error }); }
      await closing;
      if (method === "admission") {
        expect(fixture.transport.snapshot().ipv6_guard_listening).toBe(true);
        await expect(fixture.open()).rejects.toThrow("HTTP/1.1 403");
      }
      try { await until(() => fixture.transport.snapshot().sockets_closed && fixture.transport.snapshot().tasks_settled); }
      catch (error) { throw Error(JSON.stringify(fixture.transport.snapshot()), { cause: error }); }
      expect(fixture.arrivals).toHaveLength(1);
      expect(fixture.observer.snapshot().forwarded).toBe(1);
    } finally { await fixture.cleanup(); }
  }, 20000);

  it.each(["admission", "direct"])("settles an incomplete outer TLS handshake on %s stop", async method => {
    const fixture = await localFixture({ tlsProxy: true });
    const client = connect({ host: "127.0.0.1", port: fixture.transport.port });
    let closed = false;
    client.on("error", () => {}); client.once("close", () => { closed = true; });
    try {
      await new Promise((resolve, reject) => {
        client.once("connect", resolve); client.once("error", reject);
      });
      client.write(Buffer.from([0x16, 0x03, 0x01]));
      await until(() => !fixture.transport.snapshot().sockets_closed);
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      await until(() => closed && fixture.transport.snapshot().sockets_closed);
      await closing;
      expect(fixture.transport.snapshot()).toMatchObject({ admission_open: false, tasks_settled: true });
      if (method === "admission") expect(fixture.transport.snapshot().ipv6_guard_listening).toBe(true);
    } finally { client.destroy(); await fixture.cleanup(); }
  }, 20000);

  it.each(["admission", "direct"])("stops a peer authentication queued behind outer TLS on %s stop", async method => {
    const gate = holdAuthentication(), fixture = await localFixture({ tlsProxy: true, wait: gate.wait });
    try {
      const opened = fixture.open();
      await awaitPause(gate, opened);
      const closing = method === "direct" ? fixture.transport.close()
        : (fixture.transport.closeAdmission(), Promise.resolve());
      expect(fixture.transport.snapshot().admission_open).toBe(false);
      gate.release();
      await bounded(closing);
      await expect(opened).rejects.toThrow("client_closed");
      await until(() => fixture.transport.snapshot().tasks_settled && fixture.transport.snapshot().sockets_closed);
      expect(fixture.connections()).toBe(0);
      expect(fixture.observer.snapshot().forwarded).toBe(0);
    } finally { gate.release(); await fixture.cleanup(); }
  }, 20000);

  it("sends a TLS hello, not CONNECT, to a same-port plaintext replacement", async () => {
    const fixture = await localFixture({ tlsProxy: true });
    const port = fixture.transport.port, hostname = fixture.transport.host_mapping.hostname;
    const sockets = new Set();
    let replacement, surrogate, received = Buffer.alloc(0), connections = 0;
    try {
      const client = await bounded(fixture.open());
      client.resume(); fixture.send(client, primary);
      await until(() => fixture.arrivals.length === 1 && fixture.observer.originals().responses[0]?.state === "complete");
      fixture.transport.closeAdmission();
      await bounded(fixture.transport.close());
      expect(fixture.observer.snapshot().forwarded).toBe(1);
      replacement = createServer(socket => {
        connections++; sockets.add(socket); socket.on("error", () => {});
        socket.once("close", () => sockets.delete(socket));
        socket.on("data", bytes => {
          received = Buffer.concat([received, bytes]);
          socket.end("HTTP/1.1 200 Connection Established\r\n\r\n");
        });
      });
      await bounded(new Promise((resolve, reject) => {
        replacement.once("error", reject);
        replacement.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      }));
      surrogate = tlsConnect({ host: "127.0.0.1", port, servername: hostname,
        ca: fixture.identity.cert, rejectUnauthorized: false, ALPNProtocols: ["http/1.1"] });
      surrogate.on("error", () => {});
      await expect(bounded(new Promise((resolve, reject) => {
        surrogate.once("secureConnect", resolve); surrogate.once("error", reject);
        surrogate.once("close", () => reject(Error("proxy_socket_closed")));
      }))).rejects.toMatchObject({ code: "ERR_SSL_WRONG_VERSION_NUMBER" });
      await until(() => received.length > 0 && sockets.size === 0);
      expect(connections).toBe(1);
      expect(received[0]).toBe(0x16);
      expect(received.includes(Buffer.from("CONNECT "))).toBe(false);
      expect(fixture.observer.snapshot().forwarded).toBe(1);
    } finally {
      surrogate?.destroy();
      for (const socket of sockets) socket.destroy();
      try {
        if (replacement) await bounded(new Promise((resolve, reject) => replacement.close(error => error ? reject(error) : resolve())));
      } finally { await fixture.cleanup(); }
    }
  }, 20000);

  it("rejects another case key, while a defeated check and normal trust each deliver CONNECT", async () => {
    const fixture = await localFixture({ tlsProxy: true });
    const port = fixture.transport.port, hostname = fixture.transport.host_mapping.hostname;
    const records = [], sockets = new Set();
    let replacement;
    try {
      const client = await bounded(fixture.open());
      client.resume(); fixture.send(client, primary);
      await until(() => fixture.arrivals.length === 1 && fixture.observer.originals().responses[0]?.state === "complete");
      fixture.transport.closeAdmission();
      await bounded(fixture.transport.close());
      const otherCase = replacementIdentity(fixture.dir, "other-case", "www.googleadservices.com");
      const normallyTrusted = replacementIdentity(fixture.dir, "normally-trusted", hostname);
      expect(spki(otherCase.cert)).not.toBe(spki(fixture.identity.cert));
      expect(spki(normallyTrusted.cert)).not.toBe(spki(fixture.identity.cert));
      replacement = tlsServer({ ...otherCase, ALPNProtocols: ["http/1.1"] }, socket => {
        const row = { bytes: Buffer.alloc(0), closed: false };
        records.push(row); sockets.add(socket); socket.on("error", () => {});
        socket.once("close", () => { row.closed = true; sockets.delete(socket); });
        socket.on("data", bytes => {
          row.bytes = Buffer.concat([row.bytes, bytes]);
          if (row.bytes.length > googleConnect.length) return socket.destroy();
          if (row.bytes.length === googleConnect.length)
            socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        });
      });
      replacement.on("tlsClientError", () => {});
      await bounded(new Promise((resolve, reject) => {
        replacement.once("error", reject);
        replacement.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      }));
      const common = { port, hostname, caseCertificate: fixture.identity.cert, ca: fixture.identity.cert };
      await expect(nodeProxySurrogate({ ...common, ready: () => until(() => records.length === 1) }))
        .rejects.toMatchObject({ message: "node_proxy_certificate_rejected", authorized: false, matchesCaseKey: false });
      await until(() => records[0].closed);
      expect(records[0].bytes).toEqual(Buffer.alloc(0));

      // This test-only defeat skips certificate verification for a different key.
      const defeated = await nodeProxySurrogate({ ...common, defeat: true, ready: () => until(() => records.length === 2) });
      expect(defeated).toMatchObject({ authorized: false, matchesCaseKey: false, alpn: "http/1.1" });
      expect(records[1].bytes).toEqual(googleConnect);

      replacement.setSecureContext(normallyTrusted);
      const normal = await nodeProxySurrogate({ ...common, ca: normallyTrusted.cert, ready: () => until(() => records.length === 3) });
      expect(normal).toMatchObject({ authorized: true, matchesCaseKey: false, alpn: "http/1.1" });
      expect(records[2].bytes).toEqual(googleConnect);
      expect(fixture.observer.snapshot().forwarded).toBe(1);
    } finally {
      for (const socket of sockets) socket.destroy();
      try {
        if (replacement) await bounded(new Promise((resolve, reject) => replacement.close(error => error ? reject(error) : resolve())));
      } finally { await fixture.cleanup(); }
    }
  }, 20000);

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

  it.each([["h1", "admission", false], ["h2", "admission", false], ["h1", "direct", false], ["h2", "direct", false],
    ["h1", "admission", true], ["h2", "admission", true], ["h1", "direct", true], ["h2", "direct", true]])(
    "keeps a held partial %s response inconclusive on %s stop (TLS broker: %s)", async (protocol, method, tlsProxy) => {
    const positive = await localFixture({ protocol, holdResponse: true, tlsProxy });
    try {
      const client = await positive.open();
      if (protocol === "h1") client.resume();
      positive.send(client, primary);
      await until(() => positive.observer.originals().responses[0]?.decoded_body_bytes === 4);
      expect(positive.observer.originals().responses[0].state).toBe("streaming");
      positive.responses[0].end("tail");
      await until(() => positive.observer.originals().responses[0]?.state === "complete");
      expect(Buffer.concat(positive.observer.originals().responses[0].body).toString()).toBe("parttail");
    } finally { await positive.cleanup(); }

    const fixture = await localFixture({ protocol, holdResponse: true, tlsProxy });
    try {
      const client = await fixture.open();
      if (protocol === "h1") client.resume();
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

  it.each([["h1", true], ["h2", true], ["h1", false], ["h2", false]])(
    "retains a partial %s response after a receiver-originated TCP reset (outer TLS: %s)", async (protocol, tlsProxy) => {
    const fixture = await localFixture({ protocol, holdResponse: true, tlsProxy });
    try {
      const client = await bounded(fixture.open());
      let cleanEnd = false, responseClosed = false;
      const received = [], stream = protocol === "h1" ? client : fixture.send(client, primary);
      stream.on("data", bytes => received.push(bytes));
      stream.once("end", () => { cleanEnd = true; });
      stream.once("close", () => { responseClosed = true; });
      if (protocol === "h1") { stream.resume(); fixture.send(client, primary); }
      await until(() => fixture.observer.originals().responses[0]?.decoded_body_bytes === 4);
      await until(() => Buffer.concat(received).includes(Buffer.from("part")));
      const original = fixture.observer.originals().responses[0];
      expect(original.state).toBe("streaming");
      expect(Buffer.concat(original.body).toString()).toBe("part");
      expect(fixture.arrivals).toHaveLength(1);
      expect(fixture.observer.snapshot().forwarded).toBe(1);
      expect(fixture.sockets.size).toBe(1);
      const outer = [...fixture.clients][0];
      expect(outer.destroyed).toBe(false);
      expect(fixture.transport.snapshot().admission_open).toBe(true);
      [...fixture.sockets][0].resetAndDestroy();
      await until(() => fixture.transport.snapshot().tunnels[0]?.upstream_termination !== null);
      await until(() => fixture.transport.snapshot().tasks_settled && fixture.transport.snapshot().sockets_closed);
      await until(() => outer.destroyed && responseClosed);
      expect(fixture.transport.snapshot().diagnostic_errors).toEqual([]);
      expect(fixture.transport.snapshot().errors).toEqual([]);
      expect(fixture.transport.snapshot().tunnels[0].upstream_termination).toBe("upstream_connection_reset");
      expect(fixture.observer.originals().requests[0].response_state).toBe("inconclusive");
      expect(original).toMatchObject({ state: "inconclusive", headers: [], body: [],
        transport_error: "upstream_connection_reset" });
      expect(cleanEnd).toBe(false);
      expect(fixture.observer.snapshot().forwarded).toBe(1);
    } finally { await fixture.cleanup(); }
  }, 20000);

  it("resets the matching TLS peer when two local sources use the same source port", async () => {
    const fixture = await localFixture({ protocol: "h1", holdResponse: true, tlsProxy: true });
    try {
      const first = tlsConnect({ host: "127.0.0.1", port: fixture.transport.port, localAddress: "127.0.0.1",
        servername: fixture.transport.host_mapping.hostname, rejectUnauthorized: false, ALPNProtocols: ["http/1.1"] });
      let firstError = null;
      fixture.clients.add(first); first.on("error", error => { firstError ??= error; });
      await bounded(new Promise((resolve, reject) => {
        first.once("secureConnect", resolve); first.once("error", reject);
      }));
      expect(first.alpnProtocol).toBe("http/1.1");
      expect(spki(first.getPeerCertificate().raw)).toBe(spki(fixture.identity.cert));
      const addresses = [...new Set(Object.values(networkInterfaces()).flat()
        .filter(item => item && item.family === "IPv4" && !item.internal).map(item => item.address))];
      let secondTcp;
      const sourceDeadline = Date.now() + 10000;
      for (const localAddress of addresses) {
        const remaining = sourceDeadline - Date.now();
        if (remaining <= 0) break;
        const candidate = connect({ host: "127.0.0.1", port: fixture.transport.port,
          localAddress, localPort: first.localPort });
        fixture.clients.add(candidate);
        try {
          await bounded(new Promise((resolve, reject) => {
            candidate.once("connect", resolve); candidate.once("error", reject);
          }), Math.min(2000, remaining));
          secondTcp = candidate;
          break;
        } catch (error) {
          candidate.destroy();
          if (error.message !== "fixture_timeout" && !["EADDRNOTAVAIL", "EADDRINUSE", "ENETUNREACH",
            "EHOSTUNREACH", "ETIMEDOUT"].includes(error.code)) throw error;
        }
      }
      if (!secondTcp) throw Error("collision_control_no_reachable_configured_source_within_deadline");
      expect(secondTcp.localPort).toBe(first.localPort);
      expect(secondTcp.localAddress).not.toBe(first.localAddress);
      expect(secondTcp.remoteAddress).toBe("127.0.0.1");
      expect(secondTcp.remotePort).toBe(fixture.transport.port);
      const second = tlsConnect({ socket: secondTcp, servername: fixture.transport.host_mapping.hostname,
        rejectUnauthorized: false, ALPNProtocols: ["http/1.1"] });
      fixture.clients.add(second);
      let secondError = null, secondClosed = false, secondReply = "";
      second.on("error", error => { secondError = error; });
      second.on("data", bytes => { secondReply += bytes.toString("latin1"); });
      second.once("close", () => { secondClosed = true; });
      await bounded(new Promise((resolve, reject) => {
        second.once("secureConnect", resolve); second.once("error", reject);
      }));
      expect(second.alpnProtocol).toBe("http/1.1");
      expect(spki(second.getPeerCertificate().raw)).toBe(spki(fixture.identity.cert));
      await bounded(new Promise((resolve, reject) => {
        let response = "";
        first.on("data", function onData(bytes) {
          response += bytes.toString("latin1");
          if (!response.includes("\r\n\r\n")) return;
          first.removeListener("data", onData);
          if (response !== "HTTP/1.1 200 Connection Established\r\n\r\n") reject(Error("unexpected_connect_response"));
          else resolve();
        });
        first.once("error", reject);
        first.write(googleConnect);
      }));
      const inner = tlsConnect({ socket: first, servername: "www.googleadservices.com",
        ca: fixture.identity.cert, ALPNProtocols: ["http/1.1"] });
      let innerError = null;
      fixture.clients.add(inner); inner.on("error", error => { innerError ??= error; });
      await bounded(new Promise((resolve, reject) => {
        inner.once("secureConnect", resolve); inner.once("error", reject);
      }));
      let cleanEnd = false, responseClosed = false;
      const received = [];
      inner.on("data", bytes => received.push(bytes));
      inner.once("end", () => { cleanEnd = true; });
      inner.once("close", () => { responseClosed = true; });
      inner.resume();
      fixture.send(inner, primary);
      await until(() => fixture.observer.originals().responses[0]?.decoded_body_bytes === 4
        && Buffer.concat(received).includes(Buffer.from("part")));
      expect(fixture.arrivals).toHaveLength(1);
      expect(fixture.observer.originals().responses[0].state).toBe("streaming");
      expect(second.destroyed).toBe(false);
      expect(fixture.sockets.size).toBe(1);
      [...fixture.sockets][0].resetAndDestroy();
      await until(() => responseClosed && fixture.transport.snapshot().tasks_settled
        && fixture.transport.snapshot().tunnels[0]?.upstream_termination !== null);
      if (!second.destroyed) second.write("GET / HTTP/1.1\r\nHost: fixture.invalid\r\nConnection: close\r\n\r\n");
      await until(() => secondReply.includes("\r\n\r\n") || secondError || secondClosed);
      if (firstError && firstError.code !== "ECONNRESET") throw firstError;
      if (innerError && innerError.code !== "ECONNRESET") throw innerError;
      if (secondError && secondError.code !== "ECONNRESET") throw secondError;
      expect.soft(secondReply.split("\r\n")[0]).toBe("HTTP/1.1 403 Forbidden");
      expect.soft(cleanEnd).toBe(false);
      expect(fixture.transport.snapshot().tunnels[0].upstream_termination).toBe("upstream_connection_reset");
      expect(fixture.transport.snapshot().diagnostic_errors).toEqual([]);
      expect(fixture.transport.snapshot().errors).toEqual([]);
      expect(fixture.observer.originals().requests[0].response_state).toBe("inconclusive");
      expect(fixture.observer.originals().responses[0]).toMatchObject({
        state: "inconclusive", headers: [], body: [], transport_error: "upstream_connection_reset",
      });
      expect(fixture.observer.snapshot().forwarded).toBe(1);
    } finally { await fixture.cleanup(); }
  }, 45000);

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

  it("observes plaintext port substitution using an explicitly compromised fixture key", async () => {
    const bounded = async promise => {
      let timer;
      try {
        return await Promise.race([promise, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("substitution_timeout")), 5000);
        })]);
      } finally { clearTimeout(timer); }
    };
    const fixture = await localFixture({ wait: bounded }), port = fixture.transport.port;
    const closeServer = server => bounded(new Promise((resolve, reject) => server.close(error =>
      error && error.code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve())));
    const blockedBind = async (host, ipv6Only = false) => {
      const probe = createServer();
      try {
        await bounded(new Promise((resolve, reject) => {
          probe.once("error", reject);
          probe.listen({ host, port, ipv6Only, exclusive: true }, resolve);
        }));
        throw Error("unexpected_replacement_bind");
      } catch (error) {
        if (error.code !== "EADDRINUSE") throw error;
        return error.code;
      } finally { await closeServer(probe); }
    };
    const sockets = new Set();
    let replacement, surrogate, secure;
    const connectBytes = Buffer.from("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n");
    const target = new URL(primary);
    const applicationBytes = Buffer.from(`GET ${target.pathname + target.search} HTTP/1.1\r\nHost: ${target.host}\r\n\r\n`);
    const response = "HTTP/1.1 200 Connection Established\r\n\r\n";
    let receivedConnect = Buffer.alloc(0), receivedApplication = Buffer.alloc(0), connections = 0;
    try {
      const originalClient = await bounded(fixture.open());
      fixture.send(originalClient, primary);
      await until(() => fixture.arrivals.length === 1 && fixture.observer.snapshot().forwarded === 1
        && fixture.observer.originals().responses[0]?.state === "complete");
      fixture.transport.closeAdmission();
      expect(fixture.transport.snapshot()).toMatchObject({ admission_open: false, ipv6_guard_listening: true });
      expect(await blockedBind("127.0.0.1")).toBe("EADDRINUSE");
      expect(await blockedBind("::1", true)).toBe("EADDRINUSE");
      expect(await request(port, "www.googleadservices.com:443")).toBe("HTTP/1.1 403 Denied");
      await bounded(fixture.transport.close());
      const oldForwarded = fixture.observer.snapshot().forwarded;
      expect(oldForwarded).toBe(1);

      // Test-only key-compromise control: the replacement uses the fixture's inspector key.
      const tunnel = tlsServer({ ...fixture.identity, ALPNProtocols: ["http/1.1"] }, socket => {
        socket.on("error", () => {});
        socket.on("data", bytes => {
          receivedApplication = Buffer.concat([receivedApplication, bytes]);
          if (receivedApplication.length > applicationBytes.length) socket.destroy();
          else if (receivedApplication.length === applicationBytes.length)
            socket.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok");
        });
      });
      tunnel.on("tlsClientError", () => {});
      replacement = createServer(socket => {
        connections++;
        sockets.add(socket); socket.on("error", () => {}); socket.once("close", () => sockets.delete(socket));
        socket.on("data", function onConnect(bytes) {
          receivedConnect = Buffer.concat([receivedConnect, bytes]);
          if (receivedConnect.length > connectBytes.length) return socket.destroy();
          if (receivedConnect.length !== connectBytes.length) return;
          socket.removeListener("data", onConnect);
          socket.write(response);
          tunnel.emit("connection", socket);
        });
      });
      await bounded(new Promise((resolve, reject) => {
        replacement.once("error", reject);
        replacement.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
      }));
      surrogate = connect({ host: "127.0.0.1", port });
      surrogate.on("error", () => {});
      const handshake = new Promise((resolve, reject) => {
        let received = "";
        surrogate.once("connect", () => surrogate.write(connectBytes));
        surrogate.on("data", function onData(bytes) {
          received += bytes.toString("latin1");
          if (!received.includes("\r\n\r\n")) return;
          surrogate.removeListener("data", onData);
          resolve(received);
        });
        surrogate.once("error", reject);
        surrogate.once("close", () => reject(Error("surrogate_closed")));
      });
      expect(await bounded(handshake)).toBe(response);
      secure = tlsConnect({ socket: surrogate, servername: "www.googleadservices.com",
        ca: fixture.identity.cert, ALPNProtocols: ["http/1.1"] });
      secure.on("error", () => {});
      await bounded(new Promise((resolve, reject) => { secure.once("secureConnect", resolve); secure.once("error", reject); }));
      secure.write(applicationBytes);
      await until(() => receivedApplication.length === applicationBytes.length);
      expect(connections).toBe(1);
      expect(receivedConnect).toEqual(connectBytes);
      expect(receivedApplication).toEqual(applicationBytes);
      expect(fixture.observer.snapshot().forwarded).toBe(oldForwarded);
      expect(fixture.arrivals).toHaveLength(1);
    } finally {
      secure?.destroy();
      surrogate?.destroy();
      for (const socket of sockets) socket.destroy();
      try { if (replacement) await closeServer(replacement); }
      finally { await bounded(fixture.cleanup()); }
    }
  }, 20000);

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
