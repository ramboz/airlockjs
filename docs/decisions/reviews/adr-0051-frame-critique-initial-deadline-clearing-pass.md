---
adr: 0046
pass: frame-critique
verdict: pass
reviewer: gpt-6.1-sol
reviewed_at: 2026-11-05T01:26:48Z
prompt_source: coordinator-supplied same-reviewer initial-deadline clearing backedge
reviewed_checkpoint: 5b57ff8efbde6576391728cee41c3db33ed9c14f
---

<!-- BEGIN VERDICT -->
reviewed_checkpoint: `5b57ff8efbde6576391728cee41c3db33ed9c14f`
parent_checkpoint: `868c4a82766523e459febdab3a86e4ad5aa321d3`
actual_completion_utc: `2026-11-05T01:26:48Z`
model: `GPT-6.1 Sol (gpt-6.1-sol)`
scope: Same-task FRAME clearing backedge. Read all four amended documents completely from frozen Git objects, their coupled amendment delta, and the canonical adverse record plus its immutable copy. All four supplied SHA-256 values match. The candidate commit changes exactly six documentation files; no implementation was reviewed.
own_checkout: Clean before and after, unchanged at `47c9511500bdb9054a505d4df49430d5b897fb9a`, parent `27978b45aeee75733ae72163c8105270e4169699`. Reviewed Git object `5b57ff8efbde6576391728cee41c3db33ed9c14f` was not checked out. No writer worktree or WIP inspection occurred.

VERDICT: pass

REASONING:
The first-read omission is resolved: the controller obtains its initial bound from fixed trusted invocation arguments before filesystem access, then validates the bounded bootstrap records without allowing their contents to extend that bound. The strongest remaining attack is an incorrect supplied timestamp, whose consistency cannot be established against an unread job in advance. The proposal explicitly places those initial values inside the selected owner/coordinator trust boundary and requires mismatches to stop before operational release, rather than claiming independent pre-read authentication. This is a concrete source frame without a new circular dependency for discovering the first deadline; native success remains unqualified.

SPECIFIC ISSUES:
- **Resolved primary assumption: the controller can know an enforceable initial deadline before reading deadline-governed files.** Contract lines 98–161 now specify the initial arguments, filesystem-free parsing and lexical path restriction, checks before and after controller filesystem steps, and a bootstrap limited to the fixed job/allocation custody reads. The bounds are 128 filesystem steps, 262144 bytes per file and 524288 bytes total. Job/plan bindings must then agree without widening the initial bounds. START uses the earlier expiry/hard stop; STOP takes no START-expiry argument and uses the hard stop. This addresses the actual `01:17:44.118Z` backedge. No blocking frame issue remains on the reviewed amendment.

RECONCILIATION NOTES:
- **Trust and startup boundary:** Initial timestamps are consistency inputs supplied by the already-trusted operator, not bearer authority or independent authentication. Do not claim that software proves their correctness before reading the records. The Node startup/module-loader and OS exclusions do not waive controller-initiated validation reads or admit arbitrary/private historical paths. The proposal adds neither a general reader nor an issuer/platform.
- **Descriptor eligibility:** Before job/plan binding, close is allowed only before the initial cutoff for a descriptor already obtained and verified before it. A late or unverified bootstrap open gains no retrospective close authority. Post-cutoff descriptor cleanup requires binding plus validation of the separately approved future allocation and exact decision acceptance, and remains limited to eligible retained handles under the finite cleanup bound. Late/unobserved completion and OS/GC timing remain UNKNOWN. No publication, write, sync, rename, lock removal or browser/SDK operation is added after its cutoff.
- **Preserved prior frame:** Complete browser-tree identity remains separate from JavaScript/package pins, with derived-root, ancestor/link/environment checks, explicit trusted OS/Node baseline and honest post-verification race limits. Consumed-case STOP checks immutable manifest/job bindings without requiring the launched browser tree to remain unchanged. The amendment does not alter those clauses.
- **Stop, deadlines and controls:** Full 45+10 fit, pre-effect charging, START-only freshness, consumed-case STOP before the hard stop, actual retained-handle closure, real unresolved-launch control two, positive control-one prerequisite and no retry remain intact. Producer loss or unconsumed stop remains UNKNOWN. The three publication-guard source/test files are unchanged from the previously verified `47` checkpoint, preserving the reviewed `46bffba5` subset.
- **History and authority:** The canonical adverse record and immutable initial-deadline copy are identical Git blobs and faithfully contain the actual prior backedge. This new pass applies to `5b57ff8...`; it does not rewrite either historical verdict on `47`. ADR-0051 remains Proposed. Exact acceptance, source safety reviews, real owner readiness and separately approved finite physical/cleanup allocations remain future gates. R1, old C FAIL/UNKNOWNs, original AC6/7 and public run/retry quarantine are unchanged. This is no SourceSafety or native qualification verdict.
- **Effects:** Only bounded read-only own-Git, hash and clock inspection was performed. No file edits, checkout/reset, tests, lifecycle changes, cache/probe inspection, browser/SDK execution, Adobe/network effects, or agents were used.
<!-- END VERDICT -->
