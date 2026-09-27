import type { TelemetryFrame } from "@rivazza/protocol";
import { useEffect, useState } from "react";

import { CLICK_MODE, isImmediateActivation } from "../../lib/interaction";
import { SYNTHETIC_MOUSE_WINDOW_MS } from "../../lib/touch";

import { FOLLOW_DWELL_MS, FOLLOW_WINDOW_M } from "./constants";

// Follow cam: hover-dwell armed (never a click — clicks would focus the
// browser and steal controller input from the game). 'following' tracks the
// car, 'detached' is manual zoom/pan after a touch drag interrupted a follow
// (the exit button stays), 'exiting' animates back to the 1× fit view.
export type FollowState = "off" | "following" | "detached" | "exiting";

const createFollowControl = (
  telemetryRef: React.RefObject<TelemetryFrame | null>,
  setFollowUi: (state: FollowState) => void,
  setDwelling: (dwelling: boolean) => void,
) => {
  const followWindowRef = { current: FOLLOW_WINDOW_M };
  const followLimitsRef = { current: { min: 0, max: Infinity } };
  const followRef: { current: FollowState } = { current: "off" };
  const setFollow = (state: FollowState) => {
    followRef.current = state;
    setFollowUi(state);
  };
  let dwellTimer: number | null = null;
  let armReady = true;
  let touchToggleAt = -SYNTHETIC_MOUSE_WINDOW_MS;
  const cancelDwell = () => {
    if (dwellTimer !== null) {
      clearTimeout(dwellTimer);
      dwellTimer = null;
    }
    setDwelling(false);
  };

  const cameraDrivesView = () =>
    followRef.current === "following" || followRef.current === "exiting";

  const retargetFollow = (factor: number) => {
    const wanted = followWindowRef.current * factor;
    if (wanted > followLimitsRef.current.max) return false;
    followWindowRef.current = wanted;
    return true;
  };

  const fireDwell = () => {
    if (followRef.current !== "off") {
      setFollow("exiting");
    } else if (telemetryRef.current) {
      setFollow("following");
    }
  };

  const startDwell = () => {
    if (CLICK_MODE) return;
    if (performance.now() - touchToggleAt < SYNTHETIC_MOUSE_WINDOW_MS) return;
    if (!armReady) return;
    cancelDwell();
    setDwelling(true);
    dwellTimer = window.setTimeout(() => {
      dwellTimer = null;
      armReady = false;
      setDwelling(false);
      fireDwell();
    }, FOLLOW_DWELL_MS);
  };

  const leaveDwell = () => {
    armReady = true;
    cancelDwell();
  };

  const onFollowActivate = (e: React.PointerEvent) => {
    if (!isImmediateActivation(e)) return;
    touchToggleAt = performance.now();
    leaveDwell();
    const st = followRef.current;
    if (st === "off") {
      if (telemetryRef.current) setFollow("following");
    } else if (st !== "exiting") {
      setFollow("exiting");
    }
  };

  // Session change / restart ends follow mode with everything else, and any
  // adjusted framing goes with it — the next follow starts comfortable again.
  // The published bounds go too: the new session may be a different track, so
  // "not known until the camera says so" is exactly true again.
  const resetFollow = () => {
    cancelDwell();
    followWindowRef.current = FOLLOW_WINDOW_M;
    followLimitsRef.current = { min: 0, max: Infinity };
    setFollow("off");
  };

  return {
    followRef,
    setFollow,
    followWindowRef,
    followLimitsRef,
    cameraDrivesView,
    retargetFollow,
    startDwell,
    leaveDwell,
    cancelDwell,
    onFollowActivate,
    resetFollow,
  };
};

export type FollowControl = ReturnType<typeof createFollowControl>;

// `follow` is created once and never changes identity: everything on it reads
// refs or calls state setters, so effects can list it without re-running.
export const useFollowControl = (
  telemetryRef: React.RefObject<TelemetryFrame | null>,
) => {
  const [followUi, setFollowUi] = useState<FollowState>("off");
  const [dwelling, setDwelling] = useState(false);
  const [follow] = useState(() =>
    createFollowControl(telemetryRef, setFollowUi, setDwelling),
  );

  // The dwell timeout must not fire into an unmounted component.
  useEffect(() => follow.cancelDwell, [follow]);

  return { followUi, dwelling, follow };
};
