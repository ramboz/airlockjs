// 067-11 AC3: only a privacy-safe connector may declare the granted-by-default
// `measurement` purpose (ADR-0007 amendment, owner decision D4, 2026-11-13).
// Qualification: no cookies/storage, no user/device/click identifiers, no
// personal data. Only helix-rum qualifies; adding another needs owner approval
// (update ALLOWED below only with that approval).
import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative } from "node:path";
import { createHelixRumConnector } from "../connectors/helix-rum/connector.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set(["connectors/helix-rum/connector.js", "core/consent.js"]);

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".js") && !f.endsWith(".built.js")) out.push(p);
  }
  return out;
}

afterEach(() => vi.restoreAllMocks());

describe("measurement purpose guard (067-11 AC3)", () => {
  it("no source file outside the owner-approved set names the `measurement` purpose", () => {
    const offenders = [];
    for (const d of ["core", "connectors", "adapters", "drivers"]) {
      for (const p of walk(join(ROOT, d))) {
        const rel = relative(ROOT, p);
        if (!ALLOWED.has(rel) && /["'`]measurement["'`]/.test(readFileSync(p, "utf8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the adapter wires the helix-rum purposes constant exactly once (import + the bootHelixRum seam), never on another connector", () => {
    const src = readFileSync(join(ROOT, "adapters/eds/index.js"), "utf8");
    expect(src.match(/HELIX_RUM_EGRESS_PURPOSES|DEFAULT_GRANTED_PURPOSES/g)).toHaveLength(2);
  });

  it("helix-rum is the only connector whose manifest declares `measurement`", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const m = createHelixRumConnector({ ctx: { referer: "https://site.example/" } }).manifest;
    expect(m.purposes.egress).toEqual(["measurement"]);
    expect(m.capabilities.cookie).toBeUndefined();
    expect(m.capabilities.storage).toBeUndefined();
  });

  it("helix-rum payloads carry no identifier or personal-data fields, even when extra params are pushed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const c = createHelixRumConnector({ ctx: { referer: "https://site.example/" } });
    const hostile = { userId: "sentinel-user-u1", clientId: "sentinel-client-c1", deviceId: "sentinel-device-d1", email: "a@b.example", cookie: "sentinel-cookie=1", clickId: "sentinel-gclid" };
    const bodies = [
      c.handle({ type: "top", ts: 1, params: hostile }),
      c.handle({ type: "error", ts: 2, params: { source: "a.js", target: "boom", ...hostile } }),
      c.handle({ type: "cwv", ts: 3, params: { name: "LCP", value: 1, ...hostile } }),
    ].flatMap((reqs) => reqs.map((r) => JSON.parse(r.body)));
    expect(bodies).toHaveLength(3);
    const allowed = new Set(["weight", "id", "referer", "checkpoint", "t", "source", "target", "name", "value"]);
    const forbidden = /user|client|device|cookie|email|click|gclid|fbclid|visitor|session|fingerprint|^ip$/i;
    for (const b of bodies) {
      for (const k of Object.keys(b)) {
        if (b[k] === undefined) continue;
        expect(forbidden.test(k), `forbidden field ${k}`).toBe(false);
        if (b.checkpoint !== "cwv") expect(allowed.has(k), `unexpected field ${k}`).toBe(true);
      }
      expect(JSON.stringify(b)).not.toMatch(/a@b\.example|sentinel-/);
    }
    // the per-page id is ephemeral (never persisted): a fresh 9-char slice, not a stored identifier
    expect(bodies[0].id).toMatch(/^[0-9a-f-]{9}$/);
  });
});
