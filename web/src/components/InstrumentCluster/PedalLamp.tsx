export const PedalLamp = ({
  label,
  active,
  activeClass,
}: {
  label: string;
  active: boolean;
  activeClass: string;
}) => (
  <div aria-label={label} className="flex flex-col items-center gap-1">
    <span
      className={`h-12 w-1.5 rounded-full transition-colors ${
        active ? activeClass : "bg-hairline"
      }`}
    />
    <span className="text-[0.6rem] font-semibold tracking-wider text-ink-muted">
      {label}
    </span>
  </div>
);
