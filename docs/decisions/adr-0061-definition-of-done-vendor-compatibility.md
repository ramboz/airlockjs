---
status: Accepted
dependencies: [ADR-0038, ADR-0039, ADR-0040, ADR-0046, ADR-0047]
last_verified: 2026-11-12
frame_review: true
---

# ADR-0061: Definition of done for vendor compatibility work

## Status

Accepted (2026-11-12)

Partially supersedes ADR-0038, ADR-0039, ADR-0040, ADR-0046 and ADR-0047 (clauses listed under Recommended Decision). Everything else in those ADRs stands.

## Context

Slices waited on live vendor proof and on per-run approval gates (browser runs included), and vendor inventories could keep growing, so five weeks of verification harnesses and process documents produced almost no product code. This ADR fixes what "done" means for vendor compatibility work so slices can finish: fixtures per slice, one live check per release, and a frozen inventory per pinned vendor version. Owner decisions of 2026-11-12 (also: capture once per vendor at freeze time; test identities so fixtures commit unredacted; Google/Meta frozen as script plus remote config pair): "Recorded fixtures per slice, live check per release"; "Keep full parity as the v1.0 bar"; "Freeze the inventory per pinned tag version; later discoveries go to the next version"; "just follow the jig ceremony for each".

## Decision Options Considered

### Option A: Keep live proof per slice and an open-ended inventory
- **Pros:** Strongest per-slice evidence.
- **Cons:** Needs vendor access, entitlements and time for every slice; the inventory never closes. This produced harness and process work, not product. Rejected.

### Option B: Lower the bar to a curated subset
- **Pros:** Finishes fastest.
- **Cons:** Gives up full parity, which the owner keeps as the v1.0 bar. Rejected.

### Option C: Same bar, finite inventory, fixture-based slices, live check at release
- **Pros:** Slices can be finished and reviewed offline; parity becomes a finite, countable list.
- **Cons:** A fixture can drift from the live vendor between releases. Chosen.

## Recommended Decision

Adopt Option C.

1. **Source of truth.** A slice is proven by recorded real-tag request/response fixtures, never synthetic ones. Each vendor gets one capture session at freeze time covering its whole frozen inventory. Each state is recorded from one base setup, a same-setup repeat, and one-factor-at-a-time variants of the base: viewport, locale/timezone, referrer, fresh versus returning profile and, for Google and Meta, egress region (one EEA and one non-EEA exit). The captures are agent-scripted, so the extra recordings are cheap. Identity fields (fbp, fbc, auid, ECID) get a rule covering both the fresh-profile and returning-profile case. Generated-value rules thus rest on repeated evidence (ADR-0040 item 3, R-015:318-320). The owner provides or approves the EU exit (VPN or proxy). Egress region matters because `dma` is a geo-derived regulatory flag (R-009:141-149; rig/parity/descriptors/google-ads.js:34-40; ADR-0026:35-37 on geo-degraded probes). Every fixture stores its full input state (URL/referrer, viewport, locale/timezone, egress region, browser version, profile kind, storage/cookies before and after; R-015:312-316, :454); offline replay feeds exactly those inputs to the chamber, which is what ADR-0040 item 2's "equivalent inputs and browser state" requires. Slices then work offline. Agents re-run the scripted test-only capture for any missing state that needs no settings change; only settings changes need an owner session. Live vendor checks run once per release and verify the fixtures still match; they are not where new fixtures come from. Behaviour only visible live is tagged live-only in its inventory row and checked at the release check.
2. **Scope.** Full parity remains the v1.0 bar for each vendor: parity with the frozen inventory of that pinned version (with Google/Meta settings states).
3. **Finite parity.** Each vendor's inventory is frozen against a pinned version. Alloy: a version such as 2.31.1. Google and Meta: the captured script build plus the account-settings states that actually changed the tag's output. The inventory spec lists candidate settings (for example enhanced conversions or user-provided data, cross-domain and linker, automatic advanced matching, automatic event collection, first-party cookies) from a read-only probe or vendor docs, each with its triggering page input (form field, outbound link or click). The capture session toggles each one, and the inventory freezes after it. A candidate counts as "no effect" only if the check came after a propagation wait, the served config bytes were checked, and the triggering input was present. Full parity under ADR-0040 means across those states, not a named-profile subset. A change found later goes to the next version's inventory, unless it breaks a row the frozen version or states already cover; then it is fixed in the current version. A missing capture for a behaviour already in the inventory is a gap to fill now, not a next-version item.
4. **Process.** Each slice follows the standard jig ceremony: spec, slice, TDD, independent review, DONE. No extra authority or operational ADRs outside it.
5. **Identity rows and commit safety.** Captures use test identities and test click IDs, so fixtures can be committed unredacted and identity rows (_fbp/_fbc, gclid, ECID) can be proven offline. The owned test-account IDs (Meta pixel ID, Google Ads conversion ID, Adobe org and datastream IDs) may be committed: they are test accounts, and tag and pixel IDs are visible on any page that loads the tag. Captures use a fresh browser profile never logged in to a vendor, separate from any console session used for settings changes. A check before each fixture commit rejects vendor-domain login or session cookies and tokens, and VPN or proxy credentials. Private or real-user data is never committed.
6. **Standing approval for test-only runs.** Scripted captures with the rig toolkit and local browser tests need no per-run plan when they use only owned test pages, test accounts and test identities. This covers the vendor capture session (including agent captures routed through the approved EU exit), settings changes on the owned test accounts during it, local browser runs including actual chamber dispatch, and ADR-0047 item 6's browser admission checks run as tests. Owner sessions are only for settings changes and normal-browser captures; those use separate profiles never logged in to a vendor console, and point 5's check applies. Anything involving real-user data or production sites keeps the old gates.
7. **Sequencing and pilots.** A vendor's capture session runs before any of that vendor's slices start; that session plus the vendor's first slice is its pilot, and we count the captures the slice needed beyond the corpus before the rest of its slices. Owner decision, 2026-11-12: "Yes: during each capture session you do one normal-browser capture of a state agents also record, for comparison, plus a normal-browser try before any state is marked blocked". Before the freeze, every pilot compares the agent and owner normal-browser recordings of that state field by field; differences in fixed or generated fields go to the owner first. The Adobe pilot does not test the Google/Meta risk: Adobe runs the pinned open-source SDK, whereas Google and Meta are clean-room reimplementations so each gets its own pilot. Recorded fixtures decide correctness; field rules may also be read from the retained pinned script and its remote-config bytes, as ADR-0040 item 1 already allows. Before the freeze and before any slice, every derived field rule is checked against recordings not used to derive it: the second-day drift-probe loads plus at least one extra setup. The pilot thereby tests whether the rules are right, not only whether the corpus is complete. This is a coordinator decision, not an acceptance gate.
8. **Capture procedure.** Each session starts by recording at least one complete native beacon with its full request/response fan-out, using the exact capture setup (fresh profile; headed or headless stated). No state counts as captured before that. If a state yields no native traffic, try agent headless, then agent headed, then an owner normal-browser try; only if all three yield nothing is the state blocked and reported to the owner, never filled with synthetic data. Precedent: Meta's automated headless run "observed no beacon" and the beacon was seen only from the normal browser (ADR-0040:47-49, :48-50, open question at :224; R-014:1121-1150 classes HeadlessChrome as bot traffic; on branch vendor-meta-pixel, spec 060:104-112 and 061 slice-01:102-118).
9. **Browser scope.** Owner decision, 2026-11-12: "Desktop Chromium only for v1.0; everything else goes to the next version". v1.0 parity, every capture, every fixture and the release check use desktop Chromium only; Firefox, WebKit/Safari, iOS and in-app browsers go to the next version. EEA egress stays in v1.0; owner decision, 2026-11-12: "Capture from both an EEA and a non-EEA location; you provide or approve an EU exit (VPN or proxy) for the capture sessions, and EEA stays in v1.0". This answers the cohort-matrix question left open at ADR-0040:223.
10. **Drift and field classes (Google and Meta).** The first step of each capture session, before any state counts, is a drift probe: compare today's served script with the retained bytes (Google loader, R-015:37, 443,549 bytes, digest-checked 2026-11-05; Meta 058-02 bytes, spec 060, 2026-10-16), and load one state three times on the same day from one EEA and one non-EEA exit, recording which request fields differ. The probe repeats on a second calendar day (an agent-run follow-up). The inventory spec puts every request field in one class: fixed; generated, with its rule; input-derived, with its source input and rule; server-context-derived, with its source (egress region, served config or a response); or volatile (build or version stamps, experiment fields, timestamps), which covers only fields shown to have no relationship to any other value (cookie, storage, another request or a response); a timestamp or value that links to anything stays checked by rule (ADR-0040 item 3). A field that differs between setups, egress regions or days cannot be classed as fixed; if it is not explained by another class, the state is reported to the owner as unstable. Each request (endpoint presence, multiplicity, redirects) gets a request-level class: always, conditional with a rule, or volatile (ADR-0040 item 2: destinations, multiplicity and fan-out are part of the contract; Google fan-out completeness is still open at :224). Parity and the release check compare fixed fields exactly, generated, input-derived and server-context fields by their rule, and volatile fields only for presence and format. The release check also runs the chamber next to native in at least one setup and egress location not in the corpus. At release, a mismatch on a fixed, generated, input-derived or server-context field, or on a request that appears conditionally in a covered state, is fixed in the current version; a changed volatile field needs no action; new fields, and endpoints never seen anywhere in the corpus, go to the next version. This answers the drift-trigger policy left open at ADR-0040:223.
11. **Production behaviour.** The shipped Google/Meta chamber reads each customer's live config. On fields or config shapes outside the frozen inventory, or a server-context field taking a value not seen in the corpus, it surfaces a visible diagnostic, because assurance is stale; it does not silently drop data or auto-disable collection (ADR-0040 item 8). Exact per-field behaviour belongs to the slices.

**Partial supersession** (only these clauses; each is replaced by the points above):

- ADR-0038: "Establish the full inventory first" becomes frozen per version (point 3); "live acceptance" and "first live Adobe vertical proof" no longer gate individual slices (point 1). Item 7's carry-forward of ADR-0018 R5 ("local/redacted input discipline") is replaced for test-identity captures (point 5); it still applies to anything containing real-user or private data.
- ADR-0039 item 1: "fixture result ... alone cannot pass" stops applying to a recorded real-tag fixture compared with actual chamber dispatch; it still applies to synthetic or stub fixtures. Item 2's "record raw private evidence" may be committed when it holds only test identities. Items 5 and 7: "approved real Adobe calls prove that scenario" and "missing access ... remains a blocker" apply at the release check, not per slice. Its other clauses stand.
- ADR-0040 items 1 and 4: "Maintain a ... inventory" and "Unknown or missing behavior remains unfinished" apply to the frozen inventory; "Lack of access, traffic or a product observation blocks that claim" applies at the release check. Item 3 is not changed: with unredacted test identities no redaction sentinels are needed, and its value-meaning rules still apply.
- ADR-0046 item 7: "A new discovery gets an owner or a bounded blocker" applies only to discoveries inside the frozen inventory or ones that break an existing row; others go to the next version.
- ADR-0046 item 5: the "current permitted launch/stop/loss plan" and the "specific decision and run approval" for an owner-supervised exception are replaced by point 6 for test-only runs; the "production reference capture" scope stays for production.
- R-015's capture controls (line 129, "still needs permitted inputs, complete observation, provenance and an approved stop/cleanup plan"; lines 548-551, "Route: BLOCKED ... Owner operation waives none of these"): replaced by point 6 for test-only runs.
- R-015 lines 58-60 (the Meta test pixel "will not be modified unless requested"): point 6 is that request, for settings changes during the capture session only.
- R-015 line 41 ("Identifiers ... remain private"): the owned test-account IDs may be committed (point 5); raw captures with real or private data stay private.
- ADR-0040 line 223 (open questions: browser/version/cohort matrix, drift-trigger policy): answered by points 9 and 10. Spec 060:164-165 (branch vendor-meta-pixel), cohort part: replaced by point 9; the Meta inventory session rescopes that spec.
- ADR-0047 line 27, "Implementation remains paused; no test, browser or live authority follows": point 6 now grants that authority for test-only runs. ADR-0047's security requirements stay in force and become tests.

The rest of ADR-0046 and ADR-0047 is unchanged.

## Consequences

**Becomes easier:**
- Finishing and reviewing a slice without vendor access.
- Counting remaining parity work, since the list is finite.

**Becomes harder:**
- The comparator treats native values as exact and marks native-side rules `native_normalization_unsupported` (rig/native-tag-comparison.md:186-194). Field-rule support is shared toolkit work on main and lands before the first Google/Meta field slice.
- The capture session per vendor must happen up front and cover the whole inventory.
- Live-only behaviour must be tagged up front, or it is found late.

## Assumptions

- **Primary: the per-vendor capture corpus can be acquired.** The record says acquisition was the blocker: R-015 (lines 13-16, 64-66) records no credible route to a same-input native comparison, with Google's reference checkpoint stopped "without native admission" and Meta native-acquisition blockers; R-014 (1172-1194) shows Adobe live traffic blocked on expired approvals; R-016 (527) reads "Implementation: blocked". This ADR bets that one capture session per vendor, plus agent-run follow-ups, removes that blocker. The inventory can be incomplete when frozen (ADR-0040 says documentation alone does not prove completeness); the first carried check below measures that.
- Pinned versions can be frozen: R-014 SHA-pins Alloy 2.31.1. gtag.js and fbevents.js are evergreen and remotely configured, so for them the frozen unit is the script build plus enumerated settings states (point 3). Which settings change the served config is not yet known; the capture session finds out, and the inventory freezes after it.

## Checks carried into the inventory specs

The last frame critique still said needs-changes. I accepted anyway and these findings become checks in the vendor inventory specs.

- **Inventory completeness against real configs.** Before the freeze, compare the candidate inventory with the config shapes and setting combinations public sites actually serve (`gtag/js?id=` and `signals/config/<pixel>`). The out-of-inventory rate is the completeness metric and a kill criterion. Include at least one combined-settings state. This probe touches production sites, so the inventory spec gets my approval (point 6) before it runs.
- **Point 11 has no design yet.** Reading a customer's served gtag.js or `signals/config` in production needs a slice or an explicit scope decision. Today the only config path is adopter-supplied `boot(config)`.
- **Meta owner-only capture route.** If only my normal browser yields Meta traffic, the inventory spec sets a time-box, and stops the Meta work when it runs out. It also brings me a decision on whether slices may start on states already captured, which would change point 7.

## Kill criteria

- A vendor's capture set cannot be acquired: stop. Slices never close on synthetic fixtures.
- The drift probe or the same-day loads show fixed fields moving across most states, the served build changes fixed fields during the capture session, or the request set varies between loads without explanation: stop and report to the owner before any slice is built, because the frozen-corpus approach does not hold for that vendor.
- Derived field rules fail the held-out recordings and the corpus cannot explain why: stop and report to the owner before any slice.
- A vendor's inventory needs more settings states than one capture session can cover, or follow-up captures keep adding missing states after the pilot slice: revisit the freeze unit.
- A release check finds that fixtures no longer match live vendor behaviour in a way that breaks several rows: revisit the freeze unit and how often fixtures are refreshed.

## Open questions

None.
