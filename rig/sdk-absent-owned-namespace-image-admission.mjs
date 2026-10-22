// Image-side fail-closed boundary. No positive flag can substitute for the
// qualified, source-bound cross-clock proof whose issuer/reader is unframed.
import process from "node:process";
import { fileURLToPath } from "node:url";
import { fixedRead, fail } from "./sdk-absent-owned-namespace-io.mjs";
import { json } from "./inspected-meta-record.mjs";

const CLOCK = fileURLToPath(new URL("sdk-absent-owned-namespace-clock.json", import.meta.url));
export function requireOwnedNamespaceImageClockContract() {
  const clock = json(fixedRead(CLOCK, { maximum: 8192 }).bytes);
  if (clock.status === "NOT_PREPARED") fail("namespace_runtime_clock_bounds_UNPROVED");
  fail("namespace_runtime_clock_proof_issuer_and_reader_contract_MISSING");
}
export function assertOwnedNamespacePayloadContext() {
  if (process.platform !== "linux" || process.arch !== "arm64" || process.version !== "v24.10.0"
    || !Number.isSafeInteger(process.pid) || process.pid <= 1
    || !/^[a-z0-9-]{1,48}$/.test(process.env.AIRLOCK_CASE ?? "")
    || !/^[a-f0-9]{64}$/.test(process.env.AIRLOCK_NONCE ?? "")) fail("namespace_direct_payload_context_refused");
  requireOwnedNamespaceImageClockContract();
}
