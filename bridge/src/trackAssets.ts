import fs from 'node:fs';
import path from 'node:path';
import { resolveTrackEdges } from './aiSpline.js';
import type { MapMeta, TrackEdges } from './types.js';

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

// The three assets resolve independently: meta (data/map.ini) fixes the
// viewport, edges (ai/fast_lane.ai) depict the track limits, and the image
// exists but is deliberately never drawn by the web app.
export type TrackAssets = {
  meta: MapMeta | null;
  mapImagePath: string | null;
  edges: TrackEdges | null;
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

  let meta: MapMeta | null = null;
  let mapImagePath: string | null = null;
  for (const dir of candidates) {
    const iniPath = path.join(dir, 'data', 'map.ini');
    if (!fs.existsSync(iniPath)) continue;
    try {
      meta = parseMapIni(iniPath);
      if (!meta) continue;
      const imagePath = path.join(dir, 'map.png');
      mapImagePath = fs.existsSync(imagePath) ? imagePath : null;
      break;
    } catch (err) {
      console.error(`[map] failed to parse ${iniPath}:`, err);
    }
  }

  // First existing fast_lane.ai wins with no fallthrough: on a multi-layout
  // track the root spline describes a different layout, so a layout file
  // that fails validation must not fall back to it.
  let edges: TrackEdges | null = null;
  for (const dir of candidates) {
    const aiPath = path.join(dir, 'ai', 'fast_lane.ai');
    if (!fs.existsSync(aiPath)) continue;
    edges = resolveTrackEdges(aiPath, meta);
    break;
  }

  if (!meta && !edges) {
    // JSON.stringify exposes invisible characters in the handshake strings.
    console.warn(
      `[map] no map data found for track ${JSON.stringify(track)} (config ${JSON.stringify(trackConfig)})`,
    );
    return null;
  }
  return { meta, mapImagePath, edges };
};
