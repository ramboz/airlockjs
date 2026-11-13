import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIXTURE_ROOTS, scanFixtureFiles, scanFixtureText } from "./fixture-credentials.mjs";
import { checkFixtureManifest } from "./fixture-manifest.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const rules = text => scanFixtureText(text).map(f => f.rule);
const b64 = v => Buffer.from(v).toString("base64url");
const headers = (name, value) => JSON.stringify({ request: { headers: [[name, value]] } });

describe("064-03 credential check: rejects (positive cases)", () => {
  it.each([
    ["Google SID cookie in a Cookie header", headers("Cookie", "_ga=GA1.1.1; SID=g.a000abc"), "google_session_cookie"],
    ["Google __Secure-3PSID in Set-Cookie", headers("Set-Cookie", "__Secure-3PSID=abc; Path=/; Secure"), "google_session_cookie"],
    ["Google SAPISID in a cookie dump", JSON.stringify({ cookies: [{ name: "SAPISID", value: "x" }] }), "google_session_cookie"],
    ["Meta c_user", headers("Cookie", "_fbp=fb.1.1.1; c_user=100000000000000"), "meta_session_cookie"],
    ["Meta xs in a storage dump keyed by name", JSON.stringify({ storage_after: { cookies: { xs: "1:abc" } } }), "meta_session_cookie"],
    ["Meta datr as a name/value cookie pair", JSON.stringify({ cookies: [["datr", "abc"]] }), "meta_session_cookie"],
    ["Adobe IMS access token cookie", headers("Cookie", "adobeid_ims_access_token/x=abc"), "adobe_session_cookie"],
    ["Adobe ims_sid", JSON.stringify({ cookies: [{ name: "ims_sid", value: "x" }] }), "adobe_session_cookie"],
    ["Authorization header (Bearer)", headers("Authorization", "Bearer abcdef0123456789"), "token_field"],
    ["Authorization header (any non-empty value)", headers("authorization", "Token x"), "token_field"],
    ["Bearer token in a body string", JSON.stringify({ body: "Authorization: Bearer abcdef0123456789" }), "bearer_token"],
    ["Google OAuth token", JSON.stringify({ body: "ya29.a0AfH6SMBabcdefghijklmnopqrstuv" }), "google_oauth_token"],
    ["Meta access token", JSON.stringify({ body: "EAAGm0PX4ZCpsBAabcdefghijklmnop" }), "meta_access_token"],
    ["JWT", JSON.stringify({ body: [b64("{\"alg\":\"none\"}"), b64("{\"sub\":\"x\"}"), "c2ln"].join(".") }), "jwt"],
    ["access_token query parameter", JSON.stringify({ url: `https://x.invalid/p?a=1&${"access_"}token=${"abc"}${"def123456"}` }), "token_parameter"],
    ["token as a JSON field", JSON.stringify({ response: { refresh_token: "abc" } }), "token_field"],
    ["proxy credentials in a URL", JSON.stringify({ egress: "http://user:s3cret@proxy.invalid:8080" }), "url_credentials"],
    ["socks5 credentials in a URL", JSON.stringify({ egress: "socks5h://u:p@127.0.0.1:1080" }), "url_credentials"],
    ["Proxy-Authorization header", headers("Proxy-Authorization", "Basic dXNlcjpwYXNz"), "token_field"],
    ["proxy_password field", JSON.stringify({ egress: { proxy_password: "x" } }), "proxy_or_vpn_credential"],
    ["VPN password field", JSON.stringify({ vpn: { vpn_password: "x" } }), "proxy_or_vpn_credential"],
    ["WireGuard private key (non-JSON text)", `[Interface]\nPrivate${"Key"} = ${b64("helloworldhelloworldhelloworld12")}\n`, "vpn_config_secret"],
    ["OpenVPN credentials file reference", "client\nauth-user-pass creds.txt\n", "vpn_config_secret"],
    ["private key block", "-----BEGIN PRIVATE KEY-----\nabc", "private_key"],
    ["raw Cookie line in a non-JSON dump", "GET /x\nCookie: a=1; SID=abc\n", "google_session_cookie"],
  ])("rejects %s", (_name, text, rule) => {
    expect(rules(text)).toContain(rule);
  });

  it("never echoes the secret value in a finding", () => {
    const report = JSON.stringify(scanFixtureText(headers("Cookie", "SID=topsecretvalue123")));
    expect(report).not.toContain("topsecretvalue123");
  });
});

describe("064-03 credential check: accepts (negative cases)", () => {
  it.each([
    ["the tag's own tracking cookies", headers("Cookie", "_fbp=fb.1.1.1; _fbc=fb.1.1.abc; _gcl_au=1.1.2; _ga=GA1.1.3; kndctr_ABC_AdobeOrg_identity=CiY")],
    ["Adobe AMCV cookie", headers("Cookie", "AMCV_ABC%40AdobeOrg=1; s_ecid=MCMID|1")],
    ["a cookie dump without session names", JSON.stringify({ cookies: [{ name: "_ga", value: "x" }, { name: "_fbp", value: "y" }] })],
    ["a query parameter named like a cookie, outside cookie contexts", JSON.stringify({ url: "https://x.invalid/tr?id=1&sb=2&xs=3&ev=PageView" })],
    ["an empty token field", JSON.stringify({ request: { token: "" } })],
    ["opaque egress label and exit ID", JSON.stringify({ egress: { region: "eea", exit_id: "exit-3" } })],
    ["a URL without userinfo", JSON.stringify({ url: "https://www.facebook.com/tr/?id=123&ev=PageView" })],
    ["a signature-less word 'Bearer' in prose", JSON.stringify({ note: "the bearer of this fixture" })],
    ["a response with a Set-Cookie for a tracking cookie", headers("Set-Cookie", "_fbp=fb.1.2.3; Path=/; Secure")],
    ["plain text with no credentials", "GET /collect?v=2\nHost: www.google-analytics.com\n"],
  ])("accepts %s", (_name, text) => {
    expect(rules(text)).toEqual([]);
  });
});

describe("064-03 repository fixtures", () => {
  it("every committed fixture and capture manifest passes the credential check", async () => {
    const findings = await scanFixtureFiles(FIXTURE_ROOTS.map(p => join(root, p)), root);
    expect(findings).toEqual([]);
  });

  it("scans a directory of files and reports the offending path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "airlock-cred-"));
    try {
      await mkdir(join(dir, "nested"));
      await writeFile(join(dir, "clean.json"), headers("Cookie", "_ga=1"));
      await writeFile(join(dir, "nested", "dirty.json"), headers("Cookie", "SID=abc"));
      const findings = await scanFixtureFiles([dir], dir);
      expect(findings.map(f => f.file)).toEqual([join("nested", "dirty.json")]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

const digest = n => String(n).repeat(64).slice(0, 64);
const storage = () => ({ cookies: [{ name: "_fbp", value: "fb.1.1.1" }], local_storage: {}, session_storage: {} });
const manifest = () => ({
  schema_version: 1, vendor: "meta-pixel", captured_at: "2026-11-13T10:00:00Z",
  input_state: {
    url: "https://test.example.invalid/", referrer: null, viewport: { width: 1280, height: 800 },
    locale: "en-US", timezone: "America/Los_Angeles", egress: { region: "non-eea", exit_id: "exit-1" },
    browser: { name: "Chromium", version: "155.0.8059.85" }, mode: "headless", profile_kind: "fresh",
    loaded_digests: { script_sha256: digest(1), config_sha256: digest(2) },
    storage_before: { cookies: [], local_storage: {}, session_storage: {} }, storage_after: storage(),
  },
});

describe("064-03 fixture manifest: stored input state (ADR-0061 point 1)", () => {
  it("accepts a complete manifest for each vendor", () => {
    for (const vendor of ["adobe", "google-ads", "meta-pixel"])
      expect(checkFixtureManifest({ ...manifest(), vendor })).toEqual({ ok: true, errors: [] });
  });

  it("accepts optional settings state and a null config digest", () => {
    const m = manifest();
    m.settings_state = { label: "enhanced-conversions-on", set_at: "2026-11-13T09:00:00Z", wait_seconds: 900 };
    m.input_state.loaded_digests = { script_sha256: digest(1), config_sha256: null };
    expect(checkFixtureManifest(m).ok).toBe(true);
  });

  it("rejects a fixture with no input-state block", () => {
    const m = manifest(); delete m.input_state;
    expect(checkFixtureManifest(m)).toEqual({ ok: false, errors: ["input_state_missing"] });
  });

  it.each(["url", "referrer", "viewport", "locale", "timezone", "egress", "browser", "mode",
    "profile_kind", "loaded_digests", "storage_before", "storage_after"])(
    "rejects a manifest missing input_state.%s", key => {
      const m = manifest(); delete m.input_state[key];
      expect(checkFixtureManifest(m).errors).toContain(`input_state_missing_${key}`);
    });

  it.each([
    ["an unknown vendor", m => { m.vendor = "tiktok"; }, "vendor"],
    ["an unsupported schema version", m => { m.schema_version = 2; }, "schema_version"],
    ["an unknown field", m => { m.input_state.extra = 1; }, "unknown_field"],
    ["a non-http URL", m => { m.input_state.url = "file:///etc/passwd"; }, "url"],
    ["an egress hostname or port instead of an opaque ID", m => { m.input_state.egress.exit_id = "vpn.example.com:443"; }, "egress"],
    ["an unlabelled egress region", m => { m.input_state.egress.region = "mars"; }, "egress"],
    ["a bad viewport", m => { m.input_state.viewport.width = 0; }, "viewport"],
    ["a bad profile kind", m => { m.input_state.profile_kind = "logged-in"; }, "profile_kind"],
    ["a bad script digest", m => { m.input_state.loaded_digests.script_sha256 = "abc"; }, "loaded_digests"],
    ["storage cookies of the wrong shape", m => { m.input_state.storage_after.cookies = "none"; }, "storage_after_cookies"],
  ])("rejects %s", (_name, mutate, code) => {
    const m = manifest(); mutate(m);
    const result = checkFixtureManifest(m);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(code);
  });

  it("rejects a manifest whose stored storage dump holds a session cookie", () => {
    const m = manifest();
    m.input_state.storage_after.cookies.push({ name: "c_user", value: "1" });
    expect(checkFixtureManifest(m).errors).toContain("credential_meta_session_cookie");
  });

  it("rejects non-object input without throwing", () => {
    for (const bad of [null, undefined, [], "x", 1]) expect(checkFixtureManifest(bad).ok).toBe(false);
  });
});
