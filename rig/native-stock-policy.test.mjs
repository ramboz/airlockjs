import { describe, expect, it, vi } from "vitest";

const load = () => import("./native-stock-policy.mjs");

describe("059-15 pre-admission blocker (not native policy qualification)", () => {
  it("AC1: exposes no permissive native profile while its byte prerequisites are unqualified", async () => {
    const policy = await load();
    expect(Object.keys(policy).sort()).toEqual([
      "LIMITS", "META_REFERENCE_COHORTS", "createNativeStockPolicy", "denyStockExecution",
    ]);
    expect(Object.isFrozen(policy.META_REFERENCE_COHORTS)).toBe(true);
    expect(Object.values(policy.META_REFERENCE_COHORTS).every(Object.isFrozen)).toBe(true);
    expect(() => policy.denyStockExecution("meta-stock")).toThrow("pre_admission_blocked");
    expect(() => policy.denyStockExecution("google-stock")).toThrow("pre_admission_blocked");
  });

  const runtimePins = {
    meta: "9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b",
    configuration: "807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921",
    google: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50",
  };
  function config(profile = "meta-pageview") {
    const meta = profile === "meta-pageview";
    return {
      schema_version: 1, profile, case_name: meta ? "meta-stock" : "google-stock",
      document_url: "https://owned.example.test/native-case",
      owned: meta ? { pixel_id: "123456789012345" } : {
        conversion_id: "AW-1234567890", conversion_label: "synthetic-label",
        value: 1, currency: "USD", transaction_id: "synthetic-transaction-unique",
      },
      resources: meta ? [
        { role: "runtime", url: "https://connect.facebook.net/en_US/fbevents.js", sha256: runtimePins.meta },
        { role: "configuration", url: "https://connect.facebook.net/signals/config/123456789012345?v=2.9.0&r=stable&domain=owned.example.test&hme=synthetic&ex_m=one",
          sha256: runtimePins.configuration },
      ] : [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-1234567890",
        sha256: runtimePins.google }],
      companion_authorized: !meta,
    };
  }
  const request = (url, method = "GET", resource_type = "Image", extra = {}) => ({
    url, method, resource_type, headers: { Accept: "*/*" }, body: Buffer.alloc(0), ...extra,
  });
  const metaUrl = "https://www.facebook.com/tr/?id=123456789012345&ev=PageView&dl=https%3A%2F%2Fowned.example.test%2Fnative-case";
  const primaryUrl = "https://www.googleadservices.com/pagead/conversion/1234567890/?label=synthetic-label&value=1&currency_code=USD&oid=synthetic-transaction-unique&url=https%3A%2F%2Fowned.example.test%2Fnative-case&auid=123.456";
  const cfgQuery = "url=https%3A%2F%2Fowned.example.test%2Fnative-case&en=gtag.config&auid=123.456";
  const ccmQuery = "dl=https%3A%2F%2Fowned.example.test%2Fnative-case&en=page_view&tid=AW-1234567890&tids=AW-1234567890&auid=123.456";

  describe("exact native route eligibility, not network authorization", () => {
    const authenticatedPins = {
      runtime: "d4487bcc9db399030b7089a15e37a6e755bed441992ced0716fb7f9a874e20d1",
      configuration: "b1720ebb329e506fd223f066353d977281280866d85e908dc2561a6c1161c46d",
    };

    it("accepts the separately approved authenticated source pair without granting execution", async () => {
      const { createNativeStockPolicy } = await load(), c = config();
      for (const resource of c.resources) resource.sha256 = authenticatedPins[resource.role];
      const policy = createNativeStockPolicy(c);
      expect(policy.inspect(request(c.resources[0].url, "GET", "Script"))).toMatchObject({
        disposition: "eligible", source_bytes_verified: false, dispatch_authorized: false,
      });
      expect(policy.inspect(request(metaUrl))).toMatchObject({
        disposition: "eligible", independent_ownership_authentication: false, dispatch_authorized: false,
      });
    });

    it.each(["runtime", "configuration"])("rejects mixed historical/authenticated %s source pairs", async role => {
      const { createNativeStockPolicy } = await load(), c = config();
      c.resources.find(resource => resource.role === role).sha256 = authenticatedPins[role];
      expect(() => createNativeStockPolicy(c)).toThrow("invalid_native_policy");
    });

    it("binds pinned declared sources without claiming actual source consumption", async () => {
      const { createNativeStockPolicy } = await load();
      const c = config(), policy = createNativeStockPolicy(c);
      const decision = policy.inspect(request(c.resources[0].url, "GET", "Script"));
      expect(decision).toMatchObject({ disposition: "eligible", kind: "local_source",
        dispatch_authorized: false, source_bytes_verified: false });
      expect(policy.inspect(request(metaUrl))).toMatchObject({
        disposition: "eligible", route: "meta_pageview", dispatch_authorized: false,
        requires_final_header_gate: true, independent_ownership_authentication: false,
      });
    });

    it.each([
      ["unknown key", c => { c.ready = true; }],
      ["candidate", c => { c.case_name = "meta-chamber"; }],
      ["wrong runtime pin", c => { c.resources[0].sha256 = "a".repeat(64); }],
      ["wrong configuration pin", c => { c.resources[1].sha256 = "a".repeat(64); }],
      ["foreign config path", c => { c.resources[1].url = c.resources[1].url.replace("123456789012345?", "999?"); }],
      ["foreign domain binding", c => { c.resources[1].url = c.resources[1].url.replace("domain=owned.example.test", "domain=foreign.example.test"); }],
      ["extra source", c => { c.resources.push({ ...c.resources[0], role: "other" }); }],
      ["bad selector", c => { c.owned.pixel_id = 123; }],
      ["HTTP document", c => { c.document_url = "http://owned.example.test/native-case"; }],
      ["fragment", c => { c.document_url += "#fragment"; }],
      ["coerced grant", c => { c.companion_authorized = "true"; }],
    ])("rejects malformed policy input: %s", async (_name, change) => {
      const { createNativeStockPolicy } = await load();
      const c = config(); change(c);
      expect(() => createNativeStockPolicy(c)).toThrow("invalid_native_policy");
    });

    it("snapshots policy primitives and does not change original query encoding", async () => {
      const { createNativeStockPolicy } = await load();
      const c = config(), policy = createNativeStockPolicy(c);
      c.owned.pixel_id = "999"; c.document_url = "https://foreign.example.test/";
      c.resources[0].url = "https://foreign.example.test/script.js";
      const r = request(metaUrl + "&pmd%5Btitle%5D=one%20two&fbp=fb.1.123.456");
      const original = r.url;
      expect(policy.inspect(r).disposition).toBe("eligible");
      expect(r.url).toBe(original);
      expect(Object.isFrozen(policy.inspect(r))).toBe(true);
    });

    it.each([
      ["foreign ID", metaUrl.replace("id=123456789012345", "id=999")],
      ["wrong event", metaUrl.replace("ev=PageView", "ev=Purchase")],
      ["foreign document", metaUrl.replace("owned.example.test", "foreign.example.test")],
      ["duplicate ID", metaUrl + "&id=123456789012345"],
      ["duplicate environment field", metaUrl + "&sw=100&sw=100"],
      ["unknown PII field", metaUrl + "&ud%5Bem%5D=synthetic"],
      ["unapproved custom value", metaUrl + "&cd%5Bvalue%5D=1"],
      ["malformed percent", metaUrl + "&r=%ZZ"],
      ["invalid encoded UTF8", metaUrl + "&r=%FF"],
      ["user info", metaUrl.replace("https://", "https://name@")],
      ["extra port", metaUrl.replace("facebook.com", "facebook.com:444")],
      ["alternate path", metaUrl.replace("/tr/", "/tr")],
      ["host suffix", metaUrl.replace("facebook.com", "facebook.com.evil.invalid")],
    ])("denies exact Meta scope violation: %s", async (_name, url) => {
      const { createNativeStockPolicy } = await load();
      expect(createNativeStockPolicy(config()).inspect(request(url)).disposition).toBe("blocked");
    });

    it.each([["POST", "Image"], ["GET", "Script"], ["GET", "Fetch"]])(
      "denies unobserved Meta method/resource %s/%s", async (method, resource) => {
        const { createNativeStockPolicy } = await load();
        expect(createNativeStockPolicy(config()).inspect(request(metaUrl, method, resource)).disposition)
          .toBe("blocked");
      });

    it.each([
      ["url", r => { r.url += "&r=" + "x".repeat(2048); }],
      ["body", r => { r.body = Buffer.from("unexpected"); }],
      ["header bytes", r => { r.headers = { "X-Large": "a".repeat(65536) }; }],
      ["coerced body", r => { r.body = ""; }],
      ["unknown request field", r => { r.network_authorized = true; }],
      ["authentication header", r => { r.headers.Authorization = "synthetic-not-a-token"; }],
      ["proxy credential header", r => { r.headers["Proxy-Authorization"] = "synthetic-not-a-secret"; }],
    ])("denies request input violation: %s", async (_name, change) => {
      const { createNativeStockPolicy } = await load();
      const r = request(metaUrl); change(r);
      expect(createNativeStockPolicy(config()).inspect(r).disposition).toBe("blocked");
    });

    it.each([
      ["primary", primaryUrl, "GET", "XHR"],
      ["first-party primary", primaryUrl.replace("www.googleadservices.com/pagead/conversion/", "www.google.com/pagead/1p-conversion/"), "POST", "XHR"],
      ["viewthrough Script", "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1234567890/?" + cfgQuery, "GET", "Script"],
      ["viewthrough Image", "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/1234567890/?" + cfgQuery, "GET", "Image"],
      ["remarketing XHR", "https://www.google.com/rmkt/collect/1234567890/?" + cfgQuery, "POST", "XHR"],
      ["remarketing Image", "https://www.google.com/rmkt/collect/1234567890/?" + cfgQuery, "GET", "Image"],
      ["ccm XHR", "https://www.google.com/ccm/collect?" + ccmQuery, "POST", "XHR"],
      ["ccm Image", "https://www.google.com/ccm/collect?" + ccmQuery, "GET", "Image"],
    ])("recognizes the owned %s Google route without dispatch authority", async (_name, url, method, type) => {
      const { createNativeStockPolicy } = await load();
      expect(createNativeStockPolicy(config("google-ads-conversion")).inspect(request(url, method, type)))
        .toMatchObject({ disposition: "eligible", dispatch_authorized: false });
    });

    it.each(["label", "value", "currency_code", "oid", "url"])(
      "rejects changed or duplicated Google %s", async key => {
        const { createNativeStockPolicy } = await load();
        const policy = createNativeStockPolicy(config("google-ads-conversion"));
        const url = new URL(primaryUrl); url.searchParams.set(key, "changed");
        expect(policy.inspect(request(url.href, "GET", "XHR")).disposition).toBe("blocked");
        expect(policy.inspect(request(primaryUrl + `&${key}=duplicate`, "GET", "XHR")).disposition).toBe("blocked");
      });

    it("requires explicit companion authority and an earlier admitted unique primary identity", async () => {
      const { createNativeStockPolicy } = await load();
      const c = config("google-ads-conversion");
      const policy = createNativeStockPolicy(c);
      const companion = request("https://ad.doubleclick.net/ccm/s/collect?auid=123.456", "POST", "XHR");
      expect(policy.inspect(companion).disposition).toBe("deferred");
      const first = policy.inspect(request(primaryUrl, "GET", "XHR"));
      policy.registerAdmission(first, 0);
      expect(policy.inspect(companion)).toMatchObject({ disposition: "eligible",
        independent_ownership_authentication: false });
      expect(policy.inspect(request(companion.url.replace("123.456", "999.000"), "POST", "XHR")).disposition)
        .toBe("blocked");
      c.companion_authorized = false;
      const denied = createNativeStockPolicy(c);
      denied.registerAdmission(denied.inspect(request(primaryUrl, "GET", "XHR")), 0);
      expect(denied.inspect(companion).disposition).toBe("blocked");
    });

    it("rejects cross-policy/duplicate/foreign admission receipts", async () => {
      const { createNativeStockPolicy } = await load();
      const a = createNativeStockPolicy(config()), b = createNativeStockPolicy(config());
      const decision = a.inspect(request(metaUrl));
      expect(() => b.registerAdmission(decision, 0)).toThrow("invalid_policy_admission");
      expect(() => a.registerAdmission({ ...decision }, 0)).toThrow("invalid_policy_admission");
      a.registerAdmission(decision, 0);
      expect(() => a.registerAdmission(decision, 1)).toThrow("invalid_policy_admission");
    });

    it.each([["meta-pageview", 8], ["google-ads-conversion", 20]])(
      "does not register more than the %s vendor request ceiling", async (profile, maximum) => {
        const { createNativeStockPolicy } = await load();
        const policy = createNativeStockPolicy(config(profile));
        for (let i = 0; i < maximum; i++) policy.registerAdmission(policy.inspect(
          profile === "meta-pageview" ? request(metaUrl + `&r=${i}`) : request(primaryUrl, "GET", "XHR")), i);
        expect(() => policy.registerAdmission(policy.inspect(profile === "meta-pageview"
          ? request(metaUrl + "&r=excess") : request(primaryUrl, "GET", "XHR")), maximum))
          .toThrow("policy_request_count_limit");
        expect(policy.summary().vendor_registered).toBe(maximum);
      });

    it("validates observed redirects without broadening target ownership", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config());
      const parent = policy.inspect(request(metaUrl)); policy.registerAdmission(parent, 0);
      const target = metaUrl + "&r=redirect";
      policy.recordResponse({ ordinal: 0, status: 302, headers: [["Location", target]],
        body: Buffer.alloc(0), complete: true });
      expect(policy.inspect(request(target, "GET", "Image", { redirect_from: 0 })).disposition).toBe("eligible");
      expect(policy.inspect(request(target + "&sw=100", "GET", "Image", { redirect_from: 0 })).disposition).toBe("blocked");
      expect(policy.inspect(request(target, "GET", "Image", { redirect_from: 9 })).disposition).toBe("blocked");
      expect(policy.inspect(request(target.replace("id=123456789012345", "id=999"), "GET", "Image", { redirect_from: 0 })).disposition)
        .toBe("blocked");
    });

    it("requires an exact completed original response URL, not a source-shaped URL", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config("google-ads-conversion"));
      policy.registerAdmission(policy.inspect(request(primaryUrl, "GET", "XHR")), 0);
      const target = primaryUrl.replace("www.googleadservices.com/pagead/conversion/",
        "www.google.com/pagead/1p-conversion/");
      const child = request(target, "POST", "XHR", { response_parent: 0 });
      expect(policy.inspect(child).disposition).toBe("blocked");
      policy.recordResponse({ ordinal: 0, status: 200, headers: [["Content-Type", "application/json"]],
        body: Buffer.from(JSON.stringify({ fetch: target })), complete: true });
      expect(policy.inspect(child).disposition).toBe("eligible");
      expect(policy.inspect({ ...child, url: target + "&fmt=3" }).disposition).toBe("blocked");
      const summary = JSON.stringify(policy.summary());
      for (const value of ["1234567890", "synthetic-label", "synthetic-transaction", "owned.example"])
        expect(summary).not.toContain(value);
    });

    it("keeps configuration/primary identities consistent without treating a config token as primary authority", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config("google-ads-conversion"));
      const initial = request("https://www.google.com/rmkt/collect/1234567890/?" + cfgQuery, "GET", "Image");
      policy.registerAdmission(policy.inspect(initial), 0);
      expect(policy.inspect(request("https://ad.doubleclick.net/ccm/s/collect?auid=123.456")).disposition)
        .toBe("deferred");
      expect(policy.inspect(request(primaryUrl.replace("auid=123.456", "auid=999.000"), "GET", "XHR")).disposition)
        .toBe("blocked");
      policy.registerAdmission(policy.inspect(request(primaryUrl, "GET", "XHR")), 1);
      expect(policy.inspect(request(initial.url.replace("auid=123.456", "auid=999.000"))).disposition)
        .toBe("blocked");
      expect(policy.inspect(request("https://ad.doubleclick.net/ccm/s/collect?auid=123.456")).disposition)
        .toBe("eligible");
    });

    it("rechecks identity when two formerly eligible decisions race admission", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config("google-ads-conversion"));
      const first = policy.inspect(request(primaryUrl, "GET", "XHR"));
      const other = policy.inspect(request(primaryUrl.replace("auid=123.456", "auid=999.000"), "GET", "XHR"));
      policy.registerAdmission(first, 0);
      expect(() => policy.registerAdmission(other, 1)).toThrow("invalid_policy_admission");
      expect(policy.summary().registered).toBe(1);
    });

    it.each([null, "1", 0, NaN, Infinity])("rejects invalid or widened USD1 input %s", async value => {
      const { createNativeStockPolicy } = await load();
      const c = config("google-ads-conversion"); c.owned.value = value;
      expect(() => createNativeStockPolicy(c)).toThrow("invalid_native_policy");
    });

    it("does not promote a 304 Location to an observed HTTP redirect", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config());
      policy.registerAdmission(policy.inspect(request(metaUrl)), 0);
      const target = metaUrl + "&r=not-a-redirect";
      policy.recordResponse({ ordinal: 0, status: 304, headers: [["Location", target]],
        body: Buffer.alloc(0), complete: true });
      expect(policy.inspect(request(target, "GET", "Image", { redirect_from: 0 })).disposition).toBe("blocked");
    });

    it("rejects incomplete, duplicate and over-cap response records without creating URL authority", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config());
      policy.registerAdmission(policy.inspect(request(metaUrl)), 0);
      const r = { ordinal: 0, status: 200, headers: [], body: Buffer.alloc(0), complete: true };
      expect(() => policy.recordResponse({ ...r, complete: false })).toThrow("invalid_policy_response");
      const large = Buffer.alloc(2097153);
      Object.defineProperty(large, "byteLength", { value: 0 });
      expect(() => policy.recordResponse({ ...r, body: large })).toThrow("invalid_policy_response");
      policy.recordResponse(r);
      expect(() => policy.recordResponse(r)).toThrow("invalid_policy_response");
    });

    it("bounds cumulative response bookkeeping rather than accepting unlimited per-response maxima", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config());
      for (let i = 0; i < 5; i++) policy.registerAdmission(policy.inspect(request(metaUrl + `&r=${i}`)), i);
      const body = Buffer.alloc(2097150);
      for (let i = 0; i < 4; i++)
        policy.recordResponse({ ordinal: i, status: 200, headers: [], body, complete: true });
      expect(() => policy.recordResponse({ ordinal: 4, status: 200, headers: [], body, complete: true }))
        .toThrow("policy_response_aggregate_limit");
      expect(policy.summary().responses).toBe(4);
    });

    it("rejects over-deep JSON before it can become source-shaped URL authority", async () => {
      const { createNativeStockPolicy } = await load();
      const policy = createNativeStockPolicy(config());
      policy.registerAdmission(policy.inspect(request(metaUrl)), 0);
      const parse = vi.spyOn(JSON, "parse");
      try {
        expect(() => policy.recordResponse({ ordinal: 0, status: 200,
          headers: [["Content-Type", "application/json"]],
          body: Buffer.from("[".repeat(30) + "0" + "]".repeat(30)), complete: true }))
          .toThrow("response_structure_limit");
        expect(parse).not.toHaveBeenCalled();
      } finally { parse.mockRestore(); }
      expect(policy.summary().responses).toBe(0);
    });
  });

  it("AC2: neither a correlation token nor a response-shaped object confers admission", async () => {
    const { denyStockExecution } = await load();
    expect(() => denyStockExecution({ case_name: "google-stock", auid: "synthetic" }))
      .toThrow("unsupported_case");
  });

  it.each(["google-chamber", "meta-chamber", "candidate", "", null, undefined])(
    "AC4: rejects candidate/unknown key %s before any reservation", async key => {
      const { denyStockExecution } = await load();
      expect(() => denyStockExecution(key)).toThrow("unsupported_case");
    });

  it("keeps every owner ceiling exact rather than widening it for qualification", async () => {
    const { LIMITS } = await load();
    expect(LIMITS).toEqual({
      google_requests: 20, meta_requests: 8, observations: 64, url_bytes: 2048,
      request_bytes: 65536, response_bytes: 2097152, aggregate_bytes: 8388608,
      duration_ms: 60000,
    });
    expect(Object.isFrozen(LIMITS)).toBe(true);
  });
});
