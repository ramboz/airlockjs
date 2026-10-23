import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawn: vi.fn(() => { throw Error("OS_FORBIDDEN"); }) }));
vi.mock("node:fs", () => {
  const forbidden = () => { throw Error("FS_FORBIDDEN"); };
  return { readFileSync: vi.fn(forbidden), openSync: vi.fn(forbidden), realpathSync: vi.fn(forbidden),
    closeSync: vi.fn(forbidden), fstatSync: vi.fn(forbidden), fsyncSync: vi.fn(forbidden), linkSync: vi.fn(forbidden),
    lstatSync: vi.fn(forbidden), unlinkSync: vi.fn(forbidden), writeSync: vi.fn(forbidden), constants: {} };
});

describe("separate no-work observation admission", () => {
  it("has no runtime, image, H-provenance or JSON-ready grant", async () => {
    const gate = await import("./sdk-absent-clock-observation-admission.mjs");
    expect(gate.clockObservationReadiness()).toMatchObject({
      ready: false, qualified_clock: false, workload_admission: false, native_qualified: false,
    });
    for (const input of [undefined, { ready: true }, { status: "PREPARED_RUNTIME_PROOF" },
      { normal_admission_failed: true }, { independent: true }]) {
      expect(() => gate.requireClockObservationRuntime(input)).toThrow("NOT_PREPARED");
      expect(() => gate.requireClockObservationImage(input)).toThrow("NOT_PREPARED");
      expect(() => gate.requireClockObservationH(input)).toThrow("H_provenance_UNAVAILABLE");
    }
  });
  it("blocks the actual public entry before filesystem, subprocess, daemon or image effects", async () => {
    const { runClockObservationEntry } = await import("./sdk-absent-clock-observation-entry.mjs");
    const fs = await import("node:fs"), cp = await import("node:child_process");
    await expect(runClockObservationEntry(["--clock-observation", "source-clock-01", "/unprepared"]))
      .rejects.toThrow("H_provenance_UNAVAILABLE");
    expect(fs.openSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(cp.spawn).not.toHaveBeenCalled();
  });
  it("cannot manufacture a private SOURCE plan while its own runtime preparation is absent", async () => {
    const { prepareClockObservationPlan } = await import("./sdk-absent-clock-observation-plan.mjs");
    const fs = await import("node:fs");
    expect(() => prepareClockObservationPlan({ case_id: "source-clock-01", root: "/unprepared" })).toThrow("NOT_PREPARED");
    expect(fs.openSync).not.toHaveBeenCalled();
  });
});
