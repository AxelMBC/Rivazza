import type { Zoom } from "./overviewInset";

export const PADDING = 24;
export const DOT_RADIUS = 7;
// AC positions are millimetric, so anchors this far apart give a stable heading
// with no angular smoothing.
export const HEADING_BASELINE_M = 0.75;
export const STEER_FULL_DEG = 90;
export const STEER_TICK_LEN = 8; // screen px
export const SAMPLE_SPACING = 1; // m — fine enough for exact corner shapes
export const MAX_SAMPLES = 25000; // hard cap so a stuck lap counter can't grow unbounded
export const MAX_LAPS = 40;
export const HOVER_RADIUS_SQ = 12 * 12; // px²
export const TELEPORT_DIST = 100; // m between frames — beyond this it isn't driving
export const DEAD_ZONE = 0.05;
// Thin on purpose: at 3 px several laps overlapping on a corner merged into one band.
export const LINE_WIDTH = 2;
// screen px
export const CUT_ARM = 5;
export const CUT_WIDTH = 2.5;
export const CUT_HALO_WIDTH = 5;
export const VIEW_MARGIN = 0.15;
export const VIEW_EASE = 0.06;
// m; a smaller floor stretches the first few corners across the whole canvas
// before the track's real size is known.
export const FIRST_LAP_EXTENT = 1500;

export const ZOOM_MAX = 40;
export const ZOOM_STEP = 1.2;
export const ZOOM_RESET: Zoom = { level: 1, ox: 0, oy: 0 };
// Fingers can't land on exactly 1×, so a pinch ending below this snaps to the fit view.
export const ZOOM_SNAP_LEVEL = 1.02;
// Between notches one and two, not at two, so float drift in the accumulated
// wheel level can never put notch two just below it.
export const INSET_MIN_LEVEL = ZOOM_STEP ** 1.5;

// Long enough that brushing past the button never arms it, short enough not to feel like a wait.
export const FOLLOW_DWELL_MS = 1000;
// Must match FOLLOW_DWELL_MS. A whole literal because Tailwind scans source text:
// an interpolated `duration-[${ms}ms]` would never be generated.
export const DWELL_FILL_CLASS = "duration-[1000ms]";
export const FOLLOW_WINDOW_M = 250;
export const FOLLOW_MIN_WINDOW_M = 100;
// Below 1 so the widest follow window never renders at exactly 1×, where a
// car-centred view would contradict the fit framing; 1 makes it reachable.
export const FOLLOW_WINDOW_HEADROOM = 0.95;
// Applied against wall-clock dt, not per frame, so every camera glide runs at
// the same speed on any display refresh rate and through dropped frames.
export const FOLLOW_TAU_S = 0.3;
// Must exceed the worst frame gap (Windows timer quantization at the bridge, demo
// burst replay: up to 40 ms) for interpolation to yield constant-velocity motion.
export const FOLLOW_DELAY_MS = 120;
export const ANCHOR_SNAP_M = 100;
// Short enough to feel immediate, long enough that sweeping across the inset never commits a jump.
export const INSET_DWELL_MS = 250;
export const INSET_REST_SLOP_PX = 3;
// Newest samples kept out of the cached layer so the line never pokes ahead of
// the delayed dot: ~100 m/s × FOLLOW_DELAY_MS ≈ 12 m at 1 m spacing.
export const TIP_HOLDBACK = 16;
export const INSET_CAR_RADIUS = 2.5;
