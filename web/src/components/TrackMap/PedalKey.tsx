import { BRAKE, COAST, rgb, THROTTLE } from "./palette";

const SWATCHES = [
  ["Throttle", THROTTLE],
  ["Coast", COAST],
  ["Brake", BRAKE],
] as const;

export const PedalKey = () =>
  SWATCHES.map(([label, color]) => (
    <span key={label} className="flex items-center gap-1">
      <span
        className="inline-block size-2 rounded-full"
        style={{ background: rgb(color) }}
      />
      {label}
    </span>
  ));
