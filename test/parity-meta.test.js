// Spec 038-01 — the parity harness end-to-end on Meta Pixel (the same-protocol oracle's first
// vendor). Covers AC1 (capture pattern + redaction), AC2 (the oracle's input contract — airlock
// side substitutable between real replay and a supplied field-set), AC4 (the two-way regression
// guard's three keystone fixtures + a divergent-value fixture), AC5 (the report), and AC6 (the
// `npm run parity:meta` entrypoint). test/parity-oracle.test.js covers AC3's bucket logic
// generically and AC7's vendor-genericity proof.
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { createMetaPixelConfig, SYNTHETIC_META_PIXEL_ID, META_TR_ENDPOINT } from "../connectors/pixel/vendors/meta.js";
import { metaParityDescriptor } from "../rig/parity/descriptors/meta.js";
import { diffParity } from "../rig/parity/oracle.js";
import { replayPixelBeacon } from "../rig/parity/replay.js";
import { redactMetaBeacon, SYNTHETIC_FBP, SYNTHETIC_FBC, SYNTHETIC_HASH } from "../rig/parity/redact.js";
import { buildParityReport, verdictExitCode } from "../rig/parity/report.js";
import { matchesVendorBeacon } from "../rig/parity/capture-patterns.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures/parity-meta-tr.redacted.json");
const CLI_PATH = join(HERE, "../rig/parity/run-meta.mjs");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

function replayFixtureFields() {
  const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID });
  const logicalEvent = metaParityDescriptor.deriveLogicalEvent(fixture.container_fields);
  return replayPixelBeacon(config, logicalEvent).fields;
}

describe("capture pattern set — Meta /tr beacon (AC1 DoR: the loader pattern misses this endpoint)", () => {
  it("matches Meta's /tr beacon URL", () => {
    expect(matchesVendorBeacon("meta", "https://www.facebook.com/tr?id=123&ev=Lead")).toBe(true);
  });

  it("does NOT match an unrelated vendor's beacon host", () => {
    expect(matchesVendorBeacon("meta", "https://www.google-analytics.com/g/collect?v=2")).toBe(false);
  });

  it("the OLD runtime-loader pattern (rig/lh-r010.mjs's *connect.facebook.net*) does not match the /tr beacon host — the documented gap this slice closes", () => {
    // Copied literal, NOT imported: rig/lh-r010.mjs calls process.exit(2) at import time when
    // REFERENCE_URL is unset, so importing it here would kill the test process.
    const OLD_LOADER_PATTERN = "*connect.facebook.net*";
    const frags = OLD_LOADER_PATTERN.split("*").filter(Boolean);
    expect(frags.every((f) => META_TR_ENDPOINT.includes(f))).toBe(false);
  });
});

describe("redaction — real-shaped fixture, no live-identifier shapes survive (AC1)", () => {
  it("redacts the pixel id, _fbp, fbc, and every ud[...] hashed-match field to a synthetic placeholder", () => {
    const raw = {
      // A fabricated LIVE-LOOKING test double, inline only — never written to disk, never committed.
      id: "918273645102938",
      ev: "Lead",
      "cd[value]": "25",
      _fbp: "fb.1.1690000012345.9988776655",
      fbc: "fb.1.1690000012345.AbCdEfGhIjKlMnOpQrSt",
      "ud[em]": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d",
      rdp: "0",
    };
    const redacted = redactMetaBeacon(raw);

    expect(redacted.id).toBe(SYNTHETIC_META_PIXEL_ID);
    expect(redacted._fbp).toBe(SYNTHETIC_FBP);
    expect(redacted.fbc).toBe(SYNTHETIC_FBC);
    expect(redacted["ud[em]"]).toBe(SYNTHETIC_HASH);
    // non-identifier fields carry through unchanged — redaction targets identity only.
    expect(redacted.ev).toBe("Lead");
    expect(redacted["cd[value]"]).toBe("25");
    expect(redacted.rdp).toBe("0");

    // Belt-and-suspenders leak check (mirrors rig/alloy-live-fanout.mjs's own): none of the raw
    // identifier-bearing values survive anywhere in the redacted output.
    const redactedStr = JSON.stringify(redacted);
    for (const rawValue of [raw.id, raw._fbp, raw.fbc, raw["ud[em]"]]) {
      expect(redactedStr.includes(rawValue)).toBe(false);
    }
  });

  it("scrubs a live fbclid out of the dl/dr URLs — fbc is DERIVED from fbclid, so redacting fbc alone would leak it (craft-review 2026-09-08)", () => {
    const raw = {
      id: "918273645102938",
      ev: "PageView",
      dl: "https://shop.example.com/checkout?utm_source=fb&fbclid=IwAR-LIVE-CLICK-ID-abc123&ref=x",
      dr: "https://l.facebook.com/l.php?u=https%3A%2F%2Fshop.example.com&fbclid=OTHER-LIVE-ID",
    };
    const redacted = redactMetaBeacon(raw);
    expect(redacted.dl).not.toContain("IwAR-LIVE-CLICK-ID-abc123");
    expect(redacted.dl).toContain("fbclid=SYNTHETIC-FBCLID-0000");
    // non-identifier params + the URL shape are preserved
    expect(redacted.dl).toContain("utm_source=fb");
    expect(redacted.dl).toContain("ref=x");
    expect(redacted.dr).not.toContain("OTHER-LIVE-ID");
  });

  it("the COMMITTED fixture carries only synthetic identifier values — no live-identifier shapes", () => {
    const cf = fixture.container_fields;
    expect(cf.id).toBe(SYNTHETIC_META_PIXEL_ID);
    expect(cf._fbp).toBe(SYNTHETIC_FBP);
    expect(cf.fbc).toBe(SYNTHETIC_FBC);
    expect(cf["ud[em]"]).toBe(SYNTHETIC_HASH);
    expect(cf["ud[ph]"]).toBe(SYNTHETIC_HASH);
  });
});

describe("oracle input contract — the airlock field-set is substitutable (AC2)", () => {
  it("the REPLAY path: createPixelConnector(metaConfig).handle(evt)[0], parsed, is a valid airlock field-set", () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID });
    const { emitted, fields } = replayPixelBeacon(config, metaParityDescriptor.deriveLogicalEvent(fixture.container_fields));
    expect(emitted).toBe(true); // the REAL replay result, not a hardcoded literal (compliance-review tidy)
    expect(fields.id).toBe(SYNTHETIC_META_PIXEL_ID);
    expect(fields.ev).toBe("Lead");
    expect(fields.value).toBe("25");
    expect(fields.currency).toBe("USD");
  });

  it("an unmapped logical event replays to [] -> emitted:false, a REPORTABLE result, never a throw", () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID });
    const { emitted, fields } = replayPixelBeacon(config, { type: "add_to_cart", params: {} });
    expect(emitted).toBe(false);
    expect(fields).toEqual({});
  });

  it("the SUPPLIED path: the oracle accepts a hand-built airlock field-set with no replay call at all", () => {
    const { verdict } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: { id: SYNTHETIC_META_PIXEL_ID, ev: "Lead" }, // hand-built, no createPixelConnector anywhere
    });
    expect(verdict).toBe("pass"); // every other container field on this fixture is a gap-map member
  });
});

describe("AC4 — two-way regression guard: three keystone fixtures", () => {
  it("(a) the real-shaped Meta fixture through REAL replay: green — every drop is an owned gap", () => {
    const replayed = replayFixtureFields();
    const { verdict, fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: replayed,
    });
    expect(verdict).toBe("pass");
    const owned = ["cd[value]", "cd[currency]", "cd[content_name]", "cd[content_category]", "_fbp", "fbc", "ud[em]", "ud[ph]"];
    for (const f of owned) {
      const entry = fields.find((x) => x.field === f);
      expect(entry).toBeTruthy();
      expect(entry.bucket).toBe("expected-dropped");
      expect(entry.owner).toBeTruthy();
    }
    // id/ev genuinely map today — the healthy baseline this guard protects.
    expect(fields.find((x) => x.field === "id").bucket).toBe("maps");
    expect(fields.find((x) => x.field === "ev").bucket).toBe("maps");
  });

  it("(b) an UN-OWNED drop (id missing from airlock's side) is a regression: red, not drowned under the owned gaps", () => {
    const replayed = replayFixtureFields();
    const regressed = { ...replayed };
    delete regressed.id;
    const { verdict, fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: regressed,
    });
    expect(verdict).toBe("fail");
    const idEntry = fields.find((x) => x.field === "id");
    expect(idEntry.bucket).toBe("dropped");
    expect(idEntry.owner).toBeUndefined();
    // the guard did NOT drown the regression — the owned gaps are still separately, correctly green.
    expect(fields.filter((x) => x.bucket === "expected-dropped").length).toBeGreaterThan(0);
  });

  it("(c) a SUPPLIED owners-landed field-set carrying _fbp/fbc: those classify gap-closed, still green overall", () => {
    const replayed = replayFixtureFields();
    const ownersLanded = { ...replayed, _fbp: fixture.container_fields._fbp, fbc: fixture.container_fields.fbc };
    const { verdict, fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: ownersLanded,
    });
    expect(verdict).toBe("pass");
    const fbp = fields.find((x) => x.field === "_fbp");
    expect(fbp.bucket).toBe("gap-closed");
    expect(fbp.flag).toMatch(/owner landed/i);
    const fbc = fields.find((x) => x.field === "fbc");
    expect(fbc.bucket).toBe("gap-closed");
    // the still-unowned-by-anything-else gaps (ud[...] / cd[...]) remain expected-dropped, unaffected.
    expect(fields.find((x) => x.field === "ud[em]").bucket).toBe("expected-dropped");
  });
});

describe("a divergent-value fixture — present on both sides but unequal -> red", () => {
  it("flags a value mismatch as divergent, never silently accepted as a pass", () => {
    const replayed = replayFixtureFields();
    const diverged = { ...replayed, ev: "PageView" }; // the container fixture sent Lead
    const { verdict, fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: diverged,
    });
    expect(verdict).toBe("fail");
    expect(fields.find((x) => x.field === "ev")).toEqual({
      field: "ev",
      bucket: "divergent",
      containerValue: "Lead",
      airlockValue: "PageView",
    });
  });
});

describe("AC5 — the JSON report (mirrors rig/lh-r010.mjs's shape)", () => {
  it("names every field's bucket, and no live identifiers appear anywhere in the report", () => {
    const airlockFields = replayFixtureFields();
    const report = buildParityReport({
      descriptor: metaParityDescriptor,
      fixture: FIXTURE_PATH,
      containerFields: fixture.container_fields,
      airlockFields,
      emitted: true,
    });
    expect(report.verdict).toBe("pass");
    expect(report.vendor).toBe("meta");
    expect(Array.isArray(report.fields)).toBe(true);
    const buckets = new Set(report.fields.map((f) => f.bucket));
    expect(buckets.has("maps")).toBe(true);
    expect(buckets.has("expected-dropped")).toBe(true);
    expect(buckets.has("normalised-out")).toBe(true);

    // no live-shaped 15-digit, non-all-zero Meta pixel id anywhere in the rendered report.
    const reportStr = JSON.stringify(report);
    expect(reportStr).not.toMatch(/[1-9]\d{14}/);
  });

  it("verdictExitCode: 0 for a pass, 1 for anything else", () => {
    expect(verdictExitCode({ verdict: "pass" })).toBe(0);
    expect(verdictExitCode({ verdict: "fail" })).toBe(1);
  });
});

describe("AC6 — `npm run parity:meta`: one command, exits non-zero only on a real regression", () => {
  it("running the CLI against the shipped fixture prints a passing JSON verdict and exits 0", () => {
    const out = execFileSync("node", [CLI_PATH], { encoding: "utf8" });
    const report = JSON.parse(out);
    expect(report.verdict).toBe("pass");
    expect(report.vendor).toBe("meta");
  });

  it("exits non-zero end-to-end on a real un-owned drop (an event type airlock's connector does not map) — no code changes needed to prove it", () => {
    const dir = mkdtempSync(join(tmpdir(), "parity-meta-"));
    const badFixturePath = join(dir, "bad.json");
    try {
      const bad = JSON.parse(JSON.stringify(fixture));
      bad.container_fields.ev = "Purchase"; // meta.js's eventMap only has PageView/Lead -> airlock emits []
      writeFileSync(badFixturePath, JSON.stringify(bad));

      let threw = false;
      try {
        execFileSync("node", [CLI_PATH], { encoding: "utf8", env: { ...process.env, PARITY_META_FIXTURE: badFixturePath } });
      } catch (err) {
        threw = true;
        expect(err.status).toBe(1);
        const report = JSON.parse(err.stdout);
        expect(report.verdict).toBe("fail");
        const idEntry = report.fields.find((f) => f.field === "id");
        expect(idEntry.bucket).toBe("dropped"); // un-owned — id is never in the gap map
      }
      expect(threw).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
