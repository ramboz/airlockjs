import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it.runIf(process.platform === "darwin")("refuses a real sharing-enabled loopback listener", () => {
  const source = fileURLToPath(new URL("./inspected-google-guard-descriptor-fixture.c", import.meta.url));
  const binary = resolve("rig", `.google-guard-descriptor-${randomBytes(16).toString("hex")}`);
  try {
    execFileSync("/usr/bin/clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", source, "-o", binary]);
    const result = spawnSync(binary, [], { encoding: "utf8", timeout: 5000 });
    console.log(result.stdout);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/actual_reuseport=0 validator_reuseport=0 policy_accepted=1 expected=1/);
    expect(result.stdout).toMatch(/actual_reuseport=1 validator_reuseport=1 policy_accepted=0 expected=0/);
  } finally {
    if (existsSync(binary)) unlinkSync(binary);
  }
});
