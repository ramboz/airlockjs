/**
 * XDM mint-recognition — spec 012-02, AC3 (pure, browser-safe piece).
 *
 * ADR-0008's broker-side coalescing GO is conditional on the broker being able to
 * PARSE the wrapped-SDK's opaque XDM `interact` call to recognize an identity
 * MINT (`query.identity.fetch` of ECID, with no ECID yet asserted) and tell it
 * apart from a non-mint `interact`. That recognizability is ADR-0008's named
 * kill-criterion; this module is where it lives, so it can be unit-pinned against
 * the *stub* XDM (AC6 checks the kill-criteria here) and reused verbatim by both
 * the Node unit tests and the in-browser coalescing broker.
 *
 * Grounded against the executed 012-01 chamber's captured XDM:
 *   URL  : https://adobedc.demdex.net/ee/v1/interact?configId=<datastream>&requestId=<uuid>
 *   body : { events:[{ xdm:{ eventType:"web.webpagedetails.pageViews" }}],
 *            query:{ identity:{ fetch:["ECID","CORE"] }} }
 *
 * NO node builtins — this file is imported directly as an ES module by the
 * browser harness (like rig/coherency-model.mjs). The minting stub's node-only
 * pieces (crypto-backed ECID assignment) stay in rig/alloy-mint-stub.js, which
 * re-exports `extractEcidFromInteractResponse` from here so 012-01 keeps working.
 */

/**
 * Parse the datastream id (configId) from an Edge interact URL. Two concurrent
 * first-mints for the SAME datastream are one coalescable identity; different
 * datastreams are different identities and must NOT coalesce.
 * @param {string | undefined} url
 * @returns {string} the configId, or "default" when absent/unparseable.
 */
function datastreamOf(url) {
  if (typeof url !== "string" || url.length === 0) return "default";
  try {
    const u = new URL(url, "https://airlock.local");
    return u.searchParams.get("configId") || "default";
  } catch (e) {
    const m = /[?&]configId=([^&]+)/.exec(url);
    return m ? decodeURIComponent(m[1]) : "default";
  }
}

/** Does this request already ASSERT an ECID identity (xdm.identityMap.ECID)? Then
 *  it is an attach/re-assertion, not a first-mint — coalescing it would be wrong. */
function assertsEcidIdentity(parsed) {
  const events = Array.isArray(parsed && parsed.events) ? parsed.events : [];
  const scopes = [parsed && parsed.xdm, ...events.map((e) => e && e.xdm)];
  for (const xdm of scopes) {
    const ecid = xdm && xdm.identityMap && xdm.identityMap.ECID;
    if (Array.isArray(ecid) && ecid.some((e) => e && e.id)) return true;
  }
  return false;
}

/**
 * Recognize whether an intercepted `interact` is a coalescable identity mint.
 * @param {{ url?: string, body?: string | object } | string | undefined} req
 *   the intercepted request (url + body), or a bare body (string/object).
 * @returns {{ isMint: boolean, reason: string, mintKey: string | null, namespace: string | null }}
 */
export function recognizeInteract(req) {
  const url = req && typeof req === "object" ? req.url : undefined;
  const rawBody = typeof req === "string" ? req : req && req.body;

  let parsed = null;
  try {
    parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch (e) {
    return { isMint: false, reason: "unparseable-body", mintKey: null, namespace: null };
  }
  if (!parsed || typeof parsed !== "object") {
    return { isMint: false, reason: "no-body", mintKey: null, namespace: null };
  }

  const idQuery = parsed.query && parsed.query.identity;
  const fetchList = idQuery && Array.isArray(idQuery.fetch) ? idQuery.fetch : null;
  const fetchesEcid = !!fetchList && fetchList.includes("ECID");
  if (!fetchesEcid) {
    return { isMint: false, reason: "no-ecid-fetch", mintKey: null, namespace: null };
  }
  if (assertsEcidIdentity(parsed)) {
    return { isMint: false, reason: "already-has-ecid", mintKey: null, namespace: null };
  }

  // A coalescable first-mint. Key it to the datastream + namespace so concurrent
  // first-mints for one visitor coalesce, but distinct datastreams do not.
  return {
    isMint: true,
    reason: "ecid-first-mint",
    mintKey: "ECID@" + datastreamOf(url),
    namespace: "ECID",
  };
}

/**
 * Extract the ECID from an Edge interact response — the exact read alloy makes to
 * persist it: the first `identity:result` handle's payload entry whose
 * `namespace.code === "ECID"`. Defensive: returns `null` (never throws) on a
 * missing/empty handle or a response with no ECID namespace.
 *
 * Relocated here from rig/alloy-mint-stub.js (which now re-exports it) so the
 * browser broker can read the coalesced response without importing node:crypto.
 * @param {{ handle?: Array<{ type?: string, payload?: Array<{ id?: string, namespace?: { code?: string } }> }> } | null | undefined} response
 * @returns {string | null}
 */
export function extractEcidFromInteractResponse(response) {
  const handles = (response && response.handle) || [];
  for (const h of handles) {
    if (h && h.type === "identity:result") {
      for (const entry of h.payload || []) {
        if (entry && entry.namespace && entry.namespace.code === "ECID") return entry.id;
      }
    }
  }
  return null;
}
