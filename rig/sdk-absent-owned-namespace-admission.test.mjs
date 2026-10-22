import { beforeEach, expect, it, vi } from "vitest";
vi.mock("node:fs", () => ({
  openSync: vi.fn(), closeSync: vi.fn(), readFileSync: vi.fn(), writeSync: vi.fn(), fstatSync: vi.fn(),
  fsyncSync: vi.fn(), lstatSync: vi.fn(), realpathSync: vi.fn(), linkSync: vi.fn(), unlinkSync: vi.fn(),
  constants: { O_RDONLY: 0, O_NOFOLLOW: 131072, O_DIRECTORY: 1048576 },
}));
vi.mock("node:process", () => ({ default: {
  argv: [], env: {}, platform: "darwin", arch: "arm64", version: "v22.16.0", pid: 100, ppid: 1,
  execPath: "/source-fixture/node", connected: false, send: undefined, hrtime: { bigint: vi.fn(() => 100000000n) },
  stdout: { write: vi.fn() }, stderr: { write: vi.fn() },
} }));
vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("OS_PROCESS_FORBIDDEN"); }) }));
vi.mock("node:net", () => ({ connect: vi.fn(() => { throw Error("NETWORK_FORBIDDEN"); }) }));
vi.mock("node:perf_hooks", () => ({ performance: { now: vi.fn(() => { throw Error("CLOCK_FORBIDDEN"); }) } }));
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertOwnedNamespacePayloadContext, requireOwnedNamespaceImageClockContract } from "./sdk-absent-owned-namespace-image-admission.mjs";
import { requireOwnedNamespaceRuntimeAdmission } from "./sdk-absent-owned-namespace-admission.mjs";
import { launchOwnedNamespaceCase } from "./sdk-absent-owned-namespace-entry.mjs";
import { runOwnedNamespacePayload } from "./sdk-absent-owned-namespace-payload.mjs";
import { startOwnedNamespaceInit } from "./sdk-absent-owned-namespace-init.mjs";
import { bytesHash, installSourceFixtureFs, NONCE, put, ROOT } from "./sdk-absent-owned-namespace-actors.fixture.mjs";
import { prepareOwnedNamespacePlan } from "./sdk-absent-owned-namespace.mjs";
const CLOCK = fileURLToPath(new URL("sdk-absent-owned-namespace-clock.json", import.meta.url));
const COHORT = fileURLToPath(new URL("sdk-absent-owned-namespace-cohort.json", import.meta.url));
let metadata;
beforeEach(() => {
  vi.clearAllMocks(); metadata = installSourceFixtureFs();
  process.env = {}; process.platform = "darwin"; process.arch = "arm64"; process.version = "v22.16.0"; process.pid = 100;
});
function clockFile(value) {
  const bytes = JSON.stringify(value); put(CLOCK, bytes, 0o100644);
  metadata.sources.find(row => row.path === CLOCK).sha256 = bytesHash(bytes);
  put(COHORT, JSON.stringify(metadata), 0o100644);
}
it("current NOT_PREPARED cohort prevents actual public launch before any S/Docker process", () => {
  put(COHORT, '{"schema":"airlock.owned-namespace-cohort.v1","status":"NOT_PREPARED"}', 0o100644);
  expect(() => launchOwnedNamespaceCase(["--fixed-namespace-case", "source-case-01", NONCE, ROOT, "normal"]))
    .toThrow("namespace_cohort_NOT_PREPARED");
  expect(spawn).not.toHaveBeenCalled();
});
it("a JSON prepared:true/clock-ready flag cannot become a private runtime plan", () => {
  expect(() => requireOwnedNamespaceRuntimeAdmission({ prepared: true, clock_ready: true })).toThrow("private_namespace_plan");
  expect(spawn).not.toHaveBeenCalled();
});
it("even a genuine source-fixture private plan cannot cross the current real runtime clock gate", () => {
  clockFile({ schema: "airlock.owned-namespace-clock-bounds.v1", status: "NOT_PREPARED" });
  const plan = prepareOwnedNamespacePlan({ case_id: "source-case-01", nonce: NONCE, root: ROOT });
  expect(() => requireOwnedNamespaceRuntimeAdmission(plan)).toThrow("namespace_runtime_clock_bounds_UNPROVED");
  expect(spawn).not.toHaveBeenCalled();
});
it.each([
  { status: "PREPARED_RUNTIME_PROOF", qualified: true, ready: true },
  { status: "SIMULATED_NOT_PROVEN", minimum_init_ticks_per_supervisor_tick: 1, conservative_margin_ms: 1 },
])("does not invent a qualified clock issuer/reader for %j", value => {
  clockFile(value);
  expect(() => requireOwnedNamespaceImageClockContract()).toThrow("namespace_runtime_clock_proof_issuer_and_reader_contract_MISSING");
  expect(spawn).not.toHaveBeenCalled();
});
it("direct valid payload argv on this host is refused inside the actual execution function before forks/timers", () => {
  expect(() => runOwnedNamespacePayload(["late-parent", "100"])).toThrow("namespace_direct_payload_context_refused");
  expect(spawn).not.toHaveBeenCalled();
});
it("even apparent image/PID/Node/environment identity cannot substitute for the missing clock proof", () => {
  process.platform = "linux"; process.arch = "arm64"; process.version = "v24.10.0"; process.pid = 2;
  process.env = { AIRLOCK_CASE: "source-case-01", AIRLOCK_NONCE: NONCE };
  clockFile({ status: "NOT_PREPARED" });
  expect(() => assertOwnedNamespacePayloadContext()).toThrow("namespace_runtime_clock_bounds_UNPROVED");
  expect(() => runOwnedNamespacePayload(["orphan", "100"])).toThrow("namespace_runtime_clock_bounds_UNPROVED");
  expect(spawn).not.toHaveBeenCalled();
});
it("the now-integrated init protocol is still hard NO-GO before clock/timers/children under NOT_PREPARED", () => {
  process.platform = "linux"; process.arch = "arm64"; process.version = "v24.10.0"; process.pid = 1;
  process.env = { AIRLOCK_CASE: "source-case-01", AIRLOCK_NONCE: NONCE };
  clockFile({ status: "NOT_PREPARED" });
  expect(() => startOwnedNamespaceInit()).toThrow("namespace_runtime_clock_bounds_UNPROVED");
  expect(spawn).not.toHaveBeenCalled();
});
