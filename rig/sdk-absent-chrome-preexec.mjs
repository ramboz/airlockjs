// Fixed SDK-ABSENT acquisition prototype. No grant, SDK, native plan or transport.
import { createHash } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import { data, equal, record } from "./inspected-meta-record.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = reason => { throw Error(reason); };
const lifetime = ["pid", "ppid", "pgid", "uid", "started", "command_sha256"];
const same = (a, b) => !!a && !!b && lifetime.every(k => a[k] === b[k]);
const live = row => typeof row?.state === "string" && /^[RSIU]/.test(row.state);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const answer = (allowed, reason) => ({ allowed, reason, sdk_absent: true, native_authority: false });
const flags = Object.freeze([
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
]);

export function parseSdkAbsentChromeArgv(value) {
  const v = record(data(value), ["argv", "temporary_root"]);
  if (typeof v.temporary_root !== "string" || !isAbsolute(v.temporary_root)
    || resolve(v.temporary_root) !== v.temporary_root || !Array.isArray(v.argv)) fail("sdk_absent_chrome_arguments");
  const profileArg = v.argv[flags.length];
  if (typeof profileArg !== "string" || !profileArg.startsWith("--user-data-dir=")) fail("sdk_absent_chrome_arguments");
  const profilePath = profileArg.slice("--user-data-dir=".length);
  const name = profilePath.slice(v.temporary_root.length + 1);
  if (!/^playwright_chromiumdev_profile-[A-Za-z0-9]{6}$/.test(name)
    || profilePath !== join(v.temporary_root, name)
    || !equal(v.argv, [...flags, profileArg, "--remote-debugging-pipe", "--no-startup-window"]))
    fail("sdk_absent_chrome_arguments");
  return { argv: v.argv, argv_sha256: hash(JSON.stringify(v.argv)), profile_path: profilePath,
    profile_kind: "REAL-isolated-browser-profile", sdk_absent: true, native_authority: false };
}

export function assessSdkAbsentChromeAcquisition(value) {
  const v = record(data(value), ["expected", "before", "after", "profile", "expected_profile", "temporary_root"]);
  for (const rows of [v.expected, v.before, v.after]) {
    record(rows, ["P", "E", "L", "H"]);
    for (const row of Object.values(rows)) {
      record(row, [...lifetime, "state"]);
      if (!live(row) || !digest(row.command_sha256) || typeof row.started !== "string" || !row.started
        || !["pid", "ppid", "pgid", "uid"].every(k => Number.isSafeInteger(row[k])
          && row[k] >= (k === "uid" ? 0 : 1))) return answer(false, "sdk_absent_role_lifetime");
    }

    const { P, E, L, H } = rows;
    if (new Set([P.pid, E.pid, L.pid, H.pid]).size !== 4 || E.ppid !== P.pid || E.pgid !== E.pid
      || L.ppid !== E.pid || L.pgid !== L.pid || H.ppid !== L.pid || H.pgid !== L.pid
      || ![E, L, H].every(r => r.uid === P.uid)) return answer(false, "sdk_absent_role_ancestry");
  }
  if (Object.keys(v.expected).some(k => !same(v.expected[k], v.before[k]) || !same(v.before[k], v.after[k])))
    return answer(false, "sdk_absent_role_changed");
  const p = record(v.profile, ["path", "dev", "ino", "birthtime_ms", "uid", "mode", "kind"]);
  if (!equal(p, v.expected_profile) || p.kind !== "REAL-isolated-browser-profile"
    || p.mode !== 0o700 || p.uid !== v.expected.P.uid
    || !["dev", "ino", "birthtime_ms"].every(k => Number.isFinite(p[k]) && p[k] > 0)
    || typeof v.temporary_root !== "string" || !isAbsolute(v.temporary_root)
    || resolve(v.temporary_root) !== v.temporary_root
    || !p.path.startsWith(v.temporary_root + "/")
    || !/^playwright_chromiumdev_profile-[A-Za-z0-9]{6}$/.test(p.path.slice(v.temporary_root.length + 1)))
    return answer(false, "sdk_absent_profile_changed");
  return answer(true, "sdk_absent_owned_roles_and_real_profile");
}

// Second inline inventory consumer (meta-preexec-bootstrap.mjs:validateSocketInventory).
// Chrome may move descriptors: compare opaque socket handles in the full snapshot.
export function assessSdkAbsentChromePostexecSockets(value) {
      const v = record(data(value, 0, { nodes: 0, limit: 16384 }),
        ["expected", "preexec_handles", "preexec_kernel_roles", "inventory"]);
      const i = record(v.inventory, ["schema", "role", "pid", "caller_pid", "complete", "roles_before",
        "roles_after", "inventory_before", "inventory_after", "descriptor_count", "descriptors", "native_authority"]);
      const invalid = () => fail("sdk_absent_postexec_inventory_unproved");
      if (i.schema !== "airlock.owned-macos-socket-inventory.v1" || i.role !== "launcher" || i.complete !== true
        || i.native_authority !== false || i.pid !== v.expected.L.pid || i.caller_pid !== v.expected.P.pid
        || !equal(i.roles_before, i.roles_after) || !equal(i.roles_before, v.preexec_kernel_roles)
        || !Array.isArray(i.roles_before) || i.roles_before.length !== 3
        || !Number.isSafeInteger(i.descriptor_count) || i.descriptor_count < 1 || i.descriptor_count >= 256
        || !Array.isArray(i.descriptors) || i.descriptors.length !== i.descriptor_count) invalid();
      for (const [n, r] of i.roles_before.entries()) {
        record(r, ["pid", "ppid", "pgid", "uid", "birth_seconds", "birth_microseconds"]);
        record(v.expected, ["P", "E", "L", "H"]);
        const expected = v.expected[["P", "E", "L"][n]];
        if (!["pid", "ppid", "pgid", "uid"].every(k => r[k] === expected[k])
          || !Number.isSafeInteger(r.birth_seconds) || r.birth_seconds <= 0
          || !Number.isSafeInteger(r.birth_microseconds) || r.birth_microseconds < 0 || r.birth_microseconds >= 1000000) invalid();
      }
      let previous = -1;
      for (const r of i.descriptors) {
        record(r, ["fd", "type", "family", "identity"]);
        if (!Number.isSafeInteger(r.fd) || r.fd <= previous || r.fd > 2147483647
          || !Number.isInteger(r.type) || r.type < 0 || r.type > 11 || r.type === 8) invalid();
        previous = r.fd;
        if (r.type === 2 ? !Number.isInteger(r.family) || r.family < 1 || r.family > 255
          || !/^0x[0-9a-f]{16}$/.test(r.identity) || BigInt(r.identity) === 0n
          : r.identity !== null || r.family !== null) invalid();
      }
      const layout = i.descriptors.map(({ fd, type }) => ({ fd, type }));
      if (!equal(layout, i.inventory_before) || !equal(layout, i.inventory_after)
        || !Array.isArray(v.preexec_handles) || v.preexec_handles.length !== 2
        || new Set(v.preexec_handles.map(r => r.identity)).size !== 2) invalid();
      for (const r of v.preexec_handles) {
        record(r, ["fd", "type", "family", "identity"]);
        if (![3, 4].includes(r.fd) || r.type !== 2 || r.family !== 1
          || !/^0x[0-9a-f]{16}$/.test(r.identity) || BigInt(r.identity) === 0n) invalid();
        if (!i.descriptors.some(d => d.type === 2 && d.family === 1 && d.identity === r.identity))
          return answer(false, "sdk_absent_postexec_debug_socket_missing");
      }
      return answer(true, "sdk_absent_complete_postexec_socket_identity");
}

export function sdkAbsentChromeReadiness() {
  return { ready: false, reason: "sdk_absent_descendant_closure_UNPROVED",
    blocked_predicate: "attributable-owned-descendant-acquisition-and-termination" };
}
