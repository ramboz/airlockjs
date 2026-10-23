import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs", () => ({
  openSync: vi.fn(), closeSync: vi.fn(), fstatSync: vi.fn(), lstatSync: vi.fn(), realpathSync: vi.fn(),
  readFileSync: vi.fn(), writeSync: vi.fn(), fsyncSync: vi.fn(), linkSync: vi.fn(), unlinkSync: vi.fn(),
  constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));
vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("SOURCE_PROCESS_FORBIDDEN"); }) }));
vi.mock("node:net", () => ({ connect: vi.fn(() => { throw Error("SOURCE_NETWORK_FORBIDDEN"); }) }));
vi.mock("node:perf_hooks", () => ({ performance: { now: vi.fn(() => { throw Error("SOURCE_CLOCK_FORBIDDEN"); }) } }));
import * as fs from "node:fs";
import { spawn } from "node:child_process";
import { publishClockHostOriginal } from "./sdk-absent-clock-host-io.mjs";
import { observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { atomicPrivateWrite, fixedRead, privateDirectory } from "./sdk-absent-owned-namespace-io.mjs";

const ROOT = "/source-publication/case", NAME = "host-request.json", PATH = ROOT + "/" + NAME;
const value = { source_only: true }, bytes = Buffer.from('{"source_only":true}\n');
const files = new Map(), opened = new Map(), events = [];
let inode, descriptor, hooks;
function put(path, content = bytes, mode = 0o100600) {
  const row = { bytes: Buffer.from(content), dev: 1, ino: ++inode, size: content.length, nlink: 1,
    uid: 501, mode, mtimeMs: 100, ctimeMs: 100,
    isFile: () => (mode & 0o170000) === 0o100000, isDirectory: () => (mode & 0o170000) === 0o040000,
    isSymbolicLink: () => false };
  files.set(path, row); return row;
}
beforeEach(() => {
  vi.clearAllMocks(); files.clear(); opened.clear(); events.length = 0; inode = 1; descriptor = 10; hooks = {};
  put(ROOT, Buffer.alloc(0), 0o040700);
  fs.openSync.mockImplementation((path, flags, mode) => {
    hooks.beforeOpen?.(path, flags);
    if (flags === "wx") {
      if (files.has(path)) throw Error("EEXIST");
      expect(mode).toBe(0o600);
      put(path, Buffer.alloc(0)); events.push("exclusive-final:" + path);
    }
    if (!files.has(path)) throw Error("SOURCE_MISSING:" + path);
    const fd = ++descriptor, entry = { path, row: files.get(path) };
    opened.set(fd, entry); hooks.open?.(entry, flags); return fd;
  });
  fs.closeSync.mockImplementation(fd => { expect(opened.has(fd)).toBe(true); opened.delete(fd); });
  fs.fstatSync.mockImplementation(fd => {
    if (!opened.has(fd)) throw Error("SOURCE_UNOPENED");
    return { ...opened.get(fd).row };
  });
  fs.lstatSync.mockImplementation(path => {
    hooks.lstat?.(path);
    if (!files.has(path)) throw Error("SOURCE_MISSING:" + path);
    return { ...files.get(path) };
  });
  fs.realpathSync.mockImplementation(path => hooks.realpath?.(path) ?? path);
  fs.readFileSync.mockImplementation(fd => {
    const entry = opened.get(fd);
    hooks.read?.(entry); events.push("read:" + entry.path); return Buffer.from(entry.row.bytes);
  });
  fs.writeSync.mockImplementation((fd, b, offset, length) => {
    const entry = opened.get(fd), n = hooks.writeCount?.(length) ?? length;
    if (Number.isSafeInteger(n) && n > 0 && n <= length) {
      entry.row.bytes = Buffer.concat([entry.row.bytes, b.subarray(offset, offset + n)]);
      entry.row.size = entry.row.bytes.length;
    }
    events.push("write:" + entry.path); hooks.write?.(entry); return n;
  });
  fs.fsyncSync.mockImplementation(fd => {
    const entry = opened.get(fd); events.push("fsync:" + entry.path); hooks.sync?.(entry);
  });
  // Model the old implementation faithfully for the witnessed RED run.
  fs.linkSync.mockImplementation((from, to) => {
    if (files.has(to)) throw Error("EEXIST");
    files.get(from).nlink++; files.set(to, files.get(from));
  });
  fs.unlinkSync.mockImplementation(path => { files.get(path).nlink--; files.delete(path); });
});
afterEach(() => { expect(opened.size).toBe(0); expect(spawn).not.toHaveBeenCalled(); vi.restoreAllMocks(); });

describe.each([
  ["HOST", publishClockHostOriginal, 65536],
  ["observation", observationWrite, 1048576],
  ["namespace", atomicPrivateWrite, 1048576],
])("SOURCE original publication through the real %s wrapper", (_label, writer, maximum) => {
  const publish = () => writer(ROOT, NAME, value, 501);
  it("retains the distinct original fd through file fsync, actual directory fsync and readback before handoff", () => {
    hooks.writeCount = length => Math.min(length, 2);
    hooks.sync = entry => {
      expect(files.get(PATH).bytes.equals(bytes)).toBe(true);
      expect([...opened.values()].some(e => e.path === PATH && e.row === files.get(PATH))).toBe(true);
      if (entry.path === ROOT) {
        expect(events).toContain("fsync:" + PATH);
        expect([...opened.values()].filter(e => e.row === entry.row)).toHaveLength(1);
      }
    };
    hooks.read = () => {
      expect(events).toContain("fsync:" + PATH);
      expect([...opened.values()].some(e => e.path === ROOT)).toBe(true);
      expect([...opened.values()].filter(e => e.path === PATH)).toHaveLength(2);
    };
    const handle = publish(); events.push("private-handoff");
    expect(handle).toMatchObject({ path: PATH, nlink: 1, size: bytes.length, ctime_ms: 100 });
    expect(events.indexOf("fsync:" + PATH)).toBeLessThan(events.indexOf("fsync:" + ROOT));
    expect(events.indexOf("fsync:" + ROOT)).toBeLessThan(events.lastIndexOf("read:" + PATH));
    expect(events.indexOf("read:" + PATH)).toBeLessThan(events.indexOf("private-handoff"));
    expect(fs.linkSync).not.toHaveBeenCalled(); expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
  it("rejects a foreign directory fd specifically even when its original pathname is restored", () => {
    const original = files.get(ROOT); let injected = false;
    hooks.beforeOpen = (path, flags) => {
      if (path === ROOT && (flags & fs.constants.O_DIRECTORY)) files.set(ROOT, { ...original, ino: original.ino + 1000 });
    };
    hooks.open = (entry, flags) => {
      if (entry.path === ROOT && (flags & fs.constants.O_DIRECTORY)) { injected = true; files.set(ROOT, original); }
    };
    expect(publish).toThrow("private_original_directory_fd_changed");
    expect(injected).toBe(true); expect(files.get(ROOT)).toBe(original);
    expect(events.filter(e => e === "fsync:" + ROOT)).toHaveLength(0);
  });
  it.each(["type", "dev", "ino", "uid", "mode"])(
    "rechecks held directory %s after directory fsync, not only its restored pathname", field => {
      let injected = false;
      hooks.sync = entry => {
        if (entry.path !== ROOT) return;
        const changed = { ...entry.row };
        if (field === "type") changed.isDirectory = () => false;
        else changed[field] = field === "mode" ? 0o040755 : changed[field] + 1;
        entry.row = changed; injected = true;
      };
      expect(publish).toThrow("private_original_directory_fd_changed"); expect(injected).toBe(true);
      expect(files.get(ROOT).mode).toBe(0o040700);
    });
  it("keeps the actual directory fd validated through the final readback", () => {
    let injected = false;
    hooks.read = () => {
      if (!events.includes("fsync:" + ROOT)) return;
      const entry = [...opened.values()].find(e => e.path === ROOT);
      if (entry) { entry.row = { ...entry.row, ino: entry.row.ino + 1000 }; injected = true; }
    };
    expect(publish).toThrow("private_original_directory_fd_changed"); expect(injected).toBe(true);
  });
  it("rechecks the directory fd even after the final file-path metadata read has blocked", () => {
    let finalPathReads = 0, injected = false;
    hooks.lstat = path => {
      if (path !== PATH || events.filter(e => e === "read:" + PATH).length !== 2 || ++finalPathReads !== 2) return;
      const entry = [...opened.values()].find(e => e.path === ROOT);
      entry.row = { ...entry.row, ino: entry.row.ino + 1000 }; injected = true;
    };
    expect(publish).toThrow("private_original_directory_fd_changed"); expect(injected).toBe(true);
  });
  it.each(["file-fsync", "directory-fsync", "first-readback", "final-readback"])(
    "rejects identical bytes rewritten with restored mtime and changed ctime at %s", frontier => {
      let injected = false;
      const change = entry => {
        const file = files.get(entry.path === ROOT ? PATH : entry.path);
        file.bytes = Buffer.from(file.bytes); file.ctimeMs++; injected = true;
      };
      if (frontier.endsWith("readback")) hooks.read = entry => {
        if (frontier === "first-readback" || events.includes("fsync:" + ROOT)) change(entry);
      };
      else hooks.sync = entry => {
        if ((frontier === "directory-fsync" && entry.path === ROOT)
          || (frontier === "file-fsync" && entry.row.isFile())) change(entry);
      };
      expect(publish).toThrow(frontier.endsWith("readback") ? "private_original_changed" : "private_original_publication_changed");
      expect(injected).toBe(true);
      if (frontier === "file-fsync" || frontier === "first-readback") expect(events).not.toContain("fsync:" + ROOT);
    });
  it.each(["dev", "ino", "uid", "mode", "nlink", "size", "mtimeMs"])(
    "rejects file %s changes during its own file fsync", field => {
      let injected = false;
      hooks.sync = entry => {
        if (!entry.row.isFile()) return;
        entry.row[field] = field === "mode" ? 0o100644 : entry.row[field] + 1; injected = true;
      };
      expect(publish).toThrow("private_original_publication_changed"); expect(injected).toBe(true);
      expect(events).not.toContain("fsync:" + ROOT);
    });
  it.each(["dev", "ino", "uid", "mode", "nlink", "size", "mtimeMs"])(
    "rejects original file %s changes in the final readback after directory durability", field => {
      let injected = false;
      hooks.read = entry => {
        if (!events.includes("fsync:" + ROOT)) return;
        entry.row[field] = field === "mode" ? 0o100644 : entry.row[field] + 1; injected = true;
      };
      expect(publish).toThrow("private_original_changed"); expect(injected).toBe(true);
    });
  it("does not confuse a replaced pathname with the retained inode at readback", () => {
    hooks.read = entry => files.set(entry.path, { ...entry.row, ino: entry.row.ino + 1000 });
    expect(publish).toThrow("private_original_changed");
  });
  it("allows its own directory link-count and entry-time changes without relaxing file metadata", () => {
    hooks.write = () => { const d = files.get(ROOT); d.nlink++; d.mtimeMs++; d.ctimeMs++; };
    expect(publish()).toMatchObject({ nlink: 1, mtime_ms: 100, ctime_ms: 100 });
  });
  it.each(["file", "directory", "readback"])(
    "leaves visible complete bytes diagnostic and nonoverwritable after %s failure, without a handle", frontier => {
      const fail = () => { throw Error("SOURCE_PUBLICATION_FAILURE"); };
      if (frontier === "readback") hooks.read = fail;
      else hooks.sync = entry => { if (entry.row.isFile() === (frontier === "file")) fail(); };
      let handle;
      expect(() => { handle = publish(); }).toThrow("SOURCE_PUBLICATION_FAILURE");
      expect(handle).toBeUndefined(); expect(files.get(PATH).bytes.equals(bytes)).toBe(true);
      hooks = {};
      expect(publish).toThrow("EEXIST"); expect(files.get(PATH).bytes.equals(bytes)).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  it.each([0, -1, NaN, 0.5, bytes.length + 1])("rejects non-progress/invalid write %s, leaving diagnostic debris only", count => {
    hooks.writeCount = () => count;
    expect(publish).toThrow("short_write");
    expect(files.get(PATH).bytes).toHaveLength(0);
    expect(fs.fsyncSync).not.toHaveBeenCalled();
    hooks = {}; expect(publish).toThrow("EEXIST");
  });
  it("does not clean up or acknowledge partial final bytes after bounded write progress stops", () => {
    let writes = 0, handle;
    hooks.writeCount = () => ++writes === 1 ? 2 : 0;
    expect(() => { handle = publish(); }).toThrow("private_original_short_write");
    expect(handle).toBeUndefined(); expect(files.get(PATH).bytes.equals(bytes.subarray(0, 2))).toBe(true);
    expect(fs.fsyncSync).not.toHaveBeenCalled(); expect(fs.unlinkSync).not.toHaveBeenCalled();
    hooks = {}; expect(publish).toThrow("EEXIST");
    expect(files.get(PATH).bytes.equals(bytes.subarray(0, 2))).toBe(true);
  });
  it("allows only the exclusive winner, including a concurrent duplicate during file fsync", () => {
    let duplicate = false;
    hooks.sync = entry => {
      if (entry.path === PATH) { expect(publish).toThrow("EEXIST"); duplicate = true; }
    };
    expect(publish().path).toBe(PATH); expect(duplicate).toBe(true);
    expect(files.get(PATH).bytes.equals(bytes)).toBe(true);
  });
  it("keeps its fixed filename and byte bounds before final allocation", () => {
    expect(() => writer(ROOT, "../escape.json", value, 501)).toThrow("bound");
    const oversized = { text: Array.from({ length: maximum / 65536 }, () => "x".repeat(65536)) };
    expect(() => writer(ROOT, NAME, oversized, 501)).toThrow("bound");
    expect(fs.openSync).not.toHaveBeenCalled();
  });
  it("requires a canonical private directory before allocating the final name", () => {
    hooks.realpath = path => path === ROOT ? "/foreign" : path;
    expect(publish).toThrow("private_original_directory");
    expect(fs.openSync).not.toHaveBeenCalled();
  });
});

describe("SOURCE namespace original reader and directory custody", () => {
  it.each(["hardlink", "relative", "alias", "parent-traversal"])("rejects a %s original", fault => {
    const row = put(PATH);
    if (fault === "hardlink") row.nlink = 2;
    if (fault === "alias") hooks.realpath = path => path === PATH ? "/elsewhere.json" : path;
    const path = fault === "relative" ? "relative.json" : fault === "parent-traversal" ? ROOT + "/../case/" + NAME : PATH;
    if (path !== PATH) files.set(path, row);
    expect(() => fixedRead(path, { privateUid: 501 })).toThrow("private_original_metadata");
  });
  it.each(["path-inode", "ctime", "links"])("rejects %s substitution during descriptor readback", fault => {
    put(PATH);
    hooks.read = entry => {
      if (fault === "path-inode") files.set(PATH, { ...entry.row, ino: entry.row.ino + 1000 });
      else if (fault === "ctime") entry.row.ctimeMs++;
      else entry.row.nlink++;
    };
    expect(() => fixedRead(PATH, { privateUid: 501 })).toThrow("private_original_changed");
  });
  it("uses O_NOFOLLOW and exact metadata in a single-link private original handle", () => {
    put(PATH);
    expect(fixedRead(PATH, { privateUid: 501 }).handle).toMatchObject({ path: PATH, nlink: 1, ctime_ms: 100 });
    expect(fs.openSync).toHaveBeenCalledWith(PATH, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  });
  it("rejects a directory alias even when mode and owner match", () => {
    hooks.realpath = () => "/foreign";
    expect(() => privateDirectory(ROOT, 501)).toThrow("private_original_directory");
  });
});
