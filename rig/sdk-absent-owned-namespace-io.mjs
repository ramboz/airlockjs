// Fixed, bounded file operations. Publication receipts are process-private;
// an on-disk success flag is never a replacement for external command close.
import { createHash } from "node:crypto";
import { data } from "./inspected-meta-record.mjs";
import { privateOriginalDirectory, publishPrivateOriginal, readPrivateOriginal } from "./private-original-file.mjs";

export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export const fail = reason => { throw Error(reason); };
export const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export { privateOriginalDirectory as privateDirectory };
export function fixedRead(path, { maximum = 1048576, privateUid = null, executable = false } = {}) {
  return readPrivateOriginal(path, { maximum, uid: privateUid, executable });
}
export function atomicPrivateWrite(root, name, value, uid) {
  const bytes = Buffer.from(JSON.stringify(data(value)) + "\n");
  if (bytes.length > 1048576 || !/^[a-z0-9-]+\.json$/.test(name)) fail("namespace_publication_bound");
  return publishPrivateOriginal(root, name, bytes, uid);
}
