import * as fs from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("closed SDK-absent handoff publication", () => {
  it("pollers see absence, never partial bytes or a transient hard-link error, until durable publication", async () => {
    fs.mkdirSync(resolve("rig/out"), { recursive: true, mode: 0o700 });
    const root = fs.mkdtempSync(resolve("rig/out/sdk-absent-atomic-pure-"));
    const target = join(root, "helper-announcement.json"), observations = [];
    let api, fileDurable = false, linkSeen = false;
    const poll = stage => {
      let outcome;
      try { api.read(target); outcome = "visible"; }
      catch (error) { outcome = error.code ?? error.message; }
      observations.push({ stage, outcome, final_path_exists: fs.existsSync(target), fileDurable });
    };
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual("node:fs");
      return { ...actual,
        writeSync: (fd, bytes, offset, length) => {
          const n = actual.writeSync(fd, bytes, offset, Math.min(7, length));
          poll("during-write"); return n;
        },
        fsyncSync: fd => {
          poll("before-fsync");
          actual.fsyncSync(fd);
          if (actual.fstatSync(fd).isFile()) fileDurable = true;
        },
        linkSync: (from, to) => {
          actual.linkSync(from, to); linkSeen = true; poll("linked-before-staging-unlink");
        },
      };
    });
    vi.resetModules();
    try {
      api = await import("./sdk-absent-chrome-io.mjs");
      api.save(root, "helper-announcement", { hello: "complete handoff" });
      expect(observations.filter(o => o.stage === "during-write").every(o => !o.final_path_exists)).toBe(true);
      expect(observations.filter(o => !o.fileDurable).every(o => o.outcome === "ENOENT")).toBe(true);
      expect(linkSeen).toBe(true);
      expect(observations.find(o => o.stage === "linked-before-staging-unlink").outcome).toBe("ENOENT");
      expect(api.read(target)).toEqual({ hello: "complete handoff", sdk_absent: true, native_authority: false });
      expect(fs.lstatSync(target).nlink).toBe(1);
    } finally { vi.doUnmock("node:fs"); vi.resetModules(); fs.rmSync(root, { recursive: true }); }
  });
  it("keeps exclusivity, private single-link reads, symlink refusal and committed malformed-data errors", async () => {
    fs.mkdirSync(resolve("rig/out"), { recursive: true, mode: 0o700 });
    const root = fs.mkdtempSync(resolve("rig/out/sdk-absent-atomic-refusal-pure-"));
    const { save, read } = await import("./sdk-absent-chrome-io.mjs");
    try {
      const original = save(root, "exec-ready", { ready: true });
      const bytes = fs.readFileSync(original.path);
      expect(() => save(root, "exec-ready", { ready: false })).toThrow();
      expect(fs.readFileSync(original.path)).toEqual(bytes);
      fs.symlinkSync("missing-owned-file", join(root, "linked.json"));
      expect(() => save(root, "linked", { forged: true })).toThrow();
      expect(fs.lstatSync(join(root, "linked.json")).isSymbolicLink()).toBe(true);
      fs.linkSync(original.path, join(root, "unapproved-alias"));
      expect(() => read(original.path)).toThrow("unsafe_private_file");
      fs.unlinkSync(join(root, "unapproved-alias"));
      fs.writeFileSync(original.path, "{malformed", { mode: 0o600 });
      expect(() => read(original.path)).toThrow();
      try { read(original.path); } catch (error) { expect(error.code).not.toBe("ENOENT"); }
    } finally { fs.rmSync(root, { recursive: true }); }
  });
  it("does not reinterpret a visible malformed uncommitted final record as normal polling absence", async () => {
    fs.mkdirSync(resolve("rig/out"), { recursive: true, mode: 0o700 });
    const root = fs.mkdtempSync(resolve("rig/out/sdk-absent-malformed-pure-"));
    const { read } = await import("./sdk-absent-chrome-io.mjs");
    try {
      const path = join(root, "helper-announcement.json");
      fs.writeFileSync(path, "{incomplete-final", { mode: 0o600 });
      let failure;
      try { read(path); } catch (error) { failure = error; }
      expect(failure).toBeDefined();
      expect(failure.code).not.toBe("ENOENT");
    } finally { fs.rmSync(root, { recursive: true }); }
  });
});
