import hpack from "hpack.js";
import hpackPackage from "hpack.js/package.json" with { type: "json" };
import { isProxy, isUint8Array } from "node:util/types";

const LIMIT = 65536;
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const tableSizeError = size => !Number.isInteger(size) || size < 0 || size > 0xffffffff
  ? "invalid_hpack_table_size" : (size > LIMIT ? "unsupported_hpack_table_size" : null);

/**
 * One connection and one compression direction; complete HPACK Buffers only.
 * maxTableSize is the initial effective bound (default 4096, supported 0..65536).
 * Each block has independent 65536-byte encoded and semantic caps. Semantic
 * bytes mean UTF-8 JSON.stringify(orderedPairs), with no normalization, joining,
 * sorting or credential elision. The RFC table has its own bounded octet size.
 * decode returns frozen pairs, headerBytes, and a caller-owned copy of the
 * original encodedBlock; it never reconstructs compressed bytes from fields.
 * Any decode/settings failure irreversibly poisons this context and discards
 * its table and pending fields. Errors and snapshots contain no header values.
 * No framing, HTTP header validation, SETTINGS/ACK processing or forward grant.
 */
export function createInspectedHeaderBlockDecoder(options = {}) {
  if (!options || typeof options !== "object" || isProxy(options)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
    || Reflect.ownKeys(options).some(key => key !== "maxTableSize"
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value")))
    throw new Error("invalid_hpack_options");
  let maxTableSize = Object.hasOwn(options, "maxTableSize")
    ? Object.getOwnPropertyDescriptor(options, "maxTableSize").value : 4096;
  const sizeError = tableSizeError(maxTableSize);
  if (sizeError) throw new Error(sizeError);
  if (hpackPackage.version !== "2.1.6") throw new Error("unsupported_hpack_implementation");
  let decompressor = hpack.decompressor.create({ table: { maxSize: maxTableSize } });
  let wire = decompressor._decoder, table = decompressor._table;
  let pairs = null, headerBytes = 0, reason = null;
  let representations = 0, fields = 0, stringBytes = 0, indexed = false;
  let updates = 0, lastUpdate = null;
  let requiredTableSize = null;
  const reject = category => { reason ??= category; throw new Error(reason); };
  const discard = () => { pairs = null; decompressor = null; wire = null; table = null; };
  const reserve = bytes => {
    if (headerBytes + bytes > LIMIT) reject("semantic_header_limit");
    headerBytes += bytes;
  };
  // hpack.js exposes octet strings as Latin-1 code units. Count their actual
  // UTF-8 JSON representation, including escapes, without building that JSON.
  const octetBytes = byte => byte < 32
    ? ([8, 9, 10, 12, 13].includes(byte) ? 2 : 6)
    : (byte === 34 || byte === 92 ? 2 : (byte < 128 ? 1 : 2));
  const reserveString = value => {
    for (let i = 0; i < value.length; i++) reserve(octetBytes(value.charCodeAt(i)));
  };

  // Source-bound to hpack.js 2.1.6: execute is synchronous, catches a thrown
  // push/output error and emits it immediately. Never use the readable queue.
  // These per-instance adapters leave integer/Huffman decoding and eviction in
  // the package, but stop before growing strings or retaining the next pair.
  const execute = decompressor._execute, lookup = table.lookup;
  const take = wire.buffer.take, huffmanWord = wire.decodeHuffmanWord;
  const updateTableSize = decompressor.updateTableSize;
  decompressor.updateTableSize = function(size) {
    if (fields || updates === 2 || (updates && size < lastUpdate)) reject("hpack_table_update_order");
    if (size > table.protocolMaxSize) reject("hpack_table_size_exceeded");
    if (requiredTableSize !== null && size > requiredTableSize) reject("hpack_table_size_update_required");
    requiredTableSize = null;
    updates++; lastUpdate = size;
    return updateTableSize.call(this, size);
  };
  decompressor._execute = function() {
    const first = wire.buffer.peekUInt8();
    representations++;
    if ((first & 0xe0) !== 0x20) {
      if (requiredTableSize !== null) reject("hpack_table_size_update_required");
      reserve(pairs.length ? 8 : 7); // Pair punctuation, plus inter-pair comma.
      indexed = (first & 0x80) !== 0;
    }
    return execute.call(this);
  };
  table.lookup = function(index) {
    const field = lookup.call(this, index);
    reserveString(field.name);
    if (indexed) reserveString(field.value);
    return field;
  };
  wire.buffer.take = function(size) {
    if (size > LIMIT - headerBytes) reject("semantic_header_limit");
    const bytes = take.call(this, size);
    for (const byte of bytes) { reserve(octetBytes(byte)); stringBytes++; }
    return bytes;
  };
  wire.decodeHuffmanWord = function(input, bits, output) {
    return huffmanWord.call(this, input, bits, {
      push(byte) { reserve(octetBytes(byte)); stringBytes++; output.push(byte); },
    });
  };
  decompressor.on("error", () => { reason ??= "malformed_hpack_block"; });
  decompressor.push = field => {
    pairs.push(Object.freeze([field.name, field.value]));
    fields++;
    return true;
  };
  return Object.freeze({
    // Content-free work counters are for offline limit witnesses, not receipts.
    snapshot: () => Object.freeze({ poisoned: reason !== null, reason, representations, fields, stringBytes,
      headerBytes, maxTableSize, requiredTableSize, tableSize: table?.maxSize ?? null, dynamicTableBytes: table?.size ?? 0,
      dynamicTableEntries: table?.dynamic.length ?? 0 }),
    // Caller applies the effective SETTINGS_HEADER_TABLE_SIZE for this decoding
    // direction, at the negotiated/acknowledged boundary (not raw peer frames).
    setMaxTableSize(size) {
      if (reason) throw new Error("hpack_decoder_poisoned");
      try {
        const error = tableSizeError(size);
        if (error) reject(error);
        table.protocolMaxSize = size;
        if (size < table.maxSize) {
          table.updateSize(size);
          requiredTableSize = Math.min(requiredTableSize ?? size, size);
        }
        maxTableSize = size;
      } catch {
        reason ??= "malformed_hpack_block";
        discard();
        throw new Error(reason);
      }
    },
    decode(block) {
      if (reason) throw new Error("hpack_decoder_poisoned");
      pairs = [];
      headerBytes = 2;
      representations = 0; fields = 0; stringBytes = 0;
      updates = 0; lastUpdate = null;
      try {
        if (isProxy(block) || !isUint8Array(block) || !Buffer.isBuffer(block)) reject("invalid_hpack_block");
        const bytes = byteLength.call(block);
        if (bytes > LIMIT) reject("encoded_header_block_limit");
        const encodedBlock = Buffer.alloc(bytes);
        // Typed-array intrinsics copy the actual octets, not Buffer overrides,
        // accessors, valueOf, an iterator, or a caller's reconstruction.
        Uint8Array.prototype.set.call(encodedBlock, block);
        decompressor.write(encodedBlock);
        decompressor.execute();
        if (reason) throw new Error(reason);
        if (requiredTableSize !== null) reject("hpack_table_size_update_required");
        return Object.freeze({ pairs: Object.freeze(pairs), headerBytes, encodedBlock });
      } catch {
        reason ??= "malformed_hpack_block";
        discard();
        throw new Error(reason);
      }
    },
  });
}
