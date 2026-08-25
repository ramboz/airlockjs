# Governance plane

> Scaffolded by jig `scaffold-init` (ADR-0051). This documents the *scaffoldable
> half* of the governance firewall and the out-of-band step that arms it.

## Protected paths

These paths govern how this repo changes and are owner-protected via
`CODEOWNERS` + the `jig-governance` CI workflow:

- `docs/conventions.md`
- `docs/decisions/**`
- `oracle.sh`
- `.servo/**/config.json`
- `.github/workflows/**`
- `CODEOWNERS`

The set is the single source of truth in `scaffold.json` (`protected_paths`),
read by jig's soft hooks to nudge in-boundary; CI + branch protection enforce
out-of-boundary. Note the **self-reference**: `.github/workflows/**` and
`CODEOWNERS` are themselves protected, so the CI job and the owner list cannot
be edited without owner review.

## Governance-proposal routing (surface-and-stop, spec 102)

A change to a protected artifact must **open an ADR/spec and route through owner
review — never a self-edit**. Surface the conflict and stop; approving a
behaviour is not authority to rewrite the governing record.

## INERT UNTIL ARMED

The scaffolded `CODEOWNERS` + CI files enforce **nothing** on their own. They
become a blocking gate only once you complete the branch-protection arming step
below. A repo that looks protected but isn't is worse than an honest
recommendation — do not treat the scaffolded files as enforcement until armed.

## Branch-protection arming checklist

On the default branch (a server-side repository setting scaffold-init cannot
commit):

1. Enable branch protection on the default branch.
2. Require the `jig-governance` status check to pass before merging.
3. Require review from Code Owners.
4. Do not allow bypassing the above settings (forbid-bypass, including for
   admins).

The autonomy-readiness gate (servo) verifies the *armed* state — it is never
inferred from the presence of the scaffolded files.

## Identity / capability separation (autonomy precondition)

Arming branch protection is necessary but not sufficient. Autonomy-readiness
additionally requires **identity/capability separation**: the run identity (the
principal that runs the loop) must **not** be merge-capable — it must hold no
credential that can merge to the base branch or edit branch protection. A single
identity (the agent commits/pushes as the human) makes every owner-approval gate
fictional, and even a *distinct* bot that is merge-capable is over-privileged.

jig checks this deterministically over supplied/attested inputs
(`governance.py identity-check`); the servo readiness gate derives the
merge-capability input from the GitHub API and feeds it in. jig fails safe
(reports not-ready) when the capability signal is unavailable.
