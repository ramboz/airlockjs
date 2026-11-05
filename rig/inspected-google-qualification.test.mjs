import { describe, expect, it } from "vitest";

describe("SDK-free Google receiving qualification", () => {
  it("rejects unknown controls before any output or network is created", async () => {
    const { runLocalGoogleQualification } = await import("./inspected-google-qualification.mjs");
    await expect(runLocalGoogleQualification({ protocol: "h1", control: "native", outputDir: "/invalid" }))
      .rejects.toThrow("invalid_google_qualification");
  });
});
