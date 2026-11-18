const PEDAL_ON_THRESHOLD = 0.05;

const pedalLevel = (input: number): number =>
  input > PEDAL_ON_THRESHOLD ? Math.min(input, 1) : 0;

export const PedalLamp = ({
  label,
  input,
  fillClass,
}: {
  label: string;
  input: number;
  fillClass: string;
}) => {
  const level = pedalLevel(input);
  return (
    <div
      role="img"
      aria-label={`${label} ${Math.round(level * 100)}%`}
      className="flex flex-col items-center gap-1"
    >
      <span className="relative h-12 w-1.5 overflow-hidden rounded-full bg-hairline">
        <span
          className={`absolute inset-0 origin-bottom ${fillClass}`}
          style={{ scale: `1 ${level}` }}
        />
      </span>
      <span className="text-[0.6rem] font-semibold tracking-wider text-ink-muted">
        {label}
      </span>
    </div>
  );
};
