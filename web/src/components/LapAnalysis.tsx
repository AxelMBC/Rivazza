import { useEffect, useMemo, useRef, useState } from 'react';
import type { LapRecord } from '../hooks/useLapHistory';
import type { LapRecording, LapTelemetrySample } from '../hooks/useLapRecordings';
import { formatGearCompact, formatLapTime } from '../lib/format';
import { lapColor } from '../lib/lapColors';
import {
  SECTOR_COUNT,
  SECTOR_TOLERANCE_MS,
  bestSectors,
  interpolateTimeAt,
  resolveReference,
  sampleNear,
  sectorTimes,
  theoreticalBestMs,
  worldPointAt,
} from '../lib/lapAnalysis';
import type { ScrubPoint } from '../lib/lapAnalysis';

type Props = {
  recordingsRef: React.RefObject<LapRecording[]>;
  // Recording-store change signal — the re-render driver for this panel.
  version: number;
  lapsRef: React.RefObject<LapRecord[]>;
  // Written while scrubbing the traces; the track map echoes the point.
  scrubRef: React.RefObject<ScrubPoint | null>;
  // The panel's selected lap while the panel is open (display lap number),
  // null otherwise — the track map reveals that lap's braking ticks.
  analysisLapRef: React.RefObject<number | null>;
};

const PAD_X = 10;
const PAD_TOP = 16; // room for the caption row above the first strip
const PAD_BOTTOM = 8;
const STRIP_GAP = 18; // captions live in the gaps between strips
// Same canvas color literals as the map/pedal-trace convention.
const REFERENCE_TRACE = 'rgba(255, 255, 255, 0.4)';
const THROTTLE_TRACE = 'rgb(18, 190, 60)';
const BRAKE_TRACE = 'rgb(235, 55, 45)';
const COAST_TEXT = '#fab219';
const GRID = 'rgba(255, 255, 255, 0.07)';
const CAPTION = 'rgba(255, 255, 255, 0.35)';
// Delta strip never zooms tighter than ±0.5 s, so tiny wobbles read as flat.
const MIN_DELTA_RANGE_MS = 500;

type Strip = { top: number; h: number };

const layoutStrips = (height: number): { speed: Strip; pedals: Strip; delta: Strip } => {
  const avail = height - PAD_TOP - PAD_BOTTOM - STRIP_GAP * 2;
  const speed = { top: PAD_TOP, h: avail * 0.42 };
  const pedals = { top: speed.top + speed.h + STRIP_GAP, h: avail * 0.24 };
  const delta = { top: pedals.top + pedals.h + STRIP_GAP, h: avail * 0.34 };
  return { speed, pedals, delta };
};

// Distance-aligned lap comparison: speed, pedal, and time-delta traces of the
// selected lap over the session reference, on a shared normalized-position
// x-axis. Collapsed to a slim bar by default so the track map keeps the
// screen; hovering the bar pops the panel out over the map (the Lap tile's
// session-list pattern). Everything is hover-driven on desktop — hovering a
// lap chip selects it (and the selection sticks when the pointer leaves),
// hovering the strips scrubs a synced cursor — because clicks would focus the
// browser and steal controller input from the game. On touch the same `open`
// state is toggled by tapping the bar, chips select by tap, and a finger drag
// scrubs the strips (touch steals nothing from the game).
export const LapAnalysis = ({
  recordingsRef,
  version,
  lapsRef,
  scrubRef,
  analysisLapRef,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // null = follow the most recent complete lap until a chip is hovered.
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  // Mirrors the hover-reveal so the selected lap's brake ticks only show on
  // the map while the panel is actually on screen.
  const [open, setOpen] = useState(false);

  const recordings = recordingsRef.current;
  const laps = lapsRef.current;
  // Only valid complete laps are reviewable — an invalidated lap has nothing
  // to teach as a target, so it never appears as a chip (user directive).
  const invalidLaps = new Set(laps.filter((l) => l.invalid).map((l) => l.lap));
  const reviewableLaps = recordings.filter((r) => r.complete && !invalidLaps.has(r.lap));
  const reference = resolveReference(recordings, laps);
  const latest = reviewableLaps.length > 0 ? reviewableLaps[reviewableLaps.length - 1] : null;
  const selected =
    (selectedLap !== null ? reviewableLaps.find((r) => r.lap === selectedLap) : undefined) ??
    latest;

  // A sticky selection falls back to follow-latest when its recording is
  // evicted by the lap cap, invalidated, or cleared by a reset. (Render-time
  // resolution above already falls back; this clears the stale state.)
  useEffect(() => {
    if (
      selectedLap !== null &&
      !recordingsRef.current.some((r) => r.complete && r.lap === selectedLap)
    )
      setSelectedLap(null);
  }, [version, selectedLap, recordingsRef]);

  // Publish the focused lap for the map's brake ticks — only while open.
  useEffect(() => {
    analysisLapRef.current = open && selected ? selected.lap : null;
    return () => {
      analysisLapRef.current = null;
    };
  }, [open, selected, analysisLapRef]);

  // The best-sector table is derived on every render, not memoized by the
  // recording version: a lap's invalid flag can land in the lap log a few
  // frames after the recording is stored, and a memo keyed on the version
  // would keep crediting a cut lap with best sectors (and a theoretical
  // best) until the next lap completes. The math is a few hundred
  // interpolations — negligible at the 30 Hz render rate.
  const best = bestSectors(recordings, laps, SECTOR_COUNT);
  const theoreticalMs = theoreticalBestMs(best);
  // A stored recording is immutable once promoted, so its identity is the
  // only recompute signal needed here.
  const selectedSectors = useMemo(
    () => (selected ? sectorTimes(selected, SECTOR_COUNT) : null),
    [selected],
  );

  // Mirrors for the rAF loop and event handlers.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const referenceRef = useRef(reference);
  referenceRef.current = reference;
  const versionRef = useRef(version);
  versionRef.current = version;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Offscreen trace layer: rebuilt only when selection/reference/recordings
    // change, so a scrub frame is a blit plus the cursor overlay.
    const traceLayer = document.createElement('canvas');
    const traceCtx = traceLayer.getContext('2d');
    if (!traceCtx) return;
    let rafId = 0;
    // Hovered position as a normalized track position, null when off.
    let mousePos: number | null = null;

    const plotX = (pos: number, width: number) => PAD_X + pos * (width - PAD_X * 2);

    const tracePolyline = (
      rec: LapRecording,
      width: number,
      strip: Strip,
      value: (s: LapTelemetrySample) => number, // normalized 0..1
      color: string,
      lineWidth: number,
    ) => {
      traceCtx.strokeStyle = color;
      traceCtx.lineWidth = lineWidth;
      traceCtx.lineJoin = 'round';
      traceCtx.beginPath();
      rec.samples.forEach((s, i) => {
        const x = plotX(s.pos, width);
        const y = strip.top + (1 - Math.min(1, Math.max(0, value(s)))) * strip.h;
        if (i === 0) traceCtx.moveTo(x, y);
        else traceCtx.lineTo(x, y);
      });
      traceCtx.stroke();
    };

    const renderTraces = (
      sel: LapRecording,
      ref: LapRecording | null,
      width: number,
      height: number,
      dpr: number,
    ) => {
      if (traceLayer.width !== canvas.width || traceLayer.height !== canvas.height) {
        traceLayer.width = canvas.width;
        traceLayer.height = canvas.height;
      }
      traceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traceCtx.clearRect(0, 0, width, height);
      const strips = layoutStrips(height);

      traceCtx.strokeStyle = GRID;
      traceCtx.lineWidth = 1;
      for (const strip of [strips.speed, strips.pedals, strips.delta]) {
        for (const y of [strip.top, strip.top + strip.h]) {
          traceCtx.beginPath();
          traceCtx.moveTo(PAD_X, y);
          traceCtx.lineTo(width - PAD_X, y);
          traceCtx.stroke();
        }
      }

      const showRef = ref !== null && ref !== sel;
      let maxSpeed = 50;
      for (const rec of showRef ? [sel, ref] : [sel])
        for (const s of rec.samples) maxSpeed = Math.max(maxSpeed, s.speedKmh);
      maxSpeed *= 1.05;

      if (showRef)
        tracePolyline(ref, width, strips.speed, (s) => s.speedKmh / maxSpeed, REFERENCE_TRACE, 1.5);
      tracePolyline(sel, width, strips.speed, (s) => s.speedKmh / maxSpeed, lapColor(sel.lap), 2);

      if (showRef) {
        tracePolyline(ref, width, strips.pedals, (s) => s.gas, 'rgba(18, 190, 60, 0.35)', 1.5);
        tracePolyline(ref, width, strips.pedals, (s) => s.brake, 'rgba(235, 55, 45, 0.35)', 1.5);
      }
      tracePolyline(sel, width, strips.pedals, (s) => s.gas, THROTTLE_TRACE, 1.5);
      tracePolyline(sel, width, strips.pedals, (s) => s.brake, BRAKE_TRACE, 1.5);

      // Delta: selected minus reference at each selected sample's position.
      // Losing time sinks below the zero line (red); gaining rises (green).
      let deltaRange = MIN_DELTA_RANGE_MS;
      const deltas: (number | null)[] = ref
        ? sel.samples.map((s) => {
            const t = interpolateTimeAt(ref.samples, s.pos);
            if (t === null) return null;
            const d = s.timeMs - t;
            deltaRange = Math.max(deltaRange, Math.abs(d));
            return d;
          })
        : [];
      const mid = strips.delta.top + strips.delta.h / 2;
      traceCtx.setLineDash([3, 4]);
      traceCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      traceCtx.beginPath();
      traceCtx.moveTo(PAD_X, mid);
      traceCtx.lineTo(width - PAD_X, mid);
      traceCtx.stroke();
      traceCtx.setLineDash([]);
      if (ref) {
        const losing = new Path2D();
        const gaining = new Path2D();
        let prev: { x: number; y: number } | null = null;
        sel.samples.forEach((s, i) => {
          const d = deltas[i];
          if (d === null) {
            prev = null;
            return;
          }
          const x = plotX(s.pos, width);
          const y = mid + (d / deltaRange) * (strips.delta.h / 2);
          if (prev) {
            const path = d > 0 ? losing : gaining;
            path.moveTo(prev.x, prev.y);
            path.lineTo(x, y);
          }
          prev = { x, y };
        });
        traceCtx.lineWidth = 2;
        traceCtx.lineCap = 'round';
        traceCtx.strokeStyle = BRAKE_TRACE;
        traceCtx.stroke(losing);
        traceCtx.strokeStyle = THROTTLE_TRACE;
        traceCtx.stroke(gaining);
      }

      traceCtx.font = '10px system-ui';
      traceCtx.fillStyle = CAPTION;
      traceCtx.fillText('SPEED', PAD_X, strips.speed.top - 4);
      traceCtx.fillText('THROTTLE / BRAKE', PAD_X, strips.pedals.top - 4);
      traceCtx.fillText('DELTA TO REFERENCE', PAD_X, strips.delta.top - 4);
      traceCtx.textAlign = 'right';
      traceCtx.fillText(`${Math.round(maxSpeed)} km/h`, width - PAD_X, strips.speed.top - 4);
      traceCtx.fillText(`±${(deltaRange / 1000).toFixed(1)}s`, width - PAD_X, strips.delta.top - 4);
      traceCtx.textAlign = 'left';
    };

    // Shared vertical cursor plus a dual-lap readout, hover-only.
    const drawScrubOverlay = (width: number, height: number) => {
      const sel = selectedRef.current;
      if (mousePos === null || !sel) return;
      const pos = mousePos;
      const ref = referenceRef.current;
      const strips = layoutStrips(height);
      const x = plotX(pos, width);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, strips.speed.top);
      ctx.lineTo(x, strips.delta.top + strips.delta.h);
      ctx.stroke();

      type Seg = { text: string; color: string };
      const rows: Seg[][] = [];
      const rowFor = (rec: LapRecording, color: string): Seg[] | null => {
        const s = sampleNear(rec.samples, pos);
        if (!s) return null;
        const pedal: Seg =
          s.brake > 0.05 && s.brake >= s.gas
            ? { text: ` · BRK ${Math.round(s.brake * 100)}%`, color: BRAKE_TRACE }
            : s.gas > 0.05
              ? { text: ` · THR ${Math.round(s.gas * 100)}%`, color: THROTTLE_TRACE }
              : { text: ' · coast', color: COAST_TEXT };
        return [
          {
            text: `Lap ${rec.lap} · ${Math.round(s.speedKmh)} km/h · ${formatGearCompact(s.gear)}`,
            color,
          },
          pedal,
        ];
      };
      const selRow = rowFor(sel, lapColor(sel.lap));
      if (selRow) rows.push(selRow);
      if (ref && ref !== sel) {
        const refRow = rowFor(ref, 'rgba(255, 255, 255, 0.65)');
        if (refRow) rows.push(refRow);
        const tSel = interpolateTimeAt(sel.samples, pos);
        const tRef = interpolateTimeAt(ref.samples, pos);
        if (tSel !== null && tRef !== null) {
          const d = tSel - tRef;
          rows.push([
            {
              text: `Δ ${d <= 0 ? '−' : '+'}${(Math.abs(d) / 1000).toFixed(2)}s`,
              color: d <= 0 ? THROTTLE_TRACE : BRAKE_TRACE,
            },
          ]);
        }
      }
      if (rows.length === 0) return;
      ctx.font = '11px system-ui';
      const rowH = 15;
      const boxW =
        Math.max(
          ...rows.map((segs) => segs.reduce((w, s) => w + ctx.measureText(s.text).width, 0)),
        ) + 12;
      const bx = x + 12 + boxW > width ? x - 12 - boxW : x + 12;
      const by = 24;
      ctx.beginPath();
      ctx.roundRect(bx - 6, by - 13, boxW, rows.length * rowH + 6, 6);
      ctx.fillStyle = 'rgba(13, 13, 13, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();
      rows.forEach((segs, row) => {
        let sx = bx;
        for (const seg of segs) {
          ctx.fillStyle = seg.color;
          ctx.fillText(seg.text, sx, by + row * rowH);
          sx += ctx.measureText(seg.text).width;
        }
      });
    };

    // Dirty-gated rAF: repaint only when selection, reference, recordings
    // version, scrub position, or canvas size actually changed.
    let lastSel: LapRecording | null = null;
    let lastRef: LapRecording | null = null;
    let lastVersion = -1;
    let lastMouse: number | null = null;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    let firstDraw = true;
    let layerKey = '';

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const sel = selectedRef.current;
      const ref = referenceRef.current;
      const v = versionRef.current;
      const dirty =
        firstDraw ||
        sel !== lastSel ||
        ref !== lastRef ||
        v !== lastVersion ||
        mousePos !== lastMouse ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastSel = sel;
      lastRef = ref;
      lastVersion = v;
      lastMouse = mousePos;
      lastW = width;
      lastH = height;
      lastDpr = dpr;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!sel) {
        layerKey = '';
        return;
      }
      const key = `${v}|${sel.lap}|${ref?.lap ?? -1}|${width}x${height}@${dpr}`;
      if (key !== layerKey) {
        layerKey = key;
        renderTraces(sel, ref, width, height, dpr);
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(traceLayer, 0, 0);
      ctx.restore();
      drawScrubOverlay(width, height);
    };

    const scrubAt = (offsetX: number) => {
      const width = canvas.clientWidth;
      if (width <= PAD_X * 2) return;
      const pos = Math.min(1, Math.max(0, (offsetX - PAD_X) / (width - PAD_X * 2)));
      mousePos = pos;
      const sel = selectedRef.current;
      const point = sel ? worldPointAt(sel.samples, pos) : null;
      scrubRef.current = sel && point ? { ...point, color: lapColor(sel.lap) } : null;
    };
    const clearScrub = () => {
      mousePos = null;
      scrubRef.current = null;
    };
    const onMouseMove = (e: MouseEvent) => scrubAt(e.offsetX);
    // Touch scrub: a finger drag moves the cursor exactly like mouse motion
    // (preventDefault keeps the page from scrolling), lifting it clears like
    // the mouse leaving.
    const onTouchScrub = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      scrubAt(e.touches[0].clientX - rect.left);
    };
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', clearScrub);
    canvas.addEventListener('touchstart', onTouchScrub, { passive: false });
    canvas.addEventListener('touchmove', onTouchScrub, { passive: false });
    canvas.addEventListener('touchend', clearScrub);
    canvas.addEventListener('touchcancel', clearScrub);

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', clearScrub);
      canvas.removeEventListener('touchstart', onTouchScrub);
      canvas.removeEventListener('touchmove', onTouchScrub);
      canvas.removeEventListener('touchend', clearScrub);
      canvas.removeEventListener('touchcancel', clearScrub);
      scrubRef.current = null;
    };
  }, [scrubRef]);

  const selectedRecord = selected ? laps.find((l) => l.lap === selected.lap) : undefined;
  const selectedValid = selected !== null && !(selectedRecord?.invalid ?? false);
  // Session best is strictly the fastest VALID lap in the log — an invalid
  // lap must never be presented as "best", even when its raw time is lower.
  const validTimes = laps.filter((l) => !l.invalid).map((l) => l.timeMs);
  const sessionBestMs = validTimes.length > 0 ? Math.min(...validTimes) : null;

  const sectorClass = (t: number | null, i: number): string => {
    if (t === null) return 'bg-surface';
    const bestT = best[i];
    // No valid baseline yet — inert, not "matched".
    if (bestT === null) return 'bg-hairline';
    // A cut lap can't own a best sector, so an invalid selected lap caps at
    // the "matched" tone even when its raw time is the fastest seen.
    if (selectedValid && t <= bestT + 1) return 'bg-best';
    if (t <= bestT + SECTOR_TOLERANCE_MS) return 'bg-ink-muted';
    return 'bg-hairline';
  };

  return (
    <div
      className="group relative shrink-0"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setOpen(false);
      }}
    >
      {/* Hover-revealed overlay floating above the bar (the Lap tile's
          session-list pattern): the map keeps its full height and the panel
          only occupies the screen while the pointer is inside the group.
          The surface is deliberately translucent with only a faint blur
          (bg-page/40, backdrop-blur-sm) so the track lines and — critically —
          the live car dot stay visible through the panel while a lap is being
          inspected; the bright canvas traces keep full opacity on top. It is
          also kept compact (short canvas) and height-capped (max-h-[42vh],
          overflow-y-auto) so it covers as little of the map as possible and
          scrolls rather than growing on short viewports.
          pb-2 bridges the gap so the cursor can travel bar → panel
          without closing it — no clicks anywhere on desktop. On touch, `open`
          is toggled by tapping the bar (Tailwind v4 scopes group-hover to
          hover-capable devices, so emulated hover never fights the state). */}
      <div
        className={`absolute bottom-full left-0 z-10 w-full pb-2 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <section className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto rounded-lg border border-edge bg-page/40 p-3 shadow-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-xs tracking-wide text-ink-muted uppercase">
              {selected && reference && reference !== selected ? (
                <>
                  Lap {selected.lap} vs Lap {reference.lap} (ref)
                </>
              ) : (
                'Lap analysis'
              )}
            </p>
            <div className="flex flex-wrap items-baseline gap-4 text-xs text-ink-muted">
              {theoreticalMs !== null && (
                <span>
                  Theoretical{' '}
                  <span className="font-semibold tabular-nums text-best">
                    {formatLapTime(theoreticalMs)}
                  </span>
                </span>
              )}
              {sessionBestMs !== null && (
                <span>
                  Session best{' '}
                  <span className="font-semibold tabular-nums text-ink-secondary">
                    {formatLapTime(sessionBestMs)}
                  </span>
                </span>
              )}
            </div>
          </div>

      {reviewableLaps.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {[...reviewableLaps].reverse().map((rec) => {
            const record = laps.find((l) => l.lap === rec.lap);
            const isSelected = selected === rec;
            return (
              // Hover selects (and sticks) — never a click, so the game keeps
              // controller input while the browser stays unfocused. Touch
              // selects by tap instead.
              <span
                key={rec.lap}
                onMouseEnter={() => setSelectedLap(rec.lap)}
                onPointerUp={(e) => {
                  if (e.pointerType === 'touch') setSelectedLap(rec.lap);
                }}
                className={`flex shrink-0 cursor-default items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${
                  isSelected ? 'border-accent/70 bg-page' : 'border-edge hover:border-accent/40'
                }`}
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ background: lapColor(rec.lap) }}
                />
                <span className="text-ink-muted">Lap {rec.lap}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    record?.invalid
                      ? 'text-critical'
                      : rec === reference
                        ? 'text-best'
                        : 'text-ink-secondary'
                  }`}
                >
                  {formatLapTime(rec.timeMs)}
                </span>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative h-24 lg:h-28">
        <canvas ref={canvasRef} className="size-full touch-none" />
        {!selected && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink-muted">
            Complete a valid lap to unlock analysis — speed, pedal and delta traces appear here
          </p>
        )}
      </div>

      {selectedSectors && (
        <div className="flex items-center gap-3">
          <span className="text-[0.65rem] tracking-wide text-ink-muted uppercase">Sectors</span>
          <div className="flex h-1.5 flex-1 gap-px overflow-hidden rounded-sm">
            {selectedSectors.map((t, i) => (
              // Slices are purely positional — the index is the identity.
              // eslint-disable-next-line react/no-array-index-key
              <span key={i} className={`flex-1 ${sectorClass(t, i)}`} />
            ))}
          </div>
        </div>
      )}
        </section>
      </div>

      {/* The always-visible collapsed bar; a tap toggles the panel on touch. */}
      <div
        className="flex items-center justify-between rounded-lg border border-edge bg-surface px-4 py-2 transition-colors hover:border-accent/60"
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') setOpen((o) => !o);
        }}
      >
        <span className="text-xs tracking-wide text-ink-muted uppercase">Lap analysis</span>
        <span className="text-xs text-ink-muted tabular-nums">
          {reviewableLaps.length === 0
            ? recordings.some((r) => r.complete)
              ? 'no valid laps yet'
              : 'no laps recorded yet'
            : `${reviewableLaps.length} lap${reviewableLaps.length === 1 ? '' : 's'}${
                sessionBestMs !== null ? ` · best ${formatLapTime(sessionBestMs)}` : ''
              }`}
        </span>
      </div>
    </div>
  );
};
