import { createHash } from "node:crypto";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { privateOriginalDirectory, publishPrivateOriginal, readPrivateOriginal } from "./private-original-file.mjs";

export const fail = reason => { throw Error(reason); };
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
export const freeze = v => {
  if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
};
export { privateOriginalDirectory as observationDirectory };
export function observationRead(path, options) {
  const r = readPrivateOriginal(path, options);
  return { ...r, handle: freeze(r.handle) };
}
export function observationHandle(value) {
  const h = record(data(value), ["path", "dev", "ino", "size", "mode", "uid", "nlink", "mtime_ms", "ctime_ms", "sha256"]);
  if (typeof h.path !== "string" || !digest(h.sha256) || h.nlink !== 1
    || !["dev", "ino", "size", "mode", "uid"].every(k => Number.isSafeInteger(h[k]) && h[k] > 0)
    || !["mtime_ms", "ctime_ms"].every(k => Number.isFinite(h[k]) && h[k] >= 0)) fail("observation_original_handle");
  return h;
}
export function observationSnapshot(expected, uid = null) {
  const h = observationHandle(expected), r = observationRead(h.path, { uid });
  if (!equal(r.handle, h)) fail("observation_original_hash_or_identity_changed");
  return { ...r, value: json(r.bytes) };
}
export function observationWrite(root, name, value, uid) {
  const bytes = Buffer.from(JSON.stringify(data(value)) + "\n");
  if (!/^[a-z0-9-]+\.json$/.test(name) || bytes.length > 1048576) fail("observation_publication_bound");
  return freeze(publishPrivateOriginal(root, name, bytes, uid));
}
