/**
 * Host-side mediated cookie accessor (slice 004-03, AC2) — the
 * `GrantedCapabilities.cookies` shape from contracts/capability.d.ts (async
 * get/set + CookieOptions) implemented over `document.cookie`, "backed by the
 * orchestrator on the main thread".
 *
 * This is the HOST half of the capability: in MVP1 the ADAPTER uses it to source
 * the GA4 identity ctx (host-side sourcing, slice Assumptions) — no connector
 * grant flow is exercised yet, and the chamber stays cookie-free. The value is
 * percent-encoded on write / decoded on read so a value can never smuggle cookie
 * attributes; names are used verbatim (`_ga` etc. are attribute-safe).
 *
 * NOT grant-ready as-is (arch review 004-03): this is the RAW whole-jar host
 * backing. Before it is ever granted to a connector it must be wrapped
 * name-scoped (default-deny per `CapabilityRequest.cookies`) with the name
 * validated (an unvalidated name is an attribute-injection surface); its likely
 * eventual home is `core/` per capability.d.ts's "backed by the orchestrator".
 * Tracked in refinement-todo OQ13.
 */

/**
 * @param {{ cookie: string }} [doc] the document to mediate (default: the global).
 * @returns {{ get(name: string): Promise<string|null>,
 *             set(name: string, value: string, opts?: {
 *               maxAge?: number, path?: string, domain?: string,
 *               sameSite?: "strict"|"lax"|"none", secure?: boolean }): Promise<void> }}
 */
export function createCookieCapability(doc = typeof document !== "undefined" ? document : undefined) {
  return {
    async get(name) {
      const jar = (doc && doc.cookie) || "";
      for (const pair of jar.split(";")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        if (pair.slice(0, eq).trim() !== name) continue;
        const raw = pair.slice(eq + 1).trim();
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw; // malformed %-escape: surface the raw value, never throw
        }
      }
      return null;
    },

    async set(name, value, opts = {}) {
      if (!doc) return; // symmetric with get(): no document → no-op, never throw
      let str = `${name}=${encodeURIComponent(value)}`;
      if (opts.maxAge !== undefined) str += `; max-age=${opts.maxAge}`;
      if (opts.path) str += `; path=${opts.path}`;
      if (opts.domain) str += `; domain=${opts.domain}`;
      if (opts.sameSite) str += `; samesite=${opts.sameSite}`;
      if (opts.secure) str += "; secure";
      doc.cookie = str;
    },
  };
}
