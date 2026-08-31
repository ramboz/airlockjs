// Core boundary guard (spec 014-02 arch-review). `core/` (production) must NOT
// import from `rig/` (throwaway test-harness code): rig/ is disposable, so a
// core→rig import means deleting the harnesses would break production, and it
// re-creates the rig-mirror-vs-core drift spec 014 exists to kill.
//
// 014-02's coalescing broker briefly had exactly one such import
// (`recognizeInteract` from `rig/alloy-xdm-mint.js`). It was fixed by making the
// broker VENDOR-NEUTRAL (the recognizer is injected) and relocating the alloy
// recognizer to `connectors/alloy/xdm-mint.js`. This test fails the moment any
// `core/ → rig/` import returns. (A `core/ → connectors/` import is a separate,
// pre-existing MVP1 coupling — GA4's mapToMp — not guarded here.)
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const CORE = join(dirname(fileURLToPath(import.meta.url)), "..", "core");

describe("core/ boundary — no import from throwaway rig/ (014-02 arch-review)", () => {
  it("no core/ module imports from ../rig/", () => {
    const offenders = [];
    for (const f of readdirSync(CORE)) {
      if (!f.endsWith(".js")) continue;
      const src = readFileSync(join(CORE, f), "utf8");
      if (/from\s+["']\.\.\/rig\/|require\(\s*["']\.\.\/rig\//.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  // spec 018-01 arch-review: core/sanitize-html.js justifies its core/ home by
  // being IMPORT-FREE + injected-parser (a vendor-neutral security primitive,
  // like core/consent.js / core/endpoint-ceiling.js), yet it references the
  // ambient DOMParser global. The home-justification leaned on "import-free by
  // inspection" — machine-enforce it so a future edit that adds an import (and
  // thus a hidden dependency the core/ home forbids) fails here, not silently.
  it("core/sanitize-html.js is import-free (its core/ home depends on it)", () => {
    const src = readFileSync(join(CORE, "sanitize-html.js"), "utf8");
    // No top-level ES import / dynamic import() / require — a security
    // primitive that claims zero dependencies must actually have zero.
    expect(/^\s*import\s/m.test(src)).toBe(false);
    expect(/\bimport\s*\(/.test(src)).toBe(false);
    expect(/\brequire\s*\(/.test(src)).toBe(false);
  });
});
