import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, lstatSync, openSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { LIMITS } from "./native-stock-policy.mjs";

export function writeGoogleOriginals(directory, originals) {
  if (typeof directory !== "string" || !isAbsolute(directory) || resolve(directory) !== directory)
    throw Error("invalid_google_originals_directory");
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
    || (stat.mode & 0o7777) !== 0o700) throw Error("invalid_google_originals_directory");
  for (let ancestor = dirname(directory);;) {
    const item = lstatSync(ancestor);
    if (!item.isDirectory() || item.isSymbolicLink()) throw Error("invalid_google_originals_directory");
    if (ancestor === dirname(ancestor)) break;
    ancestor = dirname(ancestor);
  }
  let bytes = 0, index = 0;
  const store = chunks => {
    if (!Array.isArray(chunks) || chunks.length > 8192) throw Error("google_originals_invalid");
    const name = `original-${++index}.bin`;
    const fd = openSync(join(directory, name),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const digest = createHash("sha256"), lengths = [];
    try {
      for (const chunk of chunks) {
        if (!Buffer.isBuffer(chunk) || (bytes += chunk.length) > LIMITS.aggregate_bytes)
          throw Error("qualification_output_limit");
        lengths.push(chunk.length); digest.update(chunk);
        for (let offset = 0; offset < chunk.length;) {
          const written = writeSync(fd, chunk, offset, chunk.length - offset);
          if (!written) throw Error("qualification_output_write_failed");
          offset += written;
        }
      }
      fsyncSync(fd);
    } finally { closeSync(fd); }
    return { file: name, bytes: lengths.reduce((sum, length) => sum + length, 0),
      sha256: digest.digest("hex"), chunks: lengths };
  };
  const wire = originals.wire?.map(row => ({ connection: row.connection, protocol: row.protocol,
    request: store(row.request), response: store(row.response) }));
  const responses = originals.responses.map(row => ({ ...row, body: store(row.body) }));
  return { bytes, wire, responses };
}
