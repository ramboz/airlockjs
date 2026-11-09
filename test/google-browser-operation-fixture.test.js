import { request } from "node:http";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startGoogleBrowserOperationFixture } from "../rig/local-browser-journeys.mjs";
import { checkGoogleOperationRequest } from "../rig/local-browser-foreground.mjs";

const fixtures = [];
const captured = JSON.parse(readFileSync(new URL("../rig/fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
const owned = captured.owned;
const primaryQuery = new URLSearchParams({
  label: owned.conversion_label, value: String(owned.value), currency_code: owned.currency,
  oid: owned.transaction_id, url: owned.document_url,
}).toString();
const secondaryQuery = new URL(captured.entries[1].request.url).search;
const primary = `/pagead/conversion/${owned.conversion_id.slice(3)}/?${primaryQuery}`;
const secondary = `/pagead/viewthroughconversion/${owned.conversion_id.slice(3)}/${secondaryQuery}`;

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    expect(await fixture.close()).toMatchObject({ closure: "closed", listening: false, openSockets: 0, pendingResponses: 0, errors: [] });
  }
});

async function setup(name) {
  const fixture = await startGoogleBrowserOperationFixture(name);
  fixtures.push(fixture);
  return fixture;
}

function send(origin, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { method, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(2500, () => req.destroy(new Error("test-deadline")));
    req.end();
  });
}

describe("fixed Google browser-operation fixture, Node HTTP only", () => {
  it("pins the script-free frame response and a held final receiver without browser claims", async () => {
    const fixture = await setup("readable");
    const page = await send(fixture.origin, "/google-browser-operation");
    expect(page.headers["content-security-policy"]).toContain(
      `frame-src ${fixture.origin}/rig/google-browser-operation-frame.html`);
    expect(page.headers["content-security-policy"]).not.toContain("frame-src 'self'");
    const frame = await send(fixture.origin, "/rig/google-browser-operation-frame.html");
    expect(frame).toMatchObject({
      status: 200, body: "<!doctype html>\n<html><head></head><body></body></html>\n",
      headers: { "content-security-policy": fixture.framePolicy },
    });
    expect(fixture.framePolicy).not.toContain("'self'");
    expect((await send(fixture.origin, primary)).status).toBe(200);
    const post = await send(fixture.origins[1], secondary, "POST");
    expect(post).toMatchObject({ status: 302, headers: { location: `${fixture.origins[1]}/operation-unexpected-path` } });
    let completed = false;
    const final = send(fixture.origins[1], "/operation-unexpected-path").then((value) => { completed = true; return value; });
    await vi.waitFor(() => expect(fixture.getOperationReceipts()).toHaveLength(3));
    expect(completed).toBe(false);
    expect(fixture.releaseResponse("final")).toBe(true);
    expect((await final).status).toBe(200);
    expect(fixture.getOperationReceipts().map(({ stage, method }) => [stage, method])).toEqual([
      ["primary", "GET"], ["secondary", "POST"], ["final", "GET"],
    ]);
  });

  it("retains a matched reachable denied-origin control and a distinct redirect target", async () => {
    const fixture = await setup("csp-negative");
    const reachable = await send(fixture.origins[2], "/reachability");
    expect(reachable).toMatchObject({ status: 200, headers: { "access-control-allow-origin": fixture.origin } });
    const post = await send(fixture.origins[1], secondary, "POST");
    expect(post).toMatchObject({ status: 302, headers: { location: `${fixture.origins[2]}/operation-csp-denied` } });
    expect(fixture.framePolicy).not.toContain(fixture.origins[2]);
    expect(fixture.getOperationReceipts().map(({ stage }) => stage)).toEqual(["reachability", "secondary"]);
  });

  it("observes the 307 and extra hop without treating either as runtime enforcement", async () => {
    const fixture = await setup("redirect-307");
    const redirect = await send(fixture.origins[1], secondary, "POST");
    expect(redirect).toMatchObject({ status: 307, headers: { location: `${fixture.origins[1]}/operation-intermediate` } });
    const intermediate = await send(fixture.origins[1], "/operation-intermediate", "POST");
    expect(intermediate).toMatchObject({ status: 200 });
    expect(fixture.getOperationReceipts().map(({ method }) => method)).toEqual(["POST", "POST"]);
  });

  it("holds the redirect destination for withdrawal controls", async () => {
    const fixture = await setup("revoke");
    const post = await send(fixture.origins[1], secondary, "POST");
    expect(post).toMatchObject({ status: 302, headers: { location: `${fixture.origins[1]}/operation-final` } });
    const final = send(fixture.origins[1], "/operation-final");
    await vi.waitFor(() => expect(fixture.getOperationReceipts()).toHaveLength(2));
    expect(fixture.getOperationReceipts()[1]).toMatchObject({ stage: "final", status: null });
    expect(fixture.releaseResponse("final")).toBe(true);
    expect((await final).status).toBe(200);
  });

  it("keeps no-CORS and unreadable-primary controls distinct", async () => {
    const opaque = await setup("opaque");
    expect((await send(opaque.origins[1], secondary, "POST")).headers).not.toHaveProperty("access-control-allow-origin");
    const unreadable = await setup("unreadable-primary");
    expect((await send(unreadable.origins[1], primary)).headers).not.toHaveProperty("access-control-allow-origin");
  });

  it("rejects unlisted cases and retains fixed packet limits", async () => {
    await expect(startGoogleBrowserOperationFixture("unlisted")).rejects.toThrow("fixed-operation-case-required");
    const fixture = await setup("lifecycle");
    expect(fixture.limits).toMatchObject({ observedRequests: 256, measurementAttempts: 24, lifetimeMs: 120000 });
  });

  it("admits only fixed loopback operation requests and keeps the CSP target unblocked by the harness", async () => {
    const fixture = await setup("csp-negative");
    const input = (url, method = "GET", resourceType = "fetch") => ({
      url, method, resourceType, bodyBytes: 0, headerBytes: 0,
    });
    expect(checkGoogleOperationRequest(fixture, input(`${fixture.origins[0]}${fixture.operationPaths.primary}`)))
      .toBe("measurement");
    expect(checkGoogleOperationRequest(fixture, input(`${fixture.origins[1]}${fixture.operationPaths.secondary}`, "POST")))
      .toBe("measurement");
    expect(checkGoogleOperationRequest(fixture, input(`${fixture.origins[2]}/operation-csp-denied`)))
      .toBe("measurement");
    expect(checkGoogleOperationRequest(fixture, input(`${fixture.origins[2]}/reachability`))).toBe("measurement");
    expect(checkGoogleOperationRequest(fixture, input(`${fixture.origin}/rig/google-browser-operation-frame.html`, "GET", "document")))
      .toBe("frame");
    for (const invalid of [
      input("https://example.test/"), input(`${fixture.origins[2]}/arbitrary`),
      input(`${fixture.origins[1]}${fixture.operationPaths.secondary}`),
      { ...input(`${fixture.origins[0]}${fixture.operationPaths.primary}`), bodyBytes: 1 },
    ]) expect(() => checkGoogleOperationRequest(fixture, invalid)).toThrow();
    expect(fixture.sourceManifest).toHaveLength(31);
    expect(fixture.pageManifest).toHaveLength(3);
  });
});
