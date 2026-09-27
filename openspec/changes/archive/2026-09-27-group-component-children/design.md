## Context

`split-track-map` and `split-lap-analysis` each turned an oversized component into a folder. This
change applies the other half of the same rule, the one about children with a single importer,
to three small parents. Nothing is split: every file moves whole, and only its relative import
specifiers change.

## Goals / Non-Goals

**Goals:**

- Every child component with a single importer lives in its parent's folder.
- `components/` lists only the panels `App.tsx` renders: `DriverInputs/`, `InstrumentCluster/`,
  `LapAnalysis/`, `LapTimes.tsx`, `SessionHeader/`, `TrackMap/`.
- The rendered output is unchanged.

**Non-Goals:**

- Splitting or editing any component. `AnalogGauge.tsx` (214 lines) and `GForceMeter.tsx` (119) are
  single-job files.
- Moving `LapTimes.tsx` into a folder. It has no children (`TimeTile` and `LapListPanel` are private
  to the file), so the rule does not apply to it.
- An `index.ts` barrel re-exporting the children. Each child has a single importer, which already
  sits beside it.

## Decisions

### D1. Target layout

```
web/src/components/
  DriverInputs/       index.tsx  GForceMeter.tsx  PedalBars.tsx
  InstrumentCluster/  index.tsx  AnalogGauge.tsx  SteeringBar.tsx  TyreOverlay.tsx
  LapAnalysis/        (unchanged)
  LapTimes.tsx        (unchanged)
  SessionHeader/      index.tsx  ConnectionBadge.tsx  DemoBadge.tsx  GitHubLink.tsx
                      InteractionModeBadge.tsx
  TrackMap/           (unchanged)
```

The parent becomes `index.tsx`, matching `TrackMap/` and `LapAnalysis/`, so `App.tsx` needs no
edit.

*Alternative:* one `components/header/`, `components/sidebar/` grouping by screen region.
Rejected: it invents a second organising principle (layout position) alongside the one the code-style
rule already uses (ownership), and `DriverInputs` and `InstrumentCluster` would share a folder
without sharing any code.

### D2. `git mv` for every file

Each file is moved with `git mv`, so git records renames and `git log --follow` keeps working.
Import specifiers are fixed after the move.

### D3. GForceMeter moves too

It is a canvas component with its own dirty-gated rAF loop, but it has one importer
(`DriverInputs`), so the ownership rule applies. `CLAUDE.md` refers to it by name only, so the
move leaves that paragraph accurate.

## Risks / Trade-offs

- **[Stale Vite resolution]** Vite's dev server caches the old file paths, and a running server
  may show a blank panel after the move. → Restart it before the smoke check (as in both earlier
  splits).
- **[`audit-drift.md` example mentions `InstrumentCluster.tsx:99`]** It is sample output in a
  command file, and already stale (it also cites `types.ts`). → Leave it. An illustrative
  file:line has no reason to track this move.

## Migration Plan

Pure renames. Rollback is reverting the commit.

## Open Questions

None.
