// The advertised top speed is a marketing number that in-game speed regularly
// beats (drafting, downhill, gearing), so the dial gets headroom over it.
const HEADROOM = 1.08;
// Conventional speedo increments, ascending; the smallest one that stays
// within MAX_DIVISIONS wins, which keeps labels round.
const NICE_STEPS = [20, 25, 40, 50, 60, 80, 100];
const MAX_DIVISIONS = 8;
const FALLBACK = { max: 320, majorTickStep: 40 };

export const speedScale = (
  topSpeedKmh: number | null,
): { max: number; majorTickStep: number } => {
  if (topSpeedKmh == null || topSpeedKmh <= 0) return FALLBACK;

  const target = topSpeedKmh * HEADROOM;
  for (const step of NICE_STEPS) {
    const divisions = Math.ceil(target / step);
    if (divisions <= MAX_DIVISIONS)
      return { max: divisions * step, majorTickStep: step };
  }
  // Absurdly fast mod (>~800 km/h): clamp to the coarsest step at 8 divisions.
  const step = NICE_STEPS[NICE_STEPS.length - 1];
  return { max: MAX_DIVISIONS * step, majorTickStep: step };
};
