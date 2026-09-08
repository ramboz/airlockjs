/**
 * The ctx-sourcing rule — spec 038-02 AC1, the DECISIVE modelling choice. `connectors/ga4/map.js`'s
 * `mapToMp` reads `ctx.clientId` / `ctx.sessionId` UNCONDITIONALLY (`map.js:63-64`) — it never
 * reads a beacon. In a real deployment this `ctx` is `connectors/ga4/cookies.js`'s `sourceGa4Ctx`,
 * reading the SAME first-party `_ga` / `_ga_<stream>` cookies the container's `gtag.js` also
 * reads/writes. In the harness (no live cookies — R5) this module reproduces exactly that
 * coupling: it feeds `sourceGa4Ctx` the FIXTURE's redacted cookie context, so `cid`/`sid` classify
 * `maps` because airlock and the container read the SAME cookie — never by short-cutting and
 * feeding the captured beacon's OWN `cid`/`sid` straight into `ctx` (a tautological false-green on
 * the very identity fields the oracle checks: of course airlock's beacon would "match" the
 * container's if fed the container's own values). `sourceGa4Ctx` itself is REUSED, unmodified.
 */
import { sourceGa4Ctx } from "../../connectors/ga4/cookies.js";

/**
 * Build a `document.cookie`-shaped string from a `{name: value}` cookie map — a harness-only
 * convenience (a real host reads the browser's actual cookie jar; `sourceGa4Ctx` only needs the
 * raw string to discover the dynamic `_ga_<stream>` suffix, `cookies.js:134`).
 * @param {Readonly<Record<string,string>>} [cookieMap]
 * @returns {string}
 */
export function cookieMapToString(cookieMap) {
  return Object.entries(cookieMap || {})
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Source airlock's GA4 identity/session `ctx` from a fixture's redacted cookie context — the SAME
 * `_ga` / `_ga_<stream>` cookies the container's own `gtag.js` read to produce the captured
 * beacon's `cid` / `sid` (AC1). Callers must NEVER pass the captured beacon's own fields here —
 * only the fixture's `cookies` map.
 * @param {Object} args
 * @param {Readonly<Record<string,string>>} [args.cookies] - the fixture's `{name: value}` cookie
 *   map (e.g. `{ _ga: "...", _ga_DEBUGTEST0: "..." }`).
 * @param {() => number} [args.now] - injectable clock (ms), forwarded to `sourceGa4Ctx`'s
 *   per-page-session fallback (OQ13-2) — lets a test pin the fallback's minted value.
 * @param {() => number} [args.random] - injectable [0,1) source, forwarded to `sourceGa4Ctx`.
 * @returns {Promise<{ clientId: string, sessionId: string }>}
 */
export function sourceGa4CtxFromFixture({ cookies = {}, now, random } = {}) {
  const cookieAccessor = {
    async get(name) {
      return Object.prototype.hasOwnProperty.call(cookies, name) ? cookies[name] : null;
    },
    async set() {
      // The harness never persists a cookie write — sourceGa4Ctx only calls set() on a
      // client_id cache-miss (a well-formed redacted fixture never hits that path in practice),
      // but a no-op keeps the call safe regardless.
    },
  };
  const cookieString = cookieMapToString(cookies);
  return sourceGa4Ctx({
    cookies: cookieAccessor,
    cookieString,
    ...(now ? { now } : {}),
    ...(random ? { random } : {}),
  });
}
