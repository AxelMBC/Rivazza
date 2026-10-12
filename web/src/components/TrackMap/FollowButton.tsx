import { CLICK_MODE } from "../../lib/interaction";

import { DWELL_FILL_CLASS } from "./constants";
import type { FollowControl, FollowState } from "./useFollowControl";

type Props = {
  followUi: FollowState;
  dwelling: boolean;
  hasFrame: boolean;
  follow: FollowControl;
};

export const FollowButton = ({
  followUi,
  dwelling,
  hasFrame,
  follow,
}: Props) => (
  <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1.5">
    {(followUi === "off" ? hasFrame : followUi !== "exiting") && (
      <button
        type="button"
        onMouseEnter={follow.startDwell}
        onMouseLeave={follow.leaveDwell}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") e.preventDefault();
        }}
        onPointerUp={follow.onFollowActivate}
        title={
          CLICK_MODE
            ? followUi === "off"
              ? "Click to follow the car"
              : "Click to leave follow mode"
            : "Rest the cursor here for 1 second — no click needed"
        }
        className={`pointer-events-auto relative overflow-hidden rounded border border-edge bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink-secondary ${
          CLICK_MODE ? "cursor-pointer" : ""
        }`}
      >
        {followUi === "off" ? "Follow car" : "Exit follow"}
        <span
          className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent ${
            dwelling
              ? `w-full transition-[width] ease-linear ${DWELL_FILL_CLASS}`
              : "w-0"
          }`}
        />
      </button>
    )}
  </div>
);
