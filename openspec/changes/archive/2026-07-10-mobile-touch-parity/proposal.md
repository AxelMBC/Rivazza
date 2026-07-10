# Mobile Touch Parity

## Why

The dashboard's interaction model is deliberately hover/wheel-only on desktop (clicks would steal window focus from the game), but the web app has **no touch handling at all** — on phones and tablets every interaction limps along on browser-synthesized mouse events. The result the user hit directly: tapping "Follow car" happens to work (the synthesized `mouseenter` parks and the 3 s dwell completes), but "Exit follow" never fires (the dwell re-arm guard needs a `mouseleave` that touch never delivers), and pinch-to-zoom does nothing because only `wheel` events are handled. On a touch device the hover-only rationale doesn't apply — the game runs on the PC, not the phone — so touch gets first-class tap/gesture interactions instead of emulated hover.

## What Changes

- **Pointer-mode split**: interactions detect the pointer type (touch vs. mouse) and behave natively for each. Desktop hover/wheel/dwell behavior is unchanged, pixel for pixel.
- **Track map pinch zoom**: two-finger pinch zooms the map anchored at the pinch midpoint, with the same 1×–40× clamp and "fully out = fit view reset" semantics as wheel zoom. Touch gestures on the canvas never scroll or zoom the page.
- **Track map drag pan**: while zoomed in (level > 1), a one-finger drag pans the view — touch has no hover-anchored zoom to reposition with, so panning is required for "zoom into a specific part of the track" to be usable.
- **Follow cam tap toggle**: on touch, tapping "Follow car" / "Exit follow" activates immediately — no 3 s dwell (the dwell exists only to avoid desktop clicks). Fixes the dead "Exit follow" button. Pinch/pan during follow detaches tracking in place, mirroring the wheel rule.
- **Lap-line readout on tap**: tapping near a stored lap line shows the same hover readout (lap, time, speed, gear, pedal) and emphasized line; tapping empty map area dismisses it. Pan/pinch gestures do not trigger it.
- **Panel reveals on tap**: the hover-revealed surfaces — session lap list flyout (LapTimes), lap analysis panel, tyre overlay — open/close by tap on touch devices instead of relying on sticky emulated hover.
- **Analysis scrub by touch drag**: dragging a finger across the analysis traces scrubs them (echoing the ring on the track map) without scrolling the page; lap chips select by tap.
- **Session header stacks on mobile**: the header (track + config, car · driver, and the Demo replay / connection / Source pills) currently squeezes onto one row at every width; on narrow viewports it wraps into a readable stacked layout. Desktop rendering is unchanged.
- **No "Live" pill during a replay**: in demo mode the connection badge said "Live" next to the "Demo replay" badge — contradictory. The connection badge is suppressed whenever the telemetry is a recorded replay (all viewports; it's a correctness fix, not a layout one).

## Capabilities

### New Capabilities

- `touch-interaction`: touch-native interaction layer for the dashboard — pointer-mode detection, tap equivalents for every hover-revealed surface (lap list flyout, analysis panel, tyre overlay, map lap readout), touch scrubbing in the analysis panel, and page-gesture isolation (no page scroll/zoom from canvas gestures). Desktop hover-only behavior explicitly preserved.
- `responsive-header`: the session header adapts to narrow viewports — title, car/driver line, and badge pills wrap into a stacked layout with truncation instead of compressing on one row; desktop layout byte-identical.

### Modified Capabilities

- `track-map-zoom`: adds touch requirements — pinch-to-zoom anchored at the pinch midpoint with wheel-equivalent clamps/reset, and one-finger drag panning while zoomed. Existing wheel requirements unchanged.
- `track-map-follow-cam`: adds touch requirements — tap (no dwell) toggles follow/exit on touch pointers; pinch or pan during tracking detaches in place like wheel input does.
- `demo-replay`: adds a requirement — while demo/replay mode is active, the live connection-status badge is not shown (the demo indicator is the status).

## Impact

- `web/src/components/TrackMap.tsx` — pointer/touch event handling on the canvas (pinch, pan, tap pick), follow button tap path alongside the dwell path.
- `web/src/components/LapAnalysis.tsx` — tap open/close, touch scrub via pointer events, chip tap selection.
- `web/src/components/LapTimes.tsx` — tap open/close for the lap-list flyout, row tap → `hoveredLapRef`.
- `web/src/components/TyreOverlay.tsx` / `InstrumentCluster.tsx` — tap toggle for the overlay reveal.
- `web/src/components/SessionHeader.tsx` — responsive stacking below the small breakpoint; connection badge suppressed in demo mode.
- Possibly a small shared hook/util (e.g. `web/src/lib/pointer.ts`) for coarse-pointer detection.
- No bridge, protocol, or type-contract changes. No new dependencies.
- Render-efficiency invariants (dirty-gated rAF loops) must be preserved by the new gesture handlers.
