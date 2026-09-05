// Shared browser-rig primitives + the pure verdict logic behind rig/subset-smoke.mjs
// (spec 036-02) — extracted from rig/e2e.mjs (AC5: genuine reuse, not a fork) so BOTH
// rigs share ONE Ajv `ga4-mp-request.schema.json` oracle compile, ONE `/collect*`
// beacon-capture route, and ONE boot-health wait, rather than a parallel
// re-implementation. e2e.mjs's own UC-2-specific assertions (the worker-cycle /
// pushCritical timing proofs) stay in e2e.mjs, untouched — only the genuinely-shared
// primitives moved here, byte-behavior-preserving (see test/smoke-core.test.js's
// "byte-identical to e2e.mjs's original inline ___" assertions).
//
// The DI'd browser helpers below (compileGa4Validator / captureCollectBeacons /
// waitForBootHealth) take `page` / `beacons` / `schemaJson` as parameters — no
// top-level `playwright` import — so a REAL page object is only needed to exercise
// their I/O; a FAKE `page` (a plain object implementing `.route`/`.waitForFunction`)
// is enough to unit-test them here (mirrors rig/lh-core.mjs's DI'd `runLighthouseOnce`).
//
// The PURE verdict logic below (the `*Disposition` helpers + `buildSmokeVerdict`) is
// the CI-provable core (spec 036-02 item 3): no I/O, no globals — fed plain
// booleans/strings by whichever rig ran (rig/subset-smoke.mjs today), so it is fully
// vitest-testable without a browser. It carries the honest-labeling discipline
// (presence != acceptance) as an asserted property of every disposition string: GA4's
// MP-schema match is the one legitimate CLIENT-SIDE acceptance oracle in this subset;
// alloy's interact and RUM's beacon are always labeled presence/sent-only, NEVER
// "accepted" — the downstream acceptance gates are named residuals
// (docs/real-site-validation.md), not something this rig can honestly decide.
import Ajv2020 from "ajv/dist/2020.js";

// ---- shared Playwright/Ajv primitives (extracted from rig/e2e.mjs, AC5) ----

/**
 * Compile the `ga4-mp-request.schema.json` Ajv validator — the SAME hermetic
 * conformance oracle rig/e2e.mjs's UC-2 proof uses, reused (not re-implemented) for
 * rig/subset-smoke.mjs's GA4 presence+conformance check. `schemaJson` is the
 * ALREADY-PARSED schema object (the caller reads
 * contracts/ga4-mp-request.schema.json — kept out of this module so it stays
 * import-cheap and DI-testable with a fake schema).
 * @param {object} schemaJson
 * @returns {(data: unknown) => boolean}
 */
export function compileGa4Validator(schemaJson) {
  return new Ajv2020({ allErrors: true, strict: false }).compile(schemaJson);
}

/**
 * Route `**\/collect*` on `page`, parsing + pushing every captured GA4 MP beacon into
 * `beacons` (mutated in place) — e2e.mjs's own beacon-capture pattern, unchanged.
 * Defaults to `route.fulfill({status:204, body:""})` (hermetic — no real network
 * egress, e2e.mjs's original local-rig behavior). `passthrough:true` instead lets the
 * real request continue to its real destination (rig/subset-smoke.mjs's live-mode
 * arm, where the operator wants the beacon to actually reach their real collector).
 * @param {{route: Function}} page
 * @param {Array<object>} beacons
 * @param {{passthrough?: boolean}} [opts]
 */
export async function captureCollectBeacons(page, beacons, { passthrough = false } = {}) {
  await page.route("**/collect*", (route) => {
    const raw = route.request().postData();
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { /* keep {} */ }
    beacons.push({
      name: parsed?.events?.[0]?.name ?? null,
      clientId: parsed?.client_id ?? null,
      pageLocation: parsed?.events?.[0]?.params?.page_location ?? null,
      body: raw,
      t: Date.now(),
    });
    return passthrough ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
}

/**
 * Wait for airlock's boot-health signal on `page` — either the SUCCESS `__flicker`
 * mark firing or one of `failureFlags` becoming defined — e2e.mjs's own boot-health
 * wait, generalized (DI'd mark/flags) so rig/subset-smoke.mjs can reuse it for the
 * GA4/alloy boot AND, separately, the RUM boot (`airlock:rum` /
 * `__airlockRumBootFailed`). The defaults reproduce e2e.mjs's original inline wait
 * byte-for-byte (`airlock:init` / `__airlockBootFailed`, 20s). Never throws — a
 * timeout leaves the caller to read whichever flags actually landed (matches
 * e2e.mjs's `.catch(() => {})`).
 * @param {{waitForFunction: Function}} page
 * @param {{timeout?: number, successMark?: string, failureFlags?: string[]}} [opts]
 */
export async function waitForBootHealth(page, { timeout = 20000, successMark = "airlock:init", failureFlags = ["__airlockBootFailed"] } = {}) {
  await page
    .waitForFunction(
      ({ mark, flags }) => (window.__flicker && window.__flicker.events.some((e) => e.name === mark))
        || flags.some((f) => window[f] !== undefined),
      { mark: successMark, flags: failureFlags },
      { timeout },
    )
    .catch(() => {});
}

// ---- pure verdict / disposition logic (spec 036-02 item 3 — the CI-provable core) ----

/**
 * Boot-health disposition, shared by the generic GA4/alloy boot AND the separate RUM
 * boot check (`rig/subset-smoke.mjs` calls this twice — once per `window.__airlock*
 * BootFailed` flag). A present `bootFailed` value is ALWAYS a fail.
 *
 * A `bootFailed` flag catches a boot that THREW; it does NOT catch a boot that
 * silently HUNG (never threw → the flag stays null). So the primary boot check also
 * gates on the POSITIVE production signal `installed` — `window.airlock` present +
 * pushable (set by `installOnWindow` only on a completed boot). `installed:false`
 * fails ("silent hang"); `installed` omitted (the RUM call — RUM installs no separate
 * global, its positive signal is its beacon/sampling-dependent) stays failure-flag-only.
 * NB `installed` is the universal PRODUCTION signal, NOT the testbed-only `airlock:init`
 * `__flicker` mark (absent on a real adopter page).
 * @param {string|null|undefined} bootFailed
 * @param {{ installed?: boolean }} [opts]
 */
export function bootHealthDisposition(bootFailed, { installed } = {}) {
  const failed = bootFailed !== null && bootFailed !== undefined;
  const notInstalled = installed === false;
  if (failed) {
    return { ok: false, bootFailed, installed: installed ?? null, disposition: `BOOT FAILED: ${bootFailed}` };
  }
  if (notInstalled) {
    return {
      ok: false,
      bootFailed: null,
      installed: false,
      disposition: "BOOT DID NOT COMPLETE — window.airlock never installed (silent hang / never reached installOnWindow)",
    };
  }
  return {
    ok: true,
    bootFailed: null,
    installed: installed ?? null,
    disposition: installed === true
      ? "booted cleanly (no __airlock*BootFailed; window.airlock installed)"
      : "booted cleanly (no __airlock*BootFailed)",
  };
}

/**
 * GA4 presence+conformance disposition (AC1) — MP-schema conformance is a legitimate
 * CLIENT-SIDE acceptance oracle for GA4 (unlike alloy/RUM below, whose downstream
 * acceptance this rig can never decide). `exercised:false` (no GA4 connector in this
 * arm — e.g. an alloy-only page) is informational and never fails the verdict.
 * @param {{exercised: boolean, present?: boolean, conformant?: boolean|null}} args
 */
export function ga4Disposition({ exercised, present, conformant }) {
  if (!exercised) {
    return { exercised: false, present: null, conformant: null, ok: true, disposition: "not exercised (no GA4 connector in this arm)" };
  }
  if (!present) {
    return { exercised: true, present: false, conformant: null, ok: false, disposition: "ABSENT — no /collect beacon captured" };
  }
  return {
    exercised: true,
    present: true,
    conformant,
    ok: conformant === true,
    disposition: conformant
      ? "PRESENT + MP-CONFORMANT (contracts/ga4-mp-request.schema.json)"
      : "PRESENT but NON-CONFORMANT against contracts/ga4-mp-request.schema.json",
  };
}

/**
 * Alloy interact PRESENCE disposition (AC1) — presence ONLY, NEVER shape/acceptance:
 * the XDM shape + ECID write-back ride the spec-013 `rig/alloy-live-*.mjs`
 * redacted-fixture rigs, never this smoke. `exercised:false` (no alloy connector in
 * this arm) and `locallyExercisable:false` (the local CSP-proof stub bundle performs
 * no network call — AC3's local-provability split, honestly reported, never faked)
 * are both informational and never fail the verdict; only a run that genuinely
 * attempted the network-level check and saw nothing is a fail.
 * @param {{exercised: boolean, networkExercisable?: boolean, fired?: boolean|null}} args
 *   `networkExercisable` is true only in LIVE mode (the local CSP-proof stub bundle
 *   performs no network call, so the interact-fired check is not decidable locally).
 */
export function alloyPresenceDisposition({ exercised, networkExercisable, fired }) {
  if (!exercised) {
    return { exercised: false, networkExercisable: null, fired: null, ok: true, disposition: "not exercised (no alloy connector in this arm)" };
  }
  if (!networkExercisable) {
    return {
      exercised: true,
      networkExercisable: false,
      fired: null,
      ok: true,
      disposition:
        "not exercised locally — the CSP-proof stub bundle performs no network call; chamber BOOT-HEALTH only " +
        "is locally provable (AC3; see docs/real-site-validation.md's live run)",
    };
  }
  return {
    exercised: true,
    networkExercisable: true,
    fired,
    ok: fired === true,
    disposition: fired
      ? "FIRED (presence only — shape not checked here; see spec-013 rig/alloy-live-*.mjs)"
      : "NOT FIRED — no interact request reached the pinned datastream host",
  };
}

/**
 * RUM SENT-beacon disposition (AC1/AC2) — what airlock SENT, NEVER what the collector
 * kept: the `cwv`-superset ACCEPTANCE gate is a DOWNSTREAM property requiring AEM
 * RUM-data inspection, never a captured-beacon reveal (a structural false-green —
 * see docs/real-site-validation.md's residuals checklist). `owns:false` (the page
 * never set `window.__airlockOwnsRum`) is informational and never fails the verdict.
 *
 * ABSENCE is verdict-relevant ONLY when a beacon was GUARANTEED: the local dry-run
 * force-selects RUM (`forceSelect`, testbed `scripts.js`) so a missing beacon there is
 * a real send fault (fail). A LIVE page is SAMPLED — RUM may legitimately not select
 * this load — so an absent beacon live is INFORMATIONAL, never a fail (a genuinely
 * broken RUM BOOT is caught separately by the `rum_boot_health` `__airlockRumBootFailed`
 * check; acceptance is downstream regardless).
 * @param {{owns: boolean, captured?: boolean, hasExpectedFields?: boolean|null, beaconGuaranteed?: boolean}} args
 */
export function rumSentDisposition({ owns, captured, hasExpectedFields, beaconGuaranteed }) {
  if (!owns) {
    return { owns: false, captured: null, hasExpectedFields: null, ok: true, disposition: "not applicable (window.__airlockOwnsRum not set)" };
  }
  if (!captured) {
    if (beaconGuaranteed) {
      return { owns: true, captured: false, hasExpectedFields: null, ok: false, disposition: "NOT SENT — no RUM beacon captured after a force-selected boot (a real send fault)" };
    }
    return {
      owns: true,
      captured: false,
      hasExpectedFields: null,
      ok: true,
      disposition:
        "no RUM beacon this load — RUM is SAMPLED live (not necessarily selected this load); force-select or retry " +
        "for a definitive SENT-shape capture. A broken RUM BOOT is caught by rum_boot_health; acceptance is downstream regardless.",
    };
  }
  return {
    owns: true,
    captured: true,
    hasExpectedFields,
    ok: hasExpectedFields === true,
    disposition: hasExpectedFields
      ? "SENT (shape only — NOT collector acceptance; the cwv-superset gate needs DOWNSTREAM AEM RUM-data inspection, see docs/real-site-validation.md)"
      : "SENT but missing an expected RUM field (weight/id/referer/checkpoint/t)",
  };
}

/**
 * Assemble the full smoke verdict card — pass iff every check's `ok` holds (an
 * un-exercised / not-locally-exercisable check is built with `ok:true` by the helpers
 * above, so it never fails the verdict — AC3's honest local-provability split).
 * Mirrors rig/lh-core.mjs's `buildResult` shape (question/mode/checks/pass/verdict).
 * @param {{mode: "local"|"live", checks: Record<string, {ok: boolean}>}} args
 */
export function buildSmokeVerdict({ mode, checks }) {
  const pass = Object.values(checks).every((c) => c.ok === true);
  return {
    question:
      "does the supported connector subset (GA4 + Adobe/alloy) boot cleanly and emit conformant/present beacons on this page?",
    mode,
    checks,
    pass,
    verdict: pass
      ? "PASS — boot-health clean; every EXERCISED check is present/conformant (never presence-as-acceptance — read each check's own disposition string)"
      : "FAIL — see checks above",
  };
}
