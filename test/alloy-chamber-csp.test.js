// Alloy chamber worker — CSP-load fix (spec 033-02 AC1). The 033-01 spike proved
// the classic `importScripts` chamber is BLOCKED under the enforced EDS boilerplate
// CSP by Trusted Types (`require-trusted-types-for 'script'`): `importScripts` is a
// TrustedScriptURL sink and the page's `default` TT policy is per-realm, so it never
// reaches the worker → the shipped bare `self.importScripts(bundleUrl)` would
// fatal{phase:"load"} on a real EDS page. The productized fix: the worker installs
// its OWN Trusted Types policy and loads the bundle via
// `importScripts(policy.createScriptURL(bundleUrl))` — ~4 lines in airlock's own
// worker, NOT a site CSP change.
//
// This is the CI-gated source/build regression guard: it builds the SHIPPED classic
// worker (the byte-identical IIFE load route the rig + dist use) and asserts the fix
// is present + AD-7 (`has_dynamic_import === false`) is preserved. The real browser
// CSP-admission proof (reaches `booted`, not `fatal{phase:"load"}`, under the
// boilerplate CSP + the un-nonced-inline negative control) is rig/alloy-csp.mjs.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "esbuild";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const WORKER_SRC = join(REPO, "connectors/alloy/alloy-chamber.worker.js");

let built;
let outdir;
beforeAll(async () => {
  outdir = mkdtempSync(join(tmpdir(), "airlock-alloy-csp-"));
  const outfile = join(outdir, "alloy-chamber.worker.built.js");
  // The byte-identical load route the dist + rigs use: a CLASSIC IIFE (importScripts
  // + worker globals untouched, ESM imports inlined) — NOT a module worker.
  await build({ entryPoints: [WORKER_SRC], outfile, bundle: true, format: "iife", platform: "browser", target: "es2022" });
  built = readFileSync(outfile, "utf8");
}, 60000);
afterAll(() => rmSync(outdir, { recursive: true, force: true }));

describe("alloy chamber worker — CSP-load fix (spec 033-02 AC1)", () => {
  it("installs its OWN Trusted Types policy (createPolicy) to load the stock bundle", () => {
    expect(built).toMatch(/createPolicy\s*\(/);
  });

  it("loads the bundle via a TrustedScriptURL (createScriptURL), not a bare importScripts(bundleUrl)", () => {
    // The fix routes the bundle URL through the worker-realm policy's createScriptURL
    // before importScripts — the ~4-line accommodation the 033-01 probe proved green.
    expect(built).toMatch(/createScriptURL\s*\(/);
    expect(built).toMatch(/importScripts\s*\(/); // still the classic load route
  });

  it("preserves AD-7: has_dynamic_import === false in the built classic worker", () => {
    // The regex the alloy rigs assert against — a literal dynamic import() token must
    // NOT appear (the worker builds its adversarial remote-loader thunk at runtime).
    const hasDynamicImport = /[^.\w]import\s*\(/.test(built);
    expect(hasDynamicImport).toBe(false);
  });

  it("carries no residual static ESM (fully bundled IIFE — the classic-worker load route)", () => {
    const hasStaticEsm = /^\s*import\s+[\w{*]/m.test(built) || /^\s*export\s/m.test(built);
    expect(hasStaticEsm).toBe(false);
  });
});
