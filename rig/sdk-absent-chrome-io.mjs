// Internal fixed-prototype records. No executable, PID, destination or clock API.
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { metaSourcePins, readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";

export const NODE = "/opt/homebrew/Cellar/node/24.10.0/bin/node";
export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const ACTORS = fileURLToPath(new URL("sdk-absent-chrome-actors.mjs", import.meta.url));
export const SHELL = fileURLToPath(new URL("sdk-absent-chrome-launcher", import.meta.url));
export const CONFINED = fileURLToPath(new URL("qualification-loopback-chrome", import.meta.url));
export const POLICY = fileURLToPath(new URL("qualification-loopback-network.sb", import.meta.url));
export const hash = value => createHash("sha256").update(value).digest("hex");
export const fail = reason => { throw Error(reason); };
export const read = path => {
  const name = basename(path).match(/^([A-Za-z0-9][A-Za-z0-9-]{0,95})\.json$/)?.[1];
  if (!name) fail("sdk_absent_record_name");
  // An immutable completion marker is the publication point. It follows
  // durable bytes, exclusive link(), and removal of the staging hard link.
  // Readers never weaken readMetaPrivate's nlink/owner/symlink predicates.
  let file;
  try {
    file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink() || file.uid !== process.getuid() || (file.mode & 0o7777) !== 0o600)
      fail("unsafe_private_file");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const markerPath = join(dirname(path), "." + name + ".committed");
  let marker;
  try { marker = directory(markerPath, "durably-published-handoff-marker"); }
  catch (error) {
    if (error.code === "ENOENT" && file) {
      try { directory(join(dirname(path), "." + name + ".publishing"), "owned-publication-staging"); }
      catch (pendingError) {
        if (pendingError.code === "ENOENT") fail("sdk_absent_uncommitted_record");
        throw pendingError;
      }
      // The only legitimate nlink=2 interval is after exclusive publication
      // and before staging unlink. Once single-linked, malformed visible
      // bytes are still errors, not a broad catch-and-poll fallback.
      if (file.nlink === 1) json(readMetaPrivate(path, 1048576), 65536);
      else if (file.nlink !== 2) fail("unsafe_private_file");
    }
    throw error;
  }
  const value = json(readMetaPrivate(path, 1048576), 65536);
  if (!equal(directory(markerPath, marker.kind), marker)) fail("sdk_absent_record_marker_changed");
  return value;
};
export const save = (root, name, value) => {
  if (typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,95}$/.test(name)) fail("sdk_absent_record_name");
  const owner = directory(root, "case-evidence-root");
  const path = join(root, name + ".json");
  const marker = join(root, "." + name + ".committed"), staging = join(root, "." + name + ".publishing");
  for (const target of [path, marker]) {
    try { lstatSync(target); fail("sdk_absent_record_exists"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  // O_EXCL staging and link() preserve one winner, including dangling-link
  // targets. rename() would silently overwrite an existing final pathname.
  mkdirSync(staging, { mode: 0o700 });
  const staged = join(staging, "record.json");
  writeMetaPrivate(staged, { ...value, sdk_absent: true, native_authority: false });
  const bytes = readMetaPrivate(staged, 1048576);
  json(bytes, 65536);
  if (!equal(directory(root, owner.kind), owner)) fail("sdk_absent_publication_root_changed");
  linkSync(staged, path);
  unlinkSync(staged);
  syncDirectory(staging);
  syncDirectory(root);
  mkdirSync(marker, { mode: 0o700 });
  syncDirectory(marker);
  syncDirectory(root);
  read(path);
  return { path, sha256: hash(bytes) };
};
export function syncDirectory(path) {
  const fd = openSync(path, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function directory(path, kind) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path || realpathSync(path) !== path)
    fail("sdk_absent_directory_path");
  for (let p = path;; p = dirname(p)) {
    const s = lstatSync(p);
    if (!s.isDirectory() || s.isSymbolicLink()) fail("sdk_absent_directory_identity");
    if (p === dirname(p)) break;
  }
  const s = lstatSync(path);
  if (s.uid !== process.getuid() || (s.mode & 0o7777) !== 0o700) fail("sdk_absent_directory_owner");
  return { path, dev: s.dev, ino: s.ino, birthtime_ms: s.birthtimeMs,
    uid: s.uid, mode: s.mode & 0o7777, kind };
}
export function sources() {
  const names = ["sdk-absent-chrome-preexec.mjs", "sdk-absent-chrome-preexec.test.mjs",
    "sdk-absent-chrome-io.mjs", "sdk-absent-chrome-runtime.mjs", "sdk-absent-chrome-runtime.boundary.test.mjs",
    "sdk-absent-chrome-actors.mjs", "sdk-absent-chrome-actors.boundary.test.mjs",
    "sdk-absent-chrome-launcher", "sdk-absent-chrome.browser.test.mjs", "sdk-absent-chrome.browser.config.mjs",
    "sdk-absent-chrome-io.test.mjs", "sdk-absent-chrome-completion.mjs", "sdk-absent-chrome-completion.test.mjs",
    "sdk-absent-chrome-admission.test.mjs"];
  const driverNames = ["package.json", "index.mjs", "index.js", "lib/bootstrap.js", "lib/coreBundle.js",
    "lib/utilsBundle.js", "browsers.json"];
  const vector = { existing: metaSourcePins(),
    prototype: Object.fromEntries(names.map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))])),
    driver: Object.fromEntries(driverNames.map(name =>
      [name, hash(readFileSync(new URL("../node_modules/playwright-core/" + name, import.meta.url)))])) };
  if (vector.driver["lib/coreBundle.js"] !== "9393fa79e1c67c74edc26b610d65a4f7ed73d345a762465cc88340a33a2454ac"
    || vector.driver["package.json"] !== "07c47543631fef9508760365dee9fbe958c562093ec8d122543949ed231f233f"
    || vector.existing["qualification-loopback-chrome"] !== "3ce657f2c85945a13c2ab9cc8a6cb364eb8f66725f643a608aa978b5363b3cbf"
    || vector.existing["qualification-loopback-network.sb"] !== "3204564960c5bdc369d996647e0e52176b63028bf8efe3924fbff7e1f9c0e3ee")
    fail("sdk_absent_pinned_driver_or_policy_changed");
  return vector;
}
export function issued(root) {
  directory(root, "case-evidence-root");
  const path = join(root, "issued.json"), ticket = record(read(path), [
    "schema", "parent", "temp", "control", "port", "expires_at_ms", "sources", "sdk_absent", "native_authority",
  ]);
  if (ticket.schema !== "airlock.sdk-absent-chrome-issue.v1" || ticket.sdk_absent !== true
    || ticket.native_authority !== false || !["normal", "pre-return-abort"].includes(ticket.control)
    || process.execPath !== NODE || !Number.isSafeInteger(ticket.port) || ticket.port < 1 || ticket.port > 65535
    || !Number.isSafeInteger(ticket.expires_at_ms) || Date.now() >= ticket.expires_at_ms
    || !equal(directory(join(root, "tmp"), "registered-temporary-subtree"), ticket.temp)
    || !equal(sources(), ticket.sources)) fail("sdk_absent_issue_changed");
  return { ticket, ticket_sha256: hash(readMetaPrivate(path, 1048576)) };
}
export async function until(promise, end) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("sdk_absent_deadline")), Math.max(1, end - performance.now()));
    })]);
  } finally { clearTimeout(timer); }
}
export const sleep = ms => new Promise(done => setTimeout(done, ms));
export const sendFrame = (socket, value) => socket.write(JSON.stringify(value) + "\n");
export async function frame(socket, end) {
  let cleanup;
  try {
    return await until(new Promise((done, reject) => {
      let bytes = Buffer.alloc(0);
      const error = () => { cleanup(); reject(Error("sdk_absent_peer_disconnected")); };
      const incoming = chunk => {
        bytes = Buffer.concat([bytes, chunk]);
        const at = bytes.indexOf(10);
        if (bytes.length > 2048 || at >= 0 && at !== bytes.length - 1) {
          cleanup(); reject(Error("sdk_absent_frame_limit")); return;
        }
        if (at >= 0) {
          cleanup();
          try { done(json(bytes.subarray(0, at))); } catch (e) { reject(e); }
        }
      };
      cleanup = () => { socket.off("data", incoming); socket.off("error", error); socket.off("close", error); };
      socket.on("data", incoming); socket.once("error", error); socket.once("close", error);
    }), end);
  } finally { cleanup?.(); }
}
export const safeMessage = value => data(value);
export const privateDigest = path => { read(path); return hash(readMetaPrivate(path, 1048576)); };

export function preparedObserver() {
  const source = fileURLToPath(new URL("meta-owned-socket-observer.c", import.meta.url));
  const path = fileURLToPath(new URL("meta-owned-socket-observer.cohort.json", import.meta.url));
  const cohort = record(json(readFileSync(path)), ["schema", "source_sha256", "binary_sha256", "compiler_sha256", "sdk", "headers"]);
  if (cohort.schema !== "airlock.owned-socket-observer-cohort.v1"
    || cohort.sdk !== "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk"
    || hash(readFileSync(source)) !== cohort.source_sha256
    || !/^[a-f0-9]{64}$/.test(cohort.binary_sha256)) fail("sdk_absent_observer_cohort");
  record(cohort.headers, ["libproc.h", "sys/proc_info.h", "sys/proc.h"]);
  for (const [name, expected] of Object.entries(cohort.headers))
    if (hash(readFileSync(join(cohort.sdk, "usr/include", name))) !== expected) fail("sdk_absent_observer_headers");
  const binary = fileURLToPath(new URL("out/owned-socket-observer/" + cohort.binary_sha256 + "/observer", import.meta.url));
  directory(dirname(binary), "prepared-observer-parent");
  const before = lstatSync(binary), bytes = readFileSync(binary), after = lstatSync(binary);
  if (!before.isFile() || before.isSymbolicLink() || before.uid !== process.getuid()
    || before.nlink !== 1 || (before.mode & 0o7777) !== 0o700 || before.size > 1048576
    || ["dev", "ino", "size", "mtimeMs", "ctimeMs"].some(k => before[k] !== after[k])
    || bytes.length !== before.size || hash(bytes) !== cohort.binary_sha256) fail("sdk_absent_observer_binary");
  return { path: binary, sha256: cohort.binary_sha256, dev: before.dev, ino: before.ino,
    bytes: bytes.length, cohort_sha256: hash(readFileSync(path)) };
}
