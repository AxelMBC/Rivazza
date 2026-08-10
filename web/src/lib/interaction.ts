import { IS_DEMO } from "./demo";

export const CLICK_MODE = IS_DEMO;

export const isImmediateActivation = (e: { pointerType: string }) =>
  e.pointerType === "touch" || (CLICK_MODE && e.pointerType === "mouse");

export const HOVER_GROUP_CLASS = CLICK_MODE ? "" : "group";
