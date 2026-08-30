/**
 * Alloy-proposition → exposure mapping — spec 012-03, AC5.
 *
 * UC-1's exposure half for the WRAPPED-SDK archetype. The exposure is reported
 * through the SAME generic capture runtime any airlock event uses (`handle.push`
 * → ring → beacon) — but the MAPPING is new: `adapters/eds/exposure.js` reads
 * aem-experimentation's durable `body[data-experiment]`/`[data-variant]`, which a
 * Target PROPOSITION (`scope` / `scopeDetails` / `items`) does NOT populate. So a
 * proposition needs its own map to an exposure event (a `propositionDisplay`-style
 * event), which is what this module is — additive, alongside exposure.js, not a
 * replacement.
 *
 * Adobe's real display signal is a `decisioning.propositionDisplay` XDM event; here
 * the airlock reports it as a custom GA4-style `proposition_display` event through
 * the generic capture path (the runtime is connector-agnostic — it takes any
 * `{ event, ...params }` descriptor), so a Target exposure and a GA4 event ride the
 * exact same push→ring→beacon plumbing. Pure + null-safe, mirroring exposure.js.
 */

/** The custom GA4-style event name for a Target proposition exposure. Distinct
 *  from exposure.js's `experiment_impression` — a proposition is a different
 *  decision source (Target/Offers) with its own identity params. */
export const PROPOSITION_EXPOSURE_EVENT = "proposition_display";

/** Unwrap a Decision (`{ scope, content }`) to its proposition, or pass a bare
 *  proposition through. */
function propositionOf(x) {
  if (x && typeof x === "object" && x.content && typeof x.content === "object"
      && ("scope" in x.content || "id" in x.content)) {
    return x.content;
  }
  return x;
}

/**
 * Map a displayed proposition (or a Decision wrapping one) to an exposure push
 * descriptor. Returns `null` when there is nothing to report (no scope / no id) —
 * so a non-decision or a partial proposition never becomes a spurious exposure.
 *
 * @param {{ content?: object } | object | null | undefined} decisionOrProposition
 * @returns {{ event: string, proposition_id: string, scope: string,
 *             activity_id?: string, experience_id?: string } | null}
 */
export function mapPropositionToExposure(decisionOrProposition) {
  const p = propositionOf(decisionOrProposition);
  if (!p || typeof p !== "object") return null;
  const scope = p.scope;
  const propositionId = p.id;
  if (!scope || !propositionId) return null;

  const sd = p.scopeDetails || {};
  const activityId = sd.activity && sd.activity.id;
  const experienceId = sd.experience && sd.experience.id;
  return {
    event: PROPOSITION_EXPOSURE_EVENT,
    proposition_id: propositionId,
    scope,
    ...(activityId ? { activity_id: activityId } : {}),
    ...(experienceId ? { experience_id: experienceId } : {}),
  };
}

/**
 * Create a proposition-exposure reporter over the airlock write surface. Mirrors
 * exposure.js's `createExposureReporter`: a shared `seen` Set de-duplicates by
 * `<scope>:<proposition_id>`, so the same displayed proposition is reported once.
 *
 * @param {{ push: Function }} handle the generic airlock write surface (analytics
 *   is lazy, AD-8 — this takes the steady-state `push`, not an unload fast path).
 * @param {{ seen?: Set<string> }} [opts]
 * @returns {{ report(d: object): void, reportAll(ds: readonly object[]): void }}
 */
export function createPropositionExposureReporter(handle, { seen = new Set() } = {}) {
  const report = (decisionOrProposition) => {
    const evt = mapPropositionToExposure(decisionOrProposition);
    if (!evt) return;
    const key = evt.scope + ":" + evt.proposition_id;
    if (seen.has(key)) return; // already reported this exposure (idempotent)
    seen.add(key);
    handle.push(evt);
  };
  return {
    report,
    reportAll(decisions) {
      for (const d of decisions || []) report(d);
    },
  };
}
