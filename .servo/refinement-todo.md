# Refinement TODO

Open decisions servo couldn't infer from your project. Each has a resolution trigger — the moment in your workflow when you'll know enough to close it. Mirrors jig's refinement-todo format.

---

## ~~Threshold~~ — RESOLVED 2026-08-27

**Deferred:** default `THRESHOLD=0.5` chosen by servo without project-specific data.

**Resolution trigger:** first time the oracle gate misfires — edit the `THRESHOLD` default at the top of `oracle.sh` to match observed quality.

**Resolved (spec 007-01):** set to **`THRESHOLD=1.0`**. The servo-unattended gate
is a logical **AND** of binary (1.0/0.0) hermetic checks — `composite == 1.0`
iff every component passes, so any single `0.0` fails. This was pre-empted by
spec 007 frame-critique (a weighted mean at 0.5 would let a broken hermetic
check pass, diluted by other passing components), not by a live misfire. The
binary-components-only invariant is documented at the `COMPONENTS` array in
`oracle.sh`; the full rationale (with the rejected weighted-mean alternative)
lands in the "servo oracle design" ADR authored during spec 007-03.

