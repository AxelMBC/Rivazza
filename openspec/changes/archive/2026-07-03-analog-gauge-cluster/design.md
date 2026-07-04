# Analog Gauge Cluster — Design

## Context

`web/src/components/InstrumentCluster.tsx` currently renders a flat digital panel: speed number (left), large gear digit (center), RPM number (right), a horizontal RPM bar with a redline zone and limiter flash, and ABS/TC/PIT status lights. The reference design is a classic analog instrument: circular dial, tick marks with numerals, red needle, bezel ring, and a small window below the pivot (the "odometer" position). Per the proposal, this becomes a twin-gauge cluster — speedometer + tachometer — with dark faces to match the existing theme. Telemetry arrives as `TelemetryFrame` over the existing bridge at high frequency; no data changes are needed.

## Goals / Non-Goals

**Goals:**
- A reusable SVG `AnalogGauge` component driving both dials from props.
- Speedometer: fixed 0–320 km/h scale, exact digital speed in the odometer window.
- Tachometer: fixed RPM scale with a static redline arc, gear digit displayed in the dial, limiter flash preserved.
- Dark faces styled from existing theme tokens; smooth needle motion.
- Status lights (ABS/TC/PIT) preserved beneath the gauges.

**Non-Goals:**
- No per-car redline/max-speed data from the sim (not available in the current frame) — scales are fixed.
- No white-face/chrome skin, no theme switcher for gauge faces (dark variant only for now).
- No changes to bridge, parsers, or telemetry types.
- No canvas/WebGL or third-party gauge library.

## Decisions

### 1. One generic `AnalogGauge` SVG component, two instances
A single component takes `{ min, max, value, majorTickStep, minorTicksPerMajor, redlineFrom?, unitLabel, formatTickLabel? }` plus a children slot for face content (odometer window / gear digit). Both gauges are instances with different props.
- *Why*: The two dials differ only in scale, redline, and center content. One implementation keeps tick math, needle geometry, and styling in one place.
- *Alternative considered*: Two bespoke components — rejected as duplicate trig/tick code.

### 2. Inline SVG with computed geometry, no dependencies
Ticks and numerals are generated in a loop using polar-to-cartesian math inside a fixed `viewBox` (e.g. 200×200); the component scales responsively via CSS width. Needle is a polygon rotated with an SVG `transform: rotate(deg)` around the pivot.
- *Why*: Fully controllable styling with theme tokens, crisp at any size, zero new dependencies.
- *Alternative considered*: `react-gauge-chart` or similar — rejected; poor fit for the skeuomorphic look and adds a dependency.

### 3. Sweep geometry: 240° arc
Scale starts at −120° (from vertical) and ends at +120°, matching the reference image's roughly bottom-left → bottom-right sweep, leaving the bottom arc free for the odometer window / gear digit.

### 4. Fixed scales; needle clamps at the ends
- Speedometer: **0–320 km/h**, major ticks + numerals every 40, one minor tick between majors.
- Tachometer: **0–10,000 rpm**, major ticks every 1,000 labeled as ×1000 ("0…10"), redline arc **static from 8,500** to 10,000.
- Values outside the scale clamp the needle at max rather than overshooting.
- *Why*: An analog dial's meaning comes from fixed needle positions; the current RPM bar's rolling session max cannot translate (ticks would move mid-session). 0–320 covers a GT3's top speed; 0–10k covers nearly all cars. The limiter flash — not the redline arc — remains the authoritative shift cue, so a static arc being approximate per-car is acceptable.
- *Alternative considered*: Rolling-max dial that re-scales — rejected; moving tick marks defeat the point of an analog gauge.

### 5. Needle smoothing via CSS transition
The needle group gets `transition: transform 100ms linear`. Telemetry frames arrive faster than large value jumps occur, so CSS interpolation between frames yields fluid motion without rAF loops or springs.
- *Why*: Simplest thing that looks right; component already re-renders per telemetry frame.
- *Alternative considered*: `requestAnimationFrame` interpolation or react-spring — rejected as unnecessary complexity unless the CSS approach visibly stutters (revisit if it does).

### 6. Face content placement
- Speedometer window (below pivot): exact speed, e.g. **`142 km/h`**, tabular numerals — the digital readout the flat panel used to provide.
- Tachometer window (same position): the **gear digit**, large and accent-colored, reusing `formatGear` (R/N handling). On limiter, the gear digit and needle flash (`animate-pulse` + redline color), preserving the current limiter cue.
- *Why*: Mirrored windows keep the two dials visually symmetric, like a real cluster.

### 7. Styling from existing theme tokens
Face = `surface`/`page` fills, ticks and numerals = `ink`/`ink-secondary`, bezel = a subtle ring using `edge`/`hairline` (a restrained metallic look via an SVG stroke or gradient, not photoreal chrome), needle = existing `redline` token, gear/readout accents = `accent`. New Tailwind tokens only if a gap appears during implementation.

### 8. Layout: two dials side by side, status lights beneath
The cluster section keeps its card container; inside, a two-column flex/grid of equal-width gauges, with the ABS/TC/PIT row centered underneath spanning both. The panel gets taller than the current text row; the dashboard's left column spacing is adjusted so the single-viewport layout requirement still holds.

## Risks / Trade-offs

- **[Panel height growth breaks the non-scrolling viewport on smaller screens]** → Cap gauge size (`max-width` per dial) and let SVG scale down; verify against the existing single-viewport scenario during implementation.
- **[Static redline arc is wrong for low-revving cars]** (e.g. redline at 6.5k shows needle never nearing the arc) → Accept: the limiter flash remains the true shift signal; note as a future enhancement if per-car data becomes available.
- **[CSS-transition needle may lag or stutter at low frame rates]** → Transition duration ≈ telemetry period; if visible stutter appears, fall back to rAF interpolation (contained inside `AnalogGauge`).
- **[Numeral placement/trig fiddliness]** → Keep all geometry in small pure helpers (`polarToCartesian(angle, radius)`), easy to unit-eyeball in isolation.

## Migration Plan

1. Archive/sync `racer-stats-ui` first so the `racer-dashboard` main spec exists for this change's MODIFIED delta.
2. Implement `AnalogGauge`, swap `InstrumentCluster` internals; no other components or data paths change.
3. Rollback = revert the component changes; no persisted state or API involved.

## Open Questions

- None blocking. Exact bezel treatment (flat ring vs. subtle gradient) is a visual-polish call made during implementation.
