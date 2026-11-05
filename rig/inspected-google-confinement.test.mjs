import { createServer } from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { createSocket } from "node:dgram";
import { mkdtempSync, realpathSync, rmdirSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";
import { startLocalGoogleInspectedTransport } from "./inspected-transport.mjs";

const bounded = async promise => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error("owned_browser_close_timeout")), 3000);
  })]); } finally { clearTimeout(timer); }
};

describe("Google browser network confinement", () => {
  it("denies same-port UDP to an owned receiver that the matched bypass reaches", async () => {
    const broker = createNetServer(), receiver = createSocket("udp4");
    const socketDir = realpathSync(tmpdir()), wrapper = fileURLToPath(new URL("./inspected-google-loopback-chrome", import.meta.url));
    let arrivals = 0, bound = false;
    receiver.on("message", () => { arrivals++; });
    const run = async (profile, port) => {
      const source = "const d=require('node:dgram').createSocket('udp4');d.on('error',e=>{console.log(e.code);d.close()});"
        + "d.send(Buffer.from('owned'),Number(process.argv[1]),'127.0.0.1',e=>{"
        + "console.log(e?e.code:'sent');d.close()});";
      const { stdout } = await promisify(execFile)("/usr/bin/sandbox-exec",
        ["-p", profile, process.execPath, "-e", source, String(port)], { timeout: 5000, maxBuffer: 4096 });
      await new Promise(resolve => setTimeout(resolve, 100));
      return stdout.trim();
    };
    try {
      await new Promise((resolve, reject) => broker.once("error", reject).listen(0, "127.0.0.1", resolve));
      const port = broker.address().port;
      await new Promise((resolve, reject) => receiver.once("error", reject).bind(port, "127.0.0.1", resolve));
      bound = true;
      const env = { ...process.env, TMPDIR: socketDir, AIRLOCK_GOOGLE_SOCKET_DIR: socketDir,
        AIRLOCK_GOOGLE_BROKER_PORT: String(port) };
      const profile = execFileSync(wrapper, ["--airlock-print-profile"], { env, timeout: 3000 }).toString()
        + "\n(allow network-bind (local udp))";
      expect(["EPERM", "EACCES"]).toContain(await run(profile, port));
      expect(arrivals).toBe(0);
      expect(await run(profile + `\n(allow network-outbound (remote udp "localhost:${port}"))`, port)).toBe("sent");
      expect(arrivals).toBe(1);
    } finally {
      if (bound) await new Promise(resolve => receiver.close(resolve));
      if (broker.listening) await new Promise((resolve, reject) =>
        broker.close(error => error ? reject(error) : resolve()));
    }
  }, 15000);

  it("denies Unix outbound to an owned receiver that the matched bypass reaches", async () => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), "ag-")), path = join(root, "sock");
    const socketDir = realpathSync(tmpdir()), wrapper = fileURLToPath(new URL("./inspected-google-loopback-chrome", import.meta.url));
    const env = { ...process.env, TMPDIR: socketDir, AIRLOCK_GOOGLE_SOCKET_DIR: socketDir, AIRLOCK_GOOGLE_BROKER_PORT: "1" };
    let arrivals = 0;
    const receiver = createNetServer(socket => { arrivals++; socket.end(); });
    const run = async candidate => {
      const source = "const net=require('node:net');const s=net.connect(process.argv[1]);"
        + "s.on('connect',()=>{console.log('connected');s.end()});"
        + "s.on('error',e=>{console.log(e.code)});";
      const { stdout } = await promisify(execFile)("/usr/bin/sandbox-exec",
        ["-p", candidate, process.execPath, "-e", source, path], { timeout: 5000, maxBuffer: 4096 });
      return stdout.trim();
    };
    try {
      const profile = execFileSync(wrapper, ["--airlock-print-profile"], { env, timeout: 3000 }).toString();
      await new Promise((resolve, reject) => receiver.once("error", reject).listen(path, resolve));
      expect(["EPERM", "EACCES"]).toContain(await run(profile));
      expect(arrivals).toBe(0);
      expect(await run(profile + `\n(allow network-outbound (subpath "${root}"))`)).toBe("connected");
      expect(arrivals).toBe(1);
    } finally {
      if (receiver.listening) await new Promise((resolve, reject) =>
        receiver.close(error => error ? reject(error) : resolve()));
      rmdirSync(root);
    }
  }, 15000);

  it("exposes the same-port IPv6 gap in the broker-port sandbox", async () => {
    const probe = async restricted => {
      const socketDir = realpathSync(tmpdir());
      let arrivals = 0, brokerArrivals = 0, ipv6Arrivals = 0;
      const sockets = new Set();
      const broker = createServer((_request, response) => { brokerArrivals++; response.end("owned broker"); });
      const other = createServer((_request, response) => { arrivals++; response.end("owned synthetic receiver"); });
      const ipv6 = createServer((_request, response) => { ipv6Arrivals++; response.end("owned IPv6 receiver"); });
      const listeners = [broker, other, ipv6];
      for (const listener of listeners) listener.on("connection", socket => {
        sockets.add(socket); socket.once("close", () => sockets.delete(socket));
      });
      let server, browser, failure, cleanupFailure;
      try {
        await Promise.all([broker, other].map(listener => new Promise((resolve, reject) =>
          listener.once("error", reject).listen(0, "127.0.0.1", resolve))));
        await new Promise((resolve, reject) => ipv6.once("error", reject)
          .listen({ port: broker.address().port, host: "::1", ipv6Only: true }, resolve));
        const wrapper = restricted ? "./inspected-google-loopback-chrome" : "./qualification-loopback-chrome";
        server = await chromium.launchServer({ executablePath: fileURLToPath(new URL(wrapper, import.meta.url)),
          host: "127.0.0.1", headless: true, timeout: 8000,
          env: { ...process.env, TMPDIR: socketDir, AIRLOCK_GOOGLE_SOCKET_DIR: socketDir,
            AIRLOCK_GOOGLE_BROKER_PORT: String(broker.address().port) },
          proxy: { server: `http://127.0.0.1:${broker.address().port}` },
          args: ["--disable-background-networking", "--proxy-bypass-list=127.0.0.1;[::1]"] });
        browser = await chromium.connect(server.wsEndpoint());
        const context = await browser.newContext(), page = await context.newPage();
        await page.goto("http://owned.example/", { timeout: 3000 });
        expect(brokerArrivals).toBeGreaterThan(0);
        if (restricted)
          await expect(page.goto(`http://127.0.0.1:${other.address().port}/`, { timeout: 3000 })).rejects.toThrow();
        else await page.goto(`http://127.0.0.1:${other.address().port}/`, { timeout: 3000 });
        expect(arrivals).toBe(restricted ? 0 : 1);
        if (restricted)
          await expect(page.goto(`http://[::1]:${broker.address().port}/`, { timeout: 3000 })).rejects.toThrow();
        else await page.goto(`http://[::1]:${broker.address().port}/`, { timeout: 3000 });
        expect(ipv6Arrivals).toBe(1);
        await context.close();
      } catch (error) {
        failure = error;
      } finally {
        if (browser) try { await bounded(browser.close()); } catch (error) { cleanupFailure = error; }
        if (server) try { await bounded(server.close()); } catch (error) {
          cleanupFailure ??= error;
          await bounded(server.kill());
        }
        for (const socket of sockets) socket.destroy();
        await Promise.all(listeners.filter(listener => listener.listening).map(listener => new Promise((resolve, reject) =>
          listener.close(error => error ? reject(error) : resolve()))));
      }
      if (failure && cleanupFailure) throw new AggregateError([failure, cleanupFailure], "confinement_probe_failed");
      if (failure) throw failure;
      if (cleanupFailure) throw cleanupFailure;
    };
    await probe(true);
    await probe(false);
  }, 30000);

  it("keeps the transport-owned IPv6 guard until the confined browser exits", async () => {
    const socketDir = realpathSync(tmpdir());
    const observer = createInspectedHttpWire();
    const transport = await startLocalGoogleInspectedTransport({
      inspector: {}, receiver: { port: 1, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      protocol: "h1", observer, check() {}, wait: promise => promise,
    });
    let server, browser, failure, cleanupFailure;
    try {
      server = await chromium.launchServer({
        executablePath: fileURLToPath(new URL("./inspected-google-loopback-chrome", import.meta.url)),
        host: "127.0.0.1", headless: true, timeout: 8000,
        env: { ...process.env, TMPDIR: socketDir, AIRLOCK_GOOGLE_SOCKET_DIR: socketDir,
          AIRLOCK_GOOGLE_BROKER_PORT: String(transport.port) },
        proxy: { server: `http://127.0.0.1:${transport.port}` },
        args: ["--disable-background-networking", "--proxy-bypass-list=[::1]"],
      });
      browser = await chromium.connect(server.wsEndpoint());
      const context = await browser.newContext(), page = await context.newPage();
      await expect(page.goto(`http://[::1]:${transport.port}/`, { timeout: 3000 })).rejects.toThrow();
      expect(transport.snapshot().ipv6_guard_connections).toBeGreaterThan(0);
      expect(observer.snapshot().reason).toBe("ipv6_guard_connection");
      await context.close();
      await bounded(browser.close()); browser = null;
      await bounded(server.close()); server = null;
      expect(transport.snapshot().ipv6_guard_listening).toBe(true);
    } catch (error) {
      failure = error;
    } finally {
      if (browser) try { await bounded(browser.close()); } catch (error) { cleanupFailure = error; }
      if (server) try { await bounded(server.close()); } catch (error) {
        cleanupFailure ??= error;
        await bounded(server.kill());
      }
      await transport.close();
    }
    if (failure && cleanupFailure) throw new AggregateError([failure, cleanupFailure], "confinement_probe_failed");
    if (failure) throw failure;
    if (cleanupFailure) throw cleanupFailure;
    expect(transport.snapshot().server_closed).toBe(true);
  }, 20000);
});
