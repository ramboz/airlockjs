import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { createRequire } from "node:module";
import { release } from "node:os";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const identity = stat => [stat.dev, stat.ino, stat.nlink, stat.size, stat.mode, stat.mtimeNs, stat.ctimeNs].join(":");

function executableFingerprint(path, maximum) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.size <= 0n || before.size > BigInt(maximum)) throw Error("unsafe_google_executable");
    const digest = createHash("sha256"), buffer = Buffer.allocUnsafe(1048576);
    let total = 0, count;
    while ((count = readSync(fd, buffer, 0, buffer.length, total)) > 0) {
      digest.update(buffer.subarray(0, count)); total += count;
    }
    if (identity(before) !== identity(fstatSync(fd, { bigint: true })) || total !== Number(before.size))
      throw Error("google_executable_changed");
    return digest.digest("hex");
  } finally { closeSync(fd); }
}

export function currentGoogleCohort() {
  const info = "/Applications/Google Chrome.app/Contents/Info.plist";
  const chrome = execFileSync("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", info],
    { timeout: 2000, maxBuffer: 4096 }).toString().trim();
  const macos = execFileSync("/usr/bin/sw_vers", ["-productVersion"], { timeout: 2000, maxBuffer: 4096 }).toString().trim();
  const require = createRequire(import.meta.url), playwright = require("playwright/package.json").version;
  if (process.version !== "v22.16.0" || process.platform !== "darwin" || process.arch !== "arm64"
    || release() !== "27.0.0" || macos !== "27.0.1" || chrome !== "156.0.8078.80" || playwright !== "1.62.1")
    throw Error("google_cohort_mismatch");
  const app = "/Applications/Google Chrome.app/Contents";
  return { node: process.version, platform: process.platform, arch: process.arch, darwin: release(), macos, chrome,
    playwright, node_executable_sha256: executableFingerprint(process.execPath, 268435456),
    chrome_executable_sha256: executableFingerprint(`${app}/MacOS/Google Chrome`, 16777216),
    chrome_framework_sha256: executableFingerprint(`${app}/Frameworks/Google Chrome Framework.framework/Versions/${chrome}/Google Chrome Framework`,
      1073741824),
    chrome_info_sha256: hash(readFileSync(info)) };
}
