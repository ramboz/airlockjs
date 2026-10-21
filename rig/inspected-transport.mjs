import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { createServer as httpServer } from "node:http";
import { connect as tlsConnect, createServer as tlsServer } from "node:tls";
import { promisify } from "node:util";
import { claimNativeMetaTransport } from "./inspected-meta-stock.mjs";

const execute = promisify(execFile);
const AUTHORITY = "www.facebook.com:443";

export function inspectedDecoderDependencyPins() {
  const require = createRequire(import.meta.url), result = {};
  const hpack = createRequire(require.resolve("hpack.js"));
  const stream = createRequire(hpack.resolve("readable-stream"));
  const wbuf = createRequire(hpack.resolve("wbuf"));
  const decoder = createRequire(stream.resolve("string_decoder/"));
  const graph = [["hpack.js", require], ["inherits", hpack], ["obuf", hpack],
    ["readable-stream", hpack], ["wbuf", hpack], ["minimalistic-assert", wbuf],
    ["core-util-is", stream], ["isarray", stream], ["process-nextick-args", stream],
    ["string_decoder", stream], ["util-deprecate", stream], ["safe-buffer", stream]];
  const locations = new Map(graph.map(([name, resolver]) => [name, resolver.resolve(name + "/package.json")]));
  if (wbuf.resolve("obuf/package.json") !== hpack.resolve("obuf/package.json")
    || stream.resolve("inherits/package.json") !== hpack.resolve("inherits/package.json")
    || decoder.resolve("safe-buffer/package.json") !== stream.resolve("safe-buffer/package.json"))
    throw new Error("unsupported_dependency_layout");
  let files = 0, bytes = 0;
  for (const [name, resolver] of graph) {
    const root = dirname(resolver.resolve(name + "/package.json")), digest = createHash("sha256");
    let packageInfo;
    const visit = (path, depth = 0) => {
      if (depth > 16 || !lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
        throw new Error("unsafe_dependency_source");
      for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === "node_modules") {
          if (path !== root) throw new Error("unsupported_dependency_layout");
          continue;
        }
        const item = join(path, entry.name), before = lstatSync(item, { bigint: true });
        if (entry.isDirectory()) visit(item, depth + 1);
        else if (entry.isFile() && before.isFile() && before.nlink === 1n) {
          if (++files > 4096 || before.size > 2097152n || (bytes += Number(before.size)) > 33554432)
            throw new Error("dependency_source_limit");
          const content = readFileSync(item), after = lstatSync(item, { bigint: true });
          if (before.dev !== after.dev || before.ino !== after.ino || before.mtimeNs !== after.mtimeNs
            || before.ctimeNs !== after.ctimeNs || content.length !== Number(before.size))
            throw new Error("dependency_source_changed");
          digest.update(item.slice(root.length)).update(content);
          if (item === join(root, "package.json")) packageInfo = JSON.parse(content);
        } else throw new Error("unsafe_dependency_source");
      }
    };
    visit(root);
    const fromPackage = createRequire(locations.get(name));
    for (const dependency of Object.keys({ ...packageInfo.dependencies, ...packageInfo.optionalDependencies }))
      if (!locations.has(dependency)
        || fromPackage.resolve(dependency + "/package.json") !== locations.get(dependency))
        throw new Error("unsupported_dependency_layout");
    result[name] = { version: packageInfo.version, sha256: digest.digest("hex") };
  }
  return result;
}

export async function authenticateOwnedBrowserPeer(browserCdp, socket, wait) {
  const info = await browserCdp.send("SystemInfo.getProcessInfo");
  const allowed = new Set(info.processInfo.map(process => Number(process.id)));
  const result = await wait(execute("/usr/sbin/lsof", ["-nP", "-a", "-u", String(process.getuid()),
    "-iTCP:" + socket.localPort, "-sTCP:ESTABLISHED", "-Fpn"], { timeout: 2000, maxBuffer: 65536 }));
  const expected = `127.0.0.1:${socket.remotePort}->127.0.0.1:${socket.localPort}`;
  let pid = null;
  for (const line of result.stdout.split("\n")) {
    if (/^p[0-9]+$/.test(line)) pid = Number(line.slice(1));
    if (line === "n" + expected && allowed.has(pid)) return true;
  }
  return false;
}

// Raw application bytes only: no HTTP re-encoding, clean-EOF manufacture or
// destination selection. Callers own authentication, upstream TLS and budgets.
export function relayInspectedSockets({ client, remote, inspector, protocol, gate, observer,
  own, task, bounded, requestBytes, acceptedRequest, responseBytes, afterResponse, inspectorReady,
  acceptedResponse, inspectorError, stopped, upstreamClosed }) {
  const server = tlsServer({ ...inspector, ALPNProtocols: [protocol === "h2" ? "h2" : "http/1.1"] }, secure => {
    own(secure); inspectorReady(secure);
    secure.on("data", bytes => {
      if (!requestBytes(bytes)) return;
      const accepted = observer ? gate.request(bytes) : gate.push(bytes);
      if (accepted.length && acceptedRequest(accepted) === false) return;
      if (accepted.length && !remote.write(accepted)) {
        secure.pause(); remote.once("drain", () => secure.resume());
      }
      if (stopped()) { remote.end(); secure.destroy(); }
    });
    let responseWork = Promise.resolve(), upstreamEnded = false, upstreamError = null;
    remote.on("error", error => {
      upstreamError ??= error.code === "ECONNRESET" ? "upstream_connection_reset" : "upstream_transport_error";
    });
    remote.on("data", bytes => {
      remote.pause();
      if (!responseBytes(bytes)) return;
      responseWork = responseWork.then(async () => {
        const accepted = observer ? await gate.response(bytes) : bytes;
        if (accepted.length && acceptedResponse(accepted) === false) return;
        if (accepted.length && !secure.destroyed && !secure.write(accepted))
          await bounded(new Promise(resolve => {
            const settle = () => { secure.removeListener("drain", settle); secure.removeListener("close", settle); resolve(); };
            secure.once("drain", settle); secure.once("close", settle);
          }));
        afterResponse();
        if (stopped()) { remote.end(); secure.destroy(); }
        if (!remote.destroyed) remote.resume();
      });
      task(responseWork);
    });
    remote.once("end", () => { upstreamEnded = true; });
    remote.once("close", hadError => {
      const termination = upstreamError ?? (upstreamEnded && !hadError ? "clean_eof"
        : hadError ? "upstream_transport_error" : "upstream_unexpected_close");
      upstreamClosed(termination);
      responseWork = responseWork.then(async () => {
        if (observer) await gate.endResponse(termination);
        if (termination !== "clean_eof") {
          if (!client.destroyed) client.resetAndDestroy();
          secure.destroy();
        } else if (stopped()) secure.destroy();
        else secure.end();
      });
      task(responseWork);
    });
    secure.once("close", () => {
      if (observer) gate.endRequest(); else gate.end();
      remote.end(); server.removeAllListeners();
    });
  });
  server.on("tlsClientError", () => { inspectorError(); client.destroy(); remote.destroy(); });
  client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
  server.emit("connection", client);
  client.once("close", () => remote.end());
}

// No parameters, custom CA, lookup, proxy, URL or certificate override. This
// function is reachable only through a private, reserved native engine lease.
function connectFixedMetaCollector() {
  return tlsConnect({ host: "www.facebook.com", port: 443, servername: "www.facebook.com",
    rejectUnauthorized: true, ALPNProtocols: ["h2", "http/1.1"] });
}

export async function startNativeInspectedTransport(lease) {
  // Claim before listening, certificate use, DNS or TLS. Synthetic plans and
  // caller-authored objects cannot mint or serialize this one-use capability.
  const config = claimNativeMetaTransport(lease);
  return startInspectedTransport({ ...config, expectedProtocol: null, mode: "native",
    openUpstream: connectFixedMetaCollector });
}

/** Fixed literal-loopback fixture caller of the SAME broker and raw relay. */
export async function startLocalInspectedTransport({ inspector, receiver, protocol, observer, check, wait }) {
  if (!["h1", "h2"].includes(protocol) || !Number.isInteger(receiver.port) || receiver.port < 1 || receiver.port > 65535)
    throw new Error("invalid_local_transport");
  return startInspectedTransport({ inspector, observer, check, wait, mode: "sdk-absent",
    beforeConnect: check,
    logicalAuthority: receiver.logicalAuthority, expectedProtocol: protocol,
    openUpstream: () => tlsConnect({ host: "127.0.0.1", port: receiver.port,
      servername: "www.facebook.com", ca: receiver.certificate, rejectUnauthorized: true,
      ALPNProtocols: [protocol === "h2" ? "h2" : "http/1.1"] }) });
}
async function startInspectedTransport({ inspector, observer, check, wait, logicalAuthority, beforeConnect, openUpstream, expectedProtocol, mode }) {
  const sockets = new Set(), tasks = new Set(), errors = [], denials = {}, tunnels = [];
  let browserSession = null, closed = false, serverClosing = null, authenticatedPeers = 0;
  let connectAttempts = 0;
  const own = socket => {
    sockets.add(socket); socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket)); return socket;
  };
  const stop = () => { for (const socket of sockets) socket.destroy(); };
  const track = work => {
    tasks.add(work);
    work.catch(() => { errors.push("local_relay_failed"); observer.stop("local_relay_failed"); stop(); })
      .finally(() => tasks.delete(work));
  };
  const authenticate = async socket => {
    check();
    if (!browserSession) return false;
    const result = await authenticateOwnedBrowserPeer(browserSession, socket, wait);
    check();
    return result;
  };
  const proxy = httpServer((_request, response) => response.writeHead(403).end());
  proxy.on("connection", own);
  proxy.on("connect", (request, client, head) => track((async () => {
    const deny = reason => {
      denials[reason] = (denials[reason] ?? 0) + 1;
      client.end("HTTP/1.1 403 Denied\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    };
    check();
    if (++connectAttempts > 64) { observer.stop("transport_observation_limit"); return deny("observation_limit"); }
    if (closed || request.url !== AUTHORITY || head.length) return deny("authority");
    if (!await authenticate(client)) return deny("peer");
    authenticatedPeers++;
    if (observer.snapshot().stopped || !logicalAuthority())
      return deny("no_authority");
    beforeConnect();
    const remote = own(openUpstream());
    let protocol;
    try {
      await wait(new Promise((resolve, reject) => {
        remote.once("secureConnect", resolve); remote.once("error", reject);
      }));
      check();
      protocol = remote.alpnProtocol === "h2" ? "h2" : remote.alpnProtocol === "http/1.1" ? "h1" : null;
      if (!remote.authorized || !protocol || expectedProtocol && protocol !== expectedProtocol
        || remote.servername !== "www.facebook.com") throw new Error("upstream_tls_failed");
    } catch {
      observer.stop("upstream_tls_failed"); remote.destroy(); return deny("upstream_certificate");
    }
    const tunnel = { upstream_peer_port: remote.localPort, protocol, upstream_authorized: true,
      upstream_validation: mode === "native" ? "default-ca-and-hostname" : "generated-local-ca-and-hostname",
      request: createHash("sha256"),
      response: createHash("sha256"), request_bytes: 0, response_bytes: 0, upstream_termination: null };
    tunnels.push(tunnel);
    relayInspectedSockets({ client, remote, inspector, protocol, gate: observer.connection(protocol), observer,
      own, task: track, bounded: wait,
      requestBytes() {
        try { check(); return true; }
        catch { observer.stop("case_window_inactive"); stop(); return false; }
      },
      responseBytes(bytes) {
        try {
          check(); tunnel.response.update(bytes); tunnel.response_bytes += bytes.length; return true;
        }
        catch { observer.stop("case_window_inactive"); stop(); return false; }
      },
      acceptedRequest(bytes) {
        try { check(); tunnel.request.update(bytes); tunnel.request_bytes += bytes.length; return true; }
        catch { observer.stop("case_window_inactive"); stop(); return false; }
      },
      acceptedResponse() {
        try { check(); return true; }
        catch { observer.stop("case_window_inactive"); stop(); return false; }
      },
      upstreamClosed(termination) { tunnel.upstream_termination = termination; },
      stopped: () => observer.snapshot().stopped,
      afterResponse: check, inspectorReady() {},
      inspectorError() { observer.stop("inspector_tls_failure"); },
    });
  })()));
  await wait(new Promise((resolve, reject) => {
    proxy.once("error", reject); proxy.listen(0, "127.0.0.1", resolve);
  }));
  return Object.freeze({
    port: proxy.address().port,
    attachOwnedBrowser(session) {
      if (browserSession || closed) throw new Error("local_browser_already_bound");
      browserSession = session;
    },
    snapshot: () => ({ mode, connect_attempts: connectAttempts, authenticated_peers: authenticatedPeers,
      denials: { ...denials }, errors: [...errors],
      public_upstream_requests: mode === "native" ? observer.snapshot().forwarded : 0,
      tunnels: tunnels.map(({ request, response, ...row }) => ({
        ...row, request_sha256: request.copy().digest("hex"), response_sha256: response.copy().digest("hex"),
      })),
      sockets_closed: sockets.size === 0, tasks_settled: tasks.size === 0, server_closed: closed }),
    async close() {
      stop();
      if (!serverClosing) serverClosing = new Promise((resolve, reject) =>
        proxy.close(error => error ? reject(error) : resolve()));
      await wait(serverClosing);
      await wait(Promise.allSettled([...tasks]));
      closed = true;
    },
  });
}
