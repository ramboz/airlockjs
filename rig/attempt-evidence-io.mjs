// Read-only evidence IO shared by the two offline attempt readers. No producer,
// browser, network, policy callbacks or configurable limits.
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, opendirSync, readSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { isDeepStrictEqual as equal } from "node:util";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const fail = category => { throw new EvidenceError(category); };
export class EvidenceError extends Error {
  constructor(category) { super(category); this.category = category; }
}
export const check = (condition, category) => { if (!condition) fail(category); };
export const plain = value => value !== null && typeof value === "object"
  && Object.getPrototypeOf(value) === Object.prototype;
export const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export function keys(value, names) {
  check(plain(value) && equal(Object.keys(value).sort(), [...names].sort()), "unknown_or_missing_fields");
}
export function canonical(path) {
  check(typeof path === "string" && path.length > 1 && path.length <= 4096
    && !path.includes("\0") && isAbsolute(path) && resolve(path) === path, "unsafe_path");
  return path;
}
function ancestors(path) {
  for (let parent = dirname(canonical(path));;) {
    const s = lstatSync(parent);
    check(s.isDirectory() && !s.isSymbolicLink(), "unsafe_path");
    if (parent === dirname(parent)) break;
    parent = dirname(parent);
  }
}
function privateDirectory(path) {
  ancestors(path);
  const s = lstatSync(path);
  check(s.isDirectory() && !s.isSymbolicLink() && s.uid === process.getuid()
    && (s.mode & 0o7777) === 0o700, "private_permissions");
}
const identity = s => [s.dev, s.ino, s.uid, s.mode, s.nlink, s.size, s.mtimeNs, s.ctimeNs].join(":");

// Same small token-walk as inspected-meta-stock, with decoded-key uniqueness
// (including escaped equivalents) BEFORE JSON.parse can discard an original.
export function parseEvidence(bytes, deadline = () => {}) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("invalid_json"); }
  // eslint-disable-next-line no-control-regex -- JSON cannot contain literal control octets.
  const token = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"|[{}[\],:]|true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let offset = 0, nodes = 0;
  const next = () => {
    while (/[ \t\r\n]/.test(text[offset] ?? "") && offset < text.length) offset++;
    token.lastIndex = offset;
    const match = token.exec(text);
    check(match, "invalid_json"); offset = token.lastIndex; return match[0];
  };
  const visit = (first = next(), depth = 0) => {
    deadline();
    check(++nodes <= 100000 && depth <= 24, "structure_limit");
    if (!["{", "["].includes(first)) {
      check(!/^[}\],:]$/.test(first), "invalid_json");
      if (/^-?\d/.test(first)) check(Number.isFinite(Number(first)), "invalid_json");
      return;
    }
    const object = first === "{", end = object ? "}" : "]", seen = new Set();
    let item = next();
    if (item === end) return;
    while (true) {
      if (object) {
        check(item.startsWith('"'), "invalid_json");
        const key = JSON.parse(item);
        check(!seen.has(key), "ambiguous_json");
        check(!["__proto__", "constructor", "prototype"].includes(key), "unsafe_object_key");
        seen.add(key); check(next() === ":", "invalid_json"); item = next();
      }
      visit(item, depth + 1);
      const separator = next();
      if (separator === end) return;
      check(separator === ",", "invalid_json"); item = next();
    }
  };
  visit(); check(text.slice(offset).trim() === "", "invalid_json");
  try { return JSON.parse(text); } catch { fail("invalid_json"); }
}

export function evidenceSession(started = performance.now()) {
  const files = new Map(), trees = new Map();
  const deadline = () => check(performance.now() - started < 10000, "deadline_exceeded");
  function read(path, maximum, expected, source = false) {
    deadline(); ancestors(path);
    if (!source) privateDirectory(dirname(path));
    let fd;
    try {
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const before = fstatSync(fd, { bigint: true });
      check(before.isFile() && before.nlink === 1n, "unsafe_file");
      if (!source) check(before.uid === BigInt(process.getuid())
        && (before.mode & 0o7777n) === 0o600n, "private_permissions");
      check(before.size <= BigInt(maximum), "byte_limit");
      const bytes = Buffer.alloc(Number(before.size) + 1);
      let offset = 0, count;
      do {
        deadline(); count = readSync(fd, bytes, offset, bytes.length - offset, offset); offset += count;
      } while (count > 0 && offset < bytes.length);
      check(offset === Number(before.size), "original_changed");
      const after = fstatSync(fd, { bigint: true });
      check(identity(before) === identity(after)
        && identity(after) === identity(lstatSync(path, { bigint: true })), "original_changed");
      const content = bytes.subarray(0, offset), hash = sha256(content);
      if (expected !== undefined) check(digest(expected) && expected === hash, "digest_mismatch");
      const snapshot = { path, maximum, sha256: hash, identity: identity(after), source };
      if (files.has(path)) check(equal(files.get(path), snapshot), "original_changed");
      else files.set(path, snapshot);
      deadline(); return content;
    } finally { if (fd !== undefined) closeSync(fd); }
  }
  function tree(path) {
    let total = 0, count = 0;
    const entries = [];
    function visit(current, depth) {
      deadline(); check(depth <= 4 && ++count <= 80, "tree_limit");
      const s = lstatSync(current, { bigint: true });
      check(!s.isSymbolicLink(), "unsafe_file");
      entries.push([current, identity(s)]);
      if (s.isDirectory()) {
        privateDirectory(current);
        const directory = opendirSync(current, { bufferSize: 1 });
        try {
          while (true) {
            deadline();
            const entry = directory.readSync();
            if (!entry) break;
            visit(join(current, entry.name), depth + 1);
          }
        } finally { directory.closeSync(); }
      } else {
        check(s.isFile(), "unsafe_file");
        total += Number(s.size); check(total <= 8388608, "chamber_byte_limit");
        const bytes = read(current, 8388608);
        if (current.endsWith(".json")) parseEvidence(bytes, deadline);
      }
    }
    visit(path, 0);
    // Enumeration order is not an identity. Only these <=80 bounded snapshots
    // are sorted, never an unbounded directory's complete list of names.
    entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    if (trees.has(path)) check(equal(trees.get(path), entries), "original_changed");
    else trees.set(path, entries);
  }
  function recheck() {
    deadline();
    for (const item of files.values()) read(item.path, item.maximum, item.sha256, item.source);
    for (const path of trees.keys()) tree(path);
    deadline();
  }
  return { check: deadline, read, tree, recheck,
    json(path, maximum, expected) { return parseEvidence(read(path, maximum, expected), deadline); },
    snapshots() { return [...files.values()].map(item => ({ ...item })); } };
}

export function createOutput(path) {
  canonical(path); privateDirectory(dirname(path));
  mkdirSync(path, { mode: 0o700 }); privateDirectory(path);
}
export function writeExclusive(path, value, deadline) {
  deadline(); privateDirectory(dirname(path));
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  check(bytes.length <= 16777216, "publication_limit");
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
    | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const s = fstatSync(fd);
    check(s.isFile() && s.nlink === 1 && (s.mode & 0o7777) === 0o600, "private_permissions");
    let offset = 0;
    while (offset < bytes.length) {
      deadline(); const count = writeSync(fd, bytes, offset, bytes.length - offset);
      check(count > 0, "publication_failed"); offset += count;
    }
    fsyncSync(fd);
  } finally { closeSync(fd); }
  const directory = openSync(dirname(path), constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(directory); } finally { closeSync(directory); }
  deadline(); return sha256(bytes);
}
