/**
 * The GA4 flatten adapter — spec 038-02 AC3. Turns airlock's GA4 egress
 * (`connectors/ga4/map.js`'s `mapToMp` nested POST-JSON body + `mpUrl`'s collect URL) into the
 * flat `{field: value}` shape `rig/parity/oracle.js`'s `diffParity` compares — mirrors 038-01's
 * `replay.js` parsing the Meta pixel's GET beacon query string into a flat object, for the
 * "airlock speaks a different protocol" case.
 *
 * `measurement_id` is surfaced from the collect URL's QUERY (`map.js:79-85` — the destination
 * property lives in the URL, not the POST body) so the descriptor's `tid` -> `measurement_id` row
 * is CHECKABLE rather than a false `dropped` (AC3's decisive design point, confirmed in
 * frame-critique round 2). The `wireNameMap` RHS (descriptors/ga4.js) is keyed to this adapter's
 * OUTPUT, so a name-lookup miss can never falsely `dropped` a field this adapter actually emits.
 */

/**
 * @param {Object} args
 * @param {Readonly<Record<string, unknown>>} args.body - `mapToMp(event, ctx)`'s return value
 *   (`{ client_id, events: [{ name, params }], user_id?, consent? }`).
 * @param {string} [args.collectUrl] - `mpUrl(...)`'s return value (the MP request URL carrying
 *   `measurement_id`/`api_secret` in its query).
 * @returns {Record<string,string>}
 */
export function flattenGa4Egress({ body, collectUrl }) {
  /** @type {Record<string,string>} */
  const fields = {};

  if (collectUrl) {
    const measurementId = new URL(collectUrl).searchParams.get("measurement_id");
    if (measurementId !== null) fields.measurement_id = measurementId;
  }

  if (body && body.client_id !== undefined && body.client_id !== null) {
    fields.client_id = String(body.client_id);
  }

  const event = body && Array.isArray(body.events) ? body.events[0] : undefined;
  if (event) {
    if (event.name !== undefined) fields.event_name = String(event.name);
    for (const [key, value] of Object.entries(event.params || {})) {
      fields[key] = String(value);
    }
  }

  return fields;
}
