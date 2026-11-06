import { createHash } from "node:crypto";
import { closeSync, constants, existsSync, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const digest = value => createHash("sha256").update(value).digest("hex");
const root = fileURLToPath(new URL("./out", import.meta.url));
const paths = id => {
  if (!/^[a-f0-9]{32}$/.test(id)) throw Error("invalid_guard_evidence_id");
  return { work: join(root, `google-reject-${id}`), evidence: join(root, `google-reject-evidence-${id}`) };
};
const xml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
export function googleGuardPlist(id, port) {
  if (!Number.isInteger(port) || port < 49152 || port > 65535) throw Error("invalid_guard_evidence_port");
  const { work } = paths(id);
  const label = `org.airlock.google-reject.${id}`, binary = join(work, "reject"), log = join(work, "service.log");
  return `<?xml version="1.0" encoding="UTF-8"?>
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
}
const checkPrivateDirectory = directory => {
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700)
    throw Error("invalid_guard_private_directory");
};
const original = (path, mode) => {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== mode)
      throw Error("invalid_guard_original");
    return readFileSync(fd);
  } finally { closeSync(fd); }
};
const writeDurable = (path, bytes) => {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    fchmodSync(fd, 0o600);
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally { closeSync(fd); }
};
const syncDirectory = directory => {
  const fd = openSync(directory, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
};
const assertSafeParent = () => {
  const stat = lstatSync(root);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o022) !== 0)
    throw Error("invalid_guard_evidence_parent");
};
export function prepareGoogleGuardParent() {
  try { mkdirSync(root, { mode: 0o700 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  assertSafeParent();
  syncDirectory(fileURLToPath(new URL(".", import.meta.url)));
}
const writeReceipt = (directory, name, receipt) => {
  checkPrivateDirectory(directory);
  writeDurable(join(directory, name), JSON.stringify(receipt) + "\n");
  syncDirectory(directory);
};

export function captureGoogleGuardEvidence(id, port) {
  if (!Number.isInteger(port) || port < 49152 || port > 65535) throw Error("invalid_guard_evidence_port");
  const { work, evidence } = paths(id);
  assertSafeParent();
  checkPrivateDirectory(work);
  const plist = join(work, "job.plist"), binary = join(work, "reject");
  const plistBytes = original(plist, 0o600), binaryBytes = original(binary, 0o700);
  if (!plistBytes.equals(Buffer.from(googleGuardPlist(id, port)))) throw Error("unexpected_guard_plist");
  mkdirSync(evidence, { mode: 0o700 });
  checkPrivateDirectory(evidence);
  writeDurable(join(evidence, "original.plist"), plistBytes);
  writeDurable(join(evidence, "original.binary"), binaryBytes);
  writeReceipt(evidence, "prepared.json", {
    state: "prepared_not_invoked", command_invoked: false, readiness: "unknown", id, port,
    label: `org.airlock.google-reject.${id}`, endpoint: "127.0.0.1",
    invocation: { executable: "/bin/launchctl", args: ["bootstrap", `user/${process.getuid()}`, plist] },
    artifacts: { plist_sha256: digest(plistBytes), binary_sha256: digest(binaryBytes) },
  });
  syncDirectory(root);
  return evidence;
}

export function recordGoogleGuardInvocationAttempt(id) {
  const { work, evidence } = paths(id);
  assertSafeParent();
  checkPrivateDirectory(work);
  checkPrivateDirectory(evidence);
  const prepared = JSON.parse(original(join(evidence, "prepared.json"), 0o600));
  if (prepared.id !== id || prepared.state !== "prepared_not_invoked" || prepared.command_invoked !== false
      || prepared.invocation?.executable !== "/bin/launchctl"
      || JSON.stringify(prepared.invocation?.args) !== JSON.stringify(["bootstrap", `user/${process.getuid()}`, join(work, "job.plist")])
      || existsSync(join(evidence, "synthetic-failure.json"))
      || digest(original(join(work, "job.plist"), 0o600)) !== prepared.artifacts.plist_sha256
      || digest(original(join(work, "reject"), 0o700)) !== prepared.artifacts.binary_sha256
      || digest(original(join(evidence, "original.plist"), 0o600)) !== prepared.artifacts.plist_sha256
      || digest(original(join(evidence, "original.binary"), 0o600)) !== prepared.artifacts.binary_sha256)
    throw Error("guard_evidence_changed");
  writeReceipt(evidence, "invocation-attempt.json", {
    state: "invocation_pending", command_invoked: "unknown", readiness: "unknown", id,
  });
}

export function recordGoogleGuardCommandFailure(id, error) {
  const { evidence } = paths(id);
  checkPrivateDirectory(evidence);
  original(join(evidence, "invocation-attempt.json"), 0o600);
  writeReceipt(evidence, "command-failure.json", {
    state: "actual_command_failure", command_invoked: "attempted", readiness: "unknown", id,
    exit_status: Number.isInteger(error.status) ? error.status : null,
    signal: typeof error.signal === "string" ? error.signal : null,
    error_code: typeof error.code === "string" ? error.code : null,
  });
}

export function recordGoogleGuardCommandReturned(id) {
  const { evidence } = paths(id);
  checkPrivateDirectory(evidence);
  original(join(evidence, "invocation-attempt.json"), 0o600);
  writeReceipt(evidence, "command-returned.json", {
    state: "command_returned", command_invoked: true, readiness: "unknown", id,
  });
}

export function recordSyntheticGoogleGuardFailure(id) {
  const { evidence } = paths(id);
  checkPrivateDirectory(evidence);
  original(join(evidence, "prepared.json"), 0o600);
  if (existsSync(join(evidence, "invocation-attempt.json"))) throw Error("guard_invocation_already_pending");
  writeReceipt(evidence, "synthetic-failure.json", {
    state: "synthetic_failure", command_invoked: false, readiness: "unknown", id,
  });
}
