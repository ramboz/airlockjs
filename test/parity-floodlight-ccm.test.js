// Floodlight (DC) ccm/collect parity — spec 046-01 AC4. The connector's replayed ccm/collect beacon
// classifies a MATCH under the 038 same-protocol oracle (rig/parity/oracle.js diffParity) against a
// committed, REDACTED, real-shaped DC capture; the floodlight-ccm redactor
// (rig/parity/redact-floodlight-ccm.js) leaves no live identifier in the committed fixture
// (CLAUDE.md security-MUST / ADR-0018 R5).
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { diffParity } from "../rig/parity/oracle.js";
import { floodlightCcmParityDescriptor } from "../rig/parity/descriptors/floodlight-ccm.js";
import { replayFloodlightCcmEgress } from "../rig/parity/floodlight-ccm-replay.js";
import {
  redactFloodlightCcmBeacon,
  SYNTHETIC_DC_CONVERSION_ID,
  SYNTHETIC_AUID,
} from "../rig/parity/redact-floodlight-ccm.js";
import { parseGclAuId } from "../connectors/google-ads/cookies.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures/parity-floodlight-ccm.redacted.json");
const CLI_PATH = join(HERE, "../rig/parity/run-floodlight-ccm.mjs");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

describe("Floodlight ccm/collect redaction — real-shaped fixture, no live-identifier shapes survive (AC4 / R5)", () => {
  it("redacts auid + the DC-id (tid/tids); carries non-identifier fields through", () => {
    const raw = {
      // A fabricated LIVE-LOOKING test double, inline only — never written to disk, never committed.
      tid: "DC-2233445566",
      tids: "DC-2233445566",
      en: "page_view",
      auid: "9988776655.1610000000",
      dl: "https://shop.example.com/?gclid=IwAR-LIVE-CLICK-abc123&ref=x",
      gcs: "G111",
      gcd: "13r3r3r3r5l1",
      npa: "0",
    };
    const redacted = redactFloodlightCcmBeacon(raw);

    expect(redacted.tid).toBe(SYNTHETIC_DC_CONVERSION_ID);
    expect(redacted.tids).toBe(SYNTHETIC_DC_CONVERSION_ID);
    expect(redacted.auid).toBe(SYNTHETIC_AUID);
    expect(redacted.dl).not.toContain("IwAR-LIVE-CLICK-abc123");
    expect(redacted.dl).toContain("ref=x"); // non-identifier params + URL shape preserved
    // consent-mode strings + event name are not identifiers — carried through unchanged.
    expect(redacted.en).toBe("page_view");
    expect(redacted.gcs).toBe("G111");
    expect(redacted.gcd).toBe("13r3r3r3r5l1");
    expect(redacted.npa).toBe("0");

    // Belt-and-suspenders: none of the raw identifier-bearing values survive anywhere.
    const redactedStr = JSON.stringify(redacted);
    for (const rawValue of [raw.auid, "2233445566", "IwAR-LIVE-CLICK-abc123"]) {
      expect(redactedStr.includes(rawValue)).toBe(false);
    }
  });

  it("the COMMITTED fixture carries only synthetic identifier values — no live-identifier shapes (R5)", () => {
    const cf = fixture.container_fields;
    expect(cf.tid).toBe(SYNTHETIC_DC_CONVERSION_ID);
    expect(cf.auid).toBe(SYNTHETIC_AUID);
    // the airlock side must SOURCE auid from the fixture's own _gcl_au cookie (never the beacon's
    // auid field) — so the cookie parses back to the same synthetic auid (no back-feed, AC4).
    expect(parseGclAuId(fixture.cookies._gcl_au)).toBe(SYNTHETIC_AUID);

    // Every DC-id-shaped run (DC-<digits>) is all-zeros — never a live conversion id.
    const fixtureStr = readFileSync(FIXTURE_PATH, "utf8");
    for (const m of fixtureStr.match(/DC-\d+/g) || []) {
      expect(m.replace(/[^0-9]/g, "").replace(/0/g, "")).toBe("");
    }
    // Every auid-shaped run (<6+ digits>.<6+ digits>, the live auid shape) is all-zeros.
    for (const m of fixtureStr.match(/\d{6,}\.\d{6,}/g) || []) {
      expect(m.replace(/[0.]/g, "")).toBe("");
    }
  });
});

describe("Floodlight ccm/collect parity — the replayed beacon classifies a MATCH under the 038 oracle (AC4)", () => {
  it("every curated attribution field (tid/en/dl/dt/auid/gcs/gcd/npa) classifies `maps`; overall verdict is `pass`", () => {
    const { emitted, fields: airlockFields } = replayFloodlightCcmEgress({ fixture });
    expect(emitted).toBe(true);
    const { verdict, fields } = diffParity({
      descriptor: floodlightCcmParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("pass");
    for (const name of ["tid", "en", "dl", "dt", "auid", "gcs", "gcd", "npa"]) {
      expect(fields.find((f) => f.field === name)).toMatchObject({ bucket: "maps" });
    }
    // the gap map is empty for this slice — nothing expected-dropped, nothing dropped.
    expect(fields.every((f) => f.bucket !== "dropped" && f.bucket !== "expected-dropped")).toBe(true);
  });

  it("auid classifies `maps` because airlock SOURCED it from the shared _gcl_au cookie — not a beacon back-feed", () => {
    const { fields: airlockFields } = replayFloodlightCcmEgress({ fixture });
    expect(airlockFields.auid).toBe(SYNTHETIC_AUID);
    const { fields } = diffParity({
      descriptor: floodlightCcmParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "auid")).toMatchObject({
      bucket: "maps",
      containerValue: SYNTHETIC_AUID,
      airlockValue: SYNTHETIC_AUID,
    });
  });

  it("the noise fields (dma/rnd/rcb/tft/tfd/tids/fmt) classify `normalised-out`, never a false divergent", () => {
    const { fields: airlockFields } = replayFloodlightCcmEgress({ fixture });
    const { fields } = diffParity({
      descriptor: floodlightCcmParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    const normalised = new Set(fields.filter((f) => f.bucket === "normalised-out").map((f) => f.field));
    for (const name of ["dma", "rnd", "rcb", "tft", "tfd", "tids", "fmt"]) {
      expect(normalised.has(name)).toBe(true);
    }
  });

  it("an UN-OWNED drop (en missing from airlock's side) is a real regression — red, not swallowed", () => {
    const { fields: airlockFields } = replayFloodlightCcmEgress({ fixture });
    delete airlockFields.en;
    const { verdict, fields } = diffParity({
      descriptor: floodlightCcmParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("fail");
    expect(fields.find((f) => f.field === "en").bucket).toBe("dropped");
  });
});

describe("AC4 — `npm run parity:floodlight-ccm`: one command, exits 0 only on a match", () => {
  it("running the CLI against the shipped fixture prints a passing JSON verdict and exits 0", () => {
    const out = execFileSync("node", [CLI_PATH], { encoding: "utf8" });
    const report = JSON.parse(out);
    expect(report.verdict).toBe("pass");
    expect(report.vendor).toBe("floodlight-ccm");
  });

  it("exits non-zero end-to-end on a real un-owned drop (an event the connector does not map)", () => {
    const dir = mkdtempSync(join(tmpdir(), "parity-floodlight-ccm-"));
    const badFixturePath = join(dir, "bad.json");
    try {
      const bad = JSON.parse(JSON.stringify(fixture));
      bad.container_fields.en = "purchase"; // the connector only maps page_view -> airlock emits []
      writeFileSync(badFixturePath, JSON.stringify(bad));

      let threw = false;
      try {
        execFileSync("node", [CLI_PATH], {
          encoding: "utf8",
          env: { ...process.env, PARITY_FLOODLIGHT_CCM_FIXTURE: badFixturePath },
        });
      } catch (err) {
        threw = true;
        expect(err.status).toBe(1);
        const report = JSON.parse(err.stdout);
        expect(report.verdict).toBe("fail");
      }
      expect(threw).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
