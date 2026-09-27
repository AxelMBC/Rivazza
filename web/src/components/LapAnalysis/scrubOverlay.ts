import type { LapRecording } from "../../hooks/useLapRecordings";
import { formatGearCompact } from "../../lib/format";
import {
  interpolateTimeAt,
  sampleNear,
  SECTOR_COUNT,
  type SectorOwner,
} from "../../lib/lapAnalysis";
import { lapColor } from "../../lib/lapColors";

import {
  BRAKE_TRACE,
  CAPTION,
  COAST_TEXT,
  layoutStrips,
  PAD_X,
  plotX,
  SCRUB_BAND,
  SLICE_INVALID,
  sliceAt,
  THROTTLE_TRACE,
} from "./constants";

export const drawScrubOverlay = (
  ctx: CanvasRenderingContext2D,
  pos: number,
  sel: LapRecording,
  ref: LapRecording | null,
  owners: readonly (SectorOwner | null)[],
  width: number,
  height: number,
) => {
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
  const owner = owners[slice];
  if (owner) {
    const head = `S${slice + 1} · Lap ${owner.lap} · `;
    const tail = `${(owner.timeMs / 1000).toFixed(3)}${owner.invalid ? " inv" : ""}`;
    ctx.font = "10px system-ui";
    const headW = ctx.measureText(head).width;
    const readoutX = width - PAD_X - headW - ctx.measureText(tail).width;
    const readoutY = strips.sectors.top - 4;
    ctx.fillStyle = CAPTION;
    ctx.fillText(head, readoutX, readoutY);
    ctx.fillStyle = owner.invalid ? SLICE_INVALID : "rgba(255, 255, 255, 0.75)";
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
