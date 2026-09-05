// Publish the built distributable to a DIST-ROOTED ref (spec 031-01 AC2) — the
// mechanism ADR-0015 delegated to this spec.
//
// WHY a dist-rooted ref (the frame-critique's load-bearing correction). `git subtree
// add --prefix <path> <remote> <ref>` imports the ENTIRE ROOT TREE of <ref> — `--prefix`
// is the LOCAL landing path, NOT a remote subdirectory selector. airlock's servable tree
// is generated, git-ignored, and lives in a subdirectory (build.mjs's `dist/`), so a naive
// `git subtree add <airlock-remote> main` would pull airlock's WHOLE SOURCE project
// (build.mjs, core/, tests), not eds.js + the workers. So the servable tree must itself BE
// a ref's ROOT: this step commits `dist/`'s contents (eds.js + the four sibling *.worker.js)
// PLUS a VERSION marker to the ROOT of a `dist` branch in the target repo — the ref a
// consumer `git subtree add`s (AC4/AC5).
//
// CHOSEN over the rejected alternatives:
//   - `git subtree split --prefix dist` ALONE — split still needs the tree committed to a
//     branch first; a durable `dist` branch built by plumbing is the simpler, direct home.
//   - a SEPARATE release repo — same-repo (a `dist` branch on origin) keeps it one clone and
//     matches ADR-0015's "generated release" posture (the consumer overwrites wholesale).
//
// HERMETIC + airlock-repo-SAFE. The dist-rooted commit is built in a THROWAWAY staging repo
// (os.tmpdir) and pushed to `<target>`; this NEVER creates a branch or commit in the airlock
// repo itself (it only READS package.json + the airlock HEAD short-sha for the VERSION stamp).
// `<target>` may be a LOCAL BARE repo (so rig/subtree-install.mjs drives it fully hermetically)
// or a real remote — the real-remote push is DOCUMENTED (README) but run by a maintainer, not here.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRY_OUT, WORKER_ENTRIES, CLASSIC_WORKER_ENTRIES } from "./build.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

// The servable tree the dist ref ROOT must carry (single source of truth for the rig + docs).
// Derived from build.mjs's entry + worker sets so it can never drift from what the build emits —
// the ESM (module) workers AND the CLASSIC alloy chamber worker (033-02). If the alloy worker were
// omitted here it would be absent from the published `dist` and a consumer page would 404 it.
// Basenames (the served sibling names), matching build.mjs's generalized out-namer.
export const DIST_ARTIFACTS = [
  `${ENTRY_OUT}.js`,
  ...[...WORKER_ENTRIES, ...CLASSIC_WORKER_ENTRIES].map((p) => p.split("/").pop()),
];

// `git` with hooks disabled (skip the machine's global gitleaks/pre-commit hook on throwaway
// commits) and a fixed identity (the staging repo has no user config).
const git = (args, cwd) =>
  execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "user.email=airlock-dist@local", "-c", "user.name=airlock dist", ...args],
    { cwd, encoding: "utf8" },
  ).trim();

/**
 * Resolve a push `target` to something the THROWAWAY staging repo can push to (spec 031-01
 * craft-review fix). The commit is built + pushed from a fresh `git init` repo that has NO
 * remotes, so a bare remote NAME like `origin` is meaningless there (`git push origin …` →
 * `fatal: 'origin' does not appear to be a git repository`). A remote name only means
 * something in the AIRLOCK repo, so resolve it to its URL HERE via `git -C ROOT remote
 * get-url <name>`. A path or URL (contains "/" or ":") is already pushable from anywhere and
 * is used verbatim — which is why the rig's local bare-repo PATHS always worked and this gap
 * only ever bit the documented `--target origin` form.
 */
export function resolveTarget(target) {
  if (target.includes("/") || target.includes(":")) return target; // a path or URL — pushable as-is
  try {
    return git(["remote", "get-url", target], ROOT); // a known remote name → its URL
  } catch {
    return target; // not a known remote; leave it for git to reject with its own error
  }
}

/** The VERSION marker. One greppable line so a consumer can pin/read the vendored snapshot.
 *  - 031-01 default (`release: false`): `airlockjs vX.Y.Z+<sha>` — the FLOATING "latest" of the
 *    `dist` branch (a publish-time short-SHA; a dev/CI build between releases).
 *  - 031-02 RELEASE variant (`release: true`): `airlockjs vX.Y.Z` with NO `+<sha>` — the marker
 *    reconciled to the `dist-vX.Y.Z` tag (AC1). Both the tag and this marker derive from ONE
 *    version, so they cannot drift ("marker == tag by construction"). */
export function computeVersion({ version, sha, release = false }) {
  return release ? `airlockjs v${version}` : `airlockjs v${version}+${sha}`;
}

/** The dist-rooted release-tag name for a version (031-02 AC1): `dist-vX.Y.Z`. The tag rides the
 *  DIST-rooted commit (root = the servable artifacts), NEVER a source tag on `main` — a source tag
 *  would pull the whole project (the 031-01 correction). Single source of truth so the tag and the
 *  reconciled `airlockjs vX.Y.Z` marker share one version, used by the docs and the update rig. */
export function releaseTag(version) {
  return `dist-v${version}`;
}

/**
 * Commit `distDir`'s contents + a VERSION marker to the ROOT of `ref` in `target`.
 *
 * @param {object} opts
 * @param {string} opts.distDir  the built distributable dir (eds.js + sibling workers). Whatever is
 *                               present is published verbatim — completeness is BUILD's job (AC3), so
 *                               a rig can publish a deliberately-incomplete tree to seed the AC5 break.
 * @param {string} opts.target   the push target: a local bare repo path (hermetic), a remote URL,
 *                               or a remote NAME (e.g. "origin") — a name is resolved to its URL
 *                               (see `resolveTarget`) because the throwaway staging repo has no remotes.
 * @param {string} [opts.ref]      the dist-rooted branch name (default "dist").
 * @param {boolean} [opts.release] RELEASE mode (031-02 AC1): additionally tag the dist-rooted
 *                                 commit `dist-vX.Y.Z` and push the tag, and reconcile the VERSION
 *                                 marker to `airlockjs vX.Y.Z` (NO `+<sha>`) — the authoritative
 *                                 version pin a consumer `git subtree add`/`pull`s.
 * @param {string} [opts.version]  override the semver used for the marker + tag. Defaults to
 *                                 package.json's version (the production path); an explicit value is
 *                                 the test/rig seam for simulating distinct releases A and B.
 * @returns {{ref:string, version:string, tag:(string|null), artifacts:string[], target:string, pushTarget:string}}
 */
export async function publishDist({ distDir, target, ref = "dist", release = false, version, forceTag = false } = {}) {
  if (!distDir) throw new Error("publishDist: `distDir` is required");
  if (!target) throw new Error("publishDist: `target` is required (a bare repo path or a remote)");
  if (!existsSync(join(distDir, `${ENTRY_OUT}.js`))) {
    throw new Error(`publishDist: no ${ENTRY_OUT}.js in ${distDir} — run \`npm run build:dist\` first`);
  }

  const stage = mkdtempSync(join(tmpdir(), "airlock-dist-publish-"));
  try {
    // 1. Stage the built artifacts at the ROOT (so they become the ref's root tree).
    cpSync(distDir, stage, { recursive: true });

    // 2. Stamp VERSION. The semver SOURCE is the explicit `version` (the test/rig seam), else
    //    package.json (production). The marker + the `dist-vX.Y.Z` tag both derive from this ONE
    //    value, so a release's marker == its tag by construction (031-02 AC1). A best-effort HEAD
    //    short-sha only feeds the NON-release floating marker.
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const semver = version || pkg.version;
    let sha = "nogit";
    try { sha = git(["rev-parse", "--short", "HEAD"], ROOT); } catch { /* detached/no-git → "nogit" */ }
    const marker = computeVersion({ version: semver, sha, release });
    writeFileSync(join(stage, "VERSION"), `${marker}\n`);

    // 3. Commit the dist-rooted tree in the throwaway repo and push it to <target>:<ref>.
    //    Resolve a bare remote NAME (e.g. "origin") to its URL first — the staging repo has no
    //    remotes, so a name is only meaningful via the airlock repo (craft-review fix).
    const pushTarget = resolveTarget(target);
    git(["init", "-q"], stage);
    git(["add", "-A"], stage);
    git(["commit", "-q", "-m", `airlock dist ${marker}`], stage);
    git(["push", "--force", pushTarget, `HEAD:refs/heads/${ref}`], stage);

    // 4. RELEASE mode: tag the SAME dist-rooted commit `dist-vX.Y.Z` and push the tag to <target>.
    //    This is the authoritative version pin ADR-0015 said subtree lacks — the tag rides the
    //    dist-rooted tree (its root is the servable artifacts), never a source tag on `main`.
    let tag = null;
    if (release) {
      tag = releaseTag(semver);
      git(["tag", tag], stage); // fresh staging repo — no -f needed
      // A release tag is the IMMUTABLE pin (AC1 / ADR-0015 "tagged snapshot" / semver substitute):
      // push it WITHOUT --force, so re-publishing an un-bumped version FAILS LOUDLY (`! [rejected]
      // … already exists`) instead of silently relocating a published tag — two consumers who pull
      // the "same" `dist-vX.Y.Z` must get the same bytes (craft-review blocker fix). Bump the version
      // for a new release; a deliberate re-cut opts in via `forceTag`/`--force-tag`. NOTE: the `dist`
      // BRANCH above stays force-pushed — it is the floating "latest", correctly re-pushable.
      git(["push", ...(forceTag ? ["--force"] : []), pushTarget, `refs/tags/${tag}`], stage);
    }

    return { ref, version: marker, tag, artifacts: [...DIST_ARTIFACTS], target, pushTarget };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

// --- script entry (guarded so importing for tests never pushes) ---
// `npm run publish:dist -- --target <repo|remote> [--ref dist] [--dist-dir dist] [--release]`.
// A target is REQUIRED (no `origin` default) so re-running the command can never accidentally
// push to the real remote — the documented production form passes `--target origin` explicitly
// (a remote NAME is resolved to its URL, since the throwaway staging repo has no remotes).
// `--release` (031-02) additionally tags `dist-vX.Y.Z` (from package.json's version) and reconciles
// the VERSION marker to that tag — the authoritative pin a consumer pulls. The tag is pushed WITHOUT
// force (immutable): re-publishing an un-bumped version fails loudly. `--force-tag` opts into a
// deliberate re-cut (moves an existing release tag — use only when you mean to).
function parseArgs(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined;
  };
  return {
    target: get("--target"),
    ref: get("--ref"),
    distDir: get("--dist-dir"),
    release: argv.includes("--release"),
    forceTag: argv.includes("--force-tag"),
  };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));
  const target = args.target || process.env.PUBLISH_TARGET;
  if (!target) {
    process.stderr.write(
      "publish:dist requires an explicit target: `npm run publish:dist -- --target <repo|remote>` " +
        "(or PUBLISH_TARGET=…). Refusing to guess `origin` so a re-run can't push by accident.\n",
    );
    process.exit(2);
  }
  const distDir = args.distDir || join(ROOT, "dist");
  const res = await publishDist({ distDir, target, ref: args.ref || "dist", release: args.release, forceTag: args.forceTag });
  console.log(JSON.stringify({ published_ref: res.ref, published_tag: res.tag, version: res.version, target: res.target, artifacts: res.artifacts }, null, 2));
}
