# Proposal: track-map-follow-cam

## Why

At high zoom the track map shows a corner beautifully, but the car drives out of frame within seconds — the user has to chase it manually with the wheel. There is no way to watch the car up close continuously. A follow ("chase-cam") view keeps the car centered at a comfortable zoom so the map reads like a camera tracking the vehicle, hands-free — critical because the user is usually driving and cannot click or drag (a click would steal window focus and controller input from the game).

## What Changes

- Add a **Follow button** overlaid on the track map that activates by *hovering it for 3 seconds* (no click, consistent with the map's existing no-click/no-focus interaction design). A visible progress indicator fills during the dwell.
- Activating follow mode animates the view (smooth zoom-in) to a comfortable fixed zoom centered on the car, then continuously pans (north-up, no rotation) to keep the car centered with smoothing, in all three projection modes (map.ini, edges-only, fallback).
- While following, an **Exit button** replaces the follow button; hovering *it* for 3 seconds triggers an animated zoom-out back to the normal fit view.
- Any wheel zoom input during follow mode **cancels tracking** in place: the view becomes a normal manual-zoom view seeded from the current follow transform, and the exit button stays available for the animated return. Scrolling fully out to 1× still resets, as today.
- Follow mode ends automatically on session change/restart (with the existing zoom/lines reset).

## Capabilities

### New Capabilities

- `track-map-follow-cam`: Hover-armed follow view on the track map — entry/exit buttons with 3-second dwell activation, animated transitions in and out, smoothed car-centered tracking at a comfortable zoom, cancellation by manual wheel zoom, and session-reset behavior.

### Modified Capabilities

<!-- none — the existing track-map-zoom requirements (cursor-anchored wheel zoom, 1× reset gesture, no-click interaction, per-mode composition, session reset) all remain true; follow mode layers on top of the same zoom transform -->

## Impact

- **Code**: `web/src/components/TrackMap.tsx` only — new follow state machine alongside the existing `zoomRef` screen-space zoom, two overlay buttons with dwell timers, per-frame camera targeting inside the existing rAF `draw` loop. The dirty-gating scheme must account for follow-mode animation frames (like the existing fallback-view `easing` flag).
- **Specs**: new `track-map-follow-cam` capability; `track-map-zoom` untouched.
- **No bridge, protocol, or type-contract changes** — the feature consumes the existing `telemetryRef` frames.
