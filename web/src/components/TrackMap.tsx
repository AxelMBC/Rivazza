import { useEffect, useRef, useState } from "react";
import type {
  CutEvent,
  MapMeta,
  SessionInfo,
  TelemetryFrame,
  TrackEdges,
} from "../types";
import type { LapRecord } from "../hooks/useLapHistory";
import { formatGearCompact, formatLapTime } from "../lib/format";
import { COLORED_LAPS, lapColor } from "../lib/lapColors";
import type { ScrubPoint } from "../lib/lapAnalysis";
import { BRIDGE_HTTP } from "../hooks/useTelemetry";
import { IS_DEMO, DEMO_MAP_URL } from "../lib/demo";
import { TAP_SLOP_PX, SYNTHETIC_MOUSE_WINDOW_MS } from "../lib/touch";

type Props = {
  session: SessionInfo;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  lapsRef: React.RefObject<LapRecord[]>;
  cutsRef: React.RefObject<CutEvent[]>;
  // Display lap number hovered in the session-lap list (LapTimes writes it);
  // that lap's cut markers reveal while set.
  hoveredLapRef: React.RefObject<number | null>;
  // Scrub position from the analysis panel (LapAnalysis writes it); a ring
  // marks that point on the map while set.
  scrubRef: React.RefObject<ScrubPoint | null>;
  // Lap selected in the open analysis panel (LapAnalysis writes it); that
  // lap's braking ticks reveal while set.
  analysisLapRef: React.RefObject<number | null>;
};

// map.ini metadata fixes the viewport and projection; edges are the track
// limits parsed from the AI spline's side distances. The track's map.png is
// deliberately never drawn: AC strokes it at constant width around the AI
// line, so it misrepresents track limits — the ribbon (when edges resolve)
// and the driven lines are the track. Null only when neither asset exists.
type MapData = { meta: MapMeta | null; edges: TrackEdges | null };
// `jump` marks a teleport (pits, restart) — no segment is drawn into it.
// `speedKmh`, `gear`, and the pedals feed the hover readout.
type Sample = {
  x: number;
  z: number;
  gas: number;
  brake: number;
  speedKmh: number;
  gear: number;
  jump: boolean;
};
// Where a lap died: the world position of one 4-tyres-out onset.
type CutMarker = { x: number; z: number };
// Where a lap began braking: onset world position plus the unit travel
// direction at that sample, so the tick renders perpendicular to the line.
type BrakeTick = { x: number; z: number; dx: number; dz: number };
type View = { cx: number; cz: number; ex: number; ez: number };
// Screen-space zoom layered over the base fit projection: zoomed = base * level + (ox, oy).
type Zoom = { level: number; ox: number; oy: number };
type LegendEntry = {
  lap: number;
  color: string;
  timeMs: number | null;
  invalid: boolean;
};

const PADDING = 24;
const DOT_RADIUS = 7;
const SAMPLE_SPACING = 1; // meters between line samples — fine enough for exact corner shapes
const MAX_SAMPLES = 25000; // hard cap so a stuck lap counter can't grow unbounded
const MAX_LAPS = 40; // completed laps kept on the map (oldest dropped beyond this)
const HOVER_RADIUS_SQ = 12 * 12; // px² — how close the cursor must be to pick a lap line
const TELEPORT_DIST = 100; // a jump this large between frames isn't driving
const DEAD_ZONE = 0.05;
const LINE_WIDTH = 3;
// Cut × geometry in screen pixels — zoom-invariant because the projection
// scales points, not the canvas transform.
const CUT_ARM = 5;
const CUT_WIDTH = 2.5;
const CUT_HALO_WIDTH = 5;
// Braking-onset ticks: rising through BRAKE_ON marks a point, and the next
// one first needs BRAKE_REARM_M meters of travel below BRAKE_OFF —
// hysteresis plus a distance gate so trail-brake flutter doesn't spawn a
// marker trail. Tick geometry is screen-px, zoom-invariant like the cuts.
const BRAKE_ON = 0.2;
const BRAKE_OFF = 0.1;
const BRAKE_REARM_M = 25;
const BRAKE_TICK_LEN = 10;
const BRAKE_TICK_WIDTH = 2.5;
const BRAKE_TICK_HALO = 5;
const VIEW_MARGIN = 0.15; // extra space around the driven bounds (fallback mode)
const VIEW_EASE = 0.06; // per-frame easing toward the target view (fallback mode)
// Until a full lap exists the track's real size is unknown — assume at least
// this many meters so the view starts zoomed out instead of stretching the
// first few corners across the whole canvas.
const FIRST_LAP_EXTENT = 1500;

// Cursor-anchored wheel zoom: exponential per notch, clamped so 1× is exactly
// the fit view (scrolling fully out is the reset gesture — no reset control).
const ZOOM_MAX = 40;
const ZOOM_STEP = 1.2;
const ZOOM_RESET: Zoom = { level: 1, ox: 0, oy: 0 };
// A pinch ending this close to 1× snaps to the exact fit framing — the touch
// counterpart of the wheel path's exact-1 reset (fingers can't land on 1.0).
const ZOOM_SNAP_LEVEL = 1.02;

// Follow cam: hover-dwell armed (never a click — clicks would focus the
// browser and steal controller input from the game). 'following' tracks the
// car, 'detached' is manual wheel zoom after interrupting a follow (the exit
// button stays), 'exiting' animates back to the 1× fit view.
type FollowState = "off" | "following" | "detached" | "exiting";
const FOLLOW_DWELL_MS = 3000;
// Comfortable tracking zoom: this many world meters across the smaller
// canvas dimension, regardless of track size or projection mode.
const FOLLOW_WINDOW_M = 250;
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
const TRACK_EDGE_WIDTH = 1;
const PREVIOUS_LAP = "rgba(255, 255, 255, 0.45)";
const HOVERED_GREY_LAP = "#ffffff"; // uncolored laps brighten to solid white on hover
const INVALID_TIME = "#f0554b"; // theme critical, brightened for the small canvas label

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

// Braking onsets for a completed lap, computed once at lap completion and
// cached with the stored entry. `clearDist` (meters traveled with the pedal
// below BRAKE_OFF) starts unbounded so the first application always marks;
// partial pressure between the thresholds resets the gate without marking.
const computeBrakeTicks = (samples: Sample[]): BrakeTick[] => {
  const ticks: BrakeTick[] = [];
  let clearDist = Infinity;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[i - 1];
    if (s.jump) {
      // A teleport isn't clean travel — require a fresh rearm after it.
      clearDist = 0;
      continue;
    }
    const step = Math.hypot(s.x - prev.x, s.z - prev.z);
    if (s.brake < BRAKE_OFF) {
      clearDist += step;
      continue;
    }
    if (s.brake >= BRAKE_ON && clearDist >= BRAKE_REARM_M && step > 0) {
      ticks.push({
        x: s.x,
        z: s.z,
        dx: (s.x - prev.x) / step,
        dz: (s.z - prev.z) / step,
      });
    }
    clearDist = 0;
  }
  return ticks;
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
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapProbed, setMapProbed] = useState(false);
  // Current lap's driving line (pedal-colored) and every completed lap
  // (drawn grey underneath so the session history never disappears).
  const currentRef = useRef<Sample[]>([]);
  // `path` is a lazily built world-space Path2D of the lap line — projection
  // independent, so it survives zoom, camera motion, and effect re-creation.
  const previousLapsRef = useRef<
    {
      lap: number;
      samples: Sample[];
      cuts: CutMarker[];
      brakes: BrakeTick[];
      path?: Path2D;
    }[]
  >([]);
  // Cut markers for the in-progress lap; completed laps carry theirs in
  // previousLapsRef. The session cut list is consumed incrementally and the
  // bookkeeping lives outside the draw effect so re-creating it (map data
  // changes) never re-attaches already-consumed cuts; a replaced list (new
  // session) restarts consumption via the identity check in the loop.
  const currentCutsRef = useRef<CutMarker[]>([]);
  const consumedCutsRef = useRef(0);
  const seenCutsRef = useRef<CutEvent[] | null>(null);
  // Cursor position in canvas CSS pixels, null when not hovering.
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const lapRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  // Fallback mode only: world-space bounds of everything driven, plus an
  // eased viewport so the auto-fit view glides instead of snapping while the
  // first lap is still discovering the track's extent.
  const boundsRef = useRef(freshBounds());
  const viewRef = useRef<View | null>(null);
  // First driven point: the camera stays locked onto it for the whole first
  // lap so the line draws itself across a stationary canvas.
  const anchorRef = useRef<{ x: number; z: number } | null>(null);
  // User wheel zoom — survives lap completion, resets with the session.
  const zoomRef = useRef<Zoom>(ZOOM_RESET);
  // Follow cam: the ref is the source of truth for the rAF loop and event
  // handlers; the mirrored state only drives which overlay button renders.
  const followRef = useRef<FollowState>("off");
  const [followUi, setFollowUi] = useState<FollowState>("off");
  const setFollow = (state: FollowState) => {
    followRef.current = state;
    setFollowUi(state);
  };
  // Dwell bookkeeping. `armReadyRef` guards against the button swap that
  // follows a completed dwell: the replacement button appears under the
  // still-parked cursor, and without the guard a browser that re-fires
  // mouseenter on DOM mutation would immediately start the opposite dwell,
  // toggling forever. The cursor must leave the button once to re-arm.
  const dwellTimerRef = useRef<number | null>(null);
  const armReadyRef = useRef(true);
  // When a tap last toggled follow mode: the browser fires compatibility
  // mouse events after a tap, and the swapped-in opposite button would catch
  // that mouseenter and start a phantom dwell without this window.
  const touchToggleAtRef = useRef(-SYNTHETIC_MOUSE_WINDOW_MS);
  const [dwelling, setDwelling] = useState(false);
  const cancelDwell = () => {
    if (dwellTimerRef.current !== null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    setDwelling(false);
  };
  const startDwell = (next: FollowState) => {
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
      // The car may have vanished mid-dwell (game closed) — nothing to follow.
      if (next === "following" && !telemetryRef.current) return;
      setFollow(next);
    }, FOLLOW_DWELL_MS);
  };
  const leaveDwell = () => {
    armReadyRef.current = true;
    cancelDwell();
  };
  // Touch path: a tap toggles instantly — the dwell only exists to keep
  // desktop interaction click-free, and a tap on a separate touch device
  // steals nothing from the game. Bypasses the re-arm guard (that protects
  // against the button swap under a parked cursor, which touch has none of).
  const onFollowTap = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    touchToggleAtRef.current = performance.now();
    leaveDwell();
    const st = followRef.current;
    if (st === "off") {
      if (telemetryRef.current) setFollow("following");
    } else if (st !== "exiting") {
      setFollow("exiting");
    }
  };
  // Follow button only renders while there is a car to follow; flipped from
  // the draw loop (telemetryRef nulls out when the bridge loses the game).
  const [hasFrame, setHasFrame] = useState(false);
  const hasFrameRef = useRef(false);
  // DOM legend for the colored laps; the key ref gates setState from the rAF loop.
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const legendKeyRef = useRef("");

  const resetLines = () => {
    currentRef.current = [];
    previousLapsRef.current = [];
    currentCutsRef.current = [];
    lapRef.current = null;
    lapTimeRef.current = 0;
    boundsRef.current = freshBounds();
    viewRef.current = null;
    anchorRef.current = null;
    zoomRef.current = ZOOM_RESET;
    // Session change / restart ends follow mode with everything else.
    cancelDwell();
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
    if (!lapsLayerCtx || !currentLayerCtx || !trackLayerCtx) return;
    let rafId = 0;

    const edges = mapData?.edges ?? null;
    // Track edges without map.ini: the ribbon's world bounds (plus margin)
    // fix the viewport — the same never-moving guarantee as the metadata fit.
    let edgeView: View | null = null;
    if (edges && !mapData?.meta) {
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
      edgeView = {
        cx: (minX + maxX) / 2,
        cz: (minZ + maxZ) / 2,
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
    let edgeLines: Path2D[] = [];
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
      edgeLines = [edges.left, edges.right].map((line) => {
        const p = new Path2D();
        traceInto(p, line, false, true);
        if (edges.closed) p.closePath();
        return p;
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

    // The track-limits ribbon under everything else. Edges are static for
    // the whole session, so only a projection change (zoom, resize, DPR)
    // re-renders the layer; every other frame just re-blits it.
    const renderTrackLayer = (
      project: Project,
      projKey: string,
      width: number,
      height: number,
      dpr: number,
    ) => {
      if (!edges || !edgesFill) return;
      if (projKey !== trackLayerKey) {
        trackLayerKey = projKey;
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

        // The edge strokes are the actual track limits.
        for (const line of edgeLines)
          strokeWorldPath(
            trackLayerCtx,
            line,
            aff,
            dpr,
            TRACK_EDGE,
            TRACK_EDGE_WIDTH,
          );
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
        // Tail append onto the already-stroked layer: a handful of segments.
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
      // Partial segment from the last on-line sample to the dot itself.
      const a = project(samples[end]);
      const b = project(tip);
      ctx.strokeStyle = bucketColor(bucketKey(frame.gas, frame.brake));
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
    };

    // Hover pick: the nearest stored lap line within HOVER_RADIUS of the
    // cursor (index, or -1), plus a speed row for every *colored* lap that
    // passes within the radius — at high zoom the lines separate on screen,
    // so the rows naturally narrow to the lines the cursor is actually near.
    // Samples are ~1 m apart so point distance is a faithful line distance;
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
      if (!m || laps.length === 0)
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

    // Hover readout: one row per in-radius colored lap ("Lap N · 143 km/h ·
    // G3 · THR 80%" in the lap's color, the pedal state tinted by the same
    // coast→throttle/brake ramp as the line itself), with the nearest lap
    // overall also carrying its recorded time (red when invalid; number-only
    // when unrecorded, e.g. laps driven before the page connected). A nearest
    // lap outside the colored set keeps the classic white "Lap N — time" row.
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
      // Draw order matches the pre-layer renderer exactly: previous laps
      // (minus focused) → current lap → focused emphasis → markers → readout.
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
      drawBrakeTicks(project, focus);
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

    // Braking-point ticks are revealed for the focused lap only, never
    // ambient — every colored lap's ticks at once drowned the map. Ticks sit
    // perpendicular to the driven line at a fixed screen length, haloed like
    // the cut markers; one lap's handful is far cheaper to project per
    // repaint than another layer.
    const drawBrakeTicks = (project: Project, focusIndex: number) => {
      const laps = previousLapsRef.current;
      if (focusIndex < 0) return;
      const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
      {
        const index = focusIndex;
        const { lap, brakes } = laps[index];
        const color = index >= coloredFrom ? lapColor(lap) : HOVERED_GREY_LAP;
        for (const t of brakes) {
          const a = project(t);
          // 1 m along the world normal fixes the tick's screen direction.
          const n = project({ x: t.x - t.dz, z: t.z + t.dx });
          const len = Math.hypot(n.px - a.px, n.py - a.py);
          if (len === 0) continue;
          const ux = ((n.px - a.px) / len) * (BRAKE_TICK_LEN / 2);
          const uy = ((n.py - a.py) / len) * (BRAKE_TICK_LEN / 2);
          for (const [style, width] of [
            [SURFACE, BRAKE_TICK_HALO],
            [color, BRAKE_TICK_WIDTH],
          ] as const) {
            ctx.strokeStyle = style;
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(a.px - ux, a.py - uy);
            ctx.lineTo(a.px + ux, a.py + uy);
            ctx.stroke();
          }
        }
      }
    };

    // A haloed ring in a lap's color, drawn at a projected world point. Shared
    // by the analysis-panel scrub echo and the direct line-hover marker so the
    // two read as the same cue everywhere.
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

    // Analysis-panel scrub echo: a ring at the hovered trace position on the
    // selected lap's line, in that lap's identity color.
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

    // Only the in-progress lap's markers are ambient (they leave with the
    // lap at the line). A stored lap reveals its markers when focused — line
    // hover, session-lap-list row, or the open analysis panel's selection.
    const drawCutMarkers = (project: Project, focusIndex: number) => {
      previousLapsRef.current.forEach(({ cuts }, index) => {
        if (index !== focusIndex) return;
        for (const c of cuts) {
          const { px, py } = project(c);
          drawCutMarker(px, py);
        }
      });
      for (const c of currentCutsRef.current) {
        const { px, py } = project(c);
        drawCutMarker(px, py);
      }
    };

    const drawDot = (px: number, py: number) => {
      ctx.beginPath();
      ctx.arc(px, py, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SURFACE;
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
    // Smoothed world position the follow cam tracks (and the dot renders at
    // while following) — absorbs the uneven arrival of raw frames.
    let followPos: { x: number; z: number } | null = null;
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
        if (st !== "exiting") return;
      }
      const zm = zoomRef.current;
      let target: Zoom;
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
          )
            trail.length = 0;
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
        const level = Math.min(
          ZOOM_MAX,
          Math.max(1, Math.min(width, height) / (FOLLOW_WINDOW_M * pxPerMeter)),
        );
        target = {
          level,
          ox: width / 2 - car.px * level,
          oy: height / 2 - car.py * level,
        };
      } else {
        target = ZOOM_RESET;
      }
      const blend = 1 - Math.exp(-dt / FOLLOW_TAU_S);
      const level = zm.level + (target.level - zm.level) * blend;
      const ox = zm.ox + (target.ox - zm.ox) * blend;
      const oy = zm.oy + (target.oy - zm.oy) * blend;
      // Asymptotic easing — snap inside a sub-pixel epsilon so it terminates.
      const settled =
        Math.abs(target.level - level) < 0.001 &&
        Math.abs(target.ox - ox) < 0.5 &&
        Math.abs(target.oy - oy) < 0.5;
      if (settled) {
        if (st === "exiting") {
          zoomRef.current = ZOOM_RESET; // exact fit framing, as if never followed
          setFollow("off");
        } else if (
          zm.level !== target.level ||
          zm.ox !== target.ox ||
          zm.oy !== target.oy
        ) {
          zoomRef.current = target;
        }
        return;
      }
      zoomRef.current = { level, ox, oy };
      followAnimating = true;
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
      const followState = followRef.current;
      const dirty =
        firstDraw ||
        easing ||
        followAnimating ||
        followState !== lastFollow ||
        frame !== lastFrame ||
        mouse !== lastMouse ||
        zoom !== lastZoom ||
        cutList !== lastCuts ||
        cutList.length !== lastCutCount ||
        hoveredLap !== lastHoveredLap ||
        scrub !== lastScrub ||
        analysisLap !== lastAnalysisLap ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastFollow = followState;
      lastFrame = frame;
      lastMouse = mouse;
      lastZoom = zoom;
      lastCuts = cutList;
      lastCutCount = cutList.length;
      lastHoveredLap = hoveredLap;
      lastScrub = scrub;
      lastAnalysisLap = analysisLap;
      lastW = width;
      lastH = height;
      lastDpr = dpr;

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
            cuts: currentCutsRef.current,
            brakes: computeBrakeTicks(currentRef.current),
          });
          if (previousLapsRef.current.length > MAX_LAPS)
            previousLapsRef.current.shift();
          currentRef.current = [];
          currentCutsRef.current = [];
          lapsVersion++;
        }
        lapRef.current = frame.lapCount;
        lapTimeRef.current = frame.lapTimeMs;

        // Attach newly arrived cuts: the in-progress lap collects them live,
        // a just-completed stored lap picks up a boundary straggler, and
        // anything else (pre-restart leftovers) is dropped.
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
            currentCutsRef.current.push({ x: cut.x, z: cut.z });
          } else {
            previousLapsRef.current
              .find((l) => l.lap === cut.lapCount + 1)
              ?.cuts.push({ x: cut.x, z: cut.z });
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
        const project: Project = zoomed(base);
        const zm = zoomRef.current;

        // Everything the projection depends on — a change invalidates layers.
        const projKey = `m|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) {
          const { px, py } = project(dotWorld(frame));
          drawDot(px, py);
        }
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
        const project: Project = zoomed(base);
        const zm = zoomRef.current;
        const projKey = `e|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) {
          const { px, py } = project(dotWorld(frame));
          drawDot(px, py);
        }
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
      const { px, py } = project(dotWorld(frame));
      drawDot(px, py);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.offsetX, y: e.offsetY };
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
    };
    // Hover + wheel only — zooming must never require a click or window focus,
    // so the game keeps receiving controller input while the map is used.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Any wheel input interrupts the follow cam in place: manual zoom
      // seeds from the current follow transform (zoomRef already holds it)
      // and the exit button stays available for the animated return.
      const st = followRef.current;
      if (st === "following" || st === "exiting") setFollow("detached");
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
        if (followRef.current === "detached") setFollow("off");
        return;
      }
      // Anchor the world point under the cursor: base = (m - o) / level must
      // land back on m, so o' = m - (m - o) * (level' / level).
      const r = level / zm.level;
      zoomRef.current = {
        level,
        ox: e.offsetX - (e.offsetX - zm.ox) * r,
        oy: e.offsetY - (e.offsetY - zm.oy) * r,
      };
    };
    // Touch gestures (the desktop mouse/wheel path above is untouched): two
    // fingers pinch-zoom anchored at the midpoint, one finger pans while
    // zoomed, and a contact that never leaves the tap slop is a tap driving
    // the same mouseRef hover pick as a parked cursor. Everything writes the
    // same fresh Zoom objects the wheel writes, so the dirty-gated rAF loop
    // repaints exactly when a gesture actually changed something.
    let tapStart: { x: number; y: number } | null = null;
    let touchMoved = false; // gesture left the tap slop (pan/pinch happened)
    let lastSingle: { x: number; y: number } | null = null;
    let lastPinch: { dist: number; mx: number; my: number } | null = null;

    const touchPoint = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    // Pinch or pan during follow hands the view to manual zoom in place,
    // exactly like wheel input (zoomRef already holds the follow transform).
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
      } else {
        // Multi-finger is never a tap; a lingering readout leaves with it.
        tapStart = null;
        mouseRef.current = null;
      }
      seedTouches(e.touches);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
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
        detachFollow();
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
      if (tapStart && !touchMoved) {
        // A clean tap: park the "cursor" there — the ordinary hit test shows
        // the readout on a line and clears it on empty track.
        mouseRef.current = { x: tapStart.x, y: tapStart.y };
      } else if (touchMoved) {
        const zm = zoomRef.current;
        if (zm.level !== 1 && zm.level < ZOOM_SNAP_LEVEL) {
          zoomRef.current = ZOOM_RESET;
          if (followRef.current === "detached") setFollow("off");
        }
      }
      tapStart = null;
      touchMoved = false;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

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
    };
  }, [mapData, telemetryRef, lapsRef, cutsRef, hoveredLapRef, scrubRef, analysisLapRef]);

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
      {/* Follow-cam control: hover-armed (3 s dwell), never clicked — a click
          would focus the browser and steal controller input from the game.
          One persistent element swaps between the two roles so the button
          replacement under a parked cursor never fires boundary events. */}
      {(followUi === "off" ? hasFrame : followUi !== "exiting") && (
        <button
          type="button"
          onMouseEnter={() =>
            startDwell(followUi === "off" ? "following" : "exiting")
          }
          onMouseLeave={leaveDwell}
          onPointerDown={(e) => {
            // Suppress the compatibility mouse events a tap would synthesize.
            if (e.pointerType === "touch") e.preventDefault();
          }}
          onPointerUp={onFollowTap}
          title="Rest the cursor here for 3 seconds — no click needed"
          className="absolute bottom-3 left-4 overflow-hidden rounded border border-edge bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink-secondary"
        >
          {followUi === "off" ? "Follow car" : "Exit follow"}
          <span
            className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent ${
              dwelling
                ? "w-full transition-[width] duration-[3000ms] ease-linear"
                : "w-0"
            }`}
          />
        </button>
      )}
      <canvas ref={canvasRef} className="size-full touch-none" />
    </section>
  );
};
