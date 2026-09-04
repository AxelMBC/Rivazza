# What "verified" means here

No `paths:` — this loads every session, because the first thing anyone gets wrong in this repo is
assuming there are tests.

**There is no test framework.** No vitest, no jest, no `npm test`. Do not invent one, do not write
a `*.test.ts` expecting a runner to pick it up, and do not put "run the tests" in a `tasks.md`.

## The automated half

Four read-only checks, cheapest first. They are the whole automated gate, and `/opsx:verify` runs
them from `.claude/workflow.yaml`'s `checks:` block:

```bash
npm run build -w bridge              # tsc --noEmit over the bridge
npm --prefix web exec -- tsc -b --noEmit
npm run lint -w web                  # oxlint, no --fix
npm run format:check                 # prettier --check
```

`npm run build -w web` is **not** one of them: it is `tsc -b && vite build`, and the vite half
writes `web/dist/`. `tsc -b --noEmit` gets the same type coverage without touching the tree.

`npm run format` and `npm run lint -w web` are both safe to run by hand — format rewrites source on
purpose (Prettier owns import order) and oxlint has no `--fix`. Neither is denied.

## The manual half — and it is the larger half

Type-checking a telemetry bridge proves almost nothing about whether the dot moves. Anything that
depends on real frames arriving, a canvas repainting, or a hover revealing a panel is verified by
**running the app**, and `.claude/skills/verify/SKILL.md` is the procedure: `npm run mock -w bridge`
for a fake AC on UDP 9996, `npm run dev` for bridge + web, and puppeteer-core against installed
Edge to drive a UI that is hover-only (a click would steal focus from the game). Budget ~4 minutes
end to end; the mock's lap counter ticks every 90 s.

Read that skill rather than re-deriving it — it records the mock's exact timings and the
browser-driving traps (innerText is uppercased by CSS, hidden `opacity-0` panels still appear in
innerText, hovering a map line means scanning `page.mouse.move` points until the canvas cursor
turns `pointer`).

## Unchecked boxes are not failures

A `- [ ]` left in a `tasks.md` is normally a manual check that needs the game or the mock running.
`/opsx:verify` lists them and `/opsx:archive` prompts about them; neither fails on them. Leaving
one unchecked and *saying so* is a correct outcome. Silently ticking it is not.
