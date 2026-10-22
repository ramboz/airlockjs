// Only the two read/hash source-closure assertions run under this config.
// No real Chrome metadata, OS probe, child, socket or temporary root is used.
import { vi } from "vitest";
import { isAbsolute } from "node:path";

if (!process.env.AIRLOCK_NAMESPACE_PROOF_ROOT || !isAbsolute(process.env.AIRLOCK_NAMESPACE_PROOF_ROOT))
  throw Error("private_namespace_proof_root_required");
const forbidden = () => { throw Error("SOURCE_CLOSURE_OS_EFFECT_FORBIDDEN"); };
vi.mock("node:child_process", async importOriginal => ({
  ...await importOriginal(), execFile: vi.fn(forbidden), execFileSync: vi.fn(forbidden),
  exec: vi.fn(forbidden), execSync: vi.fn(forbidden), spawn: vi.fn(forbidden), spawnSync: vi.fn(forbidden), fork: vi.fn(forbidden),
}));
vi.mock("node:net", async importOriginal => ({
  ...await importOriginal(), connect: vi.fn(forbidden), createConnection: vi.fn(forbidden), createServer: vi.fn(forbidden),
}));
vi.mock("node:http", async importOriginal => ({
  ...await importOriginal(), createServer: vi.fn(forbidden), request: vi.fn(forbidden), get: vi.fn(forbidden),
}));
vi.mock("node:https", async importOriginal => ({
  ...await importOriginal(), createServer: vi.fn(forbidden), request: vi.fn(forbidden), get: vi.fn(forbidden),
}));
vi.mock("node:http2", async importOriginal => ({
  ...await importOriginal(), createServer: vi.fn(forbidden), createSecureServer: vi.fn(forbidden), connect: vi.fn(forbidden),
}));
vi.mock("node:tls", async importOriginal => ({
  ...await importOriginal(), createServer: vi.fn(forbidden), connect: vi.fn(forbidden),
}));
vi.mock("node:os", async importOriginal => ({
  ...await importOriginal(), tmpdir: () => process.env.AIRLOCK_NAMESPACE_PROOF_ROOT, release: vi.fn(forbidden),
}));
vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal();
  const chrome = "/Applications/Google Chrome.app/Contents/Info.plist";
  const bytes = Buffer.from("SOURCE_FIXTURE_ONLY_NOT_ACTUAL_CHROME_METADATA\n");
  return { ...actual,
    readFileSync: (path, ...args) => path === chrome ? Buffer.from(bytes) : actual.readFileSync(path, ...args),
    lstatSync: (path, options) => {
      if (path !== chrome) return actual.lstatSync(path, options);
      const big = options?.bigint, n = value => big ? BigInt(value) : value;
      return { dev: n(1), ino: n(1), nlink: n(1), size: n(bytes.length), mode: n(0o100644),
        mtimeNs: 0n, ctimeNs: 0n, isFile: () => true, isSymbolicLink: () => false };
    },
  };
});
