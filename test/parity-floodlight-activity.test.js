// Floodlight (DC) ;-delimited `activity` parity — spec 046-02 AC3. The connector's replayed activity
// beacon classifies a MATCH under the 038 same-protocol oracle (rig/parity/oracle.js diffParity)
// against a committed, REDACTED, real-shaped DC capture — reached through a NEW ;-delimited path:
// the AW/039 `URL.searchParams` replay parser cannot flatten a path-matrix wire, so this path uses
// rig/parity/replay.js's `fieldsFromMatrixUrl` + the floodlight-activity redactor/descriptor.
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { diffParity } from "../rig/parity/oracle.js";
import { floodlightActivityParityDescriptor } from "../rig/parity/descriptors/floodlight-activity.js";
import { replayFloodlightActivityEgress } from "../rig/parity/floodlight-activity-replay.js";
import {
  redactFloodlightActivityBeacon,
  SYNTHETIC_DC_SRC,
  SYNTHETIC_DC_TYPE,
  SYNTHETIC_DC_CAT,
  SYNTHETIC_AUID,
  SYNTHETIC_DC_U20,
} from "../rig/parity/redact-floodlight-activity.js";
import { parseGclAuId } from "../connectors/google-ads/cookies.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures/parity-floodlight-activity.redacted.json");
const CLI_PATH = join(HERE, "../rig/parity/run-floodlight-activity.mjs");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

describe("Floodlight activity redaction — real-shaped fixture, no live-identifier shapes survive (AC3 / R5)", () => {
  it("redacts the identity (src/type/cat), auiddc, the visitor uuid u20; carries non-identifier fields through", () => {
    const raw = {
      // A fabricated LIVE-LOOKING test double, inline only — never written to disk, never committed.
      src: "7654321",
      type: "livegrp99",
      cat: "liveact99",
      ord: "1",
      num: "1727212800123",
      npa: "0",
      auiddc: "9988776655.1610000000",
      u20: "abcdef01-2345-6789-abcd-ef0123456789",
      gcs: "G111",
      gcd: "13r3r3r3r5l1",
      dma: "0",
    };
    const redacted = redactFloodlightActivityBeacon(raw);

    expect(redacted.src).toBe(SYNTHETIC_DC_SRC);
    expect(redacted.type).toBe(SYNTHETIC_DC_TYPE);
    expect(redacted.cat).toBe(SYNTHETIC_DC_CAT);
    expect(redacted.auiddc).toBe(SYNTHETIC_AUID);
    expect(redacted.u20).toBe(SYNTHETIC_DC_U20);
    // consent-mode strings + npa/dma are not identifiers — carried through unchanged.
    expect(redacted.gcs).toBe("G111");
    expect(redacted.gcd).toBe("13r3r3r3r5l1");
    expect(redacted.npa).toBe("0");
    expect(redacted.dma).toBe("0");

    // Belt-and-suspenders: none of the raw identifier-bearing values survive anywhere.
    const redactedStr = JSON.stringify(redacted);
    for (const rawValue of [raw.auiddc, raw.src, raw.type, raw.cat, raw.u20]) {
      expect(redactedStr.includes(rawValue)).toBe(false);
    }
  });

  it("the COMMITTED fixture carries only synthetic identifier values — no live-identifier shapes (R5)", () => {
    const cf = fixture.container_fields;
    expect(cf.src).toBe(SYNTHETIC_DC_SRC);
    expect(cf.auiddc).toBe(SYNTHETIC_AUID);
    // the airlock side SOURCES auiddc from the fixture's own _gcl_au cookie (never the beacon's own
    // auiddc field) — so the cookie parses back to the same synthetic value (no back-feed, AC3/§A4).
    expect(parseGclAuId(fixture.cookies._gcl_au)).toBe(SYNTHETIC_AUID);

    // Every auiddc-shaped run (<6+ digits>.<6+ digits>, the live _gcl_au shape) is all-zeros.
    const fixtureStr = readFileSync(FIXTURE_PATH, "utf8");
    for (const m of fixtureStr.match(/\d{6,}\.\d{6,}/g) || []) {
      expect(m.replace(/[0.]/g, "")).toBe("");
    }
  });
});

describe("Floodlight activity parity — the replayed ;-delimited beacon classifies a MATCH under the 038 oracle (AC3)", () => {
  it("the reproduced fields (src/type/cat/npa/gcs/gcd/auiddc) classify `maps`; overall verdict is `pass`", () => {
    const { emitted, fields: airlockFields } = replayFloodlightActivityEgress({ fixture });
    expect(emitted).toBe(true);
    const { verdict, fields } = diffParity({
      descriptor: floodlightActivityParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("pass");
    for (const name of ["src", "type", "cat", "npa", "gcs", "gcd", "auiddc"]) {
      expect(fields.find((f) => f.field === name)).toMatchObject({ bucket: "maps" });
    }
  });

  it("auiddc classifies `maps` because airlock SOURCED it from the shared _gcl_au cookie — not a beacon back-feed (§A4)", () => {
    const { fields: airlockFields } = replayFloodlightActivityEgress({ fixture });
    expect(airlockFields.auiddc).toBe(SYNTHETIC_AUID);
    const { fields } = diffParity({
      descriptor: floodlightActivityParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "auiddc")).toMatchObject({
      bucket: "maps",
      containerValue: SYNTHETIC_AUID,
      airlockValue: SYNTHETIC_AUID,
    });
  });

  it("the gap-owned protocol/custom fields (u10/u12/u99/em/user_data_mode/epver/dc_fmt) classify `expected-dropped` — named owned gaps, never a false pass", () => {
    const { fields: airlockFields } = replayFloodlightActivityEgress({ fixture });
    const { fields } = diffParity({
      descriptor: floodlightActivityParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    const expectedDropped = new Set(fields.filter((f) => f.bucket === "expected-dropped").map((f) => f.field));
    for (const name of ["u10", "u12", "u99", "em", "user_data_mode", "epver", "dc_fmt"]) {
      expect(expectedDropped.has(name)).toBe(true);
    }
    // each expected-dropped field is owned by a named artifact (ADR-0020 commitment 1).
    for (const f of fields.filter((x) => x.bucket === "expected-dropped")) {
      expect(typeof f.owner).toBe("string");
      expect(f.owner.length).toBeGreaterThan(0);
    }
  });

  it("the noise fields (num/ord/u20/~oref/dma) classify `normalised-out`, never a false divergent", () => {
    const { fields: airlockFields } = replayFloodlightActivityEgress({ fixture });
    const { fields } = diffParity({
      descriptor: floodlightActivityParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    const normalised = new Set(fields.filter((f) => f.bucket === "normalised-out").map((f) => f.field));
    for (const name of ["num", "ord", "u20", "~oref", "dma"]) {
      expect(normalised.has(name)).toBe(true);
    }
  });

  it("an UN-OWNED drop (src missing from airlock's side) is a real regression — red, not swallowed", () => {
    const { fields: airlockFields } = replayFloodlightActivityEgress({ fixture });
    delete airlockFields.src;
    const { verdict, fields } = diffParity({
      descriptor: floodlightActivityParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("fail");
    expect(fields.find((f) => f.field === "src").bucket).toBe("dropped");
  });
});

describe("AC3 — `npm run parity:floodlight-activity`: one command, exits 0 only on a match", () => {
  it("running the CLI against the shipped fixture prints a passing JSON verdict and exits 0", () => {
    const out = execFileSync("node", [CLI_PATH], { encoding: "utf8" });
    const report = JSON.parse(out);
    expect(report.verdict).toBe("pass");
    expect(report.vendor).toBe("floodlight-activity");
  });

  it("exits non-zero end-to-end on a real un-owned divergence (a src the connector would not reproduce)", () => {
    const dir = mkdtempSync(join(tmpdir(), "parity-floodlight-activity-"));
    const badFixturePath = join(dir, "bad.json");
    try {
      const bad = JSON.parse(JSON.stringify(fixture));
      bad.container_fields.src = "9999999"; // airlock replays the SYNTHETIC_DC_SRC -> src diverges
      writeFileSync(badFixturePath, JSON.stringify(bad));

      let threw = false;
      try {
        execFileSync("node", [CLI_PATH], {
          encoding: "utf8",
          env: { ...process.env, PARITY_FLOODLIGHT_ACTIVITY_FIXTURE: badFixturePath },
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
