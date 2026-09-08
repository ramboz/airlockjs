---
status: DRAFT
dependencies: [adr-0018]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)

**Goal:** Ship the vendor-generic parity-harness pipeline (capture → replay → oracle → report) with its **same-protocol
beacon-diff** oracle, proven end-to-end on **Meta Pixel** from a redacted fixture — the thinnest vendor to exercise it,
since spec 026's GET connector already provides the replay.

**DoR:**
- ✅ spec 026 Meta Pixel connector exists — `connectors/pixel/connector.js` `createPixelConnector(config).handle(evt)` →
  `{ url, method: "GET" }` (`connector.js:149`, grounded).
- ✅ A capture source exists — `rig/lh-r010.mjs`'s network-log recon (2026-09-07) extracts the container's Meta beacon.
- ✅ ADR-0018 §"What parity means" pins the oracle as semantic-at-the-vendor-boundary, not raw URL equality.

**Acceptance Criteria:**

1. **Redaction → fixture.** A capture/redaction step turns a container Meta beacon (from a network log) into a
   **redacted fixture**: field vocabulary + synthetic values only. A test asserts **no live-identifier shapes survive**
   (Meta pixel id, `ud[...]`/`hme` hashed match, `cid`) — the fixture carries `id=<synthetic>` etc. (ADR-0018 R5).
2. **Replay.** Given the fixture's logical event, the harness runs `createPixelConnector(metaConfig).handle(evt)` and
   captures airlock's Meta beacon URL (observable: the built `{url, method}`).
3. **Same-protocol oracle.** The oracle **normalises** the documented nondeterministic fields (cache-buster, timestamps,
   `rdp`, ordering) then **diffs the attribution-bearing param set** of container-vs-airlock beacon, returning either
   `pass` or a field-level diff object naming each divergent field and its two values.
4. **Report.** The verdict renders as JSON (mirroring `lh-r010`'s report shape): `pass | diff`, the per-field diff, and
   the fixture provenance — no live identifiers in the output.
5. **End-to-end entrypoint.** A rig entrypoint (an `npm run` script, e.g. `parity:meta`) runs fixture → replay → oracle
   → report and exits non-zero on a parity diff — one command, one verdict.
6. **Vendor-generic by construction.** The Meta specifics — endpoint, the attribution-bearing field set, the
   normalise-denylist — live in a **per-vendor descriptor**, not hardcoded in the pipeline; adding a second GET-pixel
   vendor is a new descriptor + fixture, zero pipeline change (demonstrated by a second vendor's descriptor in a test).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Coverage exercises each AC with at least one fixture; the redaction test (AC1) and a deliberate-divergence fixture
      (AC3 returns a diff, not a false pass) are both present.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` subagent (compliance + craft; **arch** — this slice defines a new rig module boundary, so
      set `arch_review: true` if the harness introduces a public helper surface).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated if any decisions were deferred.

## Assumptions

- **The Meta attribution-bearing field set is the central risk.** Which Meta params "count" for parity (`id`, `ev`,
  `dl`, event/custom-data params) vs which are nondeterministic noise is grounded from spec 026's `PixelVendorConfig`
  and a redacted capture — but getting this set wrong yields a *false pass* that hides a real attribution loss. The
  frame-critique targets this set. (This is why `frame_review: true`.)
- **Advanced-matching (POST/`ud`) is out of this slice** — Meta's GET pixel only; the POST/advanced-matching shape is
  spec 026-04 (un-deferred separately). The oracle here judges the GET beacon.

**Anti-horizontal-phasing check:** After this slice a developer runs one command against a redacted Meta capture and
gets a parity verdict (pass or a named field diff) — the full harness, end-to-end, delivering the first real
vendor-boundary parity check.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
