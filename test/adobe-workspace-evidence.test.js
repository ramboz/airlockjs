import { describe, it, expect } from "vitest";
import { readFile, writeFile, unlink, symlink, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copy, fixture, exercise, row } from "./adobe-preflight-harness.js";

const template = JSON.parse(await readFile(new URL("./fixtures/adobe-workspace-evidence.json", import.meta.url), "utf8")).evidence_template;
const CHECK = "target.workspace_snapshot";
const body = bundle => bundle.transport_replies[6].response.body;
// Hydrate once from the pristine invented fixture, before ANY negative mutation.
function prepared() {
  const bundle = copy(), credentials = bundle.credential_export;
  bundle.workspace_evidence = {
    ...structuredClone(template),
    bindings: structuredClone(bundle.private_input.selectors),
    credential_identity_sha256: createHash("sha256").update(JSON.stringify([
      credentials.ORG_ID, credentials.CLIENT_ID, credentials.TECHNICAL_ACCOUNT_ID,
    ])).digest("hex"),
    included_property_ids: [bundle.private_input.selectors.target.property_id],
  };
  bundle.redaction_sentinels.push(template.provenance.record_ref, template.provenance.screenshot_sha256,
    bundle.workspace_evidence.credential_identity_sha256);
  return bundle;
}
function omission(bundle = prepared()) {
  body(bundle).properties.push({ id: 987654321, name: "SYNTHETIC-EXCLUDED-PROPERTY" });
  body(bundle).total++;
  bundle.redaction_sentinels.push("987654321", "SYNTHETIC-EXCLUDED-PROPERTY");
  return bundle;
}
const manualReady = {
  id: CHECK, required: true, state: "ready", evidence_basis: "owner_ui_confirmation",
  reason: "verified", next_action: "none", http_status: null, freshness: "accepted_owner_window",
};

describe("051-04 scoped workspace confirmation", () => {
  it("AC1 preserves no-evidence API report states, shape and exits, with only schema v2", async () => {
    const { report, sent } = await exercise();
    expect(report).toEqual({ ...fixture.expected_ready_report, schema_version: 2 });
    expect(sent).toEqual(fixture.transport_replies.map(reply => reply.id));
  });
  it("AC1 real executable accepts the private handle without credentials or requests", async () => {
    await exercise(prepared(), { argv: ["--help"], prepare: async paths => {
      const input = copy().private_input; delete input.scope_evidence;
      await writeFile(paths[0], JSON.stringify(input));
      const result = spawnSync(process.execPath, ["probes/adobe-compatibility/preflight.mjs",
        "--input", paths[0], "--workspace-evidence", paths[3]], { encoding: "utf8", env: {} });
      expect(result.status).toBe(1); // absent scope prevents even public site calls
      const report = JSON.parse(result.stdout);
      expect(report.schema_version).toBe(2);
      expect(report.summary.api_requests).toBe(0);
      expect(row(report, "input.scope").reason).toBe("missing_evidence");
      expect(result.stdout + result.stderr).not.toContain(paths[3]);
    } });
  });
  it("AC3 only resolves omitted non-selected assignments through exact owner evidence", async () => {
    const bundle = omission(), original = structuredClone(bundle);
    const { report, sent } = await exercise(bundle);
    expect(row(report, CHECK)).toEqual(manualReady);
    expect(report.exit_code).toBe(0);
    expect(report.schema_version).toBe(2);
    expect(report.summary).toEqual(fixture.expected_ready_report.summary);
    expect(sent).toEqual(fixture.transport_replies.map(reply => reply.id));
    expect(bundle).toEqual(original); // no inferred [] or timestamp renewal
    expect(Object.hasOwn(body(bundle).properties[1], "workspaces")).toBe(false);
  });
  it("AC5 fully known API data retains API basis/current-run status even with valid evidence", async () => {
    const bundle = prepared();
    body(bundle).properties.push({ id: 987654321, workspaces: [] }, { id: 987654322, workspaces: ["other"] });
    body(bundle).total = 3;
    const { report } = await exercise(bundle);
    expect(row(report, CHECK)).toEqual(row(fixture.expected_ready_report, CHECK));
    expect(report.exit_code).toBe(0);
  });
  it("AC5 only the workspace row changes; manual permission proof grants no product authority", async () => {
    const { report } = await exercise(omission());
    expect(report.checks.filter(check => check.id !== CHECK)).toEqual(fixture.expected_ready_report.checks.filter(check => check.id !== CHECK));
    expect(Object.keys(report)).toEqual(Object.keys(fixture.expected_ready_report));
    for (const check of report.checks) expect(Object.keys(check)).toEqual(Object.keys(manualReady));
    expect(report.claims).toEqual(fixture.expected_ready_report.claims);
  });
  it.each(["absent", "unavailable"])("AC3 %s optional evidence leaves prior omission unknown", async kind => {
    const bundle = omission(); delete bundle.workspace_evidence;
    const { report, sent } = await exercise(bundle, { workspaceHandle: kind === "unavailable" });
    expect(row(report, CHECK)).toEqual({
      ...row(fixture.expected_ready_report, CHECK), state: "unverified", reason: "schema_error",
      next_action: "review_api_contract",
    });
    expect(report.exit_code).toBe(1);
    expect(sent).toHaveLength(12);
  });
  it("an unavailable optional file leaves the fully known API path intact", async () => {
    expect((await exercise(copy(), { workspaceHandle: true })).report.exit_code).toBe(0);
  });
  it.each([
    ["missing value", ["--workspace-evidence"]],
    ["duplicate", ["--workspace-evidence", "private-again"]],
    ["unknown force", ["--force-ready", "true"]],
    ["positional", ["private-again"]],
    ["help mixed", ["--help"]],
  ])("AC2 refuses %s flags before any requests", async (_name, extraArgs) => {
    const { report, sent } = await exercise(prepared(), { extraArgs });
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  const invalid = [
    ["unknown root", e => { e.private_unknown = "SENTINEL-THROWN-OBJECT"; }],
    ["missing required", e => { delete e.confirmed_at; }],
    ["kind", e => { e.kind = "other"; }],
    ["version", e => { e.schema_version = 2; }],
    ["string version", e => { e.schema_version = "1"; }],
    ["basis", e => { e.basis = "api_read"; }],
    ["provenance extra", e => { e.provenance.extra = true; }],
    ["empty authority", e => { e.provenance.authority_ref = ""; }],
    ["long record", e => { e.provenance.record_ref = "x".repeat(251); }],
    ["control reference", e => { e.provenance.record_ref = "private\nref"; }],
    ["nonstring reference", e => { e.provenance.authority_ref = 123; }],
    ["uppercase digest", e => { e.provenance.screenshot_sha256 = "E".repeat(64); }],
    ["bad identity", e => { e.credential_identity_sha256 = "bad"; }],
    ["extra binding", e => { e.bindings.extra = true; }],
    ["binding scalar", e => { e.bindings = null; }],
    ["binding id type", e => { e.bindings.target.property_id = 101; }],
    ["noncanonical ID", e => { e.included_property_ids = ["0101"]; }],
    ["unsafe ID", e => { e.included_property_ids = ["9007199254740992"]; }],
    ["number ID", e => { e.included_property_ids = [101]; }],
    ["empty inclusion", e => { e.included_property_ids = []; }],
    ["multiple inclusion", e => { e.included_property_ids = ["101", "999"]; }],
    ["inclusion scalar", e => { e.included_property_ids = "101"; }],
    ...["permission_inventory_complete", "automatic_assignment_disabled", "owner_confirmed_saved_configuration"].map(key =>
      [key + " string", e => { e[key] = "true"; }]),
    ...["observed_at", "confirmed_at", "expires_at"].flatMap(key =>
      ["2026-02-30T00:00:00Z", "2026-10-09T24:00:00Z", "2026-10-09T00:35:00+00:00", "2026-10-09T00:35:00.Z", null].map(value =>
        [key + " invalid " + value, e => { e[key] = value; }])),
  ];
  it.each(invalid)("AC2 validates the entire closed envelope: %s", async (_name, change) => {
    const bundle = prepared(); change(bundle.workspace_evidence);
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(2);
    expect(row(report, "input.scope").reason).toBe("invalid_configuration");
    expect(sent).toEqual([]);
  });
  it.each([
    ["malformed", '{"secret":"SENTINEL-THROWN-OBJECT",'],
    ["duplicate", '{"kind":"private","\\u006bind":"again"}'],
    ["prototype", '{"__proto__":{}}'],
    ["deep", '{"a":' + "[".repeat(17) + "0" + "]".repeat(17) + "}"],
    ["large", " ".repeat(262145)],
    ["nonobject", "[]"],
    ["invalid UTF8", Buffer.from([0xff, 0xfe])],
  ])("AC2 bounded private parser refuses %s without leaking", async (_name, text) => {
    const { report, sent } = await exercise(prepared(), { prepare: paths => writeFile(paths[3], text) });
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each(["symlink", "directory"])("AC2 refuses workspace %s before requests", async kind => {
    const { report, sent } = await exercise(prepared(), { prepare: async paths => {
      await unlink(paths[3]);
      if (kind === "symlink") await symlink(paths[1], paths[3]);
      else await mkdir(paths[3]);
    } });
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  const mismatches = [
    ["org", e => { e.bindings.ims_org_id = "OTHER@AdobeOrg"; }],
    ["company", e => { e.bindings.global_company_id = "other"; }],
    ["suite", e => { e.bindings.report_suite_id = "other"; }],
    ...["tenant", "workspace_id", "property_id", "environment_id", "activity_id", "decision_scope"].map(key =>
      [key, e => { e.bindings.target[key] = key.endsWith("_id") && key !== "workspace_id" ? "999" : "other"; }]),
    ["offer ID", e => { e.bindings.target.offers[0].id = "999"; }],
    ["offer content", e => { e.bindings.target.offers[0].content_sha256 = "f".repeat(64); }],
    ["offer order", e => { e.bindings.target.offers.reverse(); }],
    ...["id", "configuration_context"].map(key => [key, e => { e.bindings.datastream[key] = "other"; }]),
    ...["github_owner", "github_repo", "ref"].map(key => [key, e => {
      const site = e.bindings.site; site[key] = "other";
      site.preview_origin = `https://${site.ref}--${site.github_repo}--${site.github_owner}.aem.page`;
    }]),
    ["identity", e => { e.credential_identity_sha256 = "f".repeat(64); }],
    ["authority", e => { e.provenance.authority_ref = "other"; }],
    ["included property", e => { e.included_property_ids = ["999"]; }],
  ];
  it.each(mismatches)("AC2 exact %s mismatch blocks even a fully known API list", async (_name, change) => {
    const bundle = prepared(); change(bundle.workspace_evidence);
    const { report, sent } = await exercise(bundle);
    expect(row(report, CHECK)).toMatchObject({
      state: "blocked", reason: "scope_mismatch", evidence_basis: "owner_ui_confirmation", http_status: null,
    });
    expect(report.exit_code).toBe(1);
    expect(sent).toHaveLength(12);
  });
  const unknowns = [
    ["old observation", e => { e.observed_at = "2026-10-08T00:59:59.999999999Z"; }, "stale_evidence"],
    ["fresh confirmation cannot renew observation", e => { e.observed_at = "2026-10-07T00:00:00Z"; e.confirmed_at = "2026-10-09T01:00:00Z"; }, "stale_evidence"],
    ["future observation", e => { e.observed_at = "2026-10-09T01:00:00.000000001Z"; }, "stale_evidence"],
    ["future confirmation", e => { e.confirmed_at = "2026-10-09T01:00:00.000000001Z"; }, "stale_evidence"],
    ["confirmation before observation", e => { e.observed_at = "2026-10-09T00:40:00.123456001Z"; e.confirmed_at = "2026-10-09T00:40:00.123456000Z"; }, "stale_evidence"],
    ["expired", e => { e.expires_at = "2026-10-09T00:50:00Z"; }, "stale_evidence"],
    ["expiry short of deadline", e => { e.expires_at = "2026-10-09T01:01:59.999999999Z"; }, "stale_evidence"],
    ["expiry at deadline", e => { e.expires_at = "2026-10-09T01:02:00.000000000Z"; }, "stale_evidence"],
    ...["permission_inventory_complete", "automatic_assignment_disabled", "owner_confirmed_saved_configuration"].map(key =>
      [key + " false", e => { e[key] = false; }, "missing_evidence"]),
  ];
  it.each(unknowns)("AC3/5 %s stays unknown for both omitted and fully known API data", async (_name, change, reason) => {
    for (const bundle of [prepared(), omission()]) {
      change(bundle.workspace_evidence);
      const { report, sent } = await exercise(bundle);
      expect(row(report, CHECK)).toMatchObject({ state: "unverified", reason, evidence_basis: "owner_ui_confirmation", http_status: null });
      expect(report.exit_code).toBe(1);
      expect(sent).toHaveLength(12);
    }
  });
  it.each([1, 3, 6, 9, 64, 512])("AC2 accepts original %i-digit source precision without mutation", async precision => {
    const bundle = omission();
    for (const key of ["observed_at", "confirmed_at", "expires_at"]) {
      bundle.workspace_evidence[key] = bundle.workspace_evidence[key].replace(".000Z", "." + "1".repeat(precision) + "Z");
    }
    const original = structuredClone(bundle.workspace_evidence);
    expect(row((await exercise(bundle)).report, CHECK)).toEqual(manualReady);
    expect(bundle.workspace_evidence).toEqual(original);
  });
  it("AC2 exact observation-age and submillisecond deadline boundaries remain meaningful", async () => {
    const bundle = omission();
    bundle.workspace_evidence.observed_at = "2026-10-08T01:00:00.000000000Z";
    bundle.workspace_evidence.expires_at = "2026-10-09T01:02:00.000000001Z";
    expect(row((await exercise(bundle)).report, CHECK)).toEqual(manualReady);
    bundle.workspace_evidence.observed_at = "2026-10-08T00:59:59.999999999Z";
    expect(row((await exercise(bundle)).report, CHECK).reason).toBe("stale_evidence");
  });
  it.each(["absent", "valid", "stale", "mismatched"])("AC4 known API conflicts win in every row order with %s manual evidence", async kind => {
    for (const order of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) {
      const bundle = omission();
      body(bundle).properties.push({ id: 987654322, workspaces: [bundle.private_input.selectors.target.workspace_id] });
      body(bundle).total = 3;
      body(bundle).properties = order.map(index => body(bundle).properties[index]);
      if (kind === "absent") delete bundle.workspace_evidence;
      if (kind === "stale") bundle.workspace_evidence.observed_at = "2026-10-07T00:00:00Z";
      if (kind === "mismatched") bundle.workspace_evidence.included_property_ids = ["999"];
      const { report, sent } = await exercise(bundle);
      expect(row(report, CHECK)).toMatchObject({ state: "blocked", reason: "scope_mismatch", evidence_basis: "api_read", http_status: 200 });
      expect(report.exit_code).toBe(1);
      expect(sent).toHaveLength(12);
    }
  });
  it.each([true, false])("AC4 selected scope contradiction is not concealed by omission-first=%s", async omissionFirst => {
    const bundle = omission();
    body(bundle).properties[0].workspaces = ["other"];
    if (omissionFirst) body(bundle).properties.reverse();
    expect(row((await exercise(bundle)).report, CHECK)).toMatchObject({ state: "blocked", reason: "scope_mismatch", evidence_basis: "api_read" });
  });
  it.each([null, {}, "other", ["other", "other"], [1]])("AC4 malformed present workspace %j cannot be repaired", async value => {
    const bundle = omission(); body(bundle).properties[1].workspaces = value;
    expect(row((await exercise(bundle)).report, CHECK)).toMatchObject({ state: "unverified", reason: "schema_error", evidence_basis: "api_read" });
  });
  it.each(["selected omitted", "selected absent", "duplicate", "count", "next", "nextPage", "nextPageToken", "hasMore", "truncated", "link", "invalid id", "item ceiling"])("AC4 strict %s collection failure cannot be repaired", async kind => {
    const bundle = omission(), list = body(bundle);
    if (kind === "selected omitted") delete list.properties[0].workspaces;
    if (kind === "selected absent") { list.properties.shift(); list.total--; }
    if (kind === "duplicate") { list.properties.push(structuredClone(list.properties[0])); list.total++; }
    if (kind === "count") list.total++;
    if (["next", "nextPage", "nextPageToken"].includes(kind)) list[kind] = "private-next";
    if (["hasMore", "truncated"].includes(kind)) list[kind] = true;
    if (kind === "link") bundle.transport_replies[6].response.headers.Link = "<https://evil.invalid>; rel=next";
    if (kind === "invalid id") list.properties[1].id = "987654321";
    if (kind === "item ceiling") { bundle.private_input.limits = { max_items: 2 }; list.properties.push({ id: 999 }); list.total++; }
    const { report, sent } = await exercise(bundle);
    expect(row(report, CHECK).state).toBe("unverified");
    expect(row(report, CHECK).evidence_basis).toBe("api_read");
    expect(report.exit_code).toBe(1);
    expect(sent.filter(id => id === "target-properties")).toHaveLength(1);
  });
  it.each([[403, "blocked", "access_denied"], [503, "unverified", "transport_failure"], [206, "unverified", "partial_response"], [429, "unverified", "rate_limited"]])("AC4 HTTP %i cannot be repaired", async (status, state, reason) => {
    const bundle = omission(); bundle.transport_replies[6].response.status = status;
    expect(row((await exercise(bundle)).report, CHECK)).toMatchObject({ state, reason, evidence_basis: "api_read", http_status: status });
  });
  it.each(["request", "bytes", "total bytes", "timeout"])("AC4 %s transport bound cannot be repaired", async kind => {
    const bundle = omission();
    if (kind === "request") bundle.private_input.limits = { max_requests: 6 };
    if (kind === "bytes") {
      bundle.private_input.limits = { max_response_bytes: 2000 };
      body(bundle).padding = "x".repeat(2001);
    }
    if (kind === "total bytes") {
      const before = bundle.transport_replies.slice(0, 6).reduce((sum, reply) => sum + Buffer.byteLength(JSON.stringify(reply.response.body)), 0);
      bundle.private_input.limits = { max_total_response_bytes: before + 1 };
    }
    if (kind === "timeout") bundle.private_input.limits = { request_timeout_ms: 15 };
    const options = kind !== "timeout" ? {} : { transport: reply => reply.id === "target-properties" ? new Promise(() => {}) :
      new Response(reply.response.body_text ?? JSON.stringify(reply.response.body), { status: reply.response.status, headers: reply.response.headers }) };
    expect(row((await exercise(bundle, options)).report, CHECK)).toMatchObject({ state: "unverified", reason: kind === "timeout" ? "timeout" : "limit_exceeded", evidence_basis: "api_read" });
  });
  it.each(["property denied", "property unknown", "property malformed", "property wrong scope", "scope stale", "scope missing", "auth unknown"])("AC4 missing fresh %s prerequisite never permits manual readiness", async kind => {
    const bundle = omission();
    if (kind === "property denied") bundle.transport_replies[5].response.status = 403;
    if (kind === "property unknown") bundle.transport_replies[5].response.status = 503;
    if (kind === "property malformed") delete bundle.transport_replies[5].response.body.workspaces;
    if (kind === "property wrong scope") bundle.transport_replies[5].response.body.workspaces = ["other"];
    if (kind === "scope stale") bundle.private_input.scope_evidence.observed_at = "2026-10-07T00:00:00Z";
    if (kind === "scope missing") delete bundle.private_input.scope_evidence;
    if (kind === "auth unknown") bundle.transport_replies[0].response.status = 503;
    const { report, sent } = await exercise(bundle);
    expect(row(report, CHECK).state).toBe("unverified");
    expect(report.exit_code).toBe(1);
    expect(sent).not.toContain("target-properties");
  });
  it("AC2 evaluates supplied mismatched evidence even if current property read fails", async () => {
    const bundle = prepared();
    bundle.workspace_evidence.credential_identity_sha256 = "f".repeat(64);
    bundle.transport_replies[5].response.status = 503;
    expect(row((await exercise(bundle)).report, CHECK)).toMatchObject({ state: "blocked", reason: "scope_mismatch", evidence_basis: "owner_ui_confirmation" });
  });
  it("AC5 workspace confirmation never renews routing evidence or clears another required unknown", async () => {
    const bundle = omission();
    bundle.routing_evidence.observed_at = "2026-10-07T00:00:00Z";
    const { report } = await exercise(bundle);
    expect(row(report, CHECK)).toEqual(manualReady);
    expect(row(report, "datastream.routing").reason).toBe("stale_evidence");
    expect(report.exit_code).toBe(1);
  });
  it("AC6 leaves the historical real unknown result intact; no fixture can establish live readiness", async () => {
    const note = await readFile(new URL("../docs/research/R-012-adobe-first-compatibility.md", import.meta.url), "utf8");
    expect(note).toContain("exit 1 after 12 bounded requests");
    expect(note).toMatch(/11 required checks ready and `target\.workspace_snapshot` unverified/);
    expect(note).toContain("No SDK traffic, deployment or provisioning ran.");
  });
});
