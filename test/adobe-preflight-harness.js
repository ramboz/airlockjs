import { readFile, mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { expect } from "vitest";

export const fixture = JSON.parse(await readFile(new URL("./fixtures/adobe-preflight.json", import.meta.url), "utf8"));
// Derive this synthetic digest once; later response mutations must still fail its binding.
const propertyToken = fixture.transport_replies.find(reply => reply.id === "target-property").response.body.token;
fixture.routing_evidence.property_token_api_sha256 = createHash("sha256").update(propertyToken, "utf8").digest("hex");
export const copy = () => structuredClone(fixture);
export const row = (report, id) => report.checks.find(check => check.id === id);
export function patchVariant(bundle, variant) {
  for (const patch of variant.patches) {
    const parts = patch.path.slice(1).split("/");
    let parent = bundle;
    for (const key of parts.slice(0, -1)) parent = parent[key];
    parent[parts.at(-1)] = structuredClone(patch.value);
  }
}

// The only fixture/clock/transport injection is in this test harness.
export async function exercise(bundle = copy(), options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "airlock-preflight-SENTINEL-"));
  const paths = ["input", "routing", "credential", "workspace"].map(name => join(directory, name));
  let stdout = "", stderr = "";
  const sent = [];
  try {
    for (const [index, value] of [bundle.private_input, bundle.routing_evidence, bundle.credential_export].entries()) {
      await writeFile(paths[index], JSON.stringify(value), { mode: 0o600 });
    }
    if (bundle.workspace_evidence) await writeFile(paths[3], JSON.stringify(bundle.workspace_evidence), { mode: 0o600 });
    if (options.prepare) await options.prepare(paths);
    const transport = async (url, init) => {
      const reply = bundle.transport_replies.find(item => item.request.url === url);
      expect(reply, "request must be in fixed fixture inventory").toBeDefined();
      const expected = reply.request;
      expect(init.method).toBe(expected.method);
      expect(init.redirect).toBe("manual");
      const headers = Object.fromEntries(Object.entries(init.headers).map(([key, value]) => [key.toLowerCase(), value]));
      const wanted = Object.fromEntries(Object.entries(expected.headers).map(([key, value]) => [key.toLowerCase(), value]));
      if (wanted.authorization) wanted.authorization = "Bearer SYNTHETIC-ACCESS-TOKEN-DO-NOT-USE";
      expect(headers).toEqual(wanted);
      if (expected.form_body) expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual(expected.form_body);
      else if (expected.json_body) expect(JSON.parse(init.body)).toEqual(expected.json_body);
      else expect(init.body).toBeUndefined();
      expect(Object.isFrozen(init.headers)).toBe(true);
      sent.push(reply.id);
      if (options.transport) return options.transport(reply, init);
      const response = reply.response;
      if (response.transport_error) throw response.transport_error;
      return new Response(response.body_text ?? JSON.stringify(response.body), { status: response.status, headers: response.headers });
    };
    const { runCli } = await import("../probes/adobe-compatibility/preflight.mjs");
    const report = await runCli({
      argv: options.argv ?? ["--input", paths[0], "--routing-evidence", paths[1],
        ...(bundle.workspace_evidence || options.workspaceHandle ? ["--workspace-evidence", paths[3]] : []),
        ...(options.extraArgs ?? [])],
      env: options.noCredentials ? {} : { ADOBE_CREDENTIAL_FILE: paths[2] },
      stdout: { write: text => { stdout += text; } },
      stderr: { write: text => { stderr += text; } },
      transport,
      now: options.now ?? (() => Date.parse(bundle.frozen_clock)),
    });
    for (const sentinel of [...bundle.redaction_sentinels, ...paths, directory, "SENTINEL-THROWN-OBJECT"]) {
      expect(stdout + stderr + JSON.stringify(report)).not.toContain(sentinel);
    }
    if (report) {
      expect(JSON.parse(stdout)).toEqual(report);
      expect(stdout.endsWith("\n")).toBe(true);
      expect(Object.isFrozen(report)).toBe(true);
      expect(Object.isFrozen(report.checks)).toBe(true);
      for (const check of report.checks) expect(Object.isFrozen(check)).toBe(true);
      expect(Object.isFrozen(report.summary)).toBe(true);
      expect(Object.isFrozen(report.claims)).toBe(true);
      expect(report.checks.map(check => check.id)).toEqual(fixture.expected_ready_report.checks.map(check => check.id));
    }
    return { report, stdout, stderr, sent };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export const privateMode = async (paths, mode) => chmod(paths[2], mode);
