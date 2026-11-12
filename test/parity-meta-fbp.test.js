import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metaParityDescriptor } from "../rig/parity/descriptors/meta.js";
import { diffParity } from "../rig/parity/oracle.js";
import { redactMetaBeacon, SYNTHETIC_FBC, SYNTHETIC_FBP, SYNTHETIC_HASH } from "../rig/parity/redact.js";
import { buildParityReport, verdictExitCode } from "../rig/parity/report.js";
import { buildTransportLedger } from "../rig/parity/transport-report.js";

const reference = JSON.parse(readFileSync(
  new URL("./fixtures/meta-tr-pageview.redacted.json", import.meta.url), "utf8",
)).beacons[0];

describe("Meta observed identity wire fields", () => {
  it("redacts both fbp and the legacy cookie-name field without renaming either", () => {
    const raw = { fbp: "synthetic-wire-identity", _fbp: "synthetic-cookie-identity", ev: "PageView" };
    const redacted = redactMetaBeacon(raw);
    expect(redacted).toEqual({ fbp: SYNTHETIC_FBP, _fbp: SYNTHETIC_FBP, ev: "PageView" });
    expect(JSON.stringify(redacted)).not.toContain("synthetic-wire-identity");
    expect(JSON.stringify(redacted)).not.toContain("synthetic-cookie-identity");
    expect(redactMetaBeacon({ ev: "PageView" })).toEqual({ ev: "PageView" });
  });

  it("redacts all observed matching-identity namespaces", () => {
    const raw = {
      "ud[external_id]": "synthetic-ud-identity",
      "aud[external_id]": "synthetic-aud-identity",
      "cud[external_id]": "synthetic-cud-identity",
      "ncud[external_id]": "synthetic-ncud-identity",
      ev: "PageView",
    };
    const redacted = redactMetaBeacon(raw);
    for (const [key, value] of Object.entries(raw)) {
      if (key === "ev") continue;
      expect(redacted[key]).not.toBe(value);
      expect(JSON.stringify(redacted)).not.toContain(value);
    }
    expect(Object.keys(redacted)).toEqual(Object.keys(raw));
    expect(redacted["ud[external_id]"]).toBe(SYNTHETIC_HASH);
    expect(redacted["aud[external_id]"]).toBe(SYNTHETIC_HASH);
    expect(redacted["cud[external_id]"]).toBe("SYNTHETIC-MASKED-IDENTITY");
    expect(redacted["ncud[external_id]"]).toBe("SYNTHETIC-MASKED-IDENTITY");
    expect(redacted.ev).toBe("PageView");
  });

  it("classifies fbp from the capture without treating _fbp as its wire alias", () => {
    const containerFields = redactMetaBeacon(reference);
    const result = diffParity({
      descriptor: metaParityDescriptor,
      containerFields,
      airlockFields: { _fbp: containerFields.fbp },
    });
    expect(result.fields.find((field) => field.field === "fbp")).toMatchObject({
      bucket: "expected-dropped",
      owner: "chamber cookie-capability follow-up",
    });
    expect(metaParityDescriptor.wireNameMap.fbp).toBeUndefined();
    const reverse = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: { _fbp: SYNTHETIC_FBP },
      airlockFields: { fbp: SYNTHETIC_FBP },
    });
    expect(reverse.fields.find((field) => field.field === "_fbp")).toMatchObject({
      bucket: "expected-dropped",
    });
  });

  it("does not claim that matching or mixed redaction placeholders close an identity gap", () => {
    for (const [field, marker] of [
      ["fbp", SYNTHETIC_FBP], ["_fbp", SYNTHETIC_FBP],
      ["fbc", SYNTHETIC_FBC], ["fbp", "REDACTED_FBP"],
    ]) {
      for (const candidate of [marker, "fb.1.123.synthetic-other"]) {
        const result = diffParity({
          descriptor: metaParityDescriptor,
          containerFields: { [field]: marker },
          airlockFields: { [field]: candidate },
        });
        expect(result.verdict).toBe("inconclusive");
        expect(result.fields[0].bucket).toBe("unverifiable");
        expect(result.fields[0].flag).not.toMatch(/owner landed/i);
      }
    }
    const report = buildParityReport({
      descriptor: metaParityDescriptor,
      containerFields: { fbp: SYNTHETIC_FBP },
      airlockFields: { fbp: SYNTHETIC_FBP },
    });
    expect(report.verdict).toBe("inconclusive");
    expect(verdictExitCode(report)).toBe(1);
  });

  it("treats native-comparison redaction markers on either side as unverifiable", () => {
    const markers = [
      "[REDACTED]", "<redacted>", "redacted", "REDACTED-FBP", "***", "[removed]", "[masked]", "fb.1.[MASKED]",
    ];
    for (const field of ["fbp", "_fbp", "fbc"]) {
      for (const marker of markers) {
        for (const [containerValue, candidateValue] of [
          [marker, marker],
          [marker, "fb.1.123.synthetic-real"],
          ["fb.1.123.synthetic-real", marker],
        ]) {
          const result = diffParity({
            descriptor: metaParityDescriptor,
            containerFields: { [field]: containerValue },
            airlockFields: { [field]: candidateValue },
          });
          expect(result.verdict).toBe("inconclusive");
          expect(result.fields[0].bucket).toBe("unverifiable");
          expect(result.fields[0].flag).not.toMatch(/owner landed/i);
        }
      }
    }
  });

  it("reports a real regression even when another identity field is unverifiable", () => {
    const result = diffParity({
      descriptor: metaParityDescriptor,
      containerFields: { fbp: SYNTHETIC_FBP, ev: "PageView" },
      airlockFields: { fbp: SYNTHETIC_FBP, ev: "Lead" },
    });
    expect(result.verdict).toBe("fail");
    expect(result.fields.find((field) => field.field === "fbp").bucket).toBe("unverifiable");
    expect(result.fields.find((field) => field.field === "ev").bucket).toBe("divergent");
  });

  it("redacts report values while retaining comparisons of the original values", () => {
    const containerFields = { fbp: "synthetic-container-identity", id: "synthetic-container-pixel" };
    const airlockFields = { fbp: "synthetic-candidate-identity", id: "synthetic-candidate-pixel" };
    const report = buildParityReport({
      descriptor: metaParityDescriptor, containerFields, airlockFields, emitted: true,
    });
    expect(report.verdict).toBe("fail");
    expect(report.fields.find((field) => field.field === "fbp").bucket).toBe("divergent");
    for (const value of [...Object.values(containerFields), ...Object.values(airlockFields)]) {
      expect(JSON.stringify(report)).not.toContain(value);
    }
    const dropped = buildParityReport({
      descriptor: metaParityDescriptor, containerFields, airlockFields: {},
    });
    expect(dropped.fields.find((field) => field.field === "fbp").bucket).toBe("expected-dropped");
    expect(JSON.stringify(dropped)).not.toContain(containerFields.fbp);
  });

  it("recognizes concrete equal cookie identities without exposing them in reports", () => {
    for (const field of ["fbp", "_fbp", "fbc"]) {
      for (const value of ["fb.1.123.synthetic-concrete-identity", "fb.1.123.IwARredacted123"]) {
        const report = buildParityReport({
          descriptor: metaParityDescriptor,
          containerFields: { [field]: value },
          airlockFields: { [field]: value },
        });
        expect(report.verdict).toBe("pass");
        expect(report.fields[0].bucket).toBe("gap-closed");
        expect(JSON.stringify(report)).not.toContain(value);
        const mismatch = buildParityReport({
          descriptor: metaParityDescriptor,
          containerFields: { [field]: value },
          airlockFields: { [field]: `${value}-other` },
        });
        expect(mismatch.verdict).toBe("fail");
        expect(mismatch.fields[0].bucket).toBe("divergent");
        expect(JSON.stringify(mismatch)).not.toContain(value);
      }
    }
  });

  it("reports the observed fbp wire gap in both transport cohorts", () => {
    const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor] });
    for (const cohort of ["allowed", "blocked"]) {
      expect(ledger.vendors[0].cohorts[cohort].gaps).toContainEqual(
        expect.objectContaining({ name: "fbp", owner: "chamber cookie-capability follow-up" }),
      );
    }
  });
});
