import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it.runIf(process.platform === "darwin")("validates real owned loopback descriptors", () => {
  const source = fileURLToPath(new URL("./inspected-google-guard-descriptor-fixture.c", import.meta.url));
  const binary = resolve("rig", `.google-guard-descriptor-${randomBytes(16).toString("hex")}`);
  try {
    execFileSync("/usr/bin/clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", source, "-o", binary]);
    const result = spawnSync(binary, [], { encoding: "utf8", timeout: 8000 });
    console.log(result.stdout);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    for (const name of ["nonsharing-listener", "blocking-listener", "bound-unlistening", "wrong-type", "wrong-address-unbound",
      "wrong-port", "sharing-listener"]) {
      expect(result.stdout).toMatch(new RegExp(`case=${name} .* accepted=${name === "nonsharing-listener" ? 1 : 0} expected=`));
    }
    expect(result.stdout).toMatch(/case=wrong-family (actual=::1 listening=1 accepted=0 expected=0|skip_errno=(47|49|43))/);
    expect(result.stdout).toMatch(/case=connected accepted=0 expected=0 flags_unchanged=1/);
    expect(result.stdout).toMatch(/case=queued-listener accepted=1 expected=1 flags_unchanged=1 queued_rejected=1/);
    expect(result.stdout).toMatch(/case=service-reject accepted=1 expected=1 flags_unchanged=1 queued_rejected=1/);
    expect(result.stdout).toMatch(/case=later-service-reject empty_before=1 waited_empty_ms=150 client_after_wait=1 rejected=1 service_exit=0 flags_unchanged=1 child_pid=\d+ child_reaped=1/);
  } finally {
    if (existsSync(binary)) unlinkSync(binary);
  }
}, 12000);
