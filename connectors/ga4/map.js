/**
 * GA4 wire-protocol connector: map a captured event into a GA4 Measurement
 * Protocol request body. Pure function — no DOM, no network, no globals. The
 * output is the contract pinned at contracts/ga4-mp-request.schema.json.
 *
 * This is the mapping half of the GA4 connector (ADR-0002 "the worker maps");
 * for the spike it is shared by both the main-thread baseline (003-01) and the
 * worker path (003-02) so the two differ only in WHERE the map runs, not WHAT it
 * produces — keeping the head-to-head honest.
 */

/**
 * @param {{ type: string, params?: Record<string, unknown> }} event
 *   The captured event: a GA4 event name + its params.
 * @param {{
 *   clientId: string,
 *   sessionId: string|number,
 *   engagementTimeMsec?: number,
 *   consent?: { ad_user_data?: "GRANTED"|"DENIED", ad_personalization?: "GRANTED"|"DENIED" },
 *   userId?: string,
 * }} ctx  Session/identity context, sourced by the host (client_id from the _ga
 *   cookie via the mediated cookie capability; session_id from _ga_<stream>).
 * @returns {object} a GA4 MP request body (contracts/ga4-mp-request.schema.json).
 */
export function mapToMp(event, ctx) {
  const params = {
    ...(event.params || {}),
    // session_id + engagement_time_msec are required for the event to attribute
    // to a session and appear in standard reports (contracts/ga4-mp.md §4).
    session_id: String(ctx.sessionId),
    engagement_time_msec:
      typeof ctx.engagementTimeMsec === "number" ? ctx.engagementTimeMsec : 100,
  };

  /** @type {Record<string, unknown>} */
  const body = {
    client_id: ctx.clientId,
    events: [{ name: event.type, params }],
  };
  if (ctx.userId) body.user_id = ctx.userId;
  if (ctx.consent) body.consent = ctx.consent;
  return body;
}

/** Build the MP collect URL (production or /debug validation). */
export function mpUrl({ measurementId, apiSecret, debug = false, region }) {
  const host = region ? `${region}.google-analytics.com` : "www.google-analytics.com";
  const path = debug ? "/debug/mp/collect" : "/mp/collect";
  return `https://${host}${path}?measurement_id=${encodeURIComponent(
    measurementId,
  )}&api_secret=${encodeURIComponent(apiSecret)}`;
}
