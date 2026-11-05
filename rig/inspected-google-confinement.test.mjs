import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chromium } from "playwright";

describe("Google browser network confinement", () => {
  it("exposes the same-port IPv6 gap in the broker-port sandbox", async () => {
    const probe = async restricted => {
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
      const bounded = async promise => {
        let timer;
        try { return await Promise.race([promise, new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("owned_browser_close_timeout")), 3000);
        })]); } finally { clearTimeout(timer); }
      };
      try {
        await Promise.all([broker, other].map(listener => new Promise((resolve, reject) =>
          listener.once("error", reject).listen(0, "127.0.0.1", resolve))));
        await new Promise((resolve, reject) => ipv6.once("error", reject)
          .listen({ port: broker.address().port, host: "::1", ipv6Only: true }, resolve));
        const wrapper = restricted ? "./inspected-google-loopback-chrome" : "./qualification-loopback-chrome";
        server = await chromium.launchServer({ executablePath: fileURLToPath(new URL(wrapper, import.meta.url)),
          host: "127.0.0.1", headless: true, timeout: 8000,
          env: { ...process.env, AIRLOCK_GOOGLE_BROKER_PORT: String(broker.address().port) },
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
});
