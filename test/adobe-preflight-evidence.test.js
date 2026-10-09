import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { copy, exercise, row } from "./adobe-preflight-harness.js";

describe("051-01 required evidence and exact selectors", () => {
  it("AC5 keeps unsupported API/write/deployment/deferred checks explicitly unverified", async () => {
    const { report } = await exercise();
    expect(report.checks.slice(12).map(check => check.reason)).toEqual(["unavailable_automation", "not_exercised", "not_exercised", "deferred_scope"]);
    expect(report.claims.product_outcomes_verified).toBe(false);
  });
  it("AC7 records the real unverified result separately from hermetic and ad-hoc evidence", async () => {
    const note = await readFile(new URL("../docs/research/R-012-adobe-first-compatibility.md", import.meta.url), "utf8");
    expect(note).toContain("051-01 CLI validation: hermetic and real unverified result");
    expect(note).toContain("exit 1 after 12 bounded requests");
    expect(note).toMatch(/11 required checks ready and `target\.workspace_snapshot` unverified/);
    expect(note).toContain("Owner confirmation is unavailable and");
    expect(note).toContain("No SDK traffic, deployment or provisioning ran.");
  });
  it.each(["org", "identity", "binding", "dedicated"])("before-send %s binding blocks all requests", async kind => {
    const bundle = copy();
    if (kind === "org") bundle.credential_export.ORG_ID = "OTHER@AdobeOrg";
    if (kind === "identity") bundle.credential_export.CLIENT_ID = "rotated-client";
    if (kind === "binding") bundle.private_input.scope_evidence.bindings.target.tenant = "other";
    if (kind === "dedicated") bundle.private_input.scope_evidence.dedicated_resources.target_property = false;
    const { report, sent } = await exercise(bundle);
    expect(row(report, "input.scope")).toMatchObject({ state: "blocked", reason: "scope_mismatch" });
    expect(sent).toEqual([]);
  });
  it.each(["scope", "routing"])("missing %s evidence is unverified, not configuration success", async kind => {
    const bundle = copy();
    if (kind === "scope") delete bundle.private_input.scope_evidence;
    const { report } = await exercise(bundle, kind === "routing" ? { prepare: async paths => { const { unlink } = await import("node:fs/promises"); await unlink(paths[1]); } } : {});
    expect(row(report, kind === "scope" ? "input.scope" : "datastream.routing").reason).toBe("missing_evidence");
    expect(report.exit_code).toBe(1);
  });
  it.each(["scope", "approval", "routing", "aggregate", "pin", "expiry"])("honors %s time semantics, never renews source evidence", async kind => {
    const bundle = copy();
    if (kind === "scope") bundle.private_input.scope_evidence.observed_at = "2026-10-07T00:00:00Z";
    if (kind === "approval") bundle.private_input.approval.approved_at = "2026-10-10T00:00:00Z";
    if (kind === "routing") bundle.routing_evidence.observed_at = "2026-10-07T00:00:00Z";
    if (kind === "aggregate") bundle.routing_evidence.assessment_completed_at = "2026-10-10T00:00:00Z";
    if (kind === "pin") bundle.routing_evidence.target_environment_pin_confirmed_at = "2026-10-09T00:50:00Z";
    if (kind === "expiry") bundle.routing_evidence.expires_at = "2026-10-09T01:00:01Z";
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    if (["scope", "approval"].includes(kind)) expect(sent).toEqual([]);
    else expect(row(report, "datastream.routing")).toMatchObject({ state: "unverified", evidence_basis: "owner_ui_confirmation", reason: "stale_evidence", freshness: "stale" });
  });
  it("aggregate completion accepts actual later pin but retains original observation", async () => {
    const bundle = copy();
    bundle.routing_evidence.target_environment_pin_confirmed_at = "2026-10-09T00:55:00Z";
    bundle.routing_evidence.assessment_completed_at = "2026-10-09T00:56:00Z";
    expect((await exercise(bundle)).report.exit_code).toBe(0);
  });
  it.each([1, 2, 3, 6, 9, 18, 64, 512])("accepts %i fractional digits within bounded RFC3339 private files", async precision => {
    const bundle = copy();
    const fraction = "1234567890".repeat(Math.ceil(precision / 10)).slice(0, precision);
    for (const value of [bundle.private_input.approval, bundle.private_input.scope_evidence, bundle.routing_evidence]) {
      for (const key of Object.keys(value)) if (key.endsWith("_at")) value[key] = value[key].replace(".000Z", `.${fraction}Z`);
    }
    const original = structuredClone(bundle);
    expect((await exercise(bundle)).report.exit_code).toBe(0);
    expect(bundle).toEqual(original);
  });
  it.each(["approval", "scope", "routing"])("does not truncate a future %s observation to the run-start millisecond", async kind => {
    const bundle = copy(), future = "2026-10-09T01:00:00.000000001Z";
    if (kind === "approval") bundle.private_input.approval.approved_at = future;
    if (kind === "scope") bundle.private_input.scope_evidence.observed_at = future;
    if (kind === "routing") {
      bundle.routing_evidence.observed_at = future;
      bundle.routing_evidence.target_environment_pin_confirmed_at = future;
      bundle.routing_evidence.assessment_completed_at = future;
    }
    const { report } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(row(report, kind === "routing" ? "datastream.routing" : "input.scope")).toMatchObject({ reason: "stale_evidence", freshness: "stale" });
  });
  it.each(["scope", "routing"])("retains %s expiry just beyond the complete run deadline", async kind => {
    const bundle = copy();
    const evidence = kind === "scope" ? bundle.private_input.scope_evidence : bundle.routing_evidence;
    evidence.expires_at = "2026-10-09T01:02:00.000000001Z";
    expect((await exercise(bundle)).report.exit_code).toBe(0);
    evidence.expires_at = "2026-10-09T01:02:00.000000000Z";
    const { report } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(row(report, kind === "scope" ? "input.scope" : "datastream.routing").reason).toBe("stale_evidence");
  });
  it("fractional aggregate completion cannot conceal an earlier saved-pin ordering mismatch", async () => {
    const bundle = copy();
    bundle.routing_evidence.assessment_completed_at = "2026-10-09T00:45:00.123456000Z";
    bundle.routing_evidence.target_environment_pin_confirmed_at = "2026-10-09T00:45:00.123456001Z";
    expect(row((await exercise(bundle)).report, "datastream.routing").reason).toBe("stale_evidence");
  });
  it.each(["2026-02-30T00:00:00.123456Z", "2026-10-09T24:00:00.123456Z", "2026-10-09T00:30:00.Z", "2026-10-09T00:30:00.123456xZ"])("fraction support retains calendar/syntax refusal for %s", async timestamp => {
    const bundle = copy(); bundle.private_input.scope_evidence.observed_at = timestamp;
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each([
    ["bindings", b => {
      b.routing_evidence.bindings.site.ref = "other";
      b.routing_evidence.bindings.site.preview_origin = "https://other--airlock-preflight-fixture--fixture-owner.aem.page";
    }, "scope_mismatch"],
    ["token", b => { b.transport_replies[5].response.body.token = "ROTATED-TOKEN"; }, "scope_mismatch"],
    ["services", b => { b.routing_evidence.visible_enabled_services.push("aep"); }, "unsafe_configuration"],
    ["suite", b => { b.routing_evidence.analytics_report_suite_ids.push("other"); }, "unsafe_configuration"],
    ["inventory", b => { b.routing_evidence.service_inventory_complete = false; }, "missing_evidence"],
    ["pin", b => { b.routing_evidence.target_environment_pin_saved_owner_confirmed = false; }, "unsafe_configuration"],
  ])("routing %s is never inferred from a digest alone", async (kind, change, reason) => {
    const bundle = copy(); change(bundle);
    const check = row((await exercise(bundle)).report, "datastream.routing");
    expect(check.reason).toBe(reason);
    if (kind === "pin") expect(check.next_action).toBe("save_environment_pin");
  });
  it.each([
    b => { b.routing_evidence.configuration_api_read_verified = true; },
    b => { b.routing_evidence.provenance.screenshot_sha256 = ["0".repeat(64)]; },
    b => { b.routing_evidence.provenance.screenshot_source = "api_read"; },
    b => { b.routing_evidence["SENTINEL-THROWN-OBJECT"] = true; },
    b => { b.private_input.scope_evidence.provenance.extra = "SENTINEL-THROWN-OBJECT"; },
  ])("invalid closed evidence is exit 2 before requests", async change => {
    const bundle = copy(); change(bundle);
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each([
    [1, "analytics.org_company", b => { b.imsOrgs[0].companies[0].globalCompanyId = "other"; }],
    [2, "analytics.suite", b => { b.rsid = "other"; }],
    [4, "target.environment", b => { b.id = 999; }],
    [4, "target.environment", b => { b.default = true; }],
    [4, "target.environment", b => { b.serveInactiveActivities = true; }],
    [5, "target.property_workspace", b => { b.channel = "mobile"; }],
    [5, "target.property_workspace", b => { b.workspaces.push("other"); }],
    [6, "target.workspace_snapshot", b => { b.properties.push({ id: 999, workspaces: ["fixture-workspace-01"] }); b.total = 2; }],
    [7, "target.activity_offers", b => { b.workspace = "other"; }],
    [7, "target.activity_offers", b => { b.propertyIds = [999]; }],
    [7, "target.activity_offers", b => { b.state = "approved"; }],
    [7, "target.activity_offers", b => { b.startsAt = "2020-01-01T00:00:00Z"; }],
    [7, "target.activity_offers", b => { b.locations.mboxes[0].name = "target-global-mbox"; }],
    [7, "target.activity_offers", b => { b.options[0].offerId = 999; }],
    [7, "target.activity_offers", b => { b.experiences[0].optionLocations[0].optionLocalId = 999; }],
    [8, "target.activity_offers", b => { b.content += "changed"; }],
    [9, "target.activity_offers", b => { b.workspace = "other"; }],
    [10, "site.scope_readability", b => { b.preview.url = "https://other.invalid/"; }],
    [10, "site.scope_readability", b => { b.live.url = "https://other.invalid/"; }],
  ])("exact readback mismatch at operation %i blocks %s", async (index, id, change) => {
    const bundle = copy(); change(bundle.transport_replies[index].response.body);
    const { report } = await exercise(bundle);
    expect(row(report, id).state).toBe("blocked");
    expect(report.exit_code).toBe(1);
  });
  it.each(["auth.oauth", "analytics.org_company", "analytics.suite", "analytics.reporting", "target.environment", "target.property_workspace", "target.workspace_snapshot", "target.activity_offers", "site.scope_readability"])("required unknown %s never exits zero", async id => {
    const indices = { "auth.oauth": 0, "analytics.org_company": 1, "analytics.suite": 2, "analytics.reporting": 3, "target.environment": 4, "target.property_workspace": 5, "target.workspace_snapshot": 6, "target.activity_offers": 7, "site.scope_readability": 10 };
    const bundle = copy(); bundle.transport_replies[indices[id]].response.status = 503;
    const { report } = await exercise(bundle);
    expect(row(report, id).state).toBe("unverified");
    expect(report.exit_code).toBe(1);
    if (id === "target.property_workspace") expect(row(report, "target.tenant_binding").state).toBe("unverified");
  });
  it("explicit unsafe routing outranks stale/unknown evidence", async () => {
    const bundle = copy();
    bundle.routing_evidence.observed_at = "2026-10-07T00:00:00Z";
    bundle.routing_evidence.target_environment_pin_saved_owner_confirmed = false;
    expect(row((await exercise(bundle)).report, "datastream.routing")).toMatchObject({ state: "blocked", reason: "unsafe_configuration", next_action: "save_environment_pin" });
  });
  it("explicit owner scope mismatch outranks stale evidence before send", async () => {
    const bundle = copy();
    bundle.private_input.scope_evidence.observed_at = "2026-10-07T00:00:00Z";
    bundle.private_input.scope_evidence.bindings.target.tenant = "other";
    const { report, sent } = await exercise(bundle);
    expect(row(report, "input.scope")).toMatchObject({ state: "blocked", reason: "scope_mismatch" });
    expect(sent).toEqual([]);
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7, 10, 11])("denial at operation %i always blocks a required check", async index => {
    const bundle = copy(); bundle.transport_replies[index].response.status = 403;
    const { report } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(report.overall).toBe("blocked");
    expect(report.summary.required_blocked).toBeGreaterThan(0);
  });
  it.each(["owned.test-scope_1", ".owned", "owned.", "owned..one", "a".repeat(98) + ".z"])("accepts approved bounded dotted decision scope %s with literal fresh activity match", async scope => {
    const bundle = copy();
    bundle.private_input.selectors.target.decision_scope = scope;
    bundle.private_input.scope_evidence.bindings.target.decision_scope = scope;
    bundle.transport_replies[7].response.body.locations.mboxes[0].name = scope;
    bundle.redaction_sentinels.push(scope);
    const { report } = await exercise(bundle);
    expect(report.exit_code).toBe(0);
    expect(row(report, "target.activity_offers").state).toBe("ready");
  });
  it("dotted owner scope must still match its complete approved evidence binding before send", async () => {
    const bundle = copy();
    bundle.private_input.selectors.target.decision_scope = "owned.test-scope";
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(row(report, "input.scope")).toMatchObject({ state: "blocked", reason: "scope_mismatch" });
    expect(sent).toEqual([]);
  });
  it("fresh activity custom scope match stays case-sensitive and literal, never a dotted-name pattern", async () => {
    const bundle = copy();
    bundle.private_input.selectors.target.decision_scope = "owned.test-scope";
    bundle.private_input.scope_evidence.bindings.target.decision_scope = "owned.test-scope";
    bundle.transport_replies[7].response.body.locations.mboxes[0].name = "ownedXtest-scope";
    expect(row((await exercise(bundle)).report, "target.activity_offers")).toMatchObject({ state: "blocked", reason: "scope_mismatch" });
  });
  it.each([
    ".", "..", "target-global-mbox", "__proto__", "constructor", "prototype",
    "owned@scope", "owned scope", " owned.scope", "owned.scope ", "owned\nscope",
    "https://owned.scope", "owned/scope", "owned\\scope", "owned?scope", "owned#scope",
    "owned%2escope", "é.scope", "a".repeat(100) + ".",
  ])("retains prohibited decision scope refusal %j", async scope => {
    const bundle = copy();
    bundle.private_input.selectors.target.decision_scope = scope;
    bundle.private_input.scope_evidence.bindings.target.decision_scope = scope;
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(2);
    expect(sent).toEqual([]);
  });
  it.each(["tenant", "github_owner", "github_repo", "ref"])("scope alphabet correction does not loosen %s", async key => {
    const bundle = copy();
    if (key === "tenant") bundle.private_input.selectors.target.tenant = "owned.tenant";
    else bundle.private_input.selectors.site[key] = "owned.component";
    expect((await exercise(bundle)).report.exit_code).toBe(2);
  });
});
