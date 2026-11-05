import { mkdtempSync, mkdirSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("independent Google local command witness", () => {
  it("rejects unknown case controls before starting any child", async () => {
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    await expect(witnessLocalGoogleQualification({ protocol: "h1", control: "native", outputDir: "/invalid" }))
      .rejects.toThrow("invalid_google_witness");
  });

  it("rejects an existing output directory before starting a child or reading stale evidence", async () => {
    const root = mkdtempSync(join(tmpdir(), "google-witness-"));
    const outputDir = join(root, "case");
    mkdirSync(outputDir);
    try {
      const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
      await expect(witnessLocalGoogleQualification({ protocol: "h1", control: "abort", outputDir }))
        .rejects.toThrow("google_witness_output_exists");
    } finally {
      rmdirSync(outputDir);
      rmdirSync(root);
    }
  });
});
