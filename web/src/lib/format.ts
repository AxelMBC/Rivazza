export const formatLapTime = (ms: number | null | undefined): string => {
  if (!ms || ms <= 0) return '--:--.---';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

// AC gears: 0 = reverse, 1 = neutral, 2+ = forward gears.
export const formatGear = (gear: number): string =>
  gear === 0 ? 'R' : gear === 1 ? 'N' : String(gear - 1);

// Compact hover-readout form: forward gears as G1..Gn, R/N unchanged.
export const formatGearCompact = (gear: number): string =>
  gear >= 2 ? `G${gear - 1}` : formatGear(gear);

// "ks_brands_hatch" -> "Brands Hatch"
export const prettifyName = (id: string): string =>
  id
    .replace(/^ks_/, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
