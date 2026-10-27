import { afterEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ prepare: vi.fn(), local: vi.fn(), run: vi.fn() }));
vi.mock("./inspected-meta-stock.mjs", () => ({
  prepareInspectedMetaStock: fake.prepare, prepareLocalInspectedMeta: fake.local, runAttendedInspectedMeta: fake.run,
}));
afterEach(() => vi.clearAllMocks());

it("refuses arbitrary commands, extra options and programs before preparing a case", async () => {
  const { runMetaAttendedEntry } = await import("./meta-attended-reference.mjs");
  for (const args of [[], ["--execute"], ["--native", "/tmp/file", "x"],
    ["--native", "/tmp/file", "a".repeat(64), "--override"],
    ["--program", "/tmp/file", "a".repeat(64)]]) {
    await expect(runMetaAttendedEntry(args)).rejects.toThrow("fixed_attended_reference_arguments");
  }
  expect(fake.prepare).not.toHaveBeenCalled(); expect(fake.local).not.toHaveBeenCalled();
  expect(fake.run).not.toHaveBeenCalled();
});

it("passes only a genuinely prepared in-process plan to the guarded attended entry", async () => {
  const { runMetaAttendedEntry } = await import("./meta-attended-reference.mjs");
  const plan = Object.freeze({});
  fake.local.mockReturnValue(plan); fake.run.mockResolvedValue({ producer_exit_code: 2 });
  expect(await runMetaAttendedEntry(["--local-h1", "/tmp/manifest", "a".repeat(64)]))
    .toEqual({ producer_exit_code: 2 });
  expect(fake.prepare).not.toHaveBeenCalled();
  expect(fake.run).toHaveBeenCalledWith(plan);
});
