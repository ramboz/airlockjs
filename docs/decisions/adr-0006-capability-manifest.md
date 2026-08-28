---
status: Accepted
dependencies: []
last_verified: 2026-08-28
frame_review: true
---

# ADR-0006: Capability manifest: authoritative, consent-gated I/O declaration

## Status

Accepted (2026-08-28)

## Context

The connector manifest already exists as a pinned contract, but it governs a
connector's inputs and outputs asymmetrically, and only the input half is
load-bearing. [`ConnectorManifest`](../../contracts/connector.d.ts) declares
`events` (which event types route to the chamber), `reads` (projection fields),
`capabilities` (a `CapabilityRequest` of cookie/storage/egress/dom/decisions
toggles), and `endpoints`. The declared→granted split is already structural:
`CapabilityRequest` is what the connector asks for and `GrantedCapabilities` is
the subset the host actually passes to `init()`. So airlock is *already* an
Android-style "declare, then receive a subset" system — for part of its surface.

The asymmetry is the problem, and it maps exactly onto the idea this ADR
records — forcing a chamber to announce **both** what it reads and what it
posts, and letting those announcements be gated:

- **Projection reads are authoritative and default-deny.** Per
  [ADR-0003](./adr-0003-projection-snapshot-privacy.md), a chamber receives only
  `declared ∩ host-policy ∩ present`; the default is empty; the invariant is
  oracle-checkable. This is the model working as intended.
- **Declared egress endpoints are *advisory*.** `ConnectorManifest.endpoints` is
  documented in the contract as "advisory; host allow-list wins" — the connector
  *announces* where it will post, but is not *held to it*. The seal
  ([ADR-0004](./adr-0004-egress-dispatch-delivery.md), AD-9) gates egress on
  consent + a host-owned endpoint allow-list that is independent of what any one
  connector declared. So there is no per-connector least-privilege on the send
  side and no trustworthy "what will this tag post?" answer derivable from the
  connector itself.
- **The event *payload* crosses ungoverned.** `AirlockEvent.payload` is
  pass-through for MVP1 (OQ11); the connector declares which event *types* it
  gets, not which *data fields* of them it reads. This is the primary read
  channel and the Magecart/formjacking surface (ADR-0003 § Context).
- **Consent is binary and host-only.** AD-9 gates the seal on a single
  pending/granted consent state. There is no dimension by *purpose*
  (analytics vs ads vs personalization) and no end-user, per-tag choice — so a
  grant cannot be resolved *per declared I/O*.

The user's framing — chambers should announce the data they read and what they
post, as an I/O security layer that could be *selectively* gated by consent or
user choices, the way an Android app does not necessarily get every permission
it asks for — is not a new subsystem. It is the decision to finish the model
ADR-0003 started: make the manifest the **authoritative, consent-gated
declaration frame for the whole I/O surface**. But *enforcement* is not one
uniform rule. The channels that can carry a bounded declaration — projection
reads, egress endpoints, cookie/storage capabilities — get a fails-closed
intersection law (below); the one channel that cannot — the open, site-defined
event payload — is governed by a complementary host-owned denylist per ADR-0003
and OQ11, which does **not** obey that law. The manifest unifies *declaration and
disclosure* across all channels; it does not impose one *enforcement model* on
all of them.

**Scope and timing.** MVP1 shipped (v0.1.0); this is MVP2 work — it is the
"step-5 capability-contract freeze" that the open cluster **OQ9** (MVP2 isolation
+ sync host access), **OQ11** (event-payload read governance), and **OQ13**
(identity-cookie grant wrapper; item 4 already asks whether identity ctx folds
into "the ADR-0003 declaration mechanism … a manifest") all point at. This ADR
is deliberately the **frame** for that cluster: it fixes the intersection law for
the bounded channels and names how the payload channel sits *outside* it. It does
**not** resolve OQ11's payload policy — which ADR-0003 already expects to be a
host-owned *denylist* (default-allow-minus-stripped), not an intersection-law
section — nor the consent-purpose model, now drafted as its own coupled record
([ADR-0007](./adr-0007-consent-purpose-model.md)).

## Decision Options Considered

### Option A: Status quo — asymmetric governance, endpoints advisory

Keep projection reads authoritative (ADR-0003), egress governed only by the
host-owned seal allow-list with the connector's `endpoints` advisory, and the
payload pass-through (OQ11), consent binary (AD-9).

- **Pros:** Already pinned; nothing new to build; the host retains total control
  of the seal regardless of connector claims.
- **Cons:** A connector's own declaration is not load-bearing on the send side,
  so there is no per-connector least-privilege on egress and no trustworthy
  disclosure ("what does this tag post?" is unanswerable from the tag). Three
  channels are governed by three different mental models. Consent stays a global
  on/off. Delivers none of "announce, and be held to it."

### Option B: Authoritative, fails-closed manifest law for the bounded channels (RECOMMENDED)

One rule for every channel that can carry a bounded declaration — projection
reads, egress endpoints, and the cookie/storage capability toggles:

> **granted(channel) = declared(channel) ∩ host-policy(channel) ∩ consent/user-choice(channel)**, default-empty, fails-closed.

The open, site-defined **event payload** is the exception, not a fourth
intersection channel: per ADR-0003 a connector forwarding arbitrary developer
params declares a wildcard, so a declaration-ceiling collapses to default-allow.
It is governed instead by a host-owned sensitive-field **denylist** (OQ11) —
strip-known-dangerous-on-egress, outside this law — unless and until OQ3 pins a
schema that makes field-level declaration non-vacuous. The manifest still
*declares* (event types) and *discloses* the payload channel; it just does not
*attenuate* it by intersection.

The connector's declaration is a **ceiling it can never exceed**: it may narrow
what it receives or sends, never widen it. `endpoints` flips from *advisory* to
*authoritative* — a chamber can only post to an endpoint it declared **and** the
host allows **and** consent/choice grants, even when the host allow-list is
broader. Consent/user-choice becomes a first-class grant input alongside host
policy, not a separate binary gate.

- **Pros:** Per-connector least privilege becomes structural on every *bounded*
  channel — the projection-read door and the send-destination door — via ocap
  attenuation: a lying or stale manifest gets the chamber *less*, never more. (The
  payload read door is governed separately by the OQ11 denylist, not this
  property.)
  The union of manifests is an auto-derivable, pre-runtime data-flow map — a
  privacy "nutrition label" and the substrate for the inspector (OQ7) — *complete*
  for fixed-endpoint connectors, and a *floor* (manifest + runtime-observed egress)
  for server-directed CDPs (see Consequences). Gives OQ9/OQ11/OQ13 one reviewable
  contract instead of three ad-hoc host policies.
  Consent/user-choice has a single, principled insertion point (the grant
  resolver).
- **Cons:** Every connector ships and maintains a fuller manifest (drift risk).
  Needs a grant resolver and a host-policy home in `core/`. Does not by itself
  resolve OQ11's payload model or the consent-purpose model — it *requires* them
  to arrive as fails-closed manifest sections, but the hard part of each is
  still owed. Making `endpoints` authoritative can break a connector that posts
  to a host-configured URL unknown at authoring time (see Kill criteria).

### Option C: Full declaration, but disclosure-only (honor system)

Have connectors declare their whole I/O surface for the label/inspector, but
keep host policy alone binding — declaration is documentation, not a ceiling.

- **Pros:** Cheapest; harvests the privacy-label win immediately; adequate while
  every connector is first-party (MVP1).
- **Cons:** Disclosure without enforcement cannot stop a compromised chamber from
  beaconing to a foreign sink; only the endpoint ceiling (B) does. That value is
  **solidly grounded for a wire-protocol connector with a fixed endpoint (GA4)**;
  for the wrapped-SDK CDP (Alloy) whether the ceiling bites is **unproven** and
  gated on a live endpoint-breadth probe (see Recommended Decision). C's disclosure
  value is real, immediate, and universal — B delivers it as a byproduct — but on
  its own C cannot provide the foreign-sink teeth, so it is a *migration stage* for
  the trusted-first-party phase, not the target.

## Recommended Decision

**Option B**, adopted as the frame and staged.

The manifest is the authoritative declaration frame for the whole I/O surface,
enforced by the intersection law
`granted = declared ∩ host-policy ∩ consent/user-choice` (default-deny,
fails-closed, declaration-as-ceiling) on the **bounded** channels — projection
reads, egress endpoints, cookie/storage capabilities. This generalizes ADR-0003's
projection intersection to the send side and the capability toggles, and adds
consent/user-choice as a grant input. The open **payload** channel is explicitly
*not* under this law: it is governed by the host-owned OQ11 denylist (ADR-0003),
which the manifest declares and discloses but does not attenuate by ceiling.

**Declaration stays static and up-front** (as `ConnectorManifest` already is —
"read by the orchestrator before any event is routed"), not iOS-style
request-at-first-use. The orchestrator builds the projection snapshot slice and
routes events *before* the chamber runs, and the `postMessage` boundary (AD-4,
no SharedArrayBuffer) makes a synchronous mid-map capability request expensive;
a known-ahead read/post set is the fit and is what the current contract assumes.

**What the endpoint ceiling actually defends (and where it is grounded).** The
send-side ceiling addresses **foreign-sink exfiltration** — a supply-chain-
compromised connector beaconing stolen data to an attacker-controlled domain (the
Magecart pattern). It is a per-connector `connect-src`. Its grounding is **uneven
across the two connector archetypes, and the ADR must not overstate it**:

- **Wire-protocol connectors with a fixed endpoint (GA4) — but be precise about
  what the flip adds.** GA4 posts to one known Measurement-Protocol URL, so its
  declared set is trivially bounded. The foreign-sink defense itself — a tampered
  GA4 build cannot beacon to an attacker domain — is **already provided by
  ADR-0004's host-owned seal allow-list**, which blocks any non-allowlisted
  destination for *every* connector regardless of what it declared. What flipping
  `endpoints` advisory→authoritative adds on top is only the `∩ declared` term:
  per-connector *cross-endpoint* confinement (connector X cannot post to connector
  Y's allowlisted sink). For **GA4 alone that delta is ~zero** (its declared set
  equals the host set), and even at 2-connector MVP2 it is low-value against the
  *exfil* threat — both endpoints are legitimate vendor servers, not attacker sinks
  the host list doesn't already block. So the honest MVP2 justification for the flip
  is **forward-compatible least-privilege** (establish declaration-as-ceiling now,
  ADR-0003-style, so per-connector confinement is structural before the Nth
  connector lands and the host list becomes a broad union) **plus disclosure** —
  *not* present-tense GA4 hardening, which is ADR-0004's already-shipped job.
- **Wrapped-SDK CDP (Alloy) — *unproven*, not narrow-by-evidence.**
  [R-004](../research/R-004-alloy-in-worker.md) observed a *single* `fetch` to
  `adobedc.demdex.net/ee/v1/interact`, **but that is a probe artifact**: R-004
  stubbed `fetch` with a faked Edge response and ran offline, and its own open
  questions list live *cluster routing* and *third-party `demdex` sync* as
  un-probed. Real Alloy does **server-directed** ID sync — the Edge response
  returns the partner sync-URL list the SDK then fires — so those destinations are
  dynamic, unknowable at manifest-authoring time, and *cannot* be expressed in the
  static up-front declaration; trusting the connector's own server to supply them
  would gut the ceiling against a compromised connector. So endpoint-narrowness for
  Alloy is an **open question gated on a live-Alloy endpoint-breadth probe** (kill
  criteria), not established fact. (Read-breadth and endpoint-breadth remain
  different axes — ADR-0003's broad-*read* finding does not by itself decide
  endpoint breadth — but that argument only defends *"unproven,"* not *"narrow."*)

Two further limits bound the claim even where the ceiling holds: it does **not**
stop exfiltration through the connector's *own* legitimately-declared endpoint (a
malicious vendor, or PII packed into the legitimate beacon — the OQ11 payload
denylist's job), and for a *trusted* first-party connector its everyday value is
disclosure + defense-in-depth (the foreign-sink teeth bite only if that
connector's own shipped code is compromised).

Staging (MVP1 shipped, so this is MVP2+):

- **MVP2 — the intersection law + the send-side teeth.** Flip `endpoints`
  advisory → authoritative (egress *destination* ceiling enforced at the seal, an
  existing chokepoint); keep projection reads as-is (ADR-0003 is already this
  law); resolve the cookie/storage grant as the same declared∩granted intersection
  (OQ13 item 4); stand up the grant resolver so consent/user-choice (ADR-0007) can
  feed it. Harvest the disclosure/label surface. **This does not close the payload
  read door** — the destination ceiling constrains *where* a chamber posts, not
  *what* it packs into a legitimately-declared endpoint, so payload-PII governance
  waits on the OQ11 denylist below. **Archetype split (honest):** at MVP2 the
  endpoint ceiling's value for GA4 is **forward-compatible least-privilege +
  disclosure, not present-tense hardening** — ADR-0004's host allow-list already
  blocks foreign sinks, and `∩ declared` adds only per-connector cross-endpoint
  confinement (~zero delta for GA4 alone; see Recommended Decision). For a
  *broad-need CDP* (Alloy) the three governance channels can fail *together* —
  projection reads
  collapse toward default-allow (ADR-0003 kill criterion), endpoints are
  server-directed/probe-gated (kill criteria here), payload is outside the law
  (OQ11) — so the intersection law's net attenuation for a CDP approaches
  cookie/storage name-scoping plus (archetype-scoped) disclosure until the OQ11
  denylist and the live-Alloy probe land. So MVP2 is "least privilege becomes
  structural" for wire-protocol connectors, *not yet* for the CDP.
- **MVP3 — the primary read channel + user choice.** Add the host-owned payload
  denylist once OQ11 fixes it (coupled to OQ3's schema; only a pinned schema could
  move the payload toward field-level declaration), and the end-user
  per-tag/per-data choice surface (the "user choices" horizon: UI + persistence).
- **Coupled decision (own ADR):** upgrade AD-9 consent from binary to
  purpose-dimensioned (Consent Mode / TCF-style purposes) so a grant resolves
  per declared I/O. This is the one piece that needs a human product call before
  the consent half of B is real; flagged in Open questions.

## Consequences

**Becomes easier:**
- Least privilege becomes structural on the bounded channels: a compromised
  chamber receives only its declared-and-granted *projection* reads and can post
  only to its declared-and-granted *endpoints*. This is real, but partial — an
  endpoint ceiling stops a chamber reaching an *undeclared* destination, not a
  chamber exfiltrating PII through its own legitimately-declared collection
  endpoint (the payload). Full both-door symmetry is the MVP3 target, reached only
  when the OQ11 payload denylist lands; this ADR does not claim it at MVP2.
- The OQ9/OQ11/OQ13 cluster gets one home: each becomes a declared section of the
  manifest, reviewable as one contract — though the *enforcement model* differs by
  section (intersection law for the bounded channels, denylist for the payload).
- A privacy/data-flow label is derivable from the manifest union — the inspector's
  (OQ7) data-flow view and a compliance surface. **Its completeness is
  archetype-scoped, exactly like the ceiling:** for wire-protocol fixed-endpoint
  connectors (GA4) the manifest *is* the complete egress map; for a server-directed
  CDP (Alloy) the manifest is a **floor, not a complete map** — it cannot enumerate
  the sync destinations the Edge response returns at runtime, so a compliance-grade
  label there must fold in *runtime-observed* egress, not manifests alone. A
  pure-manifest label would under-report exactly the connector where disclosure
  matters most, so the ADR must not claim manifest-union completeness for a CDP.
- Consent and (eventually) end-user choice have exactly one insertion point.

**Becomes harder:**
- Every connector authors and maintains a fuller, now load-bearing manifest;
  declared-vs-actual drift must be caught (lint at MVP1 first-party; enforcement
  backstops it at MVP2).
- The runtime needs a grant resolver and a host-policy home, and denial must be
  first-class: a denied read or an undeclared/denied post is a **held-at-seal-
  with-reason** event surfaced through the spec 009 diagnostics seam, never a
  silent drop and never a chamber-killing throw.
- The ADR buys the *frame*, not the two hard policies inside it (OQ11 payload
  model, AD-9 consent-purpose model); those are still owed.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- The declared→granted split, the `reads`/`endpoints`/`capabilities` fields, and
  the "endpoints advisory; host allow-list wins" semantics are **verified** by
  reading [`contracts/connector.d.ts`](../../contracts/connector.d.ts) and
  [`contracts/capability.d.ts`](../../contracts/capability.d.ts) at this ADR's
  date, not assumed.
- Making `endpoints` authoritative is **more than a filter at an existing seam**,
  and the ADR should not frame it as free. (1) There are **two** egress seams:
  ADR-0004 dispatches via the worker-mapped main-thread path **and** a synchronous
  main-thread fast path (`pushCritical` / `visibilitychange` ring-tail flush); per
  OQ16 the fast path is not routed through the worker's guarded `mapBatch`, and per
  OQ12 item 4 `pushCritical` bypasses the log/projection — so the ceiling must bind
  at both, and the fast-path seam lacks isolation (OQ16). (2) The pinned
  `EgressRequest` ([`contracts/connector.d.ts`](../../contracts/connector.d.ts))
  carries **no connector/chamber id**, enforcement is at the main-thread seal, and
  per-connector attribution has never been exercised (MVP1 is single-chamber).
  Threading connector identity to the seal on both paths is a **data-flow change**,
  not a filter insertion. The projection snapshot read filter *does* ride ADR-0003's
  existing per-cycle build (that part is genuinely cheap). The egress-ceiling filter
  is **not yet implemented** — a design assumption about where it lands, not a claim
  it exists.
- Fails-closed on the read side depends on ADR-0001's per-chamber isolation
  upgrade landing with the first wrapped-SDK connector; a shared-worker chamber
  can read a sibling's granted snapshot from shared memory. Same dependency
  ADR-0003 already carries.
- Consent dimensioned by purpose is **not** in the codebase today (AD-9 is
  binary). The consent/user-choice half of the law is therefore an assumption
  pending that upgrade; the host-policy half stands without it.

## Kill criteria

- **The one enforced MVP2 door doesn't constrain the real threat.** MVP2 enforces
  the send-*destination* ceiling, but the stated MVP2 threat is a compromised
  wrapped-SDK chamber (alloy) exfiltrating payload PII through its *own
  legitimately-declared* endpoint — which the destination ceiling does not stop.
  If that is the threat that matters, MVP2's manifest teeth are
  disclosure-plus-endpoint-hygiene, not exfiltration defense, until the OQ11
  payload denylist lands — the signal to **sequence OQ11 with (not after)** the
  endpoint ceiling, or to state plainly that MVP2 hardens destination + reads and
  defers payload-exfiltration defense to MVP3.
- **A connector's egress is server-directed, or its declared *endpoint* set
  approaches a wildcard.** Read-breadth alone does not collapse the ceiling, but two
  things do, and live Alloy may exhibit both: (i) *server-directed* destinations —
  Alloy fires third-party ID-sync URLs returned by the Edge response (demdex /
  Audience Manager) that a static up-front declaration cannot enumerate, and that
  R-004's offline probe suppressed by faking the network; (ii) a legitimately broad
  endpoint set. Either drives the ceiling toward vacuous/disclosure-only (Option C)
  for that connector. **This couples to the host-configured-egress criterion below:**
  the origin/template coarsening that keeps deploy-time URLs working is the *same*
  move that widens the set toward a wildcard — and the ADR does **not** yet ground
  that a granularity exists in the sweet spot between "too rigid for real deploy-time
  URLs" and "too coarse to constrain a compromised connector." Resolve by measuring
  live-Alloy endpoint breadth before committing the CDP endpoint ceiling; the
  wire-protocol ceiling (GA4, fixed endpoint) is unaffected. (The separate
  read-breadth collapse is the ADR-0003 snapshot concern, resolved with OQ11.)
- **Consent cannot be dimensioned by purpose.** If the AD-9 upgrade proves
  infeasible, the consent/user-choice grant dimension collapses to a global
  on/off and the "selectively gated" payoff is limited to egress on/off. The
  host-policy attenuation half still stands; the consent half defers.
- **Authoritative `endpoints` breaks host-configured egress.** If real
  connectors must post to a collection URL configured by the site at deploy time
  (unknown when the manifest is authored), a literal-endpoint ceiling is too
  rigid — revisit declaration granularity (declare an origin or a parameterized
  template, not a literal) rather than reverting `endpoints` to advisory. **Resolve
  jointly with the server-directed/wildcard criterion above** — the coarsening that
  fixes this one is what can vacate the ceiling there; a granularity that satisfies
  both is assumed, not yet shown.

## Open questions

- **Consent-purpose-keying (needs a human call).** Upgrade AD-9 from binary to
  purpose-dimensioned so a grant can be resolved per declared I/O. Its own ADR;
  the gating dependency for B's consent half.
- **OQ11 payload-read policy** (allow vs deny model; coupled to OQ3 schema) — the
  manifest section that governs the primary read channel.
- **MVP2 sequencing: endpoint ceiling vs OQ11 payload denylist (needs a
  release-planning call).** The endpoint ceiling's present-tense security value is
  ~zero for GA4 (ADR-0004's host allow-list already covers foreign sinks) and its
  real value is forward-compat + disclosure; meanwhile MVP2's actual exfil threat is
  payload-PII through a connector's *own* declared endpoint (Kill #1 → OQ11). So
  should MVP2 **pull OQ11 forward** as the headline exfil-defense deliverable and
  treat the endpoint ceiling as forward-compat scaffolding, rather than sequencing
  the ceiling first? This ADR surfaces the fork; the release plan settles it.
- **End-user per-tag / per-data choice surface** — the "user choices" horizon;
  UI + persistence; MVP3+.
- **Endpoint declaration granularity + live-Alloy endpoint-breadth probe** —
  literal URL vs origin vs parameterized template (to accommodate host-configured
  collection URLs), and whether a single granularity satisfies both that and the
  anti-wildcard constraint. **Gating for the CDP endpoint ceiling:** measure live
  Alloy (real Edge, cluster routing, demdex / Audience-Manager server-directed
  sync) to learn its true endpoint breadth — R-004's single-endpoint result was
  offline/faked. Whether server-directed sync destinations can be ceiling'd at all
  (vs a dynamic host-mediated sync allowlist) is open.
- **Grant resolver + host-policy home** — where in `core/` they live and how
  consent/user-choice state is threaded in.
- **Manifest/behaviour drift detection** — lint declared-vs-actual at MVP1
  (first-party); enforcement is the backstop at MVP2.
- **Relationship to OQ9** — the fails-closed guarantee presumes per-chamber
  isolation strong enough that attenuation is real; this law and the MVP2
  isolation model must be settled together.
