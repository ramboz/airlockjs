import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { witnessLocalGoogleController } from "./inspected-google-controller-witness.mjs";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
const syncState = vi.hoisted(() => ({ parent: null, synced: false, fail: false }));
vi.mock("node:child_process", async load => ({ ...await load(), spawn: mocks.spawn }));
vi.mock("node:fs", async load => {
  const fs = await load();
  return { ...fs, fsyncSync(fd) {
    const stat = fs.fstatSync(fd);
    if (syncState.parent && stat.isDirectory() && `${stat.dev}:${stat.ino}` === syncState.parent) {
      syncState.synced = true;
      if (syncState.fail) throw Error("synthetic_parent_fsync_failed");
    }
    return fs.fsyncSync(fd);
  } };
});

describe("independent SDK-free Node controller completion", () => {
  beforeEach(async () => {
    const actual = await vi.importActual("node:child_process");
    mocks.spawn.mockImplementation((...args) => actual.spawn(...args));
  });
  afterEach(() => mocks.spawn.mockReset());

  it("syncs the witness parent before spawning and propagates a sync failure", async () => {
    const output = resolve("rig/out", `google-witness-${randomBytes(8).toString("hex")}`);
    const parent = statSync(resolve("rig/out"));
    syncState.parent = `${parent.dev}:${parent.ino}`;
    syncState.synced = false;
    syncState.fail = true;
    try {
      await expect(witnessLocalGoogleController(output)).rejects.toThrow("synthetic_parent_fsync_failed");
      expect(syncState.synced).toBe(true);
      expect(mocks.spawn).not.toHaveBeenCalled();
    } finally {
      syncState.parent = null;
      syncState.fail = false;
      const id = output.slice(-16), parentPath = resolve("rig/out");
      for (const dir of [output, `${parentPath}/google-result-${id}`, `${parentPath}/google-slot-${id}`,
        `${parentPath}/google-node-${id}`]) rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite an existing completion or start a replacement witness", async () => {
    const id = randomBytes(8).toString("hex"), parent = resolve("rig/out");
    const output = `${parent}/google-witness-${id}`;
    mkdirSync(output, { mode: 0o700 });
    writeFileSync(`${output}/command-completion.json`, "preserve", { mode: 0o600 });
    try {
      await expect(witnessLocalGoogleController(output)).rejects.toThrow();
      expect(readFileSync(`${output}/command-completion.json`, "utf8")).toBe("preserve");
    } finally { rmSync(output, { recursive: true, force: true }); }
  });

  it.each(["complete", "result-collision"])("records actual child completion for %s", async kind => {
    const id = randomBytes(8).toString("hex"), parent = resolve("rig/out");
    const output = `${parent}/google-witness-${id}`;
    const result = `${parent}/google-result-${id}`, slot = `${parent}/google-slot-${id}`;
    if (kind === "result-collision") mkdirSync(result, { mode: 0o700 });
    try {
      if (kind === "complete") {
        const witness = await witnessLocalGoogleController(output);
        expect(witness).toMatchObject({ complete: true, command_exit_observed: true,
          command_close_observed: true, native_sdk_executed: false,
          public_upstream_requests: 0, native_execution_qualified: false });
        expect(witness.result_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.parse(readFileSync(`${result}/result.json`)))
          .toMatchObject({ outcome: "inconclusive", capture_complete: true, deadline_qualified: false });
      } else {
        await expect(witnessLocalGoogleController(output)).rejects.toThrow("local_google_controller_incomplete");
      }
      const completion = JSON.parse(readFileSync(`${output}/command-completion.json`));
      expect(completion).toMatchObject({ complete: false, producer_evidence: "not_validated",
        command_exit_observed: true, command_close_observed: true });
      expect(statSync(`${output}/command-completion.json`).mode & 0o777).toBe(0o600);
    } finally {
      for (const dir of [output, result, slot, `${parent}/google-node-${id}`])
        rmSync(dir, { recursive: true, force: true });
      rmSync(`${parent}/google-failure-${id}.json`, { force: true });
    }
  }, 30000);

  it.each(["missing", "tampered", "nonprivate"])("retains exit when a post-exit original is %s", async kind => {
    const id = randomBytes(8).toString("hex"), parent = resolve("rig/out");
    const output = `${parent}/google-witness-${id}`, result = `${parent}/google-result-${id}`;
    const slot = `${parent}/google-slot-${id}`, original = `${result}/original-1.bin`;
    const actual = await vi.importActual("node:child_process");
    mocks.spawn.mockImplementation((...args) => {
      const child = actual.spawn(...args);
      child.once("exit", () => {
        if (kind === "missing") unlinkSync(original);
        else if (kind === "tampered") writeFileSync(original, "tampered");
        else chmodSync(original, 0o644);
      });
      return child;
    });
    try {
      await expect(witnessLocalGoogleController(output)).rejects.toThrow("local_google_controller_incomplete");
      const completion = JSON.parse(readFileSync(`${output}/command-completion.json`));
      expect(completion).toMatchObject({ complete: false, producer_evidence: "not_validated",
        command_exit_observed: true, command_close_observed: true, exit_code: 0 });
      const witness = JSON.parse(readFileSync(`${output}/witness.json`));
      expect(witness).toMatchObject({ complete: false, failure_category: "local_google_controller_incomplete" });
      expect(witness).not.toHaveProperty("result_sha256");
    } finally {
      for (const dir of [output, result, slot, `${parent}/google-node-${id}`])
        rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});
