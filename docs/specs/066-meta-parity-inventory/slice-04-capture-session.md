---
status: READY_FOR_IMPLEMENTATION
dependencies: [066-01, 066-02, 066-03]
last_verified: 2026-11-13
---

## Slice 066-04: CAP, the Meta capture session

**Goal:** One capture session records the real fbevents.js tag in every inventory state (spec 066 sections 4 and 5), so every M-slice can be proven against recordings. It freezes the inventory.

**DoR:**
- Spec 066 approved by the owner as amended (O1). 066-01, 066-02 and 066-03 are done.
- Owner placeholders filled in (10.1): owned test pixel ID (O8), owned capture host URL, second owned test pixel ID (O9).
- Owner settings window booked: about 2.5 hours, same day as the Adobe window (O2). Adobe's second EEA egress up for the whole agent part (O3). The release-time third exit is not needed here.
- Owner-only route time-box agreed as 5 calendar days and at most 2 sittings of 45 minutes (O6). S1 is the normal-browser reference state (O7).

**Acceptance Criteria:**

1. Drift probe first (4.1), before any state counts: today's `fbevents.js` and `signals/config/<test pixel>` against the retained 058-02 bytes; one state loaded three times on one day from an EEA and a non-EEA exit; repeated on a second calendar day. Script digest recorded per manifest.
2. Positive control (4.2): at least one complete native beacon with full fan-out in the exact capture setup, via ladder headless, headed, owner normal browser, then `blocked`. Never synthetic.
3. Test identities, committable test pixel, fresh never-logged-in profile and the pre-commit credential check (4.3) are in place before the first capture is stored.
4. Each state in section 5 has base, same-setup repeat and an EEA recording, plus the S1, S2 and S4 Purchase one-factor variants and Google's escalation rule (4.4, O11). Each manifest has the full stored input state (4.6), `_fbp`/`_fbc` identity rules (4.5) and field and request-level classes with the unstable-state rule (2.4, 4.7).
5. The settings window follows spec 066 section 3.1: the owner confirms in Events Manager which SET8 items have a toggle before the first change (items without one are recorded as `config-only`, no state), then 8 to 11 states run one change per step, with the three no-effect conditions per state (section 3). The first wait measures W, and the changes that do not fit (3.1 formula) go to the O2 fallback window. The restore step reverts the pixel to its starting settings.
6. Held-out check of derived rules (4.8) and the owner's one normal-browser reference capture of S1, compared field by field (4.9). Fixed or generated differences go to the owner first.
7. Live-only rows tagged up front (4.10). Desktop Chromium only.
8. The completeness probe (6.1) runs under the O4 approval: out-of-inventory rate measured, and above 10% triggers kill criterion 6.
9. The kill criteria in 10.3 are checked; if one fires, stop and report to the owner. If the owner-only time-box (6.3) runs out, Meta stops and the question "may slices start on already captured states?" goes to the owner.
10. The inventory is frozen with a dated note, and the M1 to M13 slice files are written from it (see section 9 note).

**DoD:**
- Corpus and manifests committed (or stored privately where they carry private data), credential check green. `npm test && npm run lint` and the servo quality-gate pass.
- Pilot (4.11) is capture session plus M1, and counts extra captures M1 needed.

**Consumers:** M1 to M13 (section 9).

**Anti-horizontal-phasing check:** The capture session is the one pre-slice task ADR-0061 point 7 requires. It ends with a frozen corpus, and M1 proves it end to end.
