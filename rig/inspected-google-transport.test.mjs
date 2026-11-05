import { connect, createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";
import { authenticateOwnedBrowserPeer, startLocalGoogleAuthorityBypass, startLocalGoogleInspectedTransport }
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

describe("SDK-free Google transport authority", () => {
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
