import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LIMITS } from "./native-stock-policy.mjs";
import { privateOriginalDirectory } from "./private-original-file.mjs";
import { reserveStockSlot } from "./native-stock-capture.mjs";
import { prepareNativeGoogleStock } from "./inspected-google-admission.mjs";
import { startNativeGoogleInspectedTransport } from "./inspected-transport.mjs";
import { additionalGoogleBindingDigest, additionalGoogleSourcePin,
  inspectSyntheticAdditionalGoogle, consumeSyntheticAdditionalGoogle } from "./inspected-google-additional.mjs";
import * as googleAdditional from "./inspected-google-additional.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
const commands = { initialize: 1, configure: 1, conversion: 1, consent: "native-default" };

function fixture() {
  const suffix = randomBytes(8).toString("hex");
  const parent = resolve("rig/out");
  try { mkdirSync(parent, { mode: 0o700 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  privateOriginalDirectory(parent, process.getuid());
  const root = join(parent, `google-additional-${suffix}`);
  mkdirSync(root, { mode: 0o700 });
  const id = `synthetic-google-additional-${suffix}`;
  const attempt = `synthetic-attempt-${suffix}`;
  const lineage = `synthetic-lineage-${suffix}`;
  const save = (name, value) => {
    const bytes = Buffer.from(JSON.stringify(value));
    const path = join(root, name);
    writeFileSync(path, bytes, { mode: 0o600 });
    return { path, sha256: hash(bytes) };
  };
  const baseline = { schema: "airlock.synthetic-google-original-baseline.v1", synthetic_only: true,
    lineage, original_authority_sha256: hash(`synthetic-original-authority:${lineage}`),
    original_stock_sha256: hash(`synthetic-original-stock:${lineage}`),
    original_chamber_sha256: hash(`synthetic-original-chamber:${lineage}`) };
  const decision = { schema: "airlock.synthetic-google-additional-decision.v1", synthetic_only: true,
    lineage, attempt, case_name: "google-stock", limits: LIMITS, commands };
  const inputs = { schema: "airlock.synthetic-google-additional-inputs.v1", synthetic_only: true,
    lineage, attempt, case_name: "google-stock", transaction_id: `synthetic-${suffix}`,
    profile: { schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
      document_url: "https://owned.example/inspection",
      owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
        value: 1, currency: "USD", transaction_id: `synthetic-${suffix}` },
      resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
        sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
      companion_authorized: true } };
  const authorityPath = join(root, "authority.json");
  writeFileSync(authorityPath, "{}", { mode: 0o600 });
  const stat = statSync(authorityPath, { bigint: true });
  const authority = { schema: "airlock.synthetic-google-additional-authority.v1", synthetic_only: true,
    authority_id: id, case_name: "google-stock", lineage, attempt,
    self_locator: { path: authorityPath, dev: String(stat.dev), ino: String(stat.ino) },
    limits: LIMITS, commands };
  const now = Date.now();
  const binding = { authority: null, baseline: null, decision: null, inputs: null, witness: null,
    review: null, case_permission: null, source_sha256: additionalGoogleSourcePin(),
    cohort: { kind: "sdk-free-synthetic", native_execution_qualified: false },
    window: { not_before_ms: now - 1000, expires_at_ms: now + 55000 }, limits: LIMITS, commands };
  const refresh = () => {
    binding.authority = save("authority.json", authority);
    binding.baseline = save("baseline.json", baseline);
    binding.decision = save("decision.json", decision);
    binding.inputs = save("inputs.json", inputs);
    binding.witness = save("witness.json", { schema: "airlock.synthetic-google-additional-witness.v1",
      synthetic_only: true, lineage, attempt, baseline_sha256: binding.baseline.sha256,
      decision_sha256: binding.decision.sha256, inputs_sha256: binding.inputs.sha256 });
    binding.review = save("review.json", { schema: "airlock.synthetic-google-additional-review.v1",
      synthetic_only: true, lineage, attempt, witness_sha256: binding.witness.sha256,
      source_sha256: binding.source_sha256, verdict: "fixture-only" });
    binding.case_permission = save("case.json", { schema: "airlock.synthetic-google-additional-case.v1",
      synthetic_only: true, lineage, attempt, authority_sha256: binding.authority.sha256,
      canonical_slot_path: join(root, `native-stock-slots-${id}`, "google-stock.reserved"),
      binding_sha256: additionalGoogleBindingDigest(binding), valid_until_ms: binding.window.expires_at_ms });
    return binding;
  };
  const options = () => ({ authority_path: binding.authority.path, authority_sha256: binding.authority.sha256,
    case_name: "google-stock", input_sha256: binding.inputs.sha256, source_sha256: binding.source_sha256,
    window: binding.window, additional_binding: binding });
  return { root, save, binding, authority, baseline, decision, inputs, refresh, options };
}

function untrustedNativeCandidate(f, changePermission = () => {}) {
  f.refresh();
  const binding = structuredClone(f.binding);
  binding.cohort = { kind: "synthetic-native-candidate", native_execution_qualified: false };
  binding.authority = f.save("google-additional-authority.json",
    { ...f.authority, authority_variant: "google-additional" });
  binding.baseline = f.save("google-additional-lineage-baseline.json", {
    schema: "airlock.additional-google-original-lineage-baseline.v1",
    original_authority_sha256: f.baseline.original_authority_sha256,
    original_stock_sha256: f.baseline.original_stock_sha256,
    original_chamber_sha256: f.baseline.original_chamber_sha256,
  });
  binding.decision = f.save("google-additional-owner-decision.json", {
    schema: "airlock.owner-additional-google-case-decision.v1",
    status: "approved_additional_bounded_case_scope", case_name: "google-stock",
    transport: "inspected-network", attempt: f.authority.attempt,
    authority_id: f.authority.authority_id, additional_stock_cases: 1,
    lineage_baseline_sha256: binding.baseline.sha256, limits: LIMITS, commands,
  });
  const stat = statSync(binding.authority.path, { bigint: true });
  const permission = { schema_version: 1, kind: "inspected-google-additional-case-location",
    status: "approved_case_binding", case_name: "google-stock", transport: "inspected-network",
    native_execution_permitted: true,
    authority_locator: { path: binding.authority.path, sha256: binding.authority.sha256,
      dev: String(stat.dev), ino: String(stat.ino) },
    canonical_slot_path: join(f.root, `native-stock-slots-${f.authority.authority_id}`, "google-stock.reserved"),
    permission_source_sha256: additionalGoogleBindingDigest(binding),
    valid_until_ms: binding.window.expires_at_ms, owner_decision_sha256: binding.decision.sha256,
    lineage_baseline_sha256: binding.baseline.sha256, attempt: f.authority.attempt };
  changePermission(permission);
  binding.case_permission = f.save("google-additional-case-permission.json", permission);
  const manifest = f.save("manifest.json", { schema_version: 1, kind: "airlock.inspected-google-additional-stock.v1",
    case_name: "google-stock", transport: "inspected-network", binding, evidence: {},
    output_dir: join(f.root, "output") });
  return { manifest, binding };
}

describe("synthetic additional Google lineage", () => {
  it("hands one reserved SDK-free case through a single-use Google policy lease and stops forwarding", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      expect(lease).toBeDefined();
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      expect(() => googleAdditional.claimSyntheticGoogleLease(lease)).toThrow("google_additional_lease_invalid");
      const url = "https://www.googleadservices.com/pagead/conversion/000000000/"
        + `?label=synthetic&value=1&currency_code=USD&oid=${f.inputs.transaction_id}`
        + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";
      gate.observe({ network_id: "synthetic-local-observation", url, method: "GET", resource_type: "XHR" });
      const parsed = new URL(url);
      const bytes = Buffer.from(`GET ${parsed.pathname + parsed.search} HTTP/1.1\r\nHost: ${parsed.host}\r\n\r\n`);
      expect(gate.request(bytes)).toEqual(bytes);
      gate.stop();
      expect(gate.request(bytes)).toEqual(Buffer.alloc(0));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not allow a copied fixture lease or let the real native connector claim it", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      expect(() => googleAdditional.claimSyntheticGoogleLease(structuredClone(lease)))
        .toThrow("google_additional_lease_invalid");
      await expect(startNativeGoogleInspectedTransport(lease))
        .rejects.toThrow("invalid_native_google_transport_lease");
      expect(() => googleAdditional.claimSyntheticGoogleLease(lease)).toThrow("google_additional_lease_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not forward after the case observation deadline", async () => {
    const f = fixture();
    try {
      f.binding.window.expires_at_ms = Date.now() + 7000;
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      const delay = Math.max(0, f.binding.window.expires_at_ms - 6000 - Date.now() + 20);
      await new Promise(resolve => setTimeout(resolve, delay));
      expect(gate.request(Buffer.from("GET / HTTP/1.1\r\nHost: www.googleadservices.com\r\n\r\n")))
        .toEqual(Buffer.alloc(0));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not forward a foreign Google conversion through the fixture lease", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      const bytes = Buffer.from("GET /pagead/conversion/999999999/?label=foreign&value=1&currency_code=USD"
        + "&oid=foreign HTTP/1.1\r\nHost: www.googleadservices.com\r\n\r\n");
      expect(gate.request(bytes)).toEqual(Buffer.alloc(0));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not manufacture a logical observation from an unobserved physical request", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      const url = new URL("https://www.googleadservices.com/pagead/conversion/000000000/"
        + `?label=synthetic&value=1&currency_code=USD&oid=${f.inputs.transaction_id}`
        + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid");
      const bytes = Buffer.from(`GET ${url.pathname + url.search} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n`);
      expect(gate.request(bytes)).toEqual(Buffer.alloc(0));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("stops a claimed lease if its durable reservation changes", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      const url = new URL("https://www.googleadservices.com/pagead/conversion/000000000/"
        + `?label=synthetic&value=1&currency_code=USD&oid=${f.inputs.transaction_id}`
        + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid");
      gate.observe({ network_id: "synthetic-changed-reservation", url: url.href,
        method: "GET", resource_type: "XHR" });
      writeFileSync(reservation.canonical_record_path, "{}", { mode: 0o600 });
      const bytes = Buffer.from(`GET ${url.pathname + url.search} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n`);
      expect(gate.request(bytes)).toEqual(Buffer.alloc(0));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("stops a claimed lease if its single-use consumption marker disappears", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      const url = new URL("https://www.googleadservices.com/pagead/conversion/000000000/"
        + `?label=synthetic&value=1&currency_code=USD&oid=${f.inputs.transaction_id}`
        + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid");
      gate.observe({ network_id: "synthetic-missing-marker", url: url.href,
        method: "GET", resource_type: "XHR" });
      rmSync(join(f.root, `native-stock-slots-${f.authority.authority_id}`, "google-stock.consumed"));
      const bytes = Buffer.from(`GET ${url.pathname + url.search} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n`);
      expect(gate.request(bytes)).toEqual(Buffer.alloc(0));
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not forward if the case clock moves backwards", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      const { lease } = await consumeSyntheticAdditionalGoogle(prepared, reservation);
      const gate = googleAdditional.claimSyntheticGoogleLease(lease);
      const url = new URL("https://www.googleadservices.com/pagead/conversion/000000000/"
        + `?label=synthetic&value=1&currency_code=USD&oid=${f.inputs.transaction_id}`
        + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid");
      gate.observe({ network_id: "synthetic-clock-rollback", url: url.href,
        method: "GET", resource_type: "XHR" });
      vi.spyOn(Date, "now").mockReturnValue(Date.now() - 500);
      const bytes = Buffer.from(`GET ${url.pathname + url.search} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n`);
      expect(gate.request(bytes)).toEqual(Buffer.alloc(0));
    } finally { vi.restoreAllMocks(); rmSync(f.root, { recursive: true, force: true }); }
  });

  it("recognizes an additional native candidate but refuses missing owner permission before original access", () => {
    const f = fixture();
    try {
      const manifest = f.save("manifest.json", { schema_version: 1,
        kind: "airlock.inspected-google-additional-stock.v1", case_name: "google-stock",
        transport: "inspected-network", binding: {}, evidence: {}, output_dir: join(f.root, "output") });
      expect(() => prepareNativeGoogleStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
        .toThrow("google_additional_owner_permission_unavailable");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("examines a supplied synthetic case permission and refuses it as native owner permission", () => {
    const f = fixture();
    try {
      f.refresh();
      f.binding.authority = f.save("google-additional-authority.json", f.authority);
      f.binding.case_permission = f.save("google-additional-case-permission.json",
        { schema: "airlock.synthetic-google-additional-case.v1", synthetic_only: true });
      const manifest = f.save("manifest.json", { schema_version: 1,
        kind: "airlock.inspected-google-additional-stock.v1", case_name: "google-stock",
        transport: "inspected-network", binding: f.binding, evidence: {}, output_dir: join(f.root, "output") });
      expect(() => prepareNativeGoogleStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
        .toThrow("google_additional_owner_permission_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not read a non-additional case-permission path", () => {
    const f = fixture();
    try {
      f.refresh();
      f.binding.authority = f.save("google-additional-authority.json", f.authority);
      let reads = 0;
      expect(() => googleAdditional.authenticateAdditionalGoogleOwner(f.binding, () => {
        reads += 1;
        return Buffer.from("{}");
      })).toThrow("google_additional_owner_permission_invalid");
      expect(reads).toBe(0);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not mistake an internally consistent synthetic owner story for an authenticated decision", () => {
    const f = fixture();
    try {
      const { manifest } = untrustedNativeCandidate(f);
      expect(() => prepareNativeGoogleStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
        .toThrow("google_additional_owner_permission_unavailable");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("requires a case-owned admission permit before a native candidate reservation", () => {
    const f = fixture();
    try {
      const { binding } = untrustedNativeCandidate(f);
      expect(() => reserveStockSlot({ authority_path: binding.authority.path,
        authority_sha256: binding.authority.sha256, case_name: "google-stock",
        input_sha256: binding.inputs.sha256, source_sha256: binding.source_sha256,
        window: binding.window, additional_binding: binding }))
        .toThrow("invalid_google_native_reservation_permit");
      expect(existsSync(join(f.root, `native-stock-slots-${f.authority.authority_id}`))).toBe(false);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("rejects a foreign additional authority path before opening it", () => {
    const f = fixture();
    try {
      f.refresh();
      const binding = structuredClone(f.binding);
      binding.cohort = { kind: "synthetic-native-candidate", native_execution_qualified: false };
      binding.authority.path = join(f.root, "synthetic-original-authority.json");
      expect(() => reserveStockSlot({ authority_path: binding.authority.path,
        authority_sha256: binding.authority.sha256, case_name: "google-stock",
        input_sha256: binding.inputs.sha256, source_sha256: binding.source_sha256,
        window: binding.window, additional_binding: binding }))
        .toThrow("google_additional_reservation_binding_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("rejects a foreign authority locator before even an untrusted owner story can be considered", () => {
    const f = fixture();
    try {
      const { manifest } = untrustedNativeCandidate(f, permission => { permission.authority_locator.path += ".foreign"; });
      expect(() => prepareNativeGoogleStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
        .toThrow("google_additional_owner_permission_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("rejects a changed additional authority file identity", () => {
    const f = fixture();
    try {
      const { manifest } = untrustedNativeCandidate(f, permission => { permission.authority_locator.ino = "0"; });
      expect(() => prepareNativeGoogleStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
        .toThrow("google_additional_owner_permission_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["slot", "decision", "baseline", "binding", "window", "attempt", "case", "transport"])(
    "rejects a mismatched native candidate %s binding", key => {
      const f = fixture();
      try {
        const { manifest } = untrustedNativeCandidate(f, permission => {
          if (key === "slot") permission.canonical_slot_path += ".foreign";
          if (key === "decision") permission.owner_decision_sha256 = "0".repeat(64);
          if (key === "baseline") permission.lineage_baseline_sha256 = "0".repeat(64);
          if (key === "binding") permission.permission_source_sha256 = "0".repeat(64);
          if (key === "window") permission.valid_until_ms -= 1;
          if (key === "attempt") permission.attempt = "synthetic-foreign";
          if (key === "case") permission.case_name = "google-chamber";
          if (key === "transport") permission.transport = "foreign";
        });
        expect(() => prepareNativeGoogleStock({ manifest_path: manifest.path, manifest_sha256: manifest.sha256 }))
          .toThrow("google_additional_owner_permission_invalid");
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    },
  );

  it("does not trust a reader that substitutes bytes under a committed evidence digest", () => {
    const f = fixture();
    try {
      const { binding } = untrustedNativeCandidate(f);
      expect(() => googleAdditional.authenticateAdditionalGoogleOwner(binding, handle => {
        const bytes = readFileSync(handle.path);
        if (handle.path !== binding.baseline.path) return bytes;
        const baseline = JSON.parse(bytes.toString("utf8"));
        baseline.original_stock_sha256 = "f".repeat(64);
        return Buffer.from(JSON.stringify(baseline));
      })).toThrow("google_additional_owner_permission_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("compiles its synthetic owned USD1 Google policy without native authority", () => {
    const f = fixture();
    try {
      f.refresh();
      expect(inspectSyntheticAdditionalGoogle(f.binding)).toMatchObject({
        native_execution_qualified: false, execution_authority: false,
      });
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["value", "currency", "transaction", "label", "document"])(
    "rejects a foreign synthetic %s before reservation", kind => {
      const f = fixture();
      try {
        if (kind === "value") f.inputs.profile.owned.value = 2;
        if (kind === "currency") f.inputs.profile.owned.currency = "EUR";
        if (kind === "transaction") f.inputs.profile.owned.transaction_id = "foreign";
        if (kind === "label") f.inputs.profile.owned.conversion_label = "foreign";
        if (kind === "document") f.inputs.profile.document_url = "https://foreign.example/";
        f.refresh();
        expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow("google_additional_inputs_invalid");
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    },
  );

  it.each(["original_authority_sha256", "original_stock_sha256", "original_chamber_sha256"])(
    "rejects a foreign synthetic original binding for %s", key => {
      const f = fixture();
      try {
        f.baseline[key] = "d".repeat(64);
        f.refresh();
        expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow("google_additional_lineage_invalid");
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    },
  );

  it("uses a separate nonrefundable reservation and one in-process consumer", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const competing = inspectSyntheticAdditionalGoogle(f.binding);
      expect(prepared).toMatchObject({ native_execution_qualified: false, execution_authority: false });
      const reservation = reserveStockSlot(f.options());
      expect(reservation).toMatchObject({ reserved: true, network_authorized: false });
      expect(() => reserveStockSlot(f.options())).toThrow("stock_slot_spent");
      expect(await consumeSyntheticAdditionalGoogle(prepared, reservation)).toMatchObject({
        native_execution_qualified: false, execution_authority: false,
      });
      await expect(consumeSyntheticAdditionalGoogle(prepared, reservation)).rejects.toThrow("google_additional_plan_spent");
      await expect(consumeSyntheticAdditionalGoogle(competing, reservation)).rejects.toThrow("google_additional_attempt_spent");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not refund a reserved attempt when its consumer fails", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const competing = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      await expect(consumeSyntheticAdditionalGoogle(prepared, { ...reservation, network_authorized: true }))
        .rejects.toThrow("google_additional_reservation_invalid");
      await expect(consumeSyntheticAdditionalGoogle(competing, reservation)).rejects.toThrow("google_additional_attempt_spent");
      expect(() => reserveStockSlot(f.options())).toThrow("stock_slot_spent");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not accept a copied reservation as a consumer capability", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      await expect(consumeSyntheticAdditionalGoogle(prepared, structuredClone(reservation)))
        .rejects.toThrow("google_additional_reservation_invalid");
      await expect(consumeSyntheticAdditionalGoogle(prepared, reservation)).rejects.toThrow("google_additional_plan_spent");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("does not accept a copied preparation as a consumer capability", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      await expect(consumeSyntheticAdditionalGoogle(structuredClone(prepared), reservation))
        .rejects.toThrow("google_additional_plan_invalid");
      expect(await consumeSyntheticAdditionalGoogle(prepared, reservation)).toMatchObject({
        native_execution_qualified: false, execution_authority: false,
      });
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("refuses preparation of a lineage after its durable consumer marker exists", async () => {
    const f = fixture();
    try {
      f.refresh();
      const prepared = inspectSyntheticAdditionalGoogle(f.binding);
      const reservation = reserveStockSlot(f.options());
      await consumeSyntheticAdditionalGoogle(prepared, reservation);
      expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow("google_additional_attempt_spent");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each([
    ["source", "google_additional_source_stale"],
    ["cohort", "google_additional_cohort_invalid"],
    ["window", "google_additional_window_inactive"],
    ["authority", "google_additional_authority_invalid"],
    ["lineage", "google_additional_lineage_invalid"],
    ["decision", "google_additional_decision_invalid"],
    ["inputs", "google_additional_inputs_invalid"],
    ["witness", "google_additional_witness_invalid"],
    ["review", "google_additional_review_invalid"],
    ["case", "google_additional_case_invalid"],
  ])("rejects changed %s before reservation", (kind, error) => {
    const f = fixture();
    try {
      f.refresh();
      if (kind === "source") f.binding.source_sha256 = "0".repeat(64);
      if (kind === "cohort") f.binding.cohort.kind = "foreign";
      if (kind === "window") f.binding.window.expires_at_ms = Date.now() - 1;
      if (kind === "authority") { f.authority.attempt = "foreign"; f.refresh(); }
      if (kind === "lineage") { f.baseline.lineage = "foreign"; f.refresh(); }
      if (kind === "decision") { f.decision.attempt = "foreign"; f.refresh(); }
      if (kind === "inputs") { f.inputs.lineage = "foreign"; f.refresh(); }
      if (kind === "witness") f.binding.witness = f.save("witness.json", { synthetic_only: false });
      if (kind === "review") f.binding.review = f.save("review.json", { synthetic_only: false });
      if (kind === "case") f.binding.case_permission = f.save("case.json", { synthetic_only: false });
      expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow(error);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["authority", "baseline", "decision", "inputs", "witness", "review", "case_permission"])(
    "rejects a missing %s original fixture", key => {
      const f = fixture();
      try {
        f.refresh();
        rmSync(f.binding[key].path);
        expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow("google_additional_handle_unavailable");
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    },
  );

  it("rejects changed private fixture bytes without adopting their new digest", () => {
    const f = fixture();
    try {
      f.refresh();
      f.save("inputs.json", { ...f.inputs, transaction_id: "foreign" });
      expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow("google_additional_handle_stale");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it("rejects a fixture authority that claims it is not synthetic", () => {
    const f = fixture();
    try {
      f.authority.synthetic_only = false;
      f.refresh();
      expect(() => inspectSyntheticAdditionalGoogle(f.binding)).toThrow("google_additional_authority_invalid");
      expect(() => reserveStockSlot(f.options())).toThrow("google_additional_authority_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });

  it.each(["inputs", "source", "window", "clock"])("refuses a conflicting reservation %s", kind => {
    const f = fixture();
    try {
      f.refresh();
      const options = f.options();
      if (kind === "inputs") options.input_sha256 = "0".repeat(64);
      if (kind === "source") options.source_sha256 = "0".repeat(64);
      if (kind === "window") options.window = { ...options.window, expires_at_ms: options.window.expires_at_ms - 1 };
      if (kind === "clock") options.clock = () => Date.now();
      expect(() => reserveStockSlot(options)).toThrow("google_additional_reservation_binding_invalid");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});
