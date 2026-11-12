# Spec-oracle plan — 060-10

- **Source spec:** `docs/specs/060-meta-pixel-full-compatibility/slice-10-event-correlation.md`
- **Source hash:** `sha256:1ed428d2497b92e42073ccf46438d7669143cdbca0f8a60583f85bff4efeec26`
- **Planner version:** 0.1.0
- **Generated:** 2026-11-05T16:53:53Z

> Proposed blocker-only preparation. No full native completion executor or approval exists. Every numbered criterion has deterministic evidence obligations, including wire, state and negative controls. Missing approved case-bound references or executors stay unavailable; no placeholder command is supplied.

## Deterministic obligations

| AC | Source line | Obligation and current availability |
|---|---|---|
| AC-060-10-1 | 26 | Browser `eventID` reaches native-equivalent `eid`/other observed encoding through actual chamber and host. Compare track fourth-argument and trackSingle fifth-argument options as documented; custom-event/single-custom options require their own observed native semantics, not argument guessing. **Executor and qualified reference: unavailable.** |
| AC-060-10-2 | 30 | Matching and mismatched event name/ID/Pixel relationships to the existing CAPI `event_name`/`event_id` are preserved. Same-input first-party/identity values remain consistent across channels without changing native hash rules. **Executor and qualified reference: unavailable.** |
| AC-060-10-3 | 33 | Correlated actual browser/server dispatch, response and available backend deduplication/merging evidence are recorded separately, with browser-first, server-first and mismatched controls. The documented 48-hour window and any delayed case require their own finite plan; simulated clocks cannot stand in for real backend-window evidence. **Executor and qualified reference: unavailable.** |
| AC-060-10-4 | 38 | Repeated browser-only and server-only sends, with and without explicit IDs, retain native source-specific behavior. Do not suppress two browser calls because cross-source deduplication exists. Distinguish transport retries and automatic/manual duplication from one logical event. **Executor and qualified reference: unavailable.** |
| AC-060-10-5 | 42 | Where applicable, native `fbp`/`external_id` fallback and ordering semantics are observed using authorized values; no fallback becomes a substitute for missing browser ID/path behavior or matching efficacy. **Executor and qualified reference: unavailable.** |
| AC-060-10-6 | 45 | Alter target/name/ID, duplicate a conversion, remove the browser send, change an identity relationship and withhold a receipt. Each control fails or becomes inconclusive under C1-C9; presence-only/redaction equality and a successful server response cannot qualify browser parity. **Executor and qualified reference: unavailable.** |
| AC-060-10-7 | 49 | The operator sees request/event correlation, actual counts and unavailable deduplication evidence without public identifiers. The replacement remains fully browser-capable with no new ambient egress or CAPI credentials in page code; later lifecycle integration must preserve these relationships. **Executor and qualified reference: unavailable.** |

## Cross-cutting promises

C1-C9 apply to every numbered criterion. See `coverage.md` for the full source-backed obligations and layer boundaries.

## Report-fidelity review

No text judge is proposed for this journey. Evidence truth and policy decisions remain outside a text evaluator.

The existing operator synthetic controls cover selected attempt-level mutations only. Equal or failing synthetic data never qualifies a native reference or completes a product criterion.
