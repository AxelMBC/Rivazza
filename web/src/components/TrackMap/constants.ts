import type { Zoom } from "./overviewInset";

export const PADDING = 24;
export const DOT_RADIUS = 7;
// Directional car marker: the protocol carries no yaw, so heading is derived
// from motion — two world anchors of the rendered dot position at least this
// far apart. The baseline makes the angle inherently stable (AC positions are
// millimetric — no angular smoothing needed), and a stationary car simply
// stops updating the anchors, holding the last heading.
export const HEADING_BASELINE_M = 0.75;
export const STEER_FULL_DEG = 90; // steering-wheel degrees at full tick deflection
export const STEER_TICK_LEN = 8; // screen px, zoom-invariant like DOT_RADIUS
export const SAMPLE_SPACING = 1; // meters between line samples — fine enough for exact corner shapes
export const MAX_SAMPLES = 25000; // hard cap so a stuck lap counter can't grow unbounded
export const MAX_LAPS = 40; // completed laps kept on the map (oldest dropped beyond this)
export const HOVER_RADIUS_SQ = 12 * 12; // px² — how close the cursor must be to pick a lap line
export const TELEPORT_DIST = 100; // a jump this large between frames isn't driving
export const DEAD_ZONE = 0.05;
// Thin on purpose: several laps overlap on the same corner, and at 3 px they
// merged into one band. The map's job is to let lines be told apart.
export const LINE_WIDTH = 2;
// Cut × geometry in screen pixels — zoom-invariant because the projection
// scales points, not the canvas transform.
export const CUT_ARM = 5;
export const CUT_WIDTH = 2.5;
export const CUT_HALO_WIDTH = 5;
export const VIEW_MARGIN = 0.15; // extra space around the driven bounds (fallback mode)
export const VIEW_EASE = 0.06; // per-frame easing toward the target view (fallback mode)
// Until a full lap exists the track's real size is unknown — assume at least
// this many meters so the view starts zoomed out instead of stretching the
// first few corners across the whole canvas.
export const FIRST_LAP_EXTENT = 1500;

// Cursor-anchored wheel zoom: exponential per notch, clamped so 1× is exactly
// the fit view (scrolling fully out is the reset gesture — no reset control).
// While the follow cam is tracking, the same per-notch factor scales its world
// window instead, so one notch feels identical in both modes.
export const ZOOM_MAX = 40;
export const ZOOM_STEP = 1.2;
export const ZOOM_RESET: Zoom = { level: 1, ox: 0, oy: 0 };
// A pinch ending this close to 1× snaps to the exact fit framing — the touch
// counterpart of the wheel path's exact-1 reset (fingers can't land on 1.0).
export const ZOOM_SNAP_LEVEL = 1.02;
// The overview inset shows from the second wheel notch in. Pinned between the
// first and second notch levels, not at the second, so float rounding in the
// accumulated wheel level can never put notch two just below it.
export const INSET_MIN_LEVEL = ZOOM_STEP ** 1.5;

// One second: long enough that brushing past the button on the way to the
// canvas never arms it, short enough not to feel like a wait.
export const FOLLOW_DWELL_MS = 1000;
// Progress-bar fill duration, matched to FOLLOW_DWELL_MS. A whole literal class
// string because Tailwind scans source text — an interpolated
// `duration-[${ms}ms]` would never be generated.
export const DWELL_FILL_CLASS = "duration-[1000ms]";
// Comfortable tracking zoom: this many world meters across the smaller
// canvas dimension, regardless of track size or projection mode. Where the
// wheel starts from and what the session reset returns to.
export const FOLLOW_WINDOW_M = 250;
// Tightest framing follow mode allows, whatever ZOOM_MAX would permit. Below
// roughly this the canvas holds little but the car and the line it just drove:
// the corner ahead is off-screen, so the map stops telling you anything the
// pedal traces don't. Keeping a floor keeps some track in view.
export const FOLLOW_MIN_WINDOW_M = 100;
// How far the widest follow window stays inside the window that would render
// at exactly 1×. The gap is what makes the degenerate framing (1× scale, but
// panned to centre the car — a combination nothing else in the map can
// produce, and a contradiction of the fit view 1× denotes) unreachable rather
// than merely unlikely.
export const FOLLOW_WINDOW_HEADROOM = 0.95;
// Time-based smoothing (seconds to close ~63% of the remaining gap) so the
// camera moves at the same speed on any display refresh rate and glides
// straight through dropped frames.
export const FOLLOW_TAU_S = 0.3; // camera glide — entry animation and tracking lag alike
// The tracked point renders a fixed delay in the past, linearly interpolated
// between buffered raw frames. Frames arrive unevenly (Windows timer
// quantization at the bridge, burst delivery in demo replay — recorded gaps
// reach 40 ms), and interpolating across a delay longer than the worst gap
// turns that into constant-velocity motion. Exponential smoothing can't do
// this: it inherits the target's unevenness at every step.
export const FOLLOW_DELAY_MS = 120;
export const ANCHOR_SNAP_M = 100; // a jump this large is a teleport — snap, don't glide
// Overview inset: a cursor resting this long navigates. Short enough to feel
// immediate, long enough that sweeping across the inset on the way elsewhere
// never commits a jump.
export const INSET_DWELL_MS = 250;
export const INSET_REST_SLOP_PX = 3; // hand tremor under this still counts as resting
// The current-lap line must never poke out ahead of the (delayed) dot, so
// this many newest samples stay out of the cached layer and are drawn each
// frame only up to the dot. Sized for the delay at top speed (~100 m/s ×
// 120 ms ≈ 12 m at 1 m sample spacing).
export const TIP_HOLDBACK = 16;
export const INSET_CAR_RADIUS = 2.5;
