import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
const load = () => import("./first-journey-browser.mjs");

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
      ["nonempty-redirect", "response_body_unavailable"], ["marker-loss", "scope_mismatch"],
      ["query-order", "scope_mismatch"], ["unsupported-frame", "unsupported_frame"],
      ["unsupported-popup", "unsupported_page"], ["unsupported-worker", "unsupported_worker"],
      ["unsupported-websocket", "unsupported_websocket"],
    ])("qualifies positives and detects the intended %s control", async (control, intended) => {
      const { runBrowserQualification } = await load();
      const parent = await mkdtemp(join(tmpdir(), "airlock-browser-real-"));
      temporary.push(parent);
      const outputDir = join(parent, "output");
      const report = await runBrowserQualification({ outputDir, control });
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
      if (intended) {
        expect(report.exit_code).toBe(2);
        expect(report.negative.detected).toBe(true);
        expect(report.negative.intended).toBe(intended);
        expect(report.negative.positive_link).toBeGreaterThanOrEqual(0);
        if (control === "marker-loss" || control === "nonempty-redirect") expect(report.negative.arrivals).toBe(1);
        if (["query-order", "request-limit", "url-limit", "unsupported-frame", "unsupported-popup",
          "unsupported-worker", "unsupported-websocket"].includes(control)) expect(report.negative.arrivals).toBe(0);
      } else expect(report.exit_code).toBe(0);
      const complete = JSON.parse(await readFile(join(outputDir, "completion.json"), "utf8"));
      expect(complete.exit_code).toBe(report.exit_code);
      for (const name of ["report", "capture"]) {
        const bytes = await readFile(join(outputDir, `${name}.json`));
        expect(complete[`${name}_sha256`]).toBe(createHash("sha256").update(bytes).digest("hex"));
        expect((await stat(join(outputDir, `${name}.json`))).mode & 0o777).toBe(0o600);
      }
      expect((await stat(outputDir)).mode & 0o777).toBe(0o700);
    }, 65000);
  });
});
