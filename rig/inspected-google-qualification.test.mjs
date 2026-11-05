import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SDK-free Google receiving qualification", () => {
  it("rejects unknown controls before any output or network is created", async () => {
    const { runLocalGoogleQualification } = await import("./inspected-google-qualification.mjs");
    await expect(runLocalGoogleQualification({ protocol: "h1", control: "native", outputDir: "/invalid" }))
      .rejects.toThrow("invalid_google_qualification");
  });

  it("binds both existing source inventories to the modified Google files", async () => {
    const { metaSourcePins } = await import("./native-stock-meta.mjs");
    const { inspectedMetaSourcePins } = await import("./inspected-meta-stock.mjs");
    const inventories = [metaSourcePins(), inspectedMetaSourcePins()];
    for (const name of ["inspected-google-qualification.mjs", "inspected-google-qualification.test.mjs",
      "inspected-google-witness.mjs", "inspected-google-witness.test.mjs"]) {
      const digest = createHash("sha256").update(readFileSync(new URL(name, import.meta.url))).digest("hex");
      for (const pins of inventories) expect(pins[name]).toBe(digest);
    }
  });

  it("retains the guard after failed close and kill until the owned child exits", async () => {
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
    const events = [], errors = [], cleanup = {};
    const transport = {
      closeAdmission() { events.push("admission"); },
      snapshot() { return { ipv6_guard_listening: !events.includes("transport") }; },
      async close() { events.push("transport"); },
    };
    const browserServer = {
      process: () => child,
      async close() { events.push("close"); throw Error("failed"); },
      async kill() { events.push("kill"); throw Error("failed"); },
    };
    await closeLocalGoogleBrowser({ browserServer, launchAttempted: true, transport,
      settle: promise => promise, cleanup, errors });
    expect(events).toEqual(["admission", "close", "kill"]);
    expect(cleanup).toMatchObject({ browser_process_exited: false, transport_guard_retained: true });
    expect(errors).toContain("cleanup_incomplete");
    expect(errors).toContain("browser_server_close_failed");
    expect(errors).toContain("browser_process_close_failed");
    child.exitCode = 1;
    child.emit("exit", 1, null);
    await new Promise(resolve => setImmediate(resolve));
    expect(events).toEqual(["admission", "close", "kill", "transport"]);
  });

  it("closes transport after a verified exit but preserves close failure", async () => {
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null });
    const events = [], errors = [], cleanup = {};
    const transport = {
      closeAdmission() { events.push("admission"); },
      snapshot() { return { ipv6_guard_listening: !events.includes("transport") }; },
      async close() { events.push("transport"); },
    };
    const browserServer = {
      process: () => child,
      async close() { child.exitCode = 1; events.push("exit"); throw Error("failed"); },
      async kill() { throw Error("unexpected_kill"); },
    };
    await closeLocalGoogleBrowser({ browserServer, launchAttempted: true, transport,
      settle: promise => promise, cleanup, errors });
    expect(events).toEqual(["admission", "exit", "transport"]);
    expect(cleanup).toMatchObject({ browser_process_exited: true, ipv6_guard_at_browser_exit: true,
      transport_guard_retained: false });
    expect(errors).toContain("browser_server_close_failed");
  });

  it("retains the guard if launch was attempted but ownership is unavailable", async () => {
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    const events = [], errors = [], cleanup = {};
    const transport = { closeAdmission() { events.push("admission"); },
      snapshot() { return { ipv6_guard_listening: true }; }, async close() { events.push("transport"); } };
    await closeLocalGoogleBrowser({ launchAttempted: true, transport,
      settle: promise => promise, cleanup, errors });
    expect(events).toEqual(["admission"]);
    expect(cleanup).toMatchObject({ browser_process_exited: false, transport_guard_retained: true });
    expect(errors).toContain("cleanup_incomplete");
  });

  it("reports an unavailable owned-process handle without closing the guard", async () => {
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    const events = [], errors = [], cleanup = {};
    const browserServer = { async close() {}, process() { throw Error("unavailable"); } };
    const transport = { closeAdmission() { events.push("admission"); },
      snapshot() { return { ipv6_guard_listening: true }; }, async close() { events.push("transport"); } };
    await closeLocalGoogleBrowser({ browserServer, launchAttempted: true, transport,
      settle: promise => promise, cleanup, errors });
    expect(events).toEqual(["admission"]);
    expect(cleanup).toMatchObject({ browser_process_exited: false, transport_guard_retained: true });
    expect(errors).toContain("browser_process_ownership_unavailable");
    expect(errors).toContain("cleanup_incomplete");
  });

  it("reports a guard that was already lost rather than claiming retention", async () => {
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    const errors = [], cleanup = {};
    const transport = { closeAdmission() {}, snapshot() { return { ipv6_guard_listening: false }; },
      async close() { throw Error("must_not_close"); } };
    await closeLocalGoogleBrowser({ launchAttempted: true, transport, settle: promise => promise, cleanup, errors });
    expect(cleanup).toMatchObject({ browser_process_exited: false, transport_guard_retained: false });
    expect(errors).toContain("ipv6_guard_not_retained");
    expect(errors).toContain("cleanup_incomplete");
  });

  it("closes transport when no browser launch was attempted", async () => {
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    const events = [], errors = [], cleanup = {};
    const transport = { closeAdmission() { events.push("admission"); },
      snapshot() { return { ipv6_guard_listening: true }; }, async close() { events.push("transport"); } };
    await closeLocalGoogleBrowser({ launchAttempted: false, transport, settle: promise => promise, cleanup, errors });
    expect(events).toEqual(["admission", "transport"]);
    expect(cleanup).toMatchObject({ browser_process_exited: true, transport_guard_retained: false });
    expect(errors).toEqual([]);
  });
});
