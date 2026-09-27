import type { LapRecording } from "../../hooks/useLapRecordings";
import { worldPointAt, type ScrubPoint } from "../../lib/lapAnalysis";
import { lapColor } from "../../lib/lapColors";

import { PAD_X, sliceAt } from "./constants";

type ScrubDeps = {
  scrubPosRef: React.RefObject<number | null>;
  selectedRef: React.RefObject<LapRecording | null>;
  scrubRef: React.RefObject<ScrubPoint | null>;
};

export const attachScrub = (
  canvas: HTMLCanvasElement,
  { scrubPosRef, selectedRef, scrubRef }: ScrubDeps,
) => {
  const scrubAt = (offsetX: number) => {
    const width = canvas.clientWidth;
    if (width <= PAD_X * 2) return;
    const pos = Math.min(
      1,
      Math.max(0, (offsetX - PAD_X) / (width - PAD_X * 2)),
    );
    scrubPosRef.current = pos;
    const sel = selectedRef.current;
    const point = sel ? worldPointAt(sel.samples, pos) : null;
    scrubRef.current =
      sel && point
        ? { ...point, color: lapColor(sel.lap), slice: sliceAt(pos) }
        : null;
  };
  const clearScrub = () => {
    scrubPosRef.current = null;
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

  return () => {
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mouseleave", clearScrub);
    canvas.removeEventListener("touchstart", onTouchScrub);
    canvas.removeEventListener("touchmove", onTouchScrub);
    canvas.removeEventListener("touchend", clearScrub);
    canvas.removeEventListener("touchcancel", clearScrub);
  };
};
