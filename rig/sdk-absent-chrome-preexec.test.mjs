import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const load = () => import("./sdk-absent-chrome-preexec.mjs");
const hash = value => createHash("sha256").update(value).digest("hex");
const temporary = "/private/owned-sdk-absent-case/tmp";
const profile = temporary + "/playwright_chromiumdev_profile-aB12cd";
// Public Chromium launch defaults, pinned playwright-core 1.62.1:
// coreBundle.js:34604-34702,43046-43099; headed, chromiumSandbox:true.
const switches = [
  "--disable-field-trial-config", "--disable-background-networking",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-back-forward-cache", "--disable-breakpad", "--disable-client-side-phishing-detection",
  "--disable-component-extensions-with-background-pages", "--disable-component-update",
  "--no-default-browser-check", "--disable-default-apps", "--disable-dev-shm-usage",
  "--disable-edgeupdater", "--disable-extensions",
  "--disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,Translate,AutoDeElevate,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion",
  "--enable-features=CDPScreenshotNewSurface", "--allow-pre-commit-input", "--disable-hang-monitor",
  "--disable-ipc-flooding-protection", "--disable-popup-blocking", "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding", "--disable-updater-scheduler", "--force-color-profile=srgb",
  "--metrics-recording-only", "--no-first-run", "--password-store=basic", "--use-mock-keychain",
  "--no-service-autorun", "--export-tagged-pdf", "--disable-search-engine-choice-screen",
  "--unsafely-disable-devtools-self-xss-warnings", "--edge-skip-compat-layer-relaunch",
  "--disable-infobars", "--disable-search-engine-choice-screen", "--disable-sync",
  "--enable-unsafe-swiftshader",
];
const argv = () => [...switches, "--user-data-dir=" + profile, "--remote-debugging-pipe", "--no-startup-window"];
const processRow = (pid, ppid, pgid, command = "owned-" + pid, state = "S") => ({
  pid, ppid, pgid, uid: process.getuid(), started: "Thu Oct 22 11:00:00 2026", state,
  command_sha256: hash(command),
});
const roles = () => ({ P: processRow(610001, 1, 610001), E: processRow(610002, 610001, 610002),
  L: processRow(610003, 610002, 610003), H: processRow(610004, 610003, 610003) });
const handles = () => [{ fd: 3, type: 2, family: 1, identity: "0x0000000000000123" },
  { fd: 4, type: 2, family: 1, identity: "0x0000000000000456" }];
function inventory() {
  const expected = roles(), row = { fd: 0, type: 1, family: null, identity: null };
  const descriptors = [row, ...handles().map((r, n) => ({ ...r, fd: 17 + n }))];
  const before = Object.values(expected).slice(0, 3).map((r, n) => ({
    pid: r.pid, ppid: r.ppid, pgid: r.pgid, uid: r.uid, birth_seconds: 1792690000, birth_microseconds: n + 1,
  }));
  const current = { schema: "airlock.owned-macos-socket-inventory.v1", role: "launcher",
    pid: expected.L.pid, caller_pid: expected.P.pid, complete: true, roles_before: before,
    roles_after: structuredClone(before), inventory_before: descriptors.map(({ fd, type }) => ({ fd, type })),
    inventory_after: descriptors.map(({ fd, type }) => ({ fd, type })),
    descriptor_count: descriptors.length, descriptors, native_authority: false };
  return { expected, preexec_handles: handles(), preexec_kernel_roles: structuredClone(before), inventory: current };
}

describe("post-exec whole inventory uses opaque handles, never FD aliases", () => {
  it("accepts both debug sockets moved away from FD3/4 in a complete stable snapshot", async () => {
    const { assessSdkAbsentChromePostexecSockets } = await load();
    expect(typeof assessSdkAbsentChromePostexecSockets).toBe("function");
    expect(assessSdkAbsentChromePostexecSockets(inventory())).toMatchObject({ allowed: true });
  });
  it.each(["missing-handle", "same-numbers-wrong-handle", "incomplete", "churn", "birth-changed", "socket-zero"])(
    "reports %s unproved, rather than relaxing the C inventory", async fault => {
      const { assessSdkAbsentChromePostexecSockets } = await load(), value = inventory();
      expect(typeof assessSdkAbsentChromePostexecSockets).toBe("function");
      if (fault === "missing-handle") value.inventory.descriptors[1].identity = "0x0000000000000789";
      if (fault === "same-numbers-wrong-handle") {
        for (const [n, d] of value.inventory.descriptors.slice(1).entries()) {
          d.fd = 3 + n; d.identity = "0x000000000000078" + n;
          value.inventory.inventory_before[n + 1].fd = d.fd; value.inventory.inventory_after[n + 1].fd = d.fd;
        }
      }
      if (fault === "incomplete") value.inventory.complete = false;
      if (fault === "churn") value.inventory.inventory_after.pop();
      if (fault === "birth-changed") value.inventory.roles_after[2].birth_microseconds++;
      if (fault === "socket-zero") value.inventory.descriptors[1].identity = "0x0000000000000000";
      expect(() => {
        if (!assessSdkAbsentChromePostexecSockets(value).allowed) throw Error("refused");
      }).toThrow();
    });
});

describe("SDK-absent fixed Chrome argument boundary", () => {
  it("accepts exactly the pinned public driver's headed sandboxed argv and real isolated profile", async () => {
    const { parseSdkAbsentChromeArgv } = await load();
    expect(parseSdkAbsentChromeArgv({ argv: argv(), temporary_root: temporary })).toEqual({
      argv: argv(), argv_sha256: hash(JSON.stringify(argv())), profile_path: profile,
      profile_kind: "REAL-isolated-browser-profile", sdk_absent: true, native_authority: false,
    });
  });
    it.each(["duplicate-profile", "foreign-profile", "traversal", "url", "extension", "debug-port",
      "no-sandbox", "headless", "missing-switch", "changed-switch", "reordered", "extra-key"])(
      "refuses %s without forwarding or rewriting the vector", async fault => {
        const { parseSdkAbsentChromeArgv } = await load(), value = { argv: argv(), temporary_root: temporary };
        if (fault === "duplicate-profile") value.argv.push("--user-data-dir=" + profile);
        if (fault === "foreign-profile") value.argv[switches.length] = "--user-data-dir=/private/foreign/profile";
        if (fault === "traversal") value.argv[switches.length] = "--user-data-dir=" + temporary + "/../playwright_chromiumdev_profile-aB12cd";
        if (fault === "url") value.argv.push("https://example.invalid/");
        if (fault === "extension") value.argv.push("--load-extension=/private/extension");
        if (fault === "debug-port") value.argv.push("--remote-debugging-port=9222");
        if (fault === "no-sandbox") value.argv.push("--no-sandbox");
        if (fault === "headless") value.argv.push("--headless");
        if (fault === "missing-switch") value.argv.splice(1, 1);
        if (fault === "changed-switch") value.argv[0] += "=override";
        if (fault === "reordered") [value.argv[0], value.argv[1]] = [value.argv[1], value.argv[0]];
        if (fault === "extra-key") value.program = "/bin/echo";
        expect(() => parseSdkAbsentChromeArgv(value)).toThrow();
      });
  function acquisition() {
    const make = (pid, ppid, pgid) => ({ pid, ppid, pgid, uid: process.getuid(),
      started: "Thu Oct 22 11:00:00 2026", state: "S", command_sha256: hash("owned-" + pid) });
    const roles = { P: make(610001, 1, 610001), E: make(610002, 610001, 610002),
      L: make(610003, 610002, 610003), H: make(610004, 610003, 610003) };
    const dir = { path: profile, dev: 1, ino: 2, birthtime_ms: 1234, uid: process.getuid(),
      mode: 0o700, kind: "REAL-isolated-browser-profile" };
    return { expected: roles, before: structuredClone(roles), after: structuredClone(roles),
      profile: dir, expected_profile: structuredClone(dir), temporary_root: temporary };
  }

  describe("real profile and role acquisition, not synthetic fixture authority", () => {
    it.each(["S", "Us"])("accepts exact scoped P/E/L/H while waiting in %s", async state => {
      const { assessSdkAbsentChromeAcquisition } = await load(), value = acquisition();
      value.after.E.state = state;
      expect(assessSdkAbsentChromeAcquisition(value)).toMatchObject({ allowed: true, native_authority: false });
    });
    it.each(["stopped", "changed-birth", "helper-leader", "helper-parent", "profile-inode",
      "profile-birth", "profile-owner", "synthetic-profile", "foreign-profile", "missing-role"])(
      "does not enroll %s", async fault => {
        const { assessSdkAbsentChromeAcquisition } = await load(), value = acquisition();
        expect(typeof assessSdkAbsentChromeAcquisition).toBe("function");
        if (fault === "stopped") value.after.E.state = "T";
        if (fault === "changed-birth") value.after.H.started = "another lifetime";
        if (fault === "helper-leader") value.after.H.pgid = value.after.H.pid;
        if (fault === "helper-parent") value.after.H.ppid = value.after.E.pid;
        if (fault === "profile-inode") value.profile.ino++;
        if (fault === "profile-birth") value.profile.birthtime_ms++;
        if (fault === "profile-owner") value.profile.uid++;
        if (fault === "synthetic-profile") value.profile.kind = "synthetic-user-data";
        if (fault === "foreign-profile") value.profile.path = "/private/foreign/profile";
        if (fault === "missing-role") delete value.after.H;
        expect(() => {
          if (!assessSdkAbsentChromeAcquisition(value).allowed) throw Error("refused");
        }).toThrow();
      });
  });
});
