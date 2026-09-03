// AC8 (spec 025-02) — `@ampproject/worker-dom` stays a devDependency
// (025-01's probe-only library), NOT a runtime dependency. airlock's own
// mirror (core/worker-dom/*, core/dom-chamber*.js, adapters/eds/dom-apply.js)
// is the runtime; no core/ / adapters/ / connectors/ module imports it —
// enumerable by grepping the runtime tree, mirroring
// test/core-boundary.test.js's own recursive-scan style (that test only
// scans core/'s TOP level; this one recurses core/'s subdirectories too,
// since 025-02 adds core/worker-dom/).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function listJsFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listJsFilesRecursive(full));
    else if (entry.endsWith(".js") || entry.endsWith(".mjs")) out.push(full);
  }
  return out;
}

// Matches an actual IMPORT of the package (static `import ... from`, dynamic
// `import(...)`, or `require(...)`) — NOT a doc-comment mention of the name
// (this slice's own module headers legitimately name it, e.g. "replacing
// @ampproject/worker-dom" — a comment is not a dependency).
const IMPORT_RE = /(?:from\s+["']@ampproject\/worker-dom|(?:import|require)\(\s*["']@ampproject\/worker-dom)/;

describe("AC8 — @ampproject/worker-dom is devDependency-only, never imported by the runtime tree", () => {
  it("no core/ / adapters/ / connectors/ module imports @ampproject/worker-dom", () => {
    const dirs = ["core", "adapters", "connectors"].map((d) => join(ROOT, d));
    const offenders = [];
    for (const dir of dirs) {
      for (const file of listJsFilesRecursive(dir)) {
        const src = readFileSync(file, "utf8");
        if (IMPORT_RE.test(src)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("package.json still lists @ampproject/worker-dom under devDependencies, not dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.devDependencies).toHaveProperty("@ampproject/worker-dom");
    expect(pkg.dependencies || {}).not.toHaveProperty("@ampproject/worker-dom");
  });
});
