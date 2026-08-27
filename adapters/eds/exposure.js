/**
 * EDS above-the-fold exposure capture (spec 005-01, AC1+AC2) — reads the applied
 * experiment/variant and reports it through the airlock as ONE
 * `experiment_impression` GA4 event.
 *
 * WHY read the body dataset, not the event (spec 005 Overview): `aem-experimentation`
 * applies the decision in the EAGER window (before `body.appear`) and fires its
 * `aem:experimentation` CustomEvent there — but the airlock boots LAZY (after
 * `appear`, AD-8), so a lazy event listener MISSES the eager exposure. The plugin
 * records the applied state DURABLY on `body[data-experiment]`/`body[data-variant]`
 * (R-005; for a page-level experiment the plugin remaps `main`→`document.body`), which
 * this module reads at boot. The live `aem:experimentation` listener then covers only
 * the post-boot (dynamic) case, de-duplicated against the boot read.
 *
 * The decisioning/swap stays `aem-experimentation`'s (Clarification Q4); this module's
 * job is the EXPOSURE REPORT. Everything here is pure / DI'd and null-safe — a missing
 * body/dataset/detail is a no-op, never a throw (boot must not break the page).
 *
 * Stated limits (spec 005 Assumptions, frame-critique 005-01): (a) the push happens
 * AFTER the async lazy boot — a bounce faster than boot loses the exposure (the
 * accepted AD-8 analytics-is-lazy tradeoff, stated not hidden); (b) page-level only —
 * a section-level experiment's dataset lives on the section element, not `body`, so it
 * is out of scope for MVP1's single-experiment testbed.
 */

/** The custom GA4 event name for an above-the-fold experiment exposure. No standard
 *  GA4 experiment event exists; GA4 accepts custom names by design (ga4-mp.md). */
export const EXPOSURE_EVENT = "experiment_impression";

/**
 * Read the applied above-the-fold experiment from the durable body dataset.
 *
 * @param {{ body?: { dataset?: Record<string, string> } }} doc a document-like handle.
 * @returns {{ experimentId: string, variantId: string } | null}
 *   the applied pair when BOTH `data-experiment` and `data-variant` are present;
 *   `null` when either is absent (no experiment / partial state) or the body/dataset
 *   is missing. Pure and null-safe — never throws.
 */
export function readAppliedExperiment(doc) {
  const dataset = doc && doc.body && doc.body.dataset;
  if (!dataset) return null;
  const experimentId = dataset.experiment;
  const variantId = dataset.variant;
  // Both must be present — a partial dataset is not an exposure (AC1: no spurious event).
  if (!experimentId || !variantId) return null;
  return { experimentId, variantId };
}

/**
 * Create an exposure reporter over the airlock write surface. Its two entry points
 * share ONE `seen` Set so the boot-time body read and the live listener never
 * double-count the same `<experimentId>:<variantId>` exposure (AC2 dedup).
 *
 * @param {{ push: Function }} handle the airlock write surface (steady-state push —
 *   exposure is analytics-lazy, AD-8, so it takes the worker cycle, not the fast path).
 * @param {{ seen?: Set<string> }} [opts] `seen` is the shared dedup set (the adapter
 *   passes a fresh one per boot); defaults to a private Set when omitted.
 * @returns {{ reportFromBody(doc: object): void, onAemExperimentation(detail: object): void }}
 */
export function createExposureReporter(handle, { seen = new Set() } = {}) {
  /** Push a single de-duplicated exposure; ignore an incomplete pair. */
  const report = (experimentId, variantId) => {
    if (!experimentId || !variantId) return;
    const key = `${experimentId}:${variantId}`;
    if (seen.has(key)) return; // already counted this exposure (idempotent)
    seen.add(key);
    handle.push({ event: EXPOSURE_EVENT, experiment_id: experimentId, variant_id: variantId });
  };

  return {
    /**
     * AC1 — eager page-level exposure: read the applied variant from the durable
     * body dataset and report it once. No experiment applied → no event.
     */
    reportFromBody(doc) {
      const applied = readAppliedExperiment(doc);
      if (!applied) return;
      report(applied.experimentId, applied.variantId);
    },

    /**
     * AC2 — post-boot exposure: the `aem:experimentation` CustomEvent's `detail`
     * carries `experiment`/`variant` (testbed plugin). Deduped against the boot read.
     */
    onAemExperimentation(detail) {
      if (!detail) return;
      report(detail.experiment, detail.variant);
    },
  };
}
