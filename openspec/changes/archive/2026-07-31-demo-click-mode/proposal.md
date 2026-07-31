# Click-driven interaction in demo builds

## Why

Every control in the dashboard is hover-driven because a click focuses the browser and Assetto
Corsa stops receiving controller input. That constraint only exists while the game is running —
i.e. in live builds. A demo build (`VITE_DEMO_MODE=1`, `npm run dev:demo`) replays a committed
recording, never opens a WebSocket to the bridge, and cannot possibly steal input from a game it
has no connection to. Hover-dwell there is friction with no payoff: a viewer's instinct is to
click "Follow car", and the button appears broken because nothing happens.

Two things follow. Demo builds should accept clicks on their controls. And whichever model is
active should be named on screen, because "clicks do nothing" is otherwise indistinguishable from
a broken page in a live build.

## What Changes

- A new build-time constant `CLICK_MODE` (derived from the existing `IS_DEMO`) selects the
  interaction model. Live builds are unchanged in every respect.
- In a demo build, four surfaces activate on a single click and their hover paths are disarmed:
  the track map's follow-camera button (no dwell, no progress fill), the session lap-list flyout,
  the lap-analysis panel, and the instrument cluster's tyre overlay.
- Mouse events reach these surfaces through the tap path that `touch-interaction` already built,
  so click behavior and tap behavior are the same code. Touch behavior is unchanged in both modes.
- Interactions that reveal information rather than act as controls stay hover-driven in **both**
  modes: lap-list rows, analysis lap chips, the map's lap-line readout, and trace scrubbing.
  Wheel zoom and pinch are unchanged — a click has no meaning there.
- A new header pill names the active model: "Click mode" or "Hover mode", rendered in both builds.

Not in scope: a runtime toggle. `CLICK_MODE` is a build-time constant like `IS_DEMO`, and
`demo-replay` already forbids selecting demo mode at runtime.

## Capabilities

### Modified Capabilities

- `racer-dashboard` — the focus-safe-reveal requirement is scoped to builds that can drive a live
  session; a new requirement covers the mode pill in the header.
- `touch-interaction` — mouse events take the tap path in demo builds. The touch path itself, and
  all live-build mouse behavior, are untouched.
- `demo-replay` — gains the click-interaction requirement for demo builds.
- `track-map-follow-cam` — demo builds activate and leave follow mode on a single click, with no
  dwell timer and no progress fill.

## Impact

- `web/src/lib/interaction.ts` (new), `web/src/components/InteractionModeBadge.tsx` (new).
- `web/src/components/TrackMap.tsx`, `LapTimes.tsx`, `LapAnalysis.tsx`, `InstrumentCluster.tsx`,
  `TyreOverlay.tsx`, `SessionHeader.tsx`.
- No bridge changes, no wire-format changes, no new dependencies.
