# Design — improve-racing-line-comparison

## Context

The track map (`web/src/components/TrackMap.tsx`) stores each lap as a polyline of raw
world-coordinate samples (~1 m apart) and projects them fit-to-canvas. Audit findings:
the data pipeline (float32 UDP positions → JSON → 1 m sampling) loses essentially nothing,
but at fit-to-canvas scale the racing surface itself is only 3–8 px wide (measured against
real `map.ini` values: Magione ~0.76 px/m, Monza ~0.30 px/m) while lap lines are 2.5–3 px
strokes in one shared grey. Different racing lines through the same corner differ by 6–9 m
— under or barely over one stroke width on screen. The only fidelity trade in the whole
pipeline is the bridge's 30 Hz broadcast throttle (~1.7 m between frames at 180 km/h).

**Hard interaction constraint:** clicking the browser page steals controller focus from the
running game. Every interaction in this change MUST work with hover and scroll-wheel only
— no click, no drag, no double-click, no keyboard, no window focus. Windows delivers wheel
events to hovered unfocused windows by default, and `mousemove`/`wheel` never take focus,
so hover + wheel is exactly the gesture set that is safe. The lap-history hover panel
already established this rule in this repo.

## Goals / Non-Goals

**Goals:**
- Make meter-scale differences between laps plainly visible (the three-lap
  outside/inside/center experiment must produce three visibly distinct lines).
- Identify which line belongs to which lap without pointing at them one at a time.
- Surface per-lap speed at a hovered point so line choices can be evaluated, not just seen.
- Preserve raw-trajectory precision end to end; improve the one lossy stage (broadcast rate).

**Non-Goals:**
- No pan gesture (navigation is cursor-anchored zoom only — see Decisions).
- No lap-vs-lap time-delta graph or `normalizedPos`-keyed analysis (future change; nothing
  in this design blocks it).
- No persistence of laps or zoom across sessions; session restart still resets everything.
- No changes to the current lap's pedal-gradient coloring (`driving-line-gradient` spec).

## Decisions

### D1: Cursor-anchored wheel zoom is the only navigation gesture

Wheel over the canvas zooms toward/away from the cursor's world position; the world point
under the cursor stays put. To move between corners at high zoom the user scrolls out,
moves the cursor, scrolls back in — no drag-pan and no edge-hover pan.

- *Why not drag-pan:* forbidden by the interaction constraint.
- *Why not edge-hover auto-pan:* the canvas edge is also where lap lines pass; a cursor
  parked near a line for inspection would drift the view. Rejected as hostile to the
  primary hover use-case.
- Zoom factor is exponential per wheel notch (`ZOOM_STEP^(-deltaY/100)`, step ≈ 1.2),
  clamped to `[1, 40]`. At zoom 1 the view is exactly today's fit-to-canvas framing and
  any accumulated focus offset is discarded — scrolling all the way out is the reset
  gesture, so no reset button is needed.
- The `wheel` listener is attached non-passive with `preventDefault()` so the page never
  scrolls behind the map.

### D2: Zoom is a multiplier layered over both existing projections

Both projection modes already funnel every drawn point through a single `project`
closure. Zoom composes on top as `screen = (base(p) - focus) * zoom + center`-style
transform rather than forking either mode:

- **map.ini mode** (image or bounds-only): base projection unchanged; the map image is
  drawn through the same zoomed transform so lines and background stay registered. The
  PNG blurs at high zoom — acceptable, it is context; lap lines are re-projected vectors
  and stay crisp.
- **fallback mode** (no map data): zoom multiplies the eased auto-fit view. The
  first-lap "camera never moves automatically" behavior is untouched at zoom 1.

Stroke widths, dot radius, and hover radius remain constant in screen pixels — zooming in
makes the track wide relative to the lines, which is the entire point. The
`track-map-viewport` requirement is narrowed from "never pan/zoom/re-fit" to "never
*automatically* pan/zoom/re-fit"; user zoom state resets on session change/restart along
with the lines.

### D3: Per-lap identity via a stable cycling palette, recent laps only

Completed laps get a color from a fixed 6-hue palette assigned by `lap % 6`, so a lap keeps
its color for the whole session (colors never reshuffle as laps complete). Only the most
recent 6 completed laps draw in color; older laps fall back to today's faint grey so long
sessions don't become rainbow noise. Hover still highlights any lap (colored or grey) by
thickening it to full opacity, replacing today's fixed blue re-color so the highlight keeps
the lap's identity color.

- *Why palette-by-lap-number over user selection:* selecting requires a gesture; the only
  ones available (hover, scroll) are already spoken for. Automatic coloring needs zero
  interaction and covers the actual workflow (compare the last few laps).
- *Why 6:* comfortably covers a comparison session; 6 distinguishable hues on a dark
  canvas is near the practical limit. Palette hues are hardcoded in the component like the
  existing pedal colors (canvas cannot consume Tailwind tokens).

### D4: DOM legend, always visible while colored laps exist

A small overlay in a corner of the map panel lists each currently-colored lap: color
swatch, lap number, recorded time from the lap log (red when invalid, matching lap-list
conventions), most recent first. Plain DOM (like the existing panel labels), not canvas —
it needs no per-frame redraw and gets text rendering for free. Purely informational:
no hover behavior required on the legend itself.

### D5: Samples record speed; hover reads it back per lap

`Sample` gains `speedKmh` (already in every telemetry frame; no wire change). The existing
hover hit-test is extended: instead of returning only the single nearest lap, it also
collects, for every *colored* lap with a sample within the hover radius, that lap's nearest
sample. The hover label becomes a small multi-row readout — nearest lap keeps its
"Lap N — time" row, and each in-radius colored lap contributes "Lap N · <speed> km/h"
with its swatch color. At high zoom the laps separate on screen, so the readout naturally
narrows to whichever lines the cursor is actually near.

- *Why not interpolate speed between samples:* samples are ≤ ~1 m apart; nearest-sample
  speed is within a few tenths of a km/h of truth. Interpolation adds code, not accuracy
  the user can perceive. Raw values only.

### D6: Bridge broadcast 30 Hz → 60 Hz, delivered arrival-driven

`BROADCAST_HZ` in `bridge/src/index.ts` doubles. AC floods packets far faster than 60 Hz,
so frames are available; payloads are small JSON (~60 msg/s is trivial for a localhost
WebSocket and the rAF consumer reads a ref, not React state). This halves worst-case
sample spacing at top speed (~1.7 m → ~0.85 m), keeping the 1 m `SAMPLE_SPACING` intent
honest everywhere on track.

*Discovered during implementation:* Windows quantizes short timers to ~15.6 ms ticks —
a bare `setInterval(1000/60)` fires at ~32 Hz on the target machine, so a plain interval
cannot deliver 60 Hz. Delivery is instead driven by packet arrival gated against a
due-time accumulator (send the newest frame when its due time has passed, stepping the
due time by 1/60 s and re-anchoring after gaps); the interval remains only as a sweeper
for the trailing frame when packets pause. Keep-only-newest semantics are unchanged.
The mock was updated to match reality: it now sends at the Windows timer floor (~65+ Hz,
approximating AC's flood) and advances its simulation clock by real elapsed time so the
car's pace no longer depends on timer granularity.

## Risks / Trade-offs

- [Hit-test cost grows: hover scan runs per frame over every stored lap] → It already
  steps every 3rd sample; with the multi-lap readout it still only touches colored laps
  for the speed rows. If 40 stored laps × 25k samples ever measurably drags, add an early
  bounding-box rejection per lap — noted in tasks as a check, not built pre-emptively.
- [60 Hz doubles sample-push frequency into the current lap array] → Sampling is still
  distance-gated at 1 m, so stored data volume is unchanged; only the check runs more
  often. Negligible.
- [Zoomed-in map.png looks blurry] → Accepted; the image is orientation context. Lines
  (the data) are vector-crisp at all zooms.
- [Two laps 6 apart share a palette hue] → Accepted; only the 6 most recent are colored,
  so a collision requires comparing across 6+ laps, at which point hover disambiguates.
- [Wheel-zoom on the map panel removes wheel-scrolling of the page over that area] →
  The dashboard is a single-screen layout with no page scroll; nothing is lost.

## Migration Plan

Pure client/bridge behavior change, no data or wire migration. Revert = revert the commit.

## Open Questions

None blocking. If the palette hues clash with the pedal-gradient colors in practice
(green/red are reserved for throttle/brake), adjust hues at implementation time —
the palette deliberately avoids green, red, and yellow.
