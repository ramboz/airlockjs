// Pinned third-party inputs for the aem-martech comparison (spec 064-21). Nothing third-party is committed:
// the files are downloaded at test time into the gitignored rig/out/b5/ and checked against pinned SHA-256 hashes
// (the same rule as `ensureAlloyBundle` in adobe-b1-replay.mjs). The Alloy 2.31.1 bundle is the B1 pin.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/b5");
export const MARTECH_COMMIT = "1aa3dee3c4791636efa9ad2994342f861c8e149b";
const BASE = `https://raw.githubusercontent.com/adobe-rnd/aem-martech/${MARTECH_COMMIT}/src`;

/** `aem-martech` `src/index.js` and its ACDL 3.0.1 bundle `src/acdl.min.js`, at the pinned commit (Apache-2.0). */
export const MARTECH_ASSETS = {
  "index.js": { url: `${BASE}/index.js`, sha256: "e26eeb5ff4b54355e7170c4d7556bfc5d6198a2bbbf32525b62301367c2a032f" },
  "acdl.min.js": { url: `${BASE}/acdl.min.js`, sha256: "c8d3a94761576569086cdc65e2bd9bbcfa6ccbf73fe1adf0709f815c684b778c" },
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

let libraryBuild = null;
/** 069-03: the Airlock martech library (adapters/eds/martech.js) bundled as an ES module for the page; served where the stock arm serves `aem-martech`. */
export function buildMartechLibrary() {
  libraryBuild ||= build({
    entryPoints: [join(ROOT, "adapters/eds/martech.js")], bundle: true, format: "esm", platform: "browser", target: "es2022", write: false, logLevel: "silent",
  }).then((r) => r.outputFiles[0].text);
  return libraryBuild;
}

/** One pinned file, from the cache or downloaded, always hash-verified. Returns its text. */
export async function ensureMartechAsset(name) {
  const spec = MARTECH_ASSETS[name];
  if (!spec) throw new Error(`unknown aem-martech asset ${name}`);
  const path = join(OUT, name);
  let bytes = existsSync(path) ? await readFile(path) : null;
  if (bytes && sha256(bytes) !== spec.sha256) bytes = null;
  if (!bytes) {
    const res = await fetch(spec.url);
    if (!res.ok) throw new Error(`aem-martech ${name} download failed: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    if (sha256(bytes) !== spec.sha256) throw new Error(`aem-martech ${name} from ${spec.url} does not match its pinned SHA-256`);
    await mkdir(OUT, { recursive: true });
    await writeFile(path, bytes);
  }
  return bytes.toString("utf8");
}
