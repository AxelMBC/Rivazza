import { useEffect, useRef, useState } from "react";

import type { LapRecord } from "../hooks/useLapHistory";
import type { LapRecording } from "../hooks/useLapRecordings";
import { BRIDGE_HTTP } from "../hooks/useTelemetry";
import { DEMO_MAP_URL, IS_DEMO } from "../lib/demo";
import { formatGearCompact, formatLapTime } from "../lib/format";
import { CLICK_MODE, isImmediateActivation } from "../lib/interaction";
import {
  SECTOR_COUNT,
  sectorOwners,
  type ScrubPoint,
  type SectorOwner,
} from "../lib/lapAnalysis";
import { COLORED_LAPS, lapColor } from "../lib/lapColors";
import {
  baseToInset,
  centreZoomOn,
  insetRect,
  insetToBase,
  insideRect,
  viewCentre,
  viewportInInset,
  type Inset,
  type Point,
  type Rect,
  type Zoom,
} from "../lib/overviewInset";
import { SYNTHETIC_MOUSE_WINDOW_MS, TAP_SLOP_PX } from "../lib/touch";
import type {
  CutEvent,
  MapMeta,
  SessionInfo,
  TelemetryFrame,
  TrackEdges,
} from "../types";

type Props = {
  session: SessionInfo;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  lapsRef: React.RefObject<LapRecord[]>;
  cutsRef: React.RefObject<CutEvent[]>;
  hoveredLapRef: React.RefObject<number | null>;
  scrubRef: React.RefObject<ScrubPoint | null>;
  analysisLapRef: React.RefObject<number | null>;
  recordingsRef: React.RefObject<LapRecording[]>;
  recordingsVersion: number;
};

type MapData = { meta: MapMeta | null; edges: TrackEdges | null };

type Sample = {
  x: number;
  z: number;
  gas: number;
  brake: number;
  speedKmh: number;
  gear: number;
  jump: boolean;
};
type CutMarker = { x: number; z: number };
// A world point plus a unit direction pointing off the track. Projecting the
// direction turns it into a screen offset that holds at any zoom.
type Anchor = { x: number; z: number; dx: number; dz: number };
type View = { cx: number; cz: number; ex: number; ez: number };
type LegendEntry = {
  lap: number;
  color: string;
  timeMs: number | null;
  invalid: boolean;
};

const PADDING = 24;
const DOT_RADIUS = 7;
// Directional car marker: the protocol carries no yaw, so heading is derived
// from motion — two world anchors of the rendered dot position at least this
// far apart. The baseline makes the angle inherently stable (AC positions are
// millimetric — no angular smoothing needed), and a stationary car simply
// stops updating the anchors, holding the last heading.
const HEADING_BASELINE_M = 0.75;
const STEER_FULL_DEG = 90; // steering-wheel degrees at full tick deflection
const STEER_TICK_LEN = 8; // screen px, zoom-invariant like DOT_RADIUS
const SAMPLE_SPACING = 1; // meters between line samples — fine enough for exact corner shapes
const MAX_SAMPLES = 25000; // hard cap so a stuck lap counter can't grow unbounded
const MAX_LAPS = 40; // completed laps kept on the map (oldest dropped beyond this)
const HOVER_RADIUS_SQ = 12 * 12; // px² — how close the cursor must be to pick a lap line
const TELEPORT_DIST = 100; // a jump this large between frames isn't driving
const DEAD_ZONE = 0.05;
// Thin on purpose: several laps overlap on the same corner, and at 3 px they
// merged into one band. The map's job is to let lines be told apart.
const LINE_WIDTH = 2;
// Cut × geometry in screen pixels — zoom-invariant because the projection
// scales points, not the canvas transform.
const CUT_ARM = 5;
const CUT_WIDTH = 2.5;
const CUT_HALO_WIDTH = 5;
const VIEW_MARGIN = 0.15; // extra space around the driven bounds (fallback mode)
const VIEW_EASE = 0.06; // per-frame easing toward the target view (fallback mode)
// Until a full lap exists the track's real size is unknown — assume at least
// this many meters so the view starts zoomed out instead of stretching the
// first few corners across the whole canvas.
const FIRST_LAP_EXTENT = 1500;

// Cursor-anchored wheel zoom: exponential per notch, clamped so 1× is exactly
// the fit view (scrolling fully out is the reset gesture — no reset control).
// While the follow cam is tracking, the same per-notch factor scales its world
// window instead, so one notch feels identical in both modes.
const ZOOM_MAX = 40;
const ZOOM_STEP = 1.2;
const ZOOM_RESET: Zoom = { level: 1, ox: 0, oy: 0 };
// A pinch ending this close to 1× snaps to the exact fit framing — the touch
// counterpart of the wheel path's exact-1 reset (fingers can't land on 1.0).
const ZOOM_SNAP_LEVEL = 1.02;
// The overview inset shows from the second wheel notch in. Pinned between the
// first and second notch levels, not at the second, so float rounding in the
// accumulated wheel level can never put notch two just below it.
const INSET_MIN_LEVEL = ZOOM_STEP ** 1.5;

// Follow cam: hover-dwell armed (never a click — clicks would focus the
// browser and steal controller input from the game). 'following' tracks the
// car, 'detached' is manual zoom/pan after a touch drag interrupted a follow
// (the exit button stays), 'exiting' animates back to the 1× fit view.
type FollowState = "off" | "following" | "detached" | "exiting";
// One second: long enough that brushing past the button on the way to the
// canvas never arms it, short enough not to feel like a wait.
const FOLLOW_DWELL_MS = 1000;
// Progress-bar fill duration, matched to FOLLOW_DWELL_MS. A whole literal class
// string because Tailwind scans source text — an interpolated
// `duration-[${ms}ms]` would never be generated.
const DWELL_FILL_CLASS = "duration-[1000ms]";
// Comfortable tracking zoom: this many world meters across the smaller
// canvas dimension, regardless of track size or projection mode. Where the
// wheel starts from and what the session reset returns to.
const FOLLOW_WINDOW_M = 250;
// Tightest framing follow mode allows, whatever ZOOM_MAX would permit. Below
// roughly this the canvas holds little but the car and the line it just drove:
// the corner ahead is off-screen, so the map stops telling you anything the
// pedal traces don't. Keeping a floor keeps some track in view.
const FOLLOW_MIN_WINDOW_M = 100;
// How far the widest follow window stays inside the window that would render
// at exactly 1×. The gap is what makes the degenerate framing (1× scale, but
// panned to centre the car — a combination nothing else in the map can
// produce, and a contradiction of the fit view 1× denotes) unreachable rather
// than merely unlikely.
const FOLLOW_WINDOW_HEADROOM = 0.95;
// Time-based smoothing (seconds to close ~63% of the remaining gap) so the
// camera moves at the same speed on any display refresh rate and glides
// straight through dropped frames.
const FOLLOW_TAU_S = 0.3; // camera glide — entry animation and tracking lag alike
// The tracked point renders a fixed delay in the past, linearly interpolated
// between buffered raw frames. Frames arrive unevenly (Windows timer
// quantization at the bridge, burst delivery in demo replay — recorded gaps
// reach 40 ms), and interpolating across a delay longer than the worst gap
// turns that into constant-velocity motion. Exponential smoothing can't do
// this: it inherits the target's unevenness at every step.
const FOLLOW_DELAY_MS = 120;
const ANCHOR_SNAP_M = 100; // a jump this large is a teleport — snap, don't glide
// Overview inset: a cursor resting this long navigates. Short enough to feel
// immediate, long enough that sweeping across the inset on the way elsewhere
// never commits a jump.
const INSET_DWELL_MS = 250;
const INSET_REST_SLOP_PX = 3; // hand tremor under this still counts as resting
// The current-lap line must never poke out ahead of the (delayed) dot, so
// this many newest samples stay out of the cached layer and are drawn each
// frame only up to the dot. Sized for the delay at top speed (~100 m/s ×
// 120 ms ≈ 12 m at 1 m sample spacing).
const TIP_HOLDBACK = 16;

const SURFACE = "#1a1a19";
// Track-limits ribbon: asphalt just above the panel surface, edge strokes
// muted so the pedal-colored lines stay visually dominant.
const TRACK_FILL = "#242422";
const TRACK_EDGE = "rgba(255, 255, 255, 0.28)";
const PREVIOUS_LAP = "rgba(255, 255, 255, 0.45)";
const HOVERED_GREY_LAP = "#ffffff"; // uncolored laps brighten to solid white on hover
const INVALID_TIME = "#f0554b"; // theme critical, brightened for the small canvas label
// The track edge stays neutral and thin. Lap-identity hues here read as a
// second set of driving lines and swamp the real ones — the division is
// carried by the boundary ticks and the labels instead, so the only saturated
// colour on the map is a lap's own line.
const TRACK_EDGE_WIDTH = 1.25;
// Hover brightens the edge, it does not thicken it: a width change shifts the
// track's apparent limits, which is the one thing the edge must not do.
const SECTOR_EDGE_HOVER = "rgba(255, 255, 255, 0.95)";
// Boundary ticks point outward from the edge only. Nothing is ever drawn
// across the asphalt.
const SECTOR_TICK_LEN = 7;
const SECTOR_TICK_WIDTH = 1.5;
const SECTOR_TICK = "rgba(255, 255, 255, 0.5)";
const SECTOR_LABEL_FONT = "600 10px system-ui";
const SECTOR_LABEL_FONT_ON = "700 11px system-ui";
const SECTOR_LABEL_HALO = 3;
const SECTOR_LABEL_OFFSET = 15; // screen px clear of the edge
const SECTOR_LABEL_IDLE = "rgba(255, 255, 255, 0.4)";
const STEER_TICK_COLOR = "#3987e5"; // theme accent, mirrors --color-accent
const INSET_BORDER = "rgba(255, 255, 255, 0.1)"; // mirrors --color-edge
const INSET_VIEWPORT = "rgba(255, 255, 255, 0.75)";
const INSET_GHOST = "#3987e5"; // theme accent, mirrors --color-accent
const INSET_GHOST_FILL = "rgba(57, 135, 229, 0.18)";
const INSET_CAR_RADIUS = 2.5;

// Pedal-state colors: coast (yellow) blends toward throttle (green) or
// brake (red) with pedal magnitude, so partial inputs read as softer tones.
const COAST: [number, number, number] = [250, 178, 25];
const THROTTLE: [number, number, number] = [18, 190, 60];
const BRAKE: [number, number, number] = [235, 55, 45];

const lerpColor = (
  from: [number, number, number],
  to: [number, number, number],
  t: number,
) => {
  const c = from.map((f, i) =>
    Math.round(f + (to[i] - f) * Math.min(1, Math.max(0, t))),
  );
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

// Pedal colors quantized into a small set of buckets so the current lap's
// line batches into one native path stroke per bucket instead of a canvas
// stroke per segment — the difference between a flat and a linearly growing
// per-frame cost while the camera moves. 12 steps per ramp is visually
// indistinguishable from the continuous lerp at 3 px line width.
// Key: 0 = coast, positive = throttle bucket, negative = brake bucket.
const COLOR_QUANT = 12;
const bucketKey = (gas: number, brake: number): number => {
  if (brake > DEAD_ZONE && brake >= gas)
    return -Math.max(1, Math.round(brake * COLOR_QUANT));
  if (gas > DEAD_ZONE) return Math.max(1, Math.round(gas * COLOR_QUANT));
  return 0;
};
const bucketColor = (key: number): string => {
  if (key < 0) return lerpColor(COAST, BRAKE, -key / COLOR_QUANT);
  if (key > 0) return lerpColor(COAST, THROTTLE, key / COLOR_QUANT);
  return `rgb(${COAST[0]}, ${COAST[1]}, ${COAST[2]})`;
};

// Index runs of the edge polylines, one per sector, from the normalized
// positions the bridge ships with the edges. Adjacent runs share their
// boundary vertex so the strokes meet with no seam; on a closed circuit the
// last run wraps back to vertex 0. Positions are monotonic, so one pass finds
// every run's start.
const sectorVertexRuns = (
  pos: readonly number[],
  count: number,
  closed: boolean,
): number[][] => {
  const starts = new Array<number>(count).fill(-1);
  for (let i = 0; i < pos.length; i++) {
    const s = Math.min(count - 1, Math.max(0, Math.floor(pos[i] * count)));
    if (starts[s] < 0) starts[s] = i;
  }
  return starts.map((from, s) => {
    if (from < 0) return [];
    let next = -1;
    for (let t = s + 1; t < count && next < 0; t++) next = starts[t];
    const end = next >= 0 ? next : pos.length - 1;
    const run: number[] = [];
    for (let i = from; i <= end; i++) run.push(i);
    if (next < 0 && closed) run.push(0);
    return run;
  });
};

const freshBounds = () => ({
  minX: Infinity,
  maxX: -Infinity,
  minZ: Infinity,
  maxZ: -Infinity,
});

export const TrackMap = ({
  session,
  telemetryRef,
  lapsRef,
  cutsRef,
  hoveredLapRef,
  scrubRef,
  analysisLapRef,
  recordingsRef,
  recordingsVersion,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingsVersionRef = useRef(recordingsVersion);
  recordingsVersionRef.current = recordingsVersion;
  const sectorOwnersRef = useRef<(SectorOwner | null)[]>([]);
  const currentRef = useRef<Sample[]>([]);
  const previousLapsRef = useRef<
    {
      lap: number;
      samples: Sample[];
      cut: CutMarker | null;
      path?: Path2D;
    }[]
  >([]);

  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapProbed, setMapProbed] = useState(false);

  const currentCutRef = useRef<CutMarker | null>(null);
  const consumedCutsRef = useRef(0);
  const seenCutsRef = useRef<CutEvent[] | null>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const lapRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const boundsRef = useRef(freshBounds());
  const viewRef = useRef<View | null>(null);
  const anchorRef = useRef<{ x: number; z: number } | null>(null);
  const zoomRef = useRef<Zoom>(ZOOM_RESET);
  const navRef = useRef<Point | null>(null);
  const followWindowRef = useRef(FOLLOW_WINDOW_M);
  const followLimitsRef = useRef({ min: 0, max: Infinity });
  const followRef = useRef<FollowState>("off");
  const [followUi, setFollowUi] = useState<FollowState>("off");
  const setFollow = (state: FollowState) => {
    followRef.current = state;
    setFollowUi(state);
  };
  const dwellTimerRef = useRef<number | null>(null);
  const armReadyRef = useRef(true);
  const touchToggleAtRef = useRef(-SYNTHETIC_MOUSE_WINDOW_MS);
  const [dwelling, setDwelling] = useState(false);
  const cancelDwell = () => {
    if (dwellTimerRef.current !== null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    setDwelling(false);
  };

  const cameraDrivesView = () =>
    followRef.current === "following" || followRef.current === "exiting";

  const retargetFollow = (factor: number) => {
    const wanted = followWindowRef.current * factor;
    if (wanted > followLimitsRef.current.max) return false;
    followWindowRef.current = wanted;
    return true;
  };

  const fireDwell = () => {
    if (followRef.current !== "off") {
      setFollow("exiting");
    } else if (telemetryRef.current) {
      setFollow("following");
    }
  };

  const startDwell = () => {
    if (CLICK_MODE) return;
    if (
      performance.now() - touchToggleAtRef.current <
      SYNTHETIC_MOUSE_WINDOW_MS
    )
      return;
    if (!armReadyRef.current) return;
    cancelDwell();
    setDwelling(true);
    dwellTimerRef.current = window.setTimeout(() => {
      dwellTimerRef.current = null;
      armReadyRef.current = false;
      setDwelling(false);
      fireDwell();
    }, FOLLOW_DWELL_MS);
  };

  const leaveDwell = () => {
    armReadyRef.current = true;
    cancelDwell();
  };

  const onFollowActivate = (e: React.PointerEvent) => {
    if (!isImmediateActivation(e)) return;
    touchToggleAtRef.current = performance.now();
    leaveDwell();
    const st = followRef.current;
    if (st === "off") {
      if (telemetryRef.current) setFollow("following");
    } else if (st !== "exiting") {
      setFollow("exiting");
    }
  };
  const hasFrameRef = useRef(false);
  const legendKeyRef = useRef("");

  const [hasFrame, setHasFrame] = useState(false);
  const [legend, setLegend] = useState<LegendEntry[]>([]);

  const resetLines = () => {
    currentRef.current = [];
    previousLapsRef.current = [];
    currentCutRef.current = null;
    lapRef.current = null;
    lapTimeRef.current = 0;
    boundsRef.current = freshBounds();
    viewRef.current = null;
    anchorRef.current = null;
    zoomRef.current = ZOOM_RESET;
    navRef.current = null;
    // Session change / restart ends follow mode with everything else, and any
    // adjusted framing goes with it — the next follow starts comfortable again.
    // The published bounds go too: the new session may be a different track, so
    // "not known until the camera says so" is exactly true again.
    cancelDwell();
    followWindowRef.current = FOLLOW_WINDOW_M;
    followLimitsRef.current = { min: 0, max: Infinity };
    setFollow("off");
  };

  // The dwell timeout must not fire into an unmounted component.
  useEffect(() => cancelDwell, []);

  useEffect(() => {
    resetLines();
    setMapData(null);
    setMapProbed(false);

    // Always probe the bridge instead of trusting session flags — a page
    // holding a stale session must still pick up bounds the bridge has now.
    let cancelled = false;
    const probe = async <T,>(url: string): Promise<T | null> => {
      try {
        const res = await fetch(url);
        return res.ok ? ((await res.json()) as T) : null;
      } catch {
        // bridge unreachable; treated as no map data
        return null;
      }
    };
    const load = async () => {
      // Demo mode has no bridge: the outline is a static file recorded next to
      // the session (see lib/demo.ts). Everything downstream is identical.
      if (IS_DEMO) {
        const data = await probe<MapData>(DEMO_MAP_URL);
        if (cancelled) return;
        if (data && (data.meta || data.edges))
          setMapData({ meta: data.meta ?? null, edges: data.edges ?? null });
        setMapProbed(true);
        return;
      }
      const [meta, edges] = await Promise.all([
        probe<MapMeta>(`${BRIDGE_HTTP}/api/track-map/meta`),
        probe<TrackEdges>(`${BRIDGE_HTTP}/api/track-map/edges`),
      ]);
      if (cancelled) return;
      if (meta || edges) setMapData({ meta, edges });
      setMapProbed(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Offscreen layers so a typical frame is a few blits plus the segments
    // added since the last one — instead of re-projecting and re-stroking
    // every stored lap. All live only as long as this effect (mapData/session).
    const lapsLayer = document.createElement("canvas");
    const lapsLayerCtx = lapsLayer.getContext("2d");
    const currentLayer = document.createElement("canvas");
    const currentLayerCtx = currentLayer.getContext("2d");
    const trackLayer = document.createElement("canvas");
    const trackLayerCtx = trackLayer.getContext("2d");
    const insetLayer = document.createElement("canvas");
    const insetLayerCtx = insetLayer.getContext("2d");
    if (!lapsLayerCtx || !currentLayerCtx || !trackLayerCtx || !insetLayerCtx)
      return;
    let rafId = 0;

    const edges = mapData?.edges ?? null;
    // Track edges without map.ini: the ribbon's world bounds (plus margin)
    // fix the viewport — the same never-moving guarantee as the metadata fit.
    let edgeView: View | null = null;
    // The centre is also what decides which way a sector label faces, so the
    // bounds are taken whenever edges exist, not only in the no-metadata case.
    let edgeCentre: { x: number; z: number } | null = null;
    if (edges) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const line of [edges.left, edges.right]) {
        for (const [x, z] of line) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        }
      }
      edgeCentre = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
      if (!mapData?.meta)
        edgeView = {
          cx: edgeCentre.x,
          cz: edgeCentre.z,
          ex: Math.max(maxX - minX, 50) * (1 + VIEW_MARGIN * 2),
          ez: Math.max(maxZ - minZ, 50) * (1 + VIEW_MARGIN * 2),
        };
    }

    // Static world-space ribbon geometry, built once for the effect's life.
    const traceInto = (
      path: Path2D,
      line: [number, number][],
      reverse: boolean,
      move: boolean,
    ) => {
      for (let i = 0; i < line.length; i++) {
        const [x, z] = line[reverse ? line.length - 1 - i : i];
        if (i === 0 && move) path.moveTo(x, z);
        else path.lineTo(x, z);
      }
    };
    let edgesFill: Path2D | null = null;
    let sectorEdges: { left: Path2D; right: Path2D }[] = [];
    let sectorLabels: (Anchor | null)[] = [];
    let sectorTicks: (Anchor | null)[][] = [];
    if (edges) {
      // Closed circuits fill as an annulus: the two edge rings run in
      // opposite directions, so the nonzero rule leaves the infield empty.
      // Open splines (hillclimbs) fill as a single strip.
      edgesFill = new Path2D();
      if (edges.closed) {
        traceInto(edgesFill, edges.left, false, true);
        edgesFill.closePath();
        traceInto(edgesFill, edges.right, true, true);
        edgesFill.closePath();
      } else {
        traceInto(edgesFill, edges.left, false, true);
        traceInto(edgesFill, edges.right, true, false);
        edgesFill.closePath();
      }
      const runs = sectorVertexRuns(edges.pos, SECTOR_COUNT, edges.closed);
      const traceRun = (line: [number, number][], run: number[]) => {
        const p = new Path2D();
        run.forEach((i, k) => {
          const [x, z] = line[i];
          if (k === 0) p.moveTo(x, z);
          else p.lineTo(x, z);
        });
        return p;
      };
      sectorEdges = runs.map((run) => ({
        left: traceRun(edges.left, run),
        right: traceRun(edges.right, run),
      }));

      // Anchors carry a world-unit direction pointing off the track, which
      // projecting turns into a fixed screen offset at any zoom. Both edges at
      // a sector's first vertex give the boundary ticks; the mid vertex of
      // whichever edge faces away from the track's centre gives the label, so
      // all eight land outside the circuit rather than some in the infield.
      const centre = edgeCentre;
      const anchorAt = (i: number, side: "left" | "right"): Anchor | null => {
        const [lx, lz] = edges.left[i];
        const [rx, rz] = edges.right[i];
        const span = Math.hypot(rx - lx, rz - lz);
        if (span === 0) return null;
        const ux = (rx - lx) / span;
        const uz = (rz - lz) / span;
        return side === "left"
          ? { x: lx, z: lz, dx: -ux, dz: -uz }
          : { x: rx, z: rz, dx: ux, dz: uz };
      };
      const outwardness = (a: Anchor | null) =>
        a && centre
          ? (a.x - centre.x) * a.dx + (a.z - centre.z) * a.dz
          : -Infinity;

      sectorTicks = runs.map((run) =>
        run.length === 0
          ? []
          : [anchorAt(run[0], "left"), anchorAt(run[0], "right")],
      );
      sectorLabels = runs.map((run) => {
        if (run.length === 0 || !centre) return null;
        const i = run[run.length >> 1];
        const left = anchorAt(i, "left");
        const right = anchorAt(i, "right");
        return outwardness(left) > outwardness(right) ? left : right;
      });
    }

    type Projected = { px: number; py: number };
    type Project = (p: { x: number; z: number }) => Projected;

    // Screen-space zoom over a base fit projection. Points (not the canvas
    // transform) are scaled, so stroke widths, the dot radius, and the hover
    // pick radius stay constant in screen pixels at every zoom level.
    const zoomed =
      (base: Project): Project =>
      (p) => {
        const { px, py } = base(p);
        const zm = zoomRef.current;
        return { px: px * zm.level + zm.ox, py: py * zm.level + zm.oy };
      };

    // Every projection here is a uniform-scale, axis-aligned affine map
    // (px = k·x + tx, py = k·z + ty), so world-space Path2D geometry renders
    // in one native stroke under the canvas transform instead of a JS loop
    // per point — the flat per-frame cost that keeps a moving camera at
    // 60 fps. The coefficients are read off the live projection numerically
    // so this works identically in all three modes at any zoom state.
    type Affine = { k: number; tx: number; ty: number };
    const affineOf = (project: Project): Affine => {
      const o = project({ x: 0, z: 0 });
      const u = project({ x: 1, z: 0 });
      return { k: u.px - o.px, tx: o.px, ty: o.py };
    };

    // Stroke widths divide by the scale so they stay constant in screen
    // pixels at every zoom level — same guarantee as point-space rendering.
    const strokeWorldPath = (
      target: CanvasRenderingContext2D,
      path: Path2D,
      { k, tx, ty }: Affine,
      dpr: number,
      color: string,
      widthPx: number,
    ) => {
      target.save();
      target.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);
      target.strokeStyle = color;
      target.lineWidth = widthPx / k;
      target.lineCap = "round";
      target.lineJoin = "round";
      target.stroke(path);
      target.restore();
    };

    // World-space lap line, jumps as subpath breaks. Built once per lap and
    // reused at every zoom and camera state.
    const buildLapPath = (samples: Sample[]): Path2D => {
      const path = new Path2D();
      samples.forEach((s, i) => {
        if (i === 0 || s.jump) path.moveTo(s.x, s.z);
        else path.lineTo(s.x, s.z);
      });
      return path;
    };

    const sizeLayer = (layer: HTMLCanvasElement, w: number, h: number) => {
      if (layer.width !== w || layer.height !== h) {
        layer.width = w;
        layer.height = h;
      }
    };

    // Layers hold device pixels sized exactly like the main canvas, so they
    // blit 1:1 in device space — pixel-identical to drawing directly.
    const blitLayer = (layer: HTMLCanvasElement) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    };

    // Cache invalidation state. `lapsVersion` counts every mutation of
    // previousLapsRef (push/shift/reset) because at MAX_LAPS a rollover keeps
    // the array length constant. `appendedCount` is how many current-lap
    // samples are already drawn into currentLayer.
    let lapsVersion = 0;
    let lapsLayerKey = "";
    let currentLayerKey = "";
    let appendedCount = 0;
    let trackLayerKey = "";
    let insetLayerKey = "";
    // The inset as last painted, null while hidden. Handlers hit-test against
    // this, so the hit area is always exactly what is on screen.
    let inset: Inset | null = null;

    // The sector's number and its owning lap, set off the asphalt. The lap
    // number is on the map deliberately: the identity palette is shorter than
    // the sector count, so two sectors can share a hue and colour alone cannot
    // name an owner. Offsetting 1 m along the outward world direction fixes
    // the label's screen direction, keeping its distance from the edge
    // constant at any zoom.
    // Projecting the anchor and a point 1 m along its outward direction turns
    // a world direction into a screen one, so a tick or a label keeps the same
    // distance from the track edge at every zoom level.
    const outwardScreen = (project: Project, anchor: Anchor) => {
      const a = project(anchor);
      const n = project({ x: anchor.x + anchor.dx, z: anchor.z + anchor.dz });
      const len = Math.hypot(n.px - a.px, n.py - a.py);
      if (len === 0) return null;
      return { ...a, ux: (n.px - a.px) / len, uy: (n.py - a.py) / len };
    };

    // A boundary mark that grows outward from the edge and never onto the
    // asphalt — the racing line is what the map is for, and a mark across it
    // both hides it and reads as a braking or cut marker.
    const drawSectorTick = (
      target: CanvasRenderingContext2D,
      project: Project,
      anchor: Anchor | null,
      emphasized: boolean,
    ) => {
      if (!anchor) return;
      const o = outwardScreen(project, anchor);
      if (!o) return;
      const len = emphasized ? SECTOR_TICK_LEN * 1.6 : SECTOR_TICK_LEN;
      target.strokeStyle = emphasized ? SECTOR_EDGE_HOVER : SECTOR_TICK;
      target.lineWidth = SECTOR_TICK_WIDTH;
      target.lineCap = "round";
      target.beginPath();
      target.moveTo(o.px, o.py);
      target.lineTo(o.px + o.ux * len, o.py + o.uy * len);
      target.stroke();
    };

    // The owning lap is named in text rather than painted onto the track: the
    // identity palette is shorter than the sector count, so colour alone could
    // not name an owner anyway, and hues on the edges drown the driving lines.
    const drawSectorLabel = (
      target: CanvasRenderingContext2D,
      project: Project,
      sector: number,
      owner: SectorOwner | null,
      emphasized: boolean,
    ) => {
      const anchor = sectorLabels[sector];
      if (!anchor) return;
      const o = outwardScreen(project, anchor);
      if (!o) return;
      const px = o.px + o.ux * SECTOR_LABEL_OFFSET;
      const py = o.py + o.uy * SECTOR_LABEL_OFFSET;
      const text = owner
        ? `S${sector + 1} · L${owner.lap}${owner.invalid ? " INV" : ""}`
        : `S${sector + 1}`;
      target.font = emphasized ? SECTOR_LABEL_FONT_ON : SECTOR_LABEL_FONT;
      target.textAlign = "center";
      target.textBaseline = "middle";
      target.lineJoin = "round";
      target.lineWidth = SECTOR_LABEL_HALO;
      target.strokeStyle = SURFACE;
      target.strokeText(text, px, py);
      target.fillStyle = owner?.invalid
        ? INVALID_TIME
        : emphasized
          ? HOVERED_GREY_LAP
          : owner
            ? lapColor(owner.lap)
            : SECTOR_LABEL_IDLE;
      target.fillText(text, px, py);
      target.textAlign = "left";
      target.textBaseline = "alphabetic";
    };

    // The track-limits ribbon under everything else, and the sector division
    // its edge strokes carry. Edge geometry is static for the session, so the
    // layer re-renders only when the projection changes (zoom, resize, DPR) or
    // when sector ownership does — a lap completing or being invalidated.
    // Every other frame just re-blits it.
    const renderTrackLayer = (
      project: Project,
      projKey: string,
      width: number,
      height: number,
      dpr: number,
    ) => {
      if (!edges || !edgesFill) return;
      const key = `${projKey}|${sectorKey}`;
      if (key !== trackLayerKey) {
        trackLayerKey = key;
        sizeLayer(trackLayer, canvas.width, canvas.height);
        trackLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        trackLayerCtx.clearRect(0, 0, width, height);

        const aff = affineOf(project);
        trackLayerCtx.save();
        trackLayerCtx.setTransform(
          dpr * aff.k,
          0,
          0,
          dpr * aff.k,
          dpr * aff.tx,
          dpr * aff.ty,
        );
        trackLayerCtx.fillStyle = TRACK_FILL;
        trackLayerCtx.fill(edgesFill);
        trackLayerCtx.restore();

        // The edge strokes are the actual track limits and stay neutral: a
        // lap-identity hue here reads as another driving line and swamps the
        // real ones. The division is carried by outward boundary ticks and by
        // the labels, so nothing is drawn across the asphalt and the only
        // saturated colour on the map is a lap's own line.
        sectorEdges.forEach((sector, s) => {
          for (const path of [sector.left, sector.right])
            strokeWorldPath(
              trackLayerCtx,
              path,
              aff,
              dpr,
              TRACK_EDGE,
              TRACK_EDGE_WIDTH,
            );
          for (const anchor of sectorTicks[s] ?? [])
            drawSectorTick(trackLayerCtx, project, anchor, false);
          drawSectorLabel(
            trackLayerCtx,
            project,
            s,
            sectorOwnersRef.current[s],
            false,
          );
        });
      }
      blitLayer(trackLayer);
    };

    // All completed laps except the hovered one (kept out so the emphasis
    // pass reproduces today's exact skip-and-redraw pixels).
    const renderLapsLayer = (
      project: Project,
      projKey: string,
      hoveredIndex: number,
      width: number,
      height: number,
      dpr: number,
    ) => {
      const laps = previousLapsRef.current;
      const key = `${projKey}|${lapsVersion}|${hoveredIndex}`;
      if (key === lapsLayerKey) return;
      lapsLayerKey = key;
      sizeLayer(lapsLayer, canvas.width, canvas.height);
      lapsLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lapsLayerCtx.clearRect(0, 0, width, height);
      // The most recent laps carry stable identity colors; older ones stay grey.
      const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
      const aff = affineOf(project);
      laps.forEach((entry, index) => {
        if (index === hoveredIndex) return;
        const color = index >= coloredFrom ? lapColor(entry.lap) : PREVIOUS_LAP;
        entry.path ??= buildLapPath(entry.samples);
        strokeWorldPath(
          lapsLayerCtx,
          entry.path,
          aff,
          dpr,
          color,
          LINE_WIDTH - 0.5,
        );
      });
    };

    // Current-lap geometry batched into one world-space Path2D per pedal
    // color bucket — projection independent and append-only, so a moving
    // camera restrokes a couple dozen cached paths instead of re-projecting
    // and stroking every segment. `currentPathCount` is how many samples the
    // buckets already contain.
    const currentPaths = new Map<number, Path2D>();
    let currentPathCount = 0;

    // Current lap accumulates incrementally; a projection change (zoom,
    // camera motion, resize) or shrink (rollover/reset) restrokes the cached
    // bucket paths, while a same-projection frame appends only new segments.
    const renderCurrentLayer = (
      project: Project,
      projKey: string,
      width: number,
      height: number,
      dpr: number,
    ) => {
      const samples = currentRef.current;
      // The newest TIP_HOLDBACK samples stay out of the layer — the live tip
      // is drawn per frame by drawCurrentTail, clipped at the dot.
      const layerLen = Math.max(0, samples.length - TIP_HOLDBACK);
      if (layerLen < currentPathCount) {
        currentPaths.clear();
        currentPathCount = 0;
      }
      for (let i = Math.max(1, currentPathCount); i < layerLen; i++) {
        const s = samples[i];
        if (s.jump) continue;
        const key = bucketKey(s.gas, s.brake);
        let path = currentPaths.get(key);
        if (!path) {
          path = new Path2D();
          currentPaths.set(key, path);
        }
        path.moveTo(samples[i - 1].x, samples[i - 1].z);
        path.lineTo(s.x, s.z);
      }
      currentPathCount = Math.max(currentPathCount, layerLen);

      if (projKey !== currentLayerKey || layerLen < appendedCount) {
        currentLayerKey = projKey;
        sizeLayer(currentLayer, canvas.width, canvas.height);
        currentLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        currentLayerCtx.clearRect(0, 0, width, height);
        appendedCount = 0;
      }
      if (layerLen < 2 || layerLen === appendedCount) return;
      if (appendedCount === 0) {
        const aff = affineOf(project);
        for (const [key, path] of currentPaths)
          strokeWorldPath(
            currentLayerCtx,
            path,
            aff,
            dpr,
            bucketColor(key),
            LINE_WIDTH,
          );
      } else {
        currentLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        currentLayerCtx.lineWidth = LINE_WIDTH;
        currentLayerCtx.lineCap = "round";
        for (let i = appendedCount; i < layerLen; i++) {
          if (samples[i].jump) continue;
          const a = project(samples[i - 1]);
          const b = project(samples[i]);
          currentLayerCtx.strokeStyle = bucketColor(
            bucketKey(samples[i].gas, samples[i].brake),
          );
          currentLayerCtx.beginPath();
          currentLayerCtx.moveTo(a.px, a.py);
          currentLayerCtx.lineTo(b.px, b.py);
          currentLayerCtx.stroke();
        }
      }
      appendedCount = layerLen;
    };

    // The live tip of the current lap, drawn directly on the main canvas
    // every repaint: the held-back samples, ending exactly at the dot. While
    // following, the dot runs FOLLOW_DELAY_MS behind the raw stream, and
    // without this clip the line pokes out ahead of it.
    const drawCurrentTail = (project: Project) => {
      const samples = currentRef.current;
      const frame = telemetryRef.current;
      if (!frame || samples.length === 0) return;
      const tip = dotWorld(frame);
      const from = Math.max(1, samples.length - TIP_HOLDBACK);
      // Nearest held-back sample to the dot: segments beyond it are ahead of
      // the dot and stay hidden (samples are ~1 m apart, so this is faithful).
      let end = samples.length - 1;
      let bestD = Infinity;
      for (let i = from - 1; i < samples.length; i++) {
        const d = (samples[i].x - tip.x) ** 2 + (samples[i].z - tip.z) ** 2;
        if (d < bestD) {
          bestD = d;
          end = i;
        }
      }
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      for (let i = from; i <= end; i++) {
        if (samples[i].jump) continue;
        const a = project(samples[i - 1]);
        const b = project(samples[i]);
        ctx.strokeStyle = bucketColor(
          bucketKey(samples[i].gas, samples[i].brake),
        );
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
      }
      const a = project(samples[end]);
      const b = project(tip);
      ctx.strokeStyle = bucketColor(bucketKey(frame.gas, frame.brake));
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    };

    // Samples are ~1 m apart, so point distance is a faithful line distance;
    // stepping by 3 keeps the scan cheap even with a full session of laps.
    type HoverRow = {
      lap: number;
      color: string;
      speedKmh: number;
      gas: number;
      brake: number;
      gear: number;
    };
    // `marker` is the point on the nearest line closest to the cursor, in that
    // line's rendered color — the ring echo that mirrors the analysis scrub.
    type HitResult = {
      nearest: number;
      rows: HoverRow[];
      marker: { x: number; z: number; color: string } | null;
    };

    const hitTestLaps = (project: Project): HitResult => {
      const m = mouseRef.current;
      const laps = previousLapsRef.current;
      // Follow mode picks nothing. The map sweeps under a parked cursor there,
      // so lines pick *themselves* as the car drives past, and with more than
      // one stored lap the readout, ring and emphasis thrash on every frame.
      // Inspection while following goes through the analysis panel and the
      // session lap list instead — their selections still reveal below, since
      // they name a lap deliberately rather than catching whatever swept past.
      if (
        !m ||
        laps.length === 0 ||
        cameraDrivesView() ||
        (inset && insideRect(inset, m))
      )
        return { nearest: -1, rows: [], marker: null };
      const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
      let nearest = -1;
      let nearestD = HOVER_RADIUS_SQ;
      let marker: HitResult["marker"] = null;
      const rows: HoverRow[] = [];
      laps.forEach(({ lap, samples }, index) => {
        let bestD = HOVER_RADIUS_SQ;
        let bestIdx = -1;
        for (let i = 0; i < samples.length; i += 3) {
          const { px, py } = project(samples[i]);
          const d = (px - m.x) ** 2 + (py - m.y) ** 2;
          if (d < bestD) {
            bestD = d;
            bestIdx = i;
          }
        }
        if (bestD >= HOVER_RADIUS_SQ || bestIdx < 0) return;
        if (bestD < nearestD) {
          nearestD = bestD;
          nearest = index;
          // The ring keeps the same color the line takes when focused: its
          // identity hue if colored, else the white grey-lap emphasis tone.
          const s = samples[bestIdx];
          marker = {
            x: s.x,
            z: s.z,
            color: index >= coloredFrom ? lapColor(lap) : HOVERED_GREY_LAP,
          };
        }
        if (index >= coloredFrom) {
          const s = samples[bestIdx];
          rows.push({
            lap,
            color: lapColor(lap),
            speedKmh: s.speedKmh,
            gas: s.gas,
            brake: s.brake,
            gear: s.gear,
          });
        }
      });
      rows.reverse(); // laps store oldest-first; the readout lists newest first
      return { nearest, rows, marker };
    };

    type Seg = { text: string; color: string };

    const pedalSeg = (gas: number, brake: number): Seg => {
      const color = bucketColor(bucketKey(gas, brake));
      if (brake > DEAD_ZONE && brake >= gas)
        return { text: ` · BRK ${Math.round(brake * 100)}%`, color };
      if (gas > DEAD_ZONE)
        return { text: ` · THR ${Math.round(gas * 100)}%`, color };
      return { text: " · coast", color };
    };

    const drawHoverReadout = ({ nearest, rows }: HitResult) => {
      const m = mouseRef.current;
      if (!m || nearest < 0) return;
      const nearestLap = previousLapsRef.current[nearest].lap;
      const timeSegs = (lap: number): Seg[] => {
        const record = lapsRef.current.find((l) => l.lap === lap);
        if (!record) return [];
        return [
          {
            text: ` — ${formatLapTime(record.timeMs)}`,
            color: record.invalid ? INVALID_TIME : "#ffffff",
          },
        ];
      };
      const lines: Seg[][] = rows.map((row) => [
        { text: `Lap ${row.lap}`, color: row.color },
        ...(row.lap === nearestLap ? timeSegs(row.lap) : []),
        {
          text: ` · ${Math.round(row.speedKmh)} km/h · ${formatGearCompact(row.gear)}`,
          color: row.color,
        },
        pedalSeg(row.gas, row.brake),
      ]);
      if (!rows.some((row) => row.lap === nearestLap)) {
        lines.unshift([
          { text: `Lap ${nearestLap}`, color: "#ffffff" },
          ...timeSegs(nearestLap),
        ]);
      }
      ctx.font = "12px system-ui";
      const rowH = 16;
      const boxW =
        Math.max(
          ...lines.map((segs) =>
            segs.reduce((w, s) => w + ctx.measureText(s.text).width, 0),
          ),
        ) + 12;
      const x = m.x + 14;
      const y = m.y - 8;
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 14, boxW, lines.length * rowH + 4, 6);
      ctx.fillStyle = "rgba(13, 13, 13, 0.92)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.stroke();
      lines.forEach((segs, row) => {
        let sx = x;
        for (const seg of segs) {
          ctx.fillStyle = seg.color;
          ctx.fillText(seg.text, sx, y + row * rowH);
          sx += ctx.measureText(seg.text).width;
        }
      });
    };

    let lastCursor = "";
    const setCursor = (cursor: string) => {
      if (cursor === lastCursor) return;
      lastCursor = cursor;
      canvas.style.cursor = cursor;
    };

    const drawLaps = (
      project: Project,
      projKey: string,
      width: number,
      height: number,
      dpr: number,
    ) => {
      const hit = hitTestLaps(project);
      setCursor(hit.nearest >= 0 ? "pointer" : "default");
      // The focused lap: cursor on its line, else its row hovered in the
      // session-lap list, else the open analysis panel's selection. Whatever
      // focused it, the treatment is identical — the line leaves the cached
      // layer and redraws ON TOP with the emphasis stroke (a lap being
      // inspected must never sit buried under later laps), and its brake
      // ticks and cut markers reveal.
      const laps = previousLapsRef.current;
      let focus = hit.nearest;
      if (focus < 0) {
        const externalLap = hoveredLapRef.current ?? analysisLapRef.current;
        if (externalLap !== null)
          focus = laps.findIndex((l) => l.lap === externalLap);
      }
      renderLapsLayer(project, projKey, focus, width, height, dpr);
      blitLayer(lapsLayer);
      renderCurrentLayer(project, projKey, width, height, dpr);
      blitLayer(currentLayer);
      drawCurrentTail(project);
      if (focus >= 0) {
        // Emphasis keeps the lap's identity color: thicker + full opacity
        // (grey laps brighten to solid white) instead of a separate hue.
        const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
        const entry = laps[focus];
        const color =
          focus >= coloredFrom ? lapColor(entry.lap) : HOVERED_GREY_LAP;
        entry.path ??= buildLapPath(entry.samples);
        strokeWorldPath(
          ctx,
          entry.path,
          affineOf(project),
          dpr,
          color,
          LINE_WIDTH + 1,
        );
      }
      drawScrubSector(project, affineOf(project), dpr);
      drawCutMarkers(project, focus);
      drawScrubMarker(project);
      // Line-hover echo: a colored ring snapped to the nearest point on the
      // hovered/tapped line — the direct-map twin of the scrub ring. Same
      // pointer state on desktop (mouse) and mobile (a tap parks mouseRef).
      if (hit.marker) {
        const { px, py } = project(hit.marker);
        drawRing(px, py, hit.marker.color);
      }
      if (hit.nearest >= 0) drawHoverReadout(hit);
    };

    // Gate geometry and slice ownership change only when a lap is recorded or
    // logged, never per frame. A lap's log entry lands a few frames after its
    // recording is stored, so the log's length is part of the key too — the
    // recordings version alone would keep a just-invalidated lap owning slices.
    let sectorKey = "";
    const syncSectorTables = () => {
      const recordings = recordingsRef.current;
      const laps = lapsRef.current;
      const key = `${recordingsVersionRef.current}|${laps.length}`;
      if (key === sectorKey) return;
      sectorKey = key;
      sectorOwnersRef.current = sectorOwners(recordings, laps, SECTOR_COUNT);
    };

    // Shared by the analysis-panel scrub echo and the direct line-hover
    // marker so the two read as the same cue everywhere.
    const drawRing = (px: number, py: number, color: string) => {
      for (const [style, width] of [
        [SURFACE, 4.5],
        [color, 2.5],
      ] as const) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // The sector under the analysis panel's cursor, re-stroked over the
    // blitted layer. The panel resolves the pointer to a sector and publishes
    // it, so the band in the panel and the emphasis here cannot disagree.
    const drawScrubSector = (project: Project, aff: Affine, dpr: number) => {
      const scrub = scrubRef.current;
      const sector = scrub ? sectorEdges[scrub.slice] : undefined;
      if (!scrub || !sector) return;
      for (const path of [sector.left, sector.right])
        strokeWorldPath(
          ctx,
          path,
          aff,
          dpr,
          SECTOR_EDGE_HOVER,
          TRACK_EDGE_WIDTH,
        );
      for (const anchor of sectorTicks[scrub.slice] ?? [])
        drawSectorTick(ctx, project, anchor, true);
      drawSectorLabel(
        ctx,
        project,
        scrub.slice,
        sectorOwnersRef.current[scrub.slice],
        true,
      );
    };

    const drawScrubMarker = (project: Project) => {
      const s = scrubRef.current;
      if (!s) return;
      const { px, py } = project(s);
      drawRing(px, py, s.color);
    };

    // Cut markers are stroked directly on every repaint — a session holds at
    // most a handful, so projecting them is far cheaper than another layer.
    const strokeCross = (
      px: number,
      py: number,
      color: string,
      width: number,
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px - CUT_ARM, py - CUT_ARM);
      ctx.lineTo(px + CUT_ARM, py + CUT_ARM);
      ctx.moveTo(px - CUT_ARM, py + CUT_ARM);
      ctx.lineTo(px + CUT_ARM, py - CUT_ARM);
      ctx.stroke();
    };

    const drawCutMarker = (px: number, py: number) => {
      strokeCross(px, py, SURFACE, CUT_HALO_WIDTH); // halo keeps the × readable on any layer
      strokeCross(px, py, INVALID_TIME, CUT_WIDTH);
    };

    // Only the in-progress lap's marker is ambient (it leaves with the lap at
    // the line). A stored lap reveals its marker when focused — line hover,
    // session-lap-list row, or the open analysis panel's selection.
    const drawCutMarkers = (project: Project, focusIndex: number) => {
      const focused = previousLapsRef.current[focusIndex]?.cut;
      for (const c of [focused, currentCutRef.current]) {
        if (!c) continue;
        const { px, py } = project(c);
        drawCutMarker(px, py);
      }
    };

    // Heading anchors for the car marker: previous and newest rendered-dot
    // world positions, at least HEADING_BASELINE_M apart. A teleport-sized
    // jump discards them, so the marker never sweeps across a restart — it
    // falls back to the circle until fresh motion re-establishes heading.
    let headingFrom: { x: number; z: number } | null = null;
    let headingTo: { x: number; z: number } | null = null;

    const trackHeading = (pos: { x: number; z: number }) => {
      if (!headingTo) {
        headingTo = pos;
        return;
      }
      const moved = Math.hypot(pos.x - headingTo.x, pos.z - headingTo.z);
      if (moved > ANCHOR_SNAP_M) {
        headingFrom = null;
        headingTo = pos;
      } else if (moved >= HEADING_BASELINE_M) {
        headingFrom = headingTo;
        headingTo = pos;
      }
    };

    // Screen-space heading: both anchors go through the active projection and
    // the angle is measured between the projected pixels, so it stays correct
    // in every projection mode, at any zoom, and on X-mirrored tracks. Null
    // until two anchors exist.
    const markerAngle = (project: Project): number | null => {
      if (!headingFrom || !headingTo) return null;
      const a = project(headingFrom);
      const b = project(headingTo);
      return Math.atan2(b.py - a.py, b.px - a.px);
    };

    // The car marker: a wedge pointing along the direction of travel with a
    // steering tick pivoting at its nose — or the plain circle while no
    // heading exists (fresh session, never moved, just teleported).
    const drawDot = (project: Project, frame: TelemetryFrame) => {
      const pos = dotWorld(frame);
      trackHeading(pos);
      const { px, py } = project(pos);
      const angle = markerAngle(project);
      if (angle === null) {
        ctx.beginPath();
        ctx.arc(px, py, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = SURFACE;
        ctx.stroke();
        return;
      }
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      // Wedge in local screen px, nose along +x (rotation puts +x on the
      // heading); footprint matches the old circle.
      const nose = DOT_RADIUS + 2;
      ctx.beginPath();
      ctx.moveTo(nose, 0);
      ctx.lineTo(-DOT_RADIUS, DOT_RADIUS - 1);
      ctx.lineTo(-DOT_RADIUS * 0.45, 0);
      ctx.lineTo(-DOT_RADIUS, -(DOT_RADIUS - 1));
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = SURFACE;
      ctx.stroke();
      // Steering tick. Positive steerAngle (right input) rotates clockwise
      // in the canvas's down-positive-y frame — right of the nose on screen —
      // unless the projection is mirrored (negative handedness), which flips
      // the visual turn direction, so the tick flips with it.
      const ux = project({ x: pos.x + 1, z: pos.z });
      const uz = project({ x: pos.x, z: pos.z + 1 });
      const handed =
        (ux.px - px) * (uz.py - py) - (ux.py - py) * (uz.px - px) < 0 ? -1 : 1;
      const frac = Math.max(-1, Math.min(1, frame.steerAngle / STEER_FULL_DEG));
      const tick = frac * (Math.PI / 2) * handed;
      ctx.beginPath();
      ctx.moveTo(nose, 0);
      ctx.lineTo(
        nose + Math.cos(tick) * STEER_TICK_LEN,
        Math.sin(tick) * STEER_TICK_LEN,
      );
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = STEER_TICK_COLOR;
      ctx.stroke();
      ctx.restore();
    };

    const showsInset = () =>
      zoomRef.current.level >= INSET_MIN_LEVEL && !cameraDrivesView();

    // The fit-framing track depiction, independent of zoom: zooming and
    // gliding only re-blit it.
    const renderInsetLayer = (
      base: Project,
      fitKey: string,
      at: Inset,
      dpr: number,
    ) => {
      const key = `${fitKey}|${edgesFill ? "" : lapsVersion}`;
      if (key === insetLayerKey) return;
      insetLayerKey = key;
      sizeLayer(insetLayer, Math.round(at.w * dpr), Math.round(at.h * dpr));
      insetLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
      insetLayerCtx.clearRect(0, 0, insetLayer.width, insetLayer.height);
      const fit = affineOf(base);
      const aff = {
        k: fit.k * at.scale,
        tx: fit.tx * at.scale,
        ty: fit.ty * at.scale,
      };
      if (edgesFill) {
        insetLayerCtx.save();
        insetLayerCtx.setTransform(
          dpr * aff.k,
          0,
          0,
          dpr * aff.k,
          dpr * aff.tx,
          dpr * aff.ty,
        );
        insetLayerCtx.fillStyle = TRACK_FILL;
        insetLayerCtx.fill(edgesFill);
        insetLayerCtx.restore();
        for (const sector of sectorEdges)
          for (const path of [sector.left, sector.right])
            strokeWorldPath(insetLayerCtx, path, aff, dpr, TRACK_EDGE, 1);
        return;
      }
      for (const entry of previousLapsRef.current) {
        entry.path ??= buildLapPath(entry.samples);
        strokeWorldPath(insetLayerCtx, entry.path, aff, dpr, PREVIOUS_LAP, 1);
      }
    };

    const strokeRect = (r: Rect) => {
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    };

    const drawInset = (
      base: Project,
      fitKey: string,
      width: number,
      height: number,
      dpr: number,
      frame: TelemetryFrame | null,
    ) => {
      const at = inset;
      if (!at) return;
      renderInsetLayer(base, fitKey, at, dpr);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(at.x, at.y, at.w, at.h, 4);
      ctx.fillStyle = SURFACE;
      ctx.fill();
      ctx.clip();
      ctx.drawImage(insetLayer, at.x, at.y, at.w, at.h);
      const zm = zoomRef.current;
      const view = viewportInInset(at, zm, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = INSET_VIEWPORT;
      strokeRect(view);
      const m = mouseRef.current;
      if (m && insideRect(at, m)) {
        const ghost = {
          x: m.x - view.w / 2,
          y: m.y - view.h / 2,
          w: view.w,
          h: view.h,
        };
        ctx.fillStyle = INSET_GHOST_FILL;
        ctx.fillRect(ghost.x, ghost.y, ghost.w, ghost.h);
        ctx.strokeStyle = INSET_GHOST;
        strokeRect(ghost);
      }
      if (frame) {
        const { px, py } = base(dotWorld(frame));
        const car = baseToInset(at, { x: px, y: py });
        ctx.beginPath();
        ctx.arc(car.x, car.y, INSET_CAR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(at.x + 0.5, at.y + 0.5, at.w - 1, at.h - 1, 4);
      ctx.lineWidth = 1;
      ctx.strokeStyle = INSET_BORDER;
      ctx.stroke();
    };

    // Dirty gating: repaint only when something rendered actually changed.
    // Telemetry frames, mouse positions, and zoom states are fresh objects on
    // every change, so identity comparison is a faithful change detector.
    let lastFrame: TelemetryFrame | null = null;
    let lastMouse: { x: number; y: number } | null = null;
    let lastZoom = zoomRef.current;
    let lastCuts: CutEvent[] | null = null;
    let lastCutCount = 0;
    let lastHoveredLap: number | null = null;
    let lastScrub: ScrubPoint | null = null;
    let lastAnalysisLap: number | null = null;
    let lastRecVersion = -1;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    let firstDraw = true;
    // Fallback mode keeps repainting while the auto-fit viewport eases.
    let easing = false;
    // Follow cam keeps repainting while its camera is unsettled ('following'
    // mid-glide or 'exiting'); a settled camera over a stationary car writes
    // no new zoom object and the map idles exactly as before.
    let followAnimating = false;
    let lastFollow: FollowState = followRef.current;
    // A wheel/pinch retarget changes only the target window — nothing else the
    // gate watches — and the gate runs *before* followCamera, so without this
    // term the camera wouldn't run and the retarget would sit inert on an
    // otherwise-idle frame (stationary car, no new telemetry, parked cursor).
    let lastFollowWindow = followWindowRef.current;
    let lastNav = navRef.current;
    let navAnimating = false;
    // Smoothed world position the follow cam tracks (and the dot renders at
    // while following) — absorbs the uneven arrival of raw frames.
    let followPos: { x: number; z: number } | null = null;
    // Where the camera sits relative to the car, in base-projection px. Null
    // until the first tracking frame seeds it from the view being left behind.
    let camOffPx: { x: number; y: number } | null = null;
    // Recent raw frames with arrival times, the interpolation source.
    let trail: { x: number; z: number; at: number }[] = [];
    let lastTrailFrame: TelemetryFrame | null = null;

    // Ease zoomRef toward the follow target (car centered at a comfortable
    // zoom) or back toward the fit view. Runs against the *base* projection
    // of the active mode, before zoomed() reads zoomRef for the frame — the
    // whole follow cam is just this mutation; every mode composes it for free.
    const followCamera = (
      base: Project,
      width: number,
      height: number,
      dt: number,
    ) => {
      followAnimating = false;
      const st = followRef.current;
      if (st !== "following") {
        // Stale buffer times would make a later re-entry interpolate across
        // the idle gap; restart cleanly instead.
        trail.length = 0;
        lastTrailFrame = null;
        followPos = null;
        camOffPx = null;
        if (st !== "exiting") return;
      }
      const zm = zoomRef.current;
      if (st === "following") {
        const frame = telemetryRef.current;
        if (!frame) return;
        // Record raw frame arrivals, then render FOLLOW_DELAY_MS in the past
        // by interpolating between the two buffered frames straddling that
        // instant. A teleport (restart, pit) restarts the buffer — snap.
        if (frame !== lastTrailFrame) {
          lastTrailFrame = frame;
          const newest = trail[trail.length - 1];
          if (
            newest &&
            Math.hypot(frame.x - newest.x, frame.z - newest.z) > ANCHOR_SNAP_M
          ) {
            trail.length = 0;
            camOffPx = { x: 0, y: 0 }; // snap with the car, don't sweep after it
          }
          trail.push({ x: frame.x, z: frame.z, at: performance.now() });
          if (trail.length > 32) trail.shift();
        }
        const wanted = performance.now() - FOLLOW_DELAY_MS;
        let pos: { x: number; z: number } = trail[trail.length - 1];
        if (wanted <= trail[0].at) {
          pos = trail[0];
        } else {
          for (let i = 1; i < trail.length; i++) {
            if (trail[i].at >= wanted) {
              const a = trail[i - 1];
              const b = trail[i];
              const f = b.at === a.at ? 1 : (wanted - a.at) / (b.at - a.at);
              pos = { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
              break;
            }
          }
        }
        // Keep animating while the delayed point is still traversing the
        // buffer, so motion continues between (and after) frame arrivals.
        if (
          !followPos ||
          Math.hypot(pos.x - followPos.x, pos.z - followPos.z) > 0.01
        )
          followAnimating = true;
        followPos = pos;
        const car = base(followPos);
        // Base px-per-meter (uniform, unrotated projections) sizes the
        // comfortable zoom as a fixed world window, not a fixed multiplier.
        const unit = base({ x: followPos.x + 1, z: followPos.z });
        const pxPerMeter = Math.hypot(unit.px - car.px, unit.py - car.py);
        if (pxPerMeter <= 0) return;
        // Bounds for the target window, derived here because only the camera
        // holds the two terms they depend on. They are the exact inverses of
        // the level limits, so the level below needs no clamp of its own:
        // `maxWindow` is the window that would render at 1× — pulled in by
        // FOLLOW_WINDOW_HEADROOM, since a car-centred view at exactly 1×
        // contradicts what 1× means everywhere else (the fit framing).
        const span = Math.min(width, height);
        const maxWindow = (span / pxPerMeter) * FOLLOW_WINDOW_HEADROOM;
        const minWindow = Math.max(
          FOLLOW_MIN_WINDOW_M,
          span / (ZOOM_MAX * pxPerMeter),
        );
        // Publish them for the wheel/pinch handlers, which cannot derive them:
        // a request past `maxWindow` is what they read as "leave follow mode".
        followLimitsRef.current = { min: minWindow, max: maxWindow };
        // Write the clamp back so input beyond a limit cannot accumulate — an
        // unbounded ref would swallow the first several notches back. Settled,
        // this rewrites an identical value and never re-dirties the frame.
        const window_ = Math.min(
          maxWindow,
          Math.max(minWindow, followWindowRef.current),
        );
        followWindowRef.current = window_;
        const targetLevel = span / (window_ * pxPerMeter);
        // Where the camera sits relative to the car, decayed toward zero on its
        // own clock. Easing the camera *toward* the car instead — a target that
        // has moved again by the next frame — settles at an error of roughly
        // speed × FOLLOW_TAU_S rather than at zero: ~18 m at racing speed,
        // which is nothing across the fit view but is the entire canvas at a
        // tight follow window, and the car leaves the screen. Decaying the
        // offset cancels that term, so the car is pinned at the centre at any
        // speed and any zoom, while entry is still one eased glide — it simply
        // starts as one large offset.
        if (!camOffPx)
          camOffPx = {
            x: (width / 2 - zm.ox) / zm.level - car.px,
            y: (height / 2 - zm.oy) / zm.level - car.py,
          };
        const decay = Math.exp(-dt / FOLLOW_TAU_S);
        camOffPx = { x: camOffPx.x * decay, y: camOffPx.y * decay };
        const level = zm.level + (targetLevel - zm.level) * (1 - decay);
        // Asymptotic easing — snap inside a sub-pixel epsilon so it terminates.
        if (
          Math.hypot(camOffPx.x, camOffPx.y) * level < 0.5 &&
          Math.abs(targetLevel - level) < 0.001
        ) {
          camOffPx = { x: 0, y: 0 };
          const pinned = {
            level: targetLevel,
            ox: width / 2 - car.px * targetLevel,
            oy: height / 2 - car.py * targetLevel,
          };
          // A stationary car rewrites identical values, so the map still idles.
          if (
            zm.level !== pinned.level ||
            zm.ox !== pinned.ox ||
            zm.oy !== pinned.oy
          )
            zoomRef.current = pinned;
          return;
        }
        zoomRef.current = {
          level,
          ox: width / 2 - (car.px + camOffPx.x) * level,
          oy: height / 2 - (car.py + camOffPx.y) * level,
        };
        followAnimating = true;
        return;
      }
      // Exiting: the fit view is a static target, so there is no lag term to
      // cancel — ease straight at it.
      const blend = 1 - Math.exp(-dt / FOLLOW_TAU_S);
      const level = zm.level + (ZOOM_RESET.level - zm.level) * blend;
      const ox = zm.ox + (ZOOM_RESET.ox - zm.ox) * blend;
      const oy = zm.oy + (ZOOM_RESET.oy - zm.oy) * blend;
      if (
        Math.abs(ZOOM_RESET.level - level) < 0.001 &&
        Math.abs(ox) < 0.5 &&
        Math.abs(oy) < 0.5
      ) {
        zoomRef.current = ZOOM_RESET; // exact fit framing, as if never followed
        setFollow("off");
        return;
      }
      zoomRef.current = { level, ox, oy };
      followAnimating = true;
    };

    // Inset navigation glides the view centre toward navRef at the unchanged
    // level, with the follow cam's time constant so both glides feel alike.
    const navCamera = (width: number, height: number, dt: number) => {
      navAnimating = false;
      const target = navRef.current;
      if (!target) return;
      const zm = zoomRef.current;
      if (cameraDrivesView() || zm.level <= 1) {
        navRef.current = null;
        return;
      }
      const c = viewCentre(zm, width, height);
      const blend = 1 - Math.exp(-dt / FOLLOW_TAU_S);
      const next = {
        x: c.x + (target.x - c.x) * blend,
        y: c.y + (target.y - c.y) * blend,
      };
      // Asymptotic easing — snap inside a sub-pixel epsilon so it terminates.
      if (Math.hypot(target.x - next.x, target.y - next.y) * zm.level < 0.5) {
        zoomRef.current = centreZoomOn(target, zm.level, width, height);
        navRef.current = null;
        return;
      }
      zoomRef.current = centreZoomOn(next, zm.level, width, height);
      navAnimating = true;
    };

    // While following, the dot renders at the smoothed tracked point so it
    // moves in lockstep with the camera instead of stepping with raw frames.
    const dotWorld = (frame: TelemetryFrame): { x: number; z: number } =>
      followRef.current === "following" && followPos
        ? followPos
        : { x: frame.x, z: frame.z };

    let lastTickAt = performance.now();
    const draw = () => {
      rafId = requestAnimationFrame(draw);
      // Wall-clock step for the time-based camera easing; capped so a
      // background tab doesn't turn into one giant leap on return.
      const tickAt = performance.now();
      const dt = Math.min(0.1, (tickAt - lastTickAt) / 1000);
      lastTickAt = tickAt;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const frame = telemetryRef.current;
      if ((frame !== null) !== hasFrameRef.current) {
        hasFrameRef.current = frame !== null;
        setHasFrame(frame !== null);
      }
      const mouse = mouseRef.current;
      const zoom = zoomRef.current;
      const cutList = cutsRef.current;
      const hoveredLap = hoveredLapRef.current;
      const scrub = scrubRef.current;
      const analysisLap = analysisLapRef.current;
      const recVersion = recordingsVersionRef.current;
      const followState = followRef.current;
      const followWindow = followWindowRef.current;
      const nav = navRef.current;
      const dirty =
        firstDraw ||
        easing ||
        followAnimating ||
        navAnimating ||
        nav !== lastNav ||
        followState !== lastFollow ||
        followWindow !== lastFollowWindow ||
        frame !== lastFrame ||
        mouse !== lastMouse ||
        zoom !== lastZoom ||
        cutList !== lastCuts ||
        cutList.length !== lastCutCount ||
        hoveredLap !== lastHoveredLap ||
        scrub !== lastScrub ||
        analysisLap !== lastAnalysisLap ||
        recVersion !== lastRecVersion ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastFollow = followState;
      lastFollowWindow = followWindow;
      lastNav = nav;
      lastFrame = frame;
      lastMouse = mouse;
      lastZoom = zoom;
      lastCuts = cutList;
      lastCutCount = cutList.length;
      lastHoveredLap = hoveredLap;
      lastScrub = scrub;
      lastAnalysisLap = analysisLap;
      lastRecVersion = recVersion;
      syncSectorTables();
      lastW = width;
      lastH = height;
      lastDpr = dpr;
      inset = null;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (frame) {
        const prevLap = lapRef.current;
        // AC's "restart session" doesn't re-handshake — spot it by the lap
        // counter or the current lap time running backwards.
        const restarted =
          prevLap !== null &&
          (frame.lapCount < prevLap ||
            (frame.lapCount === prevLap &&
              frame.lapTimeMs + 1000 < lapTimeRef.current));
        if (restarted) {
          resetLines();
          lapsVersion++;
          // Unconsumed pre-restart cuts reference laps that no longer exist.
          consumedCutsRef.current = cutList.length;
        } else if (prevLap !== null && frame.lapCount > prevLap) {
          // Lap finished: keep it among the grey reference lines underneath.
          // Display convention matches the LAP tile: lapCount N is "Lap N+1".
          previousLapsRef.current.push({
            lap: prevLap + 1,
            samples: currentRef.current,
            cut: currentCutRef.current,
          });
          if (previousLapsRef.current.length > MAX_LAPS)
            previousLapsRef.current.shift();
          currentRef.current = [];
          currentCutRef.current = null;
          lapsVersion++;
        }
        lapRef.current = frame.lapCount;
        lapTimeRef.current = frame.lapTimeMs;

        // Attach newly arrived cuts: the in-progress lap takes the first one,
        // a just-completed stored lap picks up a boundary straggler, and
        // everything else is dropped — a later cut for a lap that already died
        // (the tyres-out counter chatters across one excursion), or a
        // pre-restart leftover matching no lap at all.
        if (cutList !== seenCutsRef.current) {
          seenCutsRef.current = cutList;
          consumedCutsRef.current = 0;
        }
        for (
          ;
          consumedCutsRef.current < cutList.length;
          consumedCutsRef.current++
        ) {
          const cut = cutList[consumedCutsRef.current];
          if (cut.lapCount === frame.lapCount) {
            currentCutRef.current ??= { x: cut.x, z: cut.z };
          } else {
            const stored = previousLapsRef.current.find(
              (l) => l.lap === cut.lapCount + 1,
            );
            if (stored) stored.cut ??= { x: cut.x, z: cut.z };
          }
        }

        const samples = currentRef.current;
        const last = samples[samples.length - 1];
        const moved = last
          ? Math.hypot(frame.x - last.x, frame.z - last.z)
          : Infinity;
        if (samples.length < MAX_SAMPLES && moved > SAMPLE_SPACING) {
          if (!anchorRef.current)
            anchorRef.current = { x: frame.x, z: frame.z };
          samples.push({
            x: frame.x,
            z: frame.z,
            gas: frame.gas,
            brake: frame.brake,
            speedKmh: frame.speedKmh,
            gear: frame.gear,
            jump: !!last && moved > TELEPORT_DIST,
          });
          const b = boundsRef.current;
          b.minX = Math.min(b.minX, frame.x);
          b.maxX = Math.max(b.maxX, frame.x);
          b.minZ = Math.min(b.minZ, frame.z);
          b.maxZ = Math.max(b.maxZ, frame.z);
        }
      }

      // Keep the DOM legend in sync with the colored laps. Times can arrive a
      // few frames after a lap completes (the lap log waits for a fresh
      // lastLapMs), so the entries are rebuilt each frame and pushed to React
      // state only when their key actually changes.
      {
        const laps = previousLapsRef.current;
        const entries = laps
          .slice(Math.max(0, laps.length - COLORED_LAPS))
          .map(({ lap }) => {
            const record = lapsRef.current.find((l) => l.lap === lap);
            return {
              lap,
              color: lapColor(lap),
              timeMs: record?.timeMs ?? null,
              invalid: record?.invalid ?? false,
            };
          })
          .reverse();
        const key = entries
          .map((e) => `${e.lap}:${e.timeMs}:${e.invalid}`)
          .join("|");
        if (key !== legendKeyRef.current) {
          legendKeyRef.current = key;
          setLegend(entries);
        }
      }

      if (mapData?.meta) {
        easing = false;
        // map.ini pixel dimensions fix the viewport, so the framing is
        // identical from the very first frame.
        const meta = mapData.meta;
        const scale = Math.min(
          (width - PADDING * 2) / meta.width,
          (height - PADDING * 2) / meta.height,
        );
        const drawnW = meta.width * scale;
        const drawnH = meta.height * scale;
        const offsetX = (width - drawnW) / 2;
        const offsetY = (height - drawnH) / 2;

        // World (x, z) -> map.ini pixel space -> normalized -> canvas.
        const base: Project = (p) => ({
          px:
            offsetX +
            ((p.x + meta.xOffset) / meta.scaleFactor / meta.width) * drawnW,
          py:
            offsetY +
            ((p.z + meta.zOffset) / meta.scaleFactor / meta.height) * drawnH,
        });
        followCamera(base, width, height, dt);
        navCamera(width, height, dt);
        const project: Project = zoomed(base);
        const zm = zoomRef.current;
        inset = showsInset() ? insetRect(width, height) : null;

        // Everything the projection depends on — a change invalidates layers.
        const fitKey = `m|${width}x${height}@${dpr}`;
        const projKey = `${fitKey}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) drawDot(project, frame);
        drawInset(base, fitKey, width, height, dpr, frame);
        return;
      }

      if (edgeView) {
        // Edges without map.ini: fixed fit around the ribbon bounds.
        easing = false;
        const view = edgeView;
        const scale = Math.min(
          (width - PADDING * 2) / view.ex,
          (height - PADDING * 2) / view.ez,
        );
        // Same handedness as the map.ini projection (world +Z down-screen).
        const base: Project = (p) => ({
          px: width / 2 + (p.x - view.cx) * scale,
          py: height / 2 + (p.z - view.cz) * scale,
        });
        followCamera(base, width, height, dt);
        navCamera(width, height, dt);
        const project: Project = zoomed(base);
        const zm = zoomRef.current;
        inset = showsInset() ? insetRect(width, height) : null;
        const fitKey = `e|${width}x${height}@${dpr}`;
        const projKey = `${fitKey}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) drawDot(project, frame);
        drawInset(base, fitKey, width, height, dpr, frame);
        return;
      }

      // No map data at all for this track: auto-fit the driven lines. The
      // viewport eases toward the (margin-padded) bounds so the first lap
      // doesn't pin the car dot against the canvas edges while the extent is
      // still growing.
      if (
        !frame ||
        (currentRef.current.length < 2 && previousLapsRef.current.length === 0)
      ) {
        easing = false;
        return;
      }
      const b = boundsRef.current;
      const anchor = anchorRef.current;
      let target: View;
      if (previousLapsRef.current.length === 0 && anchor) {
        // First lap: camera locked on the starting point at a zoomed-out
        // scale — no panning while the track shape is still unknown. Only
        // zoom out (never in) if the track outgrows the window.
        const pad = 1 + VIEW_MARGIN * 2;
        target = {
          cx: anchor.x,
          cz: anchor.z,
          ex: Math.max(
            FIRST_LAP_EXTENT,
            2 * Math.max(b.maxX - anchor.x, anchor.x - b.minX) * pad,
          ),
          ez: Math.max(
            FIRST_LAP_EXTENT,
            2 * Math.max(b.maxZ - anchor.z, anchor.z - b.minZ) * pad,
          ),
        };
      } else {
        const spanX = Math.max(b.maxX - b.minX, 50);
        const spanZ = Math.max(b.maxZ - b.minZ, 50);
        target = {
          cx: (b.minX + b.maxX) / 2,
          cz: (b.minZ + b.maxZ) / 2,
          ex: spanX * (1 + VIEW_MARGIN * 2),
          ez: spanZ * (1 + VIEW_MARGIN * 2),
        };
      }
      let view = viewRef.current;
      if (!view) {
        view = { ...target };
        viewRef.current = view;
      } else {
        view.cx += (target.cx - view.cx) * VIEW_EASE;
        view.cz += (target.cz - view.cz) * VIEW_EASE;
        view.ex += (target.ex - view.ex) * VIEW_EASE;
        view.ez += (target.ez - view.ez) * VIEW_EASE;
        // The easing is asymptotic — snap once within a sub-pixel epsilon so
        // it terminates and the map can go idle between telemetry frames.
        const eps = Math.max(target.ex, target.ez) * 1e-4;
        if (
          Math.abs(target.cx - view.cx) < eps &&
          Math.abs(target.cz - view.cz) < eps &&
          Math.abs(target.ex - view.ex) < eps &&
          Math.abs(target.ez - view.ez) < eps
        ) {
          view.cx = target.cx;
          view.cz = target.cz;
          view.ex = target.ex;
          view.ez = target.ez;
        }
      }
      easing =
        view.cx !== target.cx ||
        view.cz !== target.cz ||
        view.ex !== target.ex ||
        view.ez !== target.ez;
      const scale = Math.min(
        (width - PADDING * 2) / view.ex,
        (height - PADDING * 2) / view.ez,
      );
      // World +Z maps down-screen — the same handedness as the map.ini /
      // map.png projection, so turn direction is never mirrored between modes.
      // User zoom multiplies the eased auto-fit view; at 1× the automatic
      // camera behaves exactly as before.
      const base: Project = (p) => ({
        px: width / 2 + (p.x - view.cx) * scale,
        py: height / 2 + (p.z - view.cz) * scale,
      });
      followCamera(base, width, height, dt);
      const project: Project = zoomed(base);

      const zm = zoomRef.current;
      const projKey = `f|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}|${view.cx},${view.cz},${view.ex},${view.ez}`;
      drawLaps(project, projKey, width, height, dpr);
      drawDot(project, frame);
    };

    const navigateTo = (p: Point) => {
      if (inset && insideRect(inset, p)) navRef.current = insetToBase(inset, p);
    };

    let insetDwellTimer: number | null = null;
    let insetDwellAnchor: Point | null = null;
    const cancelInsetDwell = () => {
      if (insetDwellTimer !== null) clearTimeout(insetDwellTimer);
      insetDwellTimer = null;
      insetDwellAnchor = null;
    };
    // A resting cursor stops dirtying the rAF gate, so the loop cannot notice
    // the rest itself — a timer commits it instead.
    const trackInsetDwell = (p: Point) => {
      if (CLICK_MODE || !inset || !insideRect(inset, p)) {
        cancelInsetDwell();
        return;
      }
      const anchor = insetDwellAnchor;
      if (
        anchor &&
        Math.hypot(p.x - anchor.x, p.y - anchor.y) <= INSET_REST_SLOP_PX
      )
        return;
      cancelInsetDwell();
      insetDwellAnchor = p;
      insetDwellTimer = window.setTimeout(() => {
        insetDwellTimer = null;
        if (mouseRef.current) navigateTo(mouseRef.current);
      }, INSET_DWELL_MS);
    };

    const onMouseMove = (e: MouseEvent) => {
      const p = { x: e.offsetX, y: e.offsetY };
      mouseRef.current = p;
      trackInsetDwell(p);
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
      cancelInsetDwell();
    };
    const onClick = (e: MouseEvent) =>
      navigateTo({ x: e.offsetX, y: e.offsetY });
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = followRef.current;
      // While tracking, the wheel retargets the camera instead of taking the
      // view off it — scrolling adjusts how tightly the car is framed, and the
      // car stays centred, so the cursor contributes nothing here. The exponent
      // is the free-zoom one with the sign flipped: a *smaller* window is a
      // *higher* zoom, and reusing the same factor makes a notch feel identical
      // in both modes.
      if (st === "following") {
        if (retargetFollow(ZOOM_STEP ** (e.deltaY / 100))) return;
        // Past the widest follow framing: rather than dead-stop, keep the zoom
        // axis continuous and hand the rest of the way out to the exit
        // animation, which lands on exactly the fit view.
        setFollow("exiting");
        return;
      }
      // Mid-exit the wheel would otherwise scroll into an inert handler for the
      // length of the glide. Scrolling back in resumes tracking from where the
      // exit began (the widest framing); scrolling further out is already what
      // the animation is doing.
      if (st === "exiting") {
        if (e.deltaY >= 0) return;
        followWindowRef.current = followLimitsRef.current.max;
        setFollow("following");
        return;
      }
      // Over the inset the cursor's screen point means nothing to the main
      // view, so the zoom anchors at the view centre — which also keeps a
      // glide in progress valid, since it targets a centre.
      const overInset =
        inset !== null && insideRect(inset, { x: e.offsetX, y: e.offsetY });
      if (!overInset) navRef.current = null;
      const zm = zoomRef.current;
      const level = Math.min(
        ZOOM_MAX,
        Math.max(1, zm.level * ZOOM_STEP ** (-e.deltaY / 100)),
      );
      if (level === zm.level) return;
      if (level === 1) {
        // Fully out = exact fit framing again; any accumulated focus is
        // discarded and a detached follow is dismissed with it.
        zoomRef.current = ZOOM_RESET;
        navRef.current = null;
        if (followRef.current === "detached") setFollow("off");
        return;
      }
      // Anchor the world point under the cursor: base = (m - o) / level must
      // land back on m, so o' = m - (m - o) * (level' / level).
      const ax = overInset ? canvas.clientWidth / 2 : e.offsetX;
      const ay = overInset ? canvas.clientHeight / 2 : e.offsetY;
      const r = level / zm.level;
      zoomRef.current = {
        level,
        ox: ax - (ax - zm.ox) * r,
        oy: ay - (ay - zm.oy) * r,
      };
    };
    // Touch gestures write the same fresh Zoom objects the wheel writes, so
    // the dirty-gated rAF loop repaints exactly when a gesture changed something.
    let tapStart: { x: number; y: number } | null = null;
    let touchMoved = false; // gesture left the tap slop (pan/pinch happened)
    let lastSingle: { x: number; y: number } | null = null;
    let lastPinch: { dist: number; mx: number; my: number } | null = null;
    // A gesture that starts on the inset belongs to it until every finger
    // lifts: it can only be a tap, never a pan or pinch of the main view.
    let insetTouch = false;

    const touchPoint = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    // A one-finger pan hands the view to manual zoom/pan in place (zoomRef
    // already holds the follow transform). Follow mode has no pan of its own,
    // so a drag is the user asking to look somewhere else — unlike a pinch,
    // which only ever means "frame the car tighter/wider".
    const detachFollow = () => {
      const st = followRef.current;
      if (st === "following" || st === "exiting") setFollow("detached");
    };
    // Fingers lifted or added mid-gesture: re-seed so deltas never span the
    // finger-count change.
    const seedTouches = (touches: TouchList) => {
      lastSingle = touches.length === 1 ? touchPoint(touches[0]) : null;
      if (touches.length === 2) {
        const a = touchPoint(touches[0]);
        const b = touchPoint(touches[1]);
        lastPinch = {
          dist: Math.hypot(b.x - a.x, b.y - a.y),
          mx: (a.x + b.x) / 2,
          my: (a.y + b.y) / 2,
        };
      } else {
        lastPinch = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); // no page scroll/zoom, no compatibility mouse events
      if (e.touches.length === 1) {
        tapStart = touchPoint(e.touches[0]);
        touchMoved = false;
        insetTouch = inset !== null && insideRect(inset, tapStart);
      } else {
        // Multi-finger is never a tap; a lingering readout leaves with it.
        tapStart = null;
        mouseRef.current = null;
      }
      seedTouches(e.touches);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (insetTouch) {
        const p = e.touches.length === 1 ? touchPoint(e.touches[0]) : null;
        if (
          tapStart &&
          (!p || Math.hypot(p.x - tapStart.x, p.y - tapStart.y) > TAP_SLOP_PX)
        )
          tapStart = null;
        return;
      }
      if (e.touches.length === 2 && lastPinch) {
        const a = touchPoint(e.touches[0]);
        const b = touchPoint(e.touches[1]);
        const prev = lastPinch;
        lastPinch = {
          dist: Math.hypot(b.x - a.x, b.y - a.y),
          mx: (a.x + b.x) / 2,
          my: (a.y + b.y) / 2,
        };
        if (prev.dist <= 0 || lastPinch.dist <= 0) return;
        touchMoved = true;
        navRef.current = null;
        // Pinch is the touch twin of the wheel: while tracking it resizes the
        // follow framing and keeps the camera on the car, so midpoint drift has
        // nothing to pan. Past the widest framing it exits, same as the wheel.
        if (followRef.current === "following") {
          if (!retargetFollow(prev.dist / lastPinch.dist)) setFollow("exiting");
          return;
        }
        // Mid-exit, the wheel's interruption rule again: spreading the fingers
        // (zoom in) resumes tracking from where the exit began, pinching further
        // out lets it finish. Handing zoomRef to the gesture here instead would
        // put it and the still-animating camera in a tug of war.
        if (followRef.current === "exiting") {
          if (lastPinch.dist > prev.dist) {
            followWindowRef.current = followLimitsRef.current.max;
            setFollow("following");
          }
          return;
        }
        const zm = zoomRef.current;
        const level = Math.min(
          ZOOM_MAX,
          Math.max(1, zm.level * (lastPinch.dist / prev.dist)),
        );
        if (level === 1) {
          // Fully out = exact fit framing, same rule as the wheel path.
          zoomRef.current = ZOOM_RESET;
          if (followRef.current === "detached") setFollow("off");
          return;
        }
        // Anchor the world point under the pinch midpoint (the wheel formula
        // with the midpoint as the cursor), then pan by the midpoint's motion.
        const r = level / zm.level;
        zoomRef.current = {
          level,
          ox: prev.mx - (prev.mx - zm.ox) * r + (lastPinch.mx - prev.mx),
          oy: prev.my - (prev.my - zm.oy) * r + (lastPinch.my - prev.my),
        };
        return;
      }
      if (e.touches.length === 1 && lastSingle) {
        const p = touchPoint(e.touches[0]);
        const prev = lastSingle;
        lastSingle = p;
        if (
          tapStart &&
          Math.hypot(p.x - tapStart.x, p.y - tapStart.y) > TAP_SLOP_PX
        ) {
          tapStart = null;
          touchMoved = true;
        }
        if (!touchMoved) return; // still within the tap slop — don't jitter
        navRef.current = null;
        const zm = zoomRef.current;
        if (zm.level <= 1) return; // the fit view has nowhere to pan
        detachFollow();
        zoomRef.current = {
          level: zm.level,
          ox: zm.ox + (p.x - prev.x),
          oy: zm.oy + (p.y - prev.y),
        };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      seedTouches(e.touches);
      if (e.touches.length > 0) return;
      if (insetTouch) {
        if (tapStart) navigateTo(tapStart);
      } else if (tapStart && !touchMoved) {
        // A clean tap: park the "cursor" there — the ordinary hit test shows
        // the readout on a line and clears it on empty track.
        mouseRef.current = { x: tapStart.x, y: tapStart.y };
      } else if (touchMoved && !cameraDrivesView()) {
        // Only meaningful when the gesture was writing zoomRef itself: a
        // retargeting pinch leaves the transform to the camera, which is
        // mid-glide toward a level this snap has no business rounding off.
        const zm = zoomRef.current;
        if (zm.level !== 1 && zm.level < ZOOM_SNAP_LEVEL) {
          zoomRef.current = ZOOM_RESET;
          if (followRef.current === "detached") setFollow("off");
        }
      }
      tapStart = null;
      touchMoved = false;
      insetTouch = false;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
    if (CLICK_MODE) canvas.addEventListener("click", onClick);

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("click", onClick);
      cancelInsetDwell();
    };
  }, [
    mapData,
    telemetryRef,
    lapsRef,
    cutsRef,
    hoveredLapRef,
    scrubRef,
    analysisLapRef,
    recordingsRef,
  ]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-edge bg-surface">
      <p className="absolute top-3 left-4 text-xs tracking-wide text-ink-muted uppercase">
        Track map
      </p>
      <div className="absolute top-3 right-4 flex items-center gap-3 text-xs text-ink-muted">
        {mapProbed && !mapData && (
          <span>No map file — drawing your driving line</span>
        )}
        <span className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: "rgb(18, 190, 60)" }}
          />
          Throttle
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: "rgb(250, 178, 25)" }}
          />
          Coast
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: "rgb(235, 55, 45)" }}
          />
          Brake
        </span>
      </div>
      {legend.length > 0 && (
        <div className="pointer-events-none absolute right-4 bottom-3 flex flex-col gap-1 text-xs">
          {legend.map((entry) => (
            <span
              key={entry.lap}
              className="flex items-center justify-end gap-1.5"
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-ink-muted">Lap {entry.lap}</span>
              {entry.timeMs != null && (
                <span
                  className={`tabular-nums ${entry.invalid ? "text-critical" : "text-ink-secondary"}`}
                >
                  {formatLapTime(entry.timeMs)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1.5">
        {(followUi === "off" ? hasFrame : followUi !== "exiting") && (
          <button
            type="button"
            onMouseEnter={startDwell}
            onMouseLeave={leaveDwell}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") e.preventDefault();
            }}
            onPointerUp={onFollowActivate}
            title={
              CLICK_MODE
                ? followUi === "off"
                  ? "Click to follow the car"
                  : "Click to leave follow mode"
                : "Rest the cursor here for 1 second — no click needed"
            }
            className={`pointer-events-auto relative overflow-hidden rounded border border-edge bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink-secondary ${
              CLICK_MODE ? "cursor-pointer" : ""
            }`}
          >
            {followUi === "off" ? "Follow car" : "Exit follow"}
            <span
              className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent ${
                dwelling
                  ? `w-full transition-[width] ease-linear ${DWELL_FILL_CLASS}`
                  : "w-0"
              }`}
            />
          </button>
        )}
      </div>
      <canvas ref={canvasRef} className="size-full touch-none" />
    </section>
  );
};
