## Why

Once the track map is zoomed in with follow mode off, a mouse user has no way to move the view: the
wheel only zooms, and panning exists only as a touch drag. Reaching another part of the track means
scrolling all the way out and back in over the new spot — a round trip of up to ~20 notches each
way at 40×. A click-drag pan is not an option, because a click on the browser steals controller
input from the game.

## What Changes

- Add an **overview inset** to the track map: a small, fixed-fit miniature of the whole track drawn
  in the map's top-right corner (under the pedal legend), showing the track, the car, and a
  rectangle marking the part of the track the main view currently shows.
- The inset appears only when it is needed: zoom at least two wheel notches in (~1.3×), follow camera not tracking (off or
  detached), and a fixed-fit projection mode (map metadata or track edges). It is hidden at lighter
  zoom, while tracking, and in the fallback driven-line mode.
- **Hover navigation, no click**: hovering the inset shows a ghost rectangle, sized like the current
  view, centred on the cursor. Resting the cursor there briefly (~250 ms) glides the main view to
  that spot at the **same zoom level**. Sweeping across the inset without resting does nothing.
- Wheel over the inset keeps zooming the main view, anchored at the view's centre rather than at the
  cursor (the cursor's screen point means nothing to the main view there).
- The inset is excluded from lap-line hover picking, and its rendering is cached and dirty-gated so
  an idle map still stops repainting.
- Touch: a tap on the inset jumps immediately. Click-mode (demo) builds: a click on the inset jumps
  immediately; hover still shows the ghost.

Non-goals: edge-hover panning (slow at high zoom, and it fires whenever the cursor leaves the map),
sector-jump buttons, and zoom-level memory. Zoom-level memory could land later as a separate
`/opsx:tweak`.

## Capabilities

### New Capabilities
- `track-map-overview`: the overview inset — visibility rules, content, the viewport and ghost
  rectangles, dwell-to-glide navigation, wheel and touch/click behaviour over the inset, hover-pick
  exclusion, and render idling.

### Modified Capabilities
- `track-map-zoom`: the no-click/no-focus requirement names the overview inset as a navigation
  surface covered by the same guarantee. The inset also joins the one-finger touch pan as a way to
  move a zoomed view.

## Impact

- `web/src/components/TrackMap.tsx` only: the inset is drawn in the existing canvas and hit-tested
  from `mouseRef`, so no new DOM element is added. There is a new cached offscreen layer for the
  inset's static content, a navigation target eased in the rAF loop next to the follow cam's exit
  easing, and new dirty-gate terms for the ghost and the glide.
- No bridge change, no wire-type change, no new hook, no new dependency.
