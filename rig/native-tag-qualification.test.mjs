import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runLocalQualification } from "./native-tag-qualification.mjs";

const execute = promisify(execFile);
const digest = value => createHash("sha256").update(value).digest("hex");

describe("local native-tag qualification", () => {
  const temporary = [];
  afterEach(async () => {
    for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
  });

  it("rejects a broader surface before creating output or starting a browser", async () => {
    const report = await runLocalQualification({
      outputDir: "/uncreated-qualification-output",
      surface: "all-browser-traffic",
    });
    expect(report.overall).toBe("invalid_input");
    expect(report.exit_code).toBe(3);
    expect(report.errors).toContain("unsupported_surface");
    expect(report.claims.vendor_dispatch_verified).toBe(false);
  });

  it("qualifies every real local transport against matched positive and bypass arrivals", async () => {
    const parent = await mkdtemp(join(tmpdir(), "airlock-local-qualification-"));
    temporary.push(parent);
    const outputDir = join(parent, "private-run");
    const report = await runLocalQualification({ outputDir });
    expect(report.overall).toBe("qualified");
    expect(report.exit_code).toBe(0);
    expect(report.evidence_layer).toBe("local_network");
    expect(report.cases.map(row => row.name)).toEqual([
      "fetch_get", "fetch_post", "image", "xhr", "beacon", "redirect", "fanout",
    ]);
    for (const row of report.cases) {
      expect(row.positive.arrivals).toBe(1);
      expect(row.positive.attempts).toBe(1);
      expect(row.enforced.arrivals).toBe(0);
      expect(row.enforced.attempts).toBe(1);
      expect(row.enforced.blocked).toBe(1);
      expect(row.bypass.arrivals).toBe(1);
      expect(row.bypass.detected).toBe(true);
    }
    expect(Object.values(report.claims).every(value => value === false)).toBe(true);
    expect(report.cleanup.browser_closed).toBe(true);
    expect(report.cleanup.servers_closed).toBe(true);
    expect(report.cleanup.pending_reads).toBe(0);
    expect(report.cleanup.listeners_detached).toBe(true);
    expect(report.expected_positive_cases).toHaveLength(7);
    expect(report.observation_window.started_at).toBeTruthy();
    expect(report.observation_window.stopped_at).toBeTruthy();
    expect(report.capture_complete).toBe(true);
    expect(report.guard.mechanism).toBe("cdp_fetch_request_stage");
    expect(report.guard.qualified).toBe(true);
    expect(JSON.stringify(report)).not.toContain("http://");
    expect(JSON.stringify(report)).not.toContain("qualification-private-marker");
    expect((await stat(outputDir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(outputDir, "capture.json"))).mode & 0o777).toBe(0o600);
    const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
    expect(capture.requests.length).toBe(report.counts.stored_requests);
    expect(capture.requests.some(row => row.request_body_base64)).toBe(true);
    // Retain original bytes once; the independent sink witnesses their exact digest/length.
    expect(capture.receiver_requests.some(row => row.body_bytes > 0 && row.body_sha256)).toBe(true);
    const duplicateQuery = capture.requests.find(row => row.url.includes("case=fetch_get"));
    expect(new URL(duplicateQuery.url).searchParams.getAll("dup")).toEqual(["first", "second"]);
    for (const leg of ["positive", "enforced", "bypass"]) {
      for (const [kind, path] of [["http_redirect", "/redirect"], ["response_url", "/fanout"]]) {
        const source = capture.requests.find(row => row.leg === leg
          && new URL(row.url).pathname === path);
        const links = capture.links.filter(row => row.kind === kind && row.from === source.ordinal);
        expect(links).toHaveLength(1);
        const target = capture.requests[links[0].to];
        expect(target.leg).toBe(leg);
        expect(new URL(target.url).pathname).toBe("/target");
      }
    }
    expect(capture.links).toHaveLength(6);
  }, 120000);

  it.each([
    ["empty-reference", "inconclusive", 2],
    ["dropped-request", "inconclusive", 2],
    ["missing-response", "inconclusive", 2],
    ["hung-read", "inconclusive", 2],
    ["wrong-body", "nonconformant", 1],
    ["guard-bypass", "nonconformant", 1],
    ["broken-positive", "inconclusive", 2],
    ["request-body-limit", "inconclusive", 2],
    ["response-body-limit", "inconclusive", 2],
    ["aggregate-body-limit", "inconclusive", 2],
    ["request-limit", "inconclusive", 2],
    ["url-byte-limit", "inconclusive", 2],
    ["dropped-redirect-branch", "inconclusive", 2],
    ["dropped-fanout-branch", "inconclusive", 2],
    ["late-response-timeout", "inconclusive", 2],
    ["transport-abort", "inconclusive", 2],
  ])("cannot qualify the %s falsification control", async (control, overall, exitCode) => {
    const parent = await mkdtemp(join(tmpdir(), "airlock-local-control-"));
    temporary.push(parent);
    const outputDir = join(parent, "private-run");
    const report = await runLocalQualification({ outputDir, control });
    expect(report.overall).toBe(overall);
    expect(report.exit_code).toBe(exitCode);
    expect(report.cleanup.browser_closed).toBe(true);
    expect(report.cleanup.servers_closed).toBe(true);
    expect(report.counts.stored_requests).toBeLessThanOrEqual(64);
    expect(report.counts.retained_body_bytes).toBeLessThanOrEqual(4194304);
    expect(JSON.stringify(report)).not.toContain("qualification-private-marker");
    expect(JSON.stringify(report)).not.toContain("http://");
    const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
    if (control === "request-limit") {
      expect(report.counts.stored_requests).toBe(64);
      expect(report.counts.observed_requests).toBeGreaterThan(64);
      expect(report.errors).toContain("request_limit");
    }
    if (control.includes("body-limit")) {
      expect(report.errors).toContain("body_byte_limit");
    }
    if (control === "url-byte-limit") {
      expect(report.errors).toContain("url_byte_limit");
      expect(capture.requests.every(row => Buffer.byteLength(row.url) <= 2048)).toBe(true);
    }
    if (control === "aggregate-body-limit") {
      expect(report.counts.retained_body_bytes).toBeGreaterThanOrEqual(3 * 1048576);
      expect(capture.receiver_requests.reduce((sum, row) => sum + row.response_body_bytes, 0))
        .toBeGreaterThan(4194304);
    }
    if (control === "response-body-limit") {
      expect(capture.receiver_requests.some(row => row.response_body_bytes === 1048577)).toBe(true);
    }
    if (control === "empty-reference") {
      expect(capture.requests).toHaveLength(0);
      expect(capture.receiver_requests.length).toBeGreaterThan(0);
    }
    if (control === "dropped-request") {
      expect(capture.receiver_requests.some(row => row.name === "fetch_get" && row.leg === "positive"))
        .toBe(true);
      expect(capture.requests.some(row => row.leg === "positive"
        && new URL(row.url).pathname === "/target"
        && new URL(row.url).searchParams.get("case") === "fetch_get")).toBe(false);
      expect(report.errors).toContain("unpaired_response");
    }
    if (control === "broken-positive") {
      expect(report.errors).toContain("invalid_fixture_request");
      expect(capture.requests.some(row => new URL(row.url).pathname === "/not-the-tripwire"))
        .toBe(true);
    }
    if (control === "missing-response" || control === "hung-read") {
      const missing = capture.requests.find(row =>
        new URL(row.url).pathname === "/target" && row.leg === "positive");
      expect(missing.response_status).toBe(200);
      expect(missing.response_body_base64).toBe(null);
      expect(report.errors).toContain(control === "hung-read" ? "settle_timeout" : "response_read_failed");
      if (control === "hung-read") expect(report.cleanup.pending_reads).toBe(1);
    }
    if (control === "wrong-body") {
      const changed = capture.requests.find(row => row.leg === "positive"
        && new URL(row.url).searchParams.get("case") === "fetch_post");
      const received = capture.receiver_requests.find(row => row.url === changed.url);
      expect(digest(Buffer.from(changed.request_body_base64, "base64")))
        .not.toBe(received.body_sha256);
      expect(report.errors).toContain("wire_mismatch");
    }
    if (control === "guard-bypass") {
      expect(report.cases.every(row => row.enforced.arrivals === 1 && row.enforced.blocked === 0))
        .toBe(true);
      expect(report.errors).toContain("guard_leak");
    }
    if (control.startsWith("dropped-") && control.endsWith("-branch")) {
      expect(report.errors).toContain("branch_relationship_incomplete");
      expect(report.cases.every(row => row.positive.arrivals === 1
        && row.enforced.arrivals === 0 && row.bypass.arrivals === 1)).toBe(true);
    }
    if (control === "late-response-timeout") {
      const late = capture.requests.find(row => row.leg === "positive"
        && new URL(row.url).searchParams.get("case") === "fetch_get");
      expect(late.capture_status).toBe("settle_timeout");
      expect(late.response_status).toBe(null);
      expect(report.errors).toContain("settle_timeout");
    }
    if (control === "transport-abort") {
      expect(capture.requests.some(row => row.capture_status === "aborted_without_guard"
        && row.transport_failure && !row.guard_blocked)).toBe(true);
      expect(report.errors).toContain("transport_failed");
    }
    expect(capture.requests.every(row => !row.response_body_base64
      || Buffer.from(row.response_body_base64, "base64").length <= 1048576)).toBe(true);
  }, 120000);

  it("rejects an existing output directory without overwriting its contents", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "airlock-existing-output-"));
    temporary.push(outputDir);
    await writeFile(join(outputDir, "sentinel"), "preserve this");
    const report = await runLocalQualification({ outputDir });
    expect(report.overall).toBe("invalid_input");
    expect(report.errors).toContain("output_directory_unavailable");
    expect(await readFile(join(outputDir, "sentinel"), "utf8")).toBe("preserve this");
    expect(await readdir(outputDir)).toEqual(["sentinel"]);
  });

  it("keeps invalid CLI input structured and sanitized", async () => {
    let failure;
    try {
      await execute(process.execPath, [
        fileURLToPath(new URL("./native-tag-qualification.mjs", import.meta.url)),
        "--unapproved-url", "qualification-private-marker",
      ], { timeout: 10000 });
    } catch (error) {
      failure = error;
    }
    expect(failure?.code).toBe(3);
    expect(JSON.parse(failure.stdout).overall).toBe("invalid_input");
    expect(failure.stdout + failure.stderr).not.toContain("qualification-private-marker");
  });

  it("imports without starting a browser or receiving server", async () => {
    const uri = new URL("./native-tag-qualification.mjs", import.meta.url).href;
    const { stdout } = await execute(process.execPath, [
      "--input-type=module", "-e",
      `await import(${JSON.stringify(uri)}); console.log(JSON.stringify(process.getActiveResourcesInfo().filter(name => /ProcessWrap|TCPServerWrap/.test(name))));`,
    ], { timeout: 10000 });
    expect(JSON.parse(stdout)).toEqual([]);
  });

  it("rejects a flag where the required output-directory value is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "airlock-cli-invalid-"));
    temporary.push(cwd);
    let failure;
    try {
      await execute(process.execPath, [
        fileURLToPath(new URL("./native-tag-qualification.mjs", import.meta.url)),
        "--output-dir", "--control",
      ], { cwd, timeout: 10000 });
    } catch (error) {
      failure = error;
    }
    expect(failure?.code).toBe(3);
    expect(JSON.parse(failure.stdout).overall).toBe("invalid_input");
  });

  it.each(["delayed-read", "late-response"])("settles and classifies %s for accepted requests", async control => {
    const parent = await mkdtemp(join(tmpdir(), "airlock-local-settle-"));
    temporary.push(parent);
    const outputDir = join(parent, "private-run");
    const report = await runLocalQualification({ outputDir, control });
    expect(report.overall).toBe("qualified");
    expect(report.cleanup.pending_reads).toBe(0);
    const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
    const target = capture.requests.find(row => row.leg === "positive"
      && new URL(row.url).searchParams.get("case") === "fetch_get");
    expect(target.capture_status).toBe("complete");
    expect(target.response_body_state).toBe("captured_bytes");
    expect(control === "delayed-read" ? target.read_completed_phase : target.response_phase)
      .toBe("settling");
  }, 120000);

  it.each(["run-timeout", "cleanup-timeout", "output-timeout"])("bounds %s without stopping unrelated resources", async control => {
    const unrelated = createServer((_request, response) => response.end("still running"));
    const unrelatedSignal = () => {};
    process.on("SIGTERM", unrelatedSignal);
    await new Promise(resolve => unrelated.listen(0, "127.0.0.1", resolve));
    try {
      const parent = await mkdtemp(join(tmpdir(), "airlock-local-deadline-"));
      temporary.push(parent);
      const outputDir = join(parent, "private-run");
      const started = Date.now();
      const report = await runLocalQualification({ outputDir, control });
      expect(report.overall).toBe("inconclusive");
      expect(report.exit_code).toBe(2);
      expect(report.errors).toContain({
        "run-timeout": "execution_deadline_exceeded",
        "cleanup-timeout": "cleanup_deadline_exceeded",
        "output-timeout": "report_output_deadline",
      }[control]);
      expect(Date.now() - started).toBeGreaterThanOrEqual(5000);
      expect(Date.now() - started).toBeLessThan(11000);
      expect(report.observation_window.max_wall_ms).toBe(10000);
      expect(report.cleanup.browser_closed).toBe(true);
      expect(report.cleanup.owned_browser_process_exited).toBe(true);
      expect(report.cleanup.servers_closed).toBe(true);
      expect(report.cleanup.listeners_detached).toBe(true);
      expect(process.listeners("SIGTERM")).toContain(unrelatedSignal);
      const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
      expect(Number.isInteger(capture.browser_process_id)).toBe(true);
      let stillAlive = false;
      try {
        process.kill(capture.browser_process_id, 0);
        stillAlive = true;
      } catch (error) {
        expect(error.code).toBe("ESRCH");
      }
      expect(stillAlive).toBe(false);
      const response = await fetch(`http://127.0.0.1:${unrelated.address().port}/`);
      expect(await response.text()).toBe("still running");
    } finally {
      process.off("SIGTERM", unrelatedSignal);
      const closed = new Promise(resolve => unrelated.close(resolve));
      unrelated.closeAllConnections();
      await closed;
    }
  }, 120000);

  it("bounds stalled output acquisition before any fixture or browser can start", async () => {
    const parent = await mkdtemp(join(tmpdir(), "airlock-local-acquire-"));
    temporary.push(parent);
    const outputDir = join(parent, "private-run");
    const started = Date.now();
    const report = await runLocalQualification({ outputDir, control: "directory-timeout" });
    expect(report.overall).toBe("inconclusive");
    expect(report.exit_code).toBe(2);
    expect(report.errors).toContain("output_acquisition_deadline");
    expect(report.observation_window.max_wall_ms).toBe(10000);
    expect(Date.now() - started).toBeGreaterThanOrEqual(9000);
    expect(Date.now() - started).toBeLessThan(11000);
    expect(report.provenance).toBe(null);
    expect(report.counts.observed_requests).toBe(0);
    expect(report.cleanup.browser_closed).toBe(true);
    expect(report.cleanup.servers_closed).toBe(true);
    expect(report.cleanup.listeners_detached).toBe(true);
    expect(await readdir(parent)).toEqual([]);
  }, 120000);
});
