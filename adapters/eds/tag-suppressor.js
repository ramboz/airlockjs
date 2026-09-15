// Native-tag suppressor — spec 049-01 (ADR-0030's vendor-generic mechanism,
// the MVP9 developer-provable rewire's page-side after-arm, ADR-0029).
//
// WHAT THIS IS: a config-driven, adopter-facing primitive that neutralizes a
// tag-manager container's migrated tags AT THE POINT OF DOM INSERTION —
// before the runtime `<script>` ever connects to the document, so it never
// downloads or evaluates (the TBT/CWV cost this after-arm exists to remove).
// The adopter supplies URL/query MATCHERS (host + optional pathname + optional
// required query key/value pairs); this module never hardcodes a vendor name,
// id, or endpoint — see test/eds-tag-suppressor.test.js's source-text grep
// guard, which machine-enforces that claim the same way core/sanitize-html.js's
// import-free claim is machine-enforced by test/core-boundary.test.js.
//
// HOME: adapters/eds/, NOT core/ — this module is inescapably DOM-coupled (it
// monkeypatches Node.prototype/Element.prototype and reads `.tagName`/`.src`
// off real DOM nodes), which is exactly the coupling docs/conventions.md's
// code-home rule reserves for the adapter layer (mirrors adapters/eds/dom.js's
// own home-justification). It references the ambient `Node`/`Element` globals
// directly, typeof-guarded so importing this module in Node/vitest (which has
// neither) never throws — see the SUBSTRATE note below for what that buys.
//
// THE INTERCEPTION SEAM (A2, grounded in rig/tag-suppressor.mjs, not here — a
// real browser is the only substrate that can prove a network-0 outcome).
// `installTagSuppressor` patches the FULL DOM script-insertion surface, not
// just one method: `Node.prototype.appendChild` / `insertBefore` /
// `replaceChild` (inherited by every node, including a `<head>` or an existing
// sibling `<script>` — the standard container idiom is
// `parentNode.insertBefore(script, firstScript)`, NOT `head.appendChild`) and
// `Element.prototype.append` / `prepend` / `insertAdjacentElement` (the
// convenience methods that do NOT live on Node.prototype). A candidate is a
// `<script>` element whose RESOLVED `.src` (the IDL property — already
// base-URL-resolved even while the element is still detached; NOT
// `getAttribute("src")`) matches a `suppress` matcher and is not matched by an
// `allow` matcher. A match is neutralized by never calling the native
// insertion for it — the element is left detached, so the browser's "prepare
// the script element" algorithm (which begins the fetch) never runs. A
// non-matching node is passed to the native method unchanged, and `append`/
// `prepend` (which accept multiple nodes) filter out only the matched ones,
// still inserting the rest.
//
// THE CARVE-OUT WINS BY CONSTRUCTION (AC3 / ADR-0030): `allow` is checked
// BEFORE `suppress` in `shouldSuppress`, so an over-broad adopter `suppress`
// matcher (e.g. a bare host, no pathname) can never suppress an
// `allow`-listed URL — airlock's own egress endpoints are the intended
// `allow` entries.
//
// IDEMPOTENT, SINGLE-INSTANCE INSTALL: the DOM patch is applied at most once
// per loaded copy of this module (a marker on the wrapped function itself,
// checked before wrapping again — mirrors the memoized-Trusted-Types-policy
// idiom in adapters/eds/dom.js). A second `installTagSuppressor(...)` call
// updates the active matcher config in place without re-wrapping the
// prototypes. `uninstall()` restores the exact saved native methods and
// clears the active config.
//
// NOT COVERED (named, not hidden — ADR-0030's kill criterion): a runtime
// injected by a mechanism this module cannot see — inlined into the
// container's own bundle, or fetched from inside a Worker via
// `importScripts`/`import()` — falls back to the profile-side after-arm
// (ADR-0029 Option A). A `<script>` arriving pre-assembled inside a
// DocumentFragment (rather than as the direct inserted node) is also outside
// this pass's coverage — see docs/refinement-todo.md.
//
// SUBSTRATE (mirrors core/sanitize-html.js's own note): Node/vitest has no
// `Node`/`Element`/`document` globals and this project ships no jsdom —
// `installTagSuppressor` typeof-guards them and no-ops (returns an inert,
// never-throwing controller) rather than pretend a patch happened. So the
// REAL prototype-patch + network-0 proof runs only in rig/tag-suppressor.mjs
// (a real Playwright/Chromium browser); this module's own unit tests
// (test/eds-tag-suppressor.test.js) cover only the pure matcher-compile /
// shouldSuppress predicate / carve-out precedence / diagnostic-record shape —
// the DOM-free logic extracted so it CAN be unit-tested in Node.

/**
 * @typedef {{ host: string, pathname?: string, query?: Record<string, unknown> }} Matcher
 */

/**
 * Compile + validate ONE raw matcher into its normalized internal shape.
 * Pure, DOM-free (spec 049-01 AC1/AC2). A matcher MUST name a `host` — an
 * empty/missing host compiles to `null` (never a universal wildcard, a
 * footgun guard). `pathname` is optional (host-only is valid — the
 * intentionally over-broad case AC3's carve-out exists for). `query` is an
 * optional set of REQUIRED key/value pairs (every declared key must be
 * present with an exactly-matching value on a candidate URL); values are
 * coerced to strings so a numeric/boolean config value still compares
 * correctly against a URL's (always-string) query value.
 * @param {Matcher | null | undefined} matcher
 * @returns {{ host: string, pathname: string | null, query: [string, string][] | null, source: Matcher } | null}
 */
export function compileMatcher(matcher) {
  if (!matcher || typeof matcher !== "object") return null;
  const host = typeof matcher.host === "string" ? matcher.host.trim().toLowerCase() : "";
  if (!host) return null;
  const pathname = typeof matcher.pathname === "string" && matcher.pathname.trim() ? matcher.pathname.trim() : null;
  let query = null;
  if (matcher.query && typeof matcher.query === "object") {
    const pairs = Object.entries(matcher.query)
      .filter(([key]) => typeof key === "string" && key.length > 0)
      .map(([key, value]) => /** @type {[string, string]} */ ([key, String(value)]));
    if (pairs.length) query = pairs;
  }
  return { host, pathname, query, source: matcher };
}

/** Compile a whole matcher array, silently dropping invalid entries (never throws). */
function compileMatchers(matchers) {
  return (Array.isArray(matchers) ? matchers : []).map(compileMatcher).filter(Boolean);
}

/** Does `url` satisfy one already-compiled matcher? Pure; never throws. */
function matchesCompiled(url, compiled) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false; // unparseable -> never a match (fails OPEN: worst case a script is not suppressed, never a broken page)
  }
  if (parsed.hostname.toLowerCase() !== compiled.host) return false;
  if (compiled.pathname !== null && parsed.pathname !== compiled.pathname) return false;
  if (compiled.query) {
    for (const [key, value] of compiled.query) {
      if (parsed.searchParams.get(key) !== value) return false;
    }
  }
  return true;
}

function firstMatch(url, compiledMatchers) {
  for (const compiled of compiledMatchers) {
    if (matchesCompiled(url, compiled)) return compiled;
  }
  return null;
}

/**
 * The precedence core (spec 049-01 AC1/AC3/AC4) shared by `shouldSuppress`
 * AND `installTagSuppressor`'s hot path — takes ALREADY-COMPILED matcher
 * lists (each entry `compileMatcher`'s own output), so calling this directly
 * never recompiles anything (the NIT perf fix: `installTagSuppressor` compiles
 * once at install/config-update time and stores the compiled arrays on
 * `state`, since the patched DOM methods sit on the page's hottest path — the
 * very path this module exists to keep cheap). `allow` is checked FIRST, so
 * an `allow`-matched URL is NEVER suppressed even when an over-broad
 * `suppress` matcher also matches it (AC3). Never throws (an unparseable
 * `url` or an invalid matcher entry simply does not match — see
 * `matchesCompiled`).
 * @param {string} url a candidate's resolved URL (e.g. a `<script>`'s `.src`).
 * @param {{ suppress?: ReturnType<typeof compileMatcher>[], allow?: ReturnType<typeof compileMatcher>[] }} [opts]
 *   PRECOMPILED matcher lists (compile plain matchers with `compileMatcher`/
 *   `.map` first — see `shouldSuppress` for the uncompiled convenience form).
 * @returns {{ suppressed: boolean, allowed: boolean, matcher: Matcher | null }}
 *   `matcher` is the ORIGINAL (uncompiled) matcher that decided the verdict —
 *   the `allow` entry when `allowed`, the `suppress` entry when `suppressed`,
 *   else `null`.
 */
export function shouldSuppressCompiled(url, { suppress = [], allow = [] } = {}) {
  const allowHit = firstMatch(url, allow);
  if (allowHit) return { suppressed: false, allowed: true, matcher: allowHit.source };

  const suppressHit = firstMatch(url, suppress);
  if (suppressHit) return { suppressed: true, allowed: false, matcher: suppressHit.source };

  return { suppressed: false, allowed: false, matcher: null };
}

/**
 * The pure suppression predicate (spec 049-01 AC1/AC3/AC4) — the uncompiled,
 * plain-matcher convenience form: compiles both matcher lists (on every call) and defers to
 * `shouldSuppressCompiled` for the precedence logic. This is the form the
 * unit tests exercise directly and the form a caller with a small, rarely
 * re-evaluated matcher set should reach for; `installTagSuppressor`'s
 * per-candidate hot path uses `shouldSuppressCompiled` directly instead (see
 * its docstring) so a script insertion never pays a recompile.
 * @param {string} url a candidate's resolved URL (e.g. a `<script>`'s `.src`).
 * @param {{ suppress?: Matcher[], allow?: Matcher[] }} [opts]
 * @returns {{ suppressed: boolean, allowed: boolean, matcher: Matcher | null }}
 */
export function shouldSuppress(url, { suppress = [], allow = [] } = {}) {
  return shouldSuppressCompiled(url, {
    suppress: compileMatchers(suppress),
    allow: compileMatchers(allow),
  });
}

/**
 * Build the 028-shaped diagnostic record for one suppression (spec 049-01
 * AC5) — pure, so it is unit-testable without a DOM or an `onDiagnostic` sink.
 * Reuses the `{ level, kind, disposition, ...context }` shape spec 028's
 * inspector collector already understands (core/inspector/collector.js) — and
 * MUST stay FLAT (no nested object/array), per that collector's documented
 * FLAT-RECORD INVARIANT (core/inspector/collector.js:53-60): its shallow
 * copy-on-write (`{ ...record }`) assumes every field is a primitive, so a
 * nested `matcher` object would ALIAS the same reference across every
 * buffered ring row that names it — corrupting the collector's per-row
 * isolation. So the matcher is reported as three flat primitive fields
 * instead of one nested object: `matcherHost`/`matcherPathname` (strings, `""`
 * when the matcher carried none) and `matcherQuery` (the query constraint
 * serialized to a single `&`-joined `key=value` string, `""` when none) —
 * still fully attributable (naming exactly which matcher fired), never nested.
 * @param {string} url the suppressed candidate's resolved URL.
 * @param {Matcher | null} matcher the matcher that matched it (naming WHICH
 *   declared matcher fired, so an over-match is attributable, not just visible).
 * @returns {{ level: "warn", kind: "tag-suppressor", disposition: "suppressed", url: string, matcherHost: string, matcherPathname: string, matcherQuery: string }}
 */
export function suppressionDiagnostic(url, matcher) {
  const m = matcher && typeof matcher === "object" ? matcher : {};
  const matcherHost = typeof m.host === "string" ? m.host : "";
  const matcherPathname = typeof m.pathname === "string" ? m.pathname : "";
  const matcherQuery =
    m.query && typeof m.query === "object"
      ? Object.entries(m.query)
          .map(([key, value]) => `${key}=${value}`)
          .join("&")
      : "";
  return {
    level: "warn",
    kind: "tag-suppressor",
    disposition: "suppressed",
    url,
    matcherHost,
    matcherPathname,
    matcherQuery,
  };
}

// --- DOM-coupled install (this repo's substrate has no Node/vitest coverage
//     for what follows — see the module docstring's SUBSTRATE note). ---------

// Single shared, module-instance-scoped active config (see the "IDEMPOTENT,
// SINGLE-INSTANCE INSTALL" docstring section) — every patched method reads
// THESE fields at call time, never a value closed over at patch time, so a
// later `installTagSuppressor(...)` call can update the live matchers without
// re-patching the prototypes. `compiledSuppress`/`compiledAllow` are
// `compileMatcher`'s output, computed ONCE per `installTagSuppressor` call
// (the NIT perf fix) — `evaluateCandidate` (the DOM patch's hottest path)
// reads these precompiled arrays directly via `shouldSuppressCompiled`,
// never recompiling per script insertion.
const state = { compiledSuppress: [], compiledAllow: [], onDiagnostic: null, installed: false };

/** Is `node` a `<script>` element whose resolved `.src` should be suppressed
 *  right now? Returns the hit (for diagnosing) or `null` (pass through). */
function evaluateCandidate(node) {
  if (!node || node.nodeType !== 1) return null; // ELEMENT_NODE only — text/strings/comments pass through
  const tag = typeof node.tagName === "string" ? node.tagName.toLowerCase() : "";
  if (tag !== "script") return null;
  const src = typeof node.src === "string" ? node.src : "";
  if (!src) return null; // an inline script (no src) is outside this URL/query matcher's reach
  const verdict = shouldSuppressCompiled(src, { suppress: state.compiledSuppress, allow: state.compiledAllow });
  return verdict.suppressed ? { src, matcher: verdict.matcher } : null;
}

/** Emit the diagnostic for one suppression. Never throws INTO the caller — a
 *  diagnostics sink misbehaving must not break the page (mirrors the
 *  inspector collector's own defensiveness, core/inspector/collector.js). */
function diagnose(hit) {
  if (typeof state.onDiagnostic !== "function") return;
  try {
    state.onDiagnostic(suppressionDiagnostic(hit.src, hit.matcher));
  } catch {
    // swallow — see the docstring above.
  }
}

/** Wrap `proto[name]` at most ONCE (idempotent — a marker on the wrapped
 *  function itself, so it is detectable even across separate
 *  `installTagSuppressor` calls, not just within one closure). */
function patchMethod(proto, name, makeWrapped) {
  if (!proto) return;
  const existing = proto[name];
  if (typeof existing !== "function" || existing.__airlockTagSuppressorPatched) return;
  const wrapped = makeWrapped(existing);
  wrapped.__airlockTagSuppressorPatched = true;
  wrapped.__airlockTagSuppressorNative = existing;
  proto[name] = wrapped;
}

/** Restore the saved native for `proto[name]`, if it is currently our wrapper. */
function unpatchMethod(proto, name) {
  if (!proto) return;
  const current = proto[name];
  if (current && current.__airlockTagSuppressorPatched && typeof current.__airlockTagSuppressorNative === "function") {
    proto[name] = current.__airlockTagSuppressorNative;
  }
}

/** Patch the full DOM script-insertion surface (AC1 — the A1 frame-critique
 *  correction: the vendor idiom is `parentNode.insertBefore`, not
 *  `head.appendChild`, so every insertion path must be covered). */
function patchAll() {
  patchMethod(
    Node.prototype,
    "appendChild",
    (native) =>
      function appendChild(child) {
        const hit = evaluateCandidate(child);
        if (hit) {
          diagnose(hit);
          return child; // never connected — the fetch-triggering "prepare the script element" step never runs
        }
        return native.call(this, child);
      },
  );

  patchMethod(
    Node.prototype,
    "insertBefore",
    (native) =>
      function insertBefore(newNode, referenceNode) {
        const hit = evaluateCandidate(newNode);
        if (hit) {
          diagnose(hit);
          return newNode;
        }
        return native.call(this, newNode, referenceNode);
      },
  );

  patchMethod(
    Node.prototype,
    "replaceChild",
    (native) =>
      function replaceChild(newChild, oldChild) {
        const hit = evaluateCandidate(newChild);
        if (hit) {
          diagnose(hit);
          return oldChild; // native contract: returns the replaced node — here, nothing was replaced
        }
        return native.call(this, newChild, oldChild);
      },
  );

  patchMethod(
    Element.prototype,
    "append",
    (native) =>
      function append(...nodes) {
        const kept = [];
        for (const n of nodes) {
          const hit = evaluateCandidate(n);
          if (hit) diagnose(hit);
          else kept.push(n);
        }
        return native.apply(this, kept); // non-matching siblings still insert (scoped, not blanket)
      },
  );

  patchMethod(
    Element.prototype,
    "prepend",
    (native) =>
      function prepend(...nodes) {
        const kept = [];
        for (const n of nodes) {
          const hit = evaluateCandidate(n);
          if (hit) diagnose(hit);
          else kept.push(n);
        }
        return native.apply(this, kept);
      },
  );

  patchMethod(
    Element.prototype,
    "insertAdjacentElement",
    (native) =>
      function insertAdjacentElement(position, element) {
        const hit = evaluateCandidate(element);
        if (hit) {
          diagnose(hit);
          return null; // native contract: null means "not inserted"
        }
        return native.call(this, position, element);
      },
  );
}

function unpatchAll() {
  if (typeof Node !== "undefined") {
    unpatchMethod(Node.prototype, "appendChild");
    unpatchMethod(Node.prototype, "insertBefore");
    unpatchMethod(Node.prototype, "replaceChild");
  }
  if (typeof Element !== "undefined") {
    unpatchMethod(Element.prototype, "append");
    unpatchMethod(Element.prototype, "prepend");
    unpatchMethod(Element.prototype, "insertAdjacentElement");
  }
}

function uninstall() {
  if (!state.installed) return;
  unpatchAll();
  state.installed = false;
  state.compiledSuppress = [];
  state.compiledAllow = [];
  state.onDiagnostic = null;
}

/**
 * Install the native-tag suppressor (spec 049-01 AC1) — call this BEFORE the
 * tag-manager container loads. Config-driven, vendor-neutral: the caller
 * supplies the matchers; this module never hardcodes a vendor.
 * @param {{ suppress?: Matcher[], allow?: Matcher[], onDiagnostic?: (record: object) => void }} [opts]
 *   `suppress` — matchers for runtimes to neutralize. `allow` — matchers that
 *   WIN over `suppress` (AC3's carve-out — an adopter's own/airlock's own
 *   egress). `onDiagnostic` — called once per suppression (AC5); a
 *   non-matching script emits nothing.
 * @returns {{ uninstall: () => void }} `uninstall` restores the native DOM
 *   methods and clears the active config. Safe to call even if nothing was
 *   ever installed (a no-op).
 */
export function installTagSuppressor({ suppress, allow, onDiagnostic } = {}) {
  // Compile ONCE here (NIT perf fix), never per candidate — see the
  // `state`/`evaluateCandidate` docstrings above.
  state.compiledSuppress = compileMatchers(suppress);
  state.compiledAllow = compileMatchers(allow);
  state.onDiagnostic = typeof onDiagnostic === "function" ? onDiagnostic : null;

  if (!state.installed) {
    if (typeof Node === "undefined" || typeof Element === "undefined") {
      // No DOM (SSR / Node / a chamber worker) — nothing to patch. Fails
      // safe: an inert controller, never a throw (mirrors
      // adapters/eds/reserve-personalization.js's no-document no-op).
      return { uninstall() {} };
    }
    patchAll();
    state.installed = true;
  }

  return { uninstall };
}
