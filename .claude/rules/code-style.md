---
paths:
  - '{bridge,web}/src/**/*.{ts,tsx,css}'
---

# Code style

Form only. What a subsystem *does* and how two of them relate is in `CLAUDE.md` and in the
capabilities under `openspec/specs/` — not repeated here.

- **Tailwind v4** with semantic design tokens defined in `web/src/index.css` `@theme` (e.g.
  `text-ink-muted`, `bg-surface`, `border-edge`, `text-critical`). Use the tokens, not raw
  hex/color values.
- React 19, Vite, strict TypeScript throughout.

## Comments

Comments explain **constraints that live outside the repo** — things no rename can express:
AC's protocol and file formats, Windows/browser behaviour, and tuned constants whose value was
chosen against a tradeoff (a reader who "cleans up" `FOLLOW_WINDOW_HEADROOM = 0.95` to `1`
reintroduces a bug).

Never comment what the code already says. In particular:

- No JSDoc on internal functions — strict TS types carry it.
- No section banners (`// ---- helpers ----`); that is a signal to split the file.
- No comments narrating the next line, an effect's steps, or a function's name restated in prose.
- Rationale about how two subsystems relate belongs in `CLAUDE.md` or in `openspec/specs/`, not in
  a source comment. Before writing one, check whether the relevant spec already states it.

Test before keeping a comment: _can a reader recover this by reading the code harder?_ If yes,
delete it. If no, it is load-bearing — keep it, and keep it short.

**When the answer is "reading the code harder wouldn't recover it", the fix is usually still not a
comment.** Explicit code replaces the comment:

| If you were about to comment… | Do this instead |
| --- | --- |
| what a block does | extract it to a named function |
| a magic number or string | a named constant (`FOLLOW_WINDOW_HEADROOM`, `OFF_TYRES_OUT`) |
| a compound condition | a named predicate (`isStale`, `hasFreshPacket`) |
| what a variable holds | rename the variable |
| what a function takes or returns | explicit types |
| the sections of a long file | split the file |

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
- `web/src/types.ts` is strictly the hand-mirrored bridge wire contract. Shared app-level types
  (e.g. `LapRecord`) live with the module that produces them, not here.
- A component gets its own folder when it grows children or helpers only it uses — reactively,
  not preemptively.
- A file spanning more than two capabilities gets split. (`TrackMap.tsx` is the outstanding
  case; see the `split-track-map` change.)
