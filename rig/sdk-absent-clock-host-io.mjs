import { data } from "./inspected-meta-record.mjs";
import { fail, freeze } from "./sdk-absent-clock-observation-io.mjs";
import { publishPrivateOriginal } from "./private-original-file.mjs";
const NAMES = ["host-request.json", "host-intent.json", "host-issued.json", "fixture-output.json", "host-close.json", "host-unknown.json",
  "pending-outer-tool-close.json"];
// Exclusive final names avoid a hardlink/unlink ctime exception altogether.
// An incomplete file is diagnostic debris, never an acknowledged publication
// or a reason to retry. The child cannot start until request+intent settle.
export function publishClockHostOriginal(root, name, value, uid) {
  const bytes = Buffer.from(JSON.stringify(data(value)) + "\n");
  if (!NAMES.includes(name) || bytes.length > 65536) fail("host_fixed_publication_bound");
  return freeze(publishPrivateOriginal(root, name, bytes, uid));
}
