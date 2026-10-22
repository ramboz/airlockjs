// Deliberately no test switch, environment grant, positive boolean or guessed
// clock-proof reader. Tests mock this boundary, never supply a runtime grant.
import { namespacePlanEvidence } from "./sdk-absent-owned-namespace.mjs";
import { requireOwnedNamespaceImageClockContract } from "./sdk-absent-owned-namespace-image-admission.mjs";
export { assertOwnedNamespacePayloadContext } from "./sdk-absent-owned-namespace-image-admission.mjs";
export function requireOwnedNamespaceRuntimeAdmission(plan) {
  namespacePlanEvidence(plan); // A JSON/prepared:true substitute is never a plan.
  requireOwnedNamespaceImageClockContract();
}
