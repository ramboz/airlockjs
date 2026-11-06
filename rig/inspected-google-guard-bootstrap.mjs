import { execFileSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { captureGoogleGuardEvidence, googleGuardPlist, prepareGoogleGuardParent, recordGoogleGuardCommandFailure,
  recordGoogleGuardCommandReturned, recordGoogleGuardInvocationAttempt } from "./inspected-google-guard-evidence.mjs";

if (process.platform !== "darwin" || process.env.AIRLOCK_GOOGLE_LAUNCHD_CONTROL !== "1" || process.argv.length !== 2) {
  console.error("unavailable: explicit AIRLOCK_GOOGLE_LAUNCHD_CONTROL=1 on macOS required");
  process.exit(2);
}

const id = randomBytes(16).toString("hex");
const directory = join(fileURLToPath(new URL("./out", import.meta.url)), `google-reject-${id}`);
const label = `org.airlock.google-reject.${id}`, domain = `user/${process.getuid()}`;
const port = randomInt(49152, 65536), binary = join(directory, "reject");
const plist = join(directory, "job.plist"), log = join(directory, "service.log");
const source = fileURLToPath(new URL("./inspected-google-reject-guard.c", import.meta.url));
try {
  prepareGoogleGuardParent();
  mkdirSync(directory, { mode: 0o700 });
  console.log(JSON.stringify({ stage: "created", id, domain, label, directory, port }));
  execFileSync("/usr/bin/clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", source, "-o", binary],
    { stdio: "inherit", timeout: 30000 });
  chmodSync(binary, 0o700);
  const contents = googleGuardPlist(id, port);
  writeFileSync(plist, contents, { mode: 0o600, flag: "wx" });
  writeFileSync(join(directory, "identity.json"), JSON.stringify({ id, domain, label, directory, port, plist, log }) + "\n",
    { mode: 0o600, flag: "wx" });
  const evidence = captureGoogleGuardEvidence(id, port);
  recordGoogleGuardInvocationAttempt(id);
  console.log(JSON.stringify({ stage: "bootstrap_attempt", domain, label, plist }));
  let commandError;
  try { execFileSync("/bin/launchctl", ["bootstrap", domain, plist], { stdio: "inherit", timeout: 10000 }); }
  catch (error) { commandError = error; }
  if (commandError) {
    try { recordGoogleGuardCommandFailure(id, commandError); }
    catch (receiptError) { console.error(JSON.stringify({ stage: "failure_receipt_unavailable", message: receiptError.message })); }
    throw commandError;
  }
  recordGoogleGuardCommandReturned(id);
  console.log(JSON.stringify({ stage: "bootstrap_returned", result: "accepted", readiness: "unknown",
    domain, label, port, evidence }));
} catch (error) {
  console.error(JSON.stringify({ stage: "unavailable", message: error.message, status: error.status ?? null,
    domain, label, directory }));
  process.exitCode = 1;
}
