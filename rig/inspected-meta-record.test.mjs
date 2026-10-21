import { describe, expect, it } from "vitest";
import { data, equal, json, record } from "./inspected-meta-record.mjs";

describe("shared strict inspected records (unchanged controller semantics)", () => {
  it("rejects duplicate decoded keys, invalid UTF8, deep or trailing JSON", () => {
    for (const text of ['{"x":1,"\\u0078":2}', '{"x":{"a":1,"a":2}}'])
      expect(() => json(Buffer.from(text))).toThrow("duplicate_case_key");
    for (const bytes of [Buffer.from([255]), Buffer.from("{}[]"), Buffer.from("[".repeat(14) + "0" + "]".repeat(14))])
      expect(() => json(bytes)).toThrow("invalid_case_json");
  });
  it("does not execute accessors, proxies or serialization callbacks", () => {
    let invoked = 0;
    for (const value of [{ get x() { invoked++; return true; } },
      new Proxy({}, { ownKeys() { invoked++; return []; } }), { toJSON() { invoked++; return {}; } }])
      expect(() => data(value)).toThrow("invalid_case_input");
    expect(invoked).toBe(0);
  });
  it("requires a closed record and stable sorted bounded data", () => {
    expect(record({ a: true }, ["a"])).toEqual({ a: true });
    expect(() => record({ a: true, b: false }, ["a"])).toThrow();
    expect(equal({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(() => data({ [Symbol("x")]: true })).toThrow();
  });
});
