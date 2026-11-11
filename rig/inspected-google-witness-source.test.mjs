import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(), lstat: vi.fn(), mkdir: vi.fn(), open: vi.fn(), fsync: vi.fn(), close: vi.fn(),
  read: vi.fn(), write: vi.fn(), sources: vi.fn(), cohort: vi.fn(), run: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", async importOriginal => ({
  ...await importOriginal(), lstatSync: mocks.lstat, mkdirSync: mocks.mkdir,
  openSync: mocks.open, fsyncSync: mocks.fsync, closeSync: mocks.close,
}));
vi.mock("./native-stock-meta.mjs", () => ({ readMetaPrivate: mocks.read, writeMetaPrivate: mocks.write }));
vi.mock("./inspected-meta-stock.mjs", () => ({ inspectedMetaSourcePins: mocks.sources }));
vi.mock("./inspected-google-cohort.mjs", () => ({ currentGoogleCohort: mocks.cohort }));
vi.mock("./inspected-google-qualification.mjs", () => ({ runLocalGoogleQualification: mocks.run }));

const source = { "google-source": "source-a" };
const cohort = { chrome: "157.0.8103.40", node: "v22.16.0", macos: "27.0.1", darwin: "27.0.0",
  platform: "darwin", arch: "arm64", playwright: "1.62.1", node_executable_sha256: "node-a" };
const changedSource = { "google-source": "source-b" };
const changedCohort = { ...cohort, chrome: "156.0.8078.80" };
const options = { protocol: "h1", control: "positive", outputDir: "/google-source-only-never-created/case" };

function report() {
  return { protocol: "h1", control: "positive", outcome: "pass", errors: [], originals: { responses: [] },
    source_before: source, source_after: source, cohort_before: cohort, cohort_after: cohort,
    native_sdk_executed: false, public_upstream_requests: 0, native_execution_qualified: false };
}

describe("Google local witness source/cohort binding with closed mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "getuid").mockReturnValue(1000);
    mocks.lstat.mockReturnValue({ isDirectory: () => true, isSymbolicLink: () => false,
      uid: 1000, mode: 0o700 });
    mocks.open.mockReturnValue(1);
    mocks.sources.mockReturnValue(source);
    mocks.cohort.mockReturnValue(cohort);
    mocks.read.mockImplementation(() => Buffer.from(JSON.stringify(report())));
    mocks.run.mockImplementation(async (_options, custody) => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      custody.onChild(child);
      child.emit("exit", 0, null);
      child.emit("close", 0, null);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps matching snapshots incomplete without qualified guard release", async () => {
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    await expect(witnessLocalGoogleQualification(options)).rejects.toThrow("local_google_witness_inconclusive");
    expect(mocks.write.mock.calls.find(([path]) => path.endsWith("/witness.json"))[1]).toMatchObject({ complete: false,
      failure_category: "google_guard_release_unqualified", native_sdk_executed: false,
      native_execution_qualified: false, public_upstream_requests: 0 });
    expect(mocks.sources).toHaveBeenCalledTimes(2);
    expect(mocks.cohort).toHaveBeenCalledTimes(2);
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.write.mock.calls.find(([path]) => path.endsWith("/custody-incomplete.json"))[1])
      .toMatchObject({ complete: false, reason: "witness_incomplete" });
  });

  it.each([
    ["source after child", "sourceAfter"],
    ["cohort after child", "cohortAfter"],
    ["producer source before", "reportSourceBefore"],
    ["producer source after", "reportSourceAfter"],
    ["both producer source snapshots", "reportSourceBoth"],
    ["producer cohort before", "reportCohortBefore"],
    ["producer cohort after", "reportCohortAfter"],
    ["both producer cohort snapshots", "reportCohortBoth"],
  ])("rejects stale or mismatched %s", async (_label, mismatch) => {
    const fixture = report();
    if (mismatch === "sourceAfter") mocks.sources.mockReturnValueOnce(source).mockReturnValueOnce(changedSource);
    if (mismatch === "cohortAfter") mocks.cohort.mockReturnValueOnce(cohort).mockReturnValueOnce(changedCohort);
    if (mismatch === "reportSourceBefore") fixture.source_before = changedSource;
    if (mismatch === "reportSourceAfter") fixture.source_after = changedSource;
    if (mismatch === "reportSourceBoth") fixture.source_before = fixture.source_after = changedSource;
    if (mismatch === "reportCohortBefore") fixture.cohort_before = changedCohort;
    if (mismatch === "reportCohortAfter") fixture.cohort_after = changedCohort;
    if (mismatch === "reportCohortBoth") fixture.cohort_before = fixture.cohort_after = changedCohort;
    mocks.read.mockReturnValue(Buffer.from(JSON.stringify(fixture)));
    const { witnessLocalGoogleQualification } = await import("./inspected-google-witness.mjs");
    await expect(witnessLocalGoogleQualification(options)).rejects.toThrow("local_google_witness_inconclusive");
    expect(mocks.write.mock.calls.find(([path]) => path.endsWith("/witness.json"))[1]).toMatchObject({ complete: false,
      failure_category: "local_google_witness_inconclusive",
      native_sdk_executed: false, native_execution_qualified: false, public_upstream_requests: 0 });
  });
});
