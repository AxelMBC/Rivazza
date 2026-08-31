import { useEffect, useRef, useState } from "react";

import type { LapRecord } from "../hooks/useLapHistory";
import type {
  LapRecording,
  LapTelemetrySample,
} from "../hooks/useLapRecordings";
import { formatGearCompact, formatLapTime } from "../lib/format";
import {
  CLICK_MODE,
  HOVER_GROUP_CLASS,
  isImmediateActivation,
} from "../lib/interaction";
import {
  bestSectors,
  interpolateTimeAt,
  resolveReference,
  sampleNear,
  SECTOR_COUNT,
  sectorOwners,
  theoreticalBestMs,
  worldPointAt,
  type ScrubPoint,
  type SectorOwner,
} from "../lib/lapAnalysis";
import { lapColor } from "../lib/lapColors";

type Props = {
  recordingsRef: React.RefObject<LapRecording[]>;
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
// Fixed, not a share of the panel height: the ribbon carries meaning in colour
// alone, and a proportional height turns it into a hairline on short viewports.
const RIBBON_H = 12;
const SLICE_GAP = 1; // the DOM ribbon's gap-px, so boundaries stay readable
// Same canvas color literals as the map/pedal-trace convention.
const REFERENCE_TRACE = "rgba(255, 255, 255, 0.4)";
const THROTTLE_TRACE = "rgb(18, 190, 60)";
const BRAKE_TRACE = "rgb(235, 55, 45)";
const COAST_TEXT = "#fab219";
const GRID = "rgba(255, 255, 255, 0.07)";
const CAPTION = "rgba(255, 255, 255, 0.35)";
const SLICE_UNOWNED = "#2c2c2a"; // --color-hairline
const SLICE_INVALID = "#d03b3b"; // --color-critical
const INVALID_SLICE_BAR = 3; // of RIBBON_H, so it reads as a mark on the slice
// Dim enough that an invalid slice never competes with the laps that count,
// opaque enough that its lap hue stays nameable against the panel ground.
const INVALID_SLICE_ALPHA = 0.45;
const SCRUB_BAND = "rgba(255, 255, 255, 0.07)";
// Delta strip never zooms tighter than ±0.5 s, so tiny wobbles read as flat.
const MIN_DELTA_RANGE_MS = 500;

type Strip = { top: number; h: number };

const layoutStrips = (
  height: number,
): { speed: Strip; pedals: Strip; delta: Strip; sectors: Strip } => {
  const avail = height - PAD_TOP - PAD_BOTTOM - STRIP_GAP * 3 - RIBBON_H;
  const speed = { top: PAD_TOP, h: avail * 0.42 };
  const pedals = { top: speed.top + speed.h + STRIP_GAP, h: avail * 0.24 };
  const delta = { top: pedals.top + pedals.h + STRIP_GAP, h: avail * 0.34 };
  const sectors = { top: delta.top + delta.h + STRIP_GAP, h: RIBBON_H };
  return { speed, pedals, delta, sectors };
};

const sliceAt = (pos: number) =>
  Math.min(SECTOR_COUNT - 1, Math.floor(pos * SECTOR_COUNT));

// The recordings version does not cover the ribbon: a lap's invalid flag can
// land in the lap log frames after its recording is stored, flipping a slice's
// colour with no version bump. Fingerprinting the owners keeps the cached trace
// layer correct without rebuilding it on every scrub frame.
const ownersKey = (owners: readonly (SectorOwner | null)[]) =>
  owners
    .map((o) => (o === null ? "-" : `${o.lap}${o.invalid ? "!" : ""}`))
    .join();

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
  // Every complete lap is reviewable, cut ones included — a lap the game threw
  // out is where the driver went faster and where they went off, which is worth
  // more than it costs. Invalidity is marked, never filtered.
  const invalidLaps = new Set(laps.filter((l) => l.invalid).map((l) => l.lap));
  const reviewableLaps = recordings.filter((r) => r.complete);
  const reference = resolveReference(recordings, laps);
  const latest =
    reviewableLaps.length > 0
      ? reviewableLaps[reviewableLaps.length - 1]
      : null;
  const selected =
    (selectedLap !== null
      ? reviewableLaps.find((r) => r.lap === selectedLap)
      : undefined) ?? latest;

  // A sticky selection falls back to follow-latest when its recording is
  // evicted by the lap cap or cleared by a reset — but not when the lap is
  // invalidated, which now leaves it selected. (Render-time resolution above
  // already falls back; this clears the stale state.)
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

  // Both sector tables are derived on every render, not memoized by the
  // recording version: a lap's invalid flag can land in the lap log a few
  // frames after the recording is stored, and a memo keyed on the version
  // would keep crediting a cut lap with best sectors (and a theoretical
  // best) until the next lap completes. The math is a few hundred
  // interpolations — negligible at the 30 Hz render rate.
  const theoreticalMs = theoreticalBestMs(
    bestSectors(recordings, laps, SECTOR_COUNT),
  );
  const owners = sectorOwners(recordings, laps, SECTOR_COUNT);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const referenceRef = useRef(reference);
  referenceRef.current = reference;
  const versionRef = useRef(version);
  versionRef.current = version;
  const ownersRef = useRef(owners);
  ownersRef.current = owners;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Offscreen trace layer: rebuilt only when selection/reference/recordings
    // change, so a scrub frame is a blit plus the cursor overlay.
    const traceLayer = document.createElement("canvas");
    const traceCtx = traceLayer.getContext("2d");
    if (!traceCtx) return;
    let rafId = 0;
    let mousePos: number | null = null;

    const plotX = (pos: number, width: number) =>
      PAD_X + pos * (width - PAD_X * 2);

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
      traceCtx.lineJoin = "round";
      traceCtx.beginPath();
      rec.samples.forEach((s, i) => {
        const x = plotX(s.pos, width);
        const y =
          strip.top + (1 - Math.min(1, Math.max(0, value(s)))) * strip.h;
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
      if (
        traceLayer.width !== canvas.width ||
        traceLayer.height !== canvas.height
      ) {
        traceLayer.width = canvas.width;
        traceLayer.height = canvas.height;
      }
      traceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traceCtx.clearRect(0, 0, width, height);
      const strips = layoutStrips(height);

      const owners = ownersRef.current;
      for (let i = 0; i < SECTOR_COUNT; i++) {
        const owner = owners[i];
        const x0 = plotX(i / SECTOR_COUNT, width);
        const x1 = plotX((i + 1) / SECTOR_COUNT, width);
        // The last slice keeps its full width so the ribbon ends flush with
        // the traces above it.
        const gap = i === SECTOR_COUNT - 1 ? 0 : SLICE_GAP;
        const w = x1 - x0 - gap;
        traceCtx.fillStyle =
          owner === null ? SLICE_UNOWNED : lapColor(owner.lap);
        traceCtx.globalAlpha = owner?.invalid ? INVALID_SLICE_ALPHA : 1;
        traceCtx.fillRect(x0, strips.sectors.top, w, RIBBON_H);
        traceCtx.globalAlpha = 1;
        if (owner?.invalid) {
          traceCtx.fillStyle = SLICE_INVALID;
          traceCtx.fillRect(
            x0,
            strips.sectors.top + RIBBON_H - INVALID_SLICE_BAR,
            w,
            INVALID_SLICE_BAR,
          );
        }
      }

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
        tracePolyline(
          ref,
          width,
          strips.speed,
          (s) => s.speedKmh / maxSpeed,
          REFERENCE_TRACE,
          1.5,
        );
      tracePolyline(
        sel,
        width,
        strips.speed,
        (s) => s.speedKmh / maxSpeed,
        lapColor(sel.lap),
        2,
      );

      if (showRef) {
        tracePolyline(
          ref,
          width,
          strips.pedals,
          (s) => s.gas,
          "rgba(18, 190, 60, 0.35)",
          1.5,
        );
        tracePolyline(
          ref,
          width,
          strips.pedals,
          (s) => s.brake,
          "rgba(235, 55, 45, 0.35)",
          1.5,
        );
      }
      tracePolyline(
        sel,
        width,
        strips.pedals,
        (s) => s.gas,
        THROTTLE_TRACE,
        1.5,
      );
      tracePolyline(
        sel,
        width,
        strips.pedals,
        (s) => s.brake,
        BRAKE_TRACE,
        1.5,
      );

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
      traceCtx.strokeStyle = "rgba(255, 255, 255, 0.18)";
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
        traceCtx.lineCap = "round";
        traceCtx.strokeStyle = BRAKE_TRACE;
        traceCtx.stroke(losing);
        traceCtx.strokeStyle = THROTTLE_TRACE;
        traceCtx.stroke(gaining);
      }

      traceCtx.font = "10px system-ui";
      traceCtx.fillStyle = CAPTION;
      traceCtx.fillText("SPEED", PAD_X, strips.speed.top - 4);
      traceCtx.fillText("THROTTLE / BRAKE", PAD_X, strips.pedals.top - 4);
      traceCtx.fillText("DELTA TO REFERENCE", PAD_X, strips.delta.top - 4);
      traceCtx.fillText("SECTORS", PAD_X, strips.sectors.top - 4);
      traceCtx.textAlign = "right";
      traceCtx.fillText(
        `${Math.round(maxSpeed)} km/h`,
        width - PAD_X,
        strips.speed.top - 4,
      );
      // With every complete lap cut there is no reference at all, and the
      // delta strip is a bare zero line that reads as broken without this.
      traceCtx.fillText(
        ref ? `±${(deltaRange / 1000).toFixed(1)}s` : "no valid reference",
        width - PAD_X,
        strips.delta.top - 4,
      );
      traceCtx.textAlign = "left";
    };

    const drawScrubOverlay = (width: number, height: number) => {
      const sel = selectedRef.current;
      if (mousePos === null || !sel) return;
      const pos = mousePos;
      const ref = referenceRef.current;
      const strips = layoutStrips(height);
      const x = plotX(pos, width);
      const bottom = strips.sectors.top + strips.sectors.h;

      const slice = sliceAt(pos);
      ctx.fillStyle = SCRUB_BAND;
      const bandX = plotX(slice / SECTOR_COUNT, width);
      ctx.fillRect(
        bandX,
        strips.speed.top,
        plotX((slice + 1) / SECTOR_COUNT, width) - bandX,
        bottom - strips.speed.top,
      );

      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, strips.speed.top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      // The lap palette repeats every COLORED_LAPS laps, so past that the
      // ribbon's colours alone cannot name a slice's owner.
      const owner = ownersRef.current[slice];
      if (owner) {
        const head = `S${slice + 1} · Lap ${owner.lap} · `;
        const tail = `${(owner.timeMs / 1000).toFixed(3)}${owner.invalid ? " inv" : ""}`;
        ctx.font = "10px system-ui";
        const headW = ctx.measureText(head).width;
        const readoutX = width - PAD_X - headW - ctx.measureText(tail).width;
        const readoutY = strips.sectors.top - 4;
        ctx.fillStyle = CAPTION;
        ctx.fillText(head, readoutX, readoutY);
        ctx.fillStyle = owner.invalid
          ? SLICE_INVALID
          : "rgba(255, 255, 255, 0.75)";
        ctx.fillText(tail, readoutX + headW, readoutY);
      }

      type Seg = { text: string; color: string };
      const rows: Seg[][] = [];
      const rowFor = (rec: LapRecording, color: string): Seg[] | null => {
        const s = sampleNear(rec.samples, pos);
        if (!s) return null;
        const pedal: Seg =
          s.brake > 0.05 && s.brake >= s.gas
            ? {
                text: ` · BRK ${Math.round(s.brake * 100)}%`,
                color: BRAKE_TRACE,
              }
            : s.gas > 0.05
              ? {
                  text: ` · THR ${Math.round(s.gas * 100)}%`,
                  color: THROTTLE_TRACE,
                }
              : { text: " · coast", color: COAST_TEXT };
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
        const refRow = rowFor(ref, "rgba(255, 255, 255, 0.65)");
        if (refRow) rows.push(refRow);
        const tSel = interpolateTimeAt(sel.samples, pos);
        const tRef = interpolateTimeAt(ref.samples, pos);
        if (tSel !== null && tRef !== null) {
          const d = tSel - tRef;
          rows.push([
            {
              text: `Δ ${d <= 0 ? "−" : "+"}${(Math.abs(d) / 1000).toFixed(2)}s`,
              color: d <= 0 ? THROTTLE_TRACE : BRAKE_TRACE,
            },
          ]);
        }
      }
      if (rows.length === 0) return;
      ctx.font = "11px system-ui";
      const rowH = 15;
      const boxW =
        Math.max(
          ...rows.map((segs) =>
            segs.reduce((w, s) => w + ctx.measureText(s.text).width, 0),
          ),
        ) + 12;
      const bx = x + 12 + boxW > width ? x - 12 - boxW : x + 12;
      const by = 24;
      ctx.beginPath();
      ctx.roundRect(bx - 6, by - 13, boxW, rows.length * rowH + 6, 6);
      ctx.fillStyle = "rgba(13, 13, 13, 0.92)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
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
    let lastOwners = "";
    let lastMouse: number | null = null;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;
    let firstDraw = true;
    let layerKey = "";

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const sel = selectedRef.current;
      const ref = referenceRef.current;
      const v = versionRef.current;
      const ok = ownersKey(ownersRef.current);
      const dirty =
        firstDraw ||
        sel !== lastSel ||
        ref !== lastRef ||
        v !== lastVersion ||
        ok !== lastOwners ||
        mousePos !== lastMouse ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastSel = sel;
      lastRef = ref;
      lastVersion = v;
      lastOwners = ok;
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
        layerKey = "";
        return;
      }
      const key = `${v}|${sel.lap}|${ref?.lap ?? -1}|${ok}|${width}x${height}@${dpr}`;
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
      const pos = Math.min(
        1,
        Math.max(0, (offsetX - PAD_X) / (width - PAD_X * 2)),
      );
      mousePos = pos;
      const sel = selectedRef.current;
      const point = sel ? worldPointAt(sel.samples, pos) : null;
      scrubRef.current =
        sel && point ? { ...point, color: lapColor(sel.lap) } : null;
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
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", clearScrub);
    canvas.addEventListener("touchstart", onTouchScrub, { passive: false });
    canvas.addEventListener("touchmove", onTouchScrub, { passive: false });
    canvas.addEventListener("touchend", clearScrub);
    canvas.addEventListener("touchcancel", clearScrub);

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", clearScrub);
      canvas.removeEventListener("touchstart", onTouchScrub);
      canvas.removeEventListener("touchmove", onTouchScrub);
      canvas.removeEventListener("touchend", clearScrub);
      canvas.removeEventListener("touchcancel", clearScrub);
      scrubRef.current = null;
    };
  }, [scrubRef]);

  const selectedInvalid = selected !== null && invalidLaps.has(selected.lap);
  // Session best is strictly the fastest VALID lap in the log — an invalid
  // lap must never be presented as "best", even when its raw time is lower.
  const validTimes = laps.filter((l) => !l.invalid).map((l) => l.timeMs);
  const sessionBestMs = validTimes.length > 0 ? Math.min(...validTimes) : null;

  return (
    <div
      className={`${HOVER_GROUP_CLASS} relative shrink-0`}
      onPointerEnter={(e) => {
        if (!CLICK_MODE && e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (!CLICK_MODE && e.pointerType === "mouse") setOpen(false);
      }}
    >
      <div
        className={`absolute bottom-full left-0 z-10 w-full pb-2 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <section className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto rounded-lg border border-edge bg-page/40 p-3 shadow-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-xs tracking-wide text-ink-muted uppercase">
              {selected ? (
                <>
                  <span className={selectedInvalid ? "text-critical" : ""}>
                    Lap {selected.lap}
                    {selectedInvalid && " (inv)"}
                  </span>
                  {reference && reference !== selected && (
                    <> vs Lap {reference.lap} (ref)</>
                  )}
                </>
              ) : (
                "Lap analysis"
              )}
            </p>
            <div className="flex flex-wrap items-baseline gap-4 text-xs text-ink-muted">
              {theoreticalMs !== null && (
                <span>
                  Theoretical{" "}
                  <span className="font-semibold tabular-nums text-best">
                    {formatLapTime(theoreticalMs)}
                  </span>
                </span>
              )}
              {sessionBestMs !== null && (
                <span>
                  Session best{" "}
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
                  <span
                    key={rec.lap}
                    onMouseEnter={() => setSelectedLap(rec.lap)}
                    onPointerUp={(e) => {
                      if (e.pointerType === "touch") setSelectedLap(rec.lap);
                    }}
                    className={`flex shrink-0 cursor-default items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${
                      isSelected
                        ? "border-accent/70 bg-page"
                        : "border-edge hover:border-accent/40"
                    }`}
                  >
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: lapColor(rec.lap) }}
                    />
                    <span className="text-ink-muted">
                      Lap {rec.lap}
                      {record?.invalid && (
                        <span className="ml-1.5 text-[0.65rem] uppercase text-critical">
                          inv
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        record?.invalid
                          ? "text-critical"
                          : rec === reference
                            ? "text-best"
                            : "text-ink-secondary"
                      }`}
                    >
                      {formatLapTime(rec.timeMs)}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative h-32 lg:h-36">
            <canvas ref={canvasRef} className="size-full touch-none" />
            {!selected && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink-muted">
                Complete a lap to unlock analysis — speed, pedal and delta
                traces appear here
              </p>
            )}
          </div>
        </section>
      </div>

      <div
        className="flex items-center justify-between rounded-lg border border-edge bg-surface px-4 py-2 transition-colors hover:border-accent/60"
        onPointerUp={(e) => {
          if (isImmediateActivation(e)) setOpen((o) => !o);
        }}
      >
        <span className="text-xs tracking-wide text-ink-muted uppercase">
          Lap analysis
        </span>
        <span className="text-xs text-ink-muted tabular-nums">
          {reviewableLaps.length === 0
            ? "no laps recorded yet"
            : `${reviewableLaps.length} lap${reviewableLaps.length === 1 ? "" : "s"}${
                sessionBestMs !== null
                  ? ` · best ${formatLapTime(sessionBestMs)}`
                  : ""
              }`}
        </span>
      </div>
    </div>
  );
};
