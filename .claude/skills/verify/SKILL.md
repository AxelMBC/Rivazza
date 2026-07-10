---
name: verify
description: How to run and observe this app end-to-end without Assetto Corsa — mock + dev servers + headless-browser driving for the hover-only UI.
---

# Verifying Rivazza changes

## Launch (no game needed)

```powershell
npm run mock -w bridge     # fake AC on UDP 9996 (background). Stop before running the real game.
npm run dev                # bridge :3001 + web :5173 (background)
# Cut detection off (all laps valid instead of cut-invalid):
$env:AC_SHM='0'; npm run dev
```

Bridge log confirms: `[ac] session: magione | abarth500 | Mock Driver`, plus
`[shm] cut: 4 tyres out...` every ~40 s when cut detection is on.

## Mock timing facts (set your waits by these)

- Lap counter ticks every **90 s** of mock uptime; `lastLapMs` is constant
  `83456` (renders `1:23.456`), `bestLapMs` `81999`.
- `normalizedPos` cycles every **30 s** — three times per counted lap. This is
  a mock quirk: pos-indexed recordings only accumulate during the first cycle
  of each lap, and float32 rounding can land a tail sample at exactly pos 1.0
  with a 60/90 s lap clock. Don't chase "impossible" sector/delta numbers
  against the mock before checking this; real AC pos is monotonic per lap.
- Cuts fire every ~40 s of driving → with cut detection on, **every** mock lap
  is invalid (red). Use `AC_SHM=0` to observe valid/best presentation.
- A page that connects mid-lap records its first lap as partial/not-complete —
  that's the out-lap case, useful for testing it.
- Restarting the mock process = session reset (bridge goes stale after 5 s,
  re-handshakes ~3 s later; the fresh session must clear session-scoped state).

## Driving the UI (headless browser)

The UI is **hover-only** (clicks would steal game focus), so drive it with
real mouse-move events. `puppeteer-core` against installed Edge works:

```js
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true, defaultViewport: { width: 1600, height: 1000 }, // ≥1024px for the lg: desktop grid
});
```

- Wait for text with `page.waitForFunction` on `innerText` (CSS `uppercase`
  transforms innerText — match case-insensitively).
- Hidden hover panels (opacity-0) still appear in `innerText`; scope matches
  to the right `<section>` to avoid false positives.
- To hover a map lap line, scan a grid of `page.mouse.move` points and poll
  the canvas `style.cursor` until it's `pointer` (the hit-test sets it).
- Collect `page.on('pageerror')` — a clean run should end with none.

## Timeline for a fresh mock

connect → first lap tick ≤90 s (partial lap stored, map line + legend appear)
→ next tick ≤90 s later: first **complete** recording (analysis chips populate).
Budget ~4 min end-to-end.
