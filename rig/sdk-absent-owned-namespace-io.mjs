// Fixed, bounded file operations. Publication receipts are process-private;
// an on-disk success flag is never a replacement for external command close.
import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, openSync,
  readFileSync, unlinkSync, writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { data, equal } from "./inspected-meta-record.mjs";

export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const fail = reason => { throw Error(reason); };
export const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const identity = s => ({
  dev: s.dev, ino: s.ino, size: s.size, mode: s.mode, uid: s.uid,
  mtime_ms: s.mtimeMs, ctime_ms: s.ctimeMs,
});
export function privateDirectory(path, uid) {
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || (s.mode & 0o777) !== 0o700 || s.uid !== uid)
    fail("namespace_private_directory");
  return { path, ...identity(s) };
}
export function fixedRead(path, { maximum = 1048576, privateUid = null, executable = false } = {}) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size < 1 || before.size > maximum || (before.mode & 0o022)
      || (privateUid !== null && (before.uid !== privateUid || (before.mode & 0o777) !== 0o600))
      || (executable && !(before.mode & 0o111))) fail("namespace_file_metadata");
    const bytes = readFileSync(fd), after = fstatSync(fd);
    if (!equal(identity(before), identity(after)) || bytes.length !== before.size) fail("namespace_file_changed");
    return { bytes, handle: { path, ...identity(before), sha256: hash(bytes) } };
  } finally { closeSync(fd); }
}
export function atomicPrivateWrite(root, name, value, uid) {
  const directory = privateDirectory(root, uid), bytes = Buffer.from(JSON.stringify(data(value)) + "\n");
  if (bytes.length > 1048576 || !/^[a-z0-9-]+\.json$/.test(name)) fail("namespace_publication_bound");
  const staging = root + "/" + name + ".staging", final = root + "/" + name;
  let fd = openSync(staging, "wx", 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const count = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isSafeInteger(count) || count <= 0 || count > bytes.length - offset) fail("namespace_short_write");
      offset += count;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  // Retain the staged inode durably BEFORE a complete final link is visible.
  // link() also refuses to overwrite any earlier original. Final-link directory
  // durability is established before the private receipt; polling alone is not
  // a completion contract (a crash can occur before that directory fsync).
  fd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd); linkSync(staging, final); fsyncSync(fd);
    unlinkSync(staging); fsyncSync(fd);
  } finally { closeSync(fd); }
  const after = privateDirectory(root, uid);
  if (directory.dev !== after.dev || directory.ino !== after.ino) fail("namespace_directory_changed");
  const readback = fixedRead(final, { privateUid: uid });
  if (!readback.bytes.equals(bytes)) fail("namespace_publication_changed");
  return readback.handle;
}
