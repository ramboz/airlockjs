import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { chmod, link, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const entry = fileURLToPath(new URL("./native-stock-capture.mjs", import.meta.url));
const load = () => import("./native-stock-capture.mjs");
const temporary = [];
const retainedParent = realpathSync(tmpdir());
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

async function slotFixture() {
  const root = await temp(), now = Date.now();
  const authority = {
    schema_version: 1, kind: "owner_conversation_authority", status: "approved_conditional",
    authority_id: "synthetic-only-grant",
    cases: Object.fromEntries(["google-stock", "meta-stock", "google-chamber", "meta-chamber"]
      .map(name => [name, { reserved: false, admitted: false, spent: false }])),
    limits: {
      google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
      google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
      google_vendor_https_requests_per_case: 20, meta_vendor_https_requests_per_case: 8,
      observed_requests_per_case: 64, absolute_seconds_per_case: 60, url_bytes: 2048,
      request_headers_and_body_bytes: 65536, response_bytes: 2097152, retained_aggregate_bytes: 8388608,
    },
  };
  const path = join(root, "synthetic-owner-record.json");
  const options = { authority_path: path, authority_sha256: "", case_name: "meta-stock",
    input_sha256: "a".repeat(64), source_sha256: "b".repeat(64),
    window: { not_before_ms: now - 10000, expires_at_ms: now + 10000 } };
  const save = async () => {
    const bytes = Buffer.from(JSON.stringify(authority));
    await writeFile(path, bytes, { mode: 0o600 });
    options.authority_sha256 = hash(bytes);
  };
  await save();
  return { root, now, authority, path, options, save,
    canonical: join(root, "native-stock-slots-synthetic-only-grant") };
}

describe("canonical stock reservation using synthetic owner-shaped records only", () => {
  it("pins the new journal's entire additional dependency and test closure", async () => {
    const { metaSourcePins } = await import("./native-stock-meta.mjs");
    const pins = metaSourcePins();
    for (const name of ["meta-additional-authority.mjs", "meta-additional-authority.test.mjs",
      "inspected-meta-record.mjs", "inspected-meta-record.test.mjs",
      "meta-additional-supervision.mjs", "meta-additional-supervision.test.mjs"])
      expect(pins[name]).toBe(hash(await readFile(new URL(name, import.meta.url))));
  });
  it("durably reserves once without certifying owner identity or execution eligibility", async () => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    const result = reserveStockSlot(f.options);
    expect(result).toMatchObject({ case_name: "meta-stock", reserved: true,
      network_authorized: false, owner_identity_authenticated: false,
      execution_prerequisites_proved: false });
    const record = JSON.parse(await readFile(result.canonical_record_path, "utf8"));
    expect(record).toMatchObject({ state: "spent", case_name: "meta-stock",
      source_sha256: f.options.source_sha256, input_sha256: f.options.input_sha256 });
    expect((await stat(result.canonical_record_path)).mode & 0o777).toBe(0o600);
    expect((await stat(f.canonical)).mode & 0o777).toBe(0o700);
    expect(() => reserveStockSlot(f.options)).toThrow("stock_slot_spent");
  });

  it("cannot reset a spent slot through new digests or updated authority contents", async () => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    reserveStockSlot(f.options);
    f.authority.operator_note = "synthetic record update, not a renewed grant";
    await f.save();
    expect(() => reserveStockSlot({ ...f.options, input_sha256: "c".repeat(64),
      source_sha256: "d".repeat(64) })).toThrow("stock_slot_spent");
    expect(() => reserveStockSlot({ ...f.options, outputDir: join(f.root, "new-output") }))
      .toThrow("invalid_slot_input");
  });

  it.each(["google-chamber", "meta-chamber", "unknown", null])(
    "rejects %s before reading any authority path", async case_name => {
      const { reserveStockSlot } = await load();
      expect(() => reserveStockSlot({ case_name, authority_path: "/definitely/not/available" }))
        .toThrow("unsupported_case");
    });

  it("captures immutable case/digest inputs before invoking a clock provider", async () => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    const original = f.options.input_sha256;
    f.options.clock = () => {
      f.options.case_name = "meta-chamber";
      f.options.input_sha256 = "c".repeat(64);
      return f.now;
    };
    const result = reserveStockSlot(f.options);
    expect(result.case_name).toBe("meta-stock");
    expect(JSON.parse(await readFile(result.canonical_record_path, "utf8")).input_sha256).toBe(original);
    expect(await readdir(f.canonical)).toEqual(["meta-stock.reserved"]);
  });

  it("rejects a changing case accessor before invocation or canonical reservation", async () => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    let reads = 0;
    Object.defineProperty(f.options, "case_name", {
      enumerable: true, get: () => ++reads < 3 ? "meta-stock" : "meta-chamber",
    });
    expect(() => reserveStockSlot(f.options)).toThrow("invalid_slot_input");
    expect(reads).toBe(0);
    expect(await readdir(f.root)).toEqual(["synthetic-owner-record.json"]);
  });

  it.each(["options", "window"])("rejects a %s proxy without invoking traps", async kind => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    let calls = 0;
    const wrap = value => new Proxy(value, {
      getPrototypeOf() { calls++; throw Error("proxy_invoked"); },
      ownKeys() { calls++; throw Error("proxy_invoked"); },
      get() { calls++; throw Error("proxy_invoked"); },
    });
    const options = kind === "options" ? wrap(f.options) : { ...f.options, window: wrap(f.options.window) };
    expect(() => reserveStockSlot(options)).toThrow("invalid_slot_input");
    expect(calls).toBe(0);
    expect(await readdir(f.root)).toEqual(["synthetic-owner-record.json"]);
  });

  it("rejects accessor window fields before invoking getters or reading authority", async () => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    let calls = 0;
    Object.defineProperty(f.options.window, "expires_at_ms", {
      enumerable: true, get() { calls++; return f.now + 1000; },
    });
    expect(() => reserveStockSlot(f.options)).toThrow("invalid_slot_input");
    expect(calls).toBe(0);
    expect(await readdir(f.root)).toEqual(["synthetic-owner-record.json"]);
  });

  it.each(["proposed", "wrong-limit", "reported-spent", "wrong-id", "stale-digest"])(
    "rejects %s before creating the canonical directory", async kind => {
      const { reserveStockSlot } = await load(), f = await slotFixture();
      if (kind === "proposed") f.authority.status = "proposed";
      if (kind === "wrong-limit") f.authority.limits.meta_vendor_https_requests_per_case = 9;
      if (kind === "reported-spent") f.authority.cases["meta-stock"].spent = true;
      if (kind === "wrong-id") f.authority.authority_id = "../escape";
      await f.save();
      if (kind === "stale-digest") f.options.authority_sha256 = "f".repeat(64);
      expect(() => reserveStockSlot(f.options)).toThrow(
        kind === "stale-digest" ? "slot_authority_unavailable" : "slot_authority_invalid");
      expect(await readdir(f.root)).toEqual(["synthetic-owner-record.json"]);
    });

  it.each(["public-authority", "authority-symlink", "directory-symlink", "record-symlink", "hardlinked-record"])(
    "does not use unsafe files: %s", async kind => {
      const { reserveStockSlot } = await load(), f = await slotFixture();
      if (kind === "public-authority") await chmod(f.path, 0o644);
      if (kind === "authority-symlink") {
        await symlink(f.path, join(f.root, "alias.json"));
        f.options.authority_path = join(f.root, "alias.json");
      }
      if (kind === "directory-symlink") await symlink(f.root, f.canonical);
      if (["record-symlink", "hardlinked-record"].includes(kind)) {
        await mkdir(f.canonical, { mode: 0o700 });
        if (kind === "record-symlink") await symlink(f.path, join(f.canonical, "meta-stock.reserved"));
        else {
          const other = join(f.root, "synthetic-other-record");
          await writeFile(other, "synthetic", { mode: 0o600 });
          await link(other, join(f.canonical, "meta-stock.reserved"));
        }
      }
      expect(() => reserveStockSlot(f.options)).toThrow(
        ["public-authority", "authority-symlink"].includes(kind)
          ? "slot_authority_unavailable" : "stock_reservation_failed");
      expect(hash(await readFile(f.path))).toBe(f.options.authority_sha256);
    });

  it("does not reserve outside the window and never refunds an expired post-reservation", async () => {
    const { reserveStockSlot } = await load(), f = await slotFixture();
    expect(() => reserveStockSlot({ ...f.options, clock: () => f.options.window.expires_at_ms }))
      .toThrow("slot_window_inactive");
    expect(await readdir(f.root)).toEqual(["synthetic-owner-record.json"]);
    let calls = 0;
    expect(() => reserveStockSlot({ ...f.options, clock: () => ++calls < 3
      ? f.now : f.options.window.expires_at_ms })).toThrow("slot_window_inactive");
    expect(await readdir(f.canonical)).toEqual(["meta-stock.reserved"]);
    expect(() => reserveStockSlot(f.options)).toThrow("stock_slot_spent");
  });

  it("has exactly one winner across simultaneous external processes", async () => {
    const f = await slotFixture();
    const program = `import{reserveStockSlot}from${JSON.stringify(new URL("./native-stock-capture.mjs", import.meta.url).href)};
      try { const r=reserveStockSlot(JSON.parse(process.argv[1])); console.log(r.reserved?"reserved":"invalid"); }
      catch(e){ console.log(e.message); }`;
    const rows = await Promise.all(Array.from({ length: 4 }, () => execute(process.execPath, [
      "--input-type=module", "-e", program, JSON.stringify(f.options),
    ], { timeout: 3000, maxBuffer: 4096 })));
    expect(rows.map(row => row.stdout.trim()).sort()).toEqual([
      "reserved", "stock_slot_spent", "stock_slot_spent", "stock_slot_spent",
    ]);
  });
});
async function temp() {
  const path = join(retainedParent, "059-15-capture-unit-" + randomBytes(12).toString("hex"));
  await mkdir(path, { mode: 0o700 });
  temporary.push(path);
  return path;
}

describe("059-15 blocked operator entry", () => {
  it.each([
    { outputDir: "relative" }, { outputDir: "/unused", url: "https://example.invalid" },
    { outputDir: "/unused", parentResponse: {} }, { outputDir: "/unused", mode: "native" },
    { outputDir: "/unused", source: "/unused" }, { outputDir: "/unused", execute: "meta-stock" },
  ])("AC1/2: rejects unclosed or native input without filesystem changes: %j", async options => {
    const { runQualification } = await load();
    await expect(runQualification(options)).rejects.toThrow("invalid_options");
  });

  it("AC4/5: actual CLI refuses stock/candidate execution before output/journal/SDK startup", async () => {
    const root = await temp();
    for (const key of ["google-stock", "meta-stock", "google-chamber", "meta-chamber"]) {
      await expect(execute(process.execPath, [entry, "--execute", key, "--output-dir", join(root, "new")]))
        .rejects.toMatchObject({ code: 3, stderr: expect.stringContaining(
          key.endsWith("-stock") ? "pre_admission_blocked" : "unsupported_case") });
    }
    expect(await readdir(root)).toEqual([]);
  });

  it("AC7: rejects existing, symlink, nonprivate and symlink-ancestor output paths", async () => {
    const { runQualification } = await load();
    const root = await temp();
    await symlink(root, join(root, "alias"));
    await expect(runQualification({ outputDir: root })).rejects.toThrow("output_unavailable");
    await expect(runQualification({ outputDir: join(root, "alias", "new") })).rejects.toThrow("output_unavailable");
    await chmod(root, 0o755);
    await expect(runQualification({ outputDir: join(root, "new") })).rejects.toThrow("output_unavailable");
  });

  describe.runIf(process.env.AIRLOCK_NATIVE_STOCK_QUALIFICATION === "1")("actual isolated H1/H2 TLS receivers", () => {
    it("AC3/6/7: retains exact blocker evidence, matched controls and independent child exit", async () => {
      // Retain these actual receipts; unlike unit scratch they must survive the test.
      const root = join(retainedParent, "059-15-implementation-qualification-" + randomBytes(12).toString("hex"));
      await mkdir(root, { mode: 0o700 });
      const outputDir = join(root, "probe");
      const args = [entry, "--qualify", "--output-dir", outputDir];
      const sourcePins = Object.fromEntries(await Promise.all(
        ["native-stock-capture.mjs", "native-stock-egress.mjs", "native-stock-policy.mjs"]
          .map(async name => [name, hash(await readFile(new URL(name, import.meta.url)))])));
      let child;
      try {
        child = { ...await execute(process.execPath, args, { timeout: 62000, maxBuffer: 8192 }), code: 0 };
      } catch (caught) {
        child = { code: caught.code, signal: caught.signal ?? null, stdout: caught.stdout, stderr: caught.stderr };
      }
      await writeFile(join(root, "actual-child.json"), JSON.stringify({
        command: [process.execPath, ...args], ...child, command_exit_observed: true, source_sha256: sourcePins,
        receipts: await Promise.all(["report.json", "capture.json", "completion.json"].map(async name => {
          try { return { name, sha256: hash(await readFile(join(outputDir, name))) }; }
          catch { return { name, unavailable: true }; }
        })),
      }), { flag: "wx", mode: 0o600 });
      expect(child.code).toBe(2); // Witnessed blocker is NOT a successful native qualification.
      const reportBytes = await readFile(join(outputDir, "report.json"));
      const report = JSON.parse(reportBytes);
      expect(report.schema).toBe("airlock.native-stock-pre-admission-blocker.v1");
      expect(report.witnessed).toBe(true);
      for (const [name, digest] of Object.entries(sourcePins)) expect(report.provenance[name]).toBe(digest);
      expect(report.blockers).toEqual(["staged_headers_not_final", "response_precontinuation_bound_unqualified"]);
      expect(report.claims).toEqual({
        native_sdk_executed: false, live_guard_qualified: false, case_reserved: false,
        vendor_http_received: false, product_receipt: false, matching: false, attribution: false,
      });
      expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
      for (const row of report.protocols) {
        expect(row.complete).toBe(true);
        expect(row.controls).toMatchObject({
          positive: 1, enforced: 0, bypass: 1,
          unauthenticated: "proxy_auth_required", wrong_auth: "proxy_auth_required",
          wrong_authority: "authority_denied", no_ticket: "ticket_required",
          same_tunnel_unknown_denied: 0, same_tunnel_unknown_bypass: 1,
          same_tunnel_marker_denied: 0, same_tunnel_marker_bypass: 1,
          redirect_denied: 0, redirect_bypass: 1,
          same_tunnel_reused: true, proxy_auth_at_sink: false,
        });
        expect(row.headers.staged_bytes).toBeLessThanOrEqual(65536);
        expect(row.headers.final_bytes).toBeGreaterThan(65536);
        expect(row.headers.sink_bytes).toBe(row.headers.final_bytes);
        expect(row.headers.arrivals).toBe(1); // Deliberate synthetic falsification, never a safe guard.
        expect(row.response.content_length_absent).toBe(true);
        expect(row.response.encoded_bytes).toBeLessThan(2097152);
        expect(row.response.paused_original_bytes).toBe(2097153);
        expect(row.response.paused_original_matches).toBe(true);
        expect(row.response.paused_renderer_denied).toBe(true);
        expect(row.response.stream_renderer_completed_bytes).toBe(2097153);
      }
      const complete = JSON.parse(await readFile(join(outputDir, "completion.json")));
      expect(complete.command_exit_observed).toBe(false);
      expect(complete.report_sha256).toBe(hash(reportBytes));
      const captureBytes = await readFile(join(outputDir, "capture.json"));
      expect(complete.capture_sha256).toBe(hash(captureBytes));
      const raw = JSON.parse(captureBytes);
      for (const protocol of raw.protocols) {
        expect(protocol.cases.flatMap(row => row.arrivals).every(row =>
          row.http_version === (protocol.protocol === "h2" ? "2.0" : "1.1"))).toBe(true);
        const paused = protocol.cases.find(row => row.kind === "response-paused");
        const original = gunzipSync(Buffer.from(paused.paused_original_gzip_base64, "base64"));
        expect(original.length).toBe(2097153);
        expect(original[0]).toBe(0);
        expect(original.at(-1)).toBe(2097152 % 251);
      }
      for (const name of ["capture.json", "report.json", "completion.json", "certificate.pem", "key.pem"]) {
        expect((await stat(join(outputDir, name))).mode & 0o777).toBe(0o600);
      }
      expect((await stat(outputDir)).mode & 0o777).toBe(0o700);
    }, 65000);
  });
});
