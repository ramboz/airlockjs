import { randomBytes } from "node:crypto";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { equal, record } from "./inspected-meta-record.mjs";
import { parseSdkAbsentChromeArgv, sdkAbsentChromeReadiness } from "./sdk-absent-chrome-preexec.mjs";
import { SHELL, directory, fail, frame, hash, issued, privateDigest, read, safeMessage, save, sendFrame, sleep, until } from "./sdk-absent-chrome-io.mjs";

async function parentMessage(end) {
  let onMessage, onDisconnect;
  try {
    return await until(new Promise((done, reject) => {
      onMessage = message => done(safeMessage(message));
      onDisconnect = () => reject(Error("sdk_absent_parent_disconnected"));
      process.once("message", onMessage); process.once("disconnect", onDisconnect);
    }), end);
  } finally { process.off("message", onMessage); process.off("disconnect", onDisconnect); }
}

export async function runSdkAbsentChromeEngine(root) {
  const readiness = sdkAbsentChromeReadiness();
  if (!readiness.ready) fail(readiness.reason);
  const { ticket, ticket_sha256 } = issued(root);
  const end = performance.now() + Math.min(27000, ticket.expires_at_ms - Date.now());
  if (tmpdir() !== ticket.temp.path || !process.send || process.ppid !== ticket.parent.pid)
    fail("sdk_absent_engine_context");
  const owner = await parentMessage(end);
  if (owner.type !== "engine-owner" || owner.ticket_sha256 !== ticket_sha256
    || owner.identity.pid !== process.pid || owner.identity.ppid !== process.ppid
    || owner.identity.uid !== process.getuid()) fail("sdk_absent_engine_owner");
  const permission = parentMessage(end);
  process.send({ type: "engine-ready", ticket_sha256 });
  if ((await permission).type !== "launch-permission") fail("sdk_absent_launch_permission");
  let server, browser, context;
  try {
    // TMPDIR was scoped by P before this Node/module started, before import.
    const { chromium } = await import("playwright-core");
    save(root, "engine-launch-pending", { ticket_sha256, pid: process.pid, at_ms: Date.now() });
    process.send({ type: "launch-pending", ticket_sha256 });
    server = await chromium.launchServer({ executablePath: SHELL, headless: false, chromiumSandbox: true,
      host: "127.0.0.1", timeout: Math.max(1, Math.min(22000, end - performance.now())),
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
      env: { PATH: "/opt/homebrew/bin:/usr/bin:/bin", LC_ALL: "C", TMPDIR: ticket.temp.path,
        AIRLOCK_SDK_ABSENT_CHROME_ROOT: root } });
    const endpoint = new URL(server.wsEndpoint());
    if (endpoint.protocol !== "ws:" || endpoint.hostname !== "127.0.0.1" || !endpoint.port)
      fail("sdk_absent_driver_endpoint");
    // Never retain the unpredictable websocket path.
    save(root, "engine-browser-returned", { ticket_sha256, pid: server.process().pid,
      endpoint: { host: endpoint.hostname, port: Number(endpoint.port) }, at_ms: Date.now() });
    const acquired = parentMessage(end);
    process.send({ type: "browser-returned", pid: server.process().pid, port: Number(endpoint.port), ticket_sha256 });
    const acceptance = await acquired;
    if (acceptance.type !== "browser-owner" || acceptance.pid !== server.process().pid)
      fail("sdk_absent_returned_browser_owner");
    browser = await until(chromium.connect(server.wsEndpoint()), end);
    const version = browser.version();
    if (version !== "155.0.8059.85") fail("sdk_absent_chrome_version");
    context = await until(browser.newContext({ serviceWorkers: "block" }), end);
    await context.route("**/*", route => route.abort("blockedbyclient"));
    const cookies = await until(context.cookies(), end);
    if (cookies.length !== 0) fail("sdk_absent_fresh_context");
    const page = await until(context.newPage(), end);
    if (page.url() !== "about:blank") fail("sdk_absent_nonblank_page");
    const cdp = await until(context.newCDPSession(page), end);
    const challenge = randomBytes(24).toString("hex");
    const response = await until(cdp.send("Runtime.evaluate", {
      expression: `JSON.stringify({href:location.href,value:${JSON.stringify(challenge)}.split("").reverse().join("")})`,
      returnByValue: true,
    }), end);
    const actual = JSON.parse(response.result.value);
    if (actual.href !== "about:blank" || actual.value !== [...challenge].reverse().join(""))
      fail("sdk_absent_renderer_roundtrip");
    await until(cdp.detach(), end);
    save(root, "engine-normal-proof", { ticket_sha256, pid: server.process().pid, version, cookies,
      page_url: page.url(), renderer_roundtrip_sha256: hash(response.result.value),
      challenge_sha256: hash(challenge), at_ms: Date.now() });
    const closure = parentMessage(end);
    process.send({ type: "normal-proof", ticket_sha256, pid: server.process().pid });
    if ((await closure).type !== "close-permission") fail("sdk_absent_close_permission");
    await until(context.close(), end); context = null;
    await until(browser.close(), end); browser = null;
    await until(server.close(), end); server = null;
    save(root, "engine-normal-closed", { ticket_sha256, at_ms: Date.now() });
    process.send({ type: "engine-complete", ticket_sha256 });
  } finally {
    // Finite awaits do not establish process closure. P retains pending/known
    // ownership and performs independent disposition even if these time out.
    for (const resource of [context, browser, server]) if (resource) {
      try { await until(resource.close(), Math.min(end, performance.now() + 500)); } catch {}
    }
  }
}

async function helper(root, argv) {
  const readiness = sdkAbsentChromeReadiness();
  if (!readiness.ready) fail(readiness.reason);
  const { ticket, ticket_sha256 } = issued(root);
  const parsed = parseSdkAbsentChromeArgv({ argv, temporary_root: ticket.temp.path });
  const profile = directory(parsed.profile_path, "REAL-isolated-browser-profile");
  const end = performance.now() + Math.min(24000, ticket.expires_at_ms - Date.now());
  save(root, "helper-announcement", { argv: parsed.argv, argv_sha256: parsed.argv_sha256,
    helper_pid: process.pid, launcher_pid: process.ppid });
  const permit = async stage => {
    while (performance.now() < end) {
      try {
        const p = record(read(join(root, stage + ".json")), ["schema", "stage", "ticket_sha256", "roles",
          "profile", "argv_sha256", "issued_at_ms", "expires_at_ms", "correlation_sha256", "sdk_absent", "native_authority"]);
        if (p.schema !== "airlock.sdk-absent-chrome-permit.v1" || p.stage !== stage
          || p.ticket_sha256 !== ticket_sha256 || p.argv_sha256 !== parsed.argv_sha256
          || !equal(p.profile, profile) || !equal(directory(profile.path, profile.kind), profile)
          || p.roles.H.pid !== process.pid || p.roles.H.ppid !== process.ppid || p.roles.L.pid !== process.ppid
          || p.issued_at_ms > Date.now() || p.expires_at_ms !== ticket.expires_at_ms || Date.now() >= p.expires_at_ms
          || p.sdk_absent !== true || p.native_authority !== false) fail("sdk_absent_helper_permit");
        return p;
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      await sleep(10);
    }
    fail("sdk_absent_helper_deadline");
  };
  await permit("tcp-only");
  const socket = connect({ host: "127.0.0.1", port: ticket.port });
  socket.on("error", () => {});
  try {
    await until(new Promise((done, reject) => { socket.once("connect", done); socket.once("error", reject); }), end);
    const challenge = frame(socket, end);
    sendFrame(socket, { helper_pid: process.pid, launcher_pid: process.ppid, ticket_sha256 });
    const token = await challenge;
    if (token.stage !== "challenge" || !/^[a-f0-9]{64}$/.test(token.correlation)) fail("sdk_absent_helper_challenge");
    const ready = frame(socket, end);
    sendFrame(socket, { correlation_sha256: hash(token.correlation) });
    const response = await ready, p = await permit("exec-ready");
    if (response.stage !== "exec-ready" || response.allowed !== true
      || response.registration_sha256 !== privateDigest(join(root, "exec-ready.json"))
      || p.correlation_sha256 !== hash(token.correlation)) fail("sdk_absent_helper_exec_refused");
    issued(root);
    // The fsynced permit binds P's independently observed L/H/profile/FDs.
    // H's success alone was never a process-ownership assertion.
  } finally { socket.destroy(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let watchdog;
  try {
    const readiness = sdkAbsentChromeReadiness();
    if (!readiness.ready) fail(readiness.reason);
    watchdog = setTimeout(() => process.exit(2), 29000);
    const root = process.env.AIRLOCK_SDK_ABSENT_CHROME_ROOT;
    if (process.argv[2] === "--sdk-absent-e") await runSdkAbsentChromeEngine(root);
    else if (process.argv[2] === "--sdk-absent-h") await helper(root, process.argv.slice(3));
    else fail("sdk_absent_fixed_actor");
  } catch (error) {
    // No websocket path, correlation value, environment or vendor data in logs.
    process.stderr.write("sdk_absent_actor_failed\n"); process.exitCode = 2;
  } finally { clearTimeout(watchdog); if (process.connected) process.disconnect(); }
}
