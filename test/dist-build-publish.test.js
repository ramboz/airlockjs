// Spec 031-01 — the distributable build target + its publish-to-a-dist-rooted-ref
// step, unit-tested hermetically (no browser). The browser end (subtree-add → serve
// → boot on a clean EDS checkout, CWV) is rig/subtree-install.mjs (AC5 + AC6); these
// tests own the node-side criteria:
//
//   AC1 — `build:dist`/buildAirlock emits eds.js + EVERY sibling *.worker.js into a
//         first-class distributable dir, decoupled from probes/eds-testbed/.
//   AC2 — publishDist commits that built tree to a DIST-ROOTED ref (a `dist` branch
//         whose ROOT is exactly the servable artifacts + a VERSION marker) in a local
//         bare repo — airlock's SOURCE (build.mjs/core/) is ABSENT from the ref root.
//   AC3 — the same-origin-file-worker invariant is enforced at BUILD time: a seeded
//         drop OR rename of a worker entry throws from the build (red→green witness).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAirlock, WORKER_ENTRIES, ENTRY_OUT } from "../build.mjs";
import { publishDist, DIST_ARTIFACTS, resolveTarget, computeVersion, releaseTag } from "../publish-dist.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
// The four sibling chamber workers a served eds.js may spawn (026-05 N-worker set).
const SIBLING_WORKERS = [
  "chamber.worker.js",
  "pixel-chamber.worker.js",
  "dom-chamber.worker.js",
  "helix-rum-chamber.worker.js",
];

const tmps = [];
const mktmp = (p) => {
  const d = mkdtempSync(join(tmpdir(), p));
  tmps.push(d);
  return d;
};
const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

describe("031-01 AC1 — a first-class distributable build target (decoupled from the testbed)", () => {
  let distDir;
  beforeAll(async () => {
    distDir = mktmp("airlock-ac1-dist-");
    await buildAirlock({ outdir: distDir });
  }, 60000);

  it("emits the adapter entry eds.js into the distributable dir", () => {
    expect(existsSync(join(distDir, `${ENTRY_OUT}.js`))).toBe(true);
  });

  it("emits EVERY sibling chamber worker into the distributable dir", () => {
    for (const w of SIBLING_WORKERS) {
      expect(existsSync(join(distDir, w))).toBe(true);
    }
  });

  it("is decoupled from probes/eds-testbed/ — the target is a caller-chosen dir, not the testbed", () => {
    // The distributable was emitted OUTSIDE the testbed tree (a temp dir here; `dist/`
    // under `npm run build:dist`), proving the build target is no longer hardwired to
    // probes/eds-testbed/scripts/airlock/.
    expect(distDir.startsWith(join(REPO, "probes"))).toBe(false);
  });

  it("the emitted eds.js references each worker only by its same-origin SIBLING specifier", () => {
    const eds = readFileSync(join(distDir, `${ENTRY_OUT}.js`), "utf8");
    const specs = [...eds.matchAll(/new Worker\(\s*new URL\(\s*(["'`])(.*?)\1/g)].map((m) => m[2]);
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) expect(s.startsWith("./")).toBe(true);
  });
});

describe("031-01 AC3 — the same-origin-file-worker invariant is enforced at BUILD time", () => {
  it("throws when a worker entry is DROPPED (eds.js still references the missing sibling)", async () => {
    const out = mktmp("airlock-ac3-drop-");
    // Drop the DEFAULT GA4 chamber worker; eds.js's selection seam still references
    // `./chamber.worker.js`, so the build's positive assertion must fail.
    const dropped = WORKER_ENTRIES.filter((p) => !p.endsWith("/chamber.worker.js"));
    await expect(buildAirlock({ outdir: out, workerEntries: dropped })).rejects.toThrow(
      /chamber\.worker\.js|not a known sibling|NOT emitted/,
    );
  }, 60000);

  it("throws when a worker entry is RENAMED (a hashed rename breaks sibling resolution)", async () => {
    const out = mktmp("airlock-ac3-rename-");
    // Rename the emitted GA4 chamber worker (as a hashed rename would): eds.js still
    // references `./chamber.worker.js`, which now resolves to no emitted sibling.
    const outNameFor = (inPath) =>
      inPath.endsWith("/chamber.worker.js")
        ? "chamber.worker-HASHED"
        : inPath.replace(/^core\//, "").replace(/\.js$/, "");
    await expect(buildAirlock({ outdir: out, outNameFor })).rejects.toThrow(
      /chamber\.worker\.js|not a known sibling|NOT emitted/,
    );
  }, 60000);
});

describe("031-01 AC2 — publish the servable tree to a DIST-ROOTED ref", () => {
  let distDir;
  let bare;
  let published;
  beforeAll(async () => {
    distDir = mktmp("airlock-ac2-dist-");
    await buildAirlock({ outdir: distDir });
    bare = join(mktmp("airlock-ac2-remote-"), "origin.git");
    git(["init", "-q", "--bare", bare], REPO);
    published = await publishDist({ distDir, target: bare, ref: "dist" });
  }, 60000);

  it("the dist ref ROOT is EXACTLY the servable artifacts + a VERSION marker", () => {
    const root = git(["--git-dir", bare, "ls-tree", "--name-only", "dist"], REPO)
      .split("\n")
      .filter(Boolean)
      .sort();
    expect(root).toEqual([...SIBLING_WORKERS, "VERSION", `${ENTRY_OUT}.js`].sort());
  });

  it("airlock's SOURCE project (build.mjs / core / adapters / test) is ABSENT from the ref root", () => {
    const root = git(["--git-dir", bare, "ls-tree", "--name-only", "dist"], REPO).split("\n");
    for (const src of ["build.mjs", "core", "adapters", "connectors", "test", "package.json"]) {
      expect(root).not.toContain(src);
    }
  });

  it("stamps a VERSION marker from package.json version + the airlock HEAD short-sha", () => {
    const version = git(["--git-dir", bare, "show", "dist:VERSION"], REPO);
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
    const sha = git(["rev-parse", "--short", "HEAD"], REPO);
    expect(version).toContain(pkg.version);
    expect(version).toContain(sha);
  });

  it("DIST_ARTIFACTS names exactly the servable tree the ref root must carry", () => {
    // The publish contract's artifact list is the single source of truth the rig and
    // docs reference — keep it aligned with the emitted sibling set.
    expect([...DIST_ARTIFACTS].sort()).toEqual([...SIBLING_WORKERS, `${ENTRY_OUT}.js`].sort());
  });

  it("reports the ref and a version string back to the caller", () => {
    expect(published.ref).toBe("dist");
    expect(published.version).toMatch(/\d+\.\d+\.\d+/);
  });
});

describe("031-01 AC2 (craft-review fix) — a remote NAME target resolves to a URL the staging repo can push to", () => {
  // The publish commit is built + pushed from a THROWAWAY `git init` repo with no remotes,
  // so a bare remote NAME like `origin` is meaningless there. `resolveTarget` must turn a
  // name into its URL (via the airlock repo) while leaving paths/URLs alone — the documented
  // `--target origin` form was broken because this resolution was missing.
  it("passes a local bare-repo PATH through unchanged (why the rig always worked)", () => {
    const bare = join(mktmp("airlock-resolve-path-"), "origin.git");
    expect(resolveTarget(bare)).toBe(bare); // contains "/" → used verbatim
  });

  it("passes a remote URL through unchanged", () => {
    const url = "git@github.com:ramboz/airlockjs.git";
    expect(resolveTarget(url)).toBe(url); // contains ":" → used verbatim
  });

  it("resolves the remote NAME `origin` to its URL (not the literal string `origin`)", () => {
    // Regression guard for the craft-review blocker: without resolution, `origin` would be
    // pushed literally from the staging repo → `fatal: 'origin' does not appear to be a git
    // repository`. The airlock repo has an `origin` remote, so resolution yields its URL.
    const resolved = resolveTarget("origin");
    expect(resolved).not.toBe("origin");
    expect(resolved).toMatch(/[:/]/); // a real remote URL/path, not a bare name
  });
});

// ---------------------------------------------------------------------------------------------
// Spec 031-02 — the UPDATE path (the node-side criteria). The browser end (subtree add dist-vA →
// subtree pull dist-vB → re-boot, + the seeded hand-edit conflict) is rig/subtree-install.mjs's
// update arms (AC3); these tests own AC1 (the release-tag pin + the reconciled marker) and AC2's
// doc-consistency (the documented, tagged, --squash pull).
// ---------------------------------------------------------------------------------------------

describe("031-02 AC1 — the release-tag pin (semver substitute) + the marker reconciled to the tag", () => {
  it("computeVersion RELEASE variant emits `airlockjs vX.Y.Z` with NO +sha (the pinned marker)", () => {
    expect(computeVersion({ version: "1.2.3", sha: "deadbee", release: true })).toBe("airlockjs v1.2.3");
  });

  it("computeVersion NON-release variant still carries the +sha floating-latest marker (031-01 unchanged)", () => {
    expect(computeVersion({ version: "1.2.3", sha: "deadbee" })).toBe("airlockjs v1.2.3+deadbee");
  });

  it("releaseTag derives the dist-rooted tag name from the version (tag == marker version, by construction)", () => {
    expect(releaseTag("1.2.3")).toBe("dist-v1.2.3");
  });

  describe("publishDist({ release: true }) — tags the dist-rooted ref + reconciles VERSION to the tag", () => {
    const VER = "9.9.9"; // an injected release version (never the real pkg.version) so the pin is unambiguous
    let distDir;
    let bare;
    let published;
    beforeAll(async () => {
      distDir = mktmp("airlock-0302-rel-dist-");
      await buildAirlock({ outdir: distDir });
      bare = join(mktmp("airlock-0302-rel-remote-"), "origin.git");
      git(["init", "-q", "--bare", bare], REPO);
      published = await publishDist({ distDir, target: bare, release: true, version: VER });
    }, 60000);

    it("creates a `dist-vX.Y.Z` tag and reports it back to the caller", () => {
      expect(published.tag).toBe(`dist-v${VER}`);
    });

    it("`git show dist-vX.Y.Z:VERSION` equals the tag's marker — `airlockjs vX.Y.Z`, NO +sha", () => {
      const marker = git(["--git-dir", bare, "show", `${published.tag}:VERSION`], REPO);
      expect(marker).toBe(`airlockjs v${VER}`);
      expect(marker).not.toMatch(/\+/); // reconciled to the tag — not the floating +sha "latest"
    });

    it("the TAGGED ref's ROOT is EXACTLY the servable artifacts + VERSION (a DIST-rooted tag, not a source tag on main)", () => {
      const root = git(["--git-dir", bare, "ls-tree", "--name-only", published.tag], REPO)
        .split("\n")
        .filter(Boolean)
        .sort();
      expect(root).toEqual([...SIBLING_WORKERS, "VERSION", `${ENTRY_OUT}.js`].sort());
    });

    it("airlock's SOURCE project is ABSENT from the tagged ref root (never a whole-project source tag)", () => {
      const root = git(["--git-dir", bare, "ls-tree", "--name-only", published.tag], REPO).split("\n");
      for (const src of ["build.mjs", "core", "adapters", "connectors", "test", "package.json"]) {
        expect(root).not.toContain(src);
      }
    });

    it("the tag and the marker derive from the SAME version, so they cannot drift", () => {
      const marker = git(["--git-dir", bare, "show", `${published.tag}:VERSION`], REPO);
      expect(published.tag).toBe(`dist-v${VER}`);
      expect(marker).toBe(`airlockjs v${VER}`);
    });
  });

  describe("031-02 AC1 — the release tag is IMMUTABLE by default (craft-review blocker fix)", () => {
    const VER = "9.9.9";
    const setup = async (name) => {
      const distDir = mktmp(`airlock-0302-${name}-dist-`);
      await buildAirlock({ outdir: distDir });
      const bare = join(mktmp(`airlock-0302-${name}-remote-`), "origin.git");
      git(["init", "-q", "--bare", bare], REPO);
      return { distDir, bare };
    };

    it("re-publishing an un-bumped version with DIFFERENT bytes FAILS LOUDLY — the pin is not silently relocated", async () => {
      const { distDir, bare } = await setup("immut");
      await publishDist({ distDir, target: bare, release: true, version: VER }); // dist-v9.9.9 lands (commit A)
      // The footgun: change the built bytes but NOT the version → a DIFFERENT tree under the SAME pin.
      // (Mutating bytes makes the second commit deterministically distinct, not reliant on clock skew.)
      appendFileSync(join(distDir, `${ENTRY_OUT}.js`), "\n// second cut, same version\n");
      // The non-force tag push must REJECT (else two consumers pulling dist-v9.9.9 get different bytes).
      // Without the fix (force-push) this silently succeeded and moved a published release.
      let err;
      try {
        await publishDist({ distDir, target: bare, release: true, version: VER });
      } catch (e) {
        err = e;
      }
      expect(err, "second --release of an un-bumped version must throw").toBeDefined();
      expect(String((err && (err.stderr || err.message)) || "")).toMatch(/already exists|rejected|failed to push/i);
    }, 60000);

    it("`forceTag: true` opts into a deliberate re-cut (force-moves the existing tag to the new bytes)", async () => {
      const { distDir, bare } = await setup("recut");
      await publishDist({ distDir, target: bare, release: true, version: VER });
      appendFileSync(join(distDir, `${ENTRY_OUT}.js`), "\n// deliberate re-cut, same version\n");
      await expect(
        publishDist({ distDir, target: bare, release: true, version: VER, forceTag: true }),
      ).resolves.toMatchObject({ tag: `dist-v${VER}` });
    }, 60000);
  });

  it("release mode defaults the version to package.json (the production path — tag == the package version)", async () => {
    const distDir = mktmp("airlock-0302-pkgver-dist-");
    await buildAirlock({ outdir: distDir });
    const bare = join(mktmp("airlock-0302-pkgver-remote-"), "origin.git");
    git(["init", "-q", "--bare", bare], REPO);
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));
    const res = await publishDist({ distDir, target: bare, release: true });
    expect(res.tag).toBe(`dist-v${pkg.version}`);
    const marker = git(["--git-dir", bare, "show", `${res.tag}:VERSION`], REPO);
    expect(marker).toBe(`airlockjs v${pkg.version}`);
  }, 60000);
});

describe("031-02 AC2 — the documented `git subtree pull` update (generated-release, tagged, --squash)", () => {
  const readme = readFileSync(join(REPO, "README.md"), "utf8");

  it("documents the exact `git subtree pull ... dist-vX.Y.Z --squash` update command (a TAGGED dist ref)", () => {
    // --squash is LOAD-BEARING: each release is an unrelated orphan root, so a non-squash pull hits
    // `refusing to merge unrelated histories`. The doc's command must keep it (and target a tag).
    expect(readme).toMatch(/git subtree pull --prefix \S+ \S+ dist-v[\w.]+ --squash/);
  });

  it("shifts the `git subtree add` example onto a `dist-vX.Y.Z` TAG (not the floating `dist` branch)", () => {
    expect(readme).toMatch(/git subtree add --prefix \S+ \S+ dist-v[\w.]+ --squash/);
  });

  it("states the generated-release / overwritten-wholesale / never-hand-edit posture", () => {
    expect(readme).toMatch(/generated release/i);
    expect(readme).toMatch(/overwritten wholesale|overwrite\w* wholesale|wholesale/i);
    expect(readme).toMatch(/never hand-edit/i);
  });
});

afterAll(() => {
  for (const d of tmps) rmSync(d, { recursive: true, force: true });
});
