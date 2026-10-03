import type {
  LapRecording,
  LapTelemetrySample,
} from "../../hooks/useLapRecordings";
import {
  interpolateTimeAt,
  SECTOR_COUNT,
  type SectorOwner,
} from "../../lib/lapAnalysis";
import { lapColor } from "../../lib/lapColors";

import {
  BRAKE_TRACE,
  CAPTION,
  GRID,
  INVALID_SLICE_ALPHA,
  INVALID_SLICE_BAR,
  layoutStrips,
  MIN_DELTA_RANGE_MS,
  PAD_X,
  plotX,
  REFERENCE_TRACE,
  RIBBON_H,
  SLICE_GAP,
  SLICE_INVALID,
  SLICE_UNOWNED,
  THROTTLE_TRACE,
  type Strip,
} from "./constants";

export const createTraceLayer = (canvas: HTMLCanvasElement) => {
  const traceLayer = document.createElement("canvas");
  const traceCtx = traceLayer.getContext("2d");
  if (!traceCtx) return null;

  const tracePolyline = (
    rec: LapRecording,
    width: number,
    strip: Strip,
    value: (s: LapTelemetrySample) => number,
    color: string,
    lineWidth: number,
  ) => {
    traceCtx.strokeStyle = color;
    traceCtx.lineWidth = lineWidth;
    traceCtx.lineJoin = "round";
    traceCtx.beginPath();
    rec.samples.forEach((s, i) => {
      const x = plotX(s.pos, width);
      const y = strip.top + (1 - Math.min(1, Math.max(0, value(s)))) * strip.h;
      if (i === 0) traceCtx.moveTo(x, y);
      else traceCtx.lineTo(x, y);
    });
    traceCtx.stroke();
  };

  const render = (
    sel: LapRecording,
    ref: LapRecording | null,
    owners: readonly (SectorOwner | null)[],
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

    for (let i = 0; i < SECTOR_COUNT; i++) {
      const owner = owners[i];
      const x0 = plotX(i / SECTOR_COUNT, width);
      const x1 = plotX((i + 1) / SECTOR_COUNT, width);
      const gap = i === SECTOR_COUNT - 1 ? 0 : SLICE_GAP;
      const w = x1 - x0 - gap;
      traceCtx.fillStyle = owner === null ? SLICE_UNOWNED : lapColor(owner.lap);
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
    tracePolyline(sel, width, strips.pedals, (s) => s.gas, THROTTLE_TRACE, 1.5);
    tracePolyline(sel, width, strips.pedals, (s) => s.brake, BRAKE_TRACE, 1.5);

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
    traceCtx.fillText(
      ref ? `±${(deltaRange / 1000).toFixed(1)}s` : "no valid reference",
      width - PAD_X,
      strips.delta.top - 4,
    );
    traceCtx.textAlign = "left";
  };

  return { layer: traceLayer, render };
};
