// Read-only, SDK-absent publication consumer. No command execution or clock
// injection. The expected private handle must come from an independent observer
// AFTER the whole fixed command exits, never from the candidate's own process.
import { lstatSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { readMetaPrivate } from "./native-stock-meta.mjs";
import { NODE, directory, fail, hash, read, sources } from "./sdk-absent-chrome-io.mjs";
import { sdkAbsentChromeReadiness } from "./sdk-absent-chrome-preexec.mjs";

const VITEST = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const CONFIG = fileURLToPath(new URL("sdk-absent-chrome.browser.config.mjs", import.meta.url));
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const denied = (reason, externalValid = false) => ({ qualified: false, reason,
  external_completion_valid: externalValid, sdk_absent: true, native_authority: false, native_qualified: false });
function snapshot(path) {
  const before = lstatSync(path), bytes = readMetaPrivate(path, 1048576), after = lstatSync(path);
  if (["dev", "ino", "size", "mtimeMs", "ctimeMs"].some(k => before[k] !== after[k])) fail("completion_file_changed");
  return { value: json(bytes, 65536),
    handle: { path, dev: before.dev, ino: before.ino, bytes: bytes.length, sha256: hash(bytes) } };
}

export function inspectSdkAbsentChromeCompletion(options) {
  try {
    const v = record(data(options), ["outputDir", "completion"]);
    if (v.completion === null) return denied("external_completion_missing");
    const expected = record(v.completion, ["path", "dev", "ino", "bytes", "sha256"]);
    if (typeof expected.path !== "string" || !isAbsolute(expected.path) || resolve(expected.path) !== expected.path
      || !digest(expected.sha256) || !["dev", "ino", "bytes"].every(k => Number.isSafeInteger(expected[k]) && expected[k] > 0))
      fail("external_completion_handle");
    const root = directory(v.outputDir, "case-evidence-root");
    if (expected.path.startsWith(root.path + "/") || expected.path === root.path) fail("external_observer_required");
    const external = snapshot(expected.path);
    if (!equal(external.handle, expected)) fail("external_completion_handle_changed");
    const r = record(external.value, ["schema", "observer_scope", "exit_observed", "command",
      "actual_exit_code", "signal", "timed_out", "started_monotonic_ms", "completed_monotonic_ms",
      "candidate", "source_vector_sha256", "sdk_absent", "native_authority"]);
    if (r.schema !== "airlock.sdk-absent-chrome-whole-command-completion.v1"
      || r.observer_scope !== "external-whole-command-after-exit" || r.exit_observed !== true
      || r.sdk_absent !== true || r.native_authority !== false
      || r.actual_exit_code !== 0 || r.signal !== null || r.timed_out !== false) fail("external_command_failed");
    if (![r.started_monotonic_ms, r.completed_monotonic_ms].every(n => Number.isFinite(n) && n >= 0)
      || r.completed_monotonic_ms < r.started_monotonic_ms
      || r.completed_monotonic_ms - r.started_monotonic_ms >= 45000) fail("external_completion_deadline");
    const path = join(root.path, "result.json"), committed = read(path), candidate = snapshot(path);
    if (!equal(committed, candidate.value) || !equal(record(r.candidate, ["path", "dev", "ino", "bytes", "sha256"]), candidate.handle))
      fail("candidate_publication_changed");
    const c = record(candidate.value, ["schema", "control", "qualified", "case_root", "source_vector_sha256",
      "sdk_absent", "native_authority", "native_qualified", "sdk_executions", "explicit_provider_operations",
      "network_scope", "control_witnessed", "resource_complete", "acquisition_control_observed", "descendant_boundary",
      "browser_server_returned", "actual_chrome_observed", "normal_cdp", "launch_permission_issued",
      "acquisition_roles_fully_attributed", "pre_return_abort", "profile_kind", "earliest_postfork_loss",
      "mechanical_budget_ms", "publication_contract", "child_exit", "registrations", "commands", "signals", "probe_dispositions", "errors"]);
    if (c.schema !== "airlock.sdk-absent-chrome-preexec-candidate.v2" || !["normal", "pre-return-abort"].includes(c.control)
      || c.qualified !== false || c.control_witnessed !== false || c.native_qualified !== false
      || c.sdk_absent !== true || c.native_authority !== false || c.sdk_executions !== 0
      || c.explicit_provider_operations !== 0 || !equal(c.case_root, root)) fail("candidate_success_claim_or_identity");
    const command = [NODE, VITEST, "run", "--config", CONFIG, "-t", "^ACTUAL SDK-ABSENT real Chrome " + c.control + "$"];
    if (!equal(r.command, command)) fail("external_command_scope");
    const sourceHash = hash(JSON.stringify(data(sources())));
    if (c.source_vector_sha256 !== sourceHash || r.source_vector_sha256 !== sourceHash) fail("completion_source_lease_changed");
    const publication = record(c.publication_contract, ["status", "external_completion_required",
      "mechanical_budget_ms", "producer_elapsed_before_publication_ms"]);
    if (publication.status !== "UNQUALIFIED-candidate" || publication.external_completion_required !== true
      || publication.mechanical_budget_ms !== 45000 || c.mechanical_budget_ms !== 45000
      || !Number.isFinite(publication.producer_elapsed_before_publication_ms)
      || publication.producer_elapsed_before_publication_ms < 0) fail("candidate_publication_contract");
    if (!equal(snapshot(expected.path).handle, expected) || !equal(snapshot(path).handle, candidate.handle)
      || !equal(directory(root.path, root.kind), root)) fail("completion_evidence_changed");
    // A valid external completion proves publication timing, NOT descendant
    // acquisition/termination. No current candidate can close that predicate.
    const readiness = sdkAbsentChromeReadiness();
    if (!readiness.ready) return denied(readiness.reason, true);
    return denied("sdk_absent_resource_reader_not_qualified", true);
  } catch (error) { return denied(error.code === "ENOENT" ? "external_completion_missing" : error.message); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [mode, outputDir, path, sha256, dev, ino, bytes, ...extra] = process.argv.slice(2);
  const result = mode === "--inspect-completion" && !extra.length
    ? inspectSdkAbsentChromeCompletion({ outputDir, completion: { path, sha256, dev: Number(dev), ino: Number(ino), bytes: Number(bytes) } })
    : denied("fixed_completion_consumer_arguments");
  process.stdout.write(JSON.stringify(result) + "\n"); process.exitCode = result.qualified ? 0 : 2;
}
