/**
 * GA4 replay orchestration — spec 038-02 (reconciliation, craft-review 2026-09-08). Factors the
 * ctx-source → `mapToMp` → `mpUrl` → flatten pipeline that `run-ga4.mjs` and the tests both need
 * into ONE place (mirrors 038-01's `rig/parity/replay.js` `replayPixelBeacon`), so the CLI and the
 * tests cannot drift and `emitted` is **derived, not hardcoded**. Sources `ctx` from the FIXTURE's
 * cookie context (AC1 — never the captured beacon's `cid`/`sid`).
 */
import { mapToMp, mpUrl } from "../../connectors/ga4/map.js";
import { ga4ParityDescriptor, SYNTHETIC_GA4_MEASUREMENT_ID } from "./descriptors/ga4.js";
import { sourceGa4CtxFromFixture } from "./ga4-ctx.js";
import { flattenGa4Egress } from "./ga4-egress.js";

/**
 * Replay a redacted `/g/collect` fixture through airlock's real GA4 egress to airlock's flat
 * field-set. `emitted:false` (with `{}` fields) when the container event name maps to no airlock
 * event — a reportable result, mirroring the pixel connector's `[]` for an unmapped event.
 * @param {Object} args
 * @param {{ container_fields: Record<string,string>, cookies?: Record<string,string> }} args.fixture
 * @param {import("./oracle").ParityDescriptor} [args.descriptor] - defaults to the GA4 descriptor.
 * @param {() => number} [args.now] - injectable clock, forwarded to the per-page-session fallback
 *   (OQ13-2) so a test can pin the minted `sessionId`.
 * @param {() => number} [args.random] - injectable [0,1) source, forwarded likewise.
 * @returns {Promise<{ emitted: boolean, fields: Record<string,string> }>}
 */
export async function replayGa4Egress({ fixture, descriptor = ga4ParityDescriptor, now, random }) {
  const ctx = await sourceGa4CtxFromFixture({
    cookies: fixture.cookies,
    ...(now ? { now } : {}),
    ...(random ? { random } : {}),
  });
  const logicalEvent = descriptor.deriveLogicalEvent(fixture.container_fields);
  if (logicalEvent.type == null) return { emitted: false, fields: {} };
  const body = mapToMp(logicalEvent, ctx);
  // The harness never sends the beacon (no network), and the oracle checks `measurement_id`
  // (the destination property) — NOT the api_secret, which is auth, not an attribution field. So an
  // empty secret is passed: `mpUrl` still emits `measurement_id` in the query for the flatten adapter.
  const collectUrl = mpUrl({ measurementId: SYNTHETIC_GA4_MEASUREMENT_ID, apiSecret: "" });
  return { emitted: true, fields: flattenGa4Egress({ body, collectUrl }) };
}
