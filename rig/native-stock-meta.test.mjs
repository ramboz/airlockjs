import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const load = () => import("./native-stock-meta.mjs");
const execute = promisify(execFile);
const parent = realpathSync(tmpdir());
const entry = fileURLToPath(new URL("./native-stock-capture.mjs", import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function rows() {
  const make = (protocol, kind, pre, wire, retried = false, contained = false) => ({
    protocol, kind, admissions: Array.from({ length: pre }, (_v, n) => ({ ordinal: n, url: "synthetic-" + n })),
    receiver: Array.from({ length: wire }, (_v, n) => ({ url: "synthetic-" + Math.min(n, pre - 1),
      connection_id: 1, stream_id: n * 2 + 1 })),
    pre_reserved_vendor_requests: pre, backend_visible_http_attempts: wire, connects: 1,
    fault_triggered: retried, fault_on_reused_connection: retried || contained, failures: [],
    guards_removed_after_close: true, denied_replacement_connects: contained ? 1 : 0,
    stop_reason: contained ? "transport_failure_inconclusive" : undefined,
  });
  return [
    make("h1", "normal", 1, 1), make("h1", "cross-origin-normal", 1, 0),
    make("h1", "reused-close", 2, 3, true), make("h1", "reused-close-no-replacement", 2, 2, false, true),
    make("h1", "ceiling-close", 8, 9, true), make("h2", "normal", 1, 1),
    make("h2", "cross-origin-normal", 1, 0), make("h2", "rst-refused", 2, 3, true),
    make("h2", "rst-cancel", 2, 2), make("h2", "goaway", 2, 3, true),
    make("h2", "goaway-no-replacement", 2, 2, false, true), make("h2", "ceiling-rst-refused", 8, 9, true),
  ];
}
describe("fixed Meta-like backend attempt count diagnostic", () => {
  it("never accepts native/candidate/URL or accessor options as a diagnostic capability", async () => {
    const { runMetaCountQualification } = await load();
    await expect(runMetaCountQualification({ outputDir: "/unused", native: true })).rejects.toThrow("invalid_count_probe_options");
    await expect(runMetaCountQualification({ outputDir: "/unused", case_name: "meta-stock" })).rejects.toThrow("invalid_count_probe_options");
    await expect(runMetaCountQualification({ get outputDir() { throw Error("getter_called"); } }))
      .rejects.toThrow("invalid_count_probe_options");
  });
  it("requires matched H1/H2 positives, receiver duplicates and containment alternatives", async () => {
    const { classifyMetaCountProbe } = await load();
    expect(classifyMetaCountProbe([]).witnessed).toBe(false);
    expect(classifyMetaCountProbe(rows()).witnessed).toBe(true);
    for (const field of ["receiver", "admissions", "guards_removed_after_close", "connects"]) {
      const bad = rows(); bad.at(-1)[field] = null;
      expect(classifyMetaCountProbe(bad).witnessed).toBe(false);
    }
    const noPositive = rows(); noPositive[0].receiver = []; noPositive[0].backend_visible_http_attempts = 0;
    expect(classifyMetaCountProbe(noPositive).witnessed).toBe(false);
  });
  it("does not turn an eight-request logical receipt alone into a wire-count witness", async () => {
    const { classifyMetaCountProbe } = await load();
    const logicalOnly = rows();
    logicalOnly.at(-1).receiver.pop(); logicalOnly.at(-1).backend_visible_http_attempts = 8;
    expect(classifyMetaCountProbe(logicalOnly).witnessed).toBe(false);
  });
  it.runIf(process.env.AIRLOCK_META_COUNT_QUALIFICATION === "1")(
    "witnesses actual child exit and H1/H2 receiver retries without SDKs or an owner journal", async () => {
      const root = join(parent, "059-15-meta-count-test-" + randomBytes(10).toString("hex"));
      await mkdir(root, { mode: 0o700 });
      const output = join(root, "witness");
      let child;
      const command = [entry, "--witness-meta-counts", "--output-dir", output];
      try { child = { ...await execute(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }), code: 0 }; }
      catch (error) { child = { code: error.code, signal: error.signal ?? null, stdout: error.stdout, stderr: error.stderr }; }
      await writeFile(join(root, "test-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true }),
        { mode: 0o600, flag: "wx" });
      console.log("PRIVATE_META_COUNT_WITNESS " + output);
      expect(child.code).toBe(0);
      const witness = JSON.parse(await readFile(join(output, "witness.json")));
      expect(witness).toMatchObject({ schema: "airlock.meta-count-command-witness.v1", command_exit_observed: true,
        actual_exit_code: 2, signal: null, blocker_witnessed: true, native_execution_qualified: false });
      const reportBytes = await readFile(witness.receipts.report.path);
      const captureBytes = await readFile(witness.receipts.capture.path);
      const complete = JSON.parse(await readFile(witness.receipts.completion.path));
      expect(hash(reportBytes)).toBe(witness.receipts.report.sha256);
      expect(hash(captureBytes)).toBe(witness.receipts.capture.sha256);
      expect(complete).toMatchObject({ command_exit_observed: false, producer_exit_code: 2,
        report_sha256: hash(reportBytes), capture_sha256: hash(captureBytes) });
      const report = JSON.parse(reportBytes), raw = JSON.parse(captureBytes);
      expect(report.witnessed).toBe(true);
      expect(report.official_sdk_executed).toBe(false);
      expect(report.owner_slots_reserved).toBe(0);
      expect(report.native_execution_qualified).toBe(false);
      expect(report.full_reference_controller_qualified).toBe(false);
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      expect(report.source_pins).toEqual(witness.source_before);
      expect(report.source_pins).toEqual(witness.source_after);
      const find = (protocol, kind) => raw.cases.find(row => row.protocol === protocol && row.kind === kind);
      for (const protocol of ["h1", "h2"]) {
        expect(find(protocol, "normal")).toMatchObject({ pre_reserved_vendor_requests: 1, backend_visible_http_attempts: 1 });
        const cross = find(protocol, "cross-origin-normal");
        expect(cross).toMatchObject({ pre_reserved_vendor_requests: 1, backend_visible_http_attempts: 0 });
        expect(cross.connect_denials.auth).toBeGreaterThan(0);
      }
      for (const [protocol, kind] of [["h1", "reused-close"], ["h2", "rst-refused"], ["h2", "goaway"]]) {
        const c = find(protocol, kind);
        expect(c).toMatchObject({ pre_reserved_vendor_requests: 2, backend_visible_http_attempts: 3,
          unbudgeted_backend_attempts: 1, fault_on_reused_connection: true });
        const repeated = c.per_url.find(row => row.receiver_attempts > row.pre_reservations);
        expect(repeated).toMatchObject({ pre_reservations: 1, receiver_attempts: 2, network_request_events: 1,
          fetch_pause_events: 1 });
        const admissions = c.admissions.filter(row => row.url === repeated.url);
        expect(admissions).toHaveLength(1);
        expect(c.extra_info.filter(row => row.request_id === admissions[0].network_id)).toHaveLength(1);
        expect(c.receiver.filter(row => row.url === repeated.url).every(row => row.matched_pre_reservations.length === 1)).toBe(true);
      }
      for (const [protocol, kind] of [["h1", "ceiling-close"], ["h2", "ceiling-rst-refused"]])
        expect(find(protocol, kind)).toMatchObject({ pre_reserved_vendor_requests: 8, backend_visible_http_attempts: 9,
          owner_meta_wire_ceiling_exceeded: true });
      expect(find("h2", "ceiling-rst-refused").connects).toBe(1);
      for (const [protocol, kind] of [["h1", "reused-close-no-replacement"], ["h2", "goaway-no-replacement"]])
        expect(find(protocol, kind)).toMatchObject({ pre_reserved_vendor_requests: 2, backend_visible_http_attempts: 2,
          stop_reason: "transport_failure_inconclusive" });
      expect(raw.cases.every(c => c.admissions.every(a => a.pre_send_bytes <= 65536)
        && c.extra_info.every(e => e.bytes <= 65536))).toBe(true);
      expect((await stat(join(output, "witness.json"))).mode & 0o777).toBe(0o600);
      expect((await stat(output)).mode & 0o777).toBe(0o700);
    }, 70000);
});
