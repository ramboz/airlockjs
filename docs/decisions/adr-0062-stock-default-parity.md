---
status: Proposed
dependencies: [ADR-0003, ADR-0006, ADR-0007, ADR-0012, ADR-0013, ADR-0023, ADR-0061]
last_verified: 2026-11-13
frame_review: true
---

# ADR-0062: Stock-default parity on every vendor track

## Status

Proposed (2026-11-13)

Amends and partially supersedes ADR-0003, ADR-0006 (projection and cookie/storage clauses), ADR-0012 (default denylist, ambient-context boundary note) and ADR-0013 (minimization claims). The clauses are listed under Recommended Decision. Everything else in those ADRs stands.

## Summary

Out of the box, Airlock behaves like the stock vendor tag on every track (Adobe, Google Ads, Meta, and any later one). It sends what the stock tag sends, reads what the stock tag reads, and stores what the stock tag stores. Privacy controls (allowlists, field strips, caps) stay, and a site turns them on. They are no longer the starting point. There is one named exception: the seal's consent hold stays on by default. The main tradeoff: the default context and payload get wider, so the chamber sees more page data than today.

## Context

Airlock reduces what vendors see by default. Alloy runs with `context: []` and a 2-field `toXdm` allowlist (connectors/alloy/connector.js:104, ADR-0013:24-30). The host-to-connector snapshot is default-deny (ADR-0003:88-96). The payload gets a built-in denylist (core/payload-governance.js:88, core/airlock.js:146). Stock Alloy 2.31.1 instead collects `[web, device, environment, placeContext]` by default: page URL, referrer, screen, browser details and local time.

Those reduced defaults came from the privacy thesis, not from the vendor. They break parity (ADR-0061 point 2 keeps full parity as the v1.0 bar) and push fake page values into the worker. Owner decision, 2026-11-13, asked what Airlock should send when a site's setup doesn't say: "we want full parity, just with better controls, so we should match stock by default, always, for all tracks". Asked whether the seal should also default to stock, the owner chose: "No, keep the consent hold as the one exception to the rule".

## Decision Options Considered

### Option A: Keep the reduced defaults
- **Pros:** Smallest data exposure by default.
- **Cons:** A default site is not at parity, and a default fixture never matches a stock recording. The owner rejected it.

### Option B: Match stock by default on every track; controls are opt-in
- **Pros:** One rule for every vendor. Fixtures recorded with stock defaults compare directly. A site that wants less turns controls on.
- **Cons:** More page data reaches the chamber by default. Existing minimized-by-default claims need amending. Chosen.

### Option C: Choose per vendor
- **Pros:** Lets a vendor keep a reduced default where the risk is high.
- **Cons:** Splits the rule and invites drift. The owner said "for all tracks". Rejected.

## Recommended Decision

Adopt Option B.

1. **The rule.** On every vendor track, Airlock's default behaviour matches the stock vendor tag's default behaviour: config defaults, ambient context collection, storage and cookie behaviour, and request shape. "Stock" means the base-setup state of the pinned version under ADR-0061 points 1 and 3 (Alloy: 2.31.1; Google and Meta: the captured script build with its base settings). The other settings states are choices a site can make, not the default. Airlock's value is the controls on top. A site turns them on. A reduced default is never the baseline.
2. **Real values, not stand-ins.** The chamber has no DOM (ADR-0014), so the main thread collects what the stock tag would read and sends it across the airlock on a new host-collected stock-context channel, separate from the projection snapshot. The worker no longer fakes page values. For Alloy this means `context` defaults to the stock list, fed by that channel. The projection snapshot is Airlock's own construct that no stock tag reads, so it stays default-deny (ADR-0003's default direction at :60-63 and its kill criterion at :157-159 stand). A site narrows the stock-context channel with a site-configurable `context` list (Alloy) or the vendor's own equivalent. Value governance (ADR-0003:98-106) applies to it as an opt-in control.
3. **Controls, in two groups.** Controls that never change what an honest stock tag sends stay on by default: egress confinement, config integrity, and an endpoint ceiling that covers the stock destinations (point 7). Controls that narrow what is sent are opt-in: field strips, the payload denylist, context narrowing and tighter caps. This ADR removes none of them. For Alloy two are not built yet: input governance at the wrapped-SDK seam (ADR-0012's deferred second placement) and a configurable `context`. Both are required follow-up slices.
4. **The one exception: the consent hold.** When a consent input is wired, the seal holds events while a purpose is pending, on every track and by default (`core/consent.js`, ADR-0023, ADR-0013's seam drop and `setConsent` delegate). Stock gtag, fbevents and Alloy (`defaultConsent: "in"`) send right away. Airlock deliberately does not send before consent. A site can switch the hold off as a control. If a site configures consent, Airlock enforces it (ADR-0007, ADR-0013 points 1-2). "Hold" means hold and flush on grant. Alloy today drops while pending (ADR-0023:71), which loses events stock would have sent. Switching it to hold-and-flush (the refinement ADR-0023:73 names, spec 045-02) is a required follow-up slice. Consent-driven strips and reshapes (ADR-0007:175, ADR-0023:71-73) follow the consent state and stay as they are.
5. **Parity under the exception.** Fixtures are recorded with stock defaults. A comparison supplies a consent state that matches the recording. The pre-consent hold is a documented, deliberate difference and never counts as a parity failure.
6. **Everything else follows the rule.** Caps, queue limits and retention limits must not drop or delay what stock sends by default. That covers the ADR-0004 capture ring and the ~64 KiB keepalive budget (ADR-0004:114-117, which drops past budget today). Tighter limits are opt-in. The consent hold ring's oldest-dropped behaviour (architecture.md:193) is part of the exception.
7. **Egress allowlist (interpretation, for the owner to confirm in review).** The default allowlist covers every destination the stock tag contacts in its frozen inventory. Egress stays mediated, but stock traffic is not blocked. A site can narrow it. Cookie and storage grants follow the same reading: the default host policy grants the stock tag's own cookie and storage set, name-scoping (ADR-0006) becomes an opt-in narrowing, and consent-driven write denial still applies.
8. **Relationship to ADR-0061.** This ADR does not re-open ADR-0061. It names parity's default target: the stock default config. Fixtures are recorded with stock defaults. A control a site turns on is tested as its own state, not as the baseline.

### Existing decisions

| Where | Stance today | Disposition |
|---|---|---|
| ADR-0003:39-43, 88-96 | Default-deny snapshot allowlist; default is empty | **Amended** in scope only: stock-read context travels on the new channel (point 2). The snapshot stays default-deny, with its principle (:60-63) and kill criterion (:157-159) intact. |
| ADR-0003:160-165, :49-58 | Broad-need connectors collapse the allowlist | **Superseded** as a risk. Stock context no longer rides the snapshot, so a wide stock default does not widen it. |
| ADR-0006:30-33 | Projection reads default-deny (restates ADR-0003) | **Unaffected.** The snapshot stays default-deny. |
| ADR-0006:95-98, 155-160, 221 | `declared ∩ host-policy ∩ consent`, default-empty, for projection, endpoints and cookie/storage | **Amended** for endpoints and cookie/storage: the default grants the stock set (point 7), name-scoping is an opt-in narrowing. Projection and the consent term are unchanged. |
| ADR-0012:108-116 | Built-in default denylist (`password`, `cvv`, `ssn`, card fields), on by default | **Amended.** The built-in list stays as a preset a site turns on. This removes the built-in default at :115-116. Owner to confirm (Open question 1). |
| ADR-0012:82-83, 196-199 | Ambient web/device context is vendor-internal, out of input governance's reach | **Superseded.** Under the rule that context is fed from real host values. The boundary note no longer applies. |
| ADR-0013:24-30 | Alloy payload "read-minimized by construction" (`toXdm` 2 fields, `context:[]`) | **Superseded.** `context` defaults to stock. `toXdm` forwards the site-supplied `xdm` as stock does; the 2-field mapping becomes an opt-in. |
| ADR-0013:66-71, 89-93 | Optional strip; "already minimized" as the reason (Option C and the ADR-0012 supersession) | **Amended.** The strip stays Edge-safe and optional. The "already minimized" reason no longer holds. |
| ADR-0013:85-88 | `setConsent` delegate | **Unaffected.** This is the consent hold, the named exception (point 4). |
| ADR-0013:79-84 | Seam drop, gated on `egressPurposes.length`; pending drops | **Amended** for the pending-drop (point 4 follow-up). The gate on `egressPurposes` is the no-consent-wired case, see Open question 4. |
| ADR-0007, ADR-0023, ADR-0024 | Consent vector, per-purpose strips, hold-until-granted | **Unaffected.** Same exception. |
| ADR-0004, ADR-0011:16-25 | Host allow-list, config integrity | **Unaffected** in mechanism. Default allowlist contents follow point 7. |
| ADR-0004:114-117; architecture.md:193 (Q2) | Keepalive budget drops past ~64 KiB; consent hold ring drops oldest | **Amended** for the keepalive budget and capture ring (point 6). The hold ring's cap is part of the exception. |
| ADR-0022:92-98 | Advanced-matching identity bypasses the denylist, leaves only as a hash | **Unaffected.** Hash-only egress is stock behaviour; whether automatic matching is on is a settings state under ADR-0061 point 3. |
| ADR-0020:76-80; refinement-todo.md:689-693 | Credentialed cross-site egress deferred as a security-boundary call (E10) | **Unaffected, still deferred.** If built, its default is stock. See Open question 2. |
| ADR-0039:68-72 | Never blanket-strip fields to force equality | **Unaffected.** Consistent with this rule. |
| refinement-todo.md:97-100 | OQ11 resolved by ADR-0012, default denylist implemented | **Amended** with ADR-0012. |
| refinement-todo.md:374-376 | Alloy "read-minimized by construction" | **Superseded** with ADR-0013. |
| refinement-todo.md:507 | Pixels are default-deny on event declarations | **Unaffected.** It is event routing, not data minimization. |
| architecture.md:90, 154 | "Privacy-filtered" snapshot; OQ4 privacy boundary | **Amended.** Reword in the follow-up slice. |
| connectors/alloy/connector.js:104 and core/payload-governance.js:88 | Code defaults (`context = []`, always-on denylist) | Change in the slices that follow. Not part of this ADR. |

The accepted ADRs are not edited here. Per the repo's convention the follow-up slices add the `Amended by ADR-0062` status lines when this ADR is accepted.

## Consequences

**Becomes easier:**
- One rule for every vendor, including future ones.
- Default fixtures compare directly against stock recordings.
- No fake page values in the worker.

**Becomes harder:**
- The chamber sees more page data by default. The egress confinement, endpoint ceiling and consent hold still bound where it goes and when, but the field-level default no longer does.
- The consent hold is a deliberate difference from stock. Every parity comparison must pin the consent state, or it reports a false failure.
- Docs and the ADRs above carry "minimized by default" claims that must be reworded, so nobody reads them as current.
- Sites that want the old behaviour need opt-in controls that are easy to find and tested as their own states.

## Assumptions

- Stock Alloy 2.31.1 defaults `context` to `[web, device, environment, placeContext]`. This comes from the owner's 2026-11-13 question and the ADR-0013 era characterization (spec 012-04, slice-04-manifest-characterize.md:61, :123). Not yet checked against the pinned bytes; the Adobe inventory freeze checks it.
- The same rule needs per-vendor stock-default facts for Google and Meta. Their capture sessions (ADR-0061 point 7) record them.
- The main thread can collect the stock context values cheaply enough to keep the interaction path O(1) (ADR-0002:86). Unprobed.

## Kill criteria

- Collecting stock context on the main thread costs measurable INP or LCP: revisit how it is collected, not the rule.
- A vendor's stock default cannot be reproduced off-thread: report to the owner, as ADR-0020 already requires for the 1.0 bar.

## Open questions

1. **Does the ADR-0012 built-in denylist (`password`, `cvv`, `ssn`, card numbers) become opt-in too?** The body decides yes, because stock tags send what the site pushes. Recommended: yes, shipped as a named preset sites turn on. The alternative is a small always-on credentials floor, which would be a second named exception to "always".
2. **Does credentialed cross-site egress (ADR-0020 E10) stay deferred?** Stock pixels send cookies cross-site. Recommended: keep it deferred, and make stock the default if it is ever built.
3. **Confirm point 7.** The default egress allowlist covering the stock tag's frozen-inventory destinations, and the default cookie and storage grant matching the stock set, are my reading of the rule. Not an explicit owner answer.
4. **What does a site with no consent input do?** Alloy sends today (the seam drop only runs when `egressPurposes` is set, ADR-0013:84). ADR-0007:105 makes pending hold, so a GA4 or Google Ads site with no consent signal would hold forever. Stock sends. Recommended: no consent input means no hold, on every track, so a default install is at parity. The hold applies once a site wires consent.

## Review log

Two review rounds, each by a fresh Opus sub-agent that read only this draft and the ADRs it amends. Record: [reviews/adr-0062-frame-critique.md](reviews/adr-0062-frame-critique.md).

## Carried findings

Round 2 returned NEEDS-CHANGES. Folded into the body: findings 3 to 7. Carried into the vendor inventory slices, because they need an owner answer or a code slice:

- **No-consent-input default** (round 2, finding 1): Open question 4. The inventory slices pin each track's current behaviour and record it with the answer.
- **Alloy pending-drop becomes hold-and-flush** (finding 2): required follow-up slice (spec 045-02 refinement), listed under point 4.
- **Stock-context channel design and the configurable Alloy `context`** (round 1, findings 2 and 4): required follow-up slices under points 2 and 3. The Adobe inventory checks the stock default list against the pinned 2.31.1 bytes.
