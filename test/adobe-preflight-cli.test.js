import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFile, symlink, unlink, mkdir } from "node:fs/promises";
import { copy, fixture, exercise, row, patchVariant, privateMode } from "./adobe-preflight-harness.js";

describe("051-01 operator CLI", () => {
  it("AC1 produces the exact useful versioned ready report and enum-only summary", async () => {
    const { report, stderr, sent } = await exercise();
    expect(report).toEqual(fixture.expected_ready_report);
    expect(stderr).toBe("overall=ready exit=0 required_ready=12 required_blocked=0 required_unverified=0 optional_unverified=4 api_requests=12\n");
    expect(sent).toHaveLength(12);
  });
  it("AC6 is byte deterministic under unchanged input/clock", async () => {
    expect((await exercise()).stdout).toBe((await exercise()).stdout);
  });
  it("accepts original six-digit UTC RFC3339 source timestamps without rewriting them", async () => {
    const bundle = copy();
    for (const value of [bundle.private_input.approval, bundle.private_input.scope_evidence, bundle.routing_evidence]) {
      for (const key of Object.keys(value)) if (key.endsWith("_at")) value[key] = value[key].replace(".000Z", ".123456Z");
    }
    const original = structuredClone(bundle);
    const { report, sent } = await exercise(bundle);
    expect(report).toEqual(fixture.expected_ready_report);
    expect(sent).toHaveLength(12);
    expect(bundle).toEqual(original);
  });
  it("AC4 freezes all nested public primitives and emits no secrets or live identifiers", async () => {
    await exercise();
  });
  it.each(fixture.variants)("handles synthetic contract variant $id without leakage", async variant => {
    const bundle = copy();
    patchVariant(bundle, variant);
    const { report, sent } = await exercise(bundle);
    expect(report).toMatchObject({ overall: variant.expected.overall, exit_code: variant.expected.exit_code });
    if (variant.expected.check_id) {
      const { check_id, overall, exit_code, requests_not_sent, ...fields } = variant.expected;
      expect(row(report, check_id)).toMatchObject(fields);
      for (const id of requests_not_sent ?? []) expect(sent).not.toContain(id);
    } else {
      expect(report.summary.api_requests).toBe(0);
      expect(row(report, "input.scope").reason).toBe("invalid_configuration");
    }
  });
  it.each([
    [], ["--input"], ["--input", "a", "--input", "b"], ["--input=a"],
    ["--token", "SENTINEL-THROWN-OBJECT"], ["--fixture", "a"], ["--help", "--input", "a"],
    ["positional"], ["--credential-secret-index", "-1"], ["--credential-secret-index", "1.5"],
  ].map(argv => [argv]))("refuses invalid invocation before reads or network %j", async argv => {
    const { report, sent } = await exercise(copy(), { argv });
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("rejects inherited flag-table name %s after valid flags, before any requests", async name => {
    const { report, sent } = await exercise(copy(), { extraArgs: [name, "ignored"] });
    expect(report.exit_code).toBe(2);
    expect(report.summary.api_requests).toBe(0);
    expect(sent).toEqual([]);
  });
  it("unexpected clock failure returns exit 3 with the same safe report", async () => {
    const { report, sent } = await exercise(copy(), { now: () => { throw { secret: "SENTINEL-THROWN-OBJECT" }; } });
    expect(report.exit_code).toBe(3);
    expect(row(report, "input.scope").reason).toBe("internal_failure");
    expect(sent).toEqual([]);
  });
  it("nonfinite clock never escapes as a thrown report serialization failure", async () => {
    expect((await exercise(copy(), { now: () => NaN })).report.exit_code).toBe(3);
  });
  it("run budget includes private-file preparation, before any network operation", async () => {
    const bundle = copy();
    let calls = 0;
    const { report, sent } = await exercise(bundle, { now: () => Date.parse(bundle.frozen_clock) + (calls++ ? 120001 : 0) });
    expect(row(report, "input.scope")).toMatchObject({ state: "unverified", reason: "timeout" });
    expect(report.exit_code).toBe(1);
    expect(sent).toEqual([]);
  });
  it("spawns real executable help without any input/credentials", () => {
    const result = spawnSync(process.execPath, ["probes/adobe-compatibility/preflight.mjs", "--help"], { encoding: "utf8", env: {} });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--input");
    expect(result.stderr).toBe("");
  });
  it("spawns real executable invalid-input/no-network failure in the same public shape", () => {
    const result = spawnSync(process.execPath, ["probes/adobe-compatibility/preflight.mjs", "--input", "/nonexistent/SENTINEL-THROWN-OBJECT"], { encoding: "utf8", env: {} });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).summary.api_requests).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("SENTINEL");
  });
  it("missing credentials is unverified, never denied; public site can still run", async () => {
    const { report, sent } = await exercise(copy(), { noCredentials: true });
    expect(report.exit_code).toBe(1);
    expect(row(report, "auth.oauth").reason).toBe("credentials_unavailable");
    expect(sent).toEqual(["site-status", "site-preview"]);
  });
  it.each([0o644, 0o640, 0o700, 0o000])("rejects unsafe credential mode %i", async mode => {
    const { report, sent } = await exercise(copy(), { prepare: paths => privateMode(paths, mode) });
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each([0o400, 0o600])("supports approved credential mode %i", async mode => {
    expect((await exercise(copy(), { prepare: paths => privateMode(paths, mode) })).report.exit_code).toBe(0);
  });
  it.each(["input", "routing", "credential"])("rejects %s symlinks", async name => {
    const { report } = await exercise(copy(), { prepare: async paths => {
      const index = ["input", "routing", "credential"].indexOf(name);
      await unlink(paths[index]);
      await symlink(paths[(index + 1) % 3], paths[index]);
    } });
    expect(report.exit_code).toBe(2);
    expect(report.summary.api_requests).toBe(0);
  });
  it("rejects nonregular input without blocking on a read", async () => {
    const { report } = await exercise(copy(), { prepare: async paths => { await unlink(paths[0]); await mkdir(paths[0]); } });
    expect(report.exit_code).toBe(2);
  });
  it.each([
    '{"kind":"SENTINEL-THROWN-OBJECT","kind":"again"}',
    '{"SENTINEL-THROWN-OBJECT":',
    '{"a":' + "[".repeat(17) + "0" + "]".repeat(17) + "}",
    " ".repeat(262145),
    '{"__proto__":{}}',
    '{"\\u006b":1,"k":2}',
  ])("refuses malformed/duplicate/deep/large/prototype JSON without parser leakage", async text => {
    const { report, sent } = await exercise(copy(), { prepare: paths => writeFile(paths[0], text) });
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each(["ORG_ID", "CLIENT_ID", "SCOPES", "TECHNICAL_ACCOUNT_ID", "TECHNICAL_ACCOUNT_EMAIL", "CLIENT_SECRETS"])("requires typed uppercase export %s", async key => {
    const bundle = copy();
    bundle.credential_export[key] = null;
    expect((await exercise(bundle)).report.exit_code).toBe(2);
  });
  it("requires explicit secret choice, never tries all; accepts selected index", async () => {
    const bundle = copy();
    bundle.credential_export.CLIENT_SECRETS.push("SECOND-SECRET");
    expect((await exercise(bundle)).report.exit_code).toBe(2);
    expect((await exercise(bundle, { extraArgs: ["--credential-secret-index", "0"] })).report.exit_code).toBe(0);
    expect((await exercise(bundle, { extraArgs: ["--credential-secret-index", "2"] })).report.exit_code).toBe(2);
  });
  it.each([
    b => { b.private_input.schema_version = 2; },
    b => { b.private_input.selectors.target.environment_id = "01"; },
    b => { b.private_input.selectors.target.property_id = "9007199254740992"; },
    b => { b.private_input.selectors.target.decision_scope = "target-global-mbox"; },
    b => { b.private_input.selectors.site.preview_origin += "/"; },
    b => { b.private_input.selectors.report_suite_id = "a".repeat(41); },
    b => { b.private_input.selectors.global_company_id = "../other"; },
    b => { b.credential_export.SCOPES = ["openid", "openid"]; },
    b => { b.credential_export.SCOPES = ["read,write"]; },
    b => { b.credential_export.CLIENT_SECRETS = ["\nsecret"]; },
    b => { b.credential_export.CLIENT_ID = "a".repeat(251); },
    b => { b.private_input.limits = { max_requests: 25 }; },
    b => { b.private_input.report_window.start = "2026-02-30T00:00:00"; },
  ])("validates closed private schemas and hard ceilings", async change => {
    const bundle = copy(); change(bundle);
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
});
