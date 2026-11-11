import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(), execFile: vi.fn(), execFilePromise: vi.fn(), lstat: vi.fn(), mkdir: vi.fn(), open: vi.fn(),
  fsync: vi.fn(), close: vi.fn(), read: vi.fn(), write: vi.fn(), sources: vi.fn(), cohort: vi.fn(), run: vi.fn(),
  chmod: vi.fn(), exists: vi.fn(), unlink: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(),
  realpath: vi.fn(), server: vi.fn(), guardServer: vi.fn(), tlsConnect: vi.fn(),
  observer: vi.fn(), transport: vi.fn(), originals: vi.fn(), supported: vi.fn(), chromium: {},
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn, execFile: mocks.execFile }));
vi.mock("node:fs", async importOriginal => ({
  ...await importOriginal(), lstatSync: mocks.lstat, mkdirSync: mocks.mkdir,
  openSync: mocks.open, fsyncSync: mocks.fsync, closeSync: mocks.close,
  chmodSync: mocks.chmod, existsSync: mocks.exists, unlinkSync: mocks.unlink,
  readFileSync: mocks.readFile, writeFileSync: mocks.writeFile, realpathSync: mocks.realpath,
}));
vi.mock("node:crypto", async importOriginal => ({
  ...await importOriginal(), X509Certificate: class {
    publicKey = { export: () => Buffer.from("synthetic-public-key") };
  },
}));
vi.mock("node:http", () => ({ createServer: mocks.server }));
vi.mock("node:http2", () => ({ createSecureServer: mocks.server, constants: {} }));
vi.mock("node:net", () => ({ createServer: mocks.guardServer }));
vi.mock("node:tls", () => ({ createServer: mocks.server, connect: mocks.tlsConnect, TLSSocket: class {} }));
vi.mock("playwright", () => ({ chromium: mocks.chromium }));
vi.mock("./native-stock-meta.mjs", () => ({ readMetaPrivate: mocks.read, writeMetaPrivate: mocks.write }));
vi.mock("./inspected-meta-stock.mjs", () => ({
  inspectedMetaSourcePins: mocks.sources, claimNativeMetaTransport: vi.fn(),
}));
vi.mock("./inspected-google-cohort.mjs", () => ({
  currentGoogleCohort: mocks.cohort, isSupportedGoogleChromeVersion: mocks.supported,
}));
vi.mock("./inspected-http-wire.mjs", () => ({
  createInspectedHttpWire: mocks.observer, createInspectedRequestFramer: vi.fn(),
}));
vi.mock("./inspected-transport.mjs", () => ({
  startLocalGoogleAuthorityBypass: mocks.transport, startLocalGoogleInspectedTransport: mocks.transport,
  startLocalGoogleProtocolControl: mocks.transport,
}));
vi.mock("./inspected-google-originals.mjs", () => ({ writeGoogleOriginals: mocks.originals }));
vi.mock("./inspected-google-qualification.mjs", async importOriginal => ({
  ...await importOriginal(), runLocalGoogleQualification: mocks.run,
}));

describe("Google failed-case custody with synthetic handles only", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.execFile[Symbol.for("nodejs.util.promisify.custom")] = mocks.execFilePromise;
    mocks.execFilePromise.mockResolvedValue({ stdout: "p123\nn127.0.0.1:23456->127.0.0.1:12345\n" });
    vi.spyOn(process, "getuid").mockReturnValue(1000);
    mocks.lstat.mockReturnValue({ isDirectory: () => true, isSymbolicLink: () => false,
      uid: 1000, mode: 0o700 });
    mocks.open.mockReturnValue(1);
    mocks.sources.mockReturnValue({ source: "synthetic" });
    mocks.cohort.mockReturnValue({ cohort: "synthetic" });
    mocks.read.mockReturnValue(Buffer.from("{}"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records an incomplete deadline without waiting for a stalled child to close", async () => {
    vi.useFakeTimers();
    mocks.sources.mockImplementationOnce(() => {
      vi.advanceTimersByTime(20000);
      return { source: "synthetic" };
    });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    const transport = {
      closeAdmission: vi.fn(), close: vi.fn(),
      snapshot: () => ({ ipv6_guard_listening: true }),
    };
    let finish;
    mocks.run.mockImplementation((_options, custody) => {
      custody.onTransport(transport);
      custody.onChild(child);
      return new Promise(resolve => { finish = resolve; });
    });
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    const pending = witnessLocalGoogleQualification({
      protocol: "h1", control: "positive", outputDir: "/synthetic-custody-never-created/case",
    }).catch(() => {});
    try {
      await vi.advanceTimersByTimeAsync(39999);
      expect(mocks.write).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(mocks.write.mock.calls.some(([, value]) => value.complete === false
        && /deadline|expir|timeout/.test(String(value.reason ?? value.failure_category ?? "")))).toBe(true);
      expect(transport.closeAdmission).toHaveBeenCalledOnce();
      expect(transport.close).not.toHaveBeenCalled();
      expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    } finally {
      child.emit("exit", 1, null);
      child.emit("close", 1, null);
      finish();
      await pending;
    }
  });

  it("does not release the existing reject guard merely because the root exited", async () => {
    let guardListening = true;
    const transport = {
      closeAdmission: vi.fn(),
      snapshot: () => ({ ipv6_guard_listening: guardListening }),
      close: vi.fn(async () => { guardListening = false; }),
    };
    const browserServer = {
      close: vi.fn(async () => {}),
      process: () => ({ exitCode: 0, signalCode: null }),
    };
    const cleanup = {}, errors = [];
    const { closeLocalGoogleBrowser } = await import("./inspected-google-qualification.mjs");
    await closeLocalGoogleBrowser({ browserServer, launchAttempted: true, transport,
      settle: promise => promise, cleanup, errors });
    expect(transport.closeAdmission).toHaveBeenCalledOnce();
    expect(guardListening).toBe(true);
  });

  it.each(["rejected", "timed-out"])("retains exact owned handles when browser close and kill are %s", async mode => {
    vi.useFakeTimers();
    const root = { pid: 123, exitCode: null, signalCode: null };
    const unresolved = () => mode === "rejected" ? Promise.reject(Error("synthetic-close-failure")) : new Promise(() => {});
    const browserServer = { process: () => root, close: vi.fn(unresolved), kill: vi.fn(unresolved) };
    const browser = { close: vi.fn(async () => {}) }, context = { close: vi.fn(async () => {}) };
    const transport = {
      closeAdmission: vi.fn(), close: vi.fn(),
      snapshot: () => ({ ipv6_guard_listening: true }),
    };
    let captured;
    const actual = await vi.importActual("./inspected-google-qualification.mjs");
    mocks.run.mockImplementation(async (_options, custody) => {
      captured = custody;
      custody.onTransport(transport);
      const cleanup = {}, errors = [];
      const settle = (promise, maximum = 5000) => Promise.race([promise, new Promise((_, reject) => {
        setTimeout(() => reject(Error("cleanup_timeout")), maximum);
      })]);
      await actual.closeLocalGoogleBrowser({
        context, browser, browserServer, launchAttempted: true, transport, settle, cleanup, errors, custody,
      });
      expect(cleanup.browser_process_exited).toBe(false);
      expect(cleanup.transport_guard_retained).toBe(true);
      expect(errors).toContain("cleanup_incomplete");
      expect(errors).toContain("browser_server_close_failed");
      expect(errors).toContain("browser_process_close_failed");
      expect(cleanup.browser_server_close_failure).toBe(mode === "timed-out" ? "timeout" : "rejected");
      throw Error("synthetic-incomplete");
    });
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    const pending = witnessLocalGoogleQualification({
      protocol: "h1", control: "positive", outputDir: "/synthetic-custody-never-created/case",
    });
    const rejected = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    expect(captured.recoveryResources()).toEqual({ context, browser, browserServer, browserProcess: root });
    expect(captured.recoveryResources().browserProcess).toBe(root);
    expect(browserServer.close).toHaveBeenCalledOnce();
    expect(browserServer.kill).toHaveBeenCalledOnce();
    expect(transport.close).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.find(([path]) => path.endsWith("/custody-incomplete.json"))[1])
      .toMatchObject({ complete: false, retained_resources: {
        browserServer: true, browser: true, context: true, browserProcess: true,
      } });
  });

  it("does not return complete when final output crosses the original deadline", async () => {
    vi.useFakeTimers();
    const source = { source: "synthetic" }, cohort = { cohort: "synthetic" };
    const transport = { closeAdmission: vi.fn(), close: vi.fn() };
    mocks.read.mockReturnValue(Buffer.from(JSON.stringify({
      protocol: "h1", control: "positive", outcome: "pass", errors: [], originals: { responses: [] },
      source_before: source, source_after: source, cohort_before: cohort, cohort_after: cohort,
      native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false,
    })));
    mocks.write.mockImplementation(path => {
      if (path.endsWith("/witness.json")) vi.setSystemTime(Date.now() + 2000);
    });
    mocks.run.mockImplementation((_options, custody) => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      custody.onTransport(transport);
      custody.onChild(child);
      return new Promise(resolve => setTimeout(() => {
        child.emit("exit", 0, null);
        child.emit("close", 0, null);
        resolve();
      }, 59000));
    });
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    const pending = witnessLocalGoogleQualification({
      protocol: "h1", control: "positive", outputDir: "/synthetic-custody-never-created/case",
    }).then(value => value.complete, () => false);
    await vi.advanceTimersByTimeAsync(59000);
    expect(await pending).toBe(false);
    expect(transport.closeAdmission).toHaveBeenCalledOnce();
    expect(transport.close).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.some(([, value]) => value.reason === "qualification_expired"
      && value.complete === false)).toBe(true);
  });

  it("closes admission and retains the guard if command output cannot be written", async () => {
    const transport = { closeAdmission: vi.fn(), close: vi.fn() };
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = vi.fn();
    mocks.run.mockImplementation(async (_options, custody) => {
      custody.onTransport(transport); custody.onChild(child);
      child.emit("exit", 0, null); child.emit("close", 0, null);
    });
    mocks.write.mockImplementation(path => {
      if (path.endsWith("/command-completion.json")) throw Error("synthetic_output_failure");
    });
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    await expect(witnessLocalGoogleQualification({
      protocol: "h1", control: "positive", outputDir: "/synthetic-custody-never-created/case",
    })).rejects.toThrow("synthetic_output_failure");
    expect(transport.closeAdmission).toHaveBeenCalledOnce();
    expect(transport.close).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.some(([, value]) => value.reason === "witness_incomplete"
      && value.complete === false)).toBe(true);
  });

  it("runs fixed scenario steps in order through the owned child", async () => {
    const child = new EventEmitter();
    child.connected = true;
    child.send = vi.fn();
    child.kill = vi.fn();
    mocks.spawn.mockReturnValue(child);
    const custody = { onChild: vi.fn(), onFailure: vi.fn() }, stop = vi.fn(), step = vi.fn(async () => {});
    const { runLocalGoogleScenarioDriver } = await import("./inspected-google-qualification.mjs");
    const pending = runLocalGoogleScenarioDriver(2, step, custody, stop);
    expect(custody.onChild).toHaveBeenCalledWith(child);
    expect(child.send).toHaveBeenCalledWith({ type: "scenario", total: 2 });
    child.emit("message", { type: "step", index: 0 });
    await vi.waitFor(() => expect(child.send).toHaveBeenCalledWith({ type: "step-result", index: 0 }));
    child.emit("message", { type: "step", index: 1 });
    await vi.waitFor(() => expect(child.send).toHaveBeenCalledWith({ type: "step-result", index: 1 }));
    child.emit("exit", 0, null);
    child.emit("close", 0, null);
    await expect(pending).resolves.toBeUndefined();
    expect(step.mock.calls).toEqual([[0], [1]]);
    expect(stop).not.toHaveBeenCalled();
    expect(custody.onFailure).not.toHaveBeenCalled();
  });

  it("stops a duplicate step and retains responsibility for an unsettled step", async () => {
    const child = new EventEmitter();
    child.connected = true;
    child.send = vi.fn();
    child.kill = vi.fn();
    mocks.spawn.mockReturnValue(child);
    let settleStep;
    const step = vi.fn(() => new Promise(resolve => { settleStep = resolve; }));
    const custody = { onChild: vi.fn(), onFailure: vi.fn() }, stop = vi.fn();
    const { runLocalGoogleScenarioDriver } = await import("./inspected-google-qualification.mjs");
    let finished = false;
    const pending = runLocalGoogleScenarioDriver(2, step, custody, stop).finally(() => { finished = true; });
    child.emit("message", { type: "step", index: 0 });
    await vi.waitFor(() => expect(step).toHaveBeenCalledOnce());
    child.emit("message", { type: "step", index: 0 });
    expect(stop).toHaveBeenCalledOnce();
    expect(custody.onFailure).toHaveBeenCalledWith("scenario_incomplete");
    child.emit("exit", 1, null);
    child.emit("close", 1, null);
    await Promise.resolve();
    expect(finished).toBe(false);
    settleStep();
    await expect(pending).rejects.toThrow("invalid_google_scenario_message");
  });

  it("fails closed when the scenario channel disappears before its last step", async () => {
    const child = new EventEmitter();
    child.connected = true;
    child.send = vi.fn();
    child.kill = vi.fn();
    mocks.spawn.mockReturnValue(child);
    const custody = { onChild: vi.fn(), onFailure: vi.fn() }, stop = vi.fn();
    const { runLocalGoogleScenarioDriver } = await import("./inspected-google-qualification.mjs");
    const pending = runLocalGoogleScenarioDriver(2, vi.fn(), custody, stop);
    child.emit("disconnect");
    expect(stop).toHaveBeenCalledOnce();
    expect(custody.onFailure).toHaveBeenCalledWith("scenario_incomplete");
    child.emit("exit", 1, null);
    child.emit("close", 1, null);
    await expect(pending).rejects.toThrow("google_scenario_channel_closed");
  });

  it("rejects caller-supplied custody before any acquisition", async () => {
    const actual = await vi.importActual("./inspected-google-qualification.mjs");
    await expect(actual.runLocalGoogleQualification({
      protocol: "h1", control: "positive", outputDir: "/synthetic-custody-never-created/case",
    }, {
      started: performance.now(), expires: Date.now() + 60000,
      stopped: () => false, onTransport: vi.fn(), onChild: vi.fn(), onFailure: vi.fn(),
    })).rejects.toThrow("google_witness_required");
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("stops witness-owned transport during acquisition without launching a browser", async () => {
    vi.useFakeTimers();
    mocks.execFile.mockImplementation((_file, _args, _options, callback) => callback(null, "", ""));
    mocks.readFile.mockReturnValue(Buffer.from("synthetic-certificate"));
    mocks.originals.mockReturnValue({ bytes: 0, responses: [], wire: [] });
    const sink = new EventEmitter();
    sink.listen = vi.fn((_port, _host, callback) => callback());
    sink.close = vi.fn(callback => callback());
    sink.address = () => ({ port: 12345 });
    mocks.server.mockReturnValue(sink);
    mocks.observer.mockReturnValue({
      snapshot: () => ({ stopped: false, reason: null }),
      originals: () => ({ requests: [], responses: [] }),
      reserveObservation: () => true,
    });
    const transport = {
      closeAdmission: vi.fn(), close: vi.fn(),
      snapshot: () => ({ ipv6_guard_listening: true, sockets_closed: true, tasks_settled: true, errors: [] }),
    };
    let finishStart;
    mocks.transport.mockImplementation(({ onCustody }) => {
      onCustody(transport);
      return new Promise(resolve => { finishStart = () => resolve(transport); });
    });
    const actual = await vi.importActual("./inspected-google-qualification.mjs");
    mocks.run.mockImplementation(actual.runLocalGoogleQualification);
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    const pending = witnessLocalGoogleQualification({
      protocol: "h1", control: "positive", outputDir: "/synthetic-custody-never-created/case",
    });
    for (let n = 0; n < 20 && !finishStart; n++) await Promise.resolve();
    expect(finishStart).toBeTypeOf("function");
    await vi.advanceTimersByTimeAsync(60000);
    expect(transport.closeAdmission).toHaveBeenCalledOnce();
    expect(transport.close).not.toHaveBeenCalled();
    finishStart();
    await expect(pending).rejects.toThrow();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(transport.close).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.some(([, value]) => value.complete === false
      && value.reason === "qualification_expired")).toBe(true);
  });

  it("installs the witness observation before a scenario step and retains the guard on failure", async () => {
    const calls = [], cdp = new EventEmitter(), browserCdp = {}, child = new EventEmitter();
    child.connected = true;
    child.send = vi.fn(message => { calls.push(message.type); });
    child.kill = vi.fn(signal => {
      child.emit("exit", null, signal);
      child.emit("close", null, signal);
    });
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    mocks.spawn.mockReturnValue(child);
    mocks.supported.mockReturnValue(true);
    mocks.readFile.mockReturnValue(Buffer.from("synthetic-certificate"));
    mocks.originals.mockReturnValue({ bytes: 0, responses: [], wire: [] });
    mocks.realpath.mockReturnValue("/synthetic-custody-never-created");
    const sink = fakeServer(true);
    mocks.server.mockReturnValue(sink);
    const observer = {
      snapshot: () => ({ stopped: false, reason: null }),
      originals: () => ({ requests: [], responses: [] }), reserveObservation: () => true,
    };
    let resolveObservation, ticketsAtForward, forwardedId;
    mocks.observer.mockImplementation(options => { resolveObservation = options.resolveObservation; return observer; });
    const transport = {
      port: 12345, attachOwnedBrowser: vi.fn(), closeAdmission: vi.fn(), close: vi.fn(),
      snapshot: () => ({ ipv6_guard_listening: true, sockets_closed: true, tasks_settled: true, errors: [] }),
    };
    mocks.transport.mockImplementation(async ({ onCustody }) => { onCustody(transport); return transport; });
    const page = {
      goto: vi.fn(async () => {}),
      evaluate: vi.fn(async (_script, input) => {
        cdp.emit("Network.requestWillBeSent", {
          requestId: "synthetic-network", request: { url: input.url, method: "GET" }, type: "XHR",
        });
        cdp.emit("Fetch.requestPaused", {
          requestId: "synthetic-fetch", networkId: "synthetic-network", resourceType: "XHR",
          request: { url: input.url, method: "GET", headers: {} },
        });
        return { ok: true, body: "synthetic-original" };
      }),
    };
    cdp.send = vi.fn(async (method, args) => {
      calls.push(method);
      if (method === "Fetch.continueRequest") {
        ticketsAtForward = resolveObservation({ url: page.evaluate.mock.calls[0][1].url, method: "GET" }).length;
        forwardedId = args.requestId;
      }
    });
    const context = new EventEmitter();
    context.newPage = vi.fn(async () => page);
    context.newCDPSession = vi.fn(async () => cdp);
    context.close = vi.fn(async () => { context.emit("close"); });
    const browser = {
      version: () => "synthetic-version", newBrowserCDPSession: vi.fn(async () => browserCdp),
      newContext: vi.fn(async () => context), close: vi.fn(async () => {}),
    };
    const browserProcess = { pid: 123, exitCode: 0, signalCode: null };
    const browserServer = {
      wsEndpoint: () => "ws://127.0.0.1/synthetic", close: vi.fn(async () => {}),
      process: () => browserProcess,
    };
    mocks.chromium.launchServer = vi.fn(async () => browserServer);
    mocks.chromium.connect = vi.fn(async () => browser);
    const actual = await vi.importActual("./inspected-google-qualification.mjs");
    mocks.run.mockImplementation(actual.runLocalGoogleQualification);
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    const pending = witnessLocalGoogleQualification({
      protocol: "h1", control: "abort", outputDir: "/synthetic-custody-never-created/case",
    });
    await vi.waitFor(() => expect(child.send).toHaveBeenCalledWith({ type: "scenario", total: 2 }));
    expect(transport.attachOwnedBrowser).toHaveBeenCalledWith(browserCdp);
    expect(calls.indexOf("Fetch.enable")).toBeLessThan(calls.indexOf("scenario"));
    child.emit("message", { type: "step", index: 0 });
    await expect(pending).rejects.toThrow();
    expect(calls).toContain("Fetch.continueRequest");
    expect(ticketsAtForward).toBe(1);
    expect(forwardedId).toBe("synthetic-fetch");
    expect(transport.closeAdmission).toHaveBeenCalled();
    expect(transport.close).not.toHaveBeenCalled();
    expect(mocks.write.mock.calls.some(([, value]) => value.complete === false)).toBe(true);
  });

  it("closes a listener that finishes binding after admission was stopped", async () => {
    const listener = fakeServer(false);
    mocks.server.mockReturnValue(listener);
    const { startLocalGoogleInspectedTransport } = await vi.importActual("./inspected-transport.mjs");
    let custody;
    const started = startLocalGoogleInspectedTransport({
      inspector: {}, protocol: "h1", observer: fakeObserver(), check: () => {}, wait: promise => promise,
      receiver: { port: 12345, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      onCustody: value => { custody = value; }, onFailure: vi.fn(),
    });
    custody.closeAdmission();
    listener.finishListening();
    await expect(started).rejects.toThrow("local_google_admission_closed");
    expect(listener.close).toHaveBeenCalledOnce();
    expect(mocks.guardServer).not.toHaveBeenCalled();
  });

  it("closes an unissued guard that finishes binding after admission was stopped", async () => {
    const listener = fakeServer(true), guard = fakeServer(false);
    mocks.server.mockReturnValue(listener);
    mocks.guardServer.mockReturnValue(guard);
    const { startLocalGoogleInspectedTransport } = await vi.importActual("./inspected-transport.mjs");
    let custody;
    const started = startLocalGoogleInspectedTransport({
      inspector: {}, protocol: "h1", observer: fakeObserver(), check: () => {}, wait: promise => promise,
      receiver: { port: 12345, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      onCustody: value => { custody = value; }, onFailure: vi.fn(),
    });
    await vi.waitFor(() => expect(guard.listen).toHaveBeenCalledOnce());
    custody.closeAdmission();
    guard.finishListening();
    await expect(started).rejects.toThrow("local_google_admission_closed");
    expect(listener.close).toHaveBeenCalledOnce();
    expect(guard.close).toHaveBeenCalledOnce();
  });

  it("retains the issued reject guard and blocks a queued authenticated connection after stop", async () => {
    const listener = fakeServer(true), guard = fakeServer(true);
    mocks.server.mockReturnValue(listener);
    mocks.guardServer.mockReturnValue(guard);
    const { startLocalGoogleInspectedTransport } = await vi.importActual("./inspected-transport.mjs");
    let earlyCustody, finishAuthentication;
    const transport = await startLocalGoogleInspectedTransport({
      inspector: {}, protocol: "h1", observer: fakeObserver(), check: () => {}, wait: promise => promise,
      receiver: { port: 12345, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      onCustody: value => { earlyCustody = value; }, onFailure: vi.fn(),
    });
    transport.attachOwnedBrowser({ send: () => new Promise(resolve => { finishAuthentication = resolve; }) });
    const socket = new EventEmitter();
    Object.assign(socket, {
      localPort: 12345, remotePort: 23456,
      destroy: vi.fn(() => socket.emit("close")), end: vi.fn(),
    });
    listener.emit("connection", socket);
    listener.emit("connect", { url: "www.googleadservices.com:443" }, socket, Buffer.alloc(0));
    await vi.waitFor(() => expect(finishAuthentication).toBeTypeOf("function"));
    earlyCustody.closeAdmission();
    finishAuthentication({ processInfo: [{ id: 123 }] });
    await vi.waitFor(() => expect(socket.end).toHaveBeenCalledOnce());
    expect(socket.destroy).toHaveBeenCalled();
    expect(mocks.tlsConnect).not.toHaveBeenCalled();
    expect(transport.snapshot().ipv6_guard_listening).toBe(true);
    expect(transport.snapshot().admission_open).toBe(false);
    expect(guard.close).not.toHaveBeenCalled();
  });

  it("signals witness failure if the retained guard fails", async () => {
    const listener = fakeServer(true), guard = fakeServer(true), onFailure = vi.fn(), observer = fakeObserver();
    mocks.server.mockReturnValue(listener);
    mocks.guardServer.mockReturnValue(guard);
    const { startLocalGoogleInspectedTransport } = await vi.importActual("./inspected-transport.mjs");
    const transport = await startLocalGoogleInspectedTransport({
      inspector: {}, protocol: "h1", observer, check: () => {}, wait: promise => promise,
      receiver: { port: 12345, certificate: Buffer.alloc(0), logicalAuthority: () => true },
      onCustody: vi.fn(), onFailure,
    });
    guard.emit("error", Error("synthetic guard error"));
    expect(onFailure).toHaveBeenCalledWith("ipv6_guard_error");
    expect(observer.stop).toHaveBeenCalledWith("ipv6_guard_error");
    expect(transport.snapshot().admission_open).toBe(false);
    expect(guard.close).not.toHaveBeenCalled();
  });
});

function fakeObserver() {
  return { stop: vi.fn(), snapshot: () => ({ stopped: false, forwarded: 0 }) };
}

function fakeServer(autoListen) {
  const server = new EventEmitter();
  server.listening = false;
  server.address = () => ({ port: 12345 });
  server.listen = vi.fn((...args) => {
    server.finishListening = () => {
      server.listening = true;
      server.emit("listening");
      args.at(-1)();
    };
    if (autoListen) server.finishListening();
  });
  server.close = vi.fn(callback => {
    server.listening = false;
    server.emit("close");
    callback?.();
  });
  return server;
}
