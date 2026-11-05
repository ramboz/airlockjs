import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, rmdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", async importOriginal => ({ ...await importOriginal(), spawn: mocks.spawn }));

describe("independent Google local command witness", () => {
  afterEach(() => mocks.spawn.mockReset());

  it("rejects unknown case controls before starting any child", async () => {
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    await expect(witnessLocalGoogleQualification({ protocol: "h1", control: "native", outputDir: "/invalid" }))
      .rejects.toThrow("invalid_google_witness");
  });

  it("rejects an existing output directory before starting a child or reading stale evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "google-witness-"));
    const outputDir = join(root, "case");
    mkdirSync(outputDir);
    try {
      const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
      await expect(witnessLocalGoogleQualification({ protocol: "h1", control: "abort", outputDir }))
        .rejects.toThrow("google_witness_output_exists");
    } finally {
      rmdirSync(outputDir);
      rmdirSync(root);
    }
  });

  it.each(["absent-report", "missing-original", "invalid-digest"])(
    "persists actual child completion when producer evidence is %s", async fixture => {
      const root = mkdtempSync(join(realpathSync(tmpdir()), "google-witness-failure-"));
      const outputDir = join(root, "case");
      const { spawn: actualSpawn } = await vi.importActual("node:child_process");
      mocks.spawn.mockImplementation((_command, args, options) => {
        const runDir = args.at(-1);
        const program = `
          const fs = require("node:fs"), path = require("node:path");
          const run = process.argv[1], fixture = process.argv[2];
          fs.mkdirSync(run, { mode: 0o700 });
          if (fixture !== "absent-report") {
            const body = { file: "original-1.bin", bytes: 3, chunks: [3], sha256: "0".repeat(64) };
            fs.writeFileSync(path.join(run, "result.json"), JSON.stringify({ originals: { responses: [{ body }] } }),
              { mode: 0o600 });
            if (fixture === "invalid-digest") fs.writeFileSync(path.join(run, "original-1.bin"), "abc", { mode: 0o600 });
          }
          process.stdout.write("fixture");
          process.exitCode = 7;
        `;
        return actualSpawn(process.execPath, ["-e", program, runDir, fixture], options);
      });
      try {
        const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
        await expect(witnessLocalGoogleQualification({ protocol: "h1", control: "positive", outputDir }))
          .rejects.toMatchObject({
            message: fixture === "absent-report" ? "local_google_result_failed" : "local_google_originals_failed",
            cause: fixture === "invalid-digest" ? { message: "local_google_originals_invalid" } : { code: "ENOENT" },
          });
        expect(mocks.spawn).toHaveBeenCalledOnce();
        const path = join(outputDir, "command-completion.json");
        const completion = JSON.parse(readFileSync(path, "utf8"));
        expect(completion).toMatchObject({ complete: false, command_exit_observed: true,
          command_close_observed: true, exit_code: 7, signal: null, close_code: 7, close_signal: null,
          producer_evidence: "not_validated" });
        expect(completion.elapsed_ms).toBeGreaterThan(0);
        expect(completion.stdout_sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(statSync(path).mode & 0o777).toBe(0o600);
        const witness = JSON.parse(readFileSync(join(outputDir, "witness.json"), "utf8"));
        expect(witness).toMatchObject({ complete: false, command_exit_observed: true,
          exit_code: 7, signal: null, failure_category:
            fixture === "absent-report" ? "local_google_result_failed" : "local_google_originals_failed" });
        expect(witness).not.toHaveProperty("result_sha256");
        expect(witness).not.toHaveProperty("producer_outcome");
      } finally {
        rmSync(root, { recursive: true });
      }
    });

  it.each(["positive", "abort"])("preserves valid %s completion and witness behavior", async control => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), "google-witness-valid-"));
    const outputDir = join(root, "case");
    try {
      const { spawn: actualSpawn } = await vi.importActual("node:child_process");
      const { inspectedMetaSourcePins } = await import("./inspected-meta-stock.mjs");
      const { currentGoogleCohort } = await import("./inspected-google-cohort.mjs");
      const source = inspectedMetaSourcePins(), cohort = currentGoogleCohort();
      const report = { protocol: "h1", control, outcome: control === "abort" ? "inconclusive" : "pass",
        errors: control === "abort" ? ["synthetic_abort"] : [], receiver_attempts: 1,
        cleanup: { guard_at_context_close: true }, originals: { responses: [] },
        source_before: source, source_after: source, cohort_before: cohort, cohort_after: cohort,
        native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false };
      mocks.spawn.mockImplementation((_command, args, options) => {
        const program = `
          const fs = require("node:fs"), path = require("node:path"), run = process.argv[1];
          fs.mkdirSync(run, { mode: 0o700 });
          fs.writeFileSync(path.join(run, "result.json"), process.argv[2], { mode: 0o600 });
          process.exitCode = Number(process.argv[3]);
        `;
        return actualSpawn(process.execPath, ["-e", program, args.at(-1), JSON.stringify(report),
          control === "abort" ? "1" : "0"], options);
      });
      const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
      const witness = await witnessLocalGoogleQualification({ protocol: "h1", control, outputDir });
      expect(witness).toMatchObject({ complete: true, command_exit_observed: true,
        exit_code: control === "abort" ? 1 : 0, signal: null, failure_category: null });
      expect(JSON.parse(readFileSync(join(outputDir, "witness.json"), "utf8"))).toEqual(witness);
      expect(JSON.parse(readFileSync(join(outputDir, "command-completion.json"), "utf8")))
        .toMatchObject({ complete: false, command_close_observed: true });
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});
