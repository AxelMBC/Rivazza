# Name the ABS flag in extended-telemetry as the wire contract names it

`extended-telemetry` contradicts itself: the requirement enumerates `absInAction`, and its own
scenario two lines later says `isAbsInAction` — a name that appears nowhere in `bridge/src` or
`web/src`. Found by `/opsx:audit-drift`. Spec-only; no code changes.

## 1. Implementation

- [x] 1.1 Correct the scenario in `openspec/specs/extended-telemetry/spec.md` to say `absInAction`,
      via the delta in this change (applied by `/opsx:sync`)

## 2. Verification

- [x] 2.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec delta
- [x] 2.2 Re-run `/opsx:audit-drift` detector 1 after sync — unresolved symbols must drop from 2 to
      1, and the survivor must be `numberOfTyresOut`, correctly classified as external vocabulary
      rather than reported as drift
