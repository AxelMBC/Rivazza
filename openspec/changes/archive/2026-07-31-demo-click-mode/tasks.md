# Tasks — click-driven interaction in demo builds

## 1. The mode primitive

- [x] 1.1 Add `web/src/lib/interaction.ts` exporting `CLICK_MODE` (from `IS_DEMO`),
      `isImmediateActivation(e)`, and `HOVER_GROUP_CLASS`.

## 2. Route the controls

- [x] 2.1 `TrackMap.tsx` — `startDwell` returns immediately when `CLICK_MODE`; rename
      `onFollowTap` → `onFollowActivate` and gate it on `isImmediateActivation`.
- [x] 2.2 `TrackMap.tsx` — mode-dependent button `title`, plus `cursor-pointer` in click mode.
- [x] 2.3 `LapTimes.tsx` — `HOVER_GROUP_CLASS` on the Lap tile; tile toggle and the in-panel
      `stopPropagation` both gated on `isImmediateActivation`.
- [x] 2.4 `LapAnalysis.tsx` — `HOVER_GROUP_CLASS` on the root; pointer-enter/leave reveal skipped
      when `CLICK_MODE`; collapsed-bar toggle gated on `isImmediateActivation`.
- [x] 2.5 `InstrumentCluster.tsx` — `HOVER_GROUP_CLASS` on the cluster section; tyre-overlay
      toggle gated on `isImmediateActivation`.
- [x] 2.6 Leave lap rows, analysis lap chips, the map lap-line readout, trace scrubbing, wheel
      zoom and pinch untouched.

## 3. Name the mode on screen

- [x] 3.1 Add `web/src/components/InteractionModeBadge.tsx` — neutral pill, mode-dependent label,
      dot color, and `title`.
- [x] 3.2 Mount it in `SessionHeader.tsx` between the demo/connection badge and `GitHubLink`.

## 4. Specs

- [x] 4.1 Delta specs for `racer-dashboard`, `touch-interaction`, `demo-replay`,
      `track-map-follow-cam`.

## Verify

- [x] 5.1 `npm run lint -w web` clean.
- [x] 5.2 `npm run build -w web` and `npm run build:demo -w web` both succeed.
- [x] 5.3 Demo build (`npm run dev:demo`), headless: header shows "Demo replay" + "Click mode";
      a 2 s hover-hold on the follow button does nothing and the dwell sliver stays `w-0`; a click
      toggles follow; click opens/closes the lap flyout, the analysis panel, and the tyre overlay;
      a click inside the open flyout does not close it. 21/21 checks, no page errors.
- [x] 5.4 Live build (mock + `npm run dev`), headless: header shows the connection badge +
      "Hover mode"; the 1 s dwell still arms and its sliver fills; clicking the follow button,
      lap tile, analysis bar and cluster changes nothing; hover reveals and hides all three
      panels. 22/22 checks, no page errors.
- [x] 5.5 Both modes: wheel zoom over the map still repaints the canvas.
- [x] 5.6 Both modes: analysis lap chips still select on hover once laps exist.
- [ ] 5.7 Unfocused-window check by hand — with another window holding focus, confirm the live
      build's hover paths still work. Not verified headlessly: the harness owns focus, so the
      property the hover rule exists to protect cannot be asserted from it.
