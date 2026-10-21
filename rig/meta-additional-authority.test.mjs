import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
async function fixture() {
  const { createAdditionalMetaFixture } = await import("./meta-additional-qualification.mjs");
  const f = createAdditionalMetaFixture();
  roots.push(f.root);
  return f;
}
function rewrite(handle, change) {
  const value = JSON.parse(readFileSync(handle.path));
  change(value);
  writeFileSync(handle.path, JSON.stringify(value), { mode: 0o600 });
  handle.sha256 = hash(readFileSync(handle.path));
}

describe("059-18 closed additional authority (synthetic private records only)", () => {
  it("AC1/4/5: prepares Meta-only additional scope without promoting a fixture to native authority", async () => {
    const f = await fixture();
    const { prepareLocalInspectedMeta, runInspectedMetaStock } = await import("./inspected-meta-stock.mjs");
    const plan = prepareLocalInspectedMeta(f.options());
    expect(plan).toMatchObject({ execution: "LOCAL-ONLY", preparation_complete: true, execution_authority: false });
    await expect(runInspectedMetaStock(plan)).rejects.toThrow("native_pre_admission_blocked");
    expect(existsSync(f.slot)).toBe(false);
    expect(hash(readFileSync(f.original.path))).toBe(f.original.sha256);
  });

  it.each(["id", "future-id", "google", "candidate", "extra", "budget", "consent", "parent-unspent",
    "parent-id", "parent-case", "parent-digest", "parent-proof", "parent-window", "parent-extra",
    "baseline-falseproof", "original-cases", "decision-falseproof", "decision-counter", "decision-date",
    "permission-counter", "permission-scope", "delegation", "owner-timing"])(
    "AC1/2/4/7: refuses semantic %s even with refreshed hashes and receipts", async fault => {
      const f = await fixture();
      if (["id", "future-id", "google", "candidate", "extra", "budget", "consent"].includes(fault))
        rewrite(f.authority, value => {
          if (fault === "id") value.authority_id = "arbitrary-additional-meta";
          if (fault === "future-id") value.authority_id = "meta-stock-additional-2026-10-22";
          if (fault === "google") value.cases["google-stock"] = { reserved: false, admitted: false, spent: false };
          if (fault === "candidate") value.cases = { "meta-chamber": { reserved: false, admitted: false, spent: false } };
          if (fault === "extra") value.retry = true;
          if (fault === "budget") value.limits.physical_vendor_https_attempts = 9;
          if (fault === "consent") value.commands.consent = "granted";
        });
      if (fault.startsWith("parent-")) rewrite(f.spent, value => {
        if (fault === "parent-unspent") value.state = "unspent";
        if (fault === "parent-id") value.authority_id = "unrelated";
        if (fault === "parent-case") value.case_name = "meta-chamber";
        if (fault === "parent-digest") value.authority_sha256 = "f".repeat(64);
        if (fault === "parent-proof") value.execution_prerequisites_proved_by_reservation = true;
        if (fault === "parent-window") value.reserved_at_ms = value.window.expires_at_ms;
        if (fault === "parent-extra") value.refunded = false;
      });
      if (fault === "original-cases") rewrite(f.original, value => { value.cases["meta-stock"].spent = true; });
      if (fault === "baseline-falseproof") rewrite(f.baseline, value => { value.original_mutated = true; });
      if (fault.startsWith("decision-")) rewrite(f.decision, value => {
        if (fault === "decision-falseproof") value.sdk_started_by_recording = true;
        if (fault === "decision-counter") value.additional_stock_cases = 2;
        if (fault === "decision-date") value.owner_message_at = "2026-10-22T18:33:04.581Z";
      });
      if (fault.startsWith("permission-")) rewrite(f.permission, value => {
        if (fault === "permission-counter") value.additional_slots_reserved_or_spent = false;
        if (fault === "permission-scope") value.scope.uses_original_existing_meta_stock_slot = true;
      });
      if (fault === "delegation") f.binding.scheduling.delegated = false;
      if (fault === "owner-timing") f.binding.scheduling.selected_by = "owner";
      f.rebind();
      const { prepareLocalInspectedMeta } = await import("./inspected-meta-stock.mjs");
      expect(() => prepareLocalInspectedMeta(f.options())).toThrow();
      expect(existsSync(f.slot)).toBe(false);
    });

  it.each(["original", "spent", "authority", "baseline", "decision", "permission"])(
    "AC2/3: snapshots %s through prepared-plan admission", async name => {
      const f = await fixture(), api = await import("./inspected-meta-stock.mjs");
      const plan = api.prepareLocalInspectedMeta(f.options());
      const handle = f[name], bytes = readFileSync(handle.path);
      writeFileSync(handle.path, "changed"); writeFileSync(handle.path, bytes);
      await expect(api.runLocalInspectedMeta(plan)).rejects.toThrow("case_source_changed");
      expect(existsSync(f.slot)).toBe(false);
    });

  it.each(["missing", "public", "copied-parent", "copied-slot", "copied-grant", "copied-permission"])(
    "AC2/3: rejects %s canonical location before consumption", async fault => {
      const f = await fixture(), api = await import("./inspected-meta-stock.mjs");
      if (fault === "missing") rmSync(f.spent.path);
      if (fault === "public") chmodSync(f.original.path, 0o644);
      if (fault.startsWith("copied-")) {
        const key = { "copied-parent": "original", "copied-slot": "spent", "copied-grant": "authority",
          "copied-permission": "case_permission" }[fault];
        const handle = key === "case_permission" ? f.binding.case_permission : f[key];
        const directory = join(f.root, "copy"); mkdirSync(directory, { mode: 0o700 });
        const path = join(directory, "copy.json");
        writeFileSync(path, readFileSync(handle.path), { mode: 0o600 });
        handle.path = path;
        if (key === "authority") f.binding.authority = handle;
        if (key === "original" || key === "spent") f.rebind();
        else {
          const path = f.options().manifest_path;
          const manifest = JSON.parse(readFileSync(path));
          manifest.binding = f.binding;
          writeFileSync(path, JSON.stringify(manifest));
        }
      }
      expect(() => api.prepareLocalInspectedMeta(f.options())).toThrow();
      expect(existsSync(f.slot)).toBe(false);
    });

  it("AC3/6: direct journal has one winner, is spent on zero HTTP, and cannot renew with output/digests", async () => {
    const f = await fixture(), { reserveStockSlot } = await import("./native-stock-capture.mjs");
    const result = reserveStockSlot(f.reservationOptions());
    expect(result).toMatchObject({ reserved: true, network_authorized: false, canonical_record_path: f.slot });
    const s = lstatSync(f.slot, { bigint: true });
    expect(result.canonical_record_identity).toBe([s.dev, s.ino, s.nlink, s.size, s.mode, s.mtimeNs, s.ctimeNs].join(":"));
    expect(JSON.parse(readFileSync(f.slot))).toMatchObject({ state: "spent",
      authority_variant: "additional-meta-2026-10-21", lineage_baseline_sha256: f.baseline.sha256 });
    expect(() => reserveStockSlot(f.reservationOptions())).toThrow("stock_slot_spent");
    expect(() => reserveStockSlot({ ...f.reservationOptions(), input_sha256: "c".repeat(64) })).toThrow();
    expect(hash(readFileSync(f.original.path))).toBe(f.original.sha256);
    expect(hash(readFileSync(f.spent.path))).toBe(f.spent.sha256);
  });

  it("AC3/6: concurrent external additional reservations have exactly one durable winner", async () => {
    const f = await fixture(), entry = new URL("./native-stock-capture.mjs", import.meta.url).href;
    const program = `import{reserveStockSlot}from${JSON.stringify(entry)};
      try{reserveStockSlot(JSON.parse(process.argv[1]));console.log("reserved")}
      catch(e){console.log(e.message)}`;
    const rows = await Promise.all(Array.from({ length: 4 }, () => promisify(execFile)(process.execPath,
      ["--input-type=module", "-e", program, JSON.stringify(f.reservationOptions())], { timeout: 5000, maxBuffer: 4096 })));
    expect(rows.map(row => row.stdout.trim()).sort()).toEqual(
      ["reserved", "stock_slot_spent", "stock_slot_spent", "stock_slot_spent"]);
    expect(lstatSync(f.slot).mode & 0o777).toBe(0o600);
  });

  it.each(["google-stock", "meta-chamber", "google-chamber"])(
    "AC1/3: direct additional journal refuses %s", async case_name => {
      const f = await fixture(), { reserveStockSlot } = await import("./native-stock-capture.mjs");
      expect(() => reserveStockSlot({ ...f.reservationOptions(), case_name })).toThrow();
      expect(existsSync(f.slot)).toBe(false);
    });

  it("AC3/7: direct callers cannot omit bindings or invoke accessor/proxy lineage", async () => {
    const f = await fixture(), { reserveStockSlot } = await import("./native-stock-capture.mjs");
    const options = f.reservationOptions();
    delete options.additional_binding;
    expect(() => reserveStockSlot(options)).toThrow();
    let invoked = 0;
    const getter = { get binding() { invoked++; return f.binding; } };
    const proxy = new Proxy({}, { getPrototypeOf() { invoked++; throw Error("trap"); } });
    for (const additional_binding of [getter, proxy])
      expect(() => reserveStockSlot({ ...f.reservationOptions(), additional_binding })).toThrow();
    expect(invoked).toBe(0);
  });

  it.each(["commands", "limits", "window", "open-binding", "authority-copy", "permission-copy",
    "missing-parent", "public-parent", "duplicate-authority"])(
    "AC3/6/7: direct journal refuses %s without a fallback namespace", async fault => {
      const f = await fixture(), { reserveStockSlot } = await import("./native-stock-capture.mjs");
      if (fault === "commands") f.binding.commands = { init: 1, pageview: 2, consent: "native-default" };
      if (fault === "limits") f.binding.limits.meta_requests = 9;
      if (fault === "window") f.binding.window.expires_at_ms = f.binding.window.not_before_ms + 60001;
      if (fault === "open-binding") f.binding.override = true;
      if (["commands", "limits", "window", "open-binding"].includes(fault)) f.rebind();
      if (fault === "missing-parent") rmSync(f.spent.path);
      if (fault === "public-parent") chmodSync(f.original.path, 0o644);
      if (fault === "duplicate-authority") {
        const bytes = readFileSync(f.authority.path, "utf8").replace('"schema_version":1', '"schema_version":1,"schema_version":1');
        writeFileSync(f.authority.path, bytes); f.authority.sha256 = hash(readFileSync(f.authority.path));
      }
      const options = f.reservationOptions();
      if (fault === "authority-copy" || fault === "permission-copy") {
        const key = fault === "authority-copy" ? "authority" : "case_permission";
        const original = f.binding[key], path = join(f.root, "copied.json");
        writeFileSync(path, readFileSync(original.path), { mode: 0o600 });
        options.additional_binding = structuredClone(f.binding);
        options.additional_binding[key].path = path;
        if (key === "authority") options.authority_path = path;
      }
      expect(() => reserveStockSlot(options)).toThrow();
      expect(existsSync(f.slot)).toBe(false);
    });

  it("AC6/8: missing real new-path qualification is a pre-admission blocker, never a new grant", async () => {
    const f = await fixture(), api = await import("./inspected-meta-stock.mjs");
    const path = f.options().manifest_path, manifest = JSON.parse(readFileSync(path));
    manifest.kind = "airlock.inspected-meta-stock.v1";
    manifest.binding.observation_end_ms = manifest.binding.window.expires_at_ms - 6000;
    for (const name of Object.keys(manifest.evidence)) manifest.evidence[name] = null;
    writeFileSync(path, JSON.stringify(manifest));
    const plan = api.prepareInspectedMetaStock(f.options());
    expect(plan.execution).toBe("BLOCKED");
    expect(plan.blockers).toContain("additional_path_qualification_missing");
    await expect(api.runInspectedMetaStock(plan)).rejects.toThrow("native_pre_admission_blocked");
    expect(existsSync(f.slot)).toBe(false);
  });
});
