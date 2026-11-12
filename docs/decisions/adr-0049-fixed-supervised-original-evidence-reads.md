---
status: Superseded
dependencies: []
last_verified: 2026-11-02
frame_review: true
---

# ADR-0049: Fixed read-only original evidence for the supervised path

## Status

Accepted (2026-11-02)
Superseded by [ADR-0050](./adr-0050-evidence-independent-05109-source-checkpoint.md) (2026-11-02)

## Context

The supervised path needs historical evidence that belongs to a different
worktree.

The P-based worktree derives its private root from the executing checkout.
Historical records retain their original absolute references, so relocating
them or rebuilding their paths under the current root changes what those
records attest. The operator, preparation producer and assembler need the
same bounded read rule. This proposal preserves the historical bytes and
leaves current source, current evidence and all writes in the P-based
worktree.

The source baseline is P, `71ebdf308de11c262630634e25b497c558440936`.
The original role-to-path mapping and pins are section 1 of the approved
C plan, SHA-256
`3a7a2fb60458a96f831c426ba1eb67cb638003ebc3556f61dc8e9e988974895a`.
That plan is the precise mapping for this scoped decision; it does not
grant access to other files named by an original.

## Decision Options Considered

### Fixed read-only original roles

Read only the named, digest-pinned originals from the verified historical
sibling. This preserves provenance and limits the exception to the supervised
path. It requires the exact layout and protected originals to remain available.

### Rewrite or relocate originals

This would make existing current-root readers easier to reuse. It would also
alter or rebind evidence and its historical references, so it is rejected.

### Accept arbitrary roots or paths

A root or path override would support other layouts. It would widen the
boundary beyond the reviewed evidence and make a caller responsible for
custody, so it is rejected.

### Execute retained source

Running the historical checkout would preserve its original path assumptions.
It would execute a different source epoch from the reviewed P-based worktree,
so it is rejected.

### Build a general custody service

A reusable service could cover more evidence workflows. Its platform,
authority and operational scope exceed this one exception, so it is rejected.

## Recommended Decision

Select the fixed read-only original roles. The only historical root R is the
literal sibling
`resolve(ROOT, "../automatic-succotash")`, which must resolve to
`/Users/ramboz/Projects/misc/airlock/.worktrees/automatic-succotash`.
The one authorized current worktree W for this historical allowance is
`resolve(R, "../literate-broccoli")`. The actual executing `ROOT` must equal
that W, with safe canonical, non-symlink ancestry for both roots. Verify
these bindings before any preparation or retry reservation, current claim,
lock, journal, output or effect. A different layout or executing root blocks
the operation. Do not use
environment, command-line, job or other root overrides, parent scans,
realpath aliases or alternate source-root fallbacks.

All current consumption markers for this allowance live in the one protected
W location and are created atomically and exclusively. A second worktree is
not another consumption namespace, even if it reads the same originals and
has no local marker. Do not reset, relocate, recreate or clear the W
consumption namespace while the original allowance is unresolved. Copying or
recreating paths does not confer authority. A future W move requires an
explicit reviewed custody and consumption handoff; it must not automatically
re-arm the allowance. This rule adds no shared ledger, historical write,
resource or live permission. An author-supplied JSON field does not
authenticate the executing root or its identity.

The closed original-byte roles and SHA-256 pins are:

| Role | SHA-256 |
|---|---|
| Prior job | `4a1f1b6bea66a53d894beccb30e0935ae8ac1b405ec54a9acf62244eacaaccb8` |
| Prior claim | `bdba33940377dc166e58873285787da79ee8179c2f57bba42d6f8738e17a497e` |
| Prior terminal | `ec86687b984894cb4b30aeaa47066d6e0a847564ef7512cc6fc6660ff6f241fa` |
| Prior run journal | `1b6f49a8e8366f5591fc25b518045af1215f045d975c8b4e374da43c5201c054` |
| Prior stop journal | `9ff9add02507890b42ac6b70ebdff3686f3a9d2bd187533be2b33434dc42e8d6` |
| Retained state | `95ac983389860f7794f3958e2285f125a12dbb3d8c48854e38825c26a05677cf` |
| Retained plan | `a25e5dc9b0cc3bfb9a32f7b4866d7b2f4e6de4e543b1e42b19b9eb2aaeaf47a5` |
| Retained lock | `93d27db914f5799f8f1f0f7b4fe15aef98092de2c383fa52590584fbeacf5d4c` |
| Retained marker | `a64267702c9b0778bafef47e30dddc10497306c36501c74b9d86b2ff61d11ac5` |
| Checkpoint cost | `130cf32a155fc8ee37c35d632ac112b4a2a97779623d17d849d472c28515e921` |
| External-abort cost | `d580be2f24932a8e1a9b42f1ea1f801c3c18a89d466e6d594dd5a885e224ac28` |
| Original remaining cost | `97465e7279cf107fc58d570b816997be687833ef0c879a3225317e7ea1b99ee8` |
| Prior preparation cost | `23294425588cbd4c6190d907f7f72cdc2071382e2b008a36173428e33064aa78` |
| Prior complete spending | `5c65b6f95b0ea150ec7806605d42cfbd30136f1f52707728281bed6fb20e334c` |
| Prior preparation result | `35e0c4147f426723971fe9bf158c6de9c802e06c3ce706707cad4f979ab7f094` |
| Prior saved activity | `44978766f488a2cf3700c2d1d228a8c11ad25531fb7735c5b46cf79c17606b30` |
| Original deployment result | `8290a2c64ba48a176d27cf5a9132ddc0fcdcfd4414c6ca8b7c3b1bcfdbdb3613` |
| Extra verification reservation | `a048145760969984d4606f814eec55de5cd154786f48975063c1a72cc6b8fa27` |

Use the plan's exact fixed path for each role, including the two named
original one-use marker existence guards. Those guards refuse a newly
appearing old marker as well as a current W marker; they do not grant writes
to the historical root. No document can recursively grant access to another
path. A missing file, changed path or pin, unsafe custody, or mismatched
historical binding blocks the operation.

The operator owns a role-specific original-byte and JSON reader, with no
generic path or root input and no write operation. For each fixed role it
checks the exact path and digest, protected no-follow reads, ownership,
mode, link count, inode and parent path; it hashes bytes before strict JSON
parsing and verifies journal chains where applicable. When an input reference
is compared, its path and digest must both match the fixed role.

Apply that reader at the actual call sites:

- The prior-pair reader uses it for the five prior files, journal roots and
  old cost references, and compares historical retained references to the
  fixed roles and the new job.
- Job loading uses it only for the four retained originals and three shared
  historical cost roles for the fixed retry. Current preparation cost, job,
  preparation output, authority, setup, coordination, reviews, source and
  approval remain under W. Validate historical bindings before selecting
  that branch.
- The pre-dispatch retained-reference recheck stays narrow. The general
  current-root reader must not become an external-root reader.
- Retry reservation compares the unchanged original claim; any new marker
  is written only under W. Preparation and assembly use the same fixed
  reader for historical inputs, budget checks and provenance joins, without
  importing or executing historical source.

After consumption, `stop` remains independent of the historical prior
job, claim, terminal and journals. It checks the current protected job and
consumed claim and full reserved maxima under the same exact authorized
source and root. Admission's finite retained and shared-cost checks remain
protected; do not add a prior-journal dependency to `stop`.
Current evidence, executable source and every new write, including locks,
markers, journals and outputs, remain under W.

Imports remain inert. Root and consumption enforcement is an operational
gate before effects, not work performed at import time. Before qualification,
the implementation must demonstrate these regressions:

- Consumption in W1 blocks a concurrent second attempt in the authorized W.
- W2 cannot create claims or effects using the same fixed originals, even
  when its local markers are absent. Copied or recreated paths are not
  authority to create another consumption namespace.
- The independent `stop` invariants above remain intact after consumption.

## Consequences

**Becomes easier:**
- The operator, producer and assembler can check the same original evidence
  without rewriting its historical references.

**Becomes harder:**
- The fixed historical layout and all named originals must remain available
  and pass custody and digest checks. A moved or changed original blocks
  progress rather than falling back to another root.
- The authorized W and its protected consumption namespace must remain
  intact while the allowance is unresolved. Moving it needs a reviewed
  handoff, rather than a new local marker.
- The role table and actual call sites must stay aligned. This exception is
  not a general evidence-access API.

## Assumptions

- The approved plan records the original path mapping, observed pins and
  historical custody checks. These are historical observations, not proof
  that the inputs remain safe or available when later used.
- The reader and call-site changes described here are proposed and have not
  been implemented or qualified by this record.

## Kill criteria

- The fixed sibling, named paths, pins or protected custody cannot be
  verified without weakening the boundary.
- The supervised path requires additional historical access or writes outside
  W. That requires a separate decision rather than widening this exception.

## Open questions

- Independent frame review and acceptance of this Proposed text remain open.
- Source implementation, source review and qualification remain open.
  Current authority, Adobe setup, timing feasibility and live supervision
  are not established by this decision. Full 051-09 completion, prior
  spending and historical UNKNOWNs remain unchanged.

This ADR number is a local provisional allocation, not a shared reservation
or permission to land. It grants no SDK, case, resource or live authority.
