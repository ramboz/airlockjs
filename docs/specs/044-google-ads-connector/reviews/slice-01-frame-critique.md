---
slice: 044-01 — core AW page-load beacon off-thread (Consent-Mode + auid, parity-confirmed)
pass: frame-critique
verdict: needs-changes
reviewer: general-purpose
reviewed_at: 2026-09-12T01:11:37Z
prompt_source: review.py frame-critique docs/specs/044-google-ads-connector/spec.md 044-01 <slice>
---

VERDICT: needs-changes (pre-implementation). All findings folded before this record.

- **[MAJOR — folded]** AC3's `auid` sourcing assumed `_gcl_au` is "host-sourceable exactly as GA4 sources `_ga`" — false in the load-bearing dimension. `sourceGa4Ctx` **mints** `_ga`→`cid` when absent (`connectors/ga4/cookies.js:119-121`; airlock owns an arbitrary analytics id), but `_gcl_au` is written by the Google **conversion-linker runtime** — the container tag airlock replaces (repo-wide: **zero** `_gcl_au` writers) — and R-009 §(c) read it only because the capture ran on the live *container-driven* `erp.intuit.com` page. On a rewired, container-removed page a pure read yields **no `auid`**; and because AC4's 038 oracle diffs a **synthetic** `auid` on both sides, the miss passes the lab gate green and surfaces only at the MVP9 live rewire (remarketing audiences don't populate). Strict analogue of the *named* `_ga_<stream>` gap (OQ13-2 / refinement-todo).
  **Fold:** AC3 reshaped to **read-when-present / omit-when-absent / NEVER-mint** (a fabricated `_gcl_au` is a garbage audience key); slice **A3** + spec **A5** name the `_gcl_au`-writer gap; a new **OQ13-b** refinement-todo item tracks it (MVP9-triggered); the spec Overview + reuse bullet corrected to "read half only, no mint." The slice now claims `auid` **shape/position** parity only — explicitly NOT identity-presence, which is an MVP9 question.
- **Confirmed holding (reviewer):** the reproducibility core (governed GET off-thread + Consent-Mode carriage) is well-grounded in R-009 §(b); **A2** (reuse of 039's `gcs`/`gcd` encoders — verified to exist in `connectors/ga4/gtag.js`) survives, with the ADR-0002 extract fallback honestly scoped; **A1** (parity-significant endpoint subset, deferred to the 038 oracle) is owned/note-level; the seal (017-03) is a 044-02 concern, not load-bearing for this granted-path slice.

Reviewer substrate: general-purpose subagent running the jig frame-critique rubric; read-only (Read/Glob/Grep), no authoring context; verified grounding against R-009 + `connectors/ga4/{cookies,gtag}.js` + a repo-wide `_gcl_au`-writer search.
