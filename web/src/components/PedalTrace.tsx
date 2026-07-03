import { useEffect, useRef } from 'react';
import type { InputSample } from '../hooks/useInputHistory';

const WINDOW_MS = 12000;
const PAD = 6;

const TRACES: { key: 'gas' | 'brake' | 'clutch'; color: string; width: number }[] = [
  { key: 'clutch', color: 'rgba(137, 135, 129, 0.9)', width: 1.5 },
  { key: 'brake', color: 'rgb(235, 55, 45)', width: 2 },
  { key: 'gas', color: 'rgb(18, 190, 60)', width: 2 },
];

export const PedalTrace = ({ historyRef }: { historyRef: React.RefObject<InputSample[]> }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId = 0;

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

      // Reference lines at 0/50/100%
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      for (const f of [0, 0.5, 1]) {
        const y = PAD + (1 - f) * (height - PAD * 2);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const history = historyRef.current;
      if (history.length < 2) return;
      const now = performance.now();

      for (const trace of TRACES) {
        ctx.strokeStyle = trace.color;
        ctx.lineWidth = trace.width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let started = false;
        for (const sample of history) {
          const age = now - sample.t;
          if (age > WINDOW_MS) continue;
          const x = width - (age / WINDOW_MS) * width;
          const y = PAD + (1 - Math.min(1, Math.max(0, sample[trace.key]))) * (height - PAD * 2);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [historyRef]);

  return (
    <section className="rounded-lg border border-edge bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-wide text-ink-muted uppercase">Pedal trace</p>
        <div className="flex gap-3 text-xs text-ink-muted">
          <span className="text-good">throttle</span>
          <span className="text-critical">brake</span>
          <span>clutch</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="mt-2 h-28 w-full" />
    </section>
  );
};
