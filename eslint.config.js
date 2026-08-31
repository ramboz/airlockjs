// Flat ESLint config — spec 021-03 (adopt the linter).
//
// Baseline is `@eslint/js` **recommended** — a real-bug ruleset (no-undef,
// no-unused-vars, no-empty, no-unreachable, …), NOT a stylistic one. airlock's
// source was written against the AEM/Airbnb habit (the scoped `// eslint-disable
// no-empty` on busy-wait loops predate this config) but was never actually
// linted; recommended is the pragmatic "turn linting on without a style-cleanup
// avalanche" choice. A stricter AEM/Airbnb ruleset is a deferred option (see
// docs/conventions.md → Code style, and the lightweight decision 2026-08-31).
//
// The load-bearing correctness point of this config is the ENVIRONMENT split:
// a chamber worker (*.worker.js) has NO `window`/`document` — it must not
// inherit browser globals, or `no-undef` would silently pass code that
// references a global the worker doesn't actually have. Each source set below
// gets exactly its own globals; the browser set explicitly `ignores` worker
// files so their globals don't merge in.
import js from "@eslint/js";
import globals from "globals";

export default [
  // Not airlock's own source: deps, vendored EDS boilerplate (probes/ carries
  // its own Airbnb .eslintrc heritage), docs, TS declaration files (no TS
  // parser wired), and build output.
  {
    ignores: [
      "node_modules/**",
      ".claude/**", // stale nested worktree(s) — full repo copies, not source-of-truth
      "probes/**", // vendored EDS boilerplate (its own Airbnb .eslintrc heritage)
      "docs/**",
      "rig/out/**", // esbuild build output (bundled classic-worker IIFEs)
      "**/*.built.js", // any other build artifact
      "**/*.d.ts", // no TS parser wired
      "**/*.min.js",
      "dist/**",
      "coverage/**",
    ],
  },

  // Real-bug baseline, applied to every linted file below.
  js.configs.recommended,

  // Main-thread source (browser). EXCLUDES *.worker.js so worker files do not
  // inherit window/document/etc. — see the header note.
  {
    files: ["core/**/*.js", "adapters/**/*.js", "connectors/**/*.js", "baseline/**/*.js"],
    ignores: ["**/*.worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
  },

  // Chamber workers. Bundled to a classic Worker by esbuild, but the SOURCE is
  // ESM (import/export) — so sourceType:module + worker globals (self,
  // postMessage, importScripts, addEventListener), NO window/document.
  {
    files: ["**/*.worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.worker },
    },
  },

  // Node tooling: rig harnesses (.mjs), contracts validation scripts (.mjs),
  // build.mjs, the vitest configs. EXCLUDES *.worker.js (rig ships two worker
  // harnesses, which the worker set above owns).
  {
    files: ["rig/**/*.{js,mjs}", "contracts/**/*.mjs", "*.mjs", "*.config.js"],
    ignores: ["**/*.worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Rig harnesses drive a real browser via Playwright: they embed browser code
  // inside `page.evaluate(() => { … window … })` callbacks and two files
  // (generic-capture.js, alloy-mint-stub.js) are injected into the page wholesale.
  // So a rig file legitimately references BOTH node and browser globals — union
  // them (harness code; the permissive union just avoids false no-undef on the
  // embedded browser snippets).
  {
    files: ["rig/**/*.{js,mjs}"],
    ignores: ["**/*.worker.js"],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Vitest unit tests: node + vitest + browser globals (several tests drive a
  // jsdom-ish window/document or a fake window.airlock — union is fine for tests).
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.vitest, ...globals.browser },
    },
  },

  // Project-wide rule calibration (applies everywhere — no `files` key).
  {
    rules: {
      // Pragmatic unused-vars: `_`-prefix opts a symbol out; an unused catch
      // binding is fine (intentional swallow / optional-binding not always used);
      // a rest-sibling left to omit a key is not "unused".
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
      ],
      // Intentional empty `catch {}` (swallow) is a used pattern here (probes,
      // best-effort teardown); an empty block ANYWHERE ELSE still errors.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
