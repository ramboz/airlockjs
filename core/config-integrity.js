// Config-integrity — the seam-side control (spec 015-01, ADR-0011). Relocated + GENERALIZED
// from the 013-03 prototype (rig/config-integrity.js, now deleted): wired into
// core/wrapped-sdk-host.js's dispatchInterceptedFetch, BEFORE caps.egress.dispatch performs the
// real fetch (ADR-0010's dispatch seam).
//
// Threat (ADR-0011): the airlock seal keys egress on endpoint HOST/PATH (ADR-0004's host
// allow-list, ADR-0006's endpoint ceiling), but a wrapped-SDK connector's TENANT-routing key
// rides OUTSIDE that key — for alloy it's the datastream, carried as the `configId` query param
// on an otherwise-allowed interact URL. A single shared host serves every tenant; which tenant an
// interact lands in is decided by the tenant key, which the host/path allow-list never inspects.
// Spec 013-03 confirmed this threat LIVE against real Adobe Edge (rig/alloy-live-reroute.mjs):
// honest and attacker datastreams both HTTP 200 on the SAME host — routing is genuinely
// tenant-keyed, end to end.
//
// Host-owned config at boot is NECESSARY but NOT SUFFICIENT: the whole vendor runtime lives
// inside the chamber (ADR-0009/spec 012), so compromised code can re-`configure` the SDK, or
// bypass it entirely and craft its own `?<tenantKey>=<attacker>` fetch. The only enforceable
// chokepoint is the egress SEAM — the orchestrator's main-thread dispatch every intercepted
// interact crosses.
//
// GENERALIZED (015-01) from the 013-03 alloy-only prototype in two ways:
//   1. The tenant key's PARAM NAME is INJECTED (`configId` for alloy, `measurement_id` for GA4),
//      not hardcoded, so `core/` stays vendor-neutral — the 014-02 injected-recognizer precedent
//      (core/coalescing-broker.js) applied to this control.
//   2. A HOST check is added and is load-bearing (ADR-0011 §2): without it, an outbound egress to
//      `evil.com?configId=<honest>` would pass a tenant-only check, and an override could
//      "correct" the tenant while still forwarding to an attacker-controlled host.
//
// CRITICAL (013-03 craft review, carried forward): a naive "parse the chamber's URL and compare"
// is evadable by the very adversary in the threat model — it TRUSTS a URL the hostile chamber
// fully controls (parameter pollution `?configId=<honest>&configId=<attacker>`, encoding, an
// omitted key). So the robust posture stays TWO-fold:
//   1. DETECT + FAIL CLOSED (checkConfigIntegrity): parse *all* tenant-key params (getAll —
//      pollution-aware) AND the host; an absent, duplicated, or mismatched tenant, OR a foreign
//      host, HOLDS at the seal (fail closed, not open) — as does an INCOMPLETE pin itself (a
//      misconfiguration must never silently allow).
//   2. OVERRIDE, don't just compare (pinnedDispatchUrl): re-derive the dispatch URL with BOTH the
//      host-pinned host AND tenant — whatever the chamber supplied is discarded — so the control
//      never depends on trusting the chamber's self-report. Relocated here, now host-aware, per
//      ADR-0011 §7; wired into the seam under `disposition:"override"` (015-02) — a named opt-in,
//      never the default.
//
// The detector's `reason` is DISPOSITION-NEUTRAL: it names only the deviation, never the action
// ("held"/"overridden") — the seam's `disposition` field carries the verb. This lets the SAME
// reason ride an overridden diagnostic without contradicting it (015-02 review): a re-pointed
// dispatch that is corrected-and-sent must not be alerted as "held at the seal".
//
// TRANSPORT PIN (spec 021-02, defense-in-depth): the 015-02 review named a protocol-blindness
// residual — this control keyed on `.host` (which EXCLUDES the scheme), so an `http://` downgrade
// to the honest host+tenant PASSED, and `pinnedDispatchUrl`'s override preserved whatever scheme
// the chamber supplied. 021-02's grounding (AC1) found the 016 endpoint-ceiling ALREADY holds a
// downgrade wherever it is CO-WIRED (its `origin` comparison includes the scheme) — but
// `createWrappedSdkHost` also ships a SUPPORTED, tested configuration where config-integrity runs
// standalone with NO ceiling co-wired (015-01/015-02's own describe blocks: `configIntegrity` wired,
// `endpointCeiling` absent), and there the scheme-blindness is a real, uncaught gap. Pinning it HERE
// closes it regardless of what else happens to be wired (defense-in-depth), not just the co-wired
// case the ceiling already covers.
//
// ORIGIN-AWARE, not "https always" (mirrors 014-01's `reconcileForBrokerJar`, which drops
// Secure/SameSite rather than hardcoding them, because a plain http/localhost jar would reject a
// Secure cookie outright): the rule is scheme MATCH against the pin's OWN expected transport, not a
// literal "must be https" — a caller pointed at a real Adobe/GA host never sets `pinnedScheme`, and
// it defaults to `https:` (every shipped pin targets such a host, so this closes the gap for every
// existing caller with zero wiring changes); a caller legitimately pointed at a localhost/http test
// origin declares `pinnedScheme: "http:"` and is not force-upgraded. `pinnedDispatchUrl`'s override
// re-derives to the PIN's scheme (default https), never the chamber-supplied one — so a downgrade
// can't survive a "corrected" re-point either.

/**
 * Parse ALL `tenantKey` query params from an outbound URL (getAll, not get — a hostile chamber
 * can parameter-pollute to slip a value past a naive single-value read). Generalizes 013-03's
 * `outboundDatastreams`: the param NAME is injected, not hardcoded to `"configId"`.
 * @param {string} url the intercepted/outbound URL the chamber handed to the dispatch seam
 * @param {string} tenantKey the connector-declared tenant-routing query param name (e.g.
 *   `"configId"` for alloy, `"measurement_id"` for GA4)
 * @returns {string[]} every value present under `tenantKey` (0, 1, or many)
 */
export function outboundTenants(url, tenantKey) {
  try { return new URL(url, "https://airlock.local").searchParams.getAll(tenantKey); }
  catch { return []; }
}

/**
 * The outbound URL's host, or `null` if the URL fails to parse.
 * @param {string} url
 * @returns {string | null}
 */
export function hostOf(url) {
  try { return new URL(url, "https://airlock.local").host; }
  catch { return null; }
}

/**
 * The outbound URL's scheme (`URL#protocol`, e.g. `"https:"`), or `null` if the URL fails to parse.
 * Mirrors `hostOf` — the transport-pin counterpart (spec 021-02).
 * @param {string} url
 * @returns {string | null}
 */
export function schemeOf(url) {
  try { return new URL(url, "https://airlock.local").protocol; }
  catch { return null; }
}

// The default EXPECTED transport when a pin declares no `pinnedScheme` (spec 021-02): every pin
// shipped so far targets a real Adobe/GA host, so defaulting to `https:` closes the downgrade gap
// for every existing caller with zero wiring changes. A caller pointed at a legitimate http origin
// (a localhost/dev rig) opts OUT by declaring its own `pinnedScheme` — never a global override.
const DEFAULT_PINNED_SCHEME = "https:";

/**
 * Normalize a scheme value (`"https"` or `"https:"`, any case) to `URL#protocol`'s own form
 * (lowercase, trailing colon). `null`/`undefined`/`""` normalize to `null` (caller decides the
 * default) rather than throwing — a pin is untrusted config, not code.
 * @param {string | null | undefined} scheme
 * @returns {string | null}
 */
function normalizeScheme(scheme) {
  if (!scheme) return null;
  const s = String(scheme).toLowerCase();
  return s.endsWith(":") ? s : `${s}:`;
}

/**
 * The seam-side config-integrity DETECTOR. FAILS CLOSED: an outbound egress whose host != the
 * pinned host, OR whose tenant is absent, duplicated (pollution), or != the host-pinned tenant,
 * is HELD at the seal — as is an incomplete pin (a misconfiguration, never a silent allow).
 * @param {string} url the outbound URL the chamber handed to the dispatch seam
 * @param {{ pinnedHost: string, tenantKey: string, pinnedTenant: string, pinnedScheme?: string }} pin the
 *   orchestrator-owned, chamber-immutable reference: the allowed host, the connector's declared
 *   tenant-key param name, the tenant value pinned for that host, and (spec 021-02, optional) the
 *   EXPECTED transport — defaults to `"https:"` (every shipped pin targets a real Adobe/GA host); a
 *   caller pointed at a legitimate http origin (localhost/dev) declares its own, e.g. `"http:"`
 * @returns {{ verdict: "allow" | "hold", host: string | null, outboundTenants: string[], reason: string }}
 */
export function checkConfigIntegrity(url, pin) {
  const { pinnedHost, tenantKey, pinnedTenant, pinnedScheme } = pin || {};

  // Incomplete pin fails closed before anything else — a misconfiguration must
  // never silently allow. `pinnedScheme` is NOT required here (it has a safe
  // default, unlike host/tenantKey/tenant) — see checkConfigIntegrity's docstring.
  if (!pinnedHost || !tenantKey || !pinnedTenant) {
    return {
      verdict: "hold",
      host: hostOf(url),
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: incomplete pin (misconfiguration)",
    };
  }

  // Host check — load-bearing (ADR-0011): keeps a foreign-host egress from
  // ever passing on tenant-key match alone.
  const host = hostOf(url);
  if (host !== pinnedHost) {
    return {
      verdict: "hold",
      host,
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: outbound host != pinned host (foreign-host egress)",
    };
  }

  // Transport pin (spec 021-02, defense-in-depth) — origin-aware: MATCH the pin's own expected
  // scheme (default https:, never a hardcoded literal), not "must be https". Catches an http://
  // downgrade to the honest host+tenant that the host/tenant checks above don't see (`.host`
  // excludes the scheme), independent of whether a 016 endpoint-ceiling happens to be co-wired.
  const expectedScheme = normalizeScheme(pinnedScheme) || DEFAULT_PINNED_SCHEME;
  if (schemeOf(url) !== expectedScheme) {
    return {
      verdict: "hold",
      host,
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: outbound scheme != pinned scheme (transport downgrade)",
    };
  }

  // Tenant-key check — pollution-aware (getAll, not get).
  const tenants = outboundTenants(url, tenantKey);
  if (tenants.length === 0) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: no ${tenantKey} on the interact` };
  }
  if (tenants.length > 1) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: multiple ${tenantKey} params (parameter pollution)` };
  }
  if (tenants[0] !== pinnedTenant) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: outbound ${tenantKey} != host-pinned tenant (same-host tenant re-route)` };
  }
  return { verdict: "allow", host, outboundTenants: tenants, reason: "ok" };
}

/**
 * The ENFORCEMENT posture (015-02's override, relocated + host-aware now; NOT wired into the seam
 * in this slice): re-derive the dispatch URL carrying EXACTLY the host-pinned host and tenant,
 * discarding whatever host/tenant the chamber supplied. An override cannot be evaded by
 * pollution/encoding the way a parse-and-compare can, because it never trusts the chamber's
 * value — it re-derives BOTH the host and the tenant to the pins (evasion-proof: "correcting" the
 * tenant alone while preserving the chamber's host would still forward to an attacker host). Also
 * re-derives the SCHEME (spec 021-02) to the pin's own expected transport (default `https:`) — a
 * downgraded `http://` chamber URL can't survive a "corrected" re-point either.
 * @param {string} url
 * @param {{ pinnedHost: string, tenantKey: string, pinnedTenant: string, pinnedScheme?: string }} pin
 * @returns {string} the dispatch URL re-derived to the host + scheme pin, with exactly one
 *   tenantKey = the pinned tenant
 */
export function pinnedDispatchUrl(url, pin) {
  const u = new URL(url, "https://airlock.local");
  u.protocol = normalizeScheme(pin.pinnedScheme) || DEFAULT_PINNED_SCHEME;
  u.host = pin.pinnedHost;
  u.searchParams.delete(pin.tenantKey); // drop ALL chamber-supplied value(s), including pollution
  u.searchParams.set(pin.tenantKey, pin.pinnedTenant); // exactly one, the host's
  return u.toString();
}
