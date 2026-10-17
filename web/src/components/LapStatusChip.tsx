import type { LapStatus } from "../hooks/useLapHistory";
import { lapStatusTag } from "../lib/lapStatus";

type Props = { status: LapStatus | undefined; className?: string };

export const LapStatusChip = ({ status, className = "" }: Props) => {
  const tag = lapStatusTag(status);
  if (!tag) return null;
  return (
    <span className={`text-[0.65rem] uppercase ${tag.toneClass} ${className}`}>
      {tag.text}
    </span>
  );
};
