## 1. One cut marker per lap

- [x] 1.1 In `web/src/components/TrackMap.tsx`, replace the per-lap `cuts: CutMarker[]` on `previousLapsRef` entries and the `currentCutsRef` array with a single nullable marker each, so "at most one per lap" is structural rather than conventional.
- [x] 1.2 Change the cut-consumption loop so an event attaches only when its target lap has no marker yet — both for the in-progress lap and for the back-attach of a straggler to a just-completed stored lap — and is otherwise discarded.
- [x] 1.3 Update `drawCutMarkers` and the lap-rollover handoff (`previousLapsRef.push`, `resetLines`, the bounded-history shift) to carry the single marker instead of an array.
- [x] 1.4 Confirm no change is needed in `useLapHistory` or `useTelemetry`: `cutsRef` stays the complete raw list and lap validity still flags on any cut.

## 2. Demo pre-session state

- [x] 2.1 Add a demo loading screen to the web app: a CSS-only spinner (`animate-spin`) plus brief text, built from the existing semantic tokens and written as an arrow-function component like every other component in the repo.
- [x] 2.2 Add a demo "recording unavailable" screen for the failed-fetch and empty-recording cases, with copy that names the recorded session rather than the bridge or the game.
- [x] 2.3 In `web/src/App.tsx`, branch the pre-session render on the demo build flag first: demo builds get the loading screen while status is `connecting` and the unavailable screen once it is `waiting`; non-demo builds keep today's `WaitingScreen` exactly as written.

## 3. Verify

- [x] 3.1 Run the demo build (`VITE_DEMO_MODE=1`) and confirm the loading screen — not "Connecting to telemetry bridge…" — shows while `demo/imola.json` loads, and that the dashboard replaces it when the replay's session message lands.
- [x] 3.2 With the demo recording served but unreachable (or pointed at a missing file), confirm the unavailable screen appears instead of "Waiting for Assetto Corsa".
- [x] 3.3 In demo replay, confirm exactly one × renders for Lap 3 — the recording's four events for that lap previously drew a cluster of three plus one. Verified on the ambient path: sampled at lap 3 / 76 s (past all four recorded cut times of 57.6, 71.6, 71.8, 72.0 s), one red cluster of 11×12 px; and zero once the lap completed, confirming the marker leaves the ambient view at the line. The hover-reveal path was not exercised — the automated row selector found no Lap 3 row to hover.
- [ ] 3.4 Confirm Lap 3 still reads as invalid in the lap list and that the in-progress lap's INV cue is unchanged.
- [ ] 3.5 Run the live path against the mock (`npm run mock -w bridge`) and confirm the live waiting and connecting screens are untouched and that simulated cuts still mark one × per lap. Partially covered: the live "connecting" screen was confirmed unchanged, and a real AC session emitted a cut through the new attach path. The mock was deliberately not started — a real Assetto Corsa session was running on the machine and both bind UDP 9996. The live "waiting" screen could not be observed for the same reason.
- [x] 3.6 Run `npm run lint -w web` and `npm run build -w web`.

## 4. Specs

- [x] 4.1 Sync the `cut-markers` and `demo-replay` deltas into `openspec/specs/` once the implementation is verified.
