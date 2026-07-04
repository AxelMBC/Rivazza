import type { ReactNode } from 'react';

// Dial geometry: 200×200 viewBox, needle pivot at center, 240° sweep
// starting at -120° from 12 o'clock (bottom-left) to +120° (bottom-right).
const CX = 100;
const CY = 100;
const START_DEG = -120;
const SWEEP_DEG = 240;

const FACE_RADIUS = 92;
const BEZEL_RADIUS = 96;
const TICK_OUTER = 86;
const MAJOR_TICK_INNER = 74;
const MINOR_TICK_INNER = 80;
const NUMERAL_RADIUS = 60;
const REDLINE_RADIUS = 83;

const polarToCartesian = (angleDeg: number, radius: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
};

const arcPath = (fromDeg: number, toDeg: number, radius: number) => {
  const from = polarToCartesian(fromDeg, radius);
  const to = polarToCartesian(toDeg, radius);
  const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
};

const tickLine = (angleDeg: number, innerRadius: number) => {
  const outer = polarToCartesian(angleDeg, TICK_OUTER);
  const inner = polarToCartesian(angleDeg, innerRadius);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
};

export const AnalogGauge = ({
  min,
  max,
  value,
  majorTickStep,
  minorTicksPerMajor = 1,
  redlineFrom,
  formatTickLabel,
  label,
  flash = false,
  children,
}: {
  min: number;
  max: number;
  value: number;
  majorTickStep: number;
  minorTicksPerMajor?: number;
  redlineFrom?: number;
  formatTickLabel?: (value: number) => string;
  label?: string;
  flash?: boolean;
  children?: ReactNode;
}) => {
  const range = max - min;
  const valueToAngle = (v: number) =>
    START_DEG + (range > 0 ? Math.min(1, Math.max(0, (v - min) / range)) : 0) * SWEEP_DEG;

  const majorValues: number[] = [];
  for (let v = min; v <= max; v += majorTickStep) majorValues.push(v);

  const minorAngles: number[] = [];
  for (let v = min; v < max; v += majorTickStep) {
    for (let i = 1; i <= minorTicksPerMajor; i += 1) {
      const minorValue = v + (majorTickStep * i) / (minorTicksPerMajor + 1);
      if (minorValue < max) minorAngles.push(valueToAngle(minorValue));
    }
  }

  const needleAngle = valueToAngle(value);

  return (
    <div className="relative">
      <svg viewBox="0 0 200 200" className="h-auto w-full">
        {/* Bezel ring and dark face */}
        <circle cx={CX} cy={CY} r={BEZEL_RADIUS} fill="none" stroke="var(--color-hairline)" strokeWidth={5} />
        <circle cx={CX} cy={CY} r={BEZEL_RADIUS} fill="none" stroke="var(--color-edge)" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={FACE_RADIUS} fill="var(--color-page)" stroke="var(--color-edge)" strokeWidth={1} />

        {/* Redline arc */}
        {redlineFrom !== undefined && (
          <path
            d={arcPath(valueToAngle(redlineFrom), valueToAngle(max), REDLINE_RADIUS)}
            fill="none"
            stroke="var(--color-redline)"
            strokeWidth={6}
            strokeLinecap="butt"
          />
        )}

        {/* Minor ticks */}
        {minorAngles.map((angle) => (
          <line
            key={angle}
            {...tickLine(angle, MINOR_TICK_INNER)}
            stroke="var(--color-ink-muted)"
            strokeWidth={1.5}
          />
        ))}

        {/* Major ticks and numerals */}
        {majorValues.map((v) => {
          const angle = valueToAngle(v);
          const numeral = polarToCartesian(angle, NUMERAL_RADIUS);
          const inRedline = redlineFrom !== undefined && v >= redlineFrom;
          return (
            <g key={v}>
              <line
                {...tickLine(angle, MAJOR_TICK_INNER)}
                stroke={inRedline ? 'var(--color-redline)' : 'var(--color-ink)'}
                strokeWidth={3}
              />
              <text
                x={numeral.x}
                y={numeral.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={inRedline ? 'var(--color-redline)' : 'var(--color-ink-secondary)'}
                fontSize={12}
                fontWeight={600}
                className="tabular-nums"
              >
                {formatTickLabel ? formatTickLabel(v) : String(v)}
              </text>
            </g>
          );
        })}

        {/* Unit label on the upper face */}
        {label && (
          <text
            x={CX}
            y={58}
            textAnchor="middle"
            fill="var(--color-ink-muted)"
            fontSize={9}
            letterSpacing={1}
            className="uppercase"
          >
            {label}
          </text>
        )}

        {/* Needle: CSS transform so transitions interpolate between frames */}
        <g
          className={flash ? 'animate-pulse' : ''}
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: '100px 100px',
            transition: 'transform 100ms linear',
          }}
        >
          <polygon
            points="100,22 97,100 100,112 103,100"
            fill="var(--color-redline)"
            stroke="var(--color-page)"
            strokeWidth={0.5}
          />
        </g>

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={8} fill="var(--color-hairline)" stroke="var(--color-edge)" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={3} fill="var(--color-ink-muted)" />
      </svg>

      {/* Lower-face window (odometer position) */}
      {children && (
        <div className="absolute left-1/2 top-[69%] -translate-x-1/2 -translate-y-1/2">{children}</div>
      )}
    </div>
  );
};
