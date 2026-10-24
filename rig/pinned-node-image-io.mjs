import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, realpathSync, statfsSync, writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";
import { equal } from "./inspected-meta-record.mjs";
import { privateOriginalDirectory, publishPrivateOriginal, readPrivateOriginal } from "./private-original-file.mjs";
import { imageBound, imageHash } from "./pinned-node-image-archive.mjs";
import { P } from "./pinned-node-image-pins.mjs";

const fail = reason => { throw Error(reason); };
const keys = ["dev", "ino", "mode", "uid", "nlink", "size", "mtimeNs", "ctimeNs"];
const identity = s => Object.fromEntries(keys.map(k => [k, String(s[k])]));
export function imageCanonical(path) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path || realpathSync(path) !== path)
    fail("image_canonical_path");
  return path;
}
export function imageDirectory(path, uid) {
  const original = privateOriginalDirectory(path, uid);
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let closed = false;
  const check = () => {
    if (closed) fail("image_closed_directory");
    const fresh = privateOriginalDirectory(path, uid), held = fstatSync(fd);
    if (![fresh, held].every(s => s.dev === original.dev && s.ino === original.ino
      && s.uid === original.uid && s.mode === original.mode) || !held.isDirectory())
      fail("image_directory_changed");
  };
  try { check(); } catch (error) { closeSync(fd); throw error; }
  return { path, handle: { path, dev: String(original.dev), ino: String(original.ino), mode: String(original.mode), uid: String(uid) },
    fd, check, close() { if (!closed) { closed = true; closeSync(fd); } } };
}
export function imageOriginal(path, { uid, maximum = 1048576, privateFile = false, executable = false } = {}) {
  imageCanonical(path);
  // Preserve the existing JSON callers' exact guards and bounds unchanged.
  const checked = readPrivateOriginal(path, { uid: privateFile ? uid : null, maximum, executable });
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let closed = false;
  try {
    const first = fstatSync(fd, { bigint: true }), initial = identity(first);
    if (!first.isFile() || first.uid !== BigInt(uid) || first.nlink !== 1n
      || Number(first.size) !== checked.bytes.length || Number(first.dev) !== checked.handle.dev
      || Number(first.ino) !== checked.handle.ino) fail("image_original_owner_or_identity");
    const digestFd = () => {
      const digest = createHash("sha256"), chunk = Buffer.alloc(Math.min(maximum, 1048576));
      for (let pos = 0; pos < Number(first.size);) {
        const n = readSync(fd, chunk, 0, Math.min(chunk.length, Number(first.size) - pos), pos);
        if (!Number.isSafeInteger(n) || n <= 0 || n > Number(first.size) - pos) fail("image_original_short_read");
        digest.update(chunk.subarray(0, n)); pos += n;
      }
      return digest.digest("hex");
    };
    const check = () => {
      if (closed) fail("image_closed_original");
      imageCanonical(path);
      for (const s of [fstatSync(fd, { bigint: true }), lstatSync(path, { bigint: true })])
        if (!equal(identity(s), initial)) fail("image_original_changed");
      if (digestFd() !== checked.handle.sha256
        || !equal(identity(fstatSync(fd, { bigint: true })), initial)
        || !equal(identity(lstatSync(path, { bigint: true })), initial)) fail("image_original_changed");
    };
    check();
    return { bytes: checked.bytes, handle: { path, ...initial, sha256: checked.handle.sha256 }, legacy: checked.handle, fd, check,
      close() { if (!closed) { closed = true; closeSync(fd); } } };
  } catch (error) { closeSync(fd); throw error; }
}
export function imageHostSpace(root, archiveBytes = 0) {
  imageBound(archiveBytes, P.archiveMax, "image_archive_bound");
  const s = statfsSync(root, { bigint: true }), available = s.bavail * s.bsize;
  if (available < BigInt(P.hostReserve) + BigInt(archiveBytes)) fail("image_host_reserve");
  return { available_bytes: String(available), host_reserve_bytes: String(P.hostReserve) };
}
export function publishImageArchive(root, bytes, uid) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) fail("image_archive_bound");
  imageBound(bytes.length, P.archiveMax, "image_archive_bound");
  const directory = imageDirectory(root, uid), path = root + "/archive.tar";
  let fd, held;
  try {
    imageHostSpace(root, bytes.length);
    fd = openSync(path, "wx", 0o600);
    const first = fstatSync(fd);
    if (!first.isFile() || first.uid !== uid || first.nlink !== 1 || first.size !== 0
      || (first.mode & 0o7777) !== 0o600) fail("image_archive_allocation");
    directory.check();
    for (let offset = 0; offset < bytes.length;) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isSafeInteger(n) || n <= 0 || n > bytes.length - offset) fail("image_archive_short_write");
      offset += n;
    }
    fsyncSync(fd);
    directory.check(); fsyncSync(directory.fd);
    held = imageOriginal(path, { uid, maximum: P.archiveMax, privateFile: true });
    const final = fstatSync(fd, { bigint: true });
    if (String(final.dev) !== String(first.dev) || String(final.ino) !== String(first.ino)
      || !equal(identity(final), Object.fromEntries(keys.map(k => [k, held.handle[k]])))
      || held.handle.sha256 !== imageHash(bytes) || !held.bytes.equals(bytes)) fail("image_archive_readback");
    imageHostSpace(root); directory.check(); held.check();
    // Keep both actual publication descriptors, in addition to its readback fd.
    const readback = held;
    return { bytes: readback.bytes, handle: readback.handle, check() {
      directory.check(); readback.check();
      if (!equal(identity(fstatSync(fd, { bigint: true })), identity(lstatSync(path, { bigint: true }))))
        fail("image_archive_publication_changed");
    }, close() { readback.close(); closeSync(fd); directory.close(); } };
  } catch (error) {
    held?.close();
    if (fd !== undefined) closeSync(fd);
    directory.close();
    // No overwrite, unlink, adoption or retry of partial diagnostic debris.
    throw error;
  }
}
const publications = ["operation-intent.json", "image-result.json", "image-unknown.json"];
export function publishImageRecord(root, name, value, uid) {
  if (!publications.includes(name)) fail("image_fixed_publication");
  return publishPrivateOriginal(root, name, Buffer.from(JSON.stringify(value) + "\n"), uid);
}
export function reserveImageImport(path, value, uid) {
  if (!path.endsWith("/image-load.reserved")) fail("image_canonical_reservation");
  const root = dirname(path), directory = imageDirectory(root, uid);
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
    const bytes = Buffer.from(JSON.stringify(value) + "\n");
    imageBound(bytes.length, 65536, "image_intent_bound");
    const first = fstatSync(fd);
    if (!first.isFile() || first.uid !== uid || first.nlink !== 1 || first.size !== 0
      || (first.mode & 0o7777) !== 0o600) fail("image_reservation_allocation");
    for (let offset = 0; offset < bytes.length;) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isSafeInteger(n) || n <= 0 || n > bytes.length - offset) fail("image_reservation_short_write");
      offset += n;
    }
    fsyncSync(fd); directory.check(); fsyncSync(directory.fd);
    const held = imageOriginal(path, { uid, privateFile: true, maximum: 65536 });
    try {
      if (!held.bytes.equals(bytes) || held.handle.dev !== String(first.dev) || held.handle.ino !== String(first.ino))
        fail("image_reservation_changed");
      held.check(); directory.check(); return held.handle;
    } finally { held.close(); }
  } finally { if (fd !== undefined) closeSync(fd); directory.close(); }
}
export function imageSocket(path, uid) {
  imageCanonical(path);
  const parent = dirname(path), directory = lstatSync(imageCanonical(parent), { bigint: true });
  const current = lstatSync(path, { bigint: true });
  if (!current.isSocket() || current.uid !== BigInt(uid) || (current.mode & 0o022n)
    || !directory.isDirectory() || directory.uid !== BigInt(uid) || (directory.mode & 0o022n))
    fail("image_socket_owner_or_mode");
  const handle = { path, ...identity(current), parent: { path: parent, ...identity(directory) } };
  return { handle, check() {
    const fresh = imageSocketSnapshot(path, uid);
    if (!equal(handle, fresh)) fail("image_socket_changed");
  } };
}
function imageSocketSnapshot(path, uid) {
  imageCanonical(path);
  const parent = dirname(path), s = lstatSync(path, { bigint: true }), d = lstatSync(imageCanonical(parent), { bigint: true });
  if (!s.isSocket() || s.uid !== BigInt(uid) || (s.mode & 0o022n)
    || !d.isDirectory() || d.uid !== BigInt(uid) || (d.mode & 0o022n)) fail("image_socket_owner_or_mode");
  return { path, ...identity(s), parent: { path: parent, ...identity(d) } };
}
