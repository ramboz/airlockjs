import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, openSync,
  readFileSync, realpathSync, unlinkSync, writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { data, equal, json, record } from "./inspected-meta-record.mjs";

export const fail = reason => { throw Error(reason); };
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
export const freeze = v => {
  if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
const identity = s => ({
  dev: s.dev, ino: s.ino, size: s.size, mode: s.mode, uid: s.uid, nlink: s.nlink,
  mtime_ms: s.mtimeMs, ctime_ms: s.ctimeMs,
});
export function observationDirectory(path, uid) {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || realpathSync(path) !== path
    || s.uid !== uid || (s.mode & 0o777) !== 0o700) fail("observation_private_directory");
  return { path, ...identity(s) };
}
export function observationRead(path, { uid = null, maximum = 1048576, executable = false } = {}) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1 || before.size < 1 || before.size > maximum
      || (before.mode & 0o022) || realpathSync(path) !== path
      || (uid !== null && (before.uid !== uid || (before.mode & 0o777) !== 0o600))
      || (executable && !(before.mode & 0o111))) fail("observation_original_metadata");
    const bytes = readFileSync(fd), after = fstatSync(fd);
    if (!equal(identity(before), identity(after)) || !equal(identity(after), identity(lstatSync(path)))
      || bytes.length !== before.size) fail("observation_original_changed");
    return { bytes, handle: freeze({ path, ...identity(before), sha256: hash(bytes) }) };
  } finally { closeSync(fd); }
}
export function observationHandle(value) {
  const h = record(data(value), ["path", "dev", "ino", "size", "mode", "uid", "nlink", "mtime_ms", "ctime_ms", "sha256"]);
  if (typeof h.path !== "string" || !digest(h.sha256) || h.nlink !== 1
    || !["dev", "ino", "size", "mode", "uid"].every(k => Number.isSafeInteger(h[k]) && h[k] > 0)
    || !["mtime_ms", "ctime_ms"].every(k => Number.isFinite(h[k]) && h[k] >= 0)) fail("observation_original_handle");
  return h;
}
export function observationSnapshot(expected, uid = null) {
  const h = observationHandle(expected), r = observationRead(h.path, { uid });
  if (!equal(r.handle, h)) fail("observation_original_hash_or_identity_changed");
  return { ...r, value: json(r.bytes) };
}
export function observationWrite(root, name, value, uid) {
  const dir = observationDirectory(root, uid), bytes = Buffer.from(JSON.stringify(data(value)) + "\n");
  if (!/^[a-z0-9-]+\.json$/.test(name) || bytes.length > 1048576) fail("observation_publication_bound");
  const staging = root + "/" + name + ".staging", final = root + "/" + name;
  let fd = openSync(staging, "wx", 0o600);
  try {
    for (let offset = 0; offset < bytes.length;) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isSafeInteger(count) || count <= 0 || count > bytes.length - offset) fail("observation_short_write");
      offset += count;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  fd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd); linkSync(staging, final); fsyncSync(fd); unlinkSync(staging); fsyncSync(fd);
  } finally { closeSync(fd); }
  const after = observationDirectory(root, uid);
  if (dir.dev !== after.dev || dir.ino !== after.ino) fail("observation_publication_directory_changed");
  const readback = observationRead(final, { uid });
  if (!readback.bytes.equals(bytes)) fail("observation_publication_changed");
  return readback.handle;
}
