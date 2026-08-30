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
//      ADR-0011 §7; it is NOT wired into the seam in this slice (015-02 is the override wiring —
//      a named opt-in, never the default).

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
 * The seam-side config-integrity DETECTOR. FAILS CLOSED: an outbound egress whose host != the
 * pinned host, OR whose tenant is absent, duplicated (pollution), or != the host-pinned tenant,
 * is HELD at the seal — as is an incomplete pin (a misconfiguration, never a silent allow).
 * @param {string} url the outbound URL the chamber handed to the dispatch seam
 * @param {{ pinnedHost: string, tenantKey: string, pinnedTenant: string }} pin the
 *   orchestrator-owned, chamber-immutable reference: the allowed host, the connector's declared
 *   tenant-key param name, and the tenant value pinned for that host
 * @returns {{ verdict: "allow" | "hold", host: string | null, outboundTenants: string[], reason: string }}
 */
export function checkConfigIntegrity(url, pin) {
  const { pinnedHost, tenantKey, pinnedTenant } = pin || {};

  // Incomplete pin fails closed before anything else — a misconfiguration must
  // never silently allow.
  if (!pinnedHost || !tenantKey || !pinnedTenant) {
    return {
      verdict: "hold",
      host: hostOf(url),
      outboundTenants: outboundTenants(url, tenantKey),
      reason: "config-integrity: incomplete pin (misconfiguration) — fail closed (hold)",
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
      reason: "config-integrity: outbound host != pinned host — foreign-host egress held at the seal",
    };
  }

  // Tenant-key check — pollution-aware (getAll, not get).
  const tenants = outboundTenants(url, tenantKey);
  if (tenants.length === 0) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: no ${tenantKey} on the interact — fail closed (hold)` };
  }
  if (tenants.length > 1) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: multiple ${tenantKey} params (parameter pollution) — fail closed (hold)` };
  }
  if (tenants[0] !== pinnedTenant) {
    return { verdict: "hold", host, outboundTenants: tenants, reason: `config-integrity: outbound ${tenantKey} != host-pinned tenant — same-host tenant re-route held at the seal` };
  }
  return { verdict: "allow", host, outboundTenants: tenants, reason: "ok" };
}

/**
 * The ENFORCEMENT posture (015-02's override, relocated + host-aware now; NOT wired into the seam
 * in this slice): re-derive the dispatch URL carrying EXACTLY the host-pinned host and tenant,
 * discarding whatever host/tenant the chamber supplied. An override cannot be evaded by
 * pollution/encoding the way a parse-and-compare can, because it never trusts the chamber's
 * value — it re-derives BOTH the host and the tenant to the pins (evasion-proof: "correcting" the
 * tenant alone while preserving the chamber's host would still forward to an attacker host).
 * @param {string} url
 * @param {{ pinnedHost: string, tenantKey: string, pinnedTenant: string }} pin
 * @returns {string} the dispatch URL re-derived to the host pin, with exactly one tenantKey = the
 *   pinned tenant
 */
export function pinnedDispatchUrl(url, pin) {
  const u = new URL(url, "https://airlock.local");
  u.host = pin.pinnedHost;
  u.searchParams.delete(pin.tenantKey); // drop ALL chamber-supplied value(s), including pollution
  u.searchParams.set(pin.tenantKey, pin.pinnedTenant); // exactly one, the host's
  return u.toString();
}
