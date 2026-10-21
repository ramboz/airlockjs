import { describe, expect, it } from "vitest";
import hpack from "hpack.js";

const load = () => import("./inspected-header-block.mjs");
const hex = value => Buffer.from(value.replaceAll(/\s/g, ""), "hex");
const encode = (pairs, { huffman = false, incremental = false } = {}) => {
  const compressor = hpack.compressor.create({ table: { maxSize: 4096 } });
  compressor.write(pairs.map(([name, value]) => ({ name, value, huffman, incremental })));
  const blocks = [];
  for (let block; (block = compressor.read()) !== null;) blocks.push(block);
  return Buffer.concat(blocks);
};
const tableUpdate = size => {
  const encoder = hpack.encoder.create();
  encoder.encodeBits(1, 3);
  encoder.encodeInt(size);
  return Buffer.concat(encoder.render());
};

describe("offline inspected HPACK header blocks", () => {
  it("decodes RFC 7541 C.2.1 without reconstructing the original encoding", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    const block = hex("400a637573746f6d2d6b65790d637573746f6d2d686561646572");
    const result = decoder.decode(block);
    expect(result.pairs).toEqual([["custom-key", "custom-header"]]);
    expect(result.headerBytes).toBe(Buffer.byteLength('[["custom-key","custom-header"]]'));
    expect(result.encodedBlock).toEqual(block);
    expect(result.encodedBlock).not.toBe(block);
    block.fill(0);
    expect(result.encodedBlock).toEqual(hex("400a637573746f6d2d6b65790d637573746f6d2d686561646572"));
  });

  it("accepts exactly 65536 semantic/encoded bytes and poisons on one byte over either cap", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const pairs = [["x", "a".repeat(65526)]];
    const exact = Buffer.concat([tableUpdate(4096), encode(pairs)]);
    expect(exact.length).toBe(65536);
    const decoder = createInspectedHeaderBlockDecoder();
    expect(decoder.decode(exact)).toMatchObject({ pairs, headerBytes: 65536, encodedBlock: exact });
    const encodedOverflow = createInspectedHeaderBlockDecoder();
    expect(() => encodedOverflow.decode(Buffer.concat([exact, hex("82")]))).toThrow(/^encoded_header_block_limit$/);
    expect(encodedOverflow.snapshot()).toMatchObject({ representations: 0, fields: 0, stringBytes: 0 });
    expect(() => encodedOverflow.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
    const semanticOverflow = createInspectedHeaderBlockDecoder();
    expect(() => semanticOverflow.decode(encode([["x", "a".repeat(65527)]])))
      .toThrow(/^semantic_header_limit$/);
    expect(() => semanticOverflow.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
  });

  it("stops indexed expansion during execute, without walking the rest of a 262 MB expansion", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    decoder.decode(encode([["x", "a".repeat(4000)]], { incremental: true }));
    expect(() => decoder.decode(Buffer.alloc(65536, 0xbe))).toThrow(/^semantic_header_limit$/);
    expect(decoder.snapshot()).toMatchObject({ poisoned: true, reason: "semantic_header_limit",
      representations: 17, fields: 16 });
    expect(decoder.snapshot().headerBytes).toBeLessThanOrEqual(65536);
    expect(() => decoder.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
  });

  it("stops Huffman output before constructing an over-limit string, including JSON escaping", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    for (const value of ["0".repeat(100000), "\0".repeat(20000)]) {
      const decoder = createInspectedHeaderBlockDecoder();
      const block = encode([["x", value]], { huffman: true });
      expect(block.length).toBeLessThan(65536);
      expect(() => decoder.decode(block)).toThrow(/^semantic_header_limit$/);
      expect(decoder.snapshot()).toMatchObject({ poisoned: true, representations: 1, fields: 0 });
      expect(decoder.snapshot().headerBytes).toBeLessThanOrEqual(65536);
      expect(decoder.snapshot().stringBytes).toBeGreaterThan(0);
      expect(decoder.snapshot().stringBytes).toBeLessThan(value.length);
    }
  });

  it("uses the semantic byte cap, not a lower arbitrary header-count quota", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const pairs = Array.from({ length: 8191 }, () => ["", ""]);
    pairs[0][1] = "a".repeat(7);
    const decoder = createInspectedHeaderBlockDecoder();
    const result = decoder.decode(encode(pairs));
    expect(result.pairs).toEqual(pairs);
    expect(result.headerBytes).toBe(65536);
    expect(decoder.snapshot()).toMatchObject({ fields: 8191, representations: 8191 });
    const overflow = createInspectedHeaderBlockDecoder();
    expect(() => overflow.decode(encode(Array.from({ length: 8192 }, () => ["", ""]))))
      .toThrow(/^semantic_header_limit$/);
    expect(overflow.snapshot()).toMatchObject({ fields: 8191, representations: 8192 });
  });

  it("counts escaped/control and Latin-1 strings exactly at the semantic cap in either encoding", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    for (const value of ["\0".repeat(10921), "\x80".repeat(8191) + "a".repeat(49144)]) {
      const pairs = [["x", value]];
      expect(Buffer.byteLength(JSON.stringify(pairs))).toBe(65536);
      for (const huffman of [false, true]) {
        const decoder = createInspectedHeaderBlockDecoder();
        expect(decoder.decode(encode(pairs, { huffman }))).toMatchObject({ pairs, headerBytes: 65536 });
        expect(() => decoder.decode(encode([["x", value + "a"]], { huffman })))
          .toThrow(/^semantic_header_limit$/);
      }
    }
  });

  it("validates data-only options without calling accessors, coercions, symbols or proxy traps", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    let callbacks = 0;
    const callback = () => { callbacks++; throw new Error("must-not-run"); };
    for (const options of [null, 1, "x", [], callback, new Date(),
      { unknown: 1 }, { [Symbol("maxTableSize")]: 4096 },
      Object.defineProperty({}, "maxTableSize", { get: callback }),
      Object.create({ maxTableSize: 4096 }),
      new Proxy({}, { getPrototypeOf: callback, ownKeys: callback, get: callback })]) {
      expect(() => createInspectedHeaderBlockDecoder(options)).toThrow(/^invalid_hpack_options$/);
    }
    for (const size of [undefined, null, -1, 1.5, NaN, Infinity, 2 ** 32, "4096", { valueOf: callback }])
      expect(() => createInspectedHeaderBlockDecoder({ maxTableSize: size })).toThrow(/^invalid_hpack_table_size$/);
    expect(callbacks).toBe(0);
    for (const size of [65537, 2 ** 32 - 1])
      expect(() => createInspectedHeaderBlockDecoder({ maxTableSize: size })).toThrow(/^unsupported_hpack_table_size$/);
    expect(createInspectedHeaderBlockDecoder(Object.create(null)).snapshot().tableSize).toBe(4096);
    for (const size of [0, 256, 65536])
      expect(createInspectedHeaderBlockDecoder({ maxTableSize: size }).snapshot().tableSize).toBe(size);
  });

  it.each([
    ["literal", [
      "828684410f7777772e6578616d706c652e636f6d",
      "828684be58086e6f2d6361636865",
      "828785bf400a637573746f6d2d6b65790c637573746f6d2d76616c7565",
    ]],
    ["Huffman", [
      "828684418cf1e3c2e5f23a6ba0ab90f4ff",
      "828684be5886a8eb10649cbf",
      "828785bf408825a849e95ba97d7f8925a849e95bb8e8b4bf",
    ]],
  ])("decodes the successive RFC 7541 %s request examples on one context", async (_label, blocks) => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    const first = [[":method", "GET"], [":scheme", "http"], [":path", "/"], [":authority", "www.example.com"]];
    const expected = [first, [...first, ["cache-control", "no-cache"]],
      [[":method", "GET"], [":scheme", "https"], [":path", "/index.html"],
        [":authority", "www.example.com"], ["custom-key", "custom-value"]]];
    blocks.forEach((block, index) => {
      expect(decoder.decode(hex(block)).pairs).toEqual(expected[index]);
      expect(decoder.snapshot()).toMatchObject({ dynamicTableBytes: [57, 110, 164][index],
        dynamicTableEntries: index + 1, poisoned: false });
    });
  });

  it("decodes RFC literal-without-indexing/never-indexed and 256-byte response-table eviction", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder({ maxTableSize: 256 });
    expect(decoder.decode(hex("040c2f73616d706c652f70617468")).pairs).toEqual([[":path", "/sample/path"]]);
    expect(decoder.decode(hex("100870617373776f726406736563726574")).pairs).toEqual([["password", "secret"]]);
    expect(decoder.snapshot().dynamicTableEntries).toBe(0);
    const rest = [["cache-control", "private"], ["date", "Mon, 21 Oct 2013 20:13:21 GMT"],
      ["location", "https://www.example.com"]];
    const first = hex("4803333032580770726976617465"
      + "611d4d6f6e2c203231204f637420323031332032303a31333a323120474d54"
      + "6e1768747470733a2f2f7777772e6578616d706c652e636f6d");
    expect(decoder.decode(first).pairs).toEqual([[":status", "302"], ...rest]);
    expect(decoder.snapshot()).toMatchObject({ dynamicTableBytes: 222, dynamicTableEntries: 4 });
    expect(decoder.decode(hex("4803333037c1c0bf")).pairs).toEqual([[":status", "307"], ...rest]);
    expect(decoder.snapshot()).toMatchObject({ dynamicTableBytes: 222, dynamicTableEntries: 4 });
  });

  it("preserves duplicate cookies, pseudoheader order, case, octets and distinct original encodings", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const pairs = [[":method", "GET"], ["cookie", "a=1"], ["set-cookie", "c=3"],
      ["cookie", "b=2"], ["set-cookie", "d=4"], ["x-MiXeD", "\\\"\0\t\n\f\r\b\x1f\x7f\x80\xff"]];
    const plain = encode(pairs), compressed = encode(pairs, { huffman: true });
    expect(plain.equals(compressed)).toBe(false);
    const decoder = createInspectedHeaderBlockDecoder();
    for (const block of [plain, compressed]) {
      const result = decoder.decode(block);
      expect(result.pairs).toEqual(pairs);
      expect(result.headerBytes).toBe(Buffer.byteLength(JSON.stringify(pairs)));
      expect(result.encodedBlock).toEqual(block);
      expect(Object.isFrozen(result.pairs)).toBe(true);
      expect(Object.isFrozen(result.pairs[0])).toBe(true);
    }
    const otherDirection = createInspectedHeaderBlockDecoder();
    decoder.decode(encode([["x-context", "one"]], { incremental: true }));
    expect(() => otherDirection.decode(hex("be"))).toThrow(/^malformed_hpack_block$/);
    expect(decoder.decode(hex("be")).pairs).toEqual([["x-context", "one"]]);
  });

  it("rejects late, descending, excess or over-negotiated dynamic table updates irrecoverably", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    for (const [block, reason] of [
      [hex("8220"), "hpack_table_update_order"],
      [Buffer.concat([tableUpdate(32), tableUpdate(16)]), "hpack_table_update_order"],
      [Buffer.concat([tableUpdate(0), tableUpdate(16), tableUpdate(32)]), "hpack_table_update_order"],
      [tableUpdate(4097), "hpack_table_size_exceeded"],
    ]) {
      const decoder = createInspectedHeaderBlockDecoder();
      expect(() => decoder.decode(block)).toThrow(new RegExp(`^${reason}$`));
      expect(() => decoder.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
    }
    const decoder = createInspectedHeaderBlockDecoder();
    expect(decoder.decode(Buffer.concat([tableUpdate(0), tableUpdate(4096), hex("82")])).pairs)
      .toEqual([[":method", "GET"]]);
    expect(decoder.snapshot()).toMatchObject({ tableSize: 4096, dynamicTableEntries: 0 });
  });

  it("tracks negotiated reductions, evicts immediately, and requires the smallest update before reuse", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    decoder.decode(encode([["a", "1"], ["b", "2"], ["c", "3"]], { incremental: true }));
    expect(decoder.snapshot()).toMatchObject({ dynamicTableBytes: 102, dynamicTableEntries: 3 });
    decoder.setMaxTableSize(68);
    expect(decoder.snapshot()).toMatchObject({ maxTableSize: 68, tableSize: 68,
      dynamicTableBytes: 68, dynamicTableEntries: 2 });
    decoder.setMaxTableSize(34);
    decoder.setMaxTableSize(68);
    expect(decoder.snapshot()).toMatchObject({ maxTableSize: 68, tableSize: 34,
      dynamicTableBytes: 34, dynamicTableEntries: 1 });
    expect(decoder.decode(Buffer.concat([tableUpdate(34), tableUpdate(68), hex("be")])).pairs)
      .toEqual([["c", "3"]]);
    expect(decoder.decode(hex("be")).pairs).toEqual([["c", "3"]]);
    decoder.setMaxTableSize(0);
    expect(decoder.snapshot()).toMatchObject({ maxTableSize: 0, tableSize: 0,
      dynamicTableBytes: 0, dynamicTableEntries: 0 });
    expect(decoder.decode(Buffer.concat([tableUpdate(0), hex("82")])).pairs).toEqual([[":method", "GET"]]);
    decoder.setMaxTableSize(4096);
    expect(decoder.snapshot().tableSize).toBe(0);
    decoder.decode(Buffer.concat([tableUpdate(4096), encode([["new", "entry"]], { incremental: true })]));
    expect(decoder.decode(hex("be")).pairs).toEqual([["new", "entry"]]);
  });

  it("fails closed on omitted/insufficient reduction updates, including a reduction followed by an increase", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    for (const block of [hex("82"), Buffer.alloc(0), tableUpdate(68)]) {
      const decoder = createInspectedHeaderBlockDecoder();
      decoder.setMaxTableSize(34);
      decoder.setMaxTableSize(68);
      expect(() => decoder.decode(block)).toThrow(/^hpack_table_size_update_required$/);
      expect(() => decoder.setMaxTableSize(4096)).toThrow(/^hpack_decoder_poisoned$/);
    }
    const decoder = createInspectedHeaderBlockDecoder();
    decoder.decode(tableUpdate(64));
    decoder.setMaxTableSize(80); // The encoder's current table was already smaller.
    expect(decoder.decode(hex("82")).pairs).toEqual([[":method", "GET"]]);
  });

  it("evicts old dynamic entries on in-band reductions rather than resetting every block", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    decoder.decode(encode([["a", "1"], ["b", "2"], ["c", "3"]], { incremental: true }));
    expect(decoder.decode(Buffer.concat([tableUpdate(68), hex("bebf")])).pairs)
      .toEqual([["c", "3"], ["b", "2"]]);
    expect(decoder.snapshot()).toMatchObject({ tableSize: 68, dynamicTableBytes: 68, dynamicTableEntries: 2 });
    expect(() => decoder.decode(hex("c0"))).toThrow(/^malformed_hpack_block$/);
  });

  it("poisons on invalid or unsupported negotiated sizes without coercion or silent clamping", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    let coercions = 0;
    for (const [size, category] of [[-1, "invalid_hpack_table_size"], [2 ** 32, "invalid_hpack_table_size"],
      [{ valueOf() { coercions++; return 4096; } }, "invalid_hpack_table_size"],
      [65537, "unsupported_hpack_table_size"]]) {
      const decoder = createInspectedHeaderBlockDecoder();
      expect(() => decoder.setMaxTableSize(size)).toThrow(new RegExp(`^${category}$`));
      expect(() => decoder.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
    }
    expect(coercions).toBe(0);
  });

  it.each([
    ["zero index", "80"], ["out-of-range static index", "ff00"], ["absent dynamic index", "be"],
    ["truncated integer", "ff"], ["unterminated integer", "ff80"],
    ["overlong integer", "ff8080808000"], ["large index", "ffffffff7f"],
    ["truncated update", "3f"], ["overlong update", "3f8080808000"],
    ["missing name length", "00"], ["truncated name", "000578"],
    ["missing value length", "000178"], ["missing value", "00017805"],
    ["truncated value", "0001780261"], ["truncated string integer", "0001787f"],
    ["overlong string integer", "00ff8080808000"],
    ["invalid Huffman name padding", "00810000"], ["invalid Huffman value padding", "0001788100"],
    ["Huffman EOS", "00017884ffffffff"], ["Huffman eight-bit padding", "00017881ff"],
    ["truncated Huffman payload", "0001788261"],
  ])("rejects %s with a fixed error and no recovery", async (_label, block) => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    expect(() => decoder.decode(hex(block))).toThrow(/^malformed_hpack_block$/);
    expect(decoder.snapshot().poisoned).toBe(true);
    expect(() => decoder.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
    expect(() => decoder.setMaxTableSize(4096)).toThrow(/^hpack_decoder_poisoned$/);
  });

  it("never exposes a partial block or sensitive values in errors or diagnostic counters", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    const decoder = createInspectedHeaderBlockDecoder();
    const marker = "synthetic-sensitive-cookie";
    const bad = Buffer.concat([encode([["cookie", marker]], { incremental: true }), hex("80")]);
    let error;
    try { decoder.decode(bad); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("malformed_hpack_block");
    expect(String(error.stack)).not.toContain(marker);
    expect(Object.hasOwn(error, "cause")).toBe(false);
    expect(JSON.stringify(decoder.snapshot())).not.toContain(marker);
    expect(decoder.snapshot()).toMatchObject({ poisoned: true, fields: 1, dynamicTableEntries: 0 });
    await new Promise(resolve => setImmediate(resolve)); // An unhandled deferred stream error would fail this test.
    expect(() => decoder.decode(Buffer.alloc(0))).toThrow(/^hpack_decoder_poisoned$/);
  });

  it("rejects non-Buffers without callbacks and reads actual Buffer bytes rather than user hooks", async () => {
    const { createInspectedHeaderBlockDecoder } = await load();
    let callbacks = 0;
    const callback = () => { callbacks++; throw new Error("must-not-run"); };
    for (const block of [null, undefined, "", [], new Uint8Array([0x82]), Object.create(Buffer.prototype),
      new Proxy(Buffer.from([0x82]), { get: callback, getPrototypeOf: callback })]) {
      const decoder = createInspectedHeaderBlockDecoder();
      expect(() => decoder.decode(block)).toThrow(/^invalid_hpack_block$/);
      expect(() => decoder.decode(hex("82"))).toThrow(/^hpack_decoder_poisoned$/);
    }
    const block = hex("82");
    Object.defineProperty(block, "length", { get: callback });
    block.valueOf = callback;
    block.copy = callback;
    block[Symbol.iterator] = callback;
    const result = createInspectedHeaderBlockDecoder().decode(block);
    expect(result.pairs).toEqual([[":method", "GET"]]);
    expect(result.encodedBlock).toEqual(hex("82"));
    expect(callbacks).toBe(0);
  });
});
