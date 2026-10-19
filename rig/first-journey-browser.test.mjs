import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
const load = () => import("./first-journey-browser.mjs");
const execute = promisify(execFile);
const entry = fileURLToPath(new URL("./first-journey-browser.mjs", import.meta.url));

describe("first-journey real browser admission", () => {
  it("rejects unsupported CLI controls before creating output or starting a browser", async () => {
    const { runBrowserQualification } = await load();
    const root = await mkdtemp(join(tmpdir(), "airlock-browser-"));
    temporary.push(root);
    await expect(runBrowserQualification({ outputDir: join(root, "new"),
      control: "live", mode: "headless" })).rejects.toThrow("invalid_options");
  });

  it("rejects an existing output path", async () => {
    const { runBrowserQualification } = await load();
    const root = await mkdtemp(join(tmpdir(), "airlock-browser-"));
    temporary.push(root);
    await expect(runBrowserQualification({ outputDir: root })).rejects.toThrow("output_unavailable");
  });

  it("rejects unknown options and relative output paths", async () => {
    const { runBrowserQualification } = await load();
    await expect(runBrowserQualification({ outputDir: "relative" })).rejects.toThrow("invalid_options");
    await expect(runBrowserQualification({ outputDir: "/unused", url: "https://example.invalid" }))
      .rejects.toThrow("invalid_options");
  });

  it("rejects symlink output parents without starting a browser", async () => {
    const { runBrowserQualification } = await load();
    const root = await mkdtemp(join(tmpdir(), "airlock-browser-"));
    temporary.push(root);
    await symlink(root, join(root, "alias"));
    await expect(runBrowserQualification({ outputDir: join(root, "alias", "new") }))
      .rejects.toThrow("output_unavailable");
  });

  it("preserves the existing no-send process policy", async () => {
    const text = await readFile(new URL("./offline-reference-network.sb", import.meta.url), "utf8");
    expect(text).toContain("(deny network*)");
    expect(text).not.toContain("(remote ip");
  });

  describe.runIf(process.env.AIRLOCK_BROWSER_QUALIFICATION === "1")("actual pinned browser and local sinks", () => {
    it.each([
      ["none", null], ["missing-body", "response_body_unavailable"],
      ["late-read", "response_read_deadline"], ["response-limit", "response_limit"],
      ["request-limit", "request_limit"], ["url-limit", "url_limit"],
      ["cleanup-failure", "context_cleanup_failed"],
      ["output-failure", "output_or_deadline_failure"], ["output-deadline", "output_or_deadline_failure"],
      ["wrong-transport", "scope_mismatch"], ["invalid-parent", "parent_invalid"],
      ["nonempty-redirect", "response_body_unavailable"], ["marker-loss", "scope_mismatch"],
      ["query-order", "scope_mismatch"], ["unsupported-frame", "unsupported_frame"],
      ["unsupported-popup", "unsupported_page"], ["unsupported-worker", "unsupported_worker"],
      ["unsupported-service-worker", "unsupported_service_worker"],
      ["unsupported-websocket", "unsupported_websocket"],
    ])("qualifies positives and detects the intended %s control", async (control, intended) => {
      const parent = await mkdtemp(join(tmpdir(), "airlock-browser-real-"));
      temporary.push(parent);
      const outputDir = join(parent, "output");
      let command;
      try {
        command = { ...await execute(process.execPath, [entry, "--output-dir", outputDir,
          "--control", control], { timeout: 62000, maxBuffer: 16384 }), exit_code: 0 };
      } catch (caught) {
        if (caught.code !== 2) throw caught;
        command = { stdout: caught.stdout, stderr: caught.stderr, exit_code: caught.code };
      }
      const report = JSON.parse(await readFile(join(outputDir, "report.json"), "utf8"));
      const outputFault = control === "output-failure" || control === "output-deadline";
      if (outputFault) {
        expect(command.exit_code).toBe(2);
        expect(report.exit_code).toBe(0);
        await expect(readFile(join(outputDir, "completion.json"))).rejects.toMatchObject({ code: "ENOENT" });
      } else expect(command.exit_code).toBe(report.exit_code);
      expect(JSON.parse(command.stdout).exit_code).toBe(command.exit_code);
      expect(report.provenance.admission_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.provenance.playwright.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(report.provenance.playwright.entry_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(report.matrix).toHaveLength(24);
      expect(report.matrix.every(row => row.passed)).toBe(true);
      for (const row of report.matrix) {
        if (row.leg === "enforced") expect(row.arrivals).toBe(0);
        else {
          expect(row.arrivals).toBeGreaterThan(0);
          expect(row.byte_comparison).toBe(true);
          expect(row.final_headers_match_sink).toBe(true);
          expect(row.extra_info_present).toBe(true);
          expect(row.redirect_cookie_attachment).toBe(true);
        }
      }
      expect(Object.values(report.cleanup).every(value => value === true)).toBe(true);
      expect(Object.values(report.claims).every(value => value === false)).toBe(true);
      expect(report.resolver_controls).toHaveLength(2);
      expect(report.resolver_controls.every(row => row.positive && row.denied && !row.query_payload_sent)).toBe(true);
      if (outputFault) {
        expect(JSON.parse(command.stdout).errors).toContain("output_or_deadline_failure");
        return;
      }
      if (intended) {
        expect(report.exit_code).toBe(2);
        expect(report.negative.detected).toBe(true);
        expect(report.negative.intended).toBe(intended);
        if (control.startsWith("unsupported-")) {
          expect(report.negative.matched_positive).toMatchObject({
            surface: control, guard_bypassed: true, passed: true,
          });
          expect(report.negative.matched_positive.arrivals).toBeGreaterThan(0);
        } else {
          expect(report.negative.positive_link).toBeGreaterThanOrEqual(0);
          expect(report.matrix[report.negative.positive_link].passed).toBe(true);
        }
        if (control === "marker-loss" || control === "nonempty-redirect") expect(report.negative.arrivals).toBe(1);
        if (["query-order", "request-limit", "url-limit", "wrong-transport", "invalid-parent",
          "unsupported-frame", "unsupported-popup",
          "unsupported-worker", "unsupported-service-worker", "unsupported-websocket"]
          .includes(control)) expect(report.negative.arrivals).toBe(0);
      } else expect(report.exit_code).toBe(0);
      const complete = JSON.parse(await readFile(join(outputDir, "completion.json"), "utf8"));
      expect(complete.result_exit_code).toBe(report.exit_code);
      expect(complete.command_exit_observed).toBe(false);
      const raw = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
      for (const localCase of raw.cases) {
        const fixture = localCase.requests.find(row => row.local);
        expect(fixture.response).toMatchObject({ status: 200, body_state: "generated_fixture" });
        expect(fixture.response.body_base64.length).toBeGreaterThan(0);
      }
      if (control === "cleanup-failure") {
        expect(raw.cases.at(-1).cleanup).toMatchObject({
          first_close_failed: true, guards_retained_for_retry: true, retry_closed: true,
          context_closed: true, observers_removed: true,
        });
        expect(raw.cases.at(-1).gate.state).toBe("failed");
      }
      for (const name of ["report", "capture"]) {
        const bytes = await readFile(join(outputDir, `${name}.json`));
        expect(complete[`${name}_sha256`]).toBe(createHash("sha256").update(bytes).digest("hex"));
        expect((await stat(join(outputDir, `${name}.json`))).mode & 0o777).toBe(0o600);
      }
      expect((await stat(outputDir)).mode & 0o777).toBe(0o700);
    }, 65000);
  });
});
