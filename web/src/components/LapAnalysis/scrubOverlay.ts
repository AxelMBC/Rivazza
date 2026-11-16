import type { LapRecording } from "../../hooks/useLapRecordings";
import { formatDelta, formatGearCompact } from "../../lib/format";
import {
  interpolateTimeAt,
  sampleNear,
  type SectorOwner,
} from "../../lib/lapAnalysis";
import { lapColor } from "../../lib/lapColors";
import {
  sectorIndexAt,
  sectorLabel,
  type SectorDivision,
} from "../../lib/sectorDivision";

import {
  BRAKE_TRACE,
  CAPTION,
  COAST_TEXT,
  layoutStrips,
  PAD_X,
  plotX,
  SCRUB_BAND,
  SECTORS_CAPTION,
  SLICE_INVALID,
  THROTTLE_TRACE,
} from "./constants";

const READOUT_GAP = 12;

const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  for (let length = text.length - 1; length > 0; length--) {
    const shortened = `${text.slice(0, length).trimEnd()}…`;
    if (ctx.measureText(shortened).width <= maxWidth) return shortened;
  }
  return "";
};

export const drawScrubOverlay = (
  ctx: CanvasRenderingContext2D,
  pos: number,
  sel: LapRecording,
  ref: LapRecording | null,
  division: SectorDivision,
  owners: readonly (SectorOwner | null)[],
  width: number,
  height: number,
) => {
  const strips = layoutStrips(height);
  const x = plotX(pos, width);
  const bottom = strips.sectors.top + strips.sectors.h;

  const slice = sectorIndexAt(division, pos);
  ctx.fillStyle = SCRUB_BAND;
  const bandX = plotX(division.bounds[slice], width);
  ctx.fillRect(
    bandX,
    strips.speed.top,
    plotX(division.bounds[slice + 1], width) - bandX,
    bottom - strips.speed.top,
  );

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, strips.speed.top);
  ctx.lineTo(x, bottom);
  ctx.stroke();

  const owner = owners[slice];
  if (owner) {
    const lapPart = `Lap ${owner.lap} · `;
    const tail = `${(owner.timeMs / 1000).toFixed(3)}${owner.invalid ? " inv" : ""}`;
    ctx.font = "10px system-ui";
    const captionEnd =
      PAD_X + ctx.measureText(SECTORS_CAPTION).width + READOUT_GAP;
    const name = fitText(
      ctx,
      sectorLabel(division, slice),
      width -
        PAD_X -
        captionEnd -
        ctx.measureText(` · ${lapPart}${tail}`).width,
    );
    const head = name ? `${name} · ${lapPart}` : lapPart;
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
          text: `Δ ${formatDelta(d)}s`,
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
