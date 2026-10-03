import { SLIP_CRITICAL, WHEEL_LABELS } from "./constants";

const TYRE_WIDTH = 10;
const TYRE_HEIGHT = 16;

const TYRE_POSITIONS = [
  { x: 1, y: 12 },
  { x: 37, y: 12 },
  { x: 1, y: 54 },
  { x: 37, y: 54 },
] as const;

const tyreClass = (
  hasTelemetry: boolean,
  lit: boolean,
  slip: number,
): string => {
  if (!hasTelemetry) return "fill-hairline opacity-40";
  if (!lit) return "fill-hairline";
  return slip >= SLIP_CRITICAL ? "fill-critical" : "fill-warning";
};

export const CarSlipGlyph = ({
  lamps,
  slip,
}: {
  lamps: readonly boolean[];
  slip: readonly number[] | undefined;
}) => (
  <svg viewBox="0 0 48 82" className="h-18 w-auto">
    <path
      d="M19 2 H29 L35 16 V74 Q35 80 29 80 H19 Q13 80 13 74 V16 Z"
      fill="var(--color-page)"
      stroke="var(--color-edge)"
      strokeWidth={1.5}
    />
    <path
      d="M10 20 H38 M10 62 H38"
      stroke="var(--color-edge)"
      strokeWidth={1.5}
    />
    {TYRE_POSITIONS.map(({ x, y }, i) => (
      <rect
        key={WHEEL_LABELS[i]}
        x={x}
        y={y}
        width={TYRE_WIDTH}
        height={TYRE_HEIGHT}
        rx={2}
        stroke="var(--color-edge)"
        strokeWidth={1}
        className={`transition-colors ${tyreClass(
          slip !== undefined,
          lamps[i],
          slip?.[i] ?? 0,
        )}`}
      >
        <title>{WHEEL_LABELS[i]}</title>
      </rect>
    ))}
  </svg>
);
