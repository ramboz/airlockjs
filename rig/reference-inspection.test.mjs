import { execFile } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const load = () => import("./reference-inspection.mjs");
const preface = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
const request = Buffer.from("GET /pixel?item=%2f&item=%2F HTTP/1.1\r\nHost: collector.test.invalid\r\nX-Example: one\r\nX-Example: two\r\n\r\n");
function frame(type, flags, stream, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(9);
  header.writeUIntBE(body.length, 0, 3); header[3] = type; header[4] = flags;
  header.writeUInt32BE(stream, 5);
  return Buffer.concat([header, body]);
}
const headers = stream => frame(1, 5, stream, Buffer.from([0x82, 0x87, 0x84]));

describe("local inspected physical-request budget", () => {
  it("rejects unclosed or accessor options before invoking them", async () => {
    const { createPhysicalRequestBudget } = await load();
    for (const options of [{ limit: 0 }, { limit: 9 }, { enforce: "no" }, { arbitrary: true },
      { get limit() { throw Error("getter_called"); } }])
      expect(() => createPhysicalRequestBudget(options)).toThrow("invalid_physical_budget");
  });

  describe("fixed local inspected-network experiment", () => {
    it("rejects native/source/URL/accessor input before filesystem or networking", async () => {
      const { runLocalInspection } = await load();
      for (const options of [
        { outputDir: "/unused", native: true }, { outputDir: "/unused", url: "https://example.invalid" },
        { outputDir: "/unused", source: "/unused" }, { get outputDir() { throw Error("getter_called"); } },
        { outputDir: "/unused", [Symbol("extra")]: true },
        { outputDir: "/unused", cohort: "native" }, { outputDir: "/unused", cohort: undefined },
        { outputDir: "/unused", get cohort() { throw Error("getter_called"); } },
        { outputDir: "/unused", cohort: "declared-meta", url: "https://www.facebook.com/tr/" },
        { outputDir: "/unused", cohort: "declared-meta", resolveObservation: () => [] },
        { outputDir: "/unused", cohort: "declared-meta", native: true },
      ]) await expect(runLocalInspection(options)).rejects.toThrow("invalid_inspection_options");
    });

    it("rejects arbitrary or native CLI programs and bare cohort aliases without touching output", async () => {
      const entry = fileURLToPath(new URL("./reference-inspection.mjs", import.meta.url));
      for (const flag of ["request", "--execute", "--qualify-native", "--program=anything",
        "declared-meta", "--qualify-declared-meta=anything"]) {
        const child = await promisify(execFile)(process.execPath, [entry, flag, "--output-dir", "/unused"], { timeout: 5000 })
          .catch(error => error);
        expect(child.code).toBe(3);
        expect(child.stderr.trim()).toBe("invalid_inspection_options");
      }
    });

    it("rejects a declared-cohort proxy before any trap or IO", async () => {
      let calls = 0;
      const trap = () => { calls++; throw new Error("must_not_run"); };
      const input = new Proxy({ outputDir: "/unused", cohort: "declared-meta" },
        { get: trap, getPrototypeOf: trap, ownKeys: trap });
      await expect((await load()).runLocalInspection(input)).rejects.toThrow("invalid_inspection_options");
      expect(calls).toBe(0);
    });

    it.runIf(process.env.AIRLOCK_REFERENCE_INSPECTION_QUALIFICATION === "1")(
      "witnesses actual cross-origin Chrome H1/H2 bytes and bounded hidden retries", async () => {
        await mkdir("rig/out", { recursive: true });
        const root = await mkdtemp(join(await realpath("rig/out"), "inspection-witness-"));
        const output = join(root, "run"), entry = fileURLToPath(new URL("./reference-inspection.mjs", import.meta.url));
        const command = [entry, "--qualify", "--output-dir", output];
        const commandStarted = performance.now();
        let child;
        try {
          child = { ...await promisify(execFile)(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }),
            code: 0, signal: null };
        } catch (error) {
          child = { code: error.code, signal: error.signal ?? null, stdout: error.stdout, stderr: error.stderr };
        }
        child.elapsed_external_ms = Math.ceil(performance.now() - commandStarted);
        await writeFile(join(root, "actual-child.json"), JSON.stringify({
          command, ...child, command_exit_observed: true,
        }), { flag: "wx", mode: 0o600, flush: true });
        const hash = bytes => createHash("sha256").update(bytes).digest("hex");
        const originals = await readFile(join(output, "capture.json"));
        const reportBytes = await readFile(join(output, "report.json"));
        const completion = JSON.parse(await readFile(join(output, "completion.json")));
        await writeFile(join(root, "verified-child.json"), JSON.stringify({
          command, ...child, command_exit_observed: true,
          report_sha256: hash(reportBytes), capture_sha256: hash(originals),
        }), { flag: "wx", mode: 0o600, flush: true });
        console.log(JSON.stringify({ category: "local_inspection_witness_written", witnesses: 1 }));
        const report = JSON.parse(reportBytes);
        expect(child.code).toBe(0);
        expect(child.elapsed_external_ms).toBeLessThan(60000);
        expect(completion).toMatchObject({ producer_exit_code: 0, command_exit_observed: false,
          report_sha256: hash(reportBytes), capture_sha256: hash(originals) });
        expect(completion.window).toEqual(report.window);
        expect(completion.publication.resources_closed_at_ms).toBeLessThanOrEqual(completion.publication.attempted_at_ms);
        expect(completion.publication.attempted_at_ms).toBeLessThan(report.window.expires_at_ms);
        expect(report).toMatchObject({ local_count_qualified: true, local_semantic_response_qualified: true, inspected_network: true,
          native_tls_parity: false, native_execution_qualified: false,
          official_sdk_executed: false, public_upstream_requests: 0, owner_slots_reserved: 0 });
        expect(report.errors).toEqual([]);
        expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
        for (const protocol of ["h1", "h2"]) {
          const rows = report.cases.filter(row => row.protocol === protocol);
          expect(rows.find(row => row.kind === "normal")).toMatchObject({
            receiver_attempts: 2, cross_origin: true, original_bytes_equal: true, cookie_attached: true,
            browser_originals_match: true, semantic_requests: 2, complete_original_responses: 2,
            sink_response_originals_match: true, duplicate_set_cookie_observed: true,
          });
          expect(rows.find(row => row.kind === "retry-enforced")).toMatchObject({
            receiver_attempts: 8, observed_header_starts: 9, forwarded: 8, reason: "physical_request_limit",
            original_bytes_equal: true,
          });
          expect(rows.find(row => row.kind === "retry-bypass")).toMatchObject({
            receiver_attempts: 9, observed_header_starts: 9, forwarded: 9, original_bytes_equal: true,
          });
          if (protocol === "h2") {
            expect(rows.find(row => row.kind === "retry-enforced")).toMatchObject({ same_session_h2_retry: true, logical_admissions: 8, http_tunnels: 1 });
            expect(rows.find(row => row.kind === "retry-bypass")).toMatchObject({ same_session_h2_retry: true, logical_admissions: 8, http_tunnels: 1 });
          }
        }
        expect(report.controls).toMatchObject({
          untrusted_local_peer_denied: true, wrong_authority_denied: true,
          missing_logical_authority_denied: true, upstream_untrusted_certificate_denied: true,
          upstream_wrong_name_denied: true,
        });
        expect(report.cases.find(row => row.kind === "untrusted-cert").certificate_error)
          .toBe("DEPTH_ZERO_SELF_SIGNED_CERT");
        expect(report.cases.find(row => row.kind === "wrong-name").certificate_error)
          .toBe("ERR_TLS_CERT_ALTNAME_INVALID");
      }, 70000);

    for (const cohort of ["request", "response", "compression", "aggregate"]) {
      it.runIf(process.env.AIRLOCK_REFERENCE_INSPECTION_SEMANTIC_QUALIFICATION === "1")(
        `witnesses the fixed ${cohort} cohort against actual local Chrome sinks`, async () => {
          await mkdir("rig/out", { recursive: true });
          const root = await mkdtemp(join(await realpath("rig/out"), `inspection-${cohort}-witness-`));
          const output = join(root, "run"), entry = fileURLToPath(new URL("./reference-inspection.mjs", import.meta.url));
          const command = [entry, "--qualify-" + cohort, "--output-dir", output];
          const commandStarted = performance.now();
          let child;
          try {
            child = { ...await promisify(execFile)(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }), code: 0, signal: null };
          } catch (caught) {
            child = { code: caught.code, signal: caught.signal ?? null, stdout: caught.stdout, stderr: caught.stderr };
          }
          child.elapsed_external_ms = Math.ceil(performance.now() - commandStarted);
          await writeFile(join(root, "actual-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true }),
            { flag: "wx", mode: 0o600, flush: true });
          const reportBytes = await readFile(join(output, "report.json")), captureBytes = await readFile(join(output, "capture.json"));
          const hash = bytes => createHash("sha256").update(bytes).digest("hex");
          await writeFile(join(root, "verified-child.json"), JSON.stringify({
            command, ...child, command_exit_observed: true, report_sha256: hash(reportBytes), capture_sha256: hash(captureBytes),
          }), { flag: "wx", mode: 0o600, flush: true });
          console.log(JSON.stringify({ category: "local_inspection_witness_written", witnesses: 1 }));
          const report = JSON.parse(reportBytes), capture = JSON.parse(captureBytes);
          expect(child.code).toBe(0);
          expect(child.elapsed_external_ms).toBeLessThan(60000);
          expect(child.stderr).toBe("");
          const originals = new Map();
          for (const row of capture.cases) {
            const bytes = await readFile(join(output, row.originals_file));
            expect(hash(bytes)).toBe(row.originals_sha256);
            originals.set(row.protocol + "/" + row.kind, JSON.parse(bytes));
          }
          expect(report).toMatchObject({ diagnostic_cohort: cohort, local_composition_qualified: true,
            full_native_guard_qualified: false, native_execution_qualified: false, official_sdk_executed: false,
            public_upstream_requests: 0, owner_slots_reserved: 0, execution_authority: false });
          expect(report.errors).toEqual([]);
          expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
          expect(report.source_before).toEqual(report.source_after);
          for (const row of report.cases) {
            expect(row.case_qualified, row.protocol + "/" + row.kind).toBe(true);
            expect(row.receiver_attempts).toBe(row.expected_sink_attempts);
            expect(row.reason).toBe(row.expected_guard);
            expect(row.request_wire_equal).toBe(true);
            expect(row.retention.peak_retained_bytes).toBeLessThanOrEqual(8388608);
            expect(row.retention.peak_response_bytes).toBeLessThanOrEqual(2097152);
            if (!row.expected_guard && !row.bypass) {
              expect(row.complete_original_responses).toBe(row.receiver_attempts);
              expect(row.sink_response_originals_match).toBe(true);
              expect(row.response_wire_equal).toBe(true);
              if (cohort !== "request") expect(row.browser_decoded_originals_match).toBe(true);
            }
          }
          if (cohort === "request") {
            for (const protocol of ["h1", "h2"]) {
              const rows = report.cases.filter(row => row.protocol === protocol);
              expect(rows.find(row => row.kind === "marker-enforced")).toMatchObject({ receiver_attempts: 1, semantic_requests: 1 });
              expect(rows.find(row => row.kind === "marker-bypass")).toMatchObject({ receiver_attempts: 2 });
              const exact = originals.get(protocol + "/header-exact");
              expect(exact.observations.requests.at(-1).header_bytes).toBe(65536);
            }
          }
          if (["response", "compression"].includes(cohort))
            for (const row of [...originals.values()].filter(row => row.kind.endsWith("-exact")))
              expect(row.observations.responses.at(-1).header_bytes + row.observations.responses.at(-1).decoded_body_bytes).toBe(2097152);
        }, 70000);
    }

    it.runIf(process.env.AIRLOCK_REFERENCE_INSPECTION_TRANSPORT_QUALIFICATION === "1")(
      "does not turn a real upstream TCP reset into clean close-delimited completion or a redirect grant", async () => {
        await mkdir("rig/out", { recursive: true });
        const root = await mkdtemp(join(await realpath("rig/out"), "inspection-transport-witness-")), output = join(root, "run");
        const command = [fileURLToPath(new URL("./reference-inspection.mjs", import.meta.url)), "--qualify-transport", "--output-dir", output];
        const started = performance.now();
        let child;
        try { child = { ...await promisify(execFile)(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }), code: 0 }; }
        catch (caught) { child = { code: caught.code, signal: caught.signal ?? null, stdout: caught.stdout, stderr: caught.stderr }; }
        child.elapsed_external_ms = Math.ceil(performance.now() - started);
        await writeFile(join(root, "actual-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true }),
          { flag: "wx", mode: 0o600, flush: true });
        const reportBytes = await readFile(join(output, "report.json")), captureBytes = await readFile(join(output, "capture.json"));
        const hash = bytes => createHash("sha256").update(bytes).digest("hex");
        await writeFile(join(root, "verified-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true,
          report_sha256: hash(reportBytes), capture_sha256: hash(captureBytes) }), { flag: "wx", mode: 0o600, flush: true });
        const report = JSON.parse(reportBytes), capture = JSON.parse(captureBytes), originals = new Map();
        for (const row of capture.cases) {
          const bytes = await readFile(join(output, row.originals_file));
          expect(hash(bytes)).toBe(row.originals_sha256);
          originals.set(row.kind, JSON.parse(bytes));
        }
        expect(originals.get("close-normal")).toMatchObject({ receiver_attempts: 1, complete_original_responses: 1,
          reason: null, image_outcomes: [true], browser_decoded_originals_match: true });
        for (const kind of ["close-reset", "close-redirect-reset", "transport-reset"]) {
          const row = originals.get(kind);
          expect(row.reset_fixture_injected).toBe(true);
          expect(row.receiver_attempts).toBe(1);
          expect(row.complete_original_responses).toBe(0);
          expect(row.reason).toBe("upstream_connection_reset");
          expect(row.image_outcomes).toEqual([false]);
          expect(row.observations.responses[0]).toMatchObject({ state: "inconclusive", body: "",
            headers: [], transport_error: "upstream_connection_reset" });
          expect(row.observations.requests[0].response_state).toBe("inconclusive");
          expect(row.tunnels[0].upstream_termination).toBe("upstream_connection_reset");
          expect(Buffer.from(row.tunnels[0].response, "base64").length).toBeGreaterThan(20);
        }
        expect(originals.get("close-redirect-reset").observed_redirect_edges).toBe(0);
        expect(originals.get("transport-normal")).toMatchObject({ complete_original_responses: 1, image_outcomes: [true] });
        expect(child.code).toBe(0);
        expect(child.elapsed_external_ms).toBeLessThan(60000);
        expect(report.source_before).toEqual(report.source_after);
        expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
        expect(report).toMatchObject({ full_native_guard_qualified: false, native_execution_qualified: false,
          execution_authority: false, owner_slots_reserved: 0, public_upstream_requests: 0, official_sdk_executed: false });
      }, 70000);

    it.runIf(process.env.AIRLOCK_REFERENCE_INSPECTION_DECLARED_META_QUALIFICATION === "1")(
      "qualifies the fixed declared Meta profile from actual local Chrome CDP lineage and physical originals", async () => {
        const root = join(await realpath("rig/out"), "inspection-declared-meta-witness-" + Date.now());
        await mkdir(root, { mode: 0o700 });
        const output = join(root, "run"), command = [
          fileURLToPath(new URL("./reference-inspection.mjs", import.meta.url)), "--qualify-declared-meta", "--output-dir", output,
        ], started = performance.now();
        let child;
        try { child = { ...await promisify(execFile)(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }), code: 0 }; }
        catch (caught) { child = { code: caught.code, signal: caught.signal ?? null, stdout: caught.stdout, stderr: caught.stderr }; }
        child.elapsed_external_ms = Math.ceil(performance.now() - started);
        await writeFile(join(root, "actual-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true }),
          { flag: "wx", mode: 0o600, flush: true });
        const reportBytes = await readFile(join(output, "report.json")), captureBytes = await readFile(join(output, "capture.json"));
        const hash = bytes => createHash("sha256").update(bytes).digest("hex"), report = JSON.parse(reportBytes);
        const completion = JSON.parse(await readFile(join(output, "completion.json"))), capture = JSON.parse(captureBytes), originals = new Map();
        for (const row of capture.cases) {
          const bytes = await readFile(join(output, row.originals_file));
          expect(hash(bytes)).toBe(row.originals_sha256);
          originals.set(row.protocol + "/" + row.kind, JSON.parse(bytes));
        }
        await writeFile(join(root, "verified-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true,
          report_sha256: hash(reportBytes), capture_sha256: hash(captureBytes), case_digests_verified: originals.size }),
        { flag: "wx", mode: 0o600, flush: true });
        console.log(JSON.stringify({ category: "local_declared_meta_witness_written", witnesses: 1 }));
        expect(child.code).toBe(0);
        expect(child.elapsed_external_ms).toBeLessThan(60000);
        expect(completion).toMatchObject({ command_exit_observed: false, producer_exit_code: 0,
          report_sha256: hash(reportBytes), capture_sha256: hash(captureBytes) });
        expect(report).toMatchObject({ local_declared_profile_qualified: true, local_count_qualified: false,
          local_composition_qualified: false, captured_reference_accepted: false,
          full_native_guard_qualified: false, execution_authority: false, native_tls_parity: false,
          source_bytes_verified: false, independent_ownership_authentication: false, matching_qualified: false,
          official_sdk_executed: false, public_upstream_requests: 0, owner_slots_reserved: 0 });
        expect(report.errors).toEqual([]);
        expect(report.source_before).toEqual(report.source_after);
        for (const file of ["inspected-meta-policy.mjs", "inspected-meta-policy.test.mjs"])
          expect(report.source_before[file]).toBe(hash(await readFile(new URL(file, import.meta.url))));
        expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
        expect(Object.values(report.controls).every(Boolean)).toBe(true);
        for (const protocol of ["h1", "h2"]) {
          const normal = originals.get(protocol + "/normal"), redirect = originals.get(protocol + "/redirect");
          expect(normal).toMatchObject({ receiver_attempts: 2, semantic_requests: 2, complete_original_responses: 2,
            original_bytes_equal: true, cookie_attached: true, browser_originals_match: true, duplicate_set_cookie_observed: true });
          expect(normal.logical_observations.every(row => row.resource_type === "Image"
            && row.network_id && row.fetch_id && row.network_resource_type === row.resource_type)).toBe(true);
          for (const [index, request] of normal.observations.requests.entries()) {
            const actual = normal.receiver[index].headers;
            expect(request.headers).toEqual(Array.from({ length: actual.length / 2 }, (_, n) => [actual[n * 2], actual[n * 2 + 1]]));
            expect(request.policy_decision).toMatchObject({ dispatch_authorized: false, source_bytes_verified: false,
              independent_ownership_authentication: false });
          }
          expect(redirect).toMatchObject({ receiver_attempts: 2, observed_redirect_edges: 1, browser_redirect_edges: 1,
            complete_original_responses: 2, case_qualified: true });
          expect(redirect.logical_observations).toHaveLength(2);
          expect(redirect.logical_observations[0].network_id).toBe(redirect.logical_observations[1].network_id);
          expect(redirect.logical_observations[0].fetch_id).not.toBe(redirect.logical_observations[1].fetch_id);
          expect(redirect.observations.requests.map(row => [row.ordinal, row.policy_ordinal, row.redirect_from]))
            .toEqual([[1, 0, null], [2, 1, 1]]);
          expect(Buffer.from(redirect.observations.responses[0].body, "base64").toString())
            .toBe("synthetic original redirect body");
          for (const kind of ["marker", "field", "fetch", "missing-binding", "ambiguous-binding"]) {
            const denied = originals.get(protocol + "/" + kind + "-enforced");
            const bypass = originals.get(protocol + "/" + kind + "-bypass");
            const early = ["fetch", "missing-binding", "ambiguous-binding"].includes(kind);
            expect(denied).toMatchObject({ receiver_attempts: early ? 0 : 1, case_qualified: true,
              bypass: false, matched_positive: "normal" });
            expect(bypass).toMatchObject({ receiver_attempts: early ? 1 : 2, case_qualified: true, bypass: true });
            expect(denied.reason).toBe(kind === "marker" ? "owned_input_mismatch"
              : ["field", "fetch"].includes(kind) ? "unqualified_route_or_field" : "missing_or_ambiguous_logical_observation");
            expect(bypass.reason).toBe(null);
            if (!early) {
              expect(denied.http_tunnels).toBe(1); expect(bypass.http_tunnels).toBe(1);
              expect(denied.image_outcomes).toEqual([true, false]); expect(bypass.image_outcomes).toEqual([true, true]);
            }
            if (kind === "fetch") {
              expect(denied.logical_observations[0]).toMatchObject({ url: normal.logical_observations[0].url,
                method: "GET", resource_type: "Fetch", network_resource_type: "Fetch", fetch_resource_type: "XHR" });
              expect(bypass.logical_observations[0]).toMatchObject({ url: normal.logical_observations[0].url,
                method: "GET", resource_type: "Fetch", network_resource_type: "Fetch", fetch_resource_type: "XHR" });
              expect(denied.observations.requests).toEqual([]);
              expect(bypass.receiver[0].method).toBe("GET");
            }
            if (kind.includes("binding")) {
              expect(denied.logical_observations).toHaveLength(1);
              expect(denied.logical_observations[0].resource_type).toBe("Image");
            }
          }
          const enforced = originals.get(protocol + "/retry-enforced"), bypass = originals.get(protocol + "/retry-bypass");
          expect(enforced).toMatchObject({ receiver_attempts: 8, observed_header_starts: 9, forwarded: 8,
            reason: "physical_request_limit", logical_admissions: 8, case_qualified: true });
          expect(bypass).toMatchObject({ receiver_attempts: 9, observed_header_starts: 9, forwarded: 9,
            reason: null, logical_admissions: 8, case_qualified: true });
          expect(enforced.observations.requests.map(row => row.policy_ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        }
        const retry = originals.get("h2/retry-positive"), requests = retry.observations.requests;
        expect(retry).toMatchObject({ receiver_attempts: 3, semantic_requests: 3, complete_original_responses: 2,
          logical_admissions: 2, http_tunnels: 1, hidden_retry_mapping_verified: true, case_qualified: true });
        expect(requests.map(row => [row.ordinal, row.policy_ordinal])).toEqual([[1, 0], [2, 1], [3, 2]]);
        expect(requests[1].logical_network_id).toBe(requests[2].logical_network_id);
        expect(requests[1].logical_fetch_id).toBe(requests[2].logical_fetch_id);
        expect(retry.logical_observations).toHaveLength(2);
        expect(retry.network_events).toHaveLength(2);
        expect(retry.fetch_events).toHaveLength(2);
        expect(report.tls_boundary).toMatchObject({ upstream_address: "127.0.0.1", upstream_sni: "www.facebook.com",
          upstream_reject_unauthorized: true, browser_exact_spki_exception: true, browser_system_trust_changed: false });
        for (const role of ["inspector", "upstream"]) {
          const bytes = await readFile(join(output, role + "-certificate.pem")), cert = new X509Certificate(bytes);
          expect(cert.checkHost("www.facebook.com")).toBe("www.facebook.com");
          expect(hash(bytes)).toBe(report.tls_boundary[role + "_certificate_sha256"]);
          if (role === "inspector") expect(createHash("sha256").update(cert.publicKey.export({ type: "spki", format: "der" })).digest("base64"))
            .toBe(report.tls_boundary.inspector_spki_sha256_base64);
          await expect(readFile(join(output, role + "-key.pem"))).rejects.toMatchObject({ code: "ENOENT" });
        }
      }, 70000);

    for (const [cohort, category] of [["deadline", "diagnostic_deadline"], ["close-failure", "diagnostic_context_close_failure"],
      ["output-failure", "diagnostic_output_failure"], ["late-output", "inspection_output_deadline"]]) {
      it.runIf(process.env.AIRLOCK_REFERENCE_INSPECTION_LIFECYCLE_QUALIFICATION === "1")(
        `retains a blocked ${cohort} receipt and closes real owned browser/receiver resources`, async () => {
          await mkdir("rig/out", { recursive: true });
          const root = await mkdtemp(join(await realpath("rig/out"), `inspection-${cohort}-witness-`)), output = join(root, "run");
          const command = [fileURLToPath(new URL("./reference-inspection.mjs", import.meta.url)),
            "--qualify-" + cohort, "--output-dir", output];
          const commandStarted = performance.now();
          let child;
          try { child = { ...await promisify(execFile)(process.execPath, command, { timeout: 65000, maxBuffer: 8192 }), code: 0 }; }
          catch (caught) { child = { code: caught.code, signal: caught.signal ?? null, stdout: caught.stdout, stderr: caught.stderr }; }
          child.elapsed_external_ms = Math.ceil(performance.now() - commandStarted);
          await writeFile(join(root, "actual-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true }),
            { flag: "wx", mode: 0o600, flush: true });
          const reportBytes = await readFile(join(output, "report.json")), report = JSON.parse(reportBytes);
          const captureBytes = await readFile(join(output, "capture.json"));
          const failureBytes = cohort === "late-output" ? await readFile(join(output, "failure-finalization.json")).catch(() => null) : null;
          await writeFile(join(root, "verified-child.json"), JSON.stringify({ command, ...child, command_exit_observed: true,
            report_sha256: createHash("sha256").update(reportBytes).digest("hex"),
            capture_sha256: createHash("sha256").update(captureBytes).digest("hex"),
            ...(failureBytes ? { finalization_failure_sha256: createHash("sha256").update(failureBytes).digest("hex") } : {}),
          }), { flag: "wx", mode: 0o600, flush: true });
          console.log(JSON.stringify({ category: "blocked_inspection_witness_written", witnesses: 1 }));
          expect(child.code).toBe(cohort === "late-output" ? 3 : 2);
          expect(child.elapsed_external_ms).toBeLessThan(60000);
          if (cohort === "late-output") expect(report.cases).toHaveLength(2);
          expect(report).toMatchObject({ local_composition_qualified: cohort === "late-output", native_execution_qualified: false,
            official_sdk_executed: false, execution_authority: false });
          expect(Object.values(report.cleanup).every(Boolean)).toBe(true);
          expect(report.source_before).toEqual(report.source_after);
          if (cohort !== "late-output") expect(report.lifecycle_controls[category]).toBe(true);
          if (cohort === "deadline") {
            expect(report.cases[0]).toMatchObject({ receiver_attempts: 2, reason: category, complete_original_responses: 1 });
          } else if (cohort === "late-output") {
            // This preserved early report cannot attest a future command
            // exit; a deadline-bound finalization failure invalidates it.
            expect(report.errors).toEqual([]);
            expect(report.producer_exit_code).toBe(0);
            const failure = JSON.parse(failureBytes);
            expect(failure).toMatchObject({ producer_exit_code: 2, command_exit_observed: false,
              captured_reference_accepted: false, failure_category: category, errors: [category],
              window: report.window, cleanup: { deadline_met: false },
              report_sha256: createHash("sha256").update(reportBytes).digest("hex"),
              capture_sha256: createHash("sha256").update(captureBytes).digest("hex") });
            expect(Object.entries(failure.cleanup).filter(([name]) => name !== "deadline_met").every(([, closed]) => closed === true)).toBe(true);
            expect(report.window.expires_at_ms - report.window.not_before_ms).toBe(15000);
            expect(failure.publication.resources_closed_at_ms).toBeLessThan(report.window.expires_at_ms);
            expect(failure.publication.report_write_started_at_ms).toBeLessThan(report.window.expires_at_ms);
            expect(failure.publication.attempted_at_ms).toBeGreaterThanOrEqual(report.window.expires_at_ms);
            expect(failure.elapsed_ms).toBeLessThan(60000);
            const capture = JSON.parse(captureBytes);
            expect(capture.cases).toHaveLength(2);
            for (const item of capture.cases) {
              const bytes = await readFile(join(output, item.originals_file));
              expect(createHash("sha256").update(bytes).digest("hex")).toBe(item.originals_sha256);
              const original = JSON.parse(bytes);
              expect(original.observations.responses).toHaveLength(2);
              expect(original.observations.responses.every(response => response.state === "complete")).toBe(true);
            }
            expect(report.source_before).toEqual(report.source_after);
            await expect(readFile(join(output, "completion.json"))).rejects.toMatchObject({ code: "ENOENT" });
          } else {
            expect(report.errors).toContain(category);
            expect(report.available_case_evidence_preserved).toBe(true);
            if (cohort === "close-failure") expect(report.lifecycle_controls.context_close_retry_observed).toBe(true);
            expect(report.cases).toHaveLength(1);
            expect(report.cases[0]).toMatchObject({ receiver_attempts: 2, observed_header_starts: 2, forwarded: 2,
              reason: null, complete_original_responses: 2, failure: category, case_qualified: false });
            const capture = JSON.parse(await readFile(join(output, "capture.json")));
            expect(capture.cases).toHaveLength(1);
            const entry = capture.cases[0];
            expect(entry.failure_after_cleanup).toBe(true);
            expect(entry.originals_file).toBe(`failure-case-h1-${cohort}.json`);
            const bytes = await readFile(join(output, entry.originals_file));
            expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.originals_sha256);
            const originals = JSON.parse(bytes);
            expect(originals.receiver).toHaveLength(2);
            expect(originals.observations.requests).toHaveLength(2);
            expect(originals.retention).toMatchObject({ observed: 2, forwarded: 2, stopped: false, reason: null });
            expect(Object.values(originals.resource_cleanup).every(Boolean)).toBe(true);
            expect(originals.observations.responses).toHaveLength(2);
            for (const response of originals.observations.responses) {
              expect(response.state).toBe("complete");
              const body = Buffer.from(response.body, "base64");
              expect(body.length).toBeGreaterThan(0);
              expect(createHash("sha256").update(body).digest("hex")).toBe(originals.receiver[response.ordinal - 1].response_body_sha256);
            }
            expect(originals.tunnels.some(tunnel => Buffer.from(tunnel.request, "base64").length > 0
              && Buffer.from(tunnel.response, "base64").length > 0)).toBe(true);
            if (cohort === "output-failure") {
              const collision = await readFile(join(output, "case-h1-output-failure.json"));
              expect(JSON.parse(collision)).toEqual({ synthetic_collision_not_originals: true });
              expect(entry.collided_output_sha256).toBe(createHash("sha256").update(collision).digest("hex"));
              expect(entry.collided_output_unchanged).toBe(true);
            }
          }
        }, 70000);
    }
  });

  it("holds fragmented H1 headers and preserves original case, escapes and duplicate fields", async () => {
    const budget = (await load()).createPhysicalRequestBudget(), connection = budget.connection("h1");
    expect(connection.push(request.subarray(0, 31))).toEqual(Buffer.alloc(0));
    expect(connection.push(request.subarray(31))).toEqual(request);
    expect(budget.snapshot()).toMatchObject({ observed: 1, forwarded: 1, stopped: false });
  });

  it("counts physical H1 retries across replacement connections before the ninth request", async () => {
    const budget = (await load()).createPhysicalRequestBudget();
    for (let n = 0; n < 8; n++) expect(budget.connection("h1").push(request)).toEqual(request);
    expect(budget.connection("h1").push(request)).toEqual(Buffer.alloc(0));
    expect(budget.snapshot()).toMatchObject({ observed: 9, forwarded: 8, stopped: true, reason: "physical_request_limit" });
  });

  it("has a matched explicit diagnostic bypass, not a higher claimed limit", async () => {
    const budget = (await load()).createPhysicalRequestBudget({ enforce: false }), connection = budget.connection("h1");
    const bytes = Buffer.concat(Array(9).fill(request));
    expect(connection.push(bytes)).toEqual(bytes);
    expect(budget.snapshot()).toMatchObject({ limit: 8, enforced: false, observed: 9, forwarded: 9 });
  });

  it("rejects request bodies, malformed lines and incomplete H1 originals rather than forwarding partial requests", async () => {
    for (const bytes of [
      Buffer.from("GET / HTTP/1.1\r\nContent-Length: 1\r\n\r\nx"),
      Buffer.from("GET / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n"),
      Buffer.from("POST / HTTP/1.1\r\n\r\n"), Buffer.from("GET / HTTP/1.1\r\nX: a\0b\r\n\r\n"),
    ]) {
      const budget = (await load()).createPhysicalRequestBudget();
      expect(budget.connection("h1").push(bytes)).toEqual(Buffer.alloc(0));
      expect(budget.snapshot().stopped).toBe(true);
    }
    const budget = (await load()).createPhysicalRequestBudget(), connection = budget.connection("h1");
    expect(connection.push(request.subarray(0, -1))).toEqual(Buffer.alloc(0));
    connection.end();
    expect(budget.snapshot()).toMatchObject({ forwarded: 0, stopped: true, reason: "incomplete_request" });
  });

  it("accepts the exact raw H1 header bound and rejects one over without forwarding", async () => {
    const prefix = "GET / HTTP/1.1\r\nX: ", suffix = "\r\n\r\n";
    for (const extra of [0, 1]) {
      const bytes = Buffer.from(prefix + "a".repeat(65536 - prefix.length - suffix.length + extra) + suffix);
      const budget = (await load()).createPhysicalRequestBudget();
      const forwarded = budget.connection("h1").push(bytes);
      expect(forwarded.length).toBe(extra ? 0 : 65536);
      expect(budget.snapshot().stopped).toBe(Boolean(extra));
    }
  });

  it("preserves fragmented H2 preface and complete header/continuation blocks without decoding HPACK", async () => {
    const budget = (await load()).createPhysicalRequestBudget(), connection = budget.connection("h2");
    expect(connection.push(preface.subarray(0, 10))).toEqual(Buffer.alloc(0));
    expect(connection.push(preface.subarray(10))).toEqual(preface);
    const first = frame(1, 1, 1, Buffer.from([0x82]));
    const last = frame(9, 4, 1, Buffer.from([0x87, 0x84]));
    expect(connection.push(first)).toEqual(Buffer.alloc(0));
    expect(connection.push(last)).toEqual(Buffer.concat([first, last]));
    expect(budget.snapshot()).toMatchObject({ observed: 1, forwarded: 1, stopped: false });
  });

  it("counts every new H2 stream on one reused TLS session, including a hidden retry", async () => {
    const budget = (await load()).createPhysicalRequestBudget(), connection = budget.connection("h2");
    expect(connection.push(preface)).toEqual(preface);
    for (let n = 0; n < 8; n++) expect(connection.push(headers(n * 2 + 1))).toEqual(headers(n * 2 + 1));
    expect(connection.push(headers(17))).toEqual(Buffer.alloc(0));
    expect(budget.snapshot()).toMatchObject({ observed: 9, forwarded: 8, stopped: true, reason: "physical_request_limit" });
  });

  it("rejects invalid H2 streams, header interleaving, oversized blocks and malformed prefaces", async () => {
    const inputs = [
      Buffer.concat([preface, headers(0)]), Buffer.concat([preface, headers(2)]),
      Buffer.concat([preface, headers(1), headers(1)]),
      Buffer.concat([preface, frame(1, 1, 1), frame(4, 0, 0)]),
      Buffer.concat([preface, frame(1, 5, 1, Buffer.alloc(65537))]),
      Buffer.from("GET / HTTP/1.1\r\n\r\n"),
    ];
    for (const input of inputs) {
      const budget = (await load()).createPhysicalRequestBudget();
      budget.connection("h2").push(input);
      expect(budget.snapshot().stopped).toBe(true);
    }
  });
});
