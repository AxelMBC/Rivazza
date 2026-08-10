// Hues deliberately avoid the green / red / yellow reserved for the current
// lap's pedal gradient.
export const LAP_PALETTE = [
  "#3f8efc",
  "#a06bf5",
  "#2fd0e0",
  "#f25fd0",
  "#8f9dff",
];
export const COLORED_LAPS = LAP_PALETTE.length;
export const lapColor = (lap: number): string =>
  LAP_PALETTE[lap % LAP_PALETTE.length];
