import { execFileSync } from "node:child_process";
import { randomBytes, randomInt } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin" || process.env.AIRLOCK_GOOGLE_LAUNCHD_CONTROL !== "1" || process.argv.length !== 2) {
  console.error("unavailable: explicit AIRLOCK_GOOGLE_LAUNCHD_CONTROL=1 on macOS required");
  process.exit(2);
}

const id = randomBytes(16).toString("hex");
const directory = resolve("rig/out", `google-reject-${id}`);
const label = `org.airlock.google-reject.${id}`, domain = `user/${process.getuid()}`;
const port = randomInt(49152, 65536), binary = join(directory, "reject");
const plist = join(directory, "job.plist"), log = join(directory, "service.log");
const source = fileURLToPath(new URL("./inspected-google-reject-guard.c", import.meta.url));
const xml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
mkdirSync(directory, { mode: 0o700 });
console.log(JSON.stringify({ stage: "created", id, domain, label, directory, port }));
try {
  execFileSync("/usr/bin/clang", ["-std=c11", "-Wall", "-Wextra", "-Werror", source, "-o", binary],
    { stdio: "inherit", timeout: 30000 });
  chmodSync(binary, 0o700);
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array><string>${xml(binary)}</string><string>${port}</string></array>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${xml(log)}</string>
<key>StandardErrorPath</key><string>${xml(log)}</string>
<key>Sockets</key><dict><key>Reject</key><dict>
<key>SockNodeName</key><string>127.0.0.1</string>
<key>SockFamily</key><string>IPv4</string>
<key>SockProtocol</key><string>TCP</string>
<key>SockType</key><string>stream</string>
<key>SockPassive</key><true/>
<key>SockServiceName</key><integer>${port}</integer>
</dict></dict></dict></plist>`;
  writeFileSync(plist, contents, { mode: 0o600, flag: "wx" });
  writeFileSync(join(directory, "identity.json"), JSON.stringify({ id, domain, label, directory, port, plist, log }) + "\n",
    { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ stage: "bootstrap_attempt", domain, label, plist }));
  execFileSync("/bin/launchctl", ["bootstrap", domain, plist], { stdio: "inherit", timeout: 10000 });
  console.log(JSON.stringify({ stage: "bootstrap_returned", result: "accepted", domain, label, port }));
} catch (error) {
  console.error(JSON.stringify({ stage: "unavailable", message: error.message, status: error.status ?? null,
    domain, label, directory }));
  process.exitCode = 1;
}
