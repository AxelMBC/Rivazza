import type { ReactNode } from "react";

type Props = { open: boolean; children: ReactNode };

export const RevealPanel = ({ open, children }: Props) => (
  <div
    className={`absolute bottom-full left-0 z-10 w-full pb-2 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 ${
      open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
    }`}
  >
    {children}
  </div>
);
