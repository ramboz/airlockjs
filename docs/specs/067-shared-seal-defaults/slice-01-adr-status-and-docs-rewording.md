---
status: DONE
dependencies: []
last_verified: 2026-11-13
---

## Slice 067-01: ADR status lines and docs rewording

**Goal:** Nobody reads a "minimized by default" claim as current. Each ADR that ADR-0062 amends or supersedes says so in its Status section, and the three docs places ADR-0062's table names are reworded.

**DoR:**
- ✅ ADR-0062 is Accepted (b486cfb9). Its "Existing decisions" table lists every row and disposition.

**Acceptance Criteria:**

1. ADR-0003, ADR-0004, ADR-0006, ADR-0007, ADR-0012 and ADR-0013 each carry a status line under `## Status`, after the existing "Accepted (date)" line. The line says "Amended by [ADR-0062](./adr-0062-stock-default-parity.md)" or "Superseded in part by ADR-0062", matching the row's disposition, and names the affected clauses. The ADR's own `status:` frontmatter stays `Accepted`. Dispositions:
   - ADR-0003: amended (stock-read context travels on the new channel; snapshot stays default-deny); the broad-need collapse risk (:49-58, :160-165) is superseded.
   - ADR-0004: amended (keepalive budget and capture ring no longer drop stock output by default; default allowlist contents follow ADR-0062 point 7).
   - ADR-0006: amended for endpoints and cookie/storage (default grants the stock set; name-scoping is an opt-in narrowing). Projection and consent terms unchanged.
   - ADR-0007: amended in scope (:105, the hold also covers a site with no consent input, with a diagnostic warning).
   - ADR-0012: superseded in part (the ambient-context boundary note at :82-83, :196-199). The built-in denylist stands.
   - ADR-0013: superseded in part (the read-minimized claim at :24-30; the "already minimized" reason at :66-71, :89-93 is amended; the seam drop at :79-84 is amended to hold-and-warn).
2. `docs/architecture.md:90` (projection snapshot definition) and `:154` (OQ4) are reworded: the snapshot stays default-deny, and stock-read context travels on a separate host-collected channel (ADR-0062 point 2). The word "privacy-filtered" no longer implies the snapshot carries stock context.
3. `docs/refinement-todo.md:374-376` no longer says Alloy is "read-minimized by construction" as a current fact. It says the claim was superseded by ADR-0062 and names the follow-up slices (067-08, 067-10).
4. Only the rows the ADR-0062 table lists as amended or superseded are touched. Rows marked "Unaffected" (ADR-0012:108-116, ADR-0022, ADR-0023, ADR-0024, ADR-0020, ADR-0039, refinement-todo:97-100, :507) get no edit.
5. ADR-0062's own "The accepted ADRs are not edited here" paragraph is left as is, and a one-line note under it says the status lines landed in spec 067-01.
6. `docs/specs/README.md` lists spec 067 and its ten slices.

**DoD:**
- Docs-only. `npm test && npm run lint` and the servo quality-gate pass (unchanged by docs).
- `rg -n "ADR-0062" docs/decisions` shows a status line in each of the six ADRs.

**Consumers:** none directly. It is a reading aid for every vendor slice.

**Anti-horizontal-phasing check:** Single-purpose docs slice with no code layer.
