import { describe, it, expect } from "vitest";
import { copy, exercise, row } from "./adobe-preflight-harness.js";

describe("051-01 fixed transport and bounds", () => {
  it("AC3 sends only all 12 inventoried read-only operations, exact headers and POST templates", async () => {
    expect((await exercise()).sent).toHaveLength(12);
  });
  it.each([
    ["method", "DELETE"], ["method", "PUT"], ["method", "PATCH"],
    ["url", "http://ims-na1.adobelogin.com/ims/token/v3"],
    ["url", "https://ims-na1.adobelogin.com:444/ims/token/v3"],
    ["url", "https://user:pass@ims-na1.adobelogin.com/ims/token/v3"],
    ["url", "https://ims-na1.adobelogin.com/ims/token/v3?debug=1"],
    ["url", "https://evil.invalid/ims/token/v3"], ["body", "mutating-body"],
    ["headers", { Authorization: "Bearer secret" }], ["redirect", "follow"],
  ])("request gate refuses %s mutation before transport", async (key, value) => {
    const { assertRequest } = await import("../probes/adobe-compatibility/preflight.mjs");
    const approved = { url: "https://ims-na1.adobelogin.com/ims/token/v3", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "client_id=x", redirect: "manual" };
    expect(() => assertRequest({ ...approved, [key]: value }, approved)).toThrow();
  });
  it.each([
    { method: "POST", url: "https://mc.adobe.io/tenant/target/activities/ab/103" },
    { method: "GET", url: "https://mc.adobe.io/tenant/target/debug/token" },
    { method: "POST", url: "https://analytics.adobe.io/api/company/reportsuites" },
    { method: "GET", url: "https://admin.hlx.page/publish/owner/repo/main/" },
    { method: "GET", url: "https://evil.invalid/" },
    { method: "GET", url: "https://mc.adobe.io/tenant/target/properties?page=2" },
  ])("inventory gate refuses even an accidentally broadened template $url", async descriptor => {
    const { assertRequest } = await import("../probes/adobe-compatibility/preflight.mjs");
    const request = { ...descriptor, headers: {}, redirect: "manual" };
    expect(() => assertRequest(request, request)).toThrow();
  });
  it.each([
    [400, "unverified", "request_contract_error"], [401, "blocked", "authentication_rejected"],
    [403, "blocked", "access_denied"], [404, "blocked", "resource_not_found"],
    [406, "unverified", "request_contract_error"], [407, "unverified", "request_contract_error"],
    [429, "unverified", "rate_limited"], [500, "unverified", "transport_failure"],
    [503, "unverified", "transport_failure"], [206, "unverified", "partial_response"],
    [301, "unverified", "endpoint_refused"], [307, "unverified", "endpoint_refused"],
  ])("AC2 distinguishes HTTP %i without echo/fallback", async (status, state, reason) => {
    const bundle = copy();
    bundle.transport_replies[2].response = { status, headers: { Location: "https://evil.invalid/SENTINEL-THROWN-OBJECT" }, body: { errorCode: "SENTINEL-THROWN-OBJECT" } };
    const { report, sent } = await exercise(bundle);
    expect(row(report, "analytics.suite")).toMatchObject({ state, reason, http_status: status });
    expect(sent).not.toContain("analytics-reporting");
    expect(sent).toContain("target-property");
  });
  it("404 before exact parent scope is unverified, not absent resource", async () => {
    const bundle = copy(); bundle.transport_replies[1].response.status = 404;
    expect(row((await exercise(bundle)).report, "analytics.org_company")).toMatchObject({ state: "unverified", reason: "dependency_unverified" });
  });
  it("ignores additive response fields and never emits report totals/IDs", async () => {
    const bundle = copy();
    for (const reply of bundle.transport_replies) if (reply.response.body) reply.response.body["SENTINEL-THROWN-OBJECT"] = { secret: bundle.credential_export.CLIENT_SECRETS[0] };
    bundle.transport_replies[3].response.body.summaryData.totals = [123456789];
    const { report, stdout } = await exercise(bundle);
    expect(report.exit_code).toBe(0);
    expect(stdout).not.toContain("123456789");
  });
  it.each(copy().transport_replies.filter(reply => reply.operation !== "site.preview").map(reply => [reply.id, reply.request.url]))("malformed 200 for %s is never ready", async (_id, url) => {
    const bundle = copy();
    bundle.transport_replies.find(reply => reply.request.url === url).response.body = {};
    const { report } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(report.summary.required_unverified).toBeGreaterThan(0);
  });
  it.each(["columnErrors", "rows", "totals"])("refuses non-total or partial reporting %s", async field => {
    const bundle = copy(), body = bundle.transport_replies[3].response.body;
    if (field === "columnErrors") body.columns.columnErrors = [{ errorCode: "metric_not_available" }];
    if (field === "rows") body.rows = [{ data: [1] }];
    if (field === "totals") body.summaryData.totals = [-1];
    expect(row((await exercise(bundle)).report, "analytics.reporting").state).toBe("unverified");
  });
  it.each(["total", "duplicate", "next", "link", "items"])("partial %s property enumeration never guesses another page", async variant => {
    const bundle = copy(), reply = bundle.transport_replies[6], body = reply.response.body;
    if (variant === "total") body.total = 2;
    if (variant === "duplicate") { body.properties.push(body.properties[0]); body.total = 2; }
    if (variant === "next") body.next = "https://evil.invalid/SENTINEL-THROWN-OBJECT";
    if (variant === "link") reply.response.headers.Link = "<https://evil.invalid>; rel=next";
    if (variant === "items") bundle.private_input.limits = { max_items: 1 }; // discovery has org + company
    const { report, sent } = await exercise(bundle);
    const check = variant === "items" ? "analytics.org_company" : "target.workspace_snapshot";
    expect(row(report, check).state).toBe("unverified");
    expect(sent.filter(id => id === "target-properties").length).toBeLessThanOrEqual(1);
  });
  it.each(["headers", "body"])("enforces deadline on hanging %s and aborts/cancels", async phase => {
    const bundle = copy(); bundle.private_input.limits = { request_timeout_ms: 15 };
    let signal, cancelled = false;
    const { report } = await exercise(bundle, { transport: (reply, init) => {
      if (reply.id !== "ims-token") return new Response(reply.response.body_text ?? JSON.stringify(reply.response.body), { headers: reply.response.headers });
      signal = init.signal;
      if (phase === "headers") return new Promise(() => {});
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"access_token":')); }, cancel() { cancelled = true; } }), { headers: { "Content-Type": "application/json" } });
    } });
    expect(row(report, "auth.oauth").reason).toBe("timeout");
    expect(signal.aborted).toBe(true);
    if (phase === "body") expect(cancelled).toBe(true);
  });
  it.each(["single", "total", "request", "run", "deep", "lying", "chunked"])("bounds %s limits without success fallback", async kind => {
    const bundle = copy();
    if (kind === "single") bundle.private_input.limits = { max_response_bytes: 10 };
    if (kind === "total") bundle.private_input.limits = { max_total_response_bytes: 150 };
    if (kind === "request") bundle.private_input.limits = { max_requests: 1 };
    if (kind === "run") bundle.private_input.limits = { run_timeout_ms: 1 };
    if (kind === "deep") bundle.transport_replies[0].response.body_text = "[".repeat(33) + "0" + "]".repeat(33);
    if (kind === "lying" || kind === "chunked") bundle.private_input.limits = { max_response_bytes: 32 };
    const options = kind === "run" ? { transport: () => new Promise(() => {}) } :
      ["lying", "chunked"].includes(kind) ? { transport: () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(20)); controller.enqueue(new Uint8Array(20)); controller.close(); },
      }), { headers: { "Content-Type": "application/json", "Content-Length": "1" } }) } : {};
    const { report } = await exercise(bundle, options);
    expect(report.exit_code).toBe(1);
    expect(report.checks.some(check => ["timeout", "limit_exceeded", "schema_error"].includes(check.reason))).toBe(true);
  });
  it.each(["AbortError", "Error", "SENTINEL-THROWN-OBJECT"])("safe thrown object %s", async name => {
    const bundle = copy(); bundle.transport_replies[0].response = { transport_error: { name, message: "SENTINEL-THROWN-OBJECT", cause: bundle.credential_export } };
    expect(row((await exercise(bundle)).report, "auth.oauth").reason).toBe(name === "AbortError" ? "timeout" : "transport_failure");
  });
  it.each(["SENTINEL-THROWN-OBJECT", 200.5, null, 900, 200n])("rejects malformed status %s without emitting it", async status => {
    const { report } = await exercise(copy(), { transport: () => ({ status }) });
    expect(row(report, "auth.oauth")).toMatchObject({ reason: "schema_error", http_status: null });
  });
  it("cancels rejected-status streams as well as successful-body streams", async () => {
    let cancelled = 0;
    const bundle = copy();
    const { report } = await exercise(bundle, { transport: () => new Response(new ReadableStream({
      cancel() { cancelled++; },
    }), { status: 403, headers: { "Content-Type": "application/json" } }) });
    expect(report.exit_code).toBe(1);
    expect(cancelled).toBe(2); // token and independent public status
  });
  it("late headers arriving after abort have their unused stream cancelled", async () => {
    const bundle = copy(); bundle.private_input.limits = { request_timeout_ms: 5 };
    let cancelled = 0;
    await exercise(bundle, { transport: async reply => {
      if (reply.id !== "ims-token") return new Response(reply.response.body_text ?? JSON.stringify(reply.response.body), { headers: reply.response.headers });
      await new Promise(resolve => setTimeout(resolve, 20));
      return new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { "Content-Type": "application/json" } });
    } });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(cancelled).toBe(1);
  });
  it.each(["json", "html", "vendor"])("wrong %s content type/version is unverified", async kind => {
    const bundle = copy();
    const index = kind === "json" ? 0 : kind === "html" ? 11 : 7;
    bundle.transport_replies[index].response.headers["Content-Type"] = kind === "vendor" ? "application/vnd.adobe.target.v1+json" : "text/plain";
    const { report } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(report.checks.some(check => check.reason === "schema_error")).toBe(true);
  });
  it.each([
    b => { b.transport_replies[0].response.body.expires_in = 1; },
    b => { b.transport_replies[0].response.body.token_type = "JWT"; },
    b => { b.transport_replies[1].response.body.imsOrgs.push(b.transport_replies[1].response.body.imsOrgs[0]); },
    b => { b.transport_replies[2].response.body.timezoneZoneinfo = "invalid-zone"; },
    b => { delete b.transport_replies[4].response.body.default; },
    b => { b.transport_replies[4].response.body.id = 9007199254740992; },
  ])("typed consumed fields never default to success", async change => {
    const bundle = copy(); change(bundle);
    expect((await exercise(bundle)).report.exit_code).toBe(1);
  });
  it("checks report windows in returned suite timezone before sending report POST", async () => {
    const bundle = copy();
    bundle.transport_replies[2].response.body.timezoneZoneinfo = "America/Los_Angeles";
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(2);
    expect(report.overall).toBe("unverified");
    expect(row(report, "analytics.suite")).toMatchObject({ state: "unverified", reason: "invalid_configuration" });
    expect(sent).toEqual(["ims-token", "analytics-discovery", "analytics-suite"]);
  });
  it("streaming counts are decoded bytes, not UTF-16 string length", async () => {
    const bundle = copy(); bundle.private_input.limits = { max_response_bytes: 32 };
    const { report } = await exercise(bundle, { transport: () => new Response("é".repeat(17), { headers: { "Content-Type": "application/json" } }) });
    expect(row(report, "auth.oauth").reason).toBe("limit_exceeded");
  });
  it("enforces max_items on property listing, not just discovery", async () => {
    const bundle = copy(); bundle.private_input.limits = { max_items: 2 };
    const body = bundle.transport_replies[6].response.body;
    body.properties.push({ id: 300, workspaces: ["other"] }, { id: 301, workspaces: ["other"] });
    body.total = 3;
    expect(row((await exercise(bundle)).report, "target.workspace_snapshot").reason).toBe("limit_exceeded");
  });
  it("complete listing with a non-selected property's omitted optional workspaces stays unknown, never empty/absent", async () => {
    const bundle = copy();
    const properties = bundle.transport_replies[6].response.body;
    const other = { id: 987654321, channel: "web", name: "SYNTHETIC-NONSELECTED-PROPERTY-NAME-DO-NOT-EMIT" };
    properties.properties.push(other);
    properties.total = 2;
    expect(new Set(properties.properties.map(property => property.id)).size).toBe(properties.total);
    expect(String(other.id)).not.toBe(bundle.private_input.selectors.target.property_id);
    expect(Object.hasOwn(other, "workspaces")).toBe(false);
    bundle.redaction_sentinels.push(String(other.id), other.name);

    // exercise scans captured stdout/stderr/report for these and all credential/selector sentinels.
    const { report, sent } = await exercise(bundle);
    expect(report.exit_code).toBe(1);
    expect(report.overall).toBe("unverified");
    expect(row(report, "target.workspace_snapshot")).toEqual({
      id: "target.workspace_snapshot", required: true, state: "unverified",
      evidence_basis: "api_read", reason: "schema_error", next_action: "review_api_contract",
      http_status: 200, freshness: "current_run",
    });
    for (const check of report.checks.filter(check => check.required && check.id !== "target.workspace_snapshot")) {
      expect(check.state).toBe("ready");
    }
    expect(report.summary).toEqual({
      required_ready: 11, required_blocked: 0, required_unverified: 1,
      optional_unverified: 4, api_requests: 12,
    });
    expect(sent).toEqual(bundle.transport_replies.map(reply => reply.id));
    expect(report.checks.some(check => check.reason === "resource_not_found")).toBe(false);
  });
  it("explicit unsafe offer outranks unknown activity in composite row", async () => {
    const bundle = copy();
    bundle.transport_replies[7].response.status = 503;
    bundle.transport_replies[8].response.body.workspace = "other";
    expect(row((await exercise(bundle)).report, "target.activity_offers")).toMatchObject({ state: "blocked", reason: "scope_mismatch" });
  });
  it.each(["exceeded", "exact"])("aggregate byte cap %s stops all later transports and body reads", async boundary => {
    const bundle = copy();
    bundle.private_input.limits = { max_total_response_bytes: 10 };
    let reads = 0, cancels = 0;
    const { report, sent } = await exercise(bundle, { transport: reply => ({
      status: 200, headers: new Headers(reply.response.headers),
      body: { getReader: () => ({
        read: async () => { reads++; return { done: false, value: new Uint8Array(boundary === "exact" ? 10 : 11) }; },
        cancel: async () => { cancels++; },
      }) },
    }) });
    expect(row(report, "auth.oauth").reason).toBe("limit_exceeded");
    expect(report.summary.api_requests).toBe(1);
    expect(sent).toEqual(["ims-token"]);
    expect(reads).toBe(1);
    expect(cancels).toBe(1);
  });
  it("cumulative cap exhausted by discovery prevents independent site transport too", async () => {
    const bundle = copy();
    const size = response => new TextEncoder().encode(JSON.stringify(response.body)).byteLength;
    bundle.private_input.limits = { max_total_response_bytes: size(bundle.transport_replies[0].response) + size(bundle.transport_replies[1].response) - 1 };
    const { report, sent } = await exercise(bundle);
    expect(row(report, "analytics.org_company").reason).toBe("limit_exceeded");
    expect(row(report, "site.scope_readability").reason).toBe("limit_exceeded");
    expect(report.summary.api_requests).toBe(2);
    expect(sent).toEqual(["ims-token", "analytics-discovery"]);
  });
  it.each([403, 503])("environment 404 with property %i is unknown, not confirmed absence", async status => {
    const bundle = copy();
    bundle.transport_replies[4].response.status = 404;
    bundle.transport_replies[5].response.status = status;
    const { report, sent } = await exercise(bundle);
    expect(row(report, "target.environment")).toMatchObject({ state: "unverified", reason: "dependency_unverified", http_status: 404 });
    expect(row(report, "target.tenant_binding").state).toBe("unverified");
    for (const id of ["target-properties", "target-activity", "target-offer-a", "target-offer-b"]) expect(sent).not.toContain(id);
  });
  it("environment 404 becomes confirmed absence only after current property/tenant corroboration", async () => {
    const bundle = copy(); bundle.transport_replies[4].response.status = 404;
    const { report } = await exercise(bundle);
    expect(row(report, "target.tenant_binding").state).toBe("ready");
    expect(row(report, "target.environment")).toMatchObject({ state: "blocked", reason: "resource_not_found", http_status: 404 });
  });
  it("property 404 cannot establish its own missing parent tenant binding", async () => {
    const bundle = copy(); bundle.transport_replies[5].response.status = 404;
    const { report, sent } = await exercise(bundle);
    expect(row(report, "target.property_workspace")).toMatchObject({ state: "unverified", reason: "dependency_unverified", http_status: 404 });
    expect(row(report, "target.tenant_binding").state).toBe("unverified");
    expect(sent).not.toContain("target-properties");
  });
  it.each([
    [503, 403, "unverified", "transport_failure"],
    [403, 503, "blocked", "access_denied"],
    [503, 404, "unverified", "transport_failure"],
  ])("composite keeps activity %i ahead of offer %i absent explicit scope/safety mismatch", async (activity, offer, state, reason) => {
    const bundle = copy();
    bundle.transport_replies[7].response.status = activity;
    bundle.transport_replies[8].response.status = offer;
    expect(row((await exercise(bundle)).report, "target.activity_offers")).toMatchObject({ state, reason });
  });
  it("later scope mismatch does not replace the first already-blocked access denial", async () => {
    const bundle = copy();
    bundle.transport_replies[7].response.status = 403;
    bundle.transport_replies[8].response.body.workspace = "other";
    expect(row((await exercise(bundle)).report, "target.activity_offers")).toMatchObject({ state: "blocked", reason: "access_denied" });
  });
});
