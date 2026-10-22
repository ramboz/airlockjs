import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const source = { pure_completion_reader_fixture: true };
const sourceHash = digest(JSON.stringify(source));
const handle = path => {
  const s = lstatSync(path), bytes = readFileSync(path);
  return { path, dev: s.dev, ino: s.ino, bytes: bytes.length, sha256: digest(bytes) };
};
async function fixture(fault = "") {
  mkdirSync(resolve("rig/out"), { recursive: true, mode: 0o700 });
  const root = mkdtempSync(resolve("rig/out/sdk-absent-completion-pure-")), outputDir = join(root, "case");
  mkdirSync(outputDir, { mode: 0o700 });
  vi.doMock("./sdk-absent-chrome-io.mjs", async () => ({
    ...await vi.importActual("./sdk-absent-chrome-io.mjs"), sources: () => source,
  }));
  vi.resetModules();
  const io = await import("./sdk-absent-chrome-io.mjs");
  const candidate = {
    schema: "airlock.sdk-absent-chrome-preexec-candidate.v2", control: "pre-return-abort",
    qualified: false, control_witnessed: false, sdk_absent: true, native_authority: false, native_qualified: false,
    case_root: io.directory(outputDir, "case-evidence-root"), source_vector_sha256: sourceHash,
    acquisition_control_observed: true, resource_complete: false,
    descendant_boundary: "UNKNOWN-runnable-fork-detach-escape",
    sdk_executions: 0, explicit_provider_operations: 0,
    network_scope: "pinned-loopback-policy; no provider-traffic or filesystem-confinement observation",
    browser_server_returned: false, actual_chrome_observed: true, normal_cdp: false,
    launch_permission_issued: true, acquisition_roles_fully_attributed: true,
    pre_return_abort: { engine_stopped_before_exec_ready: true,
      actual_chrome_while_engine_stopped: true, post_stop_descriptor_query: false },
    profile_kind: "REAL-isolated-browser-profile", earliest_postfork_loss: "UNPROVED", mechanical_budget_ms: 45000,
    child_exit: { code: null, signal: "SIGKILL" }, registrations: [], commands: [], signals: [], probe_dispositions: [],
    errors: ["sdk_absent_descendant_closure_UNPROVED", "sdk_absent_resource_disposition_UNKNOWN"],
    publication_contract: { status: "UNQUALIFIED-candidate", external_completion_required: true,
      mechanical_budget_ms: 45000, producer_elapsed_before_publication_ms: 2000 },
  };
  if (fault === "candidate-success-flags") { candidate.qualified = true; candidate.control_witnessed = true; candidate.resource_complete = true; }
  io.save(outputDir, "result", candidate);
  const receipt = {
    schema: "airlock.sdk-absent-chrome-whole-command-completion.v1",
    observer_scope: "external-whole-command-after-exit", exit_observed: true,
    command: [io.NODE, resolve("node_modules/vitest/vitest.mjs"), "run", "--config",
      resolve("rig/sdk-absent-chrome.browser.config.mjs"), "-t", "^ACTUAL SDK-ABSENT real Chrome pre-return-abort$"],
    actual_exit_code: 0, signal: null, timed_out: false,
    started_monotonic_ms: 1000, completed_monotonic_ms: 4000,
    candidate: handle(join(outputDir, "result.json")), source_vector_sha256: sourceHash,
    sdk_absent: true, native_authority: false,
  };
  if (fault === "failed-exit") receipt.actual_exit_code = 1;
  if (fault === "signal") receipt.signal = "SIGKILL";
  if (fault === "timeout") receipt.timed_out = true;
  if (fault === "missing-exit-observation") receipt.exit_observed = false;
  if (fault === "late-publication") receipt.completed_monotonic_ms = 47000;
  if (fault === "exact-deadline") receipt.completed_monotonic_ms = 46000;
  if (fault === "reversed-time") receipt.completed_monotonic_ms = 999;
  if (fault === "wrong-command") receipt.command[0] = "/caller-selected-program";
  if (fault === "candidate-hash") receipt.candidate.sha256 = "0".repeat(64);
  if (fault === "source-lease") receipt.source_vector_sha256 = "0".repeat(64);
  let path = join(root, "external-completion.json");
  writeFileSync(path, JSON.stringify(receipt), { mode: 0o600 });
  if (fault === "producer-self-completion") {
    const copied = join(outputDir, "self-completion.json"); copyFileSync(path, copied); path = copied;
  }
  return { root, outputDir, completion: handle(path) };
}

describe("whole-command publication completion consumer, never producer flags", () => {
  it("rejects missing external completion instead of consuming candidate flags", async () => {
    const { inspectSdkAbsentChromeCompletion } = await import("./sdk-absent-chrome-completion.mjs");
    expect(inspectSdkAbsentChromeCompletion({ outputDir: resolve("rig/out/not-issued"), completion: null }))
      .toMatchObject({ qualified: false, reason: "external_completion_missing" });
  });
  it.each(["failed-exit", "signal", "timeout", "missing-exit-observation", "late-publication", "exact-deadline",
    "reversed-time", "wrong-command", "candidate-hash", "source-lease", "producer-self-completion", "candidate-success-flags"])(
    "rejects %s even with refreshed receipt identity/hash", async fault => {
      const f = await fixture(fault);
      try {
        const { inspectSdkAbsentChromeCompletion } = await import("./sdk-absent-chrome-completion.mjs");
        const result = inspectSdkAbsentChromeCompletion({ outputDir: f.outputDir, completion: f.completion });
        expect(result.qualified).toBe(false);
        expect(result.external_completion_valid).toBe(false);
        if (["late-publication", "exact-deadline", "reversed-time"].includes(fault))
          expect(result.reason).toBe("external_completion_deadline");
      } finally { vi.doUnmock("./sdk-absent-chrome-io.mjs"); vi.resetModules(); rmSync(f.root, { recursive: true }); }
    });
  it("keeps a timely hash-bound external completion blocked on the actual unresolved descendant predicate", async () => {
    const f = await fixture();
    try {
      const { inspectSdkAbsentChromeCompletion } = await import("./sdk-absent-chrome-completion.mjs");
      expect(inspectSdkAbsentChromeCompletion({ outputDir: f.outputDir, completion: f.completion }))
        .toMatchObject({ qualified: false, external_completion_valid: true,
          reason: "sdk_absent_descendant_closure_UNPROVED" });
    } finally { vi.doUnmock("./sdk-absent-chrome-io.mjs"); vi.resetModules(); rmSync(f.root, { recursive: true }); }
  });
});
