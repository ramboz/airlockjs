// Payload governance — the host-owned, input-side sensitive-field denylist
// (spec 019-01, resolving OQ11 via ADR-0012). `governPayload` strips
// dangerous field names / dotted paths from a captured event's `params`
// BEFORE it crosses into the untrusted chamber, at BOTH of core/airlock.js's
// governance points (the async `sendBatch` chokepoint shared by drain() +
// flushNow(), and the sync/critical dispatcher shared by pushCritical() +
// the unloadFlush ring-tail) — so a denied field never reaches a connector,
// and, because a connector builds egress from what it received, never
// reaches the vendor either.
//
// Denylist, not allowlist (ADR-0012): the payload is site-defined/open (UC-2
// custom events, OQ3's still-unpinned emergent schema), so a field-allowlist
// on this channel collapses to a wildcard (GA4 declares `reads: ["*"]`,
// spec 014-03) — no governance at all. A host-owned denylist of known-
// dangerous fields fits an open channel; if OQ3 later pins a schema this
// seam tightens denylist -> allowlist without moving (ADR-0012 Kill #1).
//
// VENDOR-NEUTRAL / IMPORT-FREE / NO AMBIENT GLOBALS (mirrors core/consent.js,
// core/endpoint-ceiling.js — this module is pure object manipulation, so
// unlike core/sanitize-html.js it needs no DOM/parser global at all, default
// or injected). Guarded structurally by test/core-boundary.test.js's
// core/->rig/ check and its import-free guard, and by inspection: there is
// no `import` statement below.
//
// PURE — `governPayload` never touches a `diagnose`/console global or any
// other side-effecting seam (019-01 frame-critique correction: AC7's
// diagnostic is emitted by the IMPURE CALLER — core/airlock.js's `sendBatch`
// / sync dispatcher — from the `stripped` array this function returns, never
// from inside here).
//
// NON-MUTATION IS LOAD-BEARING (019-01 frame-critique's "nested-mutation-
// trap" focus): core/airlock.js's `push()` shares the SAME descriptor object
// between the main-thread event log/projection and the ring the crossings
// drain from (airlock.js:240-243). `governPayload` must therefore NEVER
// write through its `params` input — a naive shallow copy that then deletes
// a NESTED key (`out.user.email`) would still mutate the shared
// `params.user` sub-object, silently corrupting the local log/projection.
// The correct shape is COPY-ON-WRITE ALONG THE DENIED PATH: clone only the
// ancestor objects that sit on an actually-denied path (`out.user = {
// ...params.user }; delete out.user.email`), leaving every off-path
// sibling/subtree structurally SHARED with the input — NOT a full deep
// clone (wasteful: it would also duplicate every untouched subtree) and NOT
// a shallow top-level-only copy (unsafe: it would mutate the shared
// sub-object). See test/payload-governance.test.js's nested-path cases and
// test/payload-governance-seam.test.js's sibling-subtree-identity assertion
// for the machine-checked proof.
//
// MATCH SEMANTICS (ADR-0012 open question, PINNED here):
//   - A denylist entry with NO "." is a bare top-level FIELD NAME — it
//     denies a key at the TOP LEVEL of `params` only (a nested field with
//     the same bare name, e.g. `user.password`, is NOT reached by a bare
//     "password" entry; use the dotted form for that).
//   - A denylist entry CONTAINING "." is a DOTTED PATH into a nested object
//     ("user.email") — it denies exactly that nested leaf, navigated
//     segment by segment from the top of `params`.
//   - Both forms match CASE-INSENSITIVELY (a denylist entry "PASSWORD"
//     strips a field named "password" or "Password"; a path segment matches
//     the same way at each hop) and EXACTLY (no substring/prefix/glob — a
//     "password" entry does NOT strip "passwordConfirm").
//   - A denylist entry that is not a non-empty string, or a dotted path that
//     does not resolve to an existing leaf, is silently skipped — never
//     throws, never partially mutates.
//
// A conservative built-in DEFAULT_DENYLIST ships below (defense-in-depth,
// CLAUDE.md security-MUST: guardrails are defense-in-depth, not a
// guarantee). It is intentionally SMALL — a too-aggressive default risks
// stripping a legitimately-named site field (ADR-0012 Consequences) — and is
// meant to be MERGED with, never a substitute for, a host's own declared
// denylist. That merge is the CALLER's job (core/airlock.js). **The built-in
// default is ALWAYS-ON (maintainer decision 2026-08-31): it strips even on an
// unconfigured deployment** — the footgun population (a site that never
// considered PII) is exactly the unconfigured one, and the set is a
// near-no-op for real payloads (none carry those exact field names). AC6
// back-compat holds in CONTENT (a payload with none of the denied fields is
// byte-identical + reference-identical after governance — see governPayload's
// nothing-stripped return), not as "no governance runs". `governPayload`
// itself has no opinion on defaults: it strips exactly the `denylist` it is
// handed, nothing more, nothing less — the always-on merge lives in the caller.

/**
 * A conservative built-in default denylist — common raw-form-input /
 * declared-PII field NAMES (top-level; not dotted paths). Lower-case;
 * matched case-insensitively by `governPayload` regardless. Extend, never
 * solely rely on — this is a starting set, not a complete PII defense
 * (ADR-0012's honest boundary: renamed fields and value-level PII in a
 * benign-named field are out of a field-name denylist's reach).
 */
export const DEFAULT_DENYLIST = [
  "password",
  "passwd",
  "pwd",
  "cvv",
  "cvv2",
  "cvc",
  "ssn",
  "social_security_number",
  "card_number",
  "cardnumber",
  "credit_card",
  "creditcard",
  "cc_number",
];

/**
 * Find the actual own key in `obj` matching `name` case-insensitively.
 * Pure, defensive: returns `undefined` (never throws) for a non-object
 * `obj` or when no key matches.
 * @param {unknown} obj
 * @param {string} name
 * @returns {string | undefined}
 */
function findKeyCaseInsensitive(obj, name) {
  if (obj == null || typeof obj !== "object") return undefined;
  const lower = name.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) return key;
  }
  return undefined;
}

/**
 * ALL own keys of `obj` matching `name` case-insensitively (019-01 craft
 * review — a security fix). A field may appear under >1 casing at the same
 * level (e.g. both `password` and `Password`, plausibly from merged /
 * autofilled form sources); stripping only the FIRST would silently leak the
 * value of the second — the exact field the denylist exists to remove. So the
 * strip callers delete EVERY match, not just one. Pure, defensive: `[]` for a
 * non-object or no match, never throws.
 * @param {unknown} obj
 * @param {string} name
 * @returns {string[]}
 */
function matchingKeysCaseInsensitive(obj, name) {
  if (obj == null || typeof obj !== "object") return [];
  const lower = name.toLowerCase();
  return Object.keys(obj).filter((key) => key.toLowerCase() === lower);
}

/**
 * Strip one dotted-path denial from `governed` IN PLACE, but ONLY via
 * copy-on-write along the path — see the module docstring's non-mutation
 * note. `governed` is always already the top-level shallow copy
 * `governPayload` made, so mutating IT is safe; what this function must
 * never do is write through to a NESTED object `governed` still shares by
 * reference with the caller's original `params` (e.g. `governed.user` before
 * this function clones it).
 *
 * Two phases: (1) a READ-ONLY resolve confirming the full path — including
 * the leaf — actually exists (case-insensitively at each hop); a path that
 * does not fully resolve is a no-op, no clone. (2) only once resolution
 * succeeds, clone each ancestor ON the path and delete the leaf on the
 * freshly-cloned deepest object.
 * @param {Record<string, unknown>} governed
 * @param {string[]} segments the dotted path's non-empty segments (length >= 2)
 * @returns {boolean} whether a leaf was actually found + stripped
 */
function stripDottedPath(governed, segments) {
  let cur = governed;
  const actualKeys = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const key = findKeyCaseInsensitive(cur, segments[i]);
    if (key === undefined) return false; // path does not resolve -> no mutation
    actualKeys.push(key);
    cur = cur[key];
  }
  const leafKeys = matchingKeysCaseInsensitive(cur, segments[segments.length - 1]);
  if (leafKeys.length === 0) return false; // leaf absent -> nothing to strip

  let node = governed;
  for (const key of actualKeys) {
    node[key] = { ...node[key] }; // copy-on-write: clone ONLY this ancestor
    node = node[key];
  }
  for (const leafKey of leafKeys) delete node[leafKey]; // ALL case-variants (craft review)
  return true;
}

/**
 * Strip every denylisted field from `params`, returning a GOVERNED COPY plus
 * the list of field/path names actually removed. Never mutates `params`
 * (see the module docstring); never throws (malformed input fails safe to a
 * best-effort copy — worst case, the untouched original reference).
 *
 * @param {Record<string, unknown>} params the captured event's params, as
 *   held by the crossing (core/airlock.js's `descriptor.params`) — may be
 *   the SAME object the local event log/projection also references.
 * @param {readonly string[] | null | undefined} denylist the fields/dotted
 *   paths to strip (see the module docstring's match semantics). An
 *   empty/absent/non-array denylist is treated as "no governance configured".
 * @returns {{ governed: Record<string, unknown>, stripped: string[], error?: boolean }}
 *   `governed`: `params` UNCHANGED (the SAME reference) when `denylist` is
 *   empty/absent — no clone on the hot drain path (AC6); otherwise a COPY of
 *   `params` with every denied field/path removed (EVERY case-variant at each
 *   matched level, not just the first — craft review). `stripped`: the denylist
 *   entries that were actually present and removed, in the order checked
 *   (top-level entries first, then dotted paths) — for the impure caller to
 *   surface as a redacted diagnostic (field NAME only, never the value);
 *   empty when nothing matched. `error`: present + `true` ONLY when the strip
 *   failed safe (a throwing getter on `params`) and governance was skipped —
 *   the caller surfaces an error-level diagnostic so the miss is observable.
 */
export function governPayload(params, denylist) {
  const entries = Array.isArray(denylist)
    ? denylist.filter((e) => typeof e === "string" && e.length > 0)
    : [];
  if (entries.length === 0) return { governed: params, stripped: [] };

  try {
    const governed = { ...params };
    const stripped = [];

    // Top-level bare-name entries first — delete EVERY case-variant match
    // (craft review: stripping only the first would leak the second's value).
    for (const entry of entries) {
      if (entry.includes(".")) continue; // dotted paths handled below
      const keys = matchingKeysCaseInsensitive(governed, entry);
      if (keys.length) {
        for (const key of keys) delete governed[key];
        stripped.push(entry);
      }
    }

    // Then dotted-path entries, copy-on-write along each denied path.
    for (const entry of entries) {
      if (!entry.includes(".")) continue;
      const segments = entry.split(".").filter(Boolean);
      if (segments.length < 2) continue; // malformed path (e.g. "." or "a.") -> ignore, never throw
      if (stripDottedPath(governed, segments)) stripped.push(entry);
    }

    // Nothing matched -> return the ORIGINAL reference (the `{...params}` copy
    // was never written to): a payload with none of the denied fields is
    // byte-identical AND reference-identical after governance (AC6 content
    // back-compat, and the common case now that DEFAULT_DENYLIST is
    // always-on — so a clean payload never keeps a needless clone).
    return { governed: stripped.length ? governed : params, stripped };
  } catch {
    // Never throw — e.g. a hostile getter on `params` that throws when
    // read. Fail safe to a best-effort copy; if even THAT throws, fall all
    // the way back to the original reference (still no governance applied,
    // but the caller's dispatch path is never broken by this primitive).
    // Fail safe but NOT SILENT (019-01 arch+craft review): flag `error` so
    // the impure caller surfaces an error-level diagnostic — a security
    // control that skips governance must not do so invisibly.
    try {
      return { governed: { ...params }, stripped: [], error: true };
    } catch {
      return { governed: params, stripped: [], error: true };
    }
  }
}
