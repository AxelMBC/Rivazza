import { useEffect, useRef } from 'react';
import type { InputSample } from '../hooks/useInputHistory';

const MAX_G = 2.5; // outer edge of the gauge
const RINGS = [1, 2];
const PATH_SAMPLES = 60; // ~2s of recent dot travel at the ~30 Hz state rate

export const GForceMeter = ({ historyRef }: { historyRef: React.RefObject<InputSample[]> }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId = 0;

    // Dirty gating: the meter is purely data-driven (no time scrolling), so
    // it only repaints when the input history or canvas size changes.
    // lastLen starts at -1 so the first frame paints the empty rings.
    let lastLen = -1;
    let lastT = -1;
    let lastW = 0;
    let lastH = 0;
    let lastDpr = 0;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const history = historyRef.current;
      const newest = history[history.length - 1];
      const dirty =
        width !== lastW ||
        height !== lastH ||
        dpr !== lastDpr ||
        history.length !== lastLen ||
        (newest?.t ?? -1) !== lastT;
      if (!dirty) return;
      lastW = width;
      lastH = height;
      lastDpr = dpr;
      lastLen = history.length;
      lastT = newest?.t ?? -1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2 - 6;

      // Crosshair + G rings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();
      ctx.fillStyle = 'rgba(137, 135, 129, 0.8)';
      ctx.font = '10px system-ui';
      for (const g of RINGS) {
        const r = (g / MAX_G) * radius;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(`${g}G`, cx + r + 2, cy - 2);
      }

      if (history.length === 0) return;

      // Lateral G on x, longitudinal on y (braking pulls the dot down).
      const project = (s: InputSample) => ({
        px: cx + (Math.max(-MAX_G, Math.min(MAX_G, s.accGH)) / MAX_G) * radius,
        py: cy + (Math.max(-MAX_G, Math.min(MAX_G, s.accGF)) / MAX_G) * radius,
      });

      const recent = history.slice(-PATH_SAMPLES);
      ctx.strokeStyle = 'rgba(57, 135, 229, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      recent.forEach((s, i) => {
        const { px, py } = project(s);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      const { px, py } = project(history[history.length - 1]);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3987e5';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [historyRef]);

  return (
    <section className="flex flex-col rounded-lg border border-edge bg-surface p-4">
      <p className="text-xs tracking-wide text-ink-muted uppercase">G-force</p>
      <canvas ref={canvasRef} className="mt-2 aspect-square w-full" />
    </section>
  );
};
