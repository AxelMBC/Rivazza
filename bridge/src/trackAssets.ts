import fs from 'node:fs';
import path from 'node:path';
import type { MapMeta } from './types.js';

const DEFAULT_AC_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\assettocorsa';
const STEAM_LIBRARY_CONFIGS = [
  'C:\\Program Files (x86)\\Steam\\config\\libraryfolders.vdf',
  'C:\\Program Files\\Steam\\config\\libraryfolders.vdf',
];

// AC_PATH override -> any Steam library containing assettocorsa -> default.
const discoverAcPath = (): string => {
  if (process.env.AC_PATH) return process.env.AC_PATH;
  for (const vdfPath of STEAM_LIBRARY_CONFIGS) {
    let vdf: string;
    try {
      vdf = fs.readFileSync(vdfPath, 'utf8');
    } catch {
      continue;
    }
    // libraryfolders.vdf lists every library (default included) as "path" "X:\\...".
    for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      const library = match[1].replace(/\\\\/g, '\\');
      const candidate = path.join(library, 'steamapps', 'common', 'assettocorsa');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return DEFAULT_AC_PATH;
};

export const AC_PATH = discoverAcPath();
if (fs.existsSync(AC_PATH)) {
  console.log(`[map] using AC install at ${AC_PATH}`);
} else {
  console.warn(
    `[map] AC install not found at ${AC_PATH} — set the AC_PATH env var to your assettocorsa folder`,
  );
}

// meta (data/map.ini) alone is enough for track bounds; the image is optional.
export type TrackAssets = {
  meta: MapMeta;
  mapImagePath: string | null;
};

const parseMapIni = (iniPath: string): MapMeta | null => {
  const values: Record<string, number> = {};
  for (const line of fs.readFileSync(iniPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(-?[\d.]+)/);
    if (match) values[match[1]] = Number(match[2]);
  }
  const { WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR } = values;
  if ([WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR].some((v) => v === undefined)) return null;
  return {
    width: WIDTH,
    height: HEIGHT,
    xOffset: X_OFFSET,
    zOffset: Z_OFFSET,
    scaleFactor: SCALE_FACTOR,
  };
};

// Layout-specific assets live in content/tracks/<track>/<config>/, base
// (single-layout) tracks keep them at the track root.
export const resolveTrackAssets = (track: string, trackConfig: string): TrackAssets | null => {
  const trackRoot = path.join(AC_PATH, 'content', 'tracks', track);
  const candidates = trackConfig ? [path.join(trackRoot, trackConfig), trackRoot] : [trackRoot];

  for (const dir of candidates) {
    const iniPath = path.join(dir, 'data', 'map.ini');
    if (!fs.existsSync(iniPath)) continue;
    try {
      const meta = parseMapIni(iniPath);
      if (!meta) continue;
      const mapImagePath = path.join(dir, 'map.png');
      return { meta, mapImagePath: fs.existsSync(mapImagePath) ? mapImagePath : null };
    } catch (err) {
      console.error(`[map] failed to parse ${iniPath}:`, err);
    }
  }
  // JSON.stringify exposes invisible characters in the handshake strings.
  console.warn(
    `[map] no map data found for track ${JSON.stringify(track)} (config ${JSON.stringify(trackConfig)})`,
  );
  return null;
};
