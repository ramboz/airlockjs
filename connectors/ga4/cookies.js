/**
 * GA4 identity sourcing from the `_ga` / `_ga_<stream>` cookies (slice 004-03), PLUS (039-03) the
 * `_ga_<stream>` session-state READ-MODIFY-WRITE writer, `writeGa4SessionState` below — the
 * stateful counterpart that closes OQ13-2.
 *
 * Pure, dependency-injected module — no DOM, no globals, no Date.now/Math.random
 * hardwired in the logic (both are injectable, defaulted params). The HOST runs
 * this on the main thread (the connector never touches document.cookie — the
 * chamber stays cookie-free, capability.d.ts / ADR-0003): the adapter hands it a
 * capability-shaped async cookie accessor plus the raw cookie string for stream
 * discovery, and gets back the MINIMAL `{ clientId, sessionId }` ctx snapshot.
 *
 * GRAMMAR CAVEAT (slice Assumptions / ga4-mp.md § Provenance): the cookie shapes
 * below are community-derived, NOT part of Google's pinned contract, and have
 * already drifted once (GS1→GS2). Every parser here degrades to `null` on any
 * shape violation — never a throw — and the caller takes the documented fallback.
 *
 *   _ga           = GA1.<domain-depth>.<random>.<unix-seconds>
 *                   → client_id is the LAST TWO dotted segments (prefix-tolerant)
 *   _ga_<STREAM>  = GS1.1.<session_id>.<session_number>.…        (dot-separated)
 *                 | GS2.1.s<session_id>$o<n>$…    ($-separated, s-prefixed field)
 *
 * `sourceGa4Ctx`'s OWN return shape stays pinned to exactly `{ clientId, sessionId }` (an existing
 * craft-review pin, `test/ga4-cookies.test.js`'s "returns EXACTLY the minimal snapshot" case) — the
 * new session-state fields (`sct`/`seg`/`_fv`/`_ss`/`_nsi`) are NOT added onto it; they are a
 * SEPARATE return from `writeGa4SessionState`, threaded by the caller into `ctx.sessionState`
 * (`connectors/ga4/gtag.js`'s `mapToGtagCollect` projects that object onto the beacon), mirroring
 * how `ctx.consent` (039-02) is a sibling addition rather than a `sourceGa4Ctx` return-shape change.
 */

const DIGITS = /^\d+$/;

/** `_ga` cookie lifetime on write: ≈ 2 years (GA's own default). Browsers cap the
 *  effective lifetime (Safari ITP ~7d for script-written cookies, Chrome ~400d) —
 *  caps shorten continuity, never break correctness. */
export const GA_COOKIE_MAX_AGE_S = 63072000;

/**
 * Extract a GA4 `client_id` from a raw `_ga` cookie value: the last two dotted
 * segments `<random>.<unix-seconds>` (both numeric), tolerant of prefix /
 * domain-depth variation (`GA1.1.…`, `GA1.2.…`, or an already-bare pair).
 * @param {string|null|undefined} value raw `_ga` cookie value.
 * @returns {string|null} the client_id, or null on any malformed/absent shape.
 */
export function parseGaClientId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 2) return null;
  const random = parts[parts.length - 2];
  const seconds = parts[parts.length - 1];
  if (!DIGITS.test(random) || !DIGITS.test(seconds)) return null;
  return `${random}.${seconds}`;
}

/**
 * Extract a GA4 `session_id` from a raw `_ga_<STREAM>` cookie value, tolerating
 * the GS1→GS2 grammar drift: GS1 keeps it as the third dot-segment; GS2 packs
 * `$`-separated fields into that segment with the session id `s`-prefixed.
 * @param {string|null|undefined} value raw `_ga_<STREAM>` cookie value.
 * @returns {string|null} the session_id, or null on any malformed/absent shape.
 */
export function parseGaSessionId(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts.length < 3) return null;
  const field = parts[2];
  if (field.includes("$") || field.startsWith("s")) {
    // GS2: find the s-prefixed numeric field among the $-separated fields.
    for (const f of field.split("$")) {
      const m = /^s(\d+)$/.exec(f);
      if (m) return m[1];
    }
    return null;
  }
  // GS1: the third dot-segment IS the session id.
  return DIGITS.test(field) ? field : null;
}

/**
 * Find the `_ga_<STREAM>` session cookie's raw value in a full `document.cookie`
 * string — `_ga` itself, `_gat`, `_gid` never match (the name must be `_ga_` plus
 * a non-empty stream id). When several `_ga_*` cookies exist (multi-stream page),
 * the FIRST in document.cookie order wins — a deterministic, documented pick; a
 * stream-selection policy is out of scope for MVP1's single-stream deployment.
 * @param {string|null|undefined} cookieString the raw `document.cookie` string.
 * @returns {string|null} the (decoded) cookie value, or null when absent.
 */
export function findGaStreamCookie(cookieString) {
  if (typeof cookieString !== "string" || cookieString.length === 0) return null;
  for (const pair of cookieString.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (name.startsWith("_ga_") && name.length > 4) {
      const raw = pair.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw; // malformed %-escape: use the raw value, never throw
      }
    }
  }
  return null;
}

/**
 * The GA1 write format for a generated client_id — written AS `_ga` (not an
 * airlock-owned name) so on-page GA / later gtag coexistence reads the same
 * identity in both directions (slice 004-03 Assumptions).
 * @param {string} clientId `<random>.<unix-seconds>`
 */
export function formatGaCookieValue(clientId) {
  return `GA1.1.${clientId}`;
}

/**
 * Source the minimal GA4 identity ctx (ADR-0003 snapshot) on the host:
 *
 *  - `clientId` from `_ga` via the mediated accessor; when absent, GENERATE
 *    `<10-digit random>.<unix-seconds>` and persist it as `_ga` in GA1 format
 *    (max-age ≈ 2y, path=/, SameSite=Lax). The write is defensive: an EXISTING
 *    `_ga` — even one we cannot parse — is never overwritten (a malformed value
 *    may be a newer grammar another tag understands); the generated id then
 *    serves this page only.
 *  - `sessionId` from `_ga_<stream>` (found in `cookieString`); absent/malformed
 *    falls back to a per-page session id (unix-seconds at boot) — on a gtag-free
 *    site this fallback is the steady state (slice Assumptions).
 *
 * Consent note (017-02, ADR-0007 point ②): this identity sourcing IS gated on
 * `analytics_storage` now — resolves refinement-todo OQ13 item 1. `storageGranted:
 * false` (denied OR pending — anything short of an explicit grant) skips the `_ga`
 * READ too, not just the write: parsing/returning an already-persisted `_ga` under
 * denial would itself be USING denied storage (the leak a write-only gate would
 * miss — frame-critique). `session_id` gets the same treatment, never reading
 * `_ga_<stream>`. The `storageGranted:true` (default) branch below is
 * byte-identical to 004-03 — a caller that never wires consent at all keeps the
 * legacy always-persist behavior (back-compat).
 *
 * @param {object} opts
 * @param {{ get(name: string): Promise<string|null>,
 *           set(name: string, value: string, opts?: object): Promise<void> }} opts.cookies
 *   capability.d.ts-shaped async cookie accessor (host-mediated).
 * @param {string} [opts.cookieString] raw `document.cookie`, ONLY for `_ga_<stream>`
 *   discovery (the stream suffix is unknowable a priori, and the capability shape
 *   has no enumeration). It never enters the returned ctx.
 * @param {() => number} [opts.now]    injectable clock (ms), default Date.now.
 * @param {() => number} [opts.random] injectable [0,1) source, default Math.random.
 * @param {boolean} [opts.storageGranted] the resolved `analytics_storage` grant
 *   (`resolveConsent(vector, "analytics_storage") === "granted"`, `core/consent.js`).
 *   Defaults to `true` — back-compat for a caller with no consent vector wired at
 *   all (keeps 004-03's unconditional persist). `false` → no `_ga`/`_ga_<stream>`
 *   read or write; a fresh ephemeral `client_id` + per-page `session_id` instead.
 * @returns {Promise<{ clientId: string, sessionId: string }>} the minimal snapshot.
 */
export async function sourceGa4Ctx({
  cookies,
  cookieString = "",
  now = Date.now,
  random = Math.random,
  storageGranted = true,
}) {
  const bootSeconds = Math.floor(now() / 1000);
  const mintEphemeralClientId = () =>
    `${String(1_000_000_000 + Math.floor(random() * 9_000_000_000))}.${bootSeconds}`;

  if (!storageGranted) {
    // 017-02: analytics_storage NOT granted (denied/pending). NO read, NO write —
    // a FRESH ephemeral client_id + per-page session, IGNORING any persisted
    // _ga / _ga_<stream> (reading a persisted id is itself using denied storage;
    // ADR-0007 "drop the persistent client_id"). Fresh random each boot → no
    // cross-page continuity.
    return { clientId: mintEphemeralClientId(), sessionId: String(bootSeconds) };
  }

  // GRANTED (004-03, UNCHANGED): read existing _ga, else generate+persist; read _ga_<stream> session.
  const rawGa = await cookies.get("_ga");
  let clientId = parseGaClientId(rawGa);
  if (clientId === null) {
    clientId = mintEphemeralClientId();
    if (rawGa == null) {
      await cookies.set("_ga", formatGaCookieValue(clientId), {
        maxAge: GA_COOKIE_MAX_AGE_S,
        path: "/",
        sameSite: "lax",
      });
    }
  }
  const sessionId = parseGaSessionId(findGaStreamCookie(cookieString)) ?? String(bootSeconds);
  return { clientId, sessionId };
}

/** The GA4 session-timeout default (30 min) — the documented Admin-console default, bracketed
 *  ~[5min, 33min] by direct observation (slice 039-03 Assumptions). CONFIGURABLE, never hardwired
 *  into the transition logic below: it is a per-GA4-property Admin setting, so a rewire target
 *  that customized it would diverge on exactly the `sct`/`_ss`/`_nsi` parity this slice promises. */
export const DEFAULT_GA_SESSION_TIMEOUT_MINUTES = 30;

/** The GS2 opaque `j`/`l`/`h` tail observed constant (`j60`/`l0`/`h0`) across every capture
 *  (039-03 Assumptions) — the mint default for a brand-new `_ga_<stream>` cookie. An EXISTING
 *  cookie's own tail is always carried verbatim instead (never re-derived from this constant). */
const GS2_TAIL_DEFAULT = ["j60", "l0", "h0"];

/**
 * Parse a raw `_ga_<STREAM>` GS2 cookie value into its individually-addressable session-state
 * fields, order-tolerant (scans every `$`-separated field for its `s`/`o`/`g`/`t` prefix, mirroring
 * `parseGaSessionId`'s own permissive-scan style), preserving every OTHER field VERBATIM as an
 * opaque `tail` array (the `j`/`l`/`h` sub-fields, 039-03 AC1 — never authored, only carried).
 * @param {string|null|undefined} value raw `_ga_<STREAM>` cookie value.
 * @returns {{ sid: string, sct: string, engaged: string, lastHit: string, tail: string[] }|null}
 *   `null` on any malformed/absent/incomplete/GS1 shape (writer support is GS2-only; degrades to
 *   null, never throws — this module's standing discipline).
 */
function parseGa4SessionState(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const parts = value.split(".");
  if (parts[0] !== "GS2" || parts.length < 3) return null;
  const known = {};
  const tail = [];
  for (const f of parts[2].split("$")) {
    const s = /^s(\d+)$/.exec(f);
    if (s && known.sid === undefined) {
      known.sid = s[1];
      continue;
    }
    const o = /^o(\d+)$/.exec(f);
    if (o && known.sct === undefined) {
      known.sct = o[1];
      continue;
    }
    const g = /^g(\d+)$/.exec(f);
    if (g && known.engaged === undefined) {
      known.engaged = g[1];
      continue;
    }
    const t = /^t(\d+)$/.exec(f);
    if (t && known.lastHit === undefined) {
      known.lastHit = t[1];
      continue;
    }
    tail.push(f); // opaque (j/l/h/…) — carried verbatim, never interpreted
  }
  if (
    known.sid === undefined ||
    known.sct === undefined ||
    known.engaged === undefined ||
    known.lastHit === undefined
  ) {
    return null; // incomplete GS2 body — never partially trusted
  }
  return { sid: known.sid, sct: known.sct, engaged: known.engaged, lastHit: known.lastHit, tail };
}

/**
 * Format the GS2 `_ga_<STREAM>` write value: `GS2.1.s{sid}$o{sct}$g{engaged}$t{lastHit}` plus the
 * given tail fields, carried verbatim (039-03 AC1's grammar).
 * @param {{ sid: string, sct: string, engaged: string, lastHit: string, tail: string[] }} fields
 */
function formatGa4SessionCookieValue({ sid, sct, engaged, lastHit, tail }) {
  const suffix = (tail || []).map((f) => `$${f}`).join("");
  return `GS2.1.s${sid}$o${sct}$g${engaged}$t${lastHit}${suffix}`;
}

/**
 * Read-modify-write the `_ga_<stream>` session cookie every cycle (039-03, closes OQ13-2) — the
 * genuinely NEW write discipline the slice's DoR calls out, in contrast to `sourceGa4Ctx`'s
 * create-if-absent `_ga` write above (`cookies.js:171`, `if (rawGa == null)`), which never mutates
 * an EXISTING cookie. This function always reads, advances, and writes back, reproducing gtag's
 * OBSERVED session-state machine (`docs/specs/039-ga4-gtag-connector/slice-03-session-state-
 * writer.md` § Assumptions, grounded 2026-09-08):
 *
 *  - **no existing cookie** -> FIRST VISIT: mint `sid=now`, `sct=1`, `engaged=0`; the returned
 *    beacon state carries `_fv`/`_ss`/`_nsi` (all `"1"`), `sct="1"`, `seg="0"`.
 *  - **existing cookie, `now - lastHit <= timeout`** -> CONTINUATION: `sid`/`sct` UNCHANGED,
 *    `engaged` flips to `"1"` (the observed 2nd-pageview engagement threshold, Assumptions'
 *    residual), `lastHit=now`; the returned state carries ONLY `sct`/`seg` — no `_fv`/`_ss`/`_nsi`
 *    keys at all (not merely `undefined` values).
 *  - **existing cookie, `now - lastHit > timeout`** -> NEW SESSION: `sid=now` (fresh), `sct` +=1,
 *    `engaged=0`, `lastHit=now`; the returned state carries `_ss`/`_nsi` (both `"1"`), `sct`
 *    (incremented), `seg="0"` — no `_fv` key (not a first-ever visit).
 *
 * In every branch the cookie's opaque `j`/`l`/`h` tail is carried verbatim — minted to
 * `GS2_TAIL_DEFAULT` only on a genuine first visit, otherwise copied from the existing cookie
 * untouched (never re-derived, never authored).
 *
 * Gated on `analytics_storage` (017-02's gate discipline — `storageGranted` is the SAME kind of
 * already-resolved boolean `sourceGa4Ctx`'s own `storageGranted` param takes, `cookies.js:151`).
 * **The caller MUST resolve it from the RAW ADR-0007 consent vector**
 * (`resolveConsent(vector, "analytics_storage") === "granted"`, `core/consent.js`) — NEVER from the
 * MP-shaped `{ ad_user_data, ad_personalization }` object `connectors/ga4/consent.js` produces
 * (that shape carries no storage-purpose signal at all; refinement-todo.md item 2's neighbor
 * hazard). `false` (denied OR pending) -> NO read, NO write (mirrors `sourceGa4Ctx`'s own
 * never-even-read leak-prevention discipline exactly) and this returns `null` — the caller's
 * per-page session-id fallback (`sourceGa4Ctx`'s own `storageGranted:false` branch) stands in.
 *
 * @param {object} opts
 * @param {{ get(name: string): Promise<string|null>, set(name: string, value: string, opts?: object): Promise<void> }} opts.cookies
 *   capability.d.ts-shaped async cookie accessor (host-mediated) — the SAME shape `sourceGa4Ctx` takes.
 * @param {string} opts.streamCookieName the concrete `_ga_<STREAM>` cookie name. UNLIKE
 *   `sourceGa4Ctx`'s read-only discovery-by-scanning (`findGaStreamCookie`, needed because the
 *   stream suffix is unknowable a priori for a cookie airlock has never written), the WRITE target
 *   must be a single stable, known name every cycle — host-supplied config, not scanned.
 * @param {() => number} [opts.now] injectable clock (ms), default `Date.now`.
 * @param {number} [opts.sessionTimeoutMinutes] the session-boundary window, default
 *   `DEFAULT_GA_SESSION_TIMEOUT_MINUTES` (30) — CONFIGURABLE (see that constant's doc comment).
 * @param {boolean} [opts.storageGranted] the resolved `analytics_storage` grant. Defaults `true` —
 *   back-compat for a caller with no consent vector wired at all (mirrors `sourceGa4Ctx`'s own
 *   default), see the RAW-vector requirement above.
 * @returns {Promise<{ sessionId: string, sct: string, seg: string, _fv?: string, _ss?: string, _nsi?: string }|null>}
 *   the beacon-ready session-state snapshot (`sessionId` -> `ctx.sessionId`/the beacon's `sid`; the
 *   rest -> `ctx.sessionState`, projected verbatim onto `sct`/`seg`/`_fv`/`_ss`/`_nsi` by
 *   `connectors/ga4/gtag.js`'s `mapToGtagCollect`), or `null` when storage is not granted.
 */
export async function writeGa4SessionState({
  cookies,
  streamCookieName,
  now = Date.now,
  sessionTimeoutMinutes = DEFAULT_GA_SESSION_TIMEOUT_MINUTES,
  storageGranted = true,
}) {
  if (!storageGranted) {
    // 017-02 discipline: no signal (or an explicit denial) -> NO read, NO write, no cross-page
    // continuity — the caller's per-page session-id fallback stands in (sourceGa4Ctx's own path).
    return null;
  }

  const nowSeconds = Math.floor(now() / 1000);
  const existing = parseGa4SessionState(await cookies.get(streamCookieName));

  /** @type {{ sid: string, sct: string, engaged: string, lastHit: string, tail: string[] }} */
  let next;
  /** @type {{ sessionId: string, sct: string, seg: string, _fv?: string, _ss?: string, _nsi?: string }} */
  let beacon;

  if (existing === null) {
    // FIRST VISIT.
    const sid = String(nowSeconds);
    next = { sid, sct: "1", engaged: "0", lastHit: sid, tail: [...GS2_TAIL_DEFAULT] };
    beacon = { sessionId: sid, sct: "1", seg: "0", _fv: "1", _ss: "1", _nsi: "1" };
  } else {
    const timeoutSeconds = sessionTimeoutMinutes * 60;
    const gapSeconds = nowSeconds - Number(existing.lastHit);
    if (gapSeconds > timeoutSeconds) {
      // NEW SESSION.
      const sid = String(nowSeconds);
      const sct = String(Number(existing.sct) + 1);
      next = { sid, sct, engaged: "0", lastHit: sid, tail: existing.tail };
      beacon = { sessionId: sid, sct, seg: "0", _ss: "1", _nsi: "1" };
    } else {
      // CONTINUATION.
      next = { sid: existing.sid, sct: existing.sct, engaged: "1", lastHit: String(nowSeconds), tail: existing.tail };
      beacon = { sessionId: existing.sid, sct: existing.sct, seg: "1" };
    }
  }

  await cookies.set(streamCookieName, formatGa4SessionCookieValue(next), {
    maxAge: GA_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
  });

  return beacon;
}
