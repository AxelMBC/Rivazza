import { useEffect, useRef, useState } from 'react';
import type { CutEvent, MapMeta, SessionInfo, TelemetryFrame, TrackEdges } from '../types';
import type { LapRecord } from '../hooks/useLapHistory';
import { formatLapTime } from '../lib/format';
import { BRIDGE_HTTP } from '../hooks/useTelemetry';

type Props = {
  session: SessionInfo;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  lapsRef: React.RefObject<LapRecord[]>;
  cutsRef: React.RefObject<CutEvent[]>;
  // Display lap number hovered in the session-lap list (LapTimes writes it);
  // that lap's cut markers reveal while set.
  hoveredLapRef: React.RefObject<number | null>;
};

// map.ini metadata fixes the viewport and projection; edges are the track
// limits parsed from the AI spline's side distances. The track's map.png is
// deliberately never drawn: AC strokes it at constant width around the AI
// line, so it misrepresents track limits — the ribbon (when edges resolve)
// and the driven lines are the track. Null only when neither asset exists.
type MapData = { meta: MapMeta | null; edges: TrackEdges | null };
// `jump` marks a teleport (pits, restart) — no segment is drawn into it.
// `speedKmh` is the raw frame speed, kept for the hover speed readout.
type Sample = { x: number; z: number; gas: number; brake: number; speedKmh: number; jump: boolean };
// Where a lap died: the world position of one 4-tyres-out onset.
type CutMarker = { x: number; z: number };
type View = { cx: number; cz: number; ex: number; ez: number };
// Screen-space zoom layered over the base fit projection: zoomed = base * level + (ox, oy).
type Zoom = { level: number; ox: number; oy: number };
type LegendEntry = { lap: number; color: string; timeMs: number | null; invalid: boolean };

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

const SURFACE = '#1a1a19';
// Track-limits ribbon: asphalt just above the panel surface, edge strokes
// muted so the pedal-colored lines stay visually dominant.
const TRACK_FILL = '#242422';
const TRACK_EDGE = 'rgba(255, 255, 255, 0.28)';
const TRACK_EDGE_WIDTH = 1;
const PREVIOUS_LAP = 'rgba(255, 255, 255, 0.45)';
const HOVERED_GREY_LAP = '#ffffff'; // uncolored laps brighten to solid white on hover
const INVALID_TIME = '#f0554b'; // theme critical, brightened for the small canvas label

// Identity colors for the most recent completed laps, assigned by lap % size
// so a lap keeps its color all session. Hues deliberately avoid the green /
// red / yellow reserved for the current lap's pedal gradient.
const LAP_PALETTE = ['#3f8efc', '#ff8a3d', '#a06bf5', '#2fd0e0', '#f25fd0', '#8f9dff'];
const COLORED_LAPS = LAP_PALETTE.length;
const lapColor = (lap: number): string => LAP_PALETTE[lap % LAP_PALETTE.length];

// Pedal-state colors: coast (yellow) blends toward throttle (green) or
// brake (red) with pedal magnitude, so partial inputs read as softer tones.
const COAST: [number, number, number] = [250, 178, 25];
const THROTTLE: [number, number, number] = [18, 190, 60];
const BRAKE: [number, number, number] = [235, 55, 45];

const lerpColor = (from: [number, number, number], to: [number, number, number], t: number) => {
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * Math.min(1, Math.max(0, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

const segmentColor = (gas: number, brake: number): string => {
  if (brake > DEAD_ZONE && brake >= gas) return lerpColor(COAST, BRAKE, brake);
  if (gas > DEAD_ZONE) return lerpColor(COAST, THROTTLE, gas);
  return `rgb(${COAST[0]}, ${COAST[1]}, ${COAST[2]})`;
};

const freshBounds = () => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });

export const TrackMap = ({ session, telemetryRef, lapsRef, cutsRef, hoveredLapRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapProbed, setMapProbed] = useState(false);
  // Current lap's driving line (pedal-colored) and every completed lap
  // (drawn grey underneath so the session history never disappears).
  const currentRef = useRef<Sample[]>([]);
  const previousLapsRef = useRef<{ lap: number; samples: Sample[]; cuts: CutMarker[] }[]>([]);
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
  // DOM legend for the colored laps; the key ref gates setState from the rAF loop.
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const legendKeyRef = useRef('');

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
  };

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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Offscreen layers so a typical frame is a few blits plus the segments
    // added since the last one — instead of re-projecting and re-stroking
    // every stored lap. All live only as long as this effect (mapData/session).
    const lapsLayer = document.createElement('canvas');
    const lapsLayerCtx = lapsLayer.getContext('2d');
    const currentLayer = document.createElement('canvas');
    const currentLayerCtx = currentLayer.getContext('2d');
    const trackLayer = document.createElement('canvas');
    const trackLayerCtx = trackLayer.getContext('2d');
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

    type Projected = { px: number; py: number };
    type Project = (p: { x: number; z: number }) => Projected;

    // Screen-space zoom over a base fit projection. Points (not the canvas
    // transform) are scaled, so stroke widths, the dot radius, and the hover
    // pick radius stay constant in screen pixels at every zoom level.
    const zoomed = (base: Project): Project => (p) => {
      const { px, py } = base(p);
      const zm = zoomRef.current;
      return { px: px * zm.level + zm.ox, py: py * zm.level + zm.oy };
    };

    // Per-segment colored polyline. `from` lets the current-lap layer append
    // only the segments added since its last draw.
    const drawPath = (
      target: CanvasRenderingContext2D,
      samples: Sample[],
      project: Project,
      colorFor: (s: Sample) => string,
      lineWidth: number,
      from = 1,
    ) => {
      if (samples.length < 2) return;
      target.lineWidth = lineWidth;
      target.lineCap = 'round';
      for (let i = Math.max(1, from); i < samples.length; i++) {
        if (samples[i].jump) continue;
        const a = project(samples[i - 1]);
        const b = project(samples[i]);
        target.strokeStyle = colorFor(samples[i]);
        target.beginPath();
        target.moveTo(a.px, a.py);
        target.lineTo(b.px, b.py);
        target.stroke();
      }
    };

    // Uniform-color laps batch into a single stroke, so re-rendering the
    // cached lap layer stays cheap even with a full session of laps.
    const drawUniformPath = (
      target: CanvasRenderingContext2D,
      samples: Sample[],
      project: Project,
      color: string,
      lineWidth: number,
    ) => {
      if (samples.length < 2) return;
      target.strokeStyle = color;
      target.lineWidth = lineWidth;
      target.lineCap = 'round';
      target.lineJoin = 'round';
      target.beginPath();
      samples.forEach((s, i) => {
        const { px, py } = project(s);
        if (i === 0 || s.jump) target.moveTo(px, py);
        else target.lineTo(px, py);
      });
      target.stroke();
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
    let lapsLayerKey = '';
    let currentLayerKey = '';
    let appendedCount = 0;
    let trackLayerKey = '';

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
      if (!edges) return;
      if (projKey !== trackLayerKey) {
        trackLayerKey = projKey;
        sizeLayer(trackLayer, canvas.width, canvas.height);
        trackLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        trackLayerCtx.clearRect(0, 0, width, height);

        const trace = (line: [number, number][], reverse: boolean, move: boolean) => {
          for (let i = 0; i < line.length; i++) {
            const [x, z] = line[reverse ? line.length - 1 - i : i];
            const { px, py } = project({ x, z });
            if (i === 0 && move) trackLayerCtx.moveTo(px, py);
            else trackLayerCtx.lineTo(px, py);
          }
        };
        // Closed circuits fill as an annulus: the two edge rings run in
        // opposite directions, so the nonzero rule leaves the infield empty.
        // Open splines (hillclimbs) fill as a single strip.
        trackLayerCtx.beginPath();
        if (edges.closed) {
          trace(edges.left, false, true);
          trackLayerCtx.closePath();
          trace(edges.right, true, true);
          trackLayerCtx.closePath();
        } else {
          trace(edges.left, false, true);
          trace(edges.right, true, false);
          trackLayerCtx.closePath();
        }
        trackLayerCtx.fillStyle = TRACK_FILL;
        trackLayerCtx.fill();

        // The edge strokes are the actual track limits.
        trackLayerCtx.strokeStyle = TRACK_EDGE;
        trackLayerCtx.lineWidth = TRACK_EDGE_WIDTH;
        trackLayerCtx.lineJoin = 'round';
        for (const line of [edges.left, edges.right]) {
          trackLayerCtx.beginPath();
          trace(line, false, true);
          if (edges.closed) trackLayerCtx.closePath();
          trackLayerCtx.stroke();
        }
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
      laps.forEach(({ lap, samples }, index) => {
        if (index === hoveredIndex) return;
        const color = index >= coloredFrom ? lapColor(lap) : PREVIOUS_LAP;
        drawUniformPath(lapsLayerCtx, samples, project, color, LINE_WIDTH - 0.5);
      });
    };

    // Current lap accumulates incrementally; any projection change (zoom,
    // resize, fallback view movement) or shrink (rollover/reset) redraws it.
    const renderCurrentLayer = (
      project: Project,
      projKey: string,
      width: number,
      height: number,
      dpr: number,
    ) => {
      const samples = currentRef.current;
      if (projKey !== currentLayerKey || samples.length < appendedCount) {
        currentLayerKey = projKey;
        sizeLayer(currentLayer, canvas.width, canvas.height);
        currentLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        currentLayerCtx.clearRect(0, 0, width, height);
        appendedCount = 0;
      }
      if (samples.length > appendedCount) {
        currentLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawPath(
          currentLayerCtx,
          samples,
          project,
          (s) => segmentColor(s.gas, s.brake),
          LINE_WIDTH,
          Math.max(1, appendedCount),
        );
        appendedCount = samples.length;
      }
    };

    // Hover pick: the nearest stored lap line within HOVER_RADIUS of the
    // cursor (index, or -1), plus a speed row for every *colored* lap that
    // passes within the radius — at high zoom the lines separate on screen,
    // so the rows naturally narrow to the lines the cursor is actually near.
    // Samples are ~1 m apart so point distance is a faithful line distance;
    // stepping by 3 keeps the scan cheap even with a full session of laps.
    type HoverRow = { lap: number; color: string; speedKmh: number };
    type HitResult = { nearest: number; rows: HoverRow[] };

    const hitTestLaps = (project: Project): HitResult => {
      const m = mouseRef.current;
      const laps = previousLapsRef.current;
      if (!m || laps.length === 0) return { nearest: -1, rows: [] };
      const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
      let nearest = -1;
      let nearestD = HOVER_RADIUS_SQ;
      const rows: HoverRow[] = [];
      laps.forEach(({ lap, samples }, index) => {
        let bestD = HOVER_RADIUS_SQ;
        let bestSpeed = 0;
        for (let i = 0; i < samples.length; i += 3) {
          const { px, py } = project(samples[i]);
          const d = (px - m.x) ** 2 + (py - m.y) ** 2;
          if (d < bestD) {
            bestD = d;
            bestSpeed = samples[i].speedKmh;
          }
        }
        if (bestD >= HOVER_RADIUS_SQ) return;
        if (bestD < nearestD) {
          nearestD = bestD;
          nearest = index;
        }
        if (index >= coloredFrom) rows.push({ lap, color: lapColor(lap), speedKmh: bestSpeed });
      });
      rows.reverse(); // laps store oldest-first; the readout lists newest first
      return { nearest, rows };
    };

    // Hover readout: one row per in-radius colored lap ("Lap N · 143 km/h" in
    // the lap's color), with the nearest lap overall also carrying its
    // recorded time (red when invalid; number-only when unrecorded, e.g. laps
    // driven before the page connected). A nearest lap outside the colored
    // set keeps the classic white "Lap N — time" row on top.
    type Seg = { text: string; color: string };

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
            color: record.invalid ? INVALID_TIME : '#ffffff',
          },
        ];
      };
      const lines: Seg[][] = rows.map((row) => [
        { text: `Lap ${row.lap}`, color: row.color },
        ...(row.lap === nearestLap ? timeSegs(row.lap) : []),
        { text: ` · ${Math.round(row.speedKmh)} km/h`, color: row.color },
      ]);
      if (!rows.some((row) => row.lap === nearestLap)) {
        lines.unshift([{ text: `Lap ${nearestLap}`, color: '#ffffff' }, ...timeSegs(nearestLap)]);
      }
      ctx.font = '12px system-ui';
      const rowH = 16;
      const boxW =
        Math.max(...lines.map((segs) => segs.reduce((w, s) => w + ctx.measureText(s.text).width, 0))) + 12;
      const x = m.x + 14;
      const y = m.y - 8;
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 14, boxW, lines.length * rowH + 4, 6);
      ctx.fillStyle = 'rgba(13, 13, 13, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
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

    let lastCursor = '';
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
      setCursor(hit.nearest >= 0 ? 'pointer' : 'default');
      // Draw order matches the pre-layer renderer exactly: previous laps
      // (minus hovered) → current lap → hovered emphasis → readout.
      renderLapsLayer(project, projKey, hit.nearest, width, height, dpr);
      blitLayer(lapsLayer);
      renderCurrentLayer(project, projKey, width, height, dpr);
      blitLayer(currentLayer);
      if (hit.nearest >= 0) {
        // Emphasis keeps the lap's identity color: thicker + full opacity
        // (grey laps brighten to solid white) instead of a separate hue.
        const laps = previousLapsRef.current;
        const coloredFrom = Math.max(0, laps.length - COLORED_LAPS);
        const { lap, samples } = laps[hit.nearest];
        const color = hit.nearest >= coloredFrom ? lapColor(lap) : HOVERED_GREY_LAP;
        drawUniformPath(ctx, samples, project, color, LINE_WIDTH + 1);
      }
      drawCutMarkers(project, hit.nearest);
      if (hit.nearest >= 0) drawHoverReadout(hit);
    };

    // Cut markers are stroked directly on every repaint — a session holds at
    // most a handful, so projecting them is far cheaper than another layer.
    const strokeCross = (px: number, py: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
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
    // lap at the line). A stored lap reveals its markers on demand: hovering
    // its line here, or its row in the session-lap list (hoveredLapRef).
    const drawCutMarkers = (project: Project, hoveredIndex: number) => {
      const listLap = hoveredLapRef.current;
      previousLapsRef.current.forEach(({ lap, cuts }, index) => {
        if (index !== hoveredIndex && lap !== listLap) return;
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
      ctx.fillStyle = '#ffffff';
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
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    let firstDraw = true;
    // Fallback mode keeps repainting while the auto-fit viewport eases.
    let easing = false;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const frame = telemetryRef.current;
      const mouse = mouseRef.current;
      const zoom = zoomRef.current;
      const cutList = cutsRef.current;
      const hoveredLap = hoveredLapRef.current;
      const dirty =
        firstDraw ||
        easing ||
        frame !== lastFrame ||
        mouse !== lastMouse ||
        zoom !== lastZoom ||
        cutList !== lastCuts ||
        cutList.length !== lastCutCount ||
        hoveredLap !== lastHoveredLap ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastFrame = frame;
      lastMouse = mouse;
      lastZoom = zoom;
      lastCuts = cutList;
      lastCutCount = cutList.length;
      lastHoveredLap = hoveredLap;
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
            (frame.lapCount === prevLap && frame.lapTimeMs + 1000 < lapTimeRef.current));
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
          });
          if (previousLapsRef.current.length > MAX_LAPS) previousLapsRef.current.shift();
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
        for (; consumedCutsRef.current < cutList.length; consumedCutsRef.current++) {
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
        const moved = last ? Math.hypot(frame.x - last.x, frame.z - last.z) : Infinity;
        if (samples.length < MAX_SAMPLES && moved > SAMPLE_SPACING) {
          if (!anchorRef.current) anchorRef.current = { x: frame.x, z: frame.z };
          samples.push({
            x: frame.x,
            z: frame.z,
            gas: frame.gas,
            brake: frame.brake,
            speedKmh: frame.speedKmh,
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
        const key = entries.map((e) => `${e.lap}:${e.timeMs}:${e.invalid}`).join('|');
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
        const zm = zoomRef.current;

        // World (x, z) -> map.ini pixel space -> normalized -> canvas.
        const project: Project = zoomed((p) => ({
          px: offsetX + (((p.x + meta.xOffset) / meta.scaleFactor) / meta.width) * drawnW,
          py: offsetY + (((p.z + meta.zOffset) / meta.scaleFactor) / meta.height) * drawnH,
        }));

        // Everything the projection depends on — a change invalidates layers.
        const projKey = `m|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) {
          const { px, py } = project({ x: frame.x, z: frame.z });
          drawDot(px, py);
        }
        return;
      }

      if (edgeView) {
        // Edges without map.ini: fixed fit around the ribbon bounds.
        easing = false;
        const view = edgeView;
        const scale = Math.min((width - PADDING * 2) / view.ex, (height - PADDING * 2) / view.ez);
        // Same handedness as the map.ini projection (world +Z down-screen).
        const project: Project = zoomed((p) => ({
          px: width / 2 + (p.x - view.cx) * scale,
          py: height / 2 + (p.z - view.cz) * scale,
        }));
        const zm = zoomRef.current;
        const projKey = `e|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}`;
        renderTrackLayer(project, projKey, width, height, dpr);
        drawLaps(project, projKey, width, height, dpr);
        if (frame) {
          const { px, py } = project({ x: frame.x, z: frame.z });
          drawDot(px, py);
        }
        return;
      }

      // No map data at all for this track: auto-fit the driven lines. The
      // viewport eases toward the (margin-padded) bounds so the first lap
      // doesn't pin the car dot against the canvas edges while the extent is
      // still growing.
      if (!frame || (currentRef.current.length < 2 && previousLapsRef.current.length === 0)) {
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
          ex: Math.max(FIRST_LAP_EXTENT, 2 * Math.max(b.maxX - anchor.x, anchor.x - b.minX) * pad),
          ez: Math.max(FIRST_LAP_EXTENT, 2 * Math.max(b.maxZ - anchor.z, anchor.z - b.minZ) * pad),
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
      const scale = Math.min((width - PADDING * 2) / view.ex, (height - PADDING * 2) / view.ez);
      // World +Z maps down-screen — the same handedness as the map.ini /
      // map.png projection, so turn direction is never mirrored between modes.
      // User zoom multiplies the eased auto-fit view; at 1× the automatic
      // camera behaves exactly as before.
      const project: Project = zoomed((p) => ({
        px: width / 2 + (p.x - view.cx) * scale,
        py: height / 2 + (p.z - view.cz) * scale,
      }));

      const zm = zoomRef.current;
      const projKey = `f|${width}x${height}@${dpr}|${zm.level},${zm.ox},${zm.oy}|${view.cx},${view.cz},${view.ex},${view.ez}`;
      drawLaps(project, projKey, width, height, dpr);
      const { px, py } = project({ x: frame.x, z: frame.z });
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
      const zm = zoomRef.current;
      const level = Math.min(ZOOM_MAX, Math.max(1, zm.level * ZOOM_STEP ** (-e.deltaY / 100)));
      if (level === zm.level) return;
      if (level === 1) {
        // Fully out = exact fit framing again; any accumulated focus is discarded.
        zoomRef.current = ZOOM_RESET;
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
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [mapData, telemetryRef, lapsRef, cutsRef, hoveredLapRef]);

  return (
    <section className="relative flex min-h-0 flex-col rounded-lg border border-edge bg-surface">
      <p className="absolute top-3 left-4 text-xs tracking-wide text-ink-muted uppercase">
        Track map
      </p>
      <div className="absolute top-3 right-4 flex items-center gap-3 text-xs text-ink-muted">
        {mapProbed && !mapData && <span>No map file — drawing your driving line</span>}
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full" style={{ background: 'rgb(18, 190, 60)' }} />
          Throttle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full" style={{ background: 'rgb(250, 178, 25)' }} />
          Coast
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full" style={{ background: 'rgb(235, 55, 45)' }} />
          Brake
        </span>
      </div>
      {legend.length > 0 && (
        <div className="pointer-events-none absolute right-4 bottom-3 flex flex-col gap-1 text-xs">
          {legend.map((entry) => (
            <span key={entry.lap} className="flex items-center justify-end gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-ink-muted">Lap {entry.lap}</span>
              {entry.timeMs != null && (
                <span
                  className={`tabular-nums ${entry.invalid ? 'text-critical' : 'text-ink-secondary'}`}
                >
                  {formatLapTime(entry.timeMs)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <canvas ref={canvasRef} className="size-full" />
    </section>
  );
};
