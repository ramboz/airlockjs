import { closeSync, openSync, readSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { analyzeGoogleManualCapture, googleManualSafeError, parseGoogleManualJson } from "../connectors/google-ads/manual-response.js";

export { analyzeGoogleManualCapture, decodeGoogleManualResponse } from "../connectors/google-ads/manual-response.js";

function cli() {
  if (process.argv.length !== 2) {
    console.error("unsupported-options");
    process.exitCode = 2;
    return;
  }
  const bytes = Buffer.alloc(262145);
  let length = 0;
  try {
    const fd = openSync(new URL("./fixtures/google-manual-conversion.json", import.meta.url), "r");
    try {
      while (length < bytes.length) {
        const count = readSync(fd, bytes, length, bytes.length - length, null);
        if (!count) break;
        length += count;
      }
    } finally { closeSync(fd); }
  } catch {
    console.error("fixture-unavailable");
    process.exitCode = 2;
    return;
  }
  try {
    if (length === bytes.length) throw new Error("body-limit");
    let source;
    try { source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length)); }
    catch { throw new Error("invalid-utf8"); }
    const fixture = parseGoogleManualJson(source);
    const result = analyzeGoogleManualCapture(fixture.entries, fixture.owned);
    console.log(JSON.stringify(result, null, 2));
    if (result.overall === "rejected") process.exitCode = 2;
  } catch (error) {
    console.error(googleManualSafeError(error));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
