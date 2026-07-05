// Derives the speedometer dial scale from a car's advertised top speed.
//
// The advertised figure is a marketing number that in-game speed regularly
// beats (drafting, downhill, gearing), so we add headroom before rounding the
// dial maximum up to a clean value. The major-tick step is chosen so the dial
// shows ~6–8 evenly labeled divisions with round labels for any top speed.
//
// When top speed is unavailable the dial falls back to the original fixed
// 0–320 km/h / 40 km/h-tick scale.
const HEADROOM = 1.08;
// Conventional speedo increments, ascending. We pick the smallest that keeps
// the dial to at most 8 divisions, which keeps labels round and the needle
// spread across the face.
const NICE_STEPS = [20, 25, 40, 50, 60, 80, 100];
const MAX_DIVISIONS = 8;
const FALLBACK = { max: 320, majorTickStep: 40 };

export const speedScale = (topSpeedKmh: number | null): { max: number; majorTickStep: number } => {
  if (topSpeedKmh == null || topSpeedKmh <= 0) return FALLBACK;

  const target = topSpeedKmh * HEADROOM;
  for (const step of NICE_STEPS) {
    const divisions = Math.ceil(target / step);
    if (divisions <= MAX_DIVISIONS) return { max: divisions * step, majorTickStep: step };
  }
  // Absurdly fast mod (>~800 km/h): clamp to the coarsest step at 8 divisions.
  const step = NICE_STEPS[NICE_STEPS.length - 1];
  return { max: MAX_DIVISIONS * step, majorTickStep: step };
};
