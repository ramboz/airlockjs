// Only two read/hash assertions use this hook. No browser/OS readiness,
// source qualification, slot, process, listener or network test is selected.
import { vi } from "vitest";
import { isAbsolute } from "node:path";

const proofRoot = process.env.AIRLOCK_CLOCK_SOURCE_PROOF_ROOT;
if (!proofRoot || !isAbsolute(proofRoot) || !proofRoot.endsWith("/integration-v1"))
  throw Error("clock_source_private_integration_root_required");
const boundary = vi.hoisted(() => ({
  deny: () => { throw Error("CLOCK_SOURCE_INTEGRATION_OS_EFFECT_FORBIDDEN"); },
  chrome: "/Applications/Google Chrome.app/Contents/Info.plist",
  chromeBytes: Buffer.from("SOURCE_FIXTURE_ONLY_NOT_ACTUAL_CHROME_METADATA\n"),
}));
vi.mock("node:child_process", async original => ({
  ...await original(), execFile: vi.fn(boundary.deny), execFileSync: vi.fn(boundary.deny),
  exec: vi.fn(boundary.deny), execSync: vi.fn(boundary.deny), spawn: vi.fn(boundary.deny),
  spawnSync: vi.fn(boundary.deny), fork: vi.fn(boundary.deny),
}));
vi.mock("node:net", async original => ({
  ...await original(), connect: vi.fn(boundary.deny), createConnection: vi.fn(boundary.deny),
  createServer: vi.fn(boundary.deny),
}));
vi.mock("node:http", async original => ({
  ...await original(), createServer: vi.fn(boundary.deny), request: vi.fn(boundary.deny), get: vi.fn(boundary.deny),
}));
vi.mock("node:https", async original => ({
  ...await original(), createServer: vi.fn(boundary.deny), request: vi.fn(boundary.deny), get: vi.fn(boundary.deny),
}));
vi.mock("node:http2", async original => ({
  ...await original(), createServer: vi.fn(boundary.deny), createSecureServer: vi.fn(boundary.deny),
  connect: vi.fn(boundary.deny),
}));
vi.mock("node:tls", async original => ({
  ...await original(), createServer: vi.fn(boundary.deny), connect: vi.fn(boundary.deny),
}));
vi.mock("node:dgram", async original => ({ ...await original(), createSocket: vi.fn(boundary.deny) }));
vi.mock("node:dns", async original => ({
  ...await original(), lookup: vi.fn(boundary.deny), resolve: vi.fn(boundary.deny),
}));
vi.mock("node:os", async original => ({
  ...await original(), tmpdir: () => process.env.AIRLOCK_CLOCK_SOURCE_PROOF_ROOT,
  release: vi.fn(boundary.deny), hostname: vi.fn(boundary.deny), homedir: vi.fn(boundary.deny),
  networkInterfaces: vi.fn(boundary.deny), cpus: vi.fn(boundary.deny), userInfo: vi.fn(boundary.deny),
  uptime: vi.fn(boundary.deny),
}));
vi.mock("node:fs/promises", async original => ({
  ...await original(), chmod: vi.fn(boundary.deny), chown: vi.fn(boundary.deny), link: vi.fn(boundary.deny),
  mkdir: vi.fn(boundary.deny), mkdtemp: vi.fn(boundary.deny), open: vi.fn(boundary.deny),
  rename: vi.fn(boundary.deny), rm: vi.fn(boundary.deny), rmdir: vi.fn(boundary.deny),
  symlink: vi.fn(boundary.deny), unlink: vi.fn(boundary.deny), writeFile: vi.fn(boundary.deny),
  appendFile: vi.fn(boundary.deny), copyFile: vi.fn(boundary.deny), cp: vi.fn(boundary.deny),
  truncate: vi.fn(boundary.deny),
}));
vi.mock("node:fs", async original => {
  const actual = await original();
  const writes = Object.fromEntries([
    "appendFile", "appendFileSync", "chmod", "chmodSync", "chown", "chownSync", "copyFile", "copyFileSync",
    "cp", "cpSync", "createWriteStream", "fsync", "fsyncSync", "link", "linkSync", "mkdir", "mkdirSync",
    "mkdtemp", "mkdtempSync", "open", "openSync", "rename", "renameSync", "rm", "rmSync",
    "rmdir", "rmdirSync", "symlink", "symlinkSync", "truncate", "truncateSync", "unlink", "unlinkSync",
    "write", "writeSync", "writeFile", "writeFileSync",
  ].map(name => [name, vi.fn(boundary.deny)]));
  return { ...actual, ...writes,
    readFileSync: (path, ...args) => path === boundary.chrome
      ? Buffer.from(boundary.chromeBytes) : actual.readFileSync(path, ...args),
    lstatSync: (path, options) => {
      if (path !== boundary.chrome) return actual.lstatSync(path, options);
      const n = value => options?.bigint ? BigInt(value) : value;
      return { dev: n(1), ino: n(1), nlink: n(1), size: n(boundary.chromeBytes.length), mode: n(0o100644),
        mtimeNs: 0n, ctimeNs: 0n, isFile: () => true, isSymbolicLink: () => false };
    },
  };
});
