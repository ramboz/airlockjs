// Spec 038-04 — confirm Meta advanced-matching (`ud[external_id]`) FIELD-PRESENCE parity,
// retiring the 026-04 "excused gap" framing. This slice does NOT claim same-input EFFICACY
// (that airlock hashed the SAME external_id the container did) — see docs/refinement-todo.md's
// "ud[external_id] same-input efficacy" entry (AC7) and the slice doc's Assumption A4. It
// confirms PRESENCE: a well-formed ud[external_id] lands wherever the container's does.
//
// TWO FIXTURES, NOT INTERCHANGEABLE (frame-critique fold 1):
//  - test/fixtures/meta-tr-pageview.redacted.json — the REAL capture (a `beacons[]` array), used
//    HERE for the ud[external_id] confirmation. Its ud[external_id] placeholder is the literal
//    string "REDACTED_SHA256" — NOT redact.js's 64-zero SYNTHETIC_HASH.
//  - test/fixtures/parity-meta-tr.redacted.json — the SYNTHETIC fixture (test/parity-meta.test.js's
//    existing 038-01 fixture, flat field map, ud[em]/ph = SYNTHETIC_HASH) — stays the id/_fbp/fbc
//    RAW-DIFF regression guard there; reused HERE only for the AC3/AC6 ud[em]/ud[ph] re-own
//    witnesses, which need a container that actually SENDS ud[em]/ud[ph] (the real capture is an
//    anonymous visit and sends neither — see its own _findings.advanced_matching).
//
// Because the two ud[external_id] placeholders differ, `maps` classification depends on
// re-redacting BOTH beacons through redactMetaBeacon AT DIFF-TIME (its /^ud\[/ rule maps either
// placeholder + airlock's real hash to the shared SYNTHETIC_HASH sentinel) — redacting only one
// side would diverge and fail (A1/A2).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createMetaPixelConfig, SYNTHETIC_META_PIXEL_ID } from "../connectors/pixel/vendors/meta.js";
import { createPixelConnector } from "../connectors/pixel/connector.js";
import { hashField, mergeAdvancedMatching } from "../connectors/pixel/advanced-matching.js";
import { metaParityDescriptor } from "../rig/parity/descriptors/meta.js";
import { diffParity } from "../rig/parity/oracle.js";
import { fieldsFromUrl, replayPixelBeacon } from "../rig/parity/replay.js";
import { redactMetaBeacon, SYNTHETIC_HASH } from "../rig/parity/redact.js";
import { buildParityReport, verdictExitCode } from "../rig/parity/report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_FIXTURE_PATH = join(HERE, "fixtures/meta-tr-pageview.redacted.json");
const SYNTHETIC_FIXTURE_PATH = join(HERE, "fixtures/parity-meta-tr.redacted.json");
const realFixture = JSON.parse(readFileSync(REAL_FIXTURE_PATH, "utf8"));
const syntheticFixture = JSON.parse(readFileSync(SYNTHETIC_FIXTURE_PATH, "utf8"));

// The "initial page load" variant — the beacon this slice's DoR cites (cd[region]=us,
// ud[external_id] present, no ud[em]/ud[ph] — an anonymous visit).
const CONTAINER_BEACON = realFixture.beacons[0];

// A clearly-synthetic, GUID-SHAPED external_id — fabricated inline for this test only, never a
// real identifier (mirrors test/pixel-advanced-matching.test.js's own AC7 synthetic-GUID
// convention). Only its HASH ever appears below, and only shape-asserted (SECURITY — never
// assert/print the literal hash value).
const FAKE_EXTERNAL_ID = "11111111-1111-4111-8111-038040000000";
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Replays a Meta config through the REAL wire-shape path (`handle()`) PLUS the same chamber-side
 * advanced-matching merge `core/airlock.js` performs (026-04, `core/airlock.js:206-247`) —
 * `handle()` itself never reads `config.advancedMatching` (identity-free by construction, spec
 * 026-01 AC1); the merge is a separate production step, so a faithful replay needs it too. Reuses
 * connectors/pixel/advanced-matching.js's OWN pure `hashField`/`mergeAdvancedMatching` — no
 * hashing/merge logic is reinvented here. Async because `hashField` is (WebCrypto digest).
 * @returns {Promise<Record<string,string>>} airlock's RAW (unredacted) beacon field-set.
 */
async function replayWithAdvancedMatching(config, logicalEvent) {
  const { advancedMatching, ...rest } = config;
  const requests = createPixelConnector(rest).handle(logicalEvent);
  if (!requests.length) return {};
  let merged = requests;
  if (advancedMatching) {
    const udHashes = {};
    for (const [field, rawValue] of Object.entries(advancedMatching)) {
      const hex = await hashField(field, rawValue);
      if (hex !== undefined) udHashes[field] = hex;
    }
    merged = mergeAdvancedMatching(requests, udHashes);
  }
  return fieldsFromUrl(merged[0].url);
}

describe("AC1 + AC5(a) — ud[external_id] confirmed `maps` via redact-both-sides (real capture)", () => {
  it("POSITIVE: an externalId-bearing replay + the real container beacon both redact to the shared sentinel -> pass, ud[external_id] maps", async () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID, externalId: FAKE_EXTERNAL_ID });
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(CONTAINER_BEACON);
    const rawAirlockFields = await replayWithAdvancedMatching(config, logicalEvent);

    const redactedContainer = redactMetaBeacon(CONTAINER_BEACON);
    const redactedAirlock = redactMetaBeacon(rawAirlockFields);

    const { verdict, fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: redactedContainer,
      airlockFields: redactedAirlock,
    });

    expect(verdict).toBe("pass");
    const entry = fields.find((f) => f.field === "ud[external_id]");
    expect(entry.bucket).toBe("maps");
    // both sides collapsed to the SAME sentinel (not a coincidental equal value) — the mechanism
    // AC1/A1 describe, made a direct witness.
    expect(entry.containerValue).toBe(SYNTHETIC_HASH);
    expect(entry.airlockValue).toBe(SYNTHETIC_HASH);
    // no advanced-matching field dropped — the guard is a real pass, not a false one.
    expect(fields.filter((f) => f.bucket === "dropped")).toHaveLength(0);
    // the aud/cud/ncud[external_id] variants the real capture ALSO carries are never classified
    // at all (deliberately excluded from attributionFields — AC4) — not dropped, not maps.
    for (const variant of ["aud[external_id]", "cud[external_id]", "ncud[external_id]"]) {
      expect(fields.find((f) => f.field === variant)).toBeUndefined();
    }
  });

  it("AC2 — airlock's RAW (pre-redaction) ud[external_id] is a well-formed 64-lowercase-hex SHA-256", async () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID, externalId: FAKE_EXTERNAL_ID });
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(CONTAINER_BEACON);
    const rawAirlockFields = await replayWithAdvancedMatching(config, logicalEvent);

    // shape only — never assert/print the literal hash value (SECURITY).
    expect(rawAirlockFields["ud[external_id]"]).toMatch(SHA256_HEX);
    expect(rawAirlockFields["ud[external_id]"]).toHaveLength(64);
  });

  it("ud[external_id] is NOT a gapMap member (confirmed, not owned)", () => {
    expect(metaParityDescriptor.attributionFields).toContain("ud[external_id]");
    expect(Object.prototype.hasOwnProperty.call(metaParityDescriptor.gapMap, "ud[external_id]")).toBe(false);
  });
});

describe("AC5(b) — NEGATIVE witness: no externalId -> ud[external_id] dropped -> fail (the guard is not vacuous)", () => {
  it("a config with no externalId replays with no ud[external_id] at all; the container's is un-owned -> dropped -> fail", async () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID }); // no externalId
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(CONTAINER_BEACON);
    const rawAirlockFields = await replayWithAdvancedMatching(config, logicalEvent);
    expect(rawAirlockFields["ud[external_id]"]).toBeUndefined();
    // base beacon still emits (isolates "ud[external_id] specifically dropped" from "airlock
    // emitted nothing at all" — craft-review hardening, 038-04 reconciliation)
    expect(rawAirlockFields.ev).toBe("PageView");

    const redactedContainer = redactMetaBeacon(CONTAINER_BEACON);
    const redactedAirlock = redactMetaBeacon(rawAirlockFields);

    const { verdict, fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: redactedContainer,
      airlockFields: redactedAirlock,
    });

    expect(verdict).toBe("fail");
    const entry = fields.find((f) => f.field === "ud[external_id]");
    expect(entry.bucket).toBe("dropped");
    expect(entry.owner).toBeUndefined();
  });
});

describe("AC3 — ud[em]/ud[ph] re-owned to a capture-gated owner, never falsely mapped", () => {
  it("gapMap owner is no longer '026-04' — re-owned to a capture-gated, signed-in-capture follow-up", () => {
    expect(metaParityDescriptor.gapMap["ud[em]"].owner).not.toBe("026-04");
    expect(metaParityDescriptor.gapMap["ud[ph]"].owner).not.toBe("026-04");
    expect(metaParityDescriptor.gapMap["ud[em]"].owner).toMatch(/signed-in/i);
    expect(metaParityDescriptor.gapMap["ud[ph]"].owner).toMatch(/signed-in/i);
  });

  it("ud[em]/ud[ph] still classify expected-dropped (green), never maps — 026-04 shipped the capability but replay has no path to feed them (setIdentity, capture-gated)", () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID }); // no em/ph knob exists on the factory at all
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(syntheticFixture.container_fields);
    const { fields: airlockFields } = replayPixelBeacon(config, logicalEvent);

    const { fields } = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: syntheticFixture.container_fields,
      airlockFields,
    });

    for (const field of ["ud[em]", "ud[ph]"]) {
      const entry = fields.find((f) => f.field === field);
      expect(entry.bucket).toBe("expected-dropped");
      expect(entry.owner).toMatch(/signed-in/i);
    }
  });
});

describe("AC4 — _fbp/fbc unchanged; aud/cud/ncud[external_id] variants excluded", () => {
  it("_fbp/fbc gapMap entries are byte-unchanged (still owned by the chamber cookie-capability follow-up)", () => {
    expect(metaParityDescriptor.gapMap._fbp).toEqual({ owner: "chamber cookie-capability follow-up" });
    expect(metaParityDescriptor.gapMap.fbc).toEqual({ owner: "chamber cookie-capability follow-up" });
  });

  it("the aud/cud/ncud[external_id] variant namespaces are excluded from attributionFields (alternate encodings, not distinct attribution, airlock emits none of them)", () => {
    // grounded against the real capture, which DOES carry all three variants alongside ud[external_id].
    expect(CONTAINER_BEACON["aud[external_id]"]).toBeDefined();
    expect(CONTAINER_BEACON["cud[external_id]"]).toBeDefined();
    expect(CONTAINER_BEACON["ncud[external_id]"]).toBeDefined();
    for (const variant of ["aud[external_id]", "cud[external_id]", "ncud[external_id]"]) {
      expect(metaParityDescriptor.attributionFields).not.toContain(variant);
    }
  });
});

describe("AC6 — the report reflects the confirmed classification, with updated owners, no dangling gap-closed", () => {
  it("real-capture report: ud[external_id] renders maps; the still-owned gaps carry the (updated) owners; verdict/exit-code contract holds", async () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID, externalId: FAKE_EXTERNAL_ID });
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(CONTAINER_BEACON);
    const rawAirlockFields = await replayWithAdvancedMatching(config, logicalEvent);

    const report = buildParityReport({
      descriptor: metaParityDescriptor,
      fixture: REAL_FIXTURE_PATH,
      containerFields: redactMetaBeacon(CONTAINER_BEACON),
      airlockFields: redactMetaBeacon(rawAirlockFields),
      emitted: true,
    });

    expect(report.verdict).toBe("pass");
    expect(verdictExitCode(report)).toBe(0);
    expect(report.fields.find((f) => f.field === "ud[external_id]").bucket).toBe("maps");
    // gap_map is descriptor.gapMap echoed verbatim — carries the (updated) em/ph owner + the
    // byte-unchanged _fbp/fbc owner, regardless of which fields this particular capture sent.
    expect(report.gap_map["ud[em]"].owner).toMatch(/signed-in/i);
    expect(report.gap_map["ud[ph]"].owner).toMatch(/signed-in/i);
    expect(report.gap_map._fbp.owner).toBe("chamber cookie-capability follow-up");
    expect(report.gap_map.fbc.owner).toBe("chamber cookie-capability follow-up");
    // no field is left dangling with a gap-closed flag (nothing newly "landed" in this report).
    expect(report.fields.some((f) => f.bucket === "gap-closed")).toBe(false);
  });

  it("synthetic-fixture report: ud[em]/ud[ph] render expected-dropped with the updated owner", () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID });
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(syntheticFixture.container_fields);
    const { emitted, fields: airlockFields } = replayPixelBeacon(config, logicalEvent);

    const report = buildParityReport({
      descriptor: metaParityDescriptor,
      fixture: SYNTHETIC_FIXTURE_PATH,
      containerFields: syntheticFixture.container_fields,
      airlockFields,
      emitted,
    });

    expect(report.verdict).toBe("pass");
    expect(verdictExitCode(report)).toBe(0);
    for (const field of ["ud[em]", "ud[ph]"]) {
      const entry = report.fields.find((f) => f.field === field);
      expect(entry.bucket).toBe("expected-dropped");
      expect(entry.owner).toMatch(/signed-in/i);
    }
  });

  it("report-level negative: no externalId against the real capture -> fail, exit code 1", async () => {
    const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID });
    const logicalEvent = metaParityDescriptor.deriveLogicalEvent(CONTAINER_BEACON);
    const rawAirlockFields = await replayWithAdvancedMatching(config, logicalEvent);

    const report = buildParityReport({
      descriptor: metaParityDescriptor,
      fixture: REAL_FIXTURE_PATH,
      containerFields: redactMetaBeacon(CONTAINER_BEACON),
      airlockFields: redactMetaBeacon(rawAirlockFields),
      emitted: true,
    });

    expect(report.verdict).toBe("fail");
    expect(verdictExitCode(report)).toBe(1);
  });
});
