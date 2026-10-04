import { useEffect, useRef, useState } from "react";

import type { LapRecord } from "../../hooks/useLapHistory";
import type { LapRecording } from "../../hooks/useLapRecordings";
import { formatLapTime } from "../../lib/format";
import {
  CLICK_MODE,
  HOVER_GROUP_CLASS,
  isImmediateActivation,
} from "../../lib/interaction";
import {
  bestSectors,
  latestComplete,
  resolveReference,
  SECTOR_COUNT,
  sectorOwners,
  theoreticalBestMs,
  type ScrubPoint,
} from "../../lib/lapAnalysis";
import { lapStatusTag } from "../../lib/lapStatus";

import { ownersKey } from "./constants";
import { LapChips } from "./LapChips";
import { attachScrub } from "./scrubInput";
import { drawScrubOverlay } from "./scrubOverlay";
import { createTraceLayer } from "./traceLayer";

type Props = {
  recordingsRef: React.RefObject<LapRecording[]>;
  version: number;
  lapsRef: React.RefObject<LapRecord[]>;
  scrubRef: React.RefObject<ScrubPoint | null>;
  analysisLapRef: React.RefObject<number | null>;
  className?: string;
};

export const LapAnalysis = ({
  recordingsRef,
  version,
  lapsRef,
  scrubRef,
  analysisLapRef,
  className = "",
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const recordings = recordingsRef.current;
  const laps = lapsRef.current;
  const reviewableLaps = recordings.filter((r) => r.complete);
  const reference = resolveReference(recordings, laps);
  const latest = latestComplete(recordings);
  const selected =
    (selectedLap !== null
      ? reviewableLaps.find((r) => r.lap === selectedLap)
      : undefined) ?? latest;

  useEffect(() => {
    if (
      selectedLap !== null &&
      !recordingsRef.current.some((r) => r.complete && r.lap === selectedLap)
    )
      setSelectedLap(null);
  }, [version, selectedLap, recordingsRef]);

  useEffect(() => {
    analysisLapRef.current = open && selected ? selected.lap : null;
    return () => {
      analysisLapRef.current = null;
    };
  }, [open, selected, analysisLapRef]);

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
  const scrubPosRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const traces = createTraceLayer(canvas);
    if (!traces) return;
    let rafId = 0;

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
        scrubPosRef.current !== lastMouse ||
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr;
      if (!dirty) return;
      firstDraw = false;
      lastSel = sel;
      lastRef = ref;
      lastVersion = v;
      lastOwners = ok;
      lastMouse = scrubPosRef.current;
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
        traces.render(sel, ref, ownersRef.current, width, height, dpr);
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(traces.layer, 0, 0);
      ctx.restore();
      if (scrubPosRef.current !== null)
        drawScrubOverlay(
          ctx,
          scrubPosRef.current,
          sel,
          ref,
          ownersRef.current,
          width,
          height,
        );
    };

    const detachScrub = attachScrub(canvas, {
      scrubPosRef,
      selectedRef,
      scrubRef,
    });

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      detachScrub();
      scrubRef.current = null;
    };
  }, [scrubRef]);

  const selectedTag =
    selected === null
      ? null
      : lapStatusTag(laps.find((l) => l.lap === selected.lap)?.status);
  const validTimes = laps
    .filter((l) => l.status === "valid")
    .map((l) => l.timeMs);
  const sessionBestMs = validTimes.length > 0 ? Math.min(...validTimes) : null;

  return (
    <div
      className={`${HOVER_GROUP_CLASS} relative shrink-0 ${className}`}
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
                  <span className={selectedTag?.toneClass ?? ""}>
                    Lap {selected.lap}
                    {selectedTag && ` (${selectedTag.text})`}
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
            <LapChips
              reviewableLaps={reviewableLaps}
              laps={laps}
              selected={selected}
              reference={reference}
              onSelect={setSelectedLap}
            />
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
