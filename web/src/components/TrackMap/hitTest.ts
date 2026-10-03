import type { LapRecord } from "../../hooks/useLapHistory";
import { formatGearCompact, formatLapTime } from "../../lib/format";
import { COLORED_LAPS, lapColor } from "../../lib/lapColors";

import { DEAD_ZONE, HOVER_RADIUS_SQ } from "./constants";
import type { StoredLap } from "./lineRecorder";
import { insideRect, type Inset, type Point } from "./overviewInset";
import {
  bucketColor,
  bucketKey,
  HOVERED_GREY_LAP,
  INVALID_TIME,
} from "./palette";
import type { Project } from "./projection";

// Samples are ~1 m apart, so a stride of 3 stays faithful to the line
// while keeping the scan cheap over a full session of laps.
const PICK_STRIDE = 3;

type HitTestDeps = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mouseRef: React.RefObject<Point | null>;
  previousLapsRef: React.RefObject<StoredLap[]>;
  lapsRef: React.RefObject<LapRecord[]>;
  insetRef: React.RefObject<Inset | null>;
  cameraDrivesView: () => boolean;
};

export const createHitTest = ({
  canvas,
  ctx,
  mouseRef,
  previousLapsRef,
  lapsRef,
  insetRef,
  cameraDrivesView,
}: HitTestDeps) => {
  type HoverRow = {
    lap: number;
    color: string;
    speedKmh: number;
    gas: number;
    brake: number;
    gear: number;
  };
  type HitResult = {
    nearest: number;
    rows: HoverRow[];
    marker: { x: number; z: number; color: string } | null;
  };

  const hitTestLaps = (project: Project): HitResult => {
    const m = mouseRef.current;
    const laps = previousLapsRef.current;
    if (
      !m ||
      laps.length === 0 ||
      cameraDrivesView() ||
      (insetRef.current && insideRect(insetRef.current, m))
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
      for (let i = 0; i < samples.length; i += PICK_STRIDE) {
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
    rows.reverse();
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

  return { hitTestLaps, drawHoverReadout, setCursor };
};
