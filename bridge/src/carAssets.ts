import fs from 'node:fs';
import path from 'node:path';
import { AC_PATH } from './trackAssets.js';

// AC exposes each car's advertised specs in plaintext at
// content/cars/<carName>/ui/ui_car.json, where <carName> is the folder id from
// the handshake (e.g. "abarth500"). We only need one field, and these files
// routinely carry raw control characters that make JSON.parse throw, so we scan
// the text for the topspeed field instead of parsing the whole document —
// mirroring how parsers.ts tolerates garbage rather than trusting the format.
//
// specs.topspeed is free text: "211km/h", "322+km/h" (a leading digit run is
// enough), or placeholders like "--km/h" / "---" / "" that carry no number.
// Returns the top speed in km/h, or null when it can't be resolved.
export const resolveCarTopSpeed = (carName: string): number | null => {
  const uiPath = path.join(AC_PATH, 'content', 'cars', carName, 'ui', 'ui_car.json');
  let text: string;
  try {
    text = fs.readFileSync(uiPath, 'utf8');
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
