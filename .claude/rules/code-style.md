---
paths:
  - '{bridge,web}/src/**/*.{ts,tsx,css}'
  - 'bridge/scripts/**/*.{ts,js}'
  - 'web/*.ts'
  - 'packages/*/src/**/*.ts'
---

# Code style

Form only. What a subsystem *does* and how two of them relate is in `CLAUDE.md` and in the
capabilities under `openspec/specs/` — not repeated here.

- **Tailwind v4** with semantic design tokens defined in `web/src/index.css` `@theme` (e.g.
  `text-ink-muted`, `bg-surface`, `border-edge`, `text-critical`). Use the tokens, not raw
  hex/color values.
- React 19, Vite, strict TypeScript throughout.

## Comments

The comment rule is `.claude/rules/comments.md` — it loads every session, not only here.

## Functions

**All functions are arrow functions**, including React components. The only exceptions are cases
arrows cannot express: TypeScript overload signatures, and generic functions in `.tsx` files
(where `<T>` collides with JSX and would need the `<T,>` hack). Neither currently appears in this
repo, so in practice the rule is unconditional.

## Imports

Prettier owns import order via `@ianvs/prettier-plugin-sort-imports` — never hand-sort. Groups
run by distance (builtins → third-party → `../` → `./` → CSS), with `import type` sorted inline
beside value imports from the same module rather than hoisted into its own block. Run
`npm run format` (or `npm run format:check` in CI).

## Types and file layout

- A type moves to its own module only when a **second** module needs it. A `Props` type used by
  one component stays in that component's file — do not extract it preemptively.
- `packages/protocol/src/index.ts` (`@rivazza/protocol`) is strictly the bridge ↔ web wire
  contract. Types that stay on one side (`HandshakerResponse`, `ConnectionStatus`, `LapRecord`)
  live with the module that produces them, not there.
- A component gets its own folder when it grows children or helpers only it uses — reactively,
  not preemptively.
- A file spanning more than two capabilities gets split. `web/src/components/TrackMap/` and
  `web/src/components/LapAnalysis/` are the worked examples: one wiring `index.tsx`, one module
  per job.
