## Why

`web/src/components/` is a flat list of 15 entries. Four of them are real top-level panels that
`App.tsx` renders (`SessionHeader`, `InstrumentCluster`, `DriverInputs`, `LapTimes`), next to
`TrackMap/` and `LapAnalysis/`. The other nine are children that each have exactly one importer:

| Parent | Children (only importer is the parent) |
| --- | --- |
| `SessionHeader` | `ConnectionBadge`, `DemoBadge`, `GitHubLink`, `InteractionModeBadge` |
| `InstrumentCluster` | `AnalogGauge`, `SteeringBar`, `TyreOverlay` |
| `DriverInputs` | `GForceMeter`, `PedalBars` |

The flat listing doesn't show which is which. `.claude/rules/code-style.md` already states the
rule: "a component gets its own folder when it grows children or helpers only it uses". These
three parents meet it, and nothing has applied it yet.

## What Changes

- `SessionHeader.tsx` → `SessionHeader/index.tsx`, with its four badges beside it.
- `InstrumentCluster.tsx` → `InstrumentCluster/index.tsx`, with `AnalogGauge`, `SteeringBar` and
  `TyreOverlay` beside it.
- `DriverInputs.tsx` → `DriverInputs/index.tsx`, with `GForceMeter` and `PedalBars` beside it.
- Relative imports in the moved files go one level deeper (`../lib` → `../../lib`,
  `../hooks` → `../../hooks`). Sibling imports (`./AnalogGauge`) stay the same.
- File contents change only in those import specifiers. No component is split, renamed or edited.

`App.tsx`'s imports (`./components/SessionHeader`, …) resolve to each folder's `index.tsx`, so it
doesn't change. `LapTimes.tsx` has no children and stays a file.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement in `openspec/specs/` names a component file path.

**This change ships no spec deltas.** `/opsx:verify` must skip `openspec validate --type change`.

## Impact

- **Code:** 12 files (three parents, nine children) move under `web/src/components/` into three new folders. No `lib/`, hook, wire
  type or bridge file is touched.
- **Docs:** none required. `CLAUDE.md` names `GForceMeter` only by component name, not path.
  `.claude/rules/code-style.md` already states the rule this applies.
- **Git history:** pure renames, so `git log --follow` works for every file.
- **Verification:** type-checking covers the imports. The manual check is that every panel still
  renders in the live and demo builds.
