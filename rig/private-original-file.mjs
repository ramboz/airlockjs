import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { equal } from "./inspected-meta-record.mjs";

const fail = reason => { throw Error(reason); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = path => typeof path === "string" && isAbsolute(path) && resolve(path) === path
  && realpathSync(path) === path;
const identity = s => ({
  dev: s.dev, ino: s.ino, size: s.size, mode: s.mode, uid: s.uid, nlink: s.nlink,
  mtime_ms: s.mtimeMs, ctime_ms: s.ctimeMs,
});
export function privateOriginalDirectory(path, uid) {
  if (!canonical(path)) fail("private_original_directory");
  const s = lstatSync(path);
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== uid || (s.mode & 0o7777) !== 0o700)
    fail("private_original_directory");
  return { path, ...identity(s) };
}
export function readPrivateOriginal(path, { uid = null, maximum = 1048576, executable = false } = {}) {
  if (!canonical(path)) fail("private_original_metadata");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1 || before.size < 1 || before.size > maximum
      || (before.mode & 0o022)
      || (uid !== null && (before.uid !== uid || (before.mode & 0o7777) !== 0o600))
      || (executable && !(before.mode & 0o111))) fail("private_original_metadata");
    const bytes = readFileSync(fd), after = fstatSync(fd);
    if (!equal(identity(before), identity(after)) || !equal(identity(after), identity(lstatSync(path)))
      || !canonical(path) || bytes.length !== before.size) fail("private_original_changed");
    return { bytes, handle: { path, ...identity(before), sha256: hash(bytes) } };
  } finally { closeSync(fd); }
}

// Final bytes can be empty/partial diagnostic debris. Only the caller's existing
// completed private handoff acknowledges publication; failed/lost ACKs cannot
// be recovered by polling, overwriting, deleting or adopting this pathname.
export function publishPrivateOriginal(root, name, bytes, uid) {
  if (!/^[a-z0-9-]+\.json$/.test(name) || !Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > 1048576)
    fail("private_original_publication_bound");
  const directory = privateOriginalDirectory(root, uid), path = root + "/" + name;
  const fd = openSync(path, "wx", 0o600);
  try {
    const allocated = fstatSync(fd);
    if (!allocated.isFile() || allocated.nlink !== 1 || allocated.uid !== uid
      || (allocated.mode & 0o7777) !== 0o600 || allocated.size !== 0) fail("private_original_publication_changed");
    const dfd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      const directoryFd = () => {
        const held = fstatSync(dfd);
        if (dfd === fd || !held.isDirectory() || held.dev !== directory.dev || held.ino !== directory.ino
          || held.uid !== directory.uid || held.uid !== uid || held.mode !== directory.mode
          || (held.mode & 0o7777) !== 0o700) fail("private_original_directory_fd_changed");
      };
      const directoryOriginal = () => {
        directoryFd();
        const fresh = privateOriginalDirectory(root, uid);
        if (fresh.dev !== directory.dev || fresh.ino !== directory.ino || fresh.mode !== directory.mode)
          fail("private_original_publication_directory_changed");
      };
      directoryOriginal();
      for (let offset = 0; offset < bytes.length;) {
        const count = writeSync(fd, bytes, offset, bytes.length - offset);
        if (!Number.isSafeInteger(count) || count <= 0 || count > bytes.length - offset)
          fail("private_original_short_write");
        offset += count;
      }
      const written = identity(fstatSync(fd)), sha256 = hash(bytes);
      if (written.dev !== allocated.dev || written.ino !== allocated.ino || written.mode !== allocated.mode
        || written.uid !== uid || written.nlink !== 1 || written.size !== bytes.length)
        fail("private_original_publication_changed");
      const fileOriginal = () => {
        if (!equal(written, identity(fstatSync(fd))) || !equal(written, identity(lstatSync(path))))
          fail("private_original_publication_changed");
      };
      const readback = () => {
        directoryOriginal(); fileOriginal();
        const fresh = readPrivateOriginal(path, { uid, maximum: bytes.length });
        directoryOriginal(); fileOriginal();
        if (!equal(fresh.handle, { path, ...written, sha256 }) || !fresh.bytes.equals(bytes))
          fail("private_original_publication_changed");
        directoryFd();
        return fresh.handle;
      };
      fsyncSync(fd);
      readback();
      // Owned directory nlink/entry timestamps can change, unlike the exact
      // original FILE metadata. Sync and retain the actual checked directory fd.
      directoryOriginal();
      fsyncSync(dfd);
      return readback();
    } finally { closeSync(dfd); }
  } finally { closeSync(fd); }
}
