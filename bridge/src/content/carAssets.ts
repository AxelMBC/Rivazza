import fs from "node:fs";
import path from "node:path";

import { AC_PATH } from "./acPath.js";

export const resolveCarTopSpeed = (carName: string): number | null => {
  const uiPath = path.join(
    AC_PATH,
    "content",
    "cars",
    carName,
    "ui",
    "ui_car.json",
  );
  let text: string;
  try {
    text = fs.readFileSync(uiPath, "utf8");
  } catch {
    return null;
  }

  const field = text.match(/"topspeed"\s*:\s*"([^"]*)"/i);
  if (!field) return null;
  const digits = field[1].match(/\d+/);
  if (!digits) return null;
  const kmh = Number(digits[0]);
  return kmh > 0 ? kmh : null;
};
