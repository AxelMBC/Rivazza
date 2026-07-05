import { useEffect, useRef, useState } from 'react';
import type { MapMeta, SessionInfo, TelemetryFrame } from '../types';
import type { LapRecord } from '../hooks/useLapHistory';
import { formatLapTime } from '../lib/format';
import { BRIDGE_HTTP } from '../hooks/useTelemetry';

type Props = {
  session: SessionInfo;
  telemetryRef: React.RefObject<TelemetryFrame | null>;
  lapsRef: React.RefObject<LapRecord[]>;
};

// meta alone (map.ini bounds) fixes the viewport; the image is optional.
type MapData = { meta: MapMeta; image: HTMLImageElement | null };
// `jump` marks a teleport (pits, restart) — no segment is drawn into it.
type Sample = { x: number; z: number; gas: number; brake: number; jump: boolean };
type View = { cx: number; cz: number; ex: number; ez: number };

const PADDING = 24;
const DOT_RADIUS = 7;
const SAMPLE_SPACING = 1; // meters between line samples — fine enough for exact corner shapes
const MAX_SAMPLES = 25000; // hard cap so a stuck lap counter can't grow unbounded
const MAX_LAPS = 40; // completed laps kept on the map (oldest dropped beyond this)
const HOVER_RADIUS_SQ = 12 * 12; // px² — how close the cursor must be to pick a lap line
const TELEPORT_DIST = 100; // a jump this large between frames isn't driving
const DEAD_ZONE = 0.05;
const LINE_WIDTH = 3;
const VIEW_MARGIN = 0.15; // extra space around the driven bounds (fallback mode)
const VIEW_EASE = 0.06; // per-frame easing toward the target view (fallback mode)
// Until a full lap exists the track's real size is unknown — assume at least
// this many meters so the view starts zoomed out instead of stretching the
// first few corners across the whole canvas.
const FIRST_LAP_EXTENT = 1500;

const SURFACE = '#1a1a19';
const PREVIOUS_LAP = 'rgba(255, 255, 255, 0.45)';
const HOVERED_LAP = '#3987e5';
const INVALID_TIME = '#f0554b'; // theme critical, brightened for the small canvas label

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

export const TrackMap = ({ session, telemetryRef, lapsRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [mapProbed, setMapProbed] = useState(false);
  // Current lap's driving line (pedal-colored) and every completed lap
  // (drawn grey underneath so the session history never disappears).
  const currentRef = useRef<Sample[]>([]);
  const previousLapsRef = useRef<{ lap: number; samples: Sample[] }[]>([]);
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

  const resetLines = () => {
    currentRef.current = [];
    previousLapsRef.current = [];
    lapRef.current = null;
    lapTimeRef.current = 0;
    boundsRef.current = freshBounds();
    viewRef.current = null;
    anchorRef.current = null;
  };

  useEffect(() => {
    resetLines();
    setMapData(null);
    setMapProbed(false);

    // Always probe the bridge instead of trusting session flags — a page
    // holding a stale session must still pick up bounds the bridge has now.
    let cancelled = false;
    const load = async () => {
      let meta: MapMeta | null = null;
      try {
        const res = await fetch(`${BRIDGE_HTTP}/api/track-map/meta`);
        if (res.ok) meta = await res.json();
      } catch {
        // bridge unreachable; treated as no map data
      }
      let image: HTMLImageElement | null = null;
      if (meta) {
        try {
          const img = new Image();
          // Cache-bust per track so a new session never shows the previous map.
          img.src = `${BRIDGE_HTTP}/api/track-map/image?v=${encodeURIComponent(
            `${session.track}/${session.trackConfig}`,
          )}`;
          await img.decode();
          image = img;
        } catch {
          // no map.png for this track; bounds-only rendering
        }
      }
      if (cancelled) return;
      if (meta) setMapData({ meta, image });
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
    let rafId = 0;

    type Projected = { px: number; py: number };
    type Project = (p: { x: number; z: number }) => Projected;

    const drawPath = (
      samples: Sample[],
      project: Project,
      colorFor: (s: Sample) => string,
      lineWidth: number,
    ) => {
      if (samples.length < 2) return;
      const points = samples.map(project);
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      for (let i = 1; i < points.length; i++) {
        if (samples[i].jump) continue;
        ctx.strokeStyle = colorFor(samples[i]);
        ctx.beginPath();
        ctx.moveTo(points[i - 1].px, points[i - 1].py);
        ctx.lineTo(points[i].px, points[i].py);
        ctx.stroke();
      }
    };

    // Uniform-color laps batch into a single stroke, so a whole session of
    // stored laps stays cheap to redraw every frame.
    const drawUniformPath = (
      samples: Sample[],
      project: Project,
      color: string,
      lineWidth: number,
    ) => {
      if (samples.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      samples.forEach((s, i) => {
        const { px, py } = project(s);
        if (i === 0 || s.jump) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    // Nearest stored lap line within HOVER_RADIUS of the cursor (index, or -1).
    // Samples are ~1 m apart so point distance is a faithful line distance;
    // stepping by 3 keeps the scan cheap even with a full session of laps.
    const hitTestLaps = (project: Project): number => {
      const m = mouseRef.current;
      if (!m) return -1;
      let best = -1;
      let bestD = HOVER_RADIUS_SQ;
      previousLapsRef.current.forEach(({ samples }, index) => {
        for (let i = 0; i < samples.length; i += 3) {
          const { px, py } = project(samples[i]);
          const d = (px - m.x) ** 2 + (py - m.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = index;
          }
        }
      });
      return best;
    };

    // "Lap N" plus the recorded time when the lap log has it (red when the
    // lap was invalid); laps driven before the page connected have no record
    // and keep the number-only label.
    const drawHoverLabel = (lapNumber: number) => {
      const m = mouseRef.current;
      if (!m) return;
      const record = lapsRef.current.find((l) => l.lap === lapNumber);
      const base = record ? `Lap ${lapNumber} — ` : `Lap ${lapNumber}`;
      const time = record ? formatLapTime(record.timeMs) : '';
      ctx.font = '12px system-ui';
      const baseW = ctx.measureText(base).width;
      const timeW = time ? ctx.measureText(time).width : 0;
      const x = m.x + 14;
      const y = m.y - 8;
      ctx.beginPath();
      ctx.roundRect(x - 6, y - 14, baseW + timeW + 12, 20, 6);
      ctx.fillStyle = 'rgba(13, 13, 13, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(base, x, y);
      if (record) {
        ctx.fillStyle = record.invalid ? INVALID_TIME : '#ffffff';
        ctx.fillText(time, x + baseW, y);
      }
    };

    const drawLaps = (project: Project) => {
      const hovered = hitTestLaps(project);
      canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
      previousLapsRef.current.forEach(({ samples }, index) => {
        if (index !== hovered) drawUniformPath(samples, project, PREVIOUS_LAP, LINE_WIDTH - 0.5);
      });
      drawPath(currentRef.current, project, (s) => segmentColor(s.gas, s.brake), LINE_WIDTH);
      if (hovered >= 0) {
        const { lap, samples } = previousLapsRef.current[hovered];
        drawUniformPath(samples, project, HOVERED_LAP, LINE_WIDTH + 0.5);
        drawHoverLabel(lap);
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

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const frame = telemetryRef.current;
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
        } else if (prevLap !== null && frame.lapCount > prevLap) {
          // Lap finished: keep it among the grey reference lines underneath.
          // Display convention matches the LAP tile: lapCount N is "Lap N+1".
          previousLapsRef.current.push({ lap: prevLap + 1, samples: currentRef.current });
          if (previousLapsRef.current.length > MAX_LAPS) previousLapsRef.current.shift();
          currentRef.current = [];
        }
        lapRef.current = frame.lapCount;
        lapTimeRef.current = frame.lapTimeMs;

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
            jump: !!last && moved > TELEPORT_DIST,
          });
          const b = boundsRef.current;
          b.minX = Math.min(b.minX, frame.x);
          b.maxX = Math.max(b.maxX, frame.x);
          b.minZ = Math.min(b.minZ, frame.z);
          b.maxZ = Math.max(b.maxZ, frame.z);
        }
      }

      if (mapData) {
        // map.ini pixel dimensions fix the viewport with or without the image,
        // so the framing is identical from the very first frame.
        const { meta, image } = mapData;
        const scale = Math.min(
          (width - PADDING * 2) / meta.width,
          (height - PADDING * 2) / meta.height,
        );
        const drawnW = meta.width * scale;
        const drawnH = meta.height * scale;
        const offsetX = (width - drawnW) / 2;
        const offsetY = (height - drawnH) / 2;
        if (image) ctx.drawImage(image, offsetX, offsetY, drawnW, drawnH);

        // World (x, z) -> map.ini pixel space -> normalized -> canvas.
        const project: Project = (p) => ({
          px: offsetX + (((p.x + meta.xOffset) / meta.scaleFactor) / meta.width) * drawnW,
          py: offsetY + (((p.z + meta.zOffset) / meta.scaleFactor) / meta.height) * drawnH,
        });

        drawLaps(project);
        if (frame) {
          const { px, py } = project({ x: frame.x, z: frame.z });
          drawDot(px, py);
        }
        return;
      }

      // No map.png for this track: auto-fit the driven lines. The viewport
      // eases toward the (margin-padded) bounds so the first lap doesn't pin
      // the car dot against the canvas edges while the extent is still growing.
      if (!frame || (currentRef.current.length < 2 && previousLapsRef.current.length === 0)) return;
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
      }
      const scale = Math.min((width - PADDING * 2) / view.ex, (height - PADDING * 2) / view.ez);
      // Y is flipped so driving north in the sim moves the dot up on screen.
      const project: Project = (p) => ({
        px: width / 2 + (p.x - view.cx) * scale,
        py: height / 2 - (p.z - view.cz) * scale,
      });

      drawLaps(project);
      const { px, py } = project({ x: frame.x, z: frame.z });
      drawDot(px, py);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.offsetX, y: e.offsetY };
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
    };
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [mapData, telemetryRef, lapsRef]);

  return (
    <section className="relative flex min-h-0 flex-col rounded-lg border border-edge bg-surface">
      <p className="absolute top-3 left-4 text-xs tracking-wide text-ink-muted uppercase">
        Track map
      </p>
      <div className="absolute top-3 right-4 flex items-center gap-3 text-xs text-ink-muted">
        {mapProbed && !mapData && <span>No map file — drawing your driving line</span>}
        {mapData && !mapData.image && <span>No map image — track bounds from map.ini</span>}
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
      <canvas ref={canvasRef} className="size-full" />
    </section>
  );
};
