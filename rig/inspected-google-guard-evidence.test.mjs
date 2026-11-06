import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync,
  symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceModule = fileURLToPath(new URL("./inspected-google-guard-evidence.mjs", import.meta.url));
const fixture = async (prefix = ".google-guard-parent") => {
  const directory = resolve("rig", `${prefix}-${randomBytes(16).toString("hex")}`);
  mkdirSync(directory, { mode: 0o700 });
  try {
    const copy = join(directory, "evidence.mjs");
    copyFileSync(sourceModule, copy);
    return { directory, root: join(directory, "out"), evidence: await import(pathToFileURL(copy).href) };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
};
const makeCase = (root, evidence, id, port) => {
  const work = join(root, `google-reject-${id}`);
  mkdirSync(work, { mode: 0o700 });
  writeFileSync(join(work, "job.plist"), evidence.googleGuardPlist(id, port), { mode: 0o600 });
  writeFileSync(join(work, "reject"), "synthetic binary", { mode: 0o700 });
  return work;
};

it.runIf(process.platform === "darwin")("retains independent original bytes and a synthetic failure receipt", async () => {
  const { directory, root, evidence: api } = await fixture();
  const id = randomBytes(16).toString("hex"), port = 59927;
  const work = join(root, `google-reject-${id}`);
  const evidence = join(root, `google-reject-evidence-${id}`);
  try {
    api.prepareGoogleGuardParent();
    mkdirSync(work, { mode: 0o700 });
    const binary = join(work, "reject"), plist = join(work, "job.plist");
    const source = fileURLToPath(new URL("./inspected-google-reject-guard.c", import.meta.url));
    execFileSync("/usr/bin/clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", source, "-o", binary]);
    chmodSync(binary, 0o700);
    writeFileSync(plist, api.googleGuardPlist(id, port), { mode: 0o600 });
    const originalBinary = readFileSync(binary), originalPlist = readFileSync(plist);
    expect(api.captureGoogleGuardEvidence(id, port)).toBe(evidence);
    expect(existsSync(join(evidence, "prepared.json"))).toBe(true);
    const prepared = JSON.parse(readFileSync(join(evidence, "prepared.json"), "utf8"));
    expect(prepared).toMatchObject({ state: "prepared_not_invoked", command_invoked: false, readiness: "unknown", id, port,
      label: `org.airlock.google-reject.${id}`, endpoint: "127.0.0.1",
      invocation: { executable: "/bin/launchctl", args: ["bootstrap", `user/${process.getuid()}`, plist] },
      artifacts: { plist_sha256: hash(originalPlist), binary_sha256: hash(originalBinary) } });
    expect(statSync(evidence).mode & 0o777).toBe(0o700);
    expect(statSync(binary).ino).not.toBe(statSync(join(evidence, "original.binary")).ino);
    expect(statSync(plist).ino).not.toBe(statSync(join(evidence, "original.plist")).ino);
    for (const name of ["prepared.json", "original.plist", "original.binary"])
      expect(statSync(join(evidence, name)).mode & 0o777).toBe(0o600);
    writeFileSync(plist, "synthetically altered");
    expect(() => api.recordGoogleGuardInvocationAttempt(id)).toThrow("guard_evidence_changed");
    expect(existsSync(join(evidence, "invocation-attempt.json"))).toBe(false);
    api.recordSyntheticGoogleGuardFailure(id);
    rmSync(work, { recursive: true });
    expect(readFileSync(join(evidence, "original.plist"))).toEqual(originalPlist);
    expect(readFileSync(join(evidence, "original.binary"))).toEqual(originalBinary);
    const failure = JSON.parse(readFileSync(join(evidence, "synthetic-failure.json"), "utf8"));
    expect(failure).toMatchObject({ state: "synthetic_failure", command_invoked: false, readiness: "unknown", id });
    expect(existsSync(join(evidence, "invocation-attempt.json"))).toBe(false);
    expect(statSync(join(evidence, "synthetic-failure.json")).mode & 0o777).toBe(0o600);
    console.log(JSON.stringify({ state: failure.state, command_invoked: failure.command_invoked,
      readiness: failure.readiness, originals_survived_cleanup: true, changed_input_refused: true }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  expect(existsSync(work)).toBe(false);
  expect(existsSync(evidence)).toBe(false);
  console.log(JSON.stringify({ synthetic_id: id, work_removed: true, evidence_removed: true }));
}, 15000);

it.runIf(process.platform === "darwin").each([0o720, 0o702, 0o722])(
  "refuses a real writable parent before evidence preparation (mode %s)", async mode => {
  const { directory, root, evidence } = await fixture();
  const id = randomBytes(16).toString("hex"), port = 59927;
  try {
    mkdirSync(root, { mode: 0o700 });
    makeCase(root, evidence, id, port);
    chmodSync(root, mode);
    expect(lstatSync(root).mode & 0o777).toBe(mode);
    expect(() => evidence.prepareGoogleGuardParent()).toThrow("invalid_guard_evidence_parent");
    expect(lstatSync(root).mode & 0o777).toBe(mode);
    expect(() => evidence.captureGoogleGuardEvidence(id, port)).toThrow("invalid_guard_evidence_parent");
    expect(existsSync(join(root, `google-reject-evidence-${id}`))).toBe(false);
  } finally {
    if (existsSync(root)) chmodSync(root, 0o700);
    rmSync(directory, { recursive: true, force: true });
  }
  });

it.runIf(process.platform === "darwin").each([0o720, 0o702, 0o722])(
  "refuses invocation after the real parent becomes writable (mode %s)", async mode => {
  const { directory, root, evidence } = await fixture();
  const id = randomBytes(16).toString("hex"), port = 59927;
  try {
    mkdirSync(root, { mode: 0o700 });
    makeCase(root, evidence, id, port);
    const saved = evidence.captureGoogleGuardEvidence(id, port);
    chmodSync(root, mode);
    expect(lstatSync(root).mode & 0o777).toBe(mode);
    expect(() => evidence.recordGoogleGuardInvocationAttempt(id)).toThrow("invalid_guard_evidence_parent");
    expect(existsSync(join(saved, "invocation-attempt.json"))).toBe(false);
  } finally {
    if (existsSync(root)) chmodSync(root, 0o700);
    rmSync(directory, { recursive: true, force: true });
  }
  });

it.runIf(process.platform === "darwin")("records pending, not readiness, for an unchanged safe parent", async () => {
  const { directory, root, evidence } = await fixture();
  const id = randomBytes(16).toString("hex"), port = 59927;
  try {
    evidence.prepareGoogleGuardParent();
    makeCase(root, evidence, id, port);
    const saved = evidence.captureGoogleGuardEvidence(id, port);
    evidence.recordGoogleGuardInvocationAttempt(id);
    const receipt = JSON.parse(readFileSync(join(saved, "invocation-attempt.json")));
    expect(receipt).toMatchObject({ state: "invocation_pending", command_invoked: "unknown", readiness: "unknown", id });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it.runIf(process.platform === "darwin")("unit-only synthetic receipt writers distinguish failure and return without executing a command", async () => {
  const { directory, root, evidence } = await fixture(".google-guard-synthetic-unit");
  const unitId = () => `554e495454455354${randomBytes(8).toString("hex")}`;
  const failureId = unitId(), returnedId = unitId(), port = 59927;
  const syntheticError = { status: 73, signal: "SYNTHETIC_UNIT_SIGNAL", code: "SYNTHETIC_UNIT_ERROR" };
  const readReceipt = (saved, name) => {
    const path = join(saved, name);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    return JSON.parse(readFileSync(path, "utf8"));
  };
  try {
    evidence.prepareGoogleGuardParent();
    for (const id of [failureId, returnedId]) {
      makeCase(root, evidence, id, port);
      const saved = evidence.captureGoogleGuardEvidence(id, port);
      expect(readReceipt(saved, "prepared.json")).toMatchObject({
        state: "prepared_not_invoked", command_invoked: false, readiness: "unknown", id,
      });
      expect(() => evidence.recordGoogleGuardCommandFailure(id, syntheticError)).toThrow();
      expect(() => evidence.recordGoogleGuardCommandReturned(id)).toThrow();
      expect(existsSync(join(saved, "command-failure.json"))).toBe(false);
      expect(existsSync(join(saved, "command-returned.json"))).toBe(false);
      evidence.recordGoogleGuardInvocationAttempt(id);
      expect(readReceipt(saved, "invocation-attempt.json")).toEqual({
        state: "invocation_pending", command_invoked: "unknown", readiness: "unknown", id,
      });
      expect(() => evidence.recordSyntheticGoogleGuardFailure(id)).toThrow("guard_invocation_already_pending");
      expect(existsSync(join(saved, "synthetic-failure.json"))).toBe(false);
      if (id === failureId) {
        evidence.recordGoogleGuardCommandFailure(id, syntheticError);
        expect(readReceipt(saved, "command-failure.json")).toEqual({
          state: "actual_command_failure", command_invoked: "attempted", readiness: "unknown", id,
          exit_status: 73, signal: "SYNTHETIC_UNIT_SIGNAL", error_code: "SYNTHETIC_UNIT_ERROR",
        });
        expect(existsSync(join(saved, "command-returned.json"))).toBe(false);
      } else {
        evidence.recordGoogleGuardCommandReturned(id);
        expect(readReceipt(saved, "command-returned.json")).toEqual({
          state: "command_returned", command_invoked: true, readiness: "unknown", id,
        });
        expect(existsSync(join(saved, "command-failure.json"))).toBe(false);
      }
    }
    console.log("SYNTHETIC UNIT ONLY: receipt metadata tested; no command executed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  expect(existsSync(directory)).toBe(false);
});

it.runIf(process.platform === "darwin")("creates only a missing private parent and rejects symlinks", async () => {
  const first = await fixture();
  let second;
  try {
    second = await fixture();
    expect(existsSync(first.root)).toBe(false);
    first.evidence.prepareGoogleGuardParent();
    expect(lstatSync(first.root).mode & 0o777).toBe(0o700);
    chmodSync(first.root, 0o755);
    first.evidence.prepareGoogleGuardParent();
    expect(lstatSync(first.root).mode & 0o777).toBe(0o755);
    const target = join(second.directory, "target");
    mkdirSync(target, { mode: 0o700 });
    symlinkSync(target, second.root, "dir");
    expect(() => second.evidence.prepareGoogleGuardParent()).toThrow("invalid_guard_evidence_parent");
  } finally {
    rmSync(first.directory, { recursive: true, force: true });
    if (second) rmSync(second.directory, { recursive: true, force: true });
  }
});
