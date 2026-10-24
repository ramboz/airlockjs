import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { equal, json, record } from "./inspected-meta-record.mjs";
import { P } from "./pinned-node-image-pins.mjs";

const fail = reason => { throw Error(reason); };
export const imageHash = bytes => createHash("sha256").update(bytes).digest("hex");
export const imageEntryNames = () => ["oci-layout", "index.json",
  ...[P.manifest, P.config, ...P.layers.map(l => l.digest)].map(d => "blobs/sha256/" + d.slice(7))];
export function imageBound(size, maximum, label) {
  if (!Number.isSafeInteger(size) || size < 0 || size > maximum) fail(label);
  return size;
}
const padding = length => (512 - length % 512) % 512;
const descriptor = (value, digest, size, mediaType) => {
  record(value, ["mediaType", "digest", "size"]);
  if (!equal(value, { mediaType, digest, size })) fail("image_descriptor");
};
export function imageConfig(bytes) {
  const c = json(bytes);
  if (c.os !== "linux" || c.architecture !== "arm64" || c.variant !== "v8"
    || !equal(c.config, { Env: P.env, Entrypoint: ["docker-entrypoint.sh"], Cmd: ["node"] })
    || !equal(c.rootfs, { type: "layers", diff_ids: P.layers.map(l => l.diff) })) fail("image_config");
  return c;
}
export async function verifyImageEntries(entries) {
  const names = imageEntryNames();
  if (!Array.isArray(entries) || entries.length !== 9
    || !equal(entries.map(e => e[0]), names) || entries.some(e => !Buffer.isBuffer(e[1])))
    fail("image_closed_entries");
  if (!equal(json(entries[0][1]), { imageLayoutVersion: "1.0.0" })
    || imageHash(entries[1][1]) !== P.indexSha) fail("image_layout_or_index");
  const idx = record(json(entries[1][1]), ["schemaVersion", "mediaType", "manifests"]);
  if (idx.schemaVersion !== 2 || idx.mediaType !== "application/vnd.oci.image.index.v1+json"
    || idx.manifests.length !== 1) fail("image_index");
  const m = record(idx.manifests[0], ["mediaType", "digest", "size", "platform"]);
  if (!equal(m.platform, { os: "linux", architecture: "arm64" })) fail("image_index_platform");
  descriptor({ mediaType: m.mediaType, digest: m.digest, size: m.size }, P.manifest, P.manifestSize,
    "application/vnd.oci.image.manifest.v1+json");
  for (let i = 2; i < entries.length; i++) {
    const b = entries[i][1], digest = [P.manifest, P.config, ...P.layers.map(l => l.digest)][i - 2];
    const size = [P.manifestSize, P.configSize, ...P.layers.map(l => l.size)][i - 2];
    if (b.length !== size || "sha256:" + imageHash(b) !== digest) fail("image_blob_content");
  }
  const manifest = record(json(entries[2][1]), ["schemaVersion", "mediaType", "config", "layers"], ["annotations"]);
  if (manifest.schemaVersion !== 2 || manifest.mediaType !== "application/vnd.oci.image.manifest.v1+json"
    || manifest.layers.length !== 5) fail("image_manifest");
  descriptor(manifest.config, P.config, P.configSize, "application/vnd.oci.image.config.v1+json");
  manifest.layers.forEach((d, i) => descriptor(d, P.layers[i].digest, P.layers[i].size,
    "application/vnd.oci.image.layer.v1.tar+gzip"));
  imageConfig(entries[3][1]);
  let expandedBytes = 0;
  for (let i = 0; i < 5; i++) {
    const digest = createHash("sha256"), gunzip = createGunzip();
    // Streaming hashes do not extract or execute a layer, or retain its expansion.
    const completed = new Promise((resolve, reject) => {
      gunzip.on("data", b => {
        expandedBytes += b.length;
        if (expandedBytes > P.expandedMax) gunzip.destroy(Error("image_expanded_bound"));
        else digest.update(b);
      });
      gunzip.once("error", reject);
      gunzip.once("end", resolve);
    });
    gunzip.end(entries[i + 4][1]);
    await completed;
    if ("sha256:" + digest.digest("hex") !== P.layers[i].diff) fail("image_layer_diff_id");
  }
  return { expandedBytes, config: imageConfig(entries[3][1]) };
}
export function encodeImageTar(entries) {
  if (!equal(entries.map(e => e[0]), imageEntryNames()) || entries.length !== 9
    || entries.some(e => !Buffer.isBuffer(e[1]))) fail("image_closed_entries");
  const length = entries.reduce((n, [, b]) => n + 512 + b.length + padding(b.length), 1024);
  imageBound(length, P.archiveMax, "image_archive_bound");
  const output = Buffer.alloc(length);
  let offset = 0;
  for (const [name, bytes] of entries) {
    const h = output.subarray(offset, offset + 512);
    if (Buffer.byteLength(name) > 100) fail("image_tar_name");
    h.write(name, 0, "ascii");
    for (const [at, count, value] of [[100, 8, 0o600], [108, 8, 0], [116, 8, 0], [124, 12, bytes.length], [136, 12, 0]])
      h.write(value.toString(8).padStart(count - 1, "0") + "\0", at, "ascii");
    h.fill(32, 148, 156); h[156] = 48;
    h.write("ustar\0", 257, "ascii"); h.write("00", 263, "ascii");
    const sum = h.reduce((n, b) => n + b, 0);
    h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
    bytes.copy(output, offset + 512);
    offset += 512 + bytes.length + padding(bytes.length);
  }
  return output;
}
// This parser does not call the encoder or trust its offsets/expected payload.
export async function verifyImageTar(bytes) {
  imageBound(bytes.length, P.archiveMax, "image_archive_bound");
  if (bytes.length % 512) fail("image_tar_length");
  const entries = [], names = imageEntryNames();
  let at = 0;
  const zeros = b => b.every(v => v === 0);
  for (let i = 0; i < 9; i++) {
    const h = bytes.subarray(at, at + 512);
    if (h.length !== 512) fail("image_tar_header");
    const name = h.subarray(0, 100), nullAt = name.indexOf(0);
    if (nullAt < 0 || !zeros(name.subarray(nullAt)) || name.subarray(0, nullAt).toString("latin1") !== names[i])
      fail("image_tar_name");
    const octal = (start, width) => {
      const s = h.subarray(start, start + width).toString("latin1");
      if (!new RegExp("^[0-7]{" + (width - 1) + "}\\x00$").test(s)) fail("image_tar_number");
      return Number.parseInt(s, 8);
    };
    if (octal(100, 8) !== 0o600 || octal(108, 8) !== 0 || octal(116, 8) !== 0 || octal(136, 12) !== 0
      || h[156] !== 48 || !zeros(h.subarray(157, 257)) || h.subarray(257, 265).toString("latin1") !== "ustar\0" + "00"
      || !zeros(h.subarray(265))) fail("image_tar_header");
    const checksum = h.subarray(148, 156).toString("latin1");
    if (!/^[0-7]{6}$/.test(checksum.slice(0, 6)) || checksum.slice(6) !== "\0 "
      || Number.parseInt(checksum, 8) !== h.reduce((n, b, p) => n + (p >= 148 && p < 156 ? 32 : b), 0))
      fail("image_tar_checksum");
    const size = octal(124, 12), end = at + 512 + size, next = Math.ceil(end / 512) * 512;
    if (!Number.isSafeInteger(end) || next > bytes.length - 1024
      || !zeros(bytes.subarray(end, next))) fail("image_tar_payload_bound_or_padding");
    entries.push([names[i], bytes.subarray(at + 512, end)]); at = next;
  }
  if (bytes.length !== at + 1024 || !zeros(bytes.subarray(at))) fail("image_tar_terminator");
  const checked = await verifyImageEntries(entries);
  return { names, sha256: imageHash(bytes), expandedBytes: checked.expandedBytes };
}
