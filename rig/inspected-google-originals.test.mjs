import { existsSync, mkdtempSync, readFileSync, realpathSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeGoogleOriginals } from "./inspected-google-originals.mjs";

describe("private Google original bytes", () => {
  it("preserves ordered wire chunks and decoded bodies exclusively", () => {
    const directory = mkdtempSync(join(realpathSync(tmpdir()), "google-originals-"));
    const source = { requests: [], wire: [{ connection: 1, protocol: "h1",
      request: [Buffer.from("ab"), Buffer.from("c")], response: [Buffer.from("d")] }],
    responses: [{ ordinal: 1, body: [Buffer.from("body")] }] };
    try {
      const capture = writeGoogleOriginals(directory, source);
      expect(capture.bytes).toBe(8);
      expect(capture.wire[0].request.chunks).toEqual([2, 1]);
      expect(readFileSync(join(directory, capture.wire[0].request.file)).toString()).toBe("abc");
      expect(readFileSync(join(directory, capture.responses[0].body.file)).toString()).toBe("body");
      expect(() => writeGoogleOriginals(directory, source)).toThrow();
    } finally {
      for (const name of ["original-1.bin", "original-2.bin", "original-3.bin"])
        if (existsSync(join(directory, name))) unlinkSync(join(directory, name));
      rmdirSync(directory);
    }
  });
});
