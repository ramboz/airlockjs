/**
 * Alloy consent shaping (spec 020-02, ADR-0007) — the vendor-specific half of
 * the idiomatic DELEGATE lever the 020-01 probe found: alloy consent is the
 * Adobe 2.0 consent-standard **command**
 *
 *   alloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0",
 *     value: { collect: { val: "y" | "n" } } }] })
 *
 * — NOT an XDM body field (020-01 Finding, alloy@2.35.0 source + the Adobe
 * setConsent docs). `connectors/alloy/alloy-chamber.worker.js`'s boot glue
 * drives it (`configure -> setConsent(shapeAlloyConsent(vector)) ->
 * sendEvent`), right after `configure` succeeds and before the first
 * `sendEvent` — this module only SHAPES the vector, it never calls `alloy(…)`
 * itself (the chamber owns that call; this stays free of any `self`/worker/
 * command-fn reach, mirroring connectors/ga4/consent.js).
 *
 * `collect.val` is a SINGLE y/n switch over alloy's ONE GENERAL consent purpose
 * (alloy-core `consentPurpose.js` GENERAL — no per-purpose granularity) — unlike
 * GA4's MP `consent` object (per-purpose GRANTED/DENIED, and a purpose can be
 * OMITTED to signal "no data-use signal at all" — 017-01's `shapeMpConsent`),
 * alloy's switch has no third "pending" state to delegate to, and CANNOT express
 * "analytics-yes / personalization-no". Critically, `collect:"n"` makes alloy's
 * `awaitConsent()` REJECT the send BEFORE the request is built
 * (`createEventManager.js:70` gates `sendEdgeNetworkRequest` at `:99`;
 * `createConsentStateMachine.js`'s `awaitOut` rejects) — so `collect:"n"`
 * suppresses the WHOLE interact UPSTREAM of the seam.
 *
 * 034-01 LIVENESS FIX (deliberately relaxes 020-02's "both-required" collapse):
 * `val` is "y" iff the PRIMARY collection purpose **`analytics_storage`**
 * resolves "granted" — NOT iff both `analytics_storage` AND `personalization`
 * are granted. Rationale: because alloy's one-switch consent cannot express
 * analytics-yes/pzn-no, keeping the both-required gate would drive `collect:"n"`
 * on a personalization denial and thereby SUPPRESS analytics upstream — the
 * exact posture 034-01 exists to unblock. So the DELEGATE provides LIVENESS
 * (alloy SENDS whenever analytics is consented) and the TRUSTED seam
 * (core/wrapped-sdk-host.js, 034-01 AC2) provides ENFORCEMENT (strips the
 * per-event `query.personalization` when personalization is un-granted).
 * Defense-in-depth — delegate = liveness, seam = trusted per-event enforcement —
 * SAFE precisely because the seam, not this untrusted-chamber delegate, is where
 * a personalization denial is enforced. A denied OR pending `analytics_storage`
 * still fail-closes to `collect:"n"` (no third pending state in alloy's switch).
 *
 * OQ13-1 residual (documented, not closed): relaxing `collect` authorizes
 * alloy's full identity/collect on every analytics-yes/pzn-no send — the shared
 * identity cookies + `query.identity.fetch` serve `analytics_storage`
 * (consent-consistent; the seam correctly does NOT strip `query.identity.fetch`),
 * but a `demdex`/`ad_storage` cookie WRITE under a denied `ad_storage` is now
 * reachable (before, `collect:"n"` suppressed all writes). Pre-existing +
 * orthogonal (`ad_storage` gates neither the old nor the new `collect`). BOUND
 * (do NOT over-claim): the endpoint ceiling gates FETCH dispatch, so it holds
 * the demdex.net ad-sync NETWORK EGRESS — but the cookie-write-back path
 * (core/wrapped-sdk-host.js `cookie-writeback` -> `caps.cookies.reconcile`) is
 * UNGATED, so a `demdex`/`ad_storage` cookie WRITE landing client-side under
 * denied `ad_storage` is UNCOMPENSATED. Whether such a write is sync-dependent
 * (then held with the egress) or client-side (a real new write in this posture)
 * is the exact creds-gated question OQ13-1 must resolve. See
 * docs/refinement-todo.md — OQ13-1 stays OPEN.
 *
 * Reads ONLY the vendor-neutral core/consent.js resolver (connector -> core
 * is allowed; the reverse is not — test/core-boundary.test.js). Pure: no
 * DOM, no `self`, no alloy/command-fn reach.
 */
import { resolveConsent } from "../../core/consent.js";

/**
 * The PRIMARY collection purpose that gates alloy's single `collect` switch
 * (034-01): analytics is what the interact primarily carries; personalization
 * is enforced per-event at the TRUSTED seam, not via this one-switch delegate.
 */
const PRIMARY_COLLECT_PURPOSE = "analytics_storage";

/**
 * Shape a host consent vector into alloy's `setConsent` command options.
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   ADR-0007 consent vector (core/consent.js's shape).
 * @returns {{ consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y"|"n" } } }] }|undefined}
 *   the `setConsent` options alloy's command consumes; `val: "y"` iff the
 *   PRIMARY collection purpose `analytics_storage` resolves "granted"
 *   (`core/consent.js`'s `resolveConsent`), else `"n"` (fail-closed: a denied OR
 *   pending analytics signal both yield "n" — there is no third state in alloy's
 *   switch). A personalization denial does NOT force "n" (034-01 liveness) — it
 *   is enforced by the TRUSTED seam's per-event `query.personalization` strip.
 *   Returns `undefined` when NO vector is supplied at all (`null`/`undefined`) —
 *   the back-compat signal the chamber boot glue reads to SKIP driving
 *   `setConsent` entirely, leaving alloy's own `defaultConsent` (default
 *   `"in"`) window unaffected.
 */
export function shapeAlloyConsent(vector) {
  if (vector == null) return undefined;
  const granted = resolveConsent(vector, PRIMARY_COLLECT_PURPOSE) === "granted";
  return {
    consent: [
      {
        standard: "Adobe",
        version: "2.0",
        value: { collect: { val: granted ? "y" : "n" } },
      },
    ],
  };
}

/**
 * Shape a host consent vector into alloy's BOOT-time consent posture (spec
 * 045-02, ADR-0023) — the hold-until-granted mapping that uses alloy's OWN
 * native `defaultConsent:"pending"` queue instead of self-suppressing under
 * unresolved consent. Decides HOW the chamber configures alloy at boot; the
 * y/n `setConsent` shaping is delegated to `shapeAlloyConsent` (above,
 * UNCHANGED — reused here for the grant/deny paths AND the mid-session
 * setConsent flush path).
 *
 * The three states of the PRIMARY collection purpose `analytics_storage`
 * (`core/consent.js`'s `resolveConsent`), plus the no-vector back-compat case:
 *
 *   - **pending** (a CMP is wired but `analytics_storage` has no signal yet) →
 *     `{ defaultConsent: "pending", setConsentOptions: undefined }`. Configure
 *     alloy with `defaultConsent:"pending"` so alloy's OWN queue holds every
 *     `sendEvent` (no interact egresses), and do NOT drive `setConsent` —
 *     driving `collect:"n"` here would self-SUPPRESS (the pre-045-02 behavior
 *     this slice REPLACES), which discards the queue instead of holding it. A
 *     later host→chamber `setConsent(collect:"y")` FLUSHES the queue with the
 *     full round-trip (grounded: `rig/alloy-consent-pending.mjs`).
 *   - **granted** → `{ defaultConsent: undefined, setConsentOptions:
 *     shapeAlloyConsent(vector) }`. Omit `defaultConsent` (alloy's default) and
 *     drive `setConsent(collect:"y")` at boot, exactly as pre-045-02 — 034-01
 *     LIVENESS is preserved (a personalization denial does NOT force `"n"`; the
 *     TRUSTED seam strips the per-event personalization query).
 *   - **denied** → `{ defaultConsent: undefined, setConsentOptions:
 *     shapeAlloyConsent(vector) }`. Drive `setConsent(collect:"n")` — alloy
 *     self-suppresses upstream of the seam, byte-unchanged from today.
 *   - **no vector at all** (`null`/`undefined` — no CMP wired) →
 *     `{ defaultConsent: undefined, setConsentOptions: undefined }`. Neither
 *     configure `defaultConsent` NOR drive `setConsent`: alloy's own
 *     default-`"in"` window sends, byte-unchanged (spec 045-02 AC5 — "no
 *     consent vector wired → no `defaultConsent:"pending"`"; the same
 *     "no CMP wired vs. CMP-wired-but-pending" distinction GA4 draws).
 *
 * Pure — no DOM, no `self`, no alloy/command-fn reach (the chamber owns the
 * `configure`/`setConsent` calls; this only SHAPES). Reads only
 * `core/consent.js`'s `resolveConsent` via `shapeAlloyConsent`.
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   ADR-0007 consent vector (`core/consent.js`'s shape).
 * @returns {{ defaultConsent: ("pending"|undefined), setConsentOptions: (ReturnType<typeof shapeAlloyConsent>) }}
 */
export function shapeAlloyBoot(vector) {
  if (vector == null) {
    // No CMP wired — byte-unchanged back-compat: neither posture is applied.
    return { defaultConsent: undefined, setConsentOptions: undefined };
  }
  if (resolveConsent(vector, PRIMARY_COLLECT_PURPOSE) === "pending") {
    // CMP wired, analytics unresolved — alloy's OWN native queue, NOT suppress.
    return { defaultConsent: "pending", setConsentOptions: undefined };
  }
  // granted → setConsent(collect:"y"); denied → setConsent(collect:"n"). Both
  // omit defaultConsent (alloy's default) — shapeAlloyConsent is never undefined
  // here (vector is non-null).
  return { defaultConsent: undefined, setConsentOptions: shapeAlloyConsent(vector) };
}
